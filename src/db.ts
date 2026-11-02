import { openDB, IDBPDatabase } from 'idb';
import { InventoryItem, Transaction, Trader, Product, BillingInvoice, TraderMember } from './types';

const DB_NAME = 'biashara_offline_db';
const DB_VERSION = 1;

export interface SyncQueueItem {
    id: string;
    endpoint: string;
    method: string;
    body: any;
    timestamp: number;
    retries?: number;
    lastError?: string;
    status?: 'pending' | 'failed' | 'dead_letter';
}

export interface OfflineDB {
    inventory: InventoryItem;
    transactions: Transaction;
    traders: Trader;
    products: Product;
    billing_invoices: BillingInvoice;
    trader_members: TraderMember;
    sync_queue: SyncQueueItem;
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Stores for caching server data
                if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('traders')) db.createObjectStore('traders', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('billing_invoices')) db.createObjectStore('billing_invoices', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('trader_members')) db.createObjectStore('trader_members', { keyPath: 'id' });
                
                // Store for outgoing mutations when offline
                if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id' });
            },
        });
    }
    return dbPromise;
};

export const saveToCache = async (storeName: string, data: any[]) => {
    if (!data || !Array.isArray(data)) return;

    try {
        const db = await getDB();
        // Verify store exists
        if (!db.objectStoreNames.contains(storeName as any)) return;
        
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        // Clear old data and save fresh snapshot
        await store.clear();
        for (const item of data) {
            if (item && (item.id !== undefined && item.id !== null)) {
                await store.put(item);
            }
        }
        await tx.done;
    } catch (err) {
        console.warn(`[IndexedDB] Failed caching store ${storeName}:`, err);
    }
};

export const getFromCache = async <T>(storeName: string): Promise<T[]> => {
    try {
        const db = await getDB();
        if (!db.objectStoreNames.contains(storeName as any)) return [];
        return db.getAll(storeName);
    } catch (err) {
        console.warn(`[IndexedDB] Failed reading store ${storeName}:`, err);
        return [];
    }
};

export const addToQueue = async (endpoint: string, method: string, body: any) => {
    try {
        const db = await getDB();
        const id = Math.random().toString(36).substring(2) + Date.now().toString();
        const item: SyncQueueItem = {
            id,
            endpoint,
            method,
            body,
            timestamp: Date.now(),
            retries: 0,
            status: 'pending'
        };
        await db.add('sync_queue', item);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('biashara-sync-queue-changed'));
        }
    } catch (err) {
        console.warn('[IndexedDB] Failed to add mutation to sync queue:', err);
    }
};

export const getQueue = async (): Promise<SyncQueueItem[]> => {
    try {
        const db = await getDB();
        return db.getAll('sync_queue');
    } catch {
        return [];
    }
};

export const updateQueueItem = async (id: string, updates: Partial<SyncQueueItem>) => {
    try {
        const db = await getDB();
        const item = await db.get('sync_queue', id);
        if (item) {
            await db.put('sync_queue', { ...item, ...updates });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('biashara-sync-queue-changed'));
            }
        }
    } catch (err) {
        console.warn('[IndexedDB] Failed updating queue item:', err);
    }
};

export const removeFromQueue = async (id: string) => {
    try {
        const db = await getDB();
        await db.delete('sync_queue', id);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('biashara-sync-queue-changed'));
        }
    } catch (err) {
        console.warn('[IndexedDB] Failed deleting queue item:', err);
    }
};

export const clearQueue = async () => {
    try {
        const db = await getDB();
        await db.clear('sync_queue');
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('biashara-sync-queue-changed'));
        }
    } catch (err) {
        console.warn('[IndexedDB] Failed clearing queue:', err);
    }
};

// Client cryptographic helper
export const computeClientSHA256 = async (content: string): Promise<string> => {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return 'unsupported-crypto-env';
};

// Export complete IndexedDB + LocalStorage client cache as portable snapshot
export const exportClientOfflineSnapshot = async (): Promise<any> => {
    const stores = ['inventory', 'transactions', 'traders', 'products', 'billing_invoices', 'trader_members', 'sync_queue'];
    const snapshot: any = {
        app: 'BiasharaSasa_Client_Resilience',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        stores: {},
        counts: {}
    };

    try {
        const db = await getDB();
        for (const store of stores) {
            if (db.objectStoreNames.contains(store as any)) {
                const items = await db.getAll(store as any);
                snapshot.stores[store] = items || [];
                snapshot.counts[store] = (items || []).length;
            }
        }
    } catch (e) {
        console.warn('[Client Backup] IndexedDB export error:', e);
    }

    const jsonStr = JSON.stringify(snapshot.stores);
    snapshot.checksum = await computeClientSHA256(jsonStr);
    return snapshot;
};

// Restore client stores from a snapshot
export const importClientOfflineSnapshot = async (snapshot: any): Promise<{ success: boolean; rowsRestored: number; checksumVerified: boolean }> => {
    if (!snapshot || !snapshot.stores) {
        throw new Error('Invalid client snapshot format: missing stores');
    }

    let checksumVerified = false;
    if (snapshot.checksum) {
        const computed = await computeClientSHA256(JSON.stringify(snapshot.stores));
        checksumVerified = computed === snapshot.checksum;
    }

    const db = await getDB();
    let rowsRestored = 0;

    for (const [storeName, items] of Object.entries(snapshot.stores)) {
        if (db.objectStoreNames.contains(storeName as any) && Array.isArray(items)) {
            const tx = db.transaction(storeName as any, 'readwrite');
            const store = tx.objectStore(storeName as any);
            await store.clear();
            for (const item of items) {
                if (item && (item as any).id !== undefined) {
                    await store.put(item);
                    rowsRestored++;
                }
            }
            await tx.done;
        }
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('biashara-sync-queue-changed'));
    }

    return { success: true, rowsRestored, checksumVerified };
};

import * as db from '../db';
import * as api from '../api';
import { io, Socket } from 'socket.io-client';

class SyncService {
    private isSyncing = false;
    private syncInterval: number | null = null;
    private socket: Socket | null = null;
    private onSyncProgress: ((count: number) => void) | null = null;
    private onStatusChange: ((isOnline: boolean) => void) | null = null;
    private onRemoteUpdate: ((update: any) => void) | null = null;
    private onPendingCountChange: ((count: number) => void) | null = null;
    private lastPendingCount = 0;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.handleOnlineStatus(true));
            window.addEventListener('offline', () => this.handleOnlineStatus(false));
            
            // Initialize Socket.io
            this.initSocket();

            // Listen for queue changes from db.ts
            window.addEventListener('biashara-sync-queue-changed', () => {
                this.notifyQueueChanged();
            });

            // Initial check & pending queue polling - delayed to allow module initialization
            setTimeout(async () => {
                await this.checkPendingQueue();
                window.setInterval(() => this.checkPendingQueue(), 3000);

                if (navigator.onLine) {
                    // Check if api is fully initialized to avoid TDZ errors
                    try {
                        if (api && typeof api.syncOfflineData === 'function') {
                            this.startSync();
                        }
                    } catch (e) {
                        console.warn("[SyncService] API not ready for initial sync, will retry later.");
                    }
                }
            }, 1000);
        }
    }

    private initSocket() {
        // Connect to the same host that served the page
        this.socket = io(window.location.origin);

        this.socket.on('connect', () => {
            console.log("[Socket] Connected to server for real-time updates");
        });

        this.socket.on('system:update', (update) => {
            console.log("[Socket] Received system update:", update);
            if (this.onRemoteUpdate) {
                this.onRemoteUpdate(update);
            }
        });

        this.socket.on('disconnect', () => {
            console.log("[Socket] Disconnected from real-time server");
        });
    }

    public joinTraderRoom(traderId: number | null) {
        if (this.socket && traderId) {
            this.socket.emit('join:trader', traderId);
        }
    }

    public setRemoteUpdateCallback(cb: (update: any) => void) {
        this.onRemoteUpdate = cb;
    }

    private handleOnlineStatus(isOnline: boolean) {
        if (this.onStatusChange) {
            this.onStatusChange(isOnline);
        }
        if (isOnline) {
            this.startSync();
        }
    }

    public setProgressCallback(cb: (count: number) => void) {
        this.onSyncProgress = cb;
    }

    public setStatusCallback(cb: (isOnline: boolean) => void) {
        this.onStatusChange = cb;
    }

    public setPendingCountCallback(cb: (count: number) => void) {
        this.onPendingCountChange = cb;
        cb(this.lastPendingCount);
    }

    public async checkPendingQueue(): Promise<number> {
        try {
            const count = await this.getPendingCount();
            if (count !== this.lastPendingCount || this.onPendingCountChange) {
                this.lastPendingCount = count;
                if (this.onPendingCountChange) {
                    this.onPendingCountChange(count);
                }
            }
            return count;
        } catch (e) {
            return 0;
        }
    }

    public notifyQueueChanged() {
        this.checkPendingQueue();
    }

    public async startSync(): Promise<number> {
        if (this.isSyncing || !navigator.onLine) return 0;
        
        this.isSyncing = true;
        try {
            console.log("Starting background sync for pending transactions...");
            const count = await api.syncOfflineData();
            if (count > 0 && this.onSyncProgress) {
                this.onSyncProgress(count);
            }
            await this.checkPendingQueue();
            return count;
        } catch (err) {
            console.error("Background sync failed:", err);
            return 0;
        } finally {
            this.isSyncing = false;
            await this.checkPendingQueue();
        }
    }

    public startAutoSync(intervalMs: number = 60000) {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = window.setInterval(() => {
            this.startSync();
        }, intervalMs);
    }

    public stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    public async getPendingCount(): Promise<number> {
        const queue = await db.getQueue();
        return queue.length;
    }
}

export const syncService = new SyncService();

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Product, SubscriptionPlan, Trader, InventoryItem, Transaction, CartItem } from './types';
import * as api from './api';
import { syncService } from './services/SyncService';
import { Language, translations } from './translations';

interface AppContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    products: Product[];
    subscriptionPlans: SubscriptionPlan[];
    traders: Trader[];
    inventory: InventoryItem[];
    transactions: Transaction[];
    cart: CartItem[];
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    refreshData: () => Promise<void>;
    loading: boolean;
    showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
    rolePermissions: api.RolePermissions[];
    setRolePermissions: React.Dispatch<React.SetStateAction<api.RolePermissions[]>>;
    users: api.DBUser[];
    userTraders: Trader[];
    switchTrader: (traderId: number) => Promise<void>;
    refreshUsers: () => Promise<void>;
    refreshPermissions: () => Promise<void>;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
    isOnline: boolean;
    isSyncing: boolean;
    pendingSyncCount: number;
    triggerManualSync: () => Promise<void>;
    localServerIp: string;
    setLocalServerIp: (ip: string) => void;
    selectedSellingPoint: string;
    setSelectedSellingPoint: (sp: string) => void;
    logAuditAction: (action: string, details: any, severity?: 'info' | 'warning' | 'critical') => Promise<void>;
}

const DEFAULT_ROLE_PERMISSIONS: api.RolePermissions[] = [
    { role: 'admin', onboard: true, pos: true, traders: true, inventory: true, regime: true, reports: true, system: true },
    { role: 'manager', onboard: false, pos: true, traders: true, inventory: true, regime: true, reports: true, system: false },
    { role: 'cashier', onboard: false, pos: true, traders: false, inventory: false, regime: false, reports: false, system: false },
    { role: 'promoter', onboard: true, pos: true, traders: true, inventory: false, regime: false, reports: false, system: false }
];

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [user, setUserState] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem('biashara_user');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to restore authenticated user session:", e);
        }
        return null;
    });

    const setUser = (newUser: User | null) => {
        setUserState(newUser);
        try {
            if (newUser) {
                localStorage.setItem('biashara_user', JSON.stringify(newUser));
            } else {
                localStorage.removeItem('biashara_user');
            }
        } catch (e) {
            console.error("Failed to save authenticated user session:", e);
        }
    };

    const [products, setProducts] = useState<Product[]>([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
    const [traders, setTraders] = useState<Trader[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
    const [rolePermissions, setRolePermissions] = useState<api.RolePermissions[]>(DEFAULT_ROLE_PERMISSIONS);
    const [users, setUsers] = useState<api.DBUser[]>([]);
    const [userTraders, setUserTraders] = useState<Trader[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(true);

    const [localServerIp, setLocalServerIpState] = useState(() => {
        return localStorage.getItem('biashara_local_server_ip') || '';
    });
    const [selectedSellingPoint, setSelectedSellingPoint] = useState<string>('all');

    // Netlify Geo Detection Integration
    useEffect(() => {
        if (typeof document === 'undefined') return;
        
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
            return null;
        };

        const nfCountry = getCookie('nf_country');
        const nfCity = getCookie('nf_city');

        if (nfCountry) {
            console.log(`🌍 Netlify Geo Detected: ${nfCity}, ${nfCountry}`);
            // If the user hasn't manually set a language or region, we could auto-select it here
            // For now, we just log it as an "enhanced feature" confirmation
        }
    }, []);

    const setLocalServerIp = (ip: string) => {
        setLocalServerIpState(ip);
        localStorage.setItem('biashara_local_server_ip', ip);
    };

    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('biashara_language');
        return (saved === 'fr' || saved === 'sw') ? saved : 'en';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('biashara_language', lang);
    };

    const t = (key: string): string => {
        const dict = translations[language] || translations['en'];
        return (dict as any)[key] || (translations['en'] as any)[key] || key;
    };

    const showToast = React.useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const refreshUsers = React.useCallback(async () => {
        try {
            const u = await api.getUsers();
            setUsers(u);
        } catch (err) {
            console.error("Failed to load users:", err);
        }
    }, []);

    const refreshPermissions = React.useCallback(async () => {
        try {
            const p = await api.getRolePermissions();
            if (p && p.length > 0) {
                setRolePermissions(p);
            }
        } catch (err) {
            console.error("Failed to load permissions:", err);
        }
    }, []);

    const fetchUserTraders = React.useCallback(async () => {
        if (!user) {
            setUserTraders([]);
            return;
        }
        try {
            const data = await api.getMyTraders(user.username);
            setUserTraders(data);
        } catch (e) {
            console.error("Failed to fetch user traders:", e);
        }
    }, [user]);

    const switchTrader = React.useCallback(async (traderId: number) => {
        if (!user) return;
        setLoading(true);
        try {
            const targetTrader = userTraders.find(t => t.id === traderId);
            if (!targetTrader) {
                showToast("Target location not found", "error");
                return;
            }

            const updatedUser = { ...user, traderId };
            setUser(updatedUser);
            showToast(`Switched to ${targetTrader.businessName}`, "success");
            // refreshData will be triggered by useEffect [user]
        } catch (e) {
            console.error("Failed to switch trader:", e);
            showToast("Failed to switch location", "error");
        } finally {
            setLoading(false);
        }
    }, [user, userTraders, setUser, showToast]);

    useEffect(() => {
        if (user) {
            fetchUserTraders();
            if (user.traderId) {
                syncService.joinTraderRoom(user.traderId);
            }
        }
    }, [user?.username, user?.traderId, fetchUserTraders]);

    const refreshData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [p, s, t, i, tr] = await Promise.all([
                api.getProducts(),
                api.getSubscriptionPlans(),
                api.getTraders(),
                api.getInventory((user?.role === 'admin' && (user?.username?.toLowerCase().includes('admin') || !user?.traderId)) ? undefined : (user?.traderId || (user as any)?.trader_id || undefined)),
                api.getTransactions()
            ]);
            setProducts(p);
            setSubscriptionPlans(s);
            
            const safeTraders = Array.isArray(t) ? t : [];
            const safeInventory = Array.isArray(i) ? i : (i && Array.isArray((i as any).data) ? (i as any).data : []);
            const safeTransactions = Array.isArray(tr) ? tr : [];

            // Now, find the matched trader for the logged-in user
            const loggedInTrader = safeTraders.find(trader => trader.id === user?.traderId) || 
                                   safeTraders.find(trader => trader.email.toLowerCase() === user?.username.toLowerCase()) || 
                                   null;

            const isPlatformAdmin = user?.role === 'admin' && (user?.username?.toLowerCase().includes('admin') || !user?.traderId);
            const targetTraderId = user?.traderId || loggedInTrader?.id || (user as any)?.trader_id;
            const targetTenantId = user?.tenantId || (user as any)?.tenant_id || (targetTraderId ? `tenant_${targetTraderId}` : undefined);
            const targetSlug = user?.slug || (user as any)?.slug;

            // Strict Multi-Tenant Data Isolation (enforced for all tenant roles: owner, manager, cashier, accountant, stock_controller, etc.)
            if (!isPlatformAdmin) {
                if (loggedInTrader) {
                    // Personalize & Isolate: Only keep items belonging to this specific trader and their branches/vendors
                    const myNetwork = safeTraders.filter(tr => tr.id === loggedInTrader.id || tr.distributorId === loggedInTrader.id);
                    setTraders(myNetwork);
                    
                    const myTraderIds = myNetwork.map(tr => tr.id);
                    setInventory(safeInventory.filter(item => {
                        if (item.traderId && myTraderIds.includes(item.traderId)) return true;
                        if (targetTenantId && item.tenantId === targetTenantId) return true;
                        if (item.tenantId && myTraderIds.some(tid => item.tenantId === `tenant_${tid}`)) return true;
                        return false;
                    }));
                    setTransactions(safeTransactions.filter(tx => tx.traderId && myTraderIds.includes(tx.traderId)));

                    // Update hybrid sync settings in localStorage for apiFetch
                    localStorage.setItem('biashara_current_trader', JSON.stringify({
                        id: loggedInTrader.id,
                        serverIp: loggedInTrader.serverIp || '',
                        serverPort: loggedInTrader.serverPort || 8080
                    }));
                    if (loggedInTrader.serverIp) {
                        setLocalServerIp(loggedInTrader.serverIp);
                    }
                } else if (targetTraderId || targetTenantId) {
                    // Tenant member with ID: filter strictly to their specific trader/tenant account
                    setTraders([]);
                    setInventory(safeInventory.filter(item => {
                        if (targetTraderId && item.traderId === targetTraderId) return true;
                        if (targetTenantId && item.tenantId === targetTenantId) return true;
                        if (targetTraderId && item.tenantId === `tenant_${targetTraderId}`) return true;
                        return false;
                    }));
                    setTransactions(safeTransactions.filter(tx => targetTraderId && tx.traderId === targetTraderId));
                } else {
                    // Unidentified non-admin tenant: enforce strict zero-leak data isolation (empty records)
                    setTraders([]);
                    setInventory([]);
                    setTransactions([]);
                }
            } else {
                setTraders(safeTraders);
                setInventory(safeInventory);
                setTransactions(safeTransactions);
            }
            
            // Background load permissions and users list
            await Promise.all([
                refreshPermissions(),
                refreshUsers()
            ]);
        } catch (error: any) {
            console.error(error);
            showToast('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [user, refreshPermissions, refreshUsers, showToast]);

    useEffect(() => {
        if (user) {
            refreshData();
        }
    }, [user, refreshData]);

    const triggerManualSync = React.useCallback(async () => {
        setIsSyncing(true);
        try {
            const count = await syncService.startSync();
            if (count > 0) {
                showToast(`Uploaded and synced ${count} pending item(s) with Supabase server.`, "success");
            } else {
                const currentPending = await syncService.getPendingCount();
                if (currentPending === 0) {
                    showToast("All data is up to date with Supabase server.", "info");
                } else {
                    showToast(`${currentPending} item(s) pending upload. Retrying sync...`, "warning");
                }
            }
            await refreshData();
        } catch (e) {
            console.error("Manual sync error:", e);
            showToast("Failed to connect to server for sync.", "error");
        } finally {
            setIsSyncing(false);
        }
    }, [refreshData, showToast]);

    const logAuditAction = React.useCallback(async (action: string, details: any, severity: 'info' | 'warning' | 'critical' = 'info') => {
        try {
            await api.logAuditAction(
                action, 
                details, 
                user?.traderId, 
                traders.find(t => t.id === user?.traderId)?.businessName || 'System',
                user?.username || 'Unknown',
                severity,
                user?.role
            );
        } catch (err) {
            console.error("Failed to log audit action:", err);
        }
    }, [user, traders]);

    useEffect(() => {
        syncService.setPendingCountCallback((count) => {
            setPendingSyncCount(count);
        });

        syncService.setStatusCallback((online) => {
            setIsOnline(online);
            if (online) {
                showToast("You are back online. Synchronizing data...", "info");
            } else {
                showToast('Working Offline: Changes will be saved locally');
            }
        });

        syncService.setProgressCallback((count) => {
            if (count > 0) {
                showToast(`Successfully synced ${count} pending actions.`, "success");
                refreshData();
            }
        });

        syncService.setRemoteUpdateCallback((update) => {
            // Check if update is relevant
            console.log("Processing remote update:", update);
            
            // For now, most updates should trigger a data refresh to ensure UI is in sync
            // In a more complex app, we might update state partially
            refreshData();
            
            if (update.type === 'inventory:created' || update.type === 'inventory:updated') {
                showToast(`System Update: Inventory has been updated.`, "info");
            } else if (update.type === 'inventory:deleted' || update.type === 'inventory:deleted:bulk') {
                showToast(`System Update: Items were removed from inventory.`, "warning");
            } else if (update.type === 'sale:processed') {
                showToast(`Real-time: A new sale was just processed.`, "info");
            } else if (update.type === 'merchant:status') {
                showToast(`System: Merchant status updated.`, "info");
            }
        });

        syncService.startAutoSync(60000);

        return () => {
            syncService.stopAutoSync();
            syncService.setStatusCallback(() => {});
            syncService.setProgressCallback(() => {});
        };
    }, [refreshData, showToast]);

    useEffect(() => {
        if (!user) return;

        const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes
        let logoutTimer: number;

        const resetTimer = () => {
            if (logoutTimer) window.clearTimeout(logoutTimer);
            logoutTimer = window.setTimeout(() => {
                setUser(null);
                showToast("Logged out due to inactivity", "info");
            }, INACTIVITY_LIMIT);
        };

        const events = ['mousemove', 'keydown', 'click', 'scroll'];
        events.forEach(event => window.addEventListener(event, resetTimer));

        // Initial set
        resetTimer();

        return () => {
            if (logoutTimer) window.clearTimeout(logoutTimer);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [user, setUser, showToast]);

    const contextValue = React.useMemo(() => ({
        user, setUser, products, subscriptionPlans, traders, inventory, transactions, 
        cart, setCart, refreshData, loading, showToast, toast,
        rolePermissions, setRolePermissions, users, userTraders, switchTrader, refreshUsers, refreshPermissions,
        language, setLanguage, t, isOnline, isSyncing, pendingSyncCount, triggerManualSync, localServerIp, setLocalServerIp,
        selectedSellingPoint, setSelectedSellingPoint, logAuditAction
    }), [
        user, products, subscriptionPlans, traders, inventory, transactions, 
        cart, loading, toast, rolePermissions, users, userTraders, switchTrader, 
        language, isOnline, isSyncing, pendingSyncCount, triggerManualSync, localServerIp, 
        selectedSellingPoint, refreshData, showToast, refreshUsers, 
        refreshPermissions, setLanguage, t, setLocalServerIp, logAuditAction
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within AppProvider');
    return context;
};

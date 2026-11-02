/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context';
import { Login } from './components/Login';
import { Toast } from './components/Toast';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ArrowLeft } from 'lucide-react';
import { POSTab } from './components/tabs/POS';
import { TradersTab } from './components/tabs/Traders';
import { InventoryTab } from './components/tabs/Inventory';
import { ReportsTab } from './components/tabs/Reports';
import { SystemAdminTab } from './components/tabs/SystemAdmin';
import { SubscriptionsTab } from './components/tabs/Subscriptions';
import { AuditLogTab } from './components/tabs/AuditLog';
import { TourTab } from './components/tabs/Tour';
import { FinanceTab } from './components/tabs/Finance';
import { TaxComplianceTab } from './components/tabs/TaxCompliance';
import { ProductionTab } from './components/tabs/Production';
import { HRTab } from './components/tabs/HR';
import { ClientOnboardingTab } from './components/tabs/ClientOnboarding';
import { InviteTeamTab } from './components/tabs/InviteTeam';
import { GuestBanner } from './components/GuestBanner';
import { Landing } from './components/Landing';
import * as api from './api';

const AppContent: React.FC = () => {
    const { user, setUser, showToast, traders } = useAppContext();
    const [activeTab, setActiveTab] = useState('tour');
    const [preAuthView, setPreAuthView] = useState<'landing' | 'login'>('landing');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);

    // Global Error Reporting
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            if (event.message?.includes('/system/errors') || event.message?.includes('logSystemError')) {
                return;
            }
            api.logSystemError({
                type: 'UncaughtException',
                message: event.message,
                stack: event.error?.stack,
                url: window.location.href,
                user_id: user?.id,
                trader_id: user?.traderId
            }).catch(() => {});
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const reasonStr = String(event.reason?.message || event.reason || '');
            if (reasonStr.includes('/system/errors') || reasonStr.includes('logSystemError')) {
                return;
            }
            api.logSystemError({
                type: 'UnhandledRejection',
                message: reasonStr,
                stack: event.reason?.stack,
                url: window.location.href,
                user_id: user?.id,
                trader_id: user?.traderId
            }).catch(() => {});
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, [user]);

    // Free Tour logic migrated to a central place
    const handleStartTour = () => {
        api.enableLocalFallbackMode();
        
        // Seed tour data
        const txsKey = 'biashara_transactions';
        try {
            const existingTxsStr = localStorage.getItem(txsKey);
            const existingTxs = existingTxsStr ? JSON.parse(existingTxsStr) : [];
            
            if (existingTxs.length === 0) {
                const now = new Date();
                const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
                const twoDaysAgo = new Date(now); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                
                const demoTxs = [
                    {
                        id: 9991, invoiceNo: 'TOUR-001', traderId: 1, traderName: 'James Ochieng',
                        businessName: 'Green Grocers', customerName: 'Demo Customer A', paymentMethod: 'MPESA',
                        items: [{ id: 1, name: 'Tomatoes', price: 80, qty: 5 }], itemCount: 5,
                        subtotal: 400, discountRate: 0, discountAmount: 0, tax: 64, total: 464,
                        date: twoDaysAgo.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), time: '10:30'
                    },
                    {
                        id: 9992, invoiceNo: 'TOUR-002', traderId: 1, traderName: 'James Ochieng',
                        businessName: 'Green Grocers', customerName: 'Demo Customer B', paymentMethod: 'Cash',
                        items: [{ id: 2, name: 'Onions', price: 60, qty: 10 }], itemCount: 10,
                        subtotal: 600, discountRate: 10, discountAmount: 60, tax: 86.4, total: 626.4,
                        date: yesterday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), time: '14:45'
                    }
                ];
                localStorage.setItem(txsKey, JSON.stringify(demoTxs));
            }
        } catch (e) { console.warn("Tour seed failed:", e); }

        setUser({
            id: 9999,
            username: 'Guest Client',
            role: 'manager',
            traderId: 1,
            financeActive: true,
            taxActive: true,
            productionActive: true,
            hrActive: true
        });
        showToast("Free Tour started! You are now exploring the app with demo data.", "success");
    };

    useEffect(() => {
        const handleOnline = async () => {
            setIsOnline(true);
            setIsSyncing(true);
            try {
                const count = await api.syncOfflineData();
                if (count > 0) {
                    showToast?.(`Successfully synchronized ${count} offline actions`, 'success');
                }
            } catch (err) {
                console.error("[Sync Engine] Synchronization failed:", err);
            } finally {
                setIsSyncing(false);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            showToast?.("Connection lost. Switch to offline mode active.", "warning");
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (navigator.onLine) {
            handleOnline();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [showToast]);

    const isGuest = user?.username === 'Guest Client';

    useEffect(() => {
        if (user) {
            // If it's a guest, landing on tour is perfect. 
            // If it's a real user, they likely want to get to work (POS).
            if (user.username === 'Guest Client') {
                setActiveTab('tour');
            } else if (activeTab === 'tour') {
                setActiveTab('pos');
            }
        }
    }, [user]);

    // Enforce that Guest / Free Tour users cannot access Audit Log or System Admin
    useEffect(() => {
        if (isGuest && (activeTab === 'audit-log' || activeTab === 'system')) {
            setActiveTab('pos');
        }
    }, [isGuest, activeTab]);

    // Enforce module subscription guards: finance, tax, hr, production are only visible/accessible on subscription
    const currentTrader = traders.find(t => t.id === user?.traderId) || 
        traders.find(t => t.email.toLowerCase() === user?.username?.toLowerCase());
    const isProductionSubscribed = Boolean(currentTrader?.productionActive ?? user?.productionActive);
    const isFinanceSubscribed = Boolean(currentTrader?.financeActive ?? user?.financeActive);
    const isTaxSubscribed = Boolean(currentTrader?.taxActive ?? user?.taxActive);
    const isHrSubscribed = Boolean(currentTrader?.hrActive ?? user?.hrActive);
    const isAdmin = user?.role === 'admin' || user?.username?.toLowerCase().includes('admin');

    useEffect(() => {
        if (!isAdmin && user && !isGuest) {
            if (activeTab === 'finance' && !isFinanceSubscribed) {
                setActiveTab('subscriptions');
                showToast?.("Finance Module requires an active subscription. Subscribe in the Marketplace to activate.", "info");
            } else if (activeTab === 'tax' && !isTaxSubscribed) {
                setActiveTab('subscriptions');
                showToast?.("Tax Compliance Module requires an active subscription. Subscribe in the Marketplace to activate.", "info");
            } else if (activeTab === 'hr' && !isHrSubscribed) {
                setActiveTab('subscriptions');
                showToast?.("HR & Payroll Module requires an active subscription. Subscribe in the Marketplace to activate.", "info");
            } else if (activeTab === 'production' && !isProductionSubscribed) {
                setActiveTab('subscriptions');
                showToast?.("Production Module requires an active subscription. Subscribe in the Marketplace to activate.", "info");
            }
        }
    }, [activeTab, isAdmin, isFinanceSubscribed, isTaxSubscribed, isHrSubscribed, isProductionSubscribed, user, isGuest, showToast]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!user) {
        return (
            <>
                {preAuthView === 'landing' ? (
                    <Landing 
                        onLogin={() => setPreAuthView('login')} 
                        onTour={handleStartTour} 
                    />
                ) : (
                    <div className="relative">
                        <button 
                            onClick={() => setPreAuthView('landing')}
                            className="fixed top-6 left-6 z-[60] bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 border border-white/20 shadow-xl"
                        >
                            <ArrowLeft size={18} />
                            <span>Back</span>
                        </button>
                        <Login />
                    </div>
                )}
                <Toast />
            </>
        );
    }

    return (
        <>
            <GuestBanner activeTab={activeTab} onNavigate={setActiveTab} />
            <div className={`${isGuest ? 'pt-16 md:pt-14' : ''}`}>
                <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
                    {activeTab === 'tour' && <TourTab onNavigate={setActiveTab} />}
                    {activeTab === 'finance' && <FinanceTab />}
                    {activeTab === 'tax' && <TaxComplianceTab />}
                    {activeTab === 'hr' && <HRTab />}
                    {activeTab === 'pos' && <POSTab />}
                    {activeTab === 'traders' && <TradersTab setActiveTab={setActiveTab} />}
                    {activeTab === 'client-onboard' && <ClientOnboardingTab />}
                    {activeTab === 'inventory' && <InventoryTab />}
                    {activeTab === 'production' && <ProductionTab />}
                    {activeTab === 'reports' && <ReportsTab />}
                    {activeTab === 'subscriptions' && <SubscriptionsTab setActiveTab={setActiveTab} />}
                    {activeTab === 'invite-team' && <InviteTeamTab />}
                    {activeTab === 'audit-log' && !isGuest && <AuditLogTab />}
                    {activeTab === 'system' && !isGuest && <SystemAdminTab />}
                </Layout>
            </div>
            <Toast />
        </>
    );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

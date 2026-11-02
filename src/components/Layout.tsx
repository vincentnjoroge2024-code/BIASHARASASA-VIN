import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../context';
import { 
    LogOut, LayoutDashboard, ShoppingCart, Users, Package, Crown, BarChart2, 
    Server, WifiOff, RefreshCcw, Share2, MapPin, ClipboardList, Cloud, 
    CloudUpload, CloudOff, HelpCircle, Landmark, ShieldCheck,
    ZoomIn, ZoomOut, RotateCcw, Factory, Store, Building2, UserCheck,
    ChevronDown, Check, X, UserPlus
} from 'lucide-react';
import { ScrollProgressBar } from './ScrollProgressBar';
import { LogoSVG } from './Logo';
import { isLocalFallbackActive } from '../api';
import { SubscriptionRenewalBadge } from './SubscriptionRenewalBadge';
import { SubscriptionRenewalModal } from './SubscriptionRenewalModal';
import { SubscriptionAlertBanner } from './SubscriptionAlertBanner';
import { calculateTraderRenewal, getExpiringTradersList } from '../utils/subscriptionRenewal';
import { TENANT_ROLE_DEFINITIONS, MemberPermissions } from '../types';
import { normalizeTenantRole, getDefaultPermissionsForRole } from '../permissions';
import { TenantUsersModal } from './tabs/TenantUsersModal';

export const Layout: React.FC<{
    children: React.ReactNode, 
    activeTab: string, 
    setActiveTab: (tab: string) => void
}> = ({ children, activeTab, setActiveTab }) => {
    const { 
        user, setUser, cart, rolePermissions, language, setLanguage, t, 
        isOnline, isSyncing, pendingSyncCount, triggerManualSync, traders, refreshData, 
        userTraders, switchTrader,
        selectedSellingPoint, setSelectedSellingPoint,
        subscriptionPlans, showToast
    } = useAppContext();

    const [zoomLevel, setZoomLevel] = useState(100);
    const [showRenewalModal, setShowRenewalModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showTenantUsersModal, setShowTenantUsersModal] = useState(false);
    const mainRef = useRef<HTMLDivElement>(null);

    const zoomLevels = [50, 75, 90, 100, 110, 125, 150, 175, 200];

    const handleZoomIn = () => {
        setZoomLevel(prev => {
            const next = zoomLevels.find(z => z > prev);
            return next !== undefined ? next : Math.min(prev + 25, 200);
        });
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => {
            const next = [...zoomLevels].reverse().find(z => z < prev);
            return next !== undefined ? next : Math.max(prev - 25, 50);
        });
    };

    const handleZoomReset = () => {
        setZoomLevel(100);
    };

    const isTraderUser = user && (
        user.traderId !== null && user.traderId !== undefined ||
        ['owner', 'manager', 'cashier', 'sales_agent', 'stock_controller', 'accountant', 'production_supervisor', 'service_provider', 'supervisor', 'staff', 'promoter'].includes(user.role)
    );
    const loggedInTrader = isTraderUser && user.traderId 
        ? traders.find(t => t.id === user.traderId) 
        : (isTraderUser ? (traders.find(t => t.email.toLowerCase() === user.username.toLowerCase()) || traders[0]) : null);
    
    const isAdmin = user?.role === 'admin' || user?.role === 'promoter';

    // Calculate subscription renewal states (within 7 days)
    const currentTraderRenewal = useMemo(() => {
        if (!loggedInTrader) return null;
        return calculateTraderRenewal(loggedInTrader, subscriptionPlans);
    }, [loggedInTrader, subscriptionPlans]);

    const allExpiringTraders = useMemo(() => {
        return getExpiringTradersList(traders, subscriptionPlans, 7);
    }, [traders, subscriptionPlans]);

    if (!user) return null;

    const normalizedRole = normalizeTenantRole(user.role);
    const userRoleDef = TENANT_ROLE_DEFINITIONS.find(r => r.id === user.role || r.id === normalizedRole);
    const userRolePerm = rolePermissions.find(p => p.role === user.role || p.role === normalizedRole);

    // Dynamic RBAC Permission Evaluator: evaluates individual member permissions first, then expanded role defaults
    const hasModuleAccess = (module: keyof MemberPermissions): boolean => {
        if (user.role === 'admin' || user.role === 'owner' || user.role === 'tenant_admin' || normalizedRole === 'owner') return true;
        // 1. Granular permission explicitly set for this individual team member by the tenant
        if (user.permissions && typeof (user.permissions as any)[module] === 'boolean') {
            return (user.permissions as any)[module];
        }
        // 2. Default permissions defined for this expanded tenant role
        if (userRoleDef && typeof (userRoleDef.defaultPermissions as any)[module] === 'boolean') {
            return (userRoleDef.defaultPermissions as any)[module];
        }
        // 3. Fallback to getDefaultPermissionsForRole helper
        const defaultRolePerms = getDefaultPermissionsForRole(user.role);
        if (defaultRolePerms && typeof (defaultRolePerms as any)[module] === 'boolean') {
            return (defaultRolePerms as any)[module];
        }
        // 4. System role permissions table fallback
        if (userRolePerm && typeof (userRolePerm as any)[module] === 'boolean') {
            return (userRolePerm as any)[module];
        }
        // 5. Role-based fallback heuristics with normalized aliases
        if (module === 'pos') return true;
        if (module === 'inventory' || module === 'production') {
            return ['manager', 'stock_controller', 'storekeeper', 'production_supervisor', 'production_officer', 'sales_agent', 'salesperson', 'staff'].includes(user.role) ||
                   ['manager', 'stock_controller', 'production_supervisor', 'sales_agent', 'staff'].includes(normalizedRole);
        }
        if (module === 'finance' || module === 'tax') {
            return ['accountant', 'manager'].includes(user.role) || ['accountant', 'manager'].includes(normalizedRole);
        }
        if (module === 'reports') {
            return ['manager', 'accountant', 'supervisor', 'stock_controller', 'storekeeper'].includes(user.role) ||
                   ['manager', 'accountant', 'supervisor', 'stock_controller'].includes(normalizedRole);
        }
        if (module === 'hr') {
            return ['manager', 'accountant'].includes(user.role) || ['manager', 'accountant'].includes(normalizedRole);
        }
        if (module === 'regime') {
            return ['manager', 'supervisor'].includes(user.role) || ['manager', 'supervisor'].includes(normalizedRole);
        }
        if (module === 'traders') {
            return ['manager', 'promoter'].includes(user.role) || ['manager', 'promoter'].includes(normalizedRole);
        }
        return false;
    };

    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const isGuest = user?.username === 'Guest Client';
    const isFreeTour = isGuest || activeTab === 'tour';

    // Tour Tab Guide
    const tourTab = { 
        id: 'tour', 
        label: t('tab_tour'), 
        icon: HelpCircle, 
        badge: 'Guide',
        show: true 
    };

    // Subscription status for the 4 add-on modules (finance, tax, hr, production)
    // As per user specification: these four modules should NOT be visible to any trader who has not subscribed to them.
    const isProductionSubscribed = Boolean(loggedInTrader?.productionActive ?? user?.productionActive);
    const isFinanceSubscribed = Boolean(loggedInTrader?.financeActive ?? user?.financeActive);
    const isTaxSubscribed = Boolean(loggedInTrader?.taxActive ?? user?.taxActive);
    const isHrSubscribed = Boolean(loggedInTrader?.hrActive ?? user?.hrActive);

    // Front Office modules: sales, store operations, stock management, workshop production
    const frontOfficeTabs = [
        { 
            id: 'pos', 
            label: t('tab_pos'), 
            icon: ShoppingCart, 
            badge: 'Cashier',
            show: hasModuleAccess('pos') && (loggedInTrader && loggedInTrader.distributorId ? (loggedInTrader.isCashier || user.role === 'admin' || user.role === 'owner') : true)
        },
        { 
            id: 'inventory', 
            label: t('tab_inventory'), 
            icon: Package, 
            badge: 'Stock',
            show: hasModuleAccess('inventory')
        },
        { 
            id: 'production', 
            label: t('tab_production'), 
            icon: Factory, 
            badge: 'Floor',
            show: (isAdmin || isProductionSubscribed) && hasModuleAccess('production')
        },
        { 
            id: 'traders', 
            label: t('tab_traders'), 
            icon: LayoutDashboard, 
            badge: 'Storefront',
            show: hasModuleAccess('traders') || user.role === 'admin' || user.role === 'owner' || user.role === 'manager' || user.role === 'promoter'
        },
    ];

    // Back Office modules: accounting, tax compliance, reports, pricing regimes, merchant onboard, subscriptions, audit log, system admin
    const backOfficeTabs = [
        { 
            id: 'finance', 
            label: t('tab_finance'), 
            icon: Landmark, 
            badge: 'Ledger',
            show: (isAdmin || isFinanceSubscribed) && hasModuleAccess('finance')
        },
        { 
            id: 'tax', 
            label: t('tab_tax'), 
            icon: ShieldCheck, 
            badge: 'ETR',
            show: (isAdmin || isTaxSubscribed) && hasModuleAccess('tax')
        },
        { 
            id: 'hr', 
            label: t('tab_hr'), 
            icon: UserCheck, 
            badge: isHrSubscribed ? 'Payroll' : '+50% Add-on',
            show: (isAdmin || isHrSubscribed) && hasModuleAccess('hr')
        },
        { 
            id: 'reports', 
            label: t('tab_reports'), 
            icon: BarChart2, 
            badge: 'Analytics',
            show: hasModuleAccess('reports')
        },
        { 
            id: 'client-onboard', 
            label: t('tab_client_onboard') || 'Client Onboarding', 
            icon: Building2, 
            badge: 'Isolated DBs',
            show: user.role === 'admin' || user.role === 'owner' || user.role === 'manager' || user.role === 'promoter'
        },
        { 
            id: 'invite-team', 
            label: 'Invite Team', 
            icon: UserPlus, 
            badge: 'Seats',
            show: !isAdmin && (user.role === 'owner' || user.role === 'manager' || user.role === 'tenant_admin')
        },
        { 
            id: 'subscriptions', 
            label: t('tab_subscriptions'), 
            icon: Crown, 
            badge: 'Billing',
            show: user.role === 'admin' || user.role === 'promoter' || user.role === 'owner' || user.role === 'manager'
        },
        { 
            id: 'audit-log', 
            label: t('tab_audit_log'), 
            icon: ClipboardList, 
            badge: 'Security',
            show: !isFreeTour && !isGuest && (user.role === 'admin' || user.role === 'owner')
        },
        { 
            id: 'system', 
            label: t('tab_system'), 
            icon: Server, 
            badge: 'Admin',
            show: !isFreeTour && !isGuest && (user.role === 'admin' || (userRolePerm ? userRolePerm.system : false))
        },
    ];

    const tabs = [
        tourTab,
        ...frontOfficeTabs,
        ...backOfficeTabs
    ];

    const handleLogout = () => {
        setUser(null);
        setActiveTab('pos');
    };

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden w-full relative bg-slate-900">
            {/* Regenerated Currency Flow Background (mixed currency moving from all directions) */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                style={{ 
                    backgroundImage: 'url("/currency_bg.jpg")',
                    backgroundAttachment: 'fixed',
                    backgroundPosition: 'center center'
                }}
            >
                {/* Clean transparent scrim allowing 50% higher background visibility across UI */}
                <div className="absolute inset-0 bg-slate-950/10"></div>
            </div>

            {/* Top Bar in Blue Colour - 25% */}
            <header className="h-16 bg-[#0073CF]/25 backdrop-blur-md text-white flex items-center justify-between px-6 shrink-0 shadow-sm z-20 border-b border-blue-400/30">
                <div className="flex items-center gap-3 font-bold tracking-tight">
                    <LogoSVG className="w-9 h-9 shrink-0 shadow-sm" showBackground={true} />
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-white tracking-tight leading-none drop-shadow-sm">
                            Biasharasasa
                        </span>
                        <span className="text-[10px] text-blue-100/90 font-bold uppercase tracking-[0.2em] mt-1 drop-shadow-xs">
                            PrimeAxis Systems
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                    {/* Supabase Synchronization Status Indicator */}
                    {isSyncing ? (
                        <button 
                            onClick={triggerManualSync}
                            title="Synchronizing data with Cloud Ledger..."
                            className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/30 text-[11px] font-bold tracking-wide transition hover:bg-blue-500/30 cursor-pointer"
                        >
                            <RefreshCcw size={12} className="animate-spin text-blue-400 shrink-0" />
                            <span className="hidden sm:inline">Syncing Cloud Ledger...</span>
                            <span className="sm:hidden">Syncing</span>
                        </button>
                    ) : pendingSyncCount > 0 ? (
                        <button 
                            onClick={triggerManualSync}
                            title={`${pendingSyncCount} action(s) pending upload to Cloud Ledger. Click to upload now.`}
                            className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-2.5 py-1.5 rounded-full border border-amber-500/40 text-[11px] font-bold tracking-wide animate-pulse transition hover:bg-amber-500/30 cursor-pointer shadow-lg shadow-amber-500/10"
                        >
                            <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <CloudUpload size={13} className="text-amber-400 shrink-0" />
                            <span className="hidden sm:inline">{pendingSyncCount} Pending Upload{pendingSyncCount > 1 ? 's' : ''}</span>
                            <span className="sm:hidden">{pendingSyncCount} Pending</span>
                            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full ml-0.5 shrink-0">
                                {pendingSyncCount}
                            </span>
                        </button>
                    ) : (
                        <button 
                            onClick={triggerManualSync}
                            title="All data synchronized with Cloud Ledger. Click to check for updates."
                            className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30 text-[11px] font-semibold tracking-wide transition hover:bg-emerald-500/25 cursor-pointer"
                        >
                            <span className="relative flex h-2 w-2 shrink-0">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <Cloud size={13} className="text-emerald-400 shrink-0" />
                            <span className="hidden sm:inline font-bold">Cloud Ledger Synced</span>
                            <span className="sm:hidden font-bold">Synced</span>
                        </button>
                    )}

                    {!isOnline && (
                        <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            <WifiOff size={12} /> Offline Mode
                        </div>
                    )}
                    {isLocalFallbackActive() && (
                        <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                            <Server size={12} /> Local DB Active
                        </div>
                    )}
                    {/* Top Bar Location & Branch Switcher: Strictly restricted to Admin modules for administrators only (Removed from all tenant views) */}
                    {isAdmin && ['system', 'traders', 'client-onboard', 'audit-log', 'subscriptions'].includes(activeTab) && (userTraders.length > 0 || loggedInTrader) && (
                        <div className="flex items-center">
                            <button 
                                onClick={() => userTraders.length > 1 && setShowLocationModal(true)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                                    userTraders.length > 1 
                                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400 cursor-pointer shadow-xs active:scale-95' 
                                        : 'bg-slate-800/80 border-slate-700 text-emerald-400 cursor-default'
                                }`}
                                title={userTraders.length > 1 ? "Click to switch branch location" : "Current operating branch"}
                            >
                                <MapPin size={13} className="text-emerald-400 shrink-0" />
                                <span className="truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-[220px]">
                                    {loggedInTrader?.businessName || loggedInTrader?.location || userTraders[0]?.businessName || 'Branch'}
                                </span>
                                {userTraders.length > 1 && (
                                    <>
                                        <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full shrink-0">
                                            {userTraders.length}
                                        </span>
                                        <ChevronDown size={11} className="text-emerald-400/80 shrink-0" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* High-Visibility Zoom Interface for Mobile/Desktop Accessibility */}
                    <div className="flex items-center bg-slate-800/80 backdrop-blur-sm p-1 rounded-xl border border-slate-700 shadow-inner">
                        <button
                            onClick={() => {
                                const currentIndex = zoomLevels.indexOf(zoomLevel);
                                const nextIndex = (currentIndex + 1) % zoomLevels.length;
                                setZoomLevel(zoomLevels[nextIndex]);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all active:scale-95 ${zoomLevel !== 100 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            title="Cycle Zoom Levels"
                        >
                            <ZoomIn size={15} className={zoomLevel !== 100 ? 'animate-pulse' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden xs:inline">Zoom</span>
                            <span className="text-[10px] font-black font-mono bg-black/20 px-1.5 py-0.5 rounded-md border border-white/10">{zoomLevel}%</span>
                        </button>
                        
                        <div className="hidden sm:flex items-center gap-1 border-l border-slate-700/50 ml-1.5 pl-1.5">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            {zoomLevel !== 100 && (
                                <button
                                    type="button"
                                    onClick={handleZoomReset}
                                    className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"
                                    title="Reset to 100%"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Subscription Renewal Alert Badge */}
                    <div className="hidden sm:block">
                        <SubscriptionRenewalBadge
                            currentRenewal={currentTraderRenewal}
                            allExpiringTraders={allExpiringTraders}
                            isAdmin={isAdmin}
                            onClick={() => setShowRenewalModal(true)}
                        />
                    </div>

                    {/* Tenant Team & Subscription Seats Manager */}
                    {loggedInTrader && (isAdmin || ['owner', 'manager', 'tenant_admin'].includes(user.role)) && (
                        <button
                            type="button"
                            onClick={() => setShowTenantUsersModal(true)}
                            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/40 text-purple-200 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                            title="Manage Tenant User Accounts, Permissions & Seats"
                        >
                            <Users size={13} className="text-purple-300 shrink-0" />
                            <span className="hidden lg:inline">Team & Seats</span>
                            <span className="lg:hidden">Team</span>
                        </button>
                    )}

                    {/* Language Switcher */}
                    <div className="hidden md:flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 shadow-sm">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">{t('language')}:</span>
                        <select 
                            value={language} 
                            onChange={(e) => setLanguage(e.target.value as any)}
                            className="bg-transparent text-xs text-white border-none focus:outline-none focus:ring-0 cursor-pointer pr-1 font-medium"
                        >
                            <option className="bg-slate-800 text-white" value="en">🇬🇧 EN</option>
                            <option className="bg-slate-800 text-white" value="fr">🇫🇷 FR</option>
                            <option className="bg-slate-800 text-white" value="sw">🇰🇪 SW</option>
                        </select>
                    </div>

                    <div className="hidden lg:block bg-white/10 px-2.5 py-1 rounded-full text-[12px] font-medium">
                        {t('register_no')}
                    </div>
                    <div className="hidden sm:block text-right">
                        <div className="text-sm font-semibold">{user.fullName || user.username.split('@')[0]}</div>
                        <div className="text-[11px] opacity-75 uppercase tracking-wider font-semibold text-emerald-400">
                            {userRoleDef ? userRoleDef.badge : user.role}
                        </div>
                    </div>
                    <button onClick={handleLogout} title={t('logout')} className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-white/5 cursor-pointer">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Top Alert Banner for Renewal Due within 7 Days */}
            <SubscriptionAlertBanner
                renewalInfo={currentTraderRenewal || (isAdmin && allExpiringTraders[0] ? allExpiringTraders[0] : null)}
                onOpenModal={() => setShowRenewalModal(true)}
            />

            <ScrollProgressBar target={mainRef} />

            <div className="flex flex-1 overflow-hidden w-full flex-col md:flex-row relative z-10">
                {/* Modules Menu in Green Colour - 20% */}
                <nav className={`bg-[#00A352]/20 backdrop-blur-md border-r border-emerald-500/30 flex py-4 md:py-6 px-3 md:px-4 gap-2 shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-300 shadow-sm
                    ${activeTab === 'pos' 
                        ? 'w-full md:w-1/4 h-1/3 md:h-auto flex-row md:flex-col items-center md:items-stretch landscape:w-1/4 landscape:h-auto landscape:flex-col' 
                        : 'w-full md:w-64 flex-row md:flex-col'}
                `}>
                    {/* Free Tour Navigation Item */}
                    {tourTab.show && (
                        <div className="shrink-0 mb-1 w-full">
                            <button
                                key={tourTab.id}
                                onClick={() => setActiveTab(tourTab.id)}
                                className={`text-[10px] md:text-xs font-black cursor-pointer flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-all whitespace-nowrap w-full text-left
                                    ${activeTab === 'tour' 
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30 border border-blue-400/40' 
                                        : 'text-blue-900 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-950 border border-blue-200/70'}
                                    ${activeTab === 'pos' ? 'flex-col md:flex-row justify-center md:justify-start min-w-[70px] md:min-w-0' : ''}
                                `}
                            >
                                <HelpCircle size={activeTab === 'tour' ? 18 : 16} className={activeTab === 'tour' ? 'text-white' : 'text-blue-600'} />
                                <span className={activeTab === 'pos' ? 'hidden sm:block md:block' : ''}>FREE TOUR</span>
                                <span className="hidden lg:inline-block ml-auto text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-blue-500/20 text-blue-900">
                                    Tour
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Front Office Group */}
                    {frontOfficeTabs.some(t => t.show) && (
                        <div className="flex flex-row md:flex-col gap-1.5 shrink-0 w-full">
                            {/* Front Office Section Header */}
                            <div className="hidden md:flex items-center justify-between px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
                                <span className="flex items-center gap-1.5">
                                    <Store size={13} className="text-emerald-800" />
                                    Front Office
                                </span>
                                <span className="text-[9px] font-bold bg-emerald-700/20 text-emerald-950 px-1.5 py-0.5 rounded">Operations</span>
                            </div>
                            <div className="md:hidden flex items-center px-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-950/80 shrink-0 border-l first:border-l-0 border-emerald-500/30 pl-2">
                                Front Office
                            </div>

                            {frontOfficeTabs.filter(t => t.show).map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`text-[10px] md:text-xs font-black cursor-pointer flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 rounded-xl transition-all whitespace-nowrap md:w-full text-left
                                            ${isActive 
                                                ? 'bg-[#00A352] text-white shadow-lg shadow-emerald-900/30 border border-emerald-400/40' 
                                                : 'text-slate-800 bg-white/50 hover:bg-emerald-500/20 hover:text-slate-950 border border-white/60'}
                                            ${activeTab === 'pos' ? 'flex-col md:flex-row justify-center md:justify-start min-w-[70px] md:min-w-0' : ''}
                                        `}
                                    >
                                        <Icon size={isActive ? 18 : 16} className={isActive ? 'text-white' : 'text-emerald-700'} />
                                        <span className={activeTab === 'pos' ? 'hidden sm:block md:block' : ''}>{tab.label.toUpperCase()}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Back Office Group */}
                    {backOfficeTabs.some(t => t.show) && (
                        <div className="flex flex-row md:flex-col gap-1.5 shrink-0 w-full">
                            {/* Back Office Section Header */}
                            <div className="hidden md:flex items-center justify-between px-2 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-950 border-t border-emerald-500/25 mt-2">
                                <span className="flex items-center gap-1.5">
                                    <Building2 size={13} className="text-emerald-800" />
                                    Back Office
                                </span>
                                <span className="text-[9px] font-bold bg-emerald-700/20 text-emerald-950 px-1.5 py-0.5 rounded">Management</span>
                            </div>
                            <div className="md:hidden flex items-center px-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-950/80 shrink-0 border-l border-emerald-500/30 pl-2">
                                Back Office
                            </div>

                            {backOfficeTabs.filter(t => t.show).map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`text-[10px] md:text-xs font-black cursor-pointer flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 rounded-xl transition-all whitespace-nowrap md:w-full text-left
                                            ${isActive 
                                                ? 'bg-[#00A352] text-white shadow-lg shadow-emerald-900/30 border border-emerald-400/40' 
                                                : 'text-slate-800 bg-white/50 hover:bg-emerald-500/20 hover:text-slate-950 border border-white/60'}
                                            ${activeTab === 'pos' ? 'flex-col md:flex-row justify-center md:justify-start min-w-[70px] md:min-w-0' : ''}
                                        `}
                                    >
                                        <Icon size={isActive ? 18 : 16} className={isActive ? 'text-white' : 'text-emerald-700'} />
                                        <span className={activeTab === 'pos' ? 'hidden sm:block md:block' : ''}>{tab.label.toUpperCase()}</span>
                                        {tab.id === 'hr' && (
                                            <span className={`hidden lg:inline-block ml-auto text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                isActive 
                                                    ? 'bg-white/20 text-white' 
                                                    : (loggedInTrader?.hrActive || user?.hrActive)
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-purple-100 text-purple-800'
                                            }`}>
                                                {(loggedInTrader?.hrActive || user?.hrActive) ? 'Active' : '+50%'}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </nav>

                <main className="flex-1 flex overflow-hidden w-full relative bg-slate-50/40 backdrop-blur-[1px]">
                    {isTraderUser && loggedInTrader?.status === 'pending' ? (
                        <div className="absolute inset-0 z-50 bg-slate-50/90 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center">
                            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full animate-in fade-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <RefreshCcw size={40} className="animate-spin" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2">Account Pending Activation</h2>
                                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                    Welcome, <strong className="text-slate-700">{loggedInTrader.fullName}</strong>! Your merchant account for <strong>{loggedInTrader.businessName}</strong> is currently being reviewed by our system administrators.
                                </p>
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6 text-left">
                                    <h4 className="text-xs font-bold text-amber-800 uppercase mb-1">What happens next?</h4>
                                    <ul className="text-xs text-amber-700 space-y-1.5 list-disc pl-4">
                                        <li>Our team will verify your business details.</li>
                                        <li>You will be granted full access to the POS terminal and inventory controls.</li>
                                        <li>Standard review time is usually under 24 hours.</li>
                                    </ul>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => refreshData()}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2"
                                    >
                                        <RefreshCcw size={16} /> Check Status Again
                                    </button>
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold py-2 rounded-xl transition text-xs"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div 
                        ref={mainRef}
                        className="flex-1 w-full h-full overflow-auto custom-scrollbar"
                        style={{ 
                            zoom: `${zoomLevel}%`,
                            width: zoomLevel < 100 ? `${100 * (100 / zoomLevel)}%` : '100%',
                            minHeight: zoomLevel < 100 ? `${100 * (100 / zoomLevel)}%` : '100%',
                            transition: 'zoom 0.2s ease-in-out',
                        }}
                    >
                        {children}
                    </div>
                </main>
            </div>

            {/* Subscription Renewal Modal / Slideover */}
            <SubscriptionRenewalModal
                isOpen={showRenewalModal}
                onClose={() => setShowRenewalModal(false)}
                currentRenewal={currentTraderRenewal}
                allExpiringTraders={allExpiringTraders}
                onNavigateTab={setActiveTab}
            />

            {/* Multi-Location & Branch Switcher Modal for Tenants, Managers & Field Agents */}
            {showLocationModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">Select Branch / Selling Location</h3>
                                    <p className="text-[11px] text-slate-400">
                                        Authorized locations for {user?.fullName || user?.username}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowLocationModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {userTraders.map((trader) => {
                                const isCurrent = (user?.traderId === trader.id) || (!user?.traderId && loggedInTrader?.id === trader.id);
                                return (
                                    <button
                                        key={trader.id}
                                        onClick={async () => {
                                            await switchTrader(trader.id);
                                            setShowLocationModal(false);
                                        }}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all ${
                                            isCurrent
                                                ? 'bg-emerald-950/50 border-emerald-500/80 ring-1 ring-emerald-500/40 text-white'
                                                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 text-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                isCurrent ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                                            }`}>
                                                📍
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-white truncate">
                                                        {trader.businessName}
                                                    </span>
                                                    {isCurrent && (
                                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-black px-1.5 py-0.5 rounded uppercase">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                    <span>{trader.location || 'Location Not Specified'}</span>
                                                    {trader.taxId && <span>• PIN: {trader.taxId}</span>}
                                                    {(trader as any).teamRole && (
                                                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 rounded uppercase font-semibold">
                                                            {(trader as any).teamRole}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {isCurrent ? (
                                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 hover:text-white font-bold">
                                                    Switch →
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <ShieldCheck size={13} /> Strict Tenant Data Isolation Active
                            </span>
                            <button
                                onClick={() => setShowLocationModal(false)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tenant Team & Subscription Seats Modal */}
            {showTenantUsersModal && loggedInTrader && (
                <TenantUsersModal
                    traderId={loggedInTrader.id}
                    tenantName={loggedInTrader.businessName || loggedInTrader.fullName}
                    onClose={() => setShowTenantUsersModal(false)}
                    showToast={showToast}
                    isSuperAdmin={isAdmin}
                    onSuccess={() => refreshData()}
                />
            )}
        </div>
    );
};

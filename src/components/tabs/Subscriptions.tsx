import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context';
import * as api from '../../api';
import { 
    ShieldCheck, Lock, RefreshCw, Sliders, DollarSign, 
    Building, CheckCircle, AlertCircle, Users, ArrowUpRight,
    Percent, X, UserCheck, FileText, Download, Search, Clock, 
    AlertTriangle, CreditCard, Calendar, Printer, FileSpreadsheet,
    Package, ShoppingCart, Landmark, Factory, UserCheck as UserCheckIcon,
    Filter, Trash2, Mail, MapPin, Cloud, UserPlus as UserPlusIcon
} from 'lucide-react';
import { BillingInvoice, formatCurrency, getCurrencyByLocation, Transaction } from '../../types';
import { calculateTraderRenewal } from '../../utils/subscriptionRenewal';
import { ReceiptModal } from '../ReceiptModal';

export const SubscriptionsTab: React.FC<{ setActiveTab?: (tab: string) => void }> = ({ setActiveTab }) => {
    const { subscriptionPlans, traders, user, refreshData, showToast } = useAppContext();
    const [activeSubTab, setActiveSubTab] = useState<'plans' | 'admissions' | 'marketplace' | 'invoices' | 'audit' | 'team'>('plans');
    const [actionLoading, setActionLoading] = useState(false);
    const [updatingTraderId, setUpdatingTraderId] = useState<number | null>(null);

    // Admissions & Queue State
    const [pendingSubscriptions, setPendingSubscriptions] = useState<any[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [queueSearchTerm, setQueueSearchTerm] = useState('');
    const [queueFilterStatus, setQueueFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');

    // Audit Log State
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    // Billing Invoices State
    const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
    const [loadingBilling, setLoadingBilling] = useState(false);
    const [billingSearchQuery, setBillingSearchQuery] = useState('');
    const [selectedFilterTraderId, setSelectedFilterTraderId] = useState<string>('all');

    // Team State (Isolated/Tenant)
    const [teamUsers, setTeamUsers] = useState<any[]>([]);
    const [loadingTeam, setLoadingTeam] = useState(false);

    // Receipt Modal State
    const [printDoc, setPrintDoc] = useState<{ type: 'Receipt' | 'Bill' | 'Invoice', data: Transaction } | null>(null);

    // Calculator State
    const [calcPlan, setCalcPlan] = useState('Starter');
    const [calcUsers, setCalcUsers] = useState(3);
    const [calcProducts, setCalcProducts] = useState(50);
    const [calcVendors, setCalcVendors] = useState(100);
    const [calcVendorsPosAccess, setCalcVendorsPosAccess] = useState(true);
    const [includeFinance, setIncludeFinance] = useState(false);
    const [includeTax, setIncludeTax] = useState(false);
    const [includeProduction, setIncludeProduction] = useState(false);
    const [includeHr, setIncludeHr] = useState(false);

    const isAdmin = user?.role === 'admin';
    const contextUser = user;
    const activeSlug = (contextUser as any)?.slug;

    // Data Fetching
    useEffect(() => {
        if (activeSubTab === 'admissions') fetchQueue();
        if (activeSubTab === 'audit') fetchAuditLogs();
        if (activeSubTab === 'invoices') fetchBillingHistory();
        if (activeSubTab === 'team') fetchTeam();
    }, [activeSubTab, selectedFilterTraderId]);

    const fetchTeam = async () => {
        if (!activeSlug && !user?.traderId) return;
        setLoadingTeam(true);
        try {
            if (activeSlug) {
                const res = await api.getClientWorkspaceTeam(activeSlug);
                // Map ClientTenantUser to UI-friendly format
                const mapped = res.users.map((u: any) => ({
                    id: u.id,
                    username: u.email,
                    email: u.email,
                    fullName: u.email.split('@')[0],
                    role: u.role,
                    status: 'active'
                }));
                setTeamUsers(mapped);
            } else if (user?.traderId) {
                const res = await api.getTenantUsers(user.traderId);
                setTeamUsers(res || []);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load team data', 'error');
        } finally {
            setLoadingTeam(false);
        }
    };

    const handlePrintSubscriptionDoc = (invoice: BillingInvoice) => {
        const traderObj = traders.find(t => t.id === invoice.traderId);
        
        const transaction: Transaction = {
            id: invoice.id,
            invoiceNo: invoice.invoiceNo,
            traderId: invoice.traderId,
            traderName: traderObj?.fullName || 'N/A',
            businessName: traderObj?.businessName || 'N/A',
            customerName: traderObj?.fullName || 'N/A',
            paymentMethod: invoice.paymentMethod || 'Credit',
            items: [{
                id: invoice.id,
                name: `${invoice.planName} Subscription`,
                price: invoice.amount,
                qty: 1,
                icon: '🎫'
            }],
            itemCount: 1,
            subtotal: invoice.amount,
            discountRate: 0,
            discountAmount: 0,
            tax: 0,
            total: invoice.amount,
            date: invoice.billingDate,
            time: '00:00'
        };

        setPrintDoc({ type: 'Invoice', data: transaction });
    };

    const fetchQueue = async () => {
        setLoadingQueue(true);
        try {
            const res = await api.getSubscriptionRequests();
            setPendingSubscriptions(res);
        } catch (e) {
            console.error(e);
            showToast('Failed to synchronize admissions queue', 'error');
        } finally {
            setLoadingQueue(false);
        }
    };

    const fetchAuditLogs = async () => {
        setLoadingAudit(true);
        try {
            const res = await api.getSubscriptionAuditLogs();
            setAuditLogs(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAudit(false);
        }
    };

    const fetchBillingHistory = () => {
        const isTraderUser = user?.role !== 'admin';
        const targetId = isTraderUser && user?.traderId ? user.traderId : (selectedFilterTraderId === 'all' ? 'all' : Number(selectedFilterTraderId));
        setLoadingBilling(true);
        api.getBillingHistory(targetId)
            .then(setBillingInvoices)
            .catch(err => {
                console.error("Failed to load billing history:", err);
                showToast("Could not load billing invoices.", "error");
            })
            .finally(() => setLoadingBilling(false));
    };

    // Actions
    const handlePlanChange = async (traderId: number, nextPlan: string) => {
        setActionLoading(true);
        try {
            const res: any = await api.updateTraderPlan(traderId, nextPlan);
            if (res.success) {
                showToast(`Trader plan updated to ${nextPlan}.`, 'success');
                refreshData();
            }
        } catch (err: any) {
            showToast(err.message || 'Error updating subscription', 'error');
        } finally {
            setActionLoading(false);
            setUpdatingTraderId(null);
        }
    };

    const handleApproveTrader = async (traderId: number) => {
        setActionLoading(true);
        try {
            const res: any = await api.approveTrader(traderId, 'admin');
            if (res.success) {
                showToast('Trader account activated successfully!', 'success');
                refreshData();
                if (activeSubTab === 'admissions') fetchQueue();
            }
        } catch (err: any) {
            showToast(err.message || 'Error during trader approval', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveDistributor = async (traderId: number) => {
        setActionLoading(true);
        try {
            const res: any = await api.approveDistributorTrader(traderId, 'admin');
            if (res.success) {
                showToast('Distributor admission and payment approved successfully!', 'success');
                refreshData();
                if (activeSubTab === 'admissions') fetchQueue();
            }
        } catch (err: any) {
            showToast(err.message || 'Error during distributor approval', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveDiscount = async (traderId: number) => {
        setActionLoading(true);
        try {
            const res: any = await api.approveTraderDiscount(traderId, 'admin');
            if (res.success) {
                showToast('Trader discount rate approved successfully!', 'success');
                refreshData();
            }
        } catch (err: any) {
            showToast(err.message || 'Error during discount approval', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectDiscount = async (traderId: number) => {
        setActionLoading(true);
        try {
            const res: any = await api.rejectTraderDiscount(traderId, 'admin');
            if (res.success) {
                showToast('Trader discount rate rejected.', 'success');
                refreshData();
            }
        } catch (err: any) {
            showToast(err.message || 'Error during discount rejection', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleQueueAction = async (id: string | number, status: 'approved' | 'rejected', external_id?: string, storeName?: string) => {
        try {
            setActionLoading(true);
            const res = await api.updateSubscriptionRequest(id, status, external_id, user?.username, storeName);
            if (res.success) {
                showToast(`Application ${status} successfully`, status === 'approved' ? 'success' : 'info');
                fetchQueue();
                refreshData();
            }
        } catch (e) {
            showToast('Action failed', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const activateModuleAction = async (module: 'finance' | 'tax' | 'production' | 'hr') => {
        try {
            setActionLoading(true);
            const res = await api.activateModule(module);
            if (res.success) {
                showToast(`${module.toUpperCase()} module subscribed & activated (+50% plan surcharge applied)`, 'success');
                await refreshData();
            }
        } catch (err) {
            showToast('Failed to activate module', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const deactivateModuleAction = async (module: 'finance' | 'tax' | 'production' | 'hr') => {
        try {
            setActionLoading(true);
            const res = await api.deactivateModule(module);
            if (res.success) {
                showToast(`${module.toUpperCase()} module unsubscription confirmed`, 'info');
                await refreshData();
            }
        } catch (err) {
            showToast('Failed to deactivate module', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Calculator Logic
    const handleCalcPlanChange = (plan: string) => {
        setCalcPlan(plan);
        if (plan === 'Starter') { setCalcUsers(3); setCalcProducts(50); }
        else if (plan === 'Pro') { setCalcUsers(5); setCalcProducts(100); }
        else if (plan === 'Premium / Enterprise' || plan === 'Enterprise') { setCalcUsers(10); setCalcProducts(500); }
        else if (plan === 'Distributor / Wholesale' || plan === 'Distributor') { setCalcUsers(10); setCalcProducts(500); setCalcVendors(100); }
    };

    const getCalcEstimate = () => {
        let baseUSD = 50; let limitUsers = 3; let limitProducts = 50; let maxVendors = 0; let allowVendors = false;
        if (calcPlan === 'Starter') { baseUSD = 50; limitUsers = 3; limitProducts = 50; }
        else if (calcPlan === 'Pro') { baseUSD = 100; limitUsers = 5; limitProducts = 100; }
        else if (calcPlan === 'Premium / Enterprise') { baseUSD = 250; limitUsers = 10; limitProducts = 500; }
        else if (calcPlan === 'Distributor / Wholesale') { baseUSD = 500; limitUsers = 10; limitProducts = 500; maxVendors = 200; allowVendors = true; }

        const financeFee = includeFinance ? baseUSD * 0.5 : 0;
        const taxFee = includeTax ? baseUSD * 0.5 : 0;
        const productionFee = includeProduction ? baseUSD * 0.5 : 0;
        const hrFee = includeHr ? baseUSD * 0.5 : 0;
        const addOnsTotal = financeFee + taxFee + productionFee + hrFee;
        const extraProducts = Math.max(0, calcProducts - limitProducts);
        const extraProductsCost = extraProducts * 0.10;
        const totalUSD = baseUSD + addOnsTotal + extraProductsCost;
        const totalKSh = totalUSD * 100;

        return { baseUSD, limitUsers, limitProducts, maxVendors, allowVendors, financeFee, taxFee, productionFee, hrFee, addOnsTotal, extraProducts, extraProductsCost, totalUSD, totalKSh };
    };

    const est = getCalcEstimate();

    // Filtering Logic
    const pendingGeneral = traders.filter(t => t.status === 'pending' && !t.plan?.includes('Distributor'));
    const pendingDistributors = traders.filter(t => t.plan?.includes('Distributor') && t.status === 'pending');
    const pendingDiscounts = traders.filter(t => t.pendingDiscountRate && t.pendingDiscountRate > 0 && t.discountStatus === 'pending');

    const filteredQueue = pendingSubscriptions.filter(sub => {
        const lowerSearch = queueSearchTerm.toLowerCase();
        const matchesSearch = sub.store_name.toLowerCase().includes(lowerSearch) || sub.email.toLowerCase().includes(lowerSearch);
        const matchesStatus = queueFilterStatus === 'all' || sub.status === queueFilterStatus;
        return matchesSearch && matchesStatus;
    });

    const filteredInvoices = billingInvoices.filter(inv => {
        const query = billingSearchQuery.toLowerCase();
        const traderObj = traders.find(t => t.id === inv.traderId);
        const nameMatches = traderObj?.fullName?.toLowerCase().includes(query) || traderObj?.businessName?.toLowerCase().includes(query);
        const invNoMatches = inv.invoiceNo.toLowerCase().includes(query);
        return invNoMatches || nameMatches;
    });

    const currentTrader = traders.find(t => t.id === user?.traderId) || traders.find(t => t.email.toLowerCase() === user?.username?.toLowerCase());
    const isHrActive = Boolean(currentTrader?.hrActive ?? user?.hrActive);
    const isFinanceActive = Boolean(currentTrader?.financeActive ?? user?.financeActive);
    const isTaxActive = Boolean(currentTrader?.taxActive ?? user?.taxActive);
    const isProductionActive = Boolean(currentTrader?.productionActive ?? user?.productionActive);

    const downloadInvoice = (invoice: BillingInvoice) => {
        const traderObj = traders.find(t => t.id === invoice.traderId);
        const currencySym = getCurrencyByLocation(traderObj?.location).symbol;
        const invoiceText = `
=========================================
      BIASHARA MERCHANT SUBSCRIPTION
                 INVOICE
=========================================
Invoice Number: \t${invoice.invoiceNo}
Billing Date:   \t${invoice.billingDate}
Due Date:       \t${invoice.dueDate}
Status:         \t${invoice.status.toUpperCase()}
-----------------------------------------
Merchant Name:  \t${traderObj?.fullName || 'N/A'}
Business Name:  \t${traderObj?.businessName || 'N/A'}
-----------------------------------------
Subscription:   \t${invoice.planName} Plan
Total Amount:   \t${currencySym} ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
-----------------------------------------
Thank you for your business!
=========================================
`;
        const blob = new Blob([invoiceText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoice.invoiceNo}_Invoice.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 overflow-y-auto w-full h-full bg-slate-50/50">
            <ReceiptModal 
                isOpen={!!printDoc} 
                onClose={() => setPrintDoc(null)} 
                transaction={printDoc?.data || null} 
                documentType={printDoc?.type}
            />
            
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <ShieldCheck className="text-blue-600" size={28} />
                            Unified Subscriptions & Billing
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">Manage pricing tiers, admissions, marketplace modules, and billing history.</p>
                    </div>
                    <button 
                        onClick={() => refreshData()}
                        disabled={actionLoading}
                        className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
                    >
                        <RefreshCw size={14} className={actionLoading ? 'animate-spin' : ''} />
                        Sync Data
                    </button>
                </div>

                {/* Sub-Tabs Navigation */}
                <div className="flex items-center gap-1 border-b border-slate-200 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <button 
                        onClick={() => setActiveSubTab('plans')}
                        className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeSubTab === 'plans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Plans & Calculator
                    </button>
                    {isAdmin && (
                        <button 
                            onClick={() => setActiveSubTab('admissions')}
                            className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeSubTab === 'admissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Admissions Queue
                        </button>
                    )}
                    <button 
                        onClick={() => setActiveSubTab('marketplace')}
                        className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeSubTab === 'marketplace' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Marketplace
                    </button>
                    <button 
                        onClick={() => setActiveSubTab('invoices')}
                        className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeSubTab === 'invoices' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Billing History
                    </button>
                    {isAdmin && (
                        <button 
                            onClick={() => setActiveSubTab('audit')}
                            className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeSubTab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Audit Trail
                        </button>
                    )}
                    <button 
                        onClick={() => setActiveSubTab('team')}
                        className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeSubTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Team & Usage
                    </button>
                </div>

                {/* TAB CONTENT: PLANS & CALCULATOR */}
                {activeSubTab === 'plans' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Subscription Tier Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {subscriptionPlans.map(p => (
                                <div key={p.id} className={`bg-white border rounded-xl p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${p.popular ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/10' : 'border-slate-200'}`}>
                                    <div>
                                        <div className="text-4xl mb-2">{p.icon}</div>
                                        <h4 className="font-bold text-base text-slate-800 uppercase tracking-wide">{p.name}</h4>
                                        <div className="text-2xl font-black text-blue-600 my-1">{p.price}</div>
                                        <div className="text-xs font-semibold text-slate-700 mt-1">
                                            📦 {p.stockLimitDesc || `${p.stockLimit || 50} Items`}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            👥 {p.userLimitDesc || `${p.userLimit || 3} Users`}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-2 italic leading-relaxed">{p.features}</p>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                        <div className="text-[10px] text-slate-500 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100 text-left space-y-0.5">
                                            <div className="font-bold text-slate-700 text-center mb-1">Add-ons (+50% fee):</div>
                                            <div>• Finance Module</div>
                                            <div>• Tax Module</div>
                                            <div>• Production Module</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Interactive Calculator */}
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Sliders className="text-blue-600" size={20} />
                                <h4 className="font-bold text-slate-800 text-sm">Interactive Subscription Cost Estimator</h4>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-7 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Select Subscription Plan</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {['Starter', 'Pro', 'Premium / Enterprise', 'Distributor / Wholesale'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => handleCalcPlanChange(p)}
                                                    className={`py-2 px-3 text-[10px] font-bold border rounded-lg transition-all ${calcPlan === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                                >
                                                    {p.split(' / ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Users (Max: {est.limitUsers})</label>
                                            <input type="number" value={calcUsers} onChange={(e) => setCalcUsers(Number(e.target.value))} className="w-full text-sm px-3 py-2 border rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Products (Limit: {est.limitProducts})</label>
                                            <input type="number" value={calcProducts} onChange={(e) => setCalcProducts(Number(e.target.value))} className="w-full text-sm px-3 py-2 border rounded-lg" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Finance', state: includeFinance, setState: setIncludeFinance },
                                            { label: 'Tax', state: includeTax, setState: setIncludeTax },
                                            { label: 'Production', state: includeProduction, setState: setIncludeProduction },
                                            { label: 'HR', state: includeHr, setState: setIncludeHr }
                                        ].map(mod => (
                                            <label key={mod.label} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer ${mod.state ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                                                <input type="checkbox" checked={mod.state} onChange={(e) => mod.setState(e.target.checked)} />
                                                <span className="text-xs font-bold">{mod.label} Module</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-5 flex flex-col justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-blue-400 mb-4 uppercase tracking-widest">Billing Summary</div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-xs">
                                                <span>Plan: {calcPlan}</span>
                                                <span className="font-bold">${est.baseUSD.toFixed(2)}</span>
                                            </div>
                                            {est.addOnsTotal > 0 && (
                                                <div className="flex justify-between text-xs text-blue-300">
                                                    <span>Add-ons Surcharge:</span>
                                                    <span className="font-bold">+ ${est.addOnsTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {est.extraProductsCost > 0 && (
                                                <div className="flex justify-between text-xs text-amber-400">
                                                    <span>Extra Products:</span>
                                                    <span className="font-bold">+ ${est.extraProductsCost.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/10 mt-4 text-center">
                                        <div className="text-3xl font-black text-white">${est.totalUSD.toFixed(2)}<span className="text-xs font-medium text-slate-400 ml-1">/mo</span></div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-1">Approx KSh {est.totalKSh.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trader Accounts Table */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b font-bold text-slate-800 flex items-center justify-between">
                                <span>Active Trader Accounts</span>
                                <span className="text-xs text-slate-400">{traders.length} total</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[10px] font-black text-slate-400">
                                            <th className="p-4">Trader / Business</th>
                                            <th className="p-4">Current Plan</th>
                                            <th className="p-4">Expiry</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {traders.map(t => {
                                            const renewal = calculateTraderRenewal(t, subscriptionPlans);
                                            return (
                                                <tr key={t.id} className="hover:bg-slate-50 transition">
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-900">{t.businessName || t.fullName}</div>
                                                        <div className="text-[10px] text-slate-400">{t.email}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">{t.plan || 'Starter'}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className={`font-medium ${renewal.isUrgent ? 'text-red-600' : 'text-slate-600'}`}>{renewal.expiryDateFormatted}</div>
                                                        <div className="text-[9px] opacity-60 uppercase font-black">{renewal.statusLabel}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {updatingTraderId === t.id ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <select 
                                                                    onChange={(e) => handlePlanChange(t.id, e.target.value)}
                                                                    className="text-[10px] border rounded px-1 py-0.5"
                                                                    defaultValue={t.plan}
                                                                >
                                                                    <option value="Starter">Starter ($50)</option>
                                                                    <option value="Pro">Pro ($100)</option>
                                                                    <option value="Premium / Enterprise">Enterprise ($250)</option>
                                                                    <option value="Distributor / Wholesale">Distributor ($500)</option>
                                                                </select>
                                                                <button onClick={() => setUpdatingTraderId(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setUpdatingTraderId(t.id)} className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 ml-auto">
                                                                <ArrowUpRight size={14} /> Upgrade
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: ADMISSIONS QUEUE (Admin Only) */}
                {activeSubTab === 'admissions' && isAdmin && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Summary Badges */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <div className="text-[10px] font-black text-amber-700 uppercase mb-1">Standard Registrations</div>
                                <div className="text-2xl font-black text-amber-900">{pendingGeneral.length}</div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                                <div className="text-[10px] font-black text-blue-700 uppercase mb-1">Distributor Admissions</div>
                                <div className="text-2xl font-black text-blue-900">{pendingDistributors.length}</div>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                                <div className="text-[10px] font-black text-purple-700 uppercase mb-1">Discount Requests</div>
                                <div className="text-2xl font-black text-purple-900">{pendingDiscounts.length}</div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white">
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Cloud Queue Requests</div>
                                <div className="text-2xl font-black">{filteredQueue.length}</div>
                            </div>
                        </div>

                        {/* Standard Admissions */}
                        {pendingGeneral.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                <div className="p-4 border-b font-bold text-slate-800 bg-slate-50/50 flex items-center gap-2">
                                    <UserCheckIcon size={18} className="text-blue-600" />
                                    General Merchant Admissions
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                    {pendingGeneral.map(t => (
                                        <div key={t.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">{t.plan} Plan</span>
                                                <span className="text-[10px] text-slate-400 font-mono">#{t.id}</span>
                                            </div>
                                            <div className="font-bold text-slate-900 text-sm">{t.businessName}</div>
                                            <div className="text-xs text-slate-500 mb-4">{t.fullName} · {t.email}</div>
                                            <button 
                                                onClick={() => handleApproveTrader(t.id)}
                                                disabled={actionLoading}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs transition"
                                            >
                                                Approve & Activate
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cloud Queue Table */}
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b font-bold text-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Cloud size={18} className="text-blue-600" />
                                    Global Cloud Admissions Queue
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input 
                                            type="text" 
                                            placeholder="Search queue..." 
                                            value={queueSearchTerm} 
                                            onChange={(e) => setQueueSearchTerm(e.target.value)}
                                            className="pl-9 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <select 
                                        value={queueFilterStatus} 
                                        onChange={(e) => setQueueFilterStatus(e.target.value as any)}
                                        className="text-xs border rounded-lg px-2 py-1.5"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                    </select>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[9px] font-black text-slate-400">
                                            <th className="px-6 py-4">Merchant</th>
                                            <th className="px-6 py-4">Plan</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredQueue.map(sub => (
                                            <tr key={sub.id} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900">{sub.store_name}</div>
                                                    <div className="text-[10px] text-slate-500">{sub.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-slate-700">{sub.plan}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${sub.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                        {sub.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => handlePrintSubscriptionDoc(sub as any)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 transition"
                                                    ><Printer size={14} /></button>
                                                        {sub.status === 'pending' && (
                                                            <button 
                                                                onClick={() => handleQueueAction(sub.id, 'approved', sub.external_id, sub.store_name)}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[10px] font-black transition"
                                                            >Approve</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: MARKETPLACE */}
                {activeSubTab === 'marketplace' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
                        {[
                            { id: 'finance', name: 'Finance & Ledger', icon: Landmark, color: 'blue', desc: 'General ledger, accounts payable/receivable, cashbook, and automated financial statements.', active: isFinanceActive },
                            { id: 'tax', name: 'Tax Compliance', icon: ShieldCheck, color: 'emerald', desc: 'KRA/URA/RRA compliance, automated VAT filing, and regional tax audit exports.', active: isTaxActive },
                            { id: 'production', name: 'SME Production', icon: Factory, color: 'amber', desc: 'Recipe management, Bill of Materials (BOM), production batch tracking, and cost analytics.', active: isProductionActive },
                            { id: 'hr', name: 'HR & Payroll', icon: UserCheckIcon, color: 'purple', desc: 'Staff profiles, shift attendance, multi-tier statutory payroll (NSSF/NHIF/PAYE), and leave management.', active: isHrActive }
                        ].map(mod => (
                            <div key={mod.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:border-blue-500/50 transition-all">
                                <div className={`h-2 bg-${mod.color}-600`}></div>
                                <div className="p-8 flex-1 flex flex-col">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`bg-${mod.color}-50 p-4 rounded-2xl text-${mod.color}-600`}>
                                            <mod.icon size={32} />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Add-On Pricing</span>
                                            <span className="text-2xl font-black text-slate-900">+50% Plan Fee</span>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">{mod.name}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-8">{mod.desc}</p>
                                    
                                    {mod.active ? (
                                        <div className="mt-auto space-y-3">
                                            <div className="w-full bg-emerald-50 text-emerald-700 font-black py-4 rounded-2xl flex items-center justify-center gap-2 border border-emerald-200">
                                                <CheckCircle size={20} /> Active & Configured
                                            </div>
                                            <button 
                                                onClick={() => deactivateModuleAction(mod.id as any)}
                                                className="w-full text-slate-400 hover:text-red-600 text-[10px] font-black uppercase transition py-2"
                                            >Unsubscribe from Module</button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => activateModuleAction(mod.id as any)}
                                            disabled={actionLoading}
                                            className="mt-auto w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition flex items-center justify-center gap-3 shadow-lg"
                                        >
                                            <RefreshCw size={18} className={actionLoading ? 'animate-spin' : ''} />
                                            Subscribe to {mod.name}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: BILLING HISTORY */}
                {activeSubTab === 'invoices' && (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-500">
                        <div className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                    <FileText size={16} className="text-blue-500" />
                                    Subscription Invoice History
                                </h4>
                                <p className="text-xs text-slate-500">Monitor payments and download historical cloud license receipts.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Invoice # or Plan..." 
                                        value={billingSearchQuery}
                                        onChange={(e) => setBillingSearchQuery(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none w-48"
                                    />
                                </div>
                                {isAdmin && (
                                    <select 
                                        value={selectedFilterTraderId}
                                        onChange={(e) => setSelectedFilterTraderId(e.target.value)}
                                        className="text-xs border rounded-lg px-2 py-1.5"
                                    >
                                        <option value="all">All Merchants</option>
                                        {traders.map(t => <option key={t.id} value={t.id}>{t.businessName || t.fullName}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[9px] font-black text-slate-400">
                                        <th className="px-6 py-4">Invoice #</th>
                                        <th className="px-6 py-4">Billing Date</th>
                                        <th className="px-6 py-4">Plan / Tier</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredInvoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-700">{inv.invoiceNo}</td>
                                            <td className="px-6 py-4 text-slate-500">{inv.billingDate}</td>
                                            <td className="px-6 py-4 font-bold text-slate-800">{inv.planName}</td>
                                            <td className="px-6 py-4 text-right font-black">{formatCurrency(inv.amount, user?.location || 'Kenya')}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => downloadInvoice(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Download size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: AUDIT TRAIL (Admin Only) */}
                {activeSubTab === 'audit' && isAdmin && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-in fade-in duration-500">
                        <div className="p-4 border-b font-bold text-slate-800 bg-slate-900 text-white flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <ClipboardList size={18} className="text-blue-400" />
                                Global Decision History Audit
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[9px] font-black text-slate-400">
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Admin</th>
                                        <th className="px-6 py-4">Action</th>
                                        <th className="px-6 py-4">Merchant</th>
                                        <th className="px-6 py-4">Log Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {auditLogs.map(log => (
                                        <tr key={log.id}>
                                            <td className="px-6 py-4 text-slate-400 font-mono">{new Date(log.created_at).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-black">{log.admin_username}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${log.action === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold">{log.store_name}</td>
                                            <td className="px-6 py-4 text-slate-500 text-[10px]">{log.notes || 'System verification audit'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: TEAM & USAGE */}
                {activeSubTab === 'team' && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-in fade-in duration-500">
                        <div className="p-5 border-b flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <Users size={18} className="text-blue-600" />
                                    Team Seats & License Usage
                                </h4>
                                <p className="text-xs text-slate-500">View team members authorized under this subscription license.</p>
                            </div>
                            <button 
                                onClick={() => setActiveTab?.('invite-team')} 
                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                            >
                                <UserPlusIcon size={14} />
                                Manage Seats
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[9px] font-black text-slate-400">
                                        <th className="px-6 py-4">Member Name</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Account Email</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {teamUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 font-bold text-slate-900">{u.fullName || u.username}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-100 text-[10px] uppercase">
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono">{u.email || u.username}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black uppercase text-[9px] border border-emerald-200">
                                                    {u.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {teamUsers.length === 0 && !loadingTeam && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                No team members found for this workspace.
                                            </td>
                                        </tr>
                                    )}
                                    {loadingTeam && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                <RefreshCw size={24} className="animate-spin mx-auto mb-2 opacity-20" />
                                                Synchronizing team registry...
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer Security Badge */}
                <div className="bg-blue-600 text-white rounded-2xl p-6 flex items-center gap-6 shadow-xl">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <ShieldCheck size={32} />
                    </div>
                    <div>
                        <h4 className="text-lg font-black tracking-tight">Supreme Authority Ledger Active</h4>
                        <p className="text-sm text-blue-100 opacity-80 leading-relaxed">
                            Authorized admissions and module activations are cryptographically propagated across the global network in real-time. 
                            Zero-leak tenant isolation protocol verified for all billing transactions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Re-export icon for the menu
const ClipboardList = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
);

export const SubscriptionsTabWrapper = SubscriptionsTab;

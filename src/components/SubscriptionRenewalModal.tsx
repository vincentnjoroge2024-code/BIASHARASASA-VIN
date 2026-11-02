import React, { useState } from 'react';
import { useAppContext } from '../context';
import { 
    Clock, ShieldAlert, CheckCircle, CreditCard, RefreshCw, X, 
    Calendar, AlertTriangle, Building, ArrowRight, Check, Sparkles,
    Landmark, ShieldCheck, ChevronRight, UserCheck, Factory
} from 'lucide-react';
import { RenewalNotificationInfo } from '../types';
import * as api from '../api';

interface SubscriptionRenewalModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRenewal: RenewalNotificationInfo | null;
    allExpiringTraders?: RenewalNotificationInfo[];
    onNavigateTab?: (tab: string) => void;
}

export const SubscriptionRenewalModal: React.FC<SubscriptionRenewalModalProps> = ({
    isOpen,
    onClose,
    currentRenewal,
    allExpiringTraders = [],
    onNavigateTab
}) => {
    const { user, refreshData, showToast, subscriptionPlans } = useAppContext();
    const [selectedDuration, setSelectedDuration] = useState<number>(1); // months
    const [paymentMethod, setPaymentMethod] = useState<string>('M-Pesa Express');
    const [loading, setLoading] = useState(false);
    const [activeTargetTraderId, setActiveTargetTraderId] = useState<number | null>(
        currentRenewal ? currentRenewal.traderId : (allExpiringTraders[0]?.traderId || null)
    );
    const [successInvoice, setSuccessInvoice] = useState<any | null>(null);

    if (!isOpen) return null;

    const isAdmin = user?.role === 'admin' || user?.role === 'promoter';
    const activeInfo = allExpiringTraders.find(t => t.traderId === activeTargetTraderId) || currentRenewal || allExpiringTraders[0];

    const baseAmount = activeInfo ? activeInfo.monthlyFeeLocal * selectedDuration : 0;
    const discountMultiplier = selectedDuration === 12 ? 0.85 : (selectedDuration === 3 ? 0.95 : 1);
    const finalAmount = Math.round(baseAmount * discountMultiplier);

    const handleRenew = async () => {
        if (!activeInfo) return;
        setLoading(true);
        try {
            const res = await api.renewTraderSubscription(activeInfo.traderId, selectedDuration, paymentMethod);
            if (res.success) {
                setSuccessInvoice(res.invoice);
                showToast(`Subscription renewed successfully through ${res.newExpiry}!`, 'success');
                await refreshData();
            } else {
                showToast(res.message || 'Renewal failed', 'error');
            }
        } catch (err: any) {
            console.error('Subscription renewal error:', err);
            showToast(err.message || 'Subscription renewal failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className={`p-6 text-white flex items-center justify-between ${
                    activeInfo?.isOverdue 
                        ? 'bg-rose-900' 
                        : activeInfo?.isUrgent 
                            ? 'bg-gradient-to-r from-rose-900 to-amber-900' 
                            : 'bg-gradient-to-r from-slate-900 to-blue-950'
                }`}>
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                            {activeInfo?.isOverdue ? (
                                <AlertTriangle className="text-rose-300" size={24} />
                            ) : activeInfo?.isUrgent ? (
                                <Clock className="text-amber-300 animate-pulse" size={24} />
                            ) : (
                                <ShieldCheck className="text-blue-300" size={24} />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black tracking-tight">Subscription Renewal Notice</h3>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    activeInfo?.isOverdue
                                        ? 'bg-rose-500 text-white'
                                        : activeInfo?.isUrgent
                                            ? 'bg-amber-400 text-slate-950'
                                            : 'bg-blue-500 text-white'
                                }`}>
                                    {activeInfo?.statusLabel || 'Due Soon'}
                                </span>
                            </div>
                            <p className="text-xs text-white/80 mt-0.5">
                                Keep merchant services, POS terminal, and synchronized cloud ledger uninterrupted.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-xl transition cursor-pointer"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {/* Multi-merchant selector for Admin */}
                    {isAdmin && allExpiringTraders.length > 1 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                                Merchants Requiring Renewal ({allExpiringTraders.length})
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {allExpiringTraders.map(t => (
                                    <button
                                        key={t.traderId}
                                        onClick={() => {
                                            setActiveTargetTraderId(t.traderId);
                                            setSuccessInvoice(null);
                                        }}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                                            activeTargetTraderId === t.traderId
                                                ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-600/10 font-bold'
                                                : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                                        }`}
                                    >
                                        <div className="truncate pr-2">
                                            <div className="font-bold text-slate-900 truncate">{t.businessName}</div>
                                            <div className="text-[10px] text-slate-400">{t.planName} Plan • {t.location}</div>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                                            t.isOverdue ? 'bg-rose-100 text-rose-700' : t.isUrgent ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {t.daysRemaining < 0 ? `${Math.abs(t.daysRemaining)}d overdue` : `${t.daysRemaining}d left`}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {successInvoice ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <CheckCircle size={36} />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-emerald-950">Subscription Successfully Renewed!</h4>
                                <p className="text-xs text-emerald-700 mt-1">
                                    Invoice <strong>#{successInvoice.invoiceNo}</strong> has been generated and settled via {successInvoice.paymentMethod}.
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-4 border border-emerald-100 text-left max-w-md mx-auto space-y-2 text-xs">
                                <div className="flex justify-between text-slate-500">
                                    <span>Merchant:</span>
                                    <span className="font-bold text-slate-800">{activeInfo?.businessName}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Plan Tier:</span>
                                    <span className="font-bold text-slate-800">{successInvoice.planName}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Amount Paid:</span>
                                    <span className="font-black text-slate-900">{activeInfo?.currencySymbol} {successInvoice.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Billing Status:</span>
                                    <span className="font-bold text-emerald-600 uppercase">Paid & Active</span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setSuccessInvoice(null)}
                                    className="flex-1 bg-white border border-emerald-300 text-emerald-800 font-bold py-2.5 rounded-xl text-xs hover:bg-emerald-100 transition cursor-pointer"
                                >
                                    Renew Another Period
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : activeInfo ? (
                        <>
                            {/* Merchant & Plan Details Card */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Account Overview</span>
                                        <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                            <Building size={18} className="text-blue-600" />
                                            {activeInfo.businessName}
                                        </h4>
                                        <div className="text-xs text-slate-500">{activeInfo.traderName} • {activeInfo.location}</div>
                                    </div>
                                    <div className="text-right sm:text-right">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Renewal Due Date</span>
                                        <div className="text-base font-black text-slate-900 flex items-center gap-1.5 sm:justify-end">
                                            <Calendar size={15} className="text-slate-500" />
                                            {activeInfo.expiryDateFormatted}
                                        </div>
                                        <span className={`text-[11px] font-bold ${
                                            activeInfo.isOverdue ? 'text-rose-600' : activeInfo.isUrgent ? 'text-amber-600 font-black' : 'text-blue-600'
                                        }`}>
                                            {activeInfo.daysRemaining < 0 
                                                ? `Expired ${Math.abs(activeInfo.daysRemaining)} days ago` 
                                                : activeInfo.daysRemaining === 0 
                                                    ? 'Expires today' 
                                                    : `Expires in ${activeInfo.daysRemaining} days`}
                                        </span>
                                    </div>
                                </div>

                                {/* Active Modules Checklist */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                            ✓
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold text-slate-900 truncate">{activeInfo.planName} Tier</div>
                                            <div className="text-[9px] text-slate-500">Core POS & Terminal</div>
                                        </div>
                                    </div>

                                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                        activeInfo.financeActive 
                                            ? 'bg-blue-50/50 border-blue-200 text-blue-900' 
                                            : 'bg-white border-slate-200/60 text-slate-400'
                                    }`}>
                                        <Landmark size={16} className={activeInfo.financeActive ? 'text-blue-600' : 'text-slate-300'} />
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold truncate">Finance Module</div>
                                            <div className="text-[9px] opacity-75">{activeInfo.financeActive ? '+50% Surcharge' : 'Inactive'}</div>
                                        </div>
                                    </div>

                                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                        activeInfo.taxActive 
                                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' 
                                            : 'bg-white border-slate-200/60 text-slate-400'
                                    }`}>
                                        <ShieldCheck size={16} className={activeInfo.taxActive ? 'text-emerald-600' : 'text-slate-300'} />
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold truncate">Tax Compliance</div>
                                            <div className="text-[9px] opacity-75">{activeInfo.taxActive ? '+50% Surcharge' : 'Inactive'}</div>
                                        </div>
                                    </div>

                                    <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                        activeInfo.hrActive 
                                            ? 'bg-purple-50/50 border-purple-200 text-purple-900' 
                                            : 'bg-white border-slate-200/60 text-slate-400'
                                    }`}>
                                        <UserCheck size={16} className={activeInfo.hrActive ? 'text-purple-600' : 'text-slate-300'} />
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold truncate">HR & Payroll</div>
                                            <div className="text-[9px] opacity-75">{activeInfo.hrActive ? '+50% Surcharge' : 'Inactive'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Duration Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                                    Select Renewal Term
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { months: 1, label: '1 Month', badge: 'Standard' },
                                        { months: 3, label: '3 Months', badge: 'Save 5%' },
                                        { months: 12, label: '1 Year', badge: 'Save 15% 🎉' }
                                    ].map(term => (
                                        <button
                                            key={term.months}
                                            type="button"
                                            onClick={() => setSelectedDuration(term.months)}
                                            className={`p-3.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-between ${
                                                selectedDuration === term.months
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="text-xs font-black">{term.label}</div>
                                            <div className={`text-[10px] mt-1 font-bold px-2 py-0.5 rounded-full ${
                                                selectedDuration === term.months
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {term.badge}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Method Selector */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                                    Payment Method
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {['M-Pesa Express', 'Bank Transfer', 'Credit Card', 'Cloud Ledger'].map(method => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setPaymentMethod(method)}
                                            className={`p-2.5 rounded-xl border text-center text-xs font-bold transition cursor-pointer ${
                                                paymentMethod === method
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Total Price Bar & Actions */}
                            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-slate-900/10">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Renewal Fee ({selectedDuration} Mo)</div>
                                    <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
                                        <span>{activeInfo.currencySymbol} {finalAmount.toLocaleString()}</span>
                                        <span className="text-xs text-slate-400 font-normal">(${(activeInfo.monthlyFeeUSD * selectedDuration * discountMultiplier).toFixed(2)} USD)</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                    {onNavigateTab && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                onNavigateTab('subscriptions');
                                            }}
                                            className="px-3 py-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                                            title="View Subscriptions Tab"
                                        >
                                            Plans
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleRenew}
                                        disabled={loading}
                                        className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
                                    >
                                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                                        {loading ? 'Processing Renewal...' : `Authorize & Renew (+${selectedDuration * 30} Days)`}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            No subscription records found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

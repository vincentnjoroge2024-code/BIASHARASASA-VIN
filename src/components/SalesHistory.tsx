import React, { useState, useMemo } from 'react';
import { Transaction, Trader, formatCurrency } from '../types';
import { updateTransactionStatus } from '../api';
import { useAppContext } from '../context';
import { 
    Search, Filter, Printer, FileText, FileSpreadsheet, Eye, X, Check, 
    AlertTriangle, RotateCcw, Undo2, XCircle, CheckCircle2, DollarSign, 
    Calendar, User, ShoppingBag, Download, CreditCard, ChevronRight, 
    Clock, ShieldAlert, Sparkles, RefreshCcw
} from 'lucide-react';

interface SalesHistoryProps {
    transactions: Transaction[];
    traders: Trader[];
    activeTraderId?: number | 'all';
    onReprint: (type: 'Receipt' | 'Invoice' | 'Bill', tx: Transaction) => void;
    onStatusUpdated?: () => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
    transactions,
    traders,
    activeTraderId = 'all',
    onReprint,
    onStatusUpdated
}) => {
    const { showToast, refreshData, user } = useAppContext();

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided' | 'refunded' | 'returned'>('all');
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [cashierFilter, setCashierFilter] = useState<string>('all');
    const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'this_month'>('30days');
    const [customStartDate, setCustomStartDate] = useState(
        new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
    );
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Modals
    const [selectedTxForDetails, setSelectedTxForDetails] = useState<Transaction | null>(null);
    const [statusActionTx, setStatusActionTx] = useState<{
        tx: Transaction;
        action: 'void' | 'refund' | 'return';
    } | null>(null);

    // Form inputs for status action modal
    const [actionReason, setActionReason] = useState('');
    const [actionRefundAmount, setActionRefundAmount] = useState<number>(0);
    const [actionRestock, setActionRestock] = useState(true);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    // Active Trader Info
    const currentTrader = activeTraderId === 'all' 
        ? null 
        : traders.find(t => t.id === Number(activeTraderId));

    // Calculate dates based on preset
    const { startFilterDate, endFilterDate } = useMemo(() => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        if (dateRangePreset === 'today') {
            return { startFilterDate: todayStr, endFilterDate: todayStr };
        }
        if (dateRangePreset === 'yesterday') {
            const yest = new Date(today);
            yest.setDate(yest.getDate() - 1);
            const yestStr = yest.toISOString().split('T')[0];
            return { startFilterDate: yestStr, endFilterDate: yestStr };
        }
        if (dateRangePreset === '7days') {
            const d7 = new Date(today);
            d7.setDate(d7.getDate() - 7);
            return { startFilterDate: d7.toISOString().split('T')[0], endFilterDate: todayStr };
        }
        if (dateRangePreset === '30days') {
            const d30 = new Date(today);
            d30.setDate(d30.getDate() - 30);
            return { startFilterDate: d30.toISOString().split('T')[0], endFilterDate: todayStr };
        }
        if (dateRangePreset === 'this_month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            return { startFilterDate: firstDay, endFilterDate: todayStr };
        }
        return { startFilterDate: customStartDate, endFilterDate: customEndDate };
    }, [dateRangePreset, customStartDate, customEndDate]);

    // Unique cashiers from records
    const uniqueCashiers = useMemo(() => {
        const cashiers = new Set<string>();
        transactions.forEach(t => {
            if (t.cashierName && t.cashierName.trim() !== '') {
                cashiers.add(t.cashierName);
            }
        });
        return Array.from(cashiers);
    }, [transactions]);

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            // 1. Trader match
            if (activeTraderId !== 'all' && tx.traderId !== activeTraderId) {
                return false;
            }

            // 2. Date match
            const txDate = tx.date ? tx.date.split('T')[0] : '';
            if (startFilterDate && txDate < startFilterDate) return false;
            if (endFilterDate && txDate > endFilterDate) return false;

            // 3. Status filter
            const txStatus = tx.status || 'completed';
            if (statusFilter !== 'all' && txStatus !== statusFilter) {
                return false;
            }

            // 4. Payment method filter
            if (paymentFilter !== 'all') {
                const method = (tx.paymentMethod || '').toLowerCase();
                if (!method.includes(paymentFilter.toLowerCase())) {
                    return false;
                }
            }

            // 5. Cashier filter
            if (cashierFilter !== 'all') {
                if (tx.cashierName !== cashierFilter) {
                    return false;
                }
            }

            // 6. Universal Search: receipt #, date, cashier, customer, product name / sku
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const invMatch = (tx.invoiceNo || '').toLowerCase().includes(q);
                const dateMatch = (tx.date || '').toLowerCase().includes(q);
                const cashierMatch = (tx.cashierName || '').toLowerCase().includes(q);
                const customerMatch = (tx.customerName || '').toLowerCase().includes(q);
                const serviceProviderMatch = (tx.serviceProvider || '').toLowerCase().includes(q);
                const stationMatch = (tx.serviceStation || '').toLowerCase().includes(q);
                
                // Check items inside transaction
                const itemMatch = Array.isArray(tx.items) && tx.items.some(item => 
                    (item.name || '').toLowerCase().includes(q) ||
                    (item.code || '').toLowerCase().includes(q) ||
                    (item.sku || '').toLowerCase().includes(q)
                );

                if (!invMatch && !dateMatch && !cashierMatch && !customerMatch && !serviceProviderMatch && !stationMatch && !itemMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [
        transactions, activeTraderId, startFilterDate, endFilterDate, 
        statusFilter, paymentFilter, cashierFilter, searchQuery
    ]);

    // Financial & KPI summary counts
    const kpiSummary = useMemo(() => {
        let totalCompletedRevenue = 0;
        let completedCount = 0;
        let voidedCount = 0;
        let voidedAmount = 0;
        let refundedCount = 0;
        let refundedAmount = 0;
        let returnedCount = 0;
        let returnedAmount = 0;

        filteredTransactions.forEach(t => {
            const status = t.status || 'completed';
            if (status === 'completed') {
                completedCount++;
                totalCompletedRevenue += t.total;
            } else if (status === 'voided') {
                voidedCount++;
                voidedAmount += t.total;
            } else if (status === 'refunded') {
                refundedCount++;
                refundedAmount += (t.refundAmount || t.total);
            } else if (status === 'returned') {
                returnedCount++;
                returnedAmount += (t.refundAmount || t.total);
            }
        });

        const netSettledRevenue = totalCompletedRevenue - refundedAmount;
        const avgOrderValue = completedCount > 0 ? Math.round(totalCompletedRevenue / completedCount) : 0;

        return {
            totalCompletedRevenue,
            completedCount,
            netSettledRevenue,
            voidedCount,
            voidedAmount,
            refundedCount,
            refundedAmount,
            returnedCount,
            returnedAmount,
            avgOrderValue,
            totalRows: filteredTransactions.length
        };
    }, [filteredTransactions]);

    // Status counts for tabs
    const statusCounts = useMemo(() => {
        const counts = { all: 0, completed: 0, voided: 0, refunded: 0, returned: 0 };
        transactions.forEach(t => {
            if (activeTraderId !== 'all' && t.traderId !== activeTraderId) return;
            const s = (t.status || 'completed') as 'completed' | 'voided' | 'refunded' | 'returned';
            counts.all++;
            if (counts[s] !== undefined) {
                counts[s]++;
            }
        });
        return counts;
    }, [transactions, activeTraderId]);

    // Handle Open Void/Refund/Return Modal
    const handleOpenStatusAction = (tx: Transaction, action: 'void' | 'refund' | 'return') => {
        setStatusActionTx({ tx, action });
        setActionReason(
            action === 'void' 
                ? 'Customer cancelled order before dispatch' 
                : action === 'refund' 
                    ? 'Customer refund request' 
                    : 'Customer returned item in original condition'
        );
        setActionRefundAmount(tx.total);
        setActionRestock(true);
    };

    // Submit Void/Refund/Return
    const handleSubmitStatusAction = async () => {
        if (!statusActionTx) return;
        setIsSubmittingAction(true);
        try {
            const { tx, action } = statusActionTx;
            const targetStatus = action === 'void' ? 'voided' : action === 'refund' ? 'refunded' : 'returned';

            await updateTransactionStatus(tx.id, {
                status: targetStatus,
                reason: actionReason.trim() || `Marked as ${targetStatus} by staff`,
                refundAmount: action === 'void' ? tx.total : actionRefundAmount,
                restockItems: actionRestock
            });

            showToast(`Transaction ${tx.invoiceNo} successfully updated to ${targetStatus}`, 'success');
            setStatusActionTx(null);
            if (selectedTxForDetails && selectedTxForDetails.id === tx.id) {
                setSelectedTxForDetails(prev => prev ? {
                    ...prev,
                    status: targetStatus,
                    statusReason: actionReason,
                    statusUpdatedAt: new Date().toISOString(),
                    statusUpdatedBy: user?.fullName || user?.username || 'Staff',
                    refundAmount: action === 'void' ? tx.total : actionRefundAmount
                } : null);
            }
            if (onStatusUpdated) onStatusUpdated();
            await refreshData();
        } catch (error: any) {
            console.error('Failed to update transaction status:', error);
            showToast(error.message || 'Failed to update transaction status', 'error');
        } finally {
            setIsSubmittingAction(false);
        }
    };

    // Export to CSV
    const handleExportCsv = () => {
        if (filteredTransactions.length === 0) {
            showToast('No transactions to export in current view', 'warning');
            return;
        }

        const headers = [
            'Receipt / Invoice No',
            'Date',
            'Time',
            'Status',
            'Status Reason',
            'Cashier',
            'Customer Name',
            'Payment Method',
            'Items Count',
            'Subtotal',
            'Discount Amount',
            'Tax Amount',
            'Total Paid',
            'Refund Amount',
            'Store Location'
        ];

        const rows = filteredTransactions.map(tx => {
            const loc = traders.find(tr => tr.id === tx.traderId)?.location || 'Default';
            return [
                `"${tx.invoiceNo}"`,
                `"${tx.date}"`,
                `"${tx.time || ''}"`,
                `"${(tx.status || 'completed').toUpperCase()}"`,
                `"${(tx.statusReason || '').replace(/"/g, '""')}"`,
                `"${tx.cashierName || 'Staff'}"`,
                `"${(tx.customerName || 'Walk-in Customer').replace(/"/g, '""')}"`,
                `"${tx.paymentMethod || 'Cash'}"`,
                tx.itemCount || (tx.items ? tx.items.length : 0),
                tx.subtotal,
                tx.discountAmount,
                tx.tax,
                tx.total,
                tx.refundAmount || 0,
                `"${loc}"`
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `sales_history_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Sales history exported to CSV successfully', 'success');
    };

    return (
        <div className="space-y-6">
            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Completed Sales</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div className="text-xl font-black text-slate-900 truncate">
                        {formatCurrency(kpiSummary.totalCompletedRevenue, currentTrader?.location)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-bold mt-1">
                        {kpiSummary.completedCount} orders completed
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Net Settled Revenue</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="text-xl font-black text-blue-600 truncate">
                        {formatCurrency(kpiSummary.netSettledRevenue, currentTrader?.location)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1">
                        Avg ticket: {formatCurrency(kpiSummary.avgOrderValue, currentTrader?.location)}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Voided Sales</span>
                        <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                            <XCircle size={16} />
                        </div>
                    </div>
                    <div className="text-xl font-black text-rose-600 truncate">
                        {formatCurrency(kpiSummary.voidedAmount, currentTrader?.location)}
                    </div>
                    <div className="text-[10px] text-rose-500 font-bold mt-1">
                        {kpiSummary.voidedCount} cancelled orders
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Refunded Sales</span>
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Undo2 size={16} />
                        </div>
                    </div>
                    <div className="text-xl font-black text-amber-600 truncate">
                        {formatCurrency(kpiSummary.refundedAmount, currentTrader?.location)}
                    </div>
                    <div className="text-[10px] text-amber-600 font-bold mt-1">
                        {kpiSummary.refundedCount} transactions refunded
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs col-span-2 md:col-span-4 lg:col-span-1">
                    <div className="flex items-center justify-between text-slate-500 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Returned Items</span>
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <RotateCcw size={16} />
                        </div>
                    </div>
                    <div className="text-xl font-black text-purple-600 truncate">
                        {formatCurrency(kpiSummary.returnedAmount, currentTrader?.location)}
                    </div>
                    <div className="text-[10px] text-purple-600 font-bold mt-1">
                        {kpiSummary.returnedCount} sales restocked
                    </div>
                </div>
            </div>

            {/* SEARCH & MULTI-FILTER CONTROL CONSOLE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
                {/* Search Bar + Export */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="relative w-full md:max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text"
                            placeholder="Search by receipt #, date, cashier, customer, or product..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                            onClick={handleExportCsv}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                            title="Export filtered transactions to CSV"
                        >
                            <Download size={14} />
                            <span>Export CSV</span>
                        </button>
                    </div>
                </div>

                {/* Filter Dropdowns Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                    {/* Payment Method Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <CreditCard size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Payment:</span>
                        <select 
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Payment Methods</option>
                            <option value="Cash">Cash Only</option>
                            <option value="M-Pesa">M-Pesa Only</option>
                            <option value="Card">Card Only</option>
                            <option value="Credit">Credit / Invoiced</option>
                        </select>
                    </div>

                    {/* Cashier / Attendant Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Cashier:</span>
                        <select 
                            value={cashierFilter}
                            onChange={(e) => setCashierFilter(e.target.value)}
                            className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer truncate"
                        >
                            <option value="all">All Cashiers / Servers</option>
                            {uniqueCashiers.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Presets */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Range:</span>
                        <select 
                            value={dateRangePreset}
                            onChange={(e) => setDateRangePreset(e.target.value as any)}
                            className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value="30days">Last 30 Days</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="this_month">This Month</option>
                            <option value="all">Custom Dates</option>
                        </select>
                    </div>

                    {/* Custom Date Range if 'all' is selected */}
                    {dateRangePreset === 'all' ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
                            <input 
                                type="date" 
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="w-full bg-white text-[10px] font-bold text-slate-800 border border-slate-200 rounded px-1.5 py-0.5"
                            />
                            <span className="text-slate-400 text-xs">→</span>
                            <input 
                                type="date" 
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="w-full bg-white text-[10px] font-bold text-slate-800 border border-slate-200 rounded px-1.5 py-0.5"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-2">
                            <span>From: {startFilterDate}</span>
                            <span>To: {endFilterDate}</span>
                        </div>
                    )}
                </div>

                {/* Status Filter Tab Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 custom-scrollbar">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            statusFilter === 'all' 
                                ? 'bg-slate-900 text-white shadow-xs' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <span>All Transactions</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                            {statusCounts.all}
                        </span>
                    </button>

                    <button
                        onClick={() => setStatusFilter('completed')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            statusFilter === 'completed' 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                    >
                        <CheckCircle2 size={12} />
                        <span>Completed</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700/30 text-white">
                            {statusCounts.completed}
                        </span>
                    </button>

                    <button
                        onClick={() => setStatusFilter('voided')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            statusFilter === 'voided' 
                                ? 'bg-rose-600 text-white shadow-xs' 
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                    >
                        <XCircle size={12} />
                        <span>Voided</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-700/30 text-white">
                            {statusCounts.voided}
                        </span>
                    </button>

                    <button
                        onClick={() => setStatusFilter('refunded')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            statusFilter === 'refunded' 
                                ? 'bg-amber-600 text-white shadow-xs' 
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                    >
                        <Undo2 size={12} />
                        <span>Refunded</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-700/30 text-white">
                            {statusCounts.refunded}
                        </span>
                    </button>

                    <button
                        onClick={() => setStatusFilter('returned')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                            statusFilter === 'returned' 
                                ? 'bg-purple-600 text-white shadow-xs' 
                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                    >
                        <RotateCcw size={12} />
                        <span>Returned</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-700/30 text-white">
                            {statusCounts.returned}
                        </span>
                    </button>

                    {(searchQuery || paymentFilter !== 'all' || cashierFilter !== 'all' || statusFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setPaymentFilter('all');
                                setCashierFilter('all');
                                setStatusFilter('all');
                            }}
                            className="ml-auto text-xs font-bold text-rose-600 hover:underline px-2 py-1 shrink-0"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800 uppercase tracking-wider">
                            Transaction Records
                        </span>
                        <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                            {filteredTransactions.length} of {transactions.length}
                        </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        Click any row or &quot;View Details&quot; for complete financial breakdown
                    </span>
                </div>

                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-16 px-4 text-slate-400">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
                            <ShoppingBag size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 mb-1">No Transactions Found</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            No records match your selected filters. Try clearing the search query or date filters.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                    <th className="py-3 px-4">Receipt / Invoice</th>
                                    <th className="py-3 px-3">Date & Time</th>
                                    <th className="py-3 px-3">Cashier / Server</th>
                                    <th className="py-3 px-3">Customer</th>
                                    <th className="py-3 px-3">Items Sold</th>
                                    <th className="py-3 px-3">Payment</th>
                                    <th className="py-3 px-3 text-right">Total Amount</th>
                                    <th className="py-3 px-3 text-center">Status</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTransactions.map(tx => {
                                    const status = tx.status || 'completed';
                                    const loc = traders.find(t => t.id === tx.traderId)?.location;
                                    const itemsList = Array.isArray(tx.items) ? tx.items : [];
                                    const itemCount = tx.itemCount || itemsList.reduce((s, i) => s + (i.qty || 1), 0);

                                    return (
                                        <tr 
                                            key={tx.id}
                                            className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedTxForDetails(tx)}
                                        >
                                            {/* Receipt / Invoice # */}
                                            <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-blue-600 hover:underline">
                                                        {tx.invoiceNo}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Date & Time */}
                                            <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                                                <div className="font-semibold text-slate-800">{tx.date}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{tx.time || '—'}</div>
                                            </td>

                                            {/* Cashier & Station */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <div className="font-bold text-slate-800">{tx.cashierName || 'Staff'}</div>
                                                {(tx.serviceProvider || tx.serviceStation) && (
                                                    <div className="text-[10px] text-indigo-600 font-medium truncate max-w-[140px]">
                                                        {tx.serviceProvider || ''} {tx.serviceStation ? `(${tx.serviceStation})` : ''}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Customer */}
                                            <td className="py-3 px-3 whitespace-nowrap text-slate-700 font-medium">
                                                {tx.customerName || 'Walk-in Customer'}
                                                {tx.customerPhone && (
                                                    <div className="text-[10px] text-slate-400 font-mono">{tx.customerPhone}</div>
                                                )}
                                            </td>

                                            {/* Items Sold */}
                                            <td className="py-3 px-3 max-w-[180px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 truncate" title={itemsList.map(i => `${i.name} (x${i.qty})`).join(', ')}>
                                                        {itemsList.length > 0 ? itemsList[0].name : '—'}
                                                        {itemsList.length > 1 && ` +${itemsList.length - 1} more`}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Payment Method */}
                                            <td className="py-3 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    (tx.paymentMethod || '').toLowerCase().includes('mpesa') || (tx.paymentMethod || '').toLowerCase().includes('m-pesa')
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : (tx.paymentMethod || '').toLowerCase().includes('card')
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {tx.paymentMethod || 'Cash'}
                                                </span>
                                            </td>

                                            {/* Total */}
                                            <td className="py-3 px-3 text-right whitespace-nowrap">
                                                <div className={`font-black text-sm ${
                                                    status === 'voided' 
                                                        ? 'text-slate-400 line-through' 
                                                        : status === 'refunded'
                                                            ? 'text-amber-600'
                                                            : 'text-slate-900'
                                                }`}>
                                                    {formatCurrency(tx.total, loc)}
                                                </div>
                                                {tx.discountAmount > 0 && status === 'completed' && (
                                                    <div className="text-[10px] text-emerald-600 font-semibold">
                                                        Saved {formatCurrency(tx.discountAmount, loc)}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-3 px-3 text-center whitespace-nowrap">
                                                {status === 'completed' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                                        <CheckCircle2 size={11} />
                                                        Completed
                                                    </span>
                                                )}
                                                {status === 'voided' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 uppercase tracking-wider" title={tx.statusReason}>
                                                        <XCircle size={11} />
                                                        Voided
                                                    </span>
                                                )}
                                                {status === 'refunded' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase tracking-wider" title={tx.statusReason}>
                                                        <Undo2 size={11} />
                                                        Refunded
                                                    </span>
                                                )}
                                                {status === 'returned' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 uppercase tracking-wider" title={tx.statusReason}>
                                                        <RotateCcw size={11} />
                                                        Returned
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Open Receipt */}
                                                    <button
                                                        onClick={() => onReprint('Receipt', tx)}
                                                        className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-emerald-200"
                                                        title="Open & Reprint Sales Receipt (80mm / A4)"
                                                    >
                                                        <Printer size={12} />
                                                        <span>Receipt</span>
                                                    </button>

                                                    {/* Open Invoice */}
                                                    <button
                                                        onClick={() => onReprint('Invoice', tx)}
                                                        className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-indigo-200"
                                                        title="Open & Reprint Fiscal Tax Invoice"
                                                    >
                                                        <FileText size={12} />
                                                        <span>Invoice</span>
                                                    </button>

                                                    {/* Open Details */}
                                                    <button
                                                        onClick={() => setSelectedTxForDetails(tx)}
                                                        className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                                        title="View full transaction breakdown"
                                                    >
                                                        <Eye size={12} />
                                                    </button>

                                                    {/* Status Actions (Void / Refund / Return) */}
                                                    {status === 'completed' && (
                                                        <div className="relative group/menu inline-block">
                                                            <button
                                                                onClick={() => handleOpenStatusAction(tx, 'void')}
                                                                className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold transition border border-rose-200"
                                                                title="Void or Refund this sale"
                                                            >
                                                                <AlertTriangle size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* TRANSACTION DETAILS & PAYMENT BREAKDOWN MODAL */}
            {selectedTxForDetails && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black text-slate-900 font-mono">
                                            {selectedTxForDetails.invoiceNo}
                                        </h3>
                                        {/* Status Badge */}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            (selectedTxForDetails.status || 'completed') === 'completed'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : (selectedTxForDetails.status === 'voided')
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : (selectedTxForDetails.status === 'refunded')
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-purple-100 text-purple-800'
                                        }`}>
                                            {selectedTxForDetails.status || 'completed'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {selectedTxForDetails.date} at {selectedTxForDetails.time || '—'} • {selectedTxForDetails.businessName || 'Business Node'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedTxForDetails(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Void / Refund / Return Audit Banner if applicable */}
                            {selectedTxForDetails.status && selectedTxForDetails.status !== 'completed' && (
                                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                                    selectedTxForDetails.status === 'voided' 
                                        ? 'bg-rose-50 border-rose-200 text-rose-900' 
                                        : selectedTxForDetails.status === 'refunded'
                                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                                            : 'bg-purple-50 border-purple-200 text-purple-900'
                                }`}>
                                    <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                                    <div className="text-xs space-y-1">
                                        <div className="font-black uppercase tracking-wider">
                                            This sale was marked as {selectedTxForDetails.status}
                                        </div>
                                        {selectedTxForDetails.statusReason && (
                                            <p className="font-medium text-slate-700">
                                                <strong>Reason:</strong> {selectedTxForDetails.statusReason}
                                            </p>
                                        )}
                                        <div className="text-[10px] opacity-75">
                                            Updated by {selectedTxForDetails.statusUpdatedBy || 'Staff'} on {selectedTxForDetails.statusUpdatedAt ? new Date(selectedTxForDetails.statusUpdatedAt).toLocaleString() : 'Recent'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Customer & Staff Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Customer</span>
                                    <span className="font-bold text-slate-800">{selectedTxForDetails.customerName || 'Walk-in'}</span>
                                    {selectedTxForDetails.customerPhone && (
                                        <span className="text-[10px] text-slate-500 block font-mono">{selectedTxForDetails.customerPhone}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Cashier</span>
                                    <span className="font-bold text-slate-800">{selectedTxForDetails.cashierName || 'Staff'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Station / Table</span>
                                    <span className="font-bold text-slate-800">{selectedTxForDetails.serviceStation || 'Counter'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block">Service Provider</span>
                                    <span className="font-bold text-indigo-600">{selectedTxForDetails.serviceProvider || 'None'}</span>
                                </div>
                            </div>

                            {/* Ordered Items Table */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5">
                                    Line Items Breakdown ({selectedTxForDetails.items?.length || 0} products)
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                                            <tr>
                                                <th className="py-2.5 px-3">#</th>
                                                <th className="py-2.5 px-3">Item Description</th>
                                                <th className="py-2.5 px-3 text-right">Unit Price</th>
                                                <th className="py-2.5 px-3 text-center">Qty</th>
                                                <th className="py-2.5 px-3 text-right">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                            {(selectedTxForDetails.items || []).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                                    <td className="py-2 px-3">
                                                        <div className="font-bold text-slate-900">{item.name}</div>
                                                        {item.sku && (
                                                            <div className="text-[9px] font-mono text-slate-400">SKU: {item.sku}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono">
                                                        {formatCurrency(item.price, currentTrader?.location)}
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-bold font-mono">
                                                        {item.qty}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-black font-mono text-slate-900">
                                                        {formatCurrency(item.price * item.qty, currentTrader?.location)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Payment Breakdown Card */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                                    Payment Breakdown & Fiscal Summary
                                </h4>
                                <div className="flex justify-between text-xs text-slate-600">
                                    <span>Gross Subtotal:</span>
                                    <span className="font-bold text-slate-800 font-mono">
                                        {formatCurrency(selectedTxForDetails.subtotal, currentTrader?.location)}
                                    </span>
                                </div>
                                {selectedTxForDetails.discountAmount > 0 && (
                                    <div className="flex justify-between text-xs text-emerald-600">
                                        <span>Trader Discount ({selectedTxForDetails.discountRate}%):</span>
                                        <span className="font-bold font-mono">
                                            -{formatCurrency(selectedTxForDetails.discountAmount, currentTrader?.location)}
                                        </span>
                                    </div>
                                )}
                                {selectedTxForDetails.tax > 0 ? (
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>{selectedTxForDetails.taxLabel || 'VAT'} ({selectedTxForDetails.taxRate || 16}%):</span>
                                        <span className="font-bold text-slate-800 font-mono">
                                            +{formatCurrency(selectedTxForDetails.tax, currentTrader?.location)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between text-[11px] text-slate-400">
                                        <span>Sales Tax:</span>
                                        <span>0% (Tax Exempt)</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
                                    <span>Total Paid ({selectedTxForDetails.paymentMethod}):</span>
                                    <span className="text-base text-blue-600 font-mono">
                                        {formatCurrency(selectedTxForDetails.total, currentTrader?.location)}
                                    </span>
                                </div>

                                {selectedTxForDetails.refundAmount ? (
                                    <div className="flex justify-between text-xs text-amber-700 font-bold border-t border-amber-200 pt-1.5">
                                        <span>Refund Amount Processed:</span>
                                        <span className="font-mono">
                                            -{formatCurrency(selectedTxForDetails.refundAmount, currentTrader?.location)}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Modal Footer with Actions */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onReprint('Receipt', selectedTxForDetails)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                                >
                                    <Printer size={14} />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    onClick={() => onReprint('Invoice', selectedTxForDetails)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                                >
                                    <FileText size={14} />
                                    <span>Print Invoice</span>
                                </button>
                                <button
                                    onClick={() => onReprint('Bill', selectedTxForDetails)}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Print Bill</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                {(!selectedTxForDetails.status || selectedTxForDetails.status === 'completed') && (
                                    <>
                                        <button
                                            onClick={() => handleOpenStatusAction(selectedTxForDetails, 'void')}
                                            className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                        >
                                            <XCircle size={14} />
                                            <span>Void Sale</span>
                                        </button>
                                        <button
                                            onClick={() => handleOpenStatusAction(selectedTxForDetails, 'refund')}
                                            className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                        >
                                            <Undo2 size={14} />
                                            <span>Refund</span>
                                        </button>
                                        <button
                                            onClick={() => handleOpenStatusAction(selectedTxForDetails, 'return')}
                                            className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                        >
                                            <RotateCcw size={14} />
                                            <span>Return Items</span>
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setSelectedTxForDetails(null)}
                                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VOID / REFUND / RETURN ACTION MODAL */}
            {statusActionTx && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    statusActionTx.action === 'void' 
                                        ? 'bg-rose-100 text-rose-600' 
                                        : statusActionTx.action === 'refund'
                                            ? 'bg-amber-100 text-amber-600'
                                            : 'bg-purple-100 text-purple-600'
                                }`}>
                                    {statusActionTx.action === 'void' ? <XCircle size={18} /> : statusActionTx.action === 'refund' ? <Undo2 size={18} /> : <RotateCcw size={18} />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                        {statusActionTx.action === 'void' ? 'Void Transaction' : statusActionTx.action === 'refund' ? 'Process Customer Refund' : 'Process Item Return'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-mono">
                                        Receipt: {statusActionTx.tx.invoiceNo}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setStatusActionTx(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            {/* Reason Input */}
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                    Reason for {statusActionTx.action}:
                                </label>
                                <textarea
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                                    placeholder="Enter detailed reason for the audit trail..."
                                />
                                {/* Quick reason chips */}
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {[
                                        'Customer Cancelled', 
                                        'Cashier Error', 
                                        'Item Damaged / Defective', 
                                        'Duplicate Order',
                                        'Customer Dissatisfied'
                                    ].map(chip => (
                                        <button
                                            key={chip}
                                            type="button"
                                            onClick={() => setActionReason(chip)}
                                            className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded border border-slate-200"
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Refund Amount (if refund or return) */}
                            {statusActionTx.action !== 'void' && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                        Refund Amount ({currentTrader?.location || 'KES'}):
                                    </label>
                                    <input 
                                        type="number"
                                        value={actionRefundAmount}
                                        onChange={(e) => setActionRefundAmount(Math.max(0, Number(e.target.value)))}
                                        max={statusActionTx.tx.total}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                        Original Sale Total: {formatCurrency(statusActionTx.tx.total, currentTrader?.location)}
                                    </span>
                                </div>
                            )}

                            {/* Restock items checkbox */}
                            <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={actionRestock}
                                    onChange={(e) => setActionRestock(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-slate-700">
                                    Restock items back into active store inventory
                                </span>
                            </label>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setStatusActionTx(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSubmittingAction}
                                onClick={handleSubmitStatusAction}
                                className={`px-4 py-2 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-md ${
                                    statusActionTx.action === 'void'
                                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                        : statusActionTx.action === 'refund'
                                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                            : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                                }`}
                            >
                                {isSubmittingAction ? (
                                    <>
                                        <RefreshCcw size={14} className="animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <span>
                                        Confirm {statusActionTx.action === 'void' ? 'Void' : statusActionTx.action === 'refund' ? 'Refund' : 'Return'}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

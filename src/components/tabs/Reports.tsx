import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../context';
import { getStats, getDailyRevenue, getBillingHistory } from '../../api';
import { Stats, Transaction, BillingInvoice, formatCurrency } from '../../types';
import { 
    BarChart2, 
    Printer, 
    TrendingUp, 
    TrendingDown, 
    Store, 
    CreditCard, 
    Download, 
    FileText, 
    Mail, 
    Share2, 
    Search, 
    Send, 
    Truck,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    DollarSign,
    Activity,
    Zap,
    Percent,
    FileSpreadsheet
} from 'lucide-react';
import { ReceiptModal } from '../ReceiptModal';
import { SupplierPerformance } from '../SupplierPerformance';
import { PriceTrendChart } from '../PriceTrendChart';
import { SalesHistory } from '../SalesHistory';
import { transferPreviewToPrinter } from '../../utils/printEngine';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    ComposedChart,
    Legend
} from 'recharts';

export const ReportsTab: React.FC = () => {
    const { transactions, user, traders, showToast, refreshData } = useAppContext();
    const [stats, setStats] = useState<Stats | null>(null);
    const [dailyRevenue, setDailyRevenue] = useState<{date: string, revenue: number}[]>([]);
    const [billingHistory, setBillingHistory] = useState<BillingInvoice[]>([]);
    const [loadingBilling, setLoadingBilling] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'sales' | 'billing' | 'history' | 'pnl' | 'ledger' | 'suppliers' | 'trends'>('sales');
    const [salesViewMode, setSalesViewMode] = useState<'analytics' | 'history'>('analytics');
    const [chartViewMode, setChartViewMode] = useState<'revenue' | 'cumulative' | 'volume'>('revenue');
    const [printDoc, setPrintDoc] = useState<{ type: 'Receipt' | 'Invoice' | 'Bill', data: Transaction } | null>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const pnlRef = React.useRef<HTMLDivElement>(null);
    const ledgerRef = React.useRef<HTMLDivElement>(null);
    const [isPrintingReport, setIsPrintingReport] = useState(false);
    const isTraderUser = user && (user.role === 'manager' || user.role === 'cashier');
    const loggedInTrader = isTraderUser && user.traderId 
        ? traders.find(t => t.id === user.traderId) 
        : (isTraderUser ? (traders.find(t => t.email.toLowerCase() === user.username.toLowerCase()) || traders[0]) : null);

    const [selectedTraderId, setSelectedTraderId] = useState<number | 'all'>('all');
    const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

    const activeTraderId = loggedInTrader ? loggedInTrader.id : selectedTraderId;
    const activeTrader = activeTraderId === 'all' ? null : traders.find(t => t.id === Number(activeTraderId));
    const filteredTransactions = transactions.filter(t => {
        const matchesTrader = activeTraderId === 'all' || t.traderId === activeTraderId;
        const txDate = t.date; // Assuming YYYY-MM-DD
        const matchesDate = txDate >= startDate && txDate <= endDate;
        return matchesTrader && matchesDate;
    });

    // Compute rich daily trend data & growth analytics
    const salesTrendsAnalytics = useMemo(() => {
        const dateMap: { [date: string]: { date: string; revenue: number; count: number; discounts: number } } = {};
        
        // Group filtered transactions by date
        filteredTransactions.forEach(t => {
            const d = t.date;
            if (!dateMap[d]) {
                dateMap[d] = { date: d, revenue: 0, count: 0, discounts: 0 };
            }
            dateMap[d].revenue += t.total;
            dateMap[d].count += 1;
            dateMap[d].discounts += (t.discountAmount || 0);
        });

        const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));
        let cumulative = 0;
        const seriesData = sortedDates.map(date => {
            const entry = dateMap[date];
            cumulative += entry.revenue;
            return {
                date,
                revenue: entry.revenue,
                count: entry.count,
                avgTicket: entry.count > 0 ? Math.round(entry.revenue / entry.count) : 0,
                cumulativeRevenue: cumulative,
                discounts: entry.discounts
            };
        });

        const totalRevenue = seriesData.reduce((sum, d) => sum + d.revenue, 0);
        const totalCount = seriesData.reduce((sum, d) => sum + d.count, 0);
        const avgDailySales = seriesData.length > 0 ? Math.round(totalRevenue / seriesData.length) : 0;
        const avgOrderValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

        // Peak day
        let peakDay = { date: 'N/A', revenue: 0 };
        seriesData.forEach(d => {
            if (d.revenue > peakDay.revenue) {
                peakDay = { date: d.date, revenue: d.revenue };
            }
        });

        // Compute Growth Velocity: First half vs second half of the date range
        let growthRate = 0;
        if (seriesData.length >= 2) {
            const midpoint = Math.floor(seriesData.length / 2);
            const firstHalf = seriesData.slice(0, midpoint).reduce((sum, d) => sum + d.revenue, 0);
            const secondHalf = seriesData.slice(midpoint).reduce((sum, d) => sum + d.revenue, 0);
            if (firstHalf > 0) {
                growthRate = ((secondHalf - firstHalf) / firstHalf) * 100;
            } else if (secondHalf > 0) {
                growthRate = 100;
            }
        }

        return {
            seriesData,
            totalRevenue,
            totalCount,
            avgDailySales,
            avgOrderValue,
            peakDay,
            growthRate
        };
    }, [filteredTransactions]);

    const handleShareLink = (invoiceNo: string) => {
        const dummyLink = `${window.location.origin}/invoice/${invoiceNo}`;
        navigator.clipboard.writeText(dummyLink).then(() => {
            showToast('Invoice link copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy link', 'error');
        });
    };

    useEffect(() => {
        if (loggedInTrader) {
            setSelectedTraderId(loggedInTrader.id);
        }
    }, [loggedInTrader]);

    useEffect(() => {
        const activeTraderId = loggedInTrader ? loggedInTrader.id : selectedTraderId;

        if (activeTraderId !== 'all') {
            const filteredTx = transactions.filter(t => t.traderId === activeTraderId);
            const totalSales = filteredTx.reduce((sum, t) => sum + t.total, 0);
            const totalDiscounts = filteredTx.reduce((sum, t) => sum + t.discountAmount, 0);
            
            setStats({
                totalSales,
                totalDiscounts,
                transactionCount: filteredTx.length,
                uniqueTraders: 1
            });

            const revMap: { [date: string]: number } = {};
            // Group and aggregate transactions by date
            [...filteredTx].reverse().forEach(t => {
                revMap[t.date] = (revMap[t.date] || 0) + t.total;
            });
            const dRev = Object.keys(revMap).map(date => ({
                date,
                revenue: revMap[date]
            }));
            setDailyRevenue(dRev);
        } else {
            getStats().then(setStats);
            getDailyRevenue().then(setDailyRevenue);
        }
    }, [transactions, loggedInTrader, selectedTraderId]);

    useEffect(() => {
        const activeTraderId = loggedInTrader ? loggedInTrader.id : selectedTraderId;
        if (activeSubTab === 'billing') {
            setLoadingBilling(true);
            getBillingHistory(activeTraderId)
                .then(setBillingHistory)
                .catch(err => console.error("Failed to fetch billing history:", err))
                .finally(() => setLoadingBilling(false));
        }
    }, [activeSubTab, loggedInTrader, selectedTraderId]);

    return (
        <div className="p-6 overflow-y-auto w-full h-full bg-slate-50/50 dark:bg-slate-950/60 backdrop-blur-[1px] custom-scrollbar space-y-6">
            <ReceiptModal 
                isOpen={!!printDoc} 
                onClose={() => setPrintDoc(null)} 
                transaction={printDoc?.data || null} 
                documentType={printDoc?.type}
            />

            {/* Branding Instructional Zoom */}
            <div className="bg-slate-900 border-l-4 border-indigo-500 p-6 text-white shadow-2xl relative overflow-hidden shrink-0 rounded-r-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                        <BarChart2 size={32} className="text-indigo-400" />
                    </div>
                    <div className="flex-1 space-y-2 text-center md:text-left">
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400">Primeaxis Global Intelligence</h3>
                        <h2 className="text-xl font-black uppercase tracking-tight">Business Intelligence & Predictive Analytics</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-4xl">
                            Consolidating operational data streams into real-time executive insights. 
                            Leveraging advanced Bayesian filters for revenue forecasting and supply chain optimization across all network nodes.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                        <div className="text-[9px] font-black bg-emerald-600/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-[0.2em] whitespace-nowrap">
                            <Activity size={10} className="inline mr-2" /> Live Analytics Feed
                        </div>
                        <div className="text-[9px] font-black bg-blue-600/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 uppercase tracking-[0.2em] whitespace-nowrap">
                            <Zap size={10} className="inline mr-2" /> AI Insights Active
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <BarChart2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Reports & Analytics</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {activeTrader ? `Analyzing Node: ${activeTrader.businessName}` : 'Aggregated Global Performance'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                        <button 
                            onClick={() => setActiveSubTab('sales')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'sales' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <BarChart2 size={14} />
                            Sales
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('billing')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'billing' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <CreditCard size={14} />
                            Billing
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('pnl')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'pnl' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <TrendingUp size={14} />
                            P&L
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('ledger')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'ledger' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <FileText size={14} />
                            Ledger
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('suppliers')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'suppliers' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Truck size={14} />
                            Suppliers
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('trends')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeSubTab === 'trends' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <TrendingUp size={14} />
                            Price Trends
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm shrink-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                            />
                        </div>
                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Trader Selector Control */}
                    {loggedInTrader ? (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 shadow-sm shrink-0">
                            <Store size={14} />
                            <span>Trader: {loggedInTrader.fullName} ({loggedInTrader.businessName})</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm shrink-0 hover:border-slate-300 transition duration-150">
                            <Store size={16} className="text-slate-400" />
                            <select 
                                value={selectedTraderId}
                                onChange={(e) => setSelectedTraderId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="text-xs font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer focus:ring-0"
                            >
                                <option value="all">All Traders</option>
                                {traders.map(t => (
                                    <option key={t.id} value={t.id}>{t.fullName} ({t.businessName})</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {activeSubTab === 'sales' && (
                <div className="space-y-6">
                    {/* Sub-navigation for Sales Tab */}
                    <div className="flex items-center gap-2 mb-6 bg-white p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
                        <button
                            onClick={() => setSalesViewMode('analytics')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${salesViewMode === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <TrendingUp size={14} />
                            Sales Analytics
                        </button>
                        <button
                            onClick={() => setSalesViewMode('history')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${salesViewMode === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Calendar size={14} />
                            Sales History
                        </button>
                    </div>

                    {salesViewMode === 'analytics' ? (
                        <div className="space-y-6">
                            {/* Top Executive Summary KPI Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                            <DollarSign size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800 mb-1">
                                        {formatCurrency(salesTrendsAnalytics.totalRevenue || stats?.totalSales || 0, activeTrader?.location)}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                                        {salesTrendsAnalytics.growthRate >= 0 ? (
                                            <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                <ArrowUpRight size={12} className="mr-0.5" />
                                                +{salesTrendsAnalytics.growthRate.toFixed(1)}% Velocity
                                            </span>
                                        ) : (
                                            <span className="flex items-center text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                <ArrowDownRight size={12} className="mr-0.5" />
                                                {salesTrendsAnalytics.growthRate.toFixed(1)}% Velocity
                                            </span>
                                        )}
                                        <span className="text-slate-400 font-normal">in period</span>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daily Run Rate</span>
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <Activity size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800 mb-1">
                                        {formatCurrency(salesTrendsAnalytics.avgDailySales, activeTrader?.location)}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                        <span>AOV:</span>
                                        <span className="font-bold text-slate-700">{formatCurrency(salesTrendsAnalytics.avgOrderValue, activeTrader?.location)}/order</span>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peak Sales Day</span>
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                            <Zap size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800 mb-1">
                                        {formatCurrency(salesTrendsAnalytics.peakDay.revenue, activeTrader?.location)}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                                            {salesTrendsAnalytics.peakDay.date !== 'N/A' ? salesTrendsAnalytics.peakDay.date : 'No Data'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transactions</span>
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                            <BarChart2 size={16} />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-black text-slate-800 mb-1">
                                        {salesTrendsAnalytics.totalCount || stats?.transactionCount || 0}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                        <span>Discounts:</span>
                                        <span className="text-emerald-600 font-bold">{formatCurrency(stats?.totalDiscounts || 0, activeTrader?.location)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Interactive Summary Trend & Growth Visualization Dashboard */}
                            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 mb-8">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                            <TrendingUp size={20} className="text-blue-600" />
                                            Sales Trends & Revenue Growth Visualizer
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Interactive dynamic trajectory from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                                        <button
                                            onClick={() => setChartViewMode('revenue')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                                chartViewMode === 'revenue' 
                                                    ? 'bg-white text-blue-600 shadow-sm' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            📈 Revenue Trend
                                        </button>
                                        <button
                                            onClick={() => setChartViewMode('cumulative')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                                chartViewMode === 'cumulative' 
                                                    ? 'bg-white text-blue-600 shadow-sm' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            🚀 Cumulative Growth
                                        </button>
                                        <button
                                            onClick={() => setChartViewMode('volume')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                                chartViewMode === 'volume' 
                                                    ? 'bg-white text-blue-600 shadow-sm' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            📊 Volume & Ticket
                                        </button>
                                    </div>
                                </div>

                                <div className="h-[320px] w-full">
                                    {salesTrendsAnalytics.seriesData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chartViewMode === 'revenue' ? (
                                                <AreaChart data={salesTrendsAnalytics.seriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="mainRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                                                        axisLine={false}
                                                        tickLine={false}
                                                        dy={10}
                                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                                    />
                                                    <YAxis 
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            borderRadius: '16px', 
                                                            border: 'none', 
                                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', 
                                                            background: '#ffffff', 
                                                            fontSize: '12px',
                                                            padding: '12px'
                                                        }}
                                                        formatter={(value: any, name: string) => [
                                                            formatCurrency(Number(value), activeTrader?.location),
                                                            name === 'revenue' ? 'Daily Revenue' : name
                                                        ]}
                                                        labelFormatter={(label) => `Date: ${label}`}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="revenue" 
                                                        name="revenue"
                                                        stroke="#2563eb" 
                                                        strokeWidth={3}
                                                        fillOpacity={1} 
                                                        fill="url(#mainRevenueGrad)" 
                                                        activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                                                    />
                                                </AreaChart>
                                            ) : chartViewMode === 'cumulative' ? (
                                                <AreaChart data={salesTrendsAnalytics.seriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                                                        axisLine={false}
                                                        tickLine={false}
                                                        dy={10}
                                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                                    />
                                                    <YAxis 
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            borderRadius: '16px', 
                                                            border: 'none', 
                                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', 
                                                            background: '#ffffff', 
                                                            fontSize: '12px',
                                                            padding: '12px'
                                                        }}
                                                        formatter={(value: any) => [
                                                            formatCurrency(Number(value), activeTrader?.location),
                                                            'Cumulative Revenue'
                                                        ]}
                                                        labelFormatter={(label) => `Date: ${label}`}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="cumulativeRevenue" 
                                                        stroke="#10b981" 
                                                        strokeWidth={3}
                                                        fillOpacity={1} 
                                                        fill="url(#cumulGrad)" 
                                                        activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                                                    />
                                                </AreaChart>
                                            ) : (
                                                <ComposedChart data={salesTrendsAnalytics.seriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                                                        axisLine={false}
                                                        tickLine={false}
                                                        dy={10}
                                                        tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                                    />
                                                    <YAxis 
                                                        yAxisId="left"
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis 
                                                        yAxisId="right"
                                                        orientation="right"
                                                        tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tickFormatter={(val) => `${val}`}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            borderRadius: '16px', 
                                                            border: 'none', 
                                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', 
                                                            background: '#ffffff', 
                                                            fontSize: '12px',
                                                            padding: '12px'
                                                        }}
                                                        formatter={(value: any, name: string) => [
                                                            name === 'avgTicket' 
                                                                ? formatCurrency(Number(value), activeTrader?.location) 
                                                                : value,
                                                            name === 'count' ? 'Transactions' : 'Avg Ticket Size'
                                                        ]}
                                                    />
                                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                                    <Bar yAxisId="left" dataKey="count" name="count" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={30} />
                                                    <Line yAxisId="right" type="monotone" dataKey="avgTicket" name="avgTicket" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
                                                </ComposedChart>
                                            )}
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <TrendingUp size={40} className="mb-2 opacity-20 text-slate-500" />
                                            <p className="text-xs font-semibold">No transaction records in selected period.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <SalesHistory 
                            transactions={transactions} 
                            traders={traders} 
                            activeTraderId={activeTraderId}
                            onReprint={(type, tx) => setPrintDoc({ type, data: tx })}
                            onStatusUpdated={() => refreshData()}
                        />
                    )}
                </div>
            )}

            {activeSubTab === 'pnl' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div ref={pnlRef} className="print-container print-format-a4 bg-white border border-slate-200 shadow-sm rounded-xl p-8 print:p-0 print:border-none print:shadow-none">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                            <div>
                                <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Profit & Loss Financial Statement</h4>
                                <p className="text-sm text-slate-500 font-medium">For Period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                                {activeTrader && (
                                    <p className="text-xs text-blue-600 font-bold mt-0.5">Entity: {activeTrader.businessName || activeTrader.fullName}</p>
                                )}
                            </div>
                            <button 
                                onClick={async () => {
                                    if (!pnlRef.current) return;
                                    setIsPrintingReport(true);
                                    showToast('Transferring P&L Report to printer...', 'info');
                                    try {
                                        await transferPreviewToPrinter(pnlRef.current, {
                                            format: 'a4',
                                            model: 'a4',
                                            documentTitle: `PnL_Report_${startDate}_${endDate}`
                                        });
                                        showToast('P&L Report sent to printer!', 'success');
                                    } catch (e) {
                                        window.print();
                                    } finally {
                                        setIsPrintingReport(false);
                                    }
                                }} 
                                disabled={isPrintingReport}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer print:hidden disabled:opacity-50"
                            >
                                <Printer size={16} /> Print A4 P&L Report
                            </button>
                        </div>

                        {(() => {
                            const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
                            const totalCOGS = filteredTransactions.reduce((sum, t) => {
                                return sum + t.items.reduce((itemSum, item) => itemSum + (item.costPrice || 0) * item.qty, 0);
                            }, 0);
                            const grossProfit = totalRevenue - totalCOGS;
                            const totalDiscounts = filteredTransactions.reduce((sum, t) => sum + t.discountAmount, 0);
                            const netProfit = grossProfit; // Simple calculation for now

                            return (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                                            <div className="text-xs text-blue-600 font-bold uppercase tracking-widest mb-1">Total Revenue</div>
                                            <div className="text-2xl font-black text-blue-900">{formatCurrency(totalRevenue, activeTrader?.location)}</div>
                                            <div className="text-[10px] text-blue-500 mt-1">Gross sales including taxes</div>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
                                            <div className="text-xs text-amber-600 font-bold uppercase tracking-widest mb-1">Cost of Sales (COGS)</div>
                                            <div className="text-2xl font-black text-amber-900">{formatCurrency(totalCOGS, activeTrader?.location)}</div>
                                            <div className="text-[10px] text-amber-500 mt-1">Direct inventory cost of goods sold</div>
                                        </div>
                                        <div className={`p-6 rounded-2xl border ${grossProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                            <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Gross Profit</div>
                                            <div className={`text-2xl font-black ${grossProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>{formatCurrency(grossProfit, activeTrader?.location)}</div>
                                            <div className={`text-[10px] mt-1 ${grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Margin: {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0'}%</div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 pt-8 mt-8">
                                        <h5 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <BarChart2 size={18} className="text-slate-400" />
                                            Financial Summary
                                        </h5>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                                <span className="text-sm text-slate-600">Operating Revenue</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(totalRevenue, activeTrader?.location)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                                <span className="text-sm text-slate-600">Inventory Costs (COGS)</span>
                                                <span className="font-bold text-amber-600">({formatCurrency(totalCOGS, activeTrader?.location)})</span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-50 bg-slate-50 px-4 rounded-lg">
                                                <span className="text-sm font-bold text-slate-800">Gross Margin</span>
                                                <span className="font-black text-slate-900">{formatCurrency(grossProfit, activeTrader?.location)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                                <span className="text-sm text-slate-600">Discounts & Allowances</span>
                                                <span className="font-bold text-emerald-600">({formatCurrency(totalDiscounts, activeTrader?.location)})</span>
                                            </div>
                                            <div className="flex justify-between items-center py-4 px-4 bg-slate-900 rounded-xl mt-6">
                                                <span className="text-sm font-bold text-white">Estimated Net Profit</span>
                                                <span className="text-xl font-black text-white">{formatCurrency(netProfit - totalDiscounts, activeTrader?.location)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {activeSubTab === 'ledger' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div ref={ledgerRef} className="print-container print-format-a4 bg-white border border-slate-200 shadow-sm rounded-xl p-6 print:p-0 print:border-none print:shadow-none">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h4 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                    <FileText size={20} className="text-blue-500 print:hidden" />
                                    Daily Sales Ledger Report
                                </h4>
                                <p className="text-xs text-slate-500">Detailed record of items sold for period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2 print:hidden">
                                <button 
                                    onClick={async () => {
                                        if (!ledgerRef.current) return;
                                        setIsPrintingReport(true);
                                        showToast('Transferring Ledger to printer...', 'info');
                                        try {
                                            await transferPreviewToPrinter(ledgerRef.current, {
                                                format: 'a4',
                                                model: 'a4',
                                                documentTitle: `Daily_Ledger_${startDate}_${endDate}`
                                            });
                                            showToast('Daily Ledger sent to printer!', 'success');
                                        } catch (e) {
                                            window.print();
                                        } finally {
                                            setIsPrintingReport(false);
                                        }
                                    }}
                                    disabled={isPrintingReport}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    <Printer size={14} /> Print A4 Ledger
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto bg-white border border-slate-100 rounded-xl">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date/Time</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Product/SKU</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Qty</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Price</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cost Price</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Sales</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-400 italic">No sales data recorded for this period.</td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.flatMap(t => t.items.map((item, idx) => {
                                            const profit = (item.price - (item.costPrice || 0)) * item.qty;
                                            return (
                                                <tr key={`${t.id}-${idx}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                                                    <td className="p-4">
                                                        <div className="text-xs font-bold text-slate-700">{t.date}</div>
                                                        <div className="text-[10px] text-slate-400">{t.time}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-xs font-bold text-slate-800">{item.name}</div>
                                                        <div className="text-[10px] font-mono text-slate-400 uppercase">{item.code || 'NO-SKU'}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{item.qty}</span>
                                                    </td>
                                                    <td className="p-4 text-xs font-medium text-slate-600">{formatCurrency(item.price, activeTrader?.location)}</td>
                                                    <td className="p-4 text-xs font-medium text-slate-400 italic">{formatCurrency(item.costPrice || 0, activeTrader?.location)}</td>
                                                    <td className="p-4 text-xs font-bold text-blue-700">{formatCurrency(item.price * item.qty, activeTrader?.location)}</td>
                                                    <td className="p-4 text-right">
                                                        <div className={`text-xs font-black ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatCurrency(profit, activeTrader?.location)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'history' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={20} className="text-blue-500" />
                                Invoice History & Archives
                            </h4>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search invoice #..." 
                                    value={invoiceSearchQuery}
                                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                <FileText size={64} className="mx-auto mb-4 opacity-20" />
                                <p className="font-medium text-slate-500">No invoices found.</p>
                                <p className="text-xs mt-1">Processed transactions will appear here as invoices.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto bg-white border border-slate-100 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice No</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Merchant</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Amount</th>
                                            <th className="p-4 text-[10px) font-black uppercase tracking-widest text-slate-400">Method</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions
                                            .filter(t => t.invoiceNo.toLowerCase().includes(invoiceSearchQuery.toLowerCase()))
                                            .map((t) => (
                                            <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition">
                                                <td className="p-4">
                                                    <span className="font-mono font-bold text-blue-600">{t.invoiceNo}</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs font-bold text-slate-700">{t.date}</div>
                                                    <div className="text-[10px] text-slate-400">{t.time}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs font-bold text-slate-800">{t.customerName}</div>
                                                    <div className="text-[10px] text-slate-400">{t.paymentMethod} Payment</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs text-slate-600">{t.businessName}</div>
                                                    <div className="text-[10px] text-slate-400">{t.traderName}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm font-black text-slate-900">{formatCurrency(t.total, traders.find(tr => tr.id === t.traderId)?.location)}</div>
                                                    <div className="text-[10px] text-emerald-500">Disc: {formatCurrency(t.discountAmount, traders.find(tr => tr.id === t.traderId)?.location)}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        t.paymentMethod === 'Cash' ? 'bg-slate-100 text-slate-700 border-slate-200' : 
                                                        t.paymentMethod === 'M-Pesa' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                                                        'bg-blue-100 text-blue-800 border-blue-200'
                                                    }`}>
                                                        {t.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-1">
                                                        <button 
                                                            onClick={() => setPrintDoc({ type: 'Invoice', data: t })}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                                                            title="Reprint Invoice"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                showToast(`Invoice ${t.invoiceNo} sent to ${t.customerName}`, 'success');
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" 
                                                            title="Send via Email"
                                                        >
                                                            <Mail size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleShareLink(t.invoiceNo)}
                                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" 
                                                            title="Share Link"
                                                        >
                                                            <Share2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeSubTab === 'billing' && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-lg font-bold text-slate-800">💳 Billing & Invoice History</h4>
                        <div className="text-xs text-slate-400 font-mono">Subscription records for selected trader</div>
                    </div>

                    {loadingBilling ? (
                        <div className="text-center py-20 text-slate-400">
                            <TrendingUp size={48} className="mx-auto mb-4 animate-pulse opacity-20" />
                            <p>Loading billing history...</p>
                        </div>
                    ) : billingHistory.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                            <CreditCard size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="font-medium text-slate-500">No billing records found.</p>
                            <p className="text-xs mt-1">Subscription payments will appear here once processed.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-white border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice #</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Date</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trader</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Plan</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {billingHistory.map((inv) => {
                                        const trader = traders.find(t => t.id === inv.traderId);
                                        return (
                                            <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition">
                                                <td className="p-4 text-sm font-mono font-bold text-slate-600">{inv.invoiceNo}</td>
                                                <td className="p-4 text-sm text-slate-600">{new Date(inv.billingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="p-4 text-sm">
                                                    <div className="font-bold text-slate-800">{trader?.fullName || 'N/A'}</div>
                                                    <div className="text-[10px] text-slate-400">{trader?.businessName || 'N/A'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                                        {inv.planName}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-black text-slate-900">{formatCurrency(inv.amount, trader?.location)}</td>
                                                <td className="p-4">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                                                        inv.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                                                        'bg-red-100 text-red-800 border-red-200'
                                                    }`}>
                                                        {inv.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Download PDF">
                                                        <FileText size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {activeSubTab === 'suppliers' && (
                <SupplierPerformance traderId={activeTraderId} />
            )}

            {activeSubTab === 'trends' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PriceTrendChart 
                        transactions={filteredTransactions} 
                        location={activeTrader?.location} 
                    />
                </div>
            )}
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { 
    Globe, ShieldCheck, CheckCircle2, AlertCircle, 
    FileText, Download, Filter, Search, Info,
    ExternalLink, MapPin, Building2, Landmark, History,
    ArrowDownLeft, ArrowUpRight, BarChart3, LineChart as LineChartIcon,
    Calendar, CheckCircle, Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts';
import { useAppContext } from '../../context';
import { formatCurrency, TaxTransaction, TaxAgency, TaxRegime } from '../../types';
import * as api from '../../api';

const TAX_REGIMES: TaxRegime[] = [
    { 
        id: 1, country: 'Kenya', agency: 'KRA', currency: 'KES',
        vatRates: [{ label: 'Standard', rate: 0.16 }, { label: 'Zero Rated', rate: 0 }],
        isTIMSRequired: true
    },
    { 
        id: 2, country: 'Uganda', agency: 'URA', currency: 'UGX',
        vatRates: [{ label: 'Standard', rate: 0.18 }, { label: 'Zero Rated', rate: 0 }],
        isEFRISRequired: true
    },
    { 
        id: 3, country: 'Rwanda', agency: 'RRA', currency: 'RWF',
        vatRates: [{ label: 'Standard', rate: 0.18 }, { label: 'Zero Rated', rate: 0 }],
        isVSDURequired: true
    },
    { 
        id: 4, country: 'Tanzania', agency: 'TRA', currency: 'TZS',
        vatRates: [{ label: 'Standard', rate: 0.18 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 5, country: 'Burundi', agency: 'OBR', currency: 'BIF',
        vatRates: [{ label: 'Standard', rate: 0.18 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 6, country: 'Ethiopia', agency: 'ERCA', currency: 'ETB',
        vatRates: [{ label: 'Standard', rate: 0.15 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 7, country: 'Zambia', agency: 'ZRA', currency: 'ZMW',
        vatRates: [{ label: 'Standard', rate: 0.16 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 8, country: 'Namibia', agency: 'NamRA', currency: 'NAD',
        vatRates: [{ label: 'Standard', rate: 0.15 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 9, country: 'Botswana', agency: 'BURS', currency: 'BWP',
        vatRates: [{ label: 'Standard', rate: 0.14 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 10, country: 'Eritrea', agency: 'EIRA', currency: 'ERN',
        vatRates: [{ label: 'Sales Tax', rate: 0.10 }, { label: 'Zero Rated', rate: 0 }]
    },
    { 
        id: 11, country: 'South Sudan', agency: 'SSNRA', currency: 'SSP',
        vatRates: [{ label: 'Sales Tax', rate: 0.18 }, { label: 'Zero Rated', rate: 0 }]
    }
];

export const TaxComplianceTab: React.FC = () => {
    const { t, user, showToast } = useAppContext();
    const [activeRegime, setActiveRegime] = useState<TaxRegime | null>(null);
    const [transactions, setTransactions] = useState<TaxTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTrader, setActiveTrader] = useState<any>(null);
    const [taxId, setTaxId] = useState('');
    const [filingPeriod, setFilingPeriod] = useState('Monthly');
    const [taxChecklist, setTaxChecklist] = useState([
        { id: 1, task: 'Verify all Q3 sales receipts', completed: true },
        { id: 2, task: 'Reconcile input tax from suppliers', completed: true },
        { id: 3, task: 'Validate EFRIS/TIMS sync logs', completed: false },
        { id: 4, task: 'Generate quarterly VAT summary', completed: false },
        { id: 5, task: 'File return with regional agency', completed: false },
    ]);

    // Mock data for charts
    const projectionData = [
        { name: 'Jul', actual: 4000, projected: 4000 },
        { name: 'Aug', actual: 4500, projected: 4500 },
        { name: 'Sep', actual: 4800, projected: 4800 },
        { name: 'Oct', projected: 5200 },
        { name: 'Nov', projected: 5600 },
        { name: 'Dec', projected: 6100 },
    ];

    const yoyData = [
        { name: 'Q1', lastYear: 12000, currentYear: 14500 },
        { name: 'Q2', lastYear: 15000, currentYear: 18200 },
        { name: 'Q3', lastYear: 14000, currentYear: 19500 },
        { name: 'Q4', lastYear: 18000, currentYear: null },
    ];

    useEffect(() => {
        const stored = localStorage.getItem('biashara_current_trader');
        if (stored) {
            const t = JSON.parse(stored);
            setActiveTrader(t);
            // Auto-detect regime if trader has a location
            const regime = TAX_REGIMES.find(r => 
                t.location?.toLowerCase().includes(r.country.toLowerCase())
            ) || TAX_REGIMES[0];
            setActiveRegime(regime);
        }
        fetchTaxData();
    }, []);

    const fetchTaxData = async () => {
        setLoading(true);
        try {
            const res = await api.getTaxTransactions();
            setTransactions(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (transactions.length === 0) {
            showToast("No data to export", "warning");
            return;
        }

        const headers = ["Date", "Reference No", "Type", "Net Amount", "Tax Amount", "Total Amount", "Status"];
        const csvRows = transactions.map(tx => [
            new Date(tx.date).toLocaleDateString(),
            tx.referenceNo,
            tx.type,
            tx.netAmount.toString(),
            tx.taxAmount.toString(),
            (tx.netAmount + tx.taxAmount).toString(),
            tx.status
        ]);

        const csvContent = [headers, ...csvRows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `tax_report_${activeRegime?.country || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV Exported successfully", "success");
    };

    const handleExportPDF = () => {
        if (transactions.length === 0) {
            showToast("No data to export", "warning");
            return;
        }
        // Simplified PDF export using window.print() focused on the table or just a notification
        // Real PDF generation often requires libraries like jsPDF or html2canvas
        // For now, we'll trigger a print view or provide a high-quality print-ready version
        window.print();
        showToast("Print dialog opened for PDF generation", "success");
    };

    const handleUpdateRegistration = async () => {
        if (!activeTrader) {
            showToast("Please select a country regime first", "warning");
            return;
        }
        
        setLoading(true);
        try {
            const res = await api.updateTrader(activeTrader.id, {
                taxId: taxId,
                filingPeriod: filingPeriod as any
            });
            if (res.success) {
                showToast("Taxpayer details updated persistently!", "success");
                // Update local state and storage
                const updatedTrader = { ...activeTrader, taxId, filingPeriod };
                setActiveTrader(updatedTrader);
                localStorage.setItem('biashara_current_trader', JSON.stringify(updatedTrader));
                api.logAuditAction("Updated Tax Registration", { taxId, filingPeriod });
            }
        } catch (e: any) {
            showToast(e.message || "Failed to update registration", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 overflow-y-auto w-full h-full bg-slate-50 print:bg-white print:p-0">
            <div className="max-w-7xl mx-auto space-y-8 print:space-y-4">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                    <div>
                        <div className="flex items-center gap-3 text-blue-600 mb-1">
                            <ShieldCheck size={20} />
                            <span className="font-black text-xs uppercase tracking-widest">Compliance Module</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            {t('tax_compliance')}
                            {activeRegime && (
                                <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black">
                                    {activeRegime.country} · {activeRegime.agency}
                                </span>
                            )}
                        </h1>
                        <p className="text-slate-500 font-medium">{t('tax_desc')}</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative group">
                            <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm">
                                <Download size={14} /> Export Records
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 hidden group-hover:block">
                                <button 
                                    onClick={handleExportCSV}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <FileText size={14} className="text-blue-500" /> Export as CSV
                                </button>
                                <button 
                                    onClick={handleExportPDF}
                                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <Download size={14} className="text-red-500" /> Export as PDF (Print)
                                </button>
                            </div>
                        </div>
                        <button 
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    // Simulate tax filing
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    showToast(`Tax return for ${activeRegime?.agency} filed successfully!`, "success");
                                    api.logAuditAction("Filed Tax Return", { agency: activeRegime?.agency, country: activeRegime?.country });
                                } catch (e) {
                                    showToast("Failed to file tax return", "error");
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                            className="flex items-center gap-2 bg-blue-600 px-5 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {loading ? "Filing..." : "File Current Period"}
                        </button>
                    </div>
                </header>

                {/* Configuration & Health - Horizontal Bar */}
                <div className="flex flex-col xl:flex-row gap-6 print:hidden">
                    {/* Active Regime Selection */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Globe size={16} className="text-blue-500" />
                            {t('active_regime')}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {TAX_REGIMES.map(regime => (
                                <button
                                    key={regime.id}
                                    onClick={() => setActiveRegime(regime)}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all border ${
                                        activeRegime?.id === regime.id 
                                        ? 'bg-blue-50 border-blue-200 text-blue-700 font-black shadow-sm' 
                                        : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100 font-bold'
                                    }`}
                                >
                                    <span className="text-lg">
                                        {regime.country === 'Kenya' ? '🇰🇪' : 
                                         regime.country === 'Uganda' ? '🇺🇬' : 
                                         regime.country === 'Rwanda' ? '🇷🇼' : 
                                         regime.country === 'Tanzania' ? '🇹🇿' : 
                                         regime.country === 'Burundi' ? '🇧🇮' : 
                                         regime.country === 'Ethiopia' ? '🇪🇹' :
                                         regime.country === 'Zambia' ? '🇿🇲' :
                                         regime.country === 'Namibia' ? '🇳🇦' :
                                         regime.country === 'Botswana' ? '🇧🇼' :
                                         regime.country === 'Eritrea' ? '🇪🇷' :
                                         regime.country === 'South Sudan' ? '🇸🇸' : '🌍'}
                                    </span>
                                    <div className="text-left">
                                        <p className="text-[10px] leading-tight">{regime.country}</p>
                                        <p className="text-[8px] uppercase opacity-60 font-black tracking-tighter">{regime.agency}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Compliance Health Metrics */}
                    <div className="xl:w-80 bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col justify-between">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Compliance Health</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Registry Status</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase bg-emerald-400/10 px-2 py-0.5 rounded w-fit">
                                    <CheckCircle2 size={10} /> Valid
                                </span>
                            </div>
                            <div>
                                <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Agency Sync</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase bg-emerald-400/10 px-2 py-0.5 rounded w-fit">
                                    <CheckCircle2 size={10} /> Active
                                </span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                            <div>
                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Next Filing</p>
                                <p className="text-xs font-black">20th Sep 2026</p>
                            </div>
                            <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg">
                                <History size={16} />
                            </div>
                        </div>
                    </div>
                </div>
 
                {/* Taxpayer Configuration Form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm print:hidden">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" />
                        Taxpayer Registration
                    </h3>
                    <form className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax Identification Number (TIN/PIN)</label>
                            <input 
                                type="text" 
                                value={taxId}
                                onChange={(e) => setTaxId(e.target.value)}
                                placeholder="Enter Tax ID..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Returns Filing Period</label>
                            <select 
                                value={filingPeriod}
                                onChange={(e) => setFilingPeriod(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                            >
                                <option value="Monthly">Monthly Filing</option>
                                <option value="Quarterly">Quarterly Filing</option>
                                <option value="Bi-Annual">Bi-Annual Filing</option>
                                <option value="Annual">Annual Filing</option>
                            </select>
                        </div>
                        <button 
                            type="button"
                            onClick={handleUpdateRegistration}
                            disabled={loading}
                            className="bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-slate-800 transition shadow-lg shadow-slate-200 disabled:opacity-50"
                        >
                            {loading ? "Updating..." : "Update Registration"}
                        </button>
                    </form>
                </div>

                <div className="space-y-6">
                    {/* Main Content */}
                    <div className="space-y-6 print:w-full">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
                            {[
                                { label: 'Input Tax (VAT)', value: 12450.60, trend: '+12%', icon: ArrowDownLeft, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Output Tax (VAT)', value: 45890.20, trend: '+8%', icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Net Payable', value: 33439.60, trend: 'Calculated', icon: Landmark, color: 'text-slate-900', bg: 'bg-slate-100' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <stat.icon size={64} />
                                    </div>
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
                                    <p className="text-2xl font-black text-slate-900">{formatCurrency(stat.value, activeTrader?.location)}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1">
                                        {stat.trend.startsWith('+') ? <TrendingUp size={10} className="text-emerald-500" /> : <Info size={10} />}
                                        {stat.trend} from last period
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Projection and YoY Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('quarterly_liability')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold">Estimated for upcoming Q4</p>
                                    </div>
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                        <BarChart3 size={18} />
                                    </div>
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={projectionData}>
                                            <defs>
                                                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                                            />
                                            <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                                            <Area type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorProjected)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('yoy_comparison')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold">Quarterly Tax Liability</p>
                                    </div>
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <LineChartIcon size={18} />
                                    </div>
                                </div>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={yoyData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                            />
                                            <Legend verticalAlign="top" height={36}/>
                                            <Line name={t('last_year')} type="monotone" dataKey="lastYear" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                            <Line name={t('current_year')} type="monotone" dataKey="currentYear" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                                    <History size={18} className="text-slate-400" />
                                    {t('transactions_log')}
                                </h3>
                                <div className="flex items-center gap-4 print:hidden">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="text" placeholder="Search invoices..." className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64" />
                                    </div>
                                </div>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref No</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Net Amount</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tax Amount</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-600">{new Date(tx.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-xs font-black text-slate-900">{tx.referenceNo}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${tx.type === 'Sales' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">{formatCurrency(tx.netAmount, activeTrader?.location)}</td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">{formatCurrency(tx.taxAmount, activeTrader?.location)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reported</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="bg-slate-50 p-4 rounded-full mb-4">
                                                        <FileText size={32} className="text-slate-300" />
                                                    </div>
                                                    <p className="text-slate-400 font-medium">No tax transactions recorded in this period.</p>
                                                    <p className="text-[10px] text-slate-300 font-bold uppercase mt-1 tracking-widest">System ready for incoming ledger entries</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* End-of-Quarter Checklist */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm print:hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('compliance_checklist')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold">Stay compliant for Q3 2026</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">
                                    {taxChecklist.filter(t => t.completed).length} / {taxChecklist.length} Complete
                                </span>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {taxChecklist.map(step => (
                                    <button 
                                        key={step.id}
                                        onClick={() => setTaxChecklist(prev => prev.map(t => t.id === step.id ? {...t, completed: !t.completed} : t))}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                            step.completed 
                                                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' 
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`p-1.5 rounded-full ${step.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                            <CheckCircle size={14} />
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${step.completed ? 'line-through opacity-50' : ''}`}>{step.task}</p>
                                            <p className="text-[9px] font-black uppercase tracking-tighter opacity-60 mt-0.5">
                                                {step.completed ? 'Step Accomplished' : 'Action Required'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Regulatory Alerts */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 print:hidden">
                            <div className="flex items-start gap-4">
                                <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-amber-900">Agency Requirements Notice</h4>
                                    <p className="text-xs text-amber-800 font-medium leading-relaxed mt-1">
                                        For {activeRegime?.country} compliance, you must ensure all fiscal devices are synchronized daily. {activeRegime?.isTIMSRequired && "KRA TIMS V3 integration is active for your hardware."}
                                        {activeRegime?.isEFRISRequired && "URA EFRIS real-time reporting is enabled for all B2B transactions."}
                                    </p>
                                    <button className="text-xs font-black text-amber-900 underline mt-3 flex items-center gap-1">
                                        View Agency Documentation <ExternalLink size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TrendingUp = ({ size, className }: { size?: number, className?: string }) => (
    <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
);

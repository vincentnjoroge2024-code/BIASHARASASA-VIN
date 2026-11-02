import React from 'react';
import { 
    TrendingUp, Receipt, Wallet, Banknote, BookOpen, 
    ArrowUpRight, ArrowDownLeft, Plus, DollarSign, RefreshCw
} from 'lucide-react';
import { formatCurrency, Account, JournalEntry } from '../../types';

interface FinanceOverviewProps {
    accounts: Account[];
    entries: JournalEntry[];
    activeTrader: any;
    onNavigate: (tab: any) => void;
    onOpenExpenseModal: () => void;
    onOpenJournalModal: () => void;
    onOpenTransferModal: () => void;
}

export const FinanceOverview: React.FC<FinanceOverviewProps> = ({
    accounts,
    entries,
    activeTrader,
    onNavigate,
    onOpenExpenseModal,
    onOpenJournalModal,
    onOpenTransferModal
}) => {
    const revenue = accounts.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0);
    const expenses = accounts.filter(a => a.type === 'Expense').reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const assets = accounts.filter(a => a.type === 'Asset').reduce((sum, a) => sum + a.balance, 0);
    const liabilities = accounts.filter(a => a.type === 'Liability').reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const netProfit = revenue - expenses;

    // Liquidity breakdown
    const cashOnHand = accounts.find(a => a.code === '1001')?.balance || 0;
    const bankBalance = accounts.find(a => a.code === '1002')?.balance || 0;
    const tillBalance = accounts.find(a => a.code === '1003')?.balance || 0;
    const totalLiquid = cashOnHand + bankBalance + tillBalance;

    const receivables = accounts.find(a => a.code === '1300')?.balance || 0;
    const payables = accounts.find(a => a.code === '2001')?.balance || 0;

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Financial Overview</h1>
                    <p className="text-slate-500 font-medium">Real-time consolidated view of your business liquidity, profitability, and ledger.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={onOpenExpenseModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition shadow-sm"
                    >
                        <Plus size={15} /> Record Expense
                    </button>
                    <button 
                        onClick={onOpenTransferModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
                    >
                        <RefreshCw size={15} /> Transfer Funds
                    </button>
                    <button 
                        onClick={onOpenJournalModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition shadow-lg shadow-blue-200"
                    >
                        <Plus size={15} /> New Journal Entry
                    </button>
                </div>
            </header>

            {/* Core KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="bg-emerald-50 text-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">Gross Inflow</span>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Sales Revenue</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(revenue, activeTrader?.location)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="bg-rose-50 text-rose-600 w-10 h-10 rounded-xl flex items-center justify-center">
                            <Receipt size={20} />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 uppercase">Total Outflow</span>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Operating Expenses</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(expenses, activeTrader?.location)}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
                            <Wallet size={20} />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {netProfit >= 0 ? 'Net Surplus' : 'Net Deficit'}
                        </span>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Net Operating Income</p>
                    <p className={`text-2xl font-black mt-1 ${netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        {formatCurrency(netProfit, activeTrader?.location)}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="bg-purple-50 text-purple-600 w-10 h-10 rounded-xl flex items-center justify-center">
                            <Banknote size={20} />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase">Liquid Reserve</span>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Cash & Bank Reserves</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalLiquid, activeTrader?.location)}</p>
                </div>
            </div>

            {/* Liquidity Accounts & Working Capital Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-black text-slate-900">Liquidity Accounts</h3>
                        <button onClick={() => onNavigate('cash')} className="text-xs font-bold text-blue-600 hover:underline">
                            Manage &rarr;
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-slate-800">💵 Main Cash Drawer</p>
                                <p className="text-[10px] text-slate-400 font-semibold">Till POS Float</p>
                            </div>
                            <span className="text-sm font-black text-slate-900">{formatCurrency(cashOnHand, activeTrader?.location)}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-slate-800">📱 M-Pesa Business Till</p>
                                <p className="text-[10px] text-slate-400 font-semibold">Buy Goods 784920</p>
                            </div>
                            <span className="text-sm font-black text-slate-900">{formatCurrency(tillBalance, activeTrader?.location)}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-slate-800">🏦 KCB Business Checking</p>
                                <p className="text-[10px] text-slate-400 font-semibold">Bank Account</p>
                            </div>
                            <span className="text-sm font-black text-slate-900">{formatCurrency(bankBalance, activeTrader?.location)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-black text-slate-900">Working Capital Position</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">Audit Verified</span>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs font-medium text-slate-600">Accounts Receivable (Customer Credit)</span>
                            <span className="text-xs font-black text-emerald-600">+{formatCurrency(receivables, activeTrader?.location)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs font-medium text-slate-600">Accounts Payable (Supplier Bills)</span>
                            <span className="text-xs font-black text-rose-600">-{formatCurrency(payables, activeTrader?.location)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs font-medium text-slate-600">Total Asset Valuation</span>
                            <span className="text-xs font-black text-slate-900">{formatCurrency(assets, activeTrader?.location)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-xs font-black text-slate-800">Net Working Capital</span>
                            <span className="text-sm font-black text-blue-600">
                                {formatCurrency(assets - liabilities, activeTrader?.location)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-black text-slate-900">Financial Reports</h3>
                        <button onClick={() => onNavigate('statements')} className="text-xs font-bold text-blue-600 hover:underline">
                            View All &rarr;
                        </button>
                    </div>
                    <div className="space-y-2.5">
                        <button 
                            onClick={() => onNavigate('statements')}
                            className="w-full p-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-left flex items-center justify-between transition group"
                        >
                            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">📊 Profit & Loss Statement</span>
                            <ArrowUpRight size={14} className="text-slate-400 group-hover:text-blue-600" />
                        </button>
                        <button 
                            onClick={() => onNavigate('statements')}
                            className="w-full p-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-left flex items-center justify-between transition group"
                        >
                            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">🏛️ Balance Sheet</span>
                            <ArrowUpRight size={14} className="text-slate-400 group-hover:text-blue-600" />
                        </button>
                        <button 
                            onClick={() => onNavigate('statements')}
                            className="w-full p-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-left flex items-center justify-between transition group"
                        >
                            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">📑 Trial Balance Audit</span>
                            <ArrowUpRight size={14} className="text-slate-400 group-hover:text-blue-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent Ledger Entries */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Recent Ledger Activity</h3>
                        <p className="text-xs text-slate-500 font-medium">Double-entry audit log of posted transactions.</p>
                    </div>
                    <button 
                        onClick={() => onNavigate('ledger')}
                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                    >
                        Open General Ledger &rarr;
                    </button>
                </div>

                <div className="space-y-3">
                    {entries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-100 gap-3 transition">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2.5 rounded-lg shadow-sm text-blue-600">
                                    <BookOpen size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800">{entry.description}</p>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        <span className="font-mono font-bold text-slate-700">{entry.reference}</span> · {new Date(entry.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">
                                        {formatCurrency(entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0), activeTrader?.location)}
                                    </p>
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Balanced</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {entries.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            <p className="text-sm">No journal entries recorded yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

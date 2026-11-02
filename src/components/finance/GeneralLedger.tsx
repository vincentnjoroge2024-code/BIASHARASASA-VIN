import React, { useState } from 'react';
import { 
    BookOpen, Plus, Search, Filter, ChevronRight, CheckCircle2, 
    ArrowUpDown, AlertCircle
} from 'lucide-react';
import { formatCurrency, Account, JournalEntry } from '../../types';

interface GeneralLedgerProps {
    accounts: Account[];
    entries: JournalEntry[];
    activeTrader: any;
    onOpenAccountModal: () => void;
    onOpenJournalModal: () => void;
}

export const GeneralLedger: React.FC<GeneralLedgerProps> = ({
    accounts,
    entries,
    activeTrader,
    onOpenAccountModal,
    onOpenJournalModal
}) => {
    const [viewMode, setViewMode] = useState<'accounts' | 'journals'>('accounts');
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (acc.category && acc.category.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'all' || acc.type.toLowerCase() === typeFilter.toLowerCase();
        return matchesSearch && matchesType;
    });

    const filteredEntries = entries.filter(ent => {
        return ent.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
               ent.description.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">General Ledger</h1>
                    <p className="text-slate-500 font-medium">Manage your Chart of Accounts and post balanced double-entry journals.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onOpenAccountModal}
                        className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                        <Plus size={15} /> New Account
                    </button>
                    <button 
                        onClick={onOpenJournalModal}
                        className="flex items-center gap-2 bg-blue-600 px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                    >
                        <Plus size={15} /> Post Journal Entry
                    </button>
                </div>
            </header>

            {/* View Mode Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setViewMode('accounts')}
                    className={`pb-3 px-6 text-sm font-bold border-b-2 transition ${
                        viewMode === 'accounts' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    Chart of Accounts ({accounts.length})
                </button>
                <button
                    onClick={() => setViewMode('journals')}
                    className={`pb-3 px-6 text-sm font-bold border-b-2 transition ${
                        viewMode === 'journals' 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    Journal Entries ({entries.length})
                </button>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder={viewMode === 'accounts' ? "Search by code or account name..." : "Search journal entries..."} 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {viewMode === 'accounts' && (
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {['all', 'asset', 'liability', 'equity', 'revenue', 'expense'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                                    typeFilter === t 
                                    ? 'bg-slate-900 text-white' 
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Content Table */}
            {viewMode === 'accounts' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Title</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Current Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAccounts.map(acc => (
                                <tr key={acc.id} className="hover:bg-slate-50/70 transition">
                                    <td className="px-6 py-4 text-xs font-mono font-black text-slate-900">{acc.code}</td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-900">{acc.name}</p>
                                        {acc.description && <p className="text-xs text-slate-400 font-normal">{acc.description}</p>}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">{acc.category || 'General'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ${
                                            acc.type === 'Asset' ? 'bg-blue-100 text-blue-700' :
                                            acc.type === 'Liability' ? 'bg-rose-100 text-rose-700' :
                                            acc.type === 'Revenue' ? 'bg-emerald-100 text-emerald-700' :
                                            acc.type === 'Expense' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                                        }`}>
                                            {acc.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">
                                        {formatCurrency(acc.balance, activeTrader?.location)}
                                    </td>
                                </tr>
                            ))}
                            {filteredAccounts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                        No accounts found matching your query.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredEntries.map(entry => {
                        const totalDebit = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
                        const isExpanded = selectedEntry?.id === entry.id;

                        return (
                            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div 
                                    onClick={() => setSelectedEntry(isExpanded ? null : entry)}
                                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-mono font-bold text-xs">
                                            #{entry.id}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{entry.reference}</span>
                                                <h4 className="text-sm font-black text-slate-900">{entry.description}</h4>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-6">
                                        <div className="text-right">
                                            <p className="text-sm font-black text-slate-900">{formatCurrency(totalDebit, activeTrader?.location)}</p>
                                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-end">
                                                <CheckCircle2 size={12} /> Balanced Entry
                                            </span>
                                        </div>
                                        <ChevronRight size={18} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-slate-50/70 border-t border-slate-100 p-5">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Double-Entry Ledger Lines</p>
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-100 border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-2 font-bold text-slate-600">Account</th>
                                                        <th className="px-4 py-2 font-bold text-slate-600 text-right">Debit</th>
                                                        <th className="px-4 py-2 font-bold text-slate-600 text-right">Credit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-mono">
                                                    {entry.lines.map((l, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="px-4 py-2.5 font-sans font-medium text-slate-800">
                                                                {l.accountName || `Account #${l.accountId}`}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                                                {l.debit > 0 ? formatCurrency(l.debit, activeTrader?.location) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                                                {l.credit > 0 ? formatCurrency(l.credit, activeTrader?.location) : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

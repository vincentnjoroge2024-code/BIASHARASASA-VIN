import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, BookOpen, Users, ShoppingCart, 
    Wallet, Receipt, PieChart, Settings, Plus, 
    ShieldCheck, X, CheckCircle2, ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../../context';
import { formatCurrency, Account, JournalEntry } from '../../types';
import * as api from '../../api';

import { FinanceOverview } from '../finance/FinanceOverview';
import { GeneralLedger } from '../finance/GeneralLedger';
import { ReceivablesPayables } from '../finance/ReceivablesPayables';
import { CashAndBank } from '../finance/CashAndBank';
import { ExpenseTracker } from '../finance/ExpenseTracker';
import { FinancialStatements } from '../finance/FinancialStatements';
import { FinanceSettings } from '../finance/FinanceSettings';

type FinanceSubTab = 'dashboard' | 'ledger' | 'receivable' | 'payable' | 'cash' | 'expenses' | 'statements' | 'settings';

export const FinanceTab: React.FC = () => {
    const { t, showToast, logAuditAction } = useAppContext();
    const [subTab, setSubTab] = useState<FinanceSubTab>('dashboard');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTrader, setActiveTrader] = useState<any>(null);
    
    // Modals
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // Form States
    const [newAccount, setNewAccount] = useState<{
        code: string;
        name: string;
        type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
        category: string;
        description: string;
    }>({ code: '', name: '', type: 'Asset', category: '', description: '' });

    const [newJournal, setNewJournal] = useState({ 
        date: new Date().toISOString().split('T')[0], 
        reference: `JNL-${Date.now().toString().slice(-4)}`, 
        description: '', 
        lines: [
            { accountId: 0, debit: 0, credit: 0 },
            { accountId: 0, debit: 0, credit: 0 }
        ] as any[]
    });

    const [newExpense, setNewExpense] = useState({
        title: '',
        category: 'Utilities',
        amount: '',
        paidFrom: '1001', // Cash Drawer
        payee: '',
        date: new Date().toISOString().split('T')[0]
    });

    const [newTransfer, setNewTransfer] = useState({
        fromAccountId: '1001',
        toAccountId: '1002',
        amount: '',
        reference: `SWEEP-${Date.now().toString().slice(-4)}`,
        note: 'Daily Cash Sweep to Bank'
    });

    useEffect(() => {
        const stored = localStorage.getItem('biashara_current_trader');
        if (stored) {
            try {
                setActiveTrader(JSON.parse(stored));
            } catch (e) {
                console.error(e);
            }
        }
        fetchFinanceData();
    }, []);

    const fetchFinanceData = async () => {
        setLoading(true);
        try {
            const [accs, jnls] = await Promise.all([
                api.getFinanceAccounts(),
                api.getJournalEntries()
            ]);
            setAccounts(accs);
            setEntries(jnls);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccount.code || !newAccount.name) {
            showToast("Please provide account code and title", "warning");
            return;
        }
        try {
            await api.createFinanceAccount(newAccount);
            showToast("Account created in General Ledger", "success");
            setIsAccountModalOpen(false);
            setNewAccount({ code: '', name: '', type: 'Asset', category: '', description: '' });
            fetchFinanceData();
            logAuditAction("Created Finance Account", { name: newAccount.name, code: newAccount.code });
        } catch (err) {
            showToast("Failed to create account", "error");
        }
    };

    const handleSaveJournal = async (e: React.FormEvent) => {
        e.preventDefault();
        const totalDebit = newJournal.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
        const totalCredit = newJournal.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            showToast("Journal entry must be balanced (Debits must equal Credits)", "warning");
            return;
        }

        if (totalDebit <= 0) {
            showToast("Journal entry amount must be greater than zero", "warning");
            return;
        }

        try {
            const formattedLines = newJournal.lines.map(l => {
                const acc = accounts.find(a => a.id === Number(l.accountId) || a.code === String(l.accountId));
                return {
                    accountId: acc?.id || Number(l.accountId),
                    accountName: acc?.name || 'Ledger Account',
                    debit: parseFloat(l.debit) || 0,
                    credit: parseFloat(l.credit) || 0
                };
            });

            await api.createJournalEntry({
                ...newJournal,
                lines: formattedLines
            });

            showToast("Double-entry journal posted successfully", "success");
            setIsJournalModalOpen(false);
            setNewJournal({ 
                date: new Date().toISOString().split('T')[0], 
                reference: `JNL-${Date.now().toString().slice(-4)}`, 
                description: '', 
                lines: [{ accountId: 0, debit: 0, credit: 0 }, { accountId: 0, debit: 0, credit: 0 }] 
            });
            fetchFinanceData();
            logAuditAction("Posted Journal Entry", { reference: newJournal.reference });
        } catch (err) {
            showToast("Failed to post journal entry", "error");
        }
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        const amountNum = parseFloat(newExpense.amount);
        if (!amountNum || amountNum <= 0) {
            showToast("Please enter a valid expense amount", "warning");
            return;
        }

        try {
            // Create automated double entry: Debit Expense Account, Credit Asset/Payment Account
            const expenseAccount = accounts.find(a => a.type === 'Expense') || accounts[0];
            const sourceAccount = accounts.find(a => a.code === newExpense.paidFrom) || accounts[0];

            await api.createJournalEntry({
                date: newExpense.date,
                reference: `EXP-${Date.now().toString().slice(-4)}`,
                description: `${newExpense.category}: ${newExpense.title} (${newExpense.payee})`,
                lines: [
                    { accountId: expenseAccount.id, accountName: expenseAccount.name, debit: amountNum, credit: 0 },
                    { accountId: sourceAccount.id, accountName: sourceAccount.name, debit: 0, credit: amountNum }
                ]
            });

            showToast("Expense recorded and ledger updated", "success");
            setIsExpenseModalOpen(false);
            setNewExpense({
                title: '',
                category: 'Utilities',
                amount: '',
                paidFrom: '1001',
                payee: '',
                date: new Date().toISOString().split('T')[0]
            });
            fetchFinanceData();
        } catch (err) {
            showToast("Failed to record expense", "error");
        }
    };

    const handleSaveTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(newTransfer.amount);
        if (!amt || amt <= 0) {
            showToast("Please enter a valid transfer amount", "warning");
            return;
        }
        if (newTransfer.fromAccountId === newTransfer.toAccountId) {
            showToast("Origin and Destination accounts must be different", "warning");
            return;
        }

        try {
            const fromAcc = accounts.find(a => a.code === newTransfer.fromAccountId) || accounts[0];
            const toAcc = accounts.find(a => a.code === newTransfer.toAccountId) || accounts[1];

            await api.createJournalEntry({
                date: new Date().toISOString().split('T')[0],
                reference: newTransfer.reference,
                description: `${newTransfer.note} (${fromAcc.name} → ${toAcc.name})`,
                lines: [
                    { accountId: toAcc.id, accountName: toAcc.name, debit: amt, credit: 0 },
                    { accountId: fromAcc.id, accountName: fromAcc.name, debit: 0, credit: amt }
                ]
            });

            showToast("Funds transferred and ledger reconciled", "success");
            setIsTransferModalOpen(false);
            setNewTransfer({
                fromAccountId: '1001',
                toAccountId: '1002',
                amount: '',
                reference: `SWEEP-${Date.now().toString().slice(-4)}`,
                note: 'Daily Cash Sweep to Bank'
            });
            fetchFinanceData();
        } catch (err) {
            showToast("Failed to transfer funds", "error");
        }
    };

    const sidebarItems = [
        { id: 'dashboard', label: t('fin_dashboard'), icon: LayoutDashboard },
        { id: 'ledger', label: t('fin_ledger'), icon: BookOpen },
        { id: 'receivable', label: t('fin_receivable'), icon: Users },
        { id: 'payable', label: t('fin_payable'), icon: ShoppingCart },
        { id: 'cash', label: t('fin_cash'), icon: Wallet },
        { id: 'expenses', label: t('fin_expenses'), icon: Receipt },
        { id: 'statements', label: t('fin_statements'), icon: PieChart },
        { id: 'settings', label: t('fin_settings'), icon: Settings },
    ];

    const revenue = accounts.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0);
    const expenses = accounts.filter(a => a.type === 'Expense').reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const netProfit = revenue - expenses;

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-slate-200 shrink-0 z-20">
                <div className="px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <ShieldCheck size={18} />
                            <span className="font-black text-[10px] uppercase tracking-widest">{t('fin_ledger_pro')}</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{t('fin_management_node')}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 rounded-xl px-4 py-2 text-white flex items-center gap-4">
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('accounting_health')}</p>
                                <p className="text-xs font-black">{formatCurrency(netProfit, activeTrader?.location)}</p>
                            </div>
                            <span className={`text-[8px] px-2 py-0.5 rounded font-bold ${netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {netProfit >= 0 ? t('surplus') : t('deficit')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sub-tabs horizontal scrollable list */}
                <div className="px-8 border-t border-slate-100 overflow-x-auto scrollbar-hide">
                    <nav className="flex items-center gap-1 py-1">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSubTab(item.id as FinanceSubTab)}
                                className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
                                    subTab === item.id 
                                    ? 'border-blue-600 text-blue-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                <item.icon size={14} />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Branding Instructional Zoom */}
                <div className="bg-slate-900 border-l-4 border-emerald-500 p-6 text-white shadow-2xl relative overflow-hidden shrink-0 rounded-r-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                            <BookOpen size={32} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-400">Primeaxis Ledger Pro</h3>
                            <h2 className="text-xl font-black uppercase tracking-tight">Double-Entry Financial Management System</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-4xl">
                                Enterprise-grade financial node with real-time GAAP-compliant reconciliation. 
                                Securely managing General Ledger, Accounts Receivable/Payable, and Asset-Liability ratios through a cryptographically verified ledger.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            <div className="text-[9px] font-black bg-emerald-600/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-[0.2em] whitespace-nowrap">
                                <ShieldCheck size={10} className="inline mr-2" /> Ledger Reconciled
                            </div>
                            <div className="text-[9px] font-black bg-blue-600/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 uppercase tracking-[0.2em] whitespace-nowrap">
                                <ArrowRightLeft size={10} className="inline mr-2" /> Sync Completed
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={subTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                        {subTab === 'dashboard' && (
                            <FinanceOverview
                                accounts={accounts}
                                entries={entries}
                                activeTrader={activeTrader}
                                onNavigate={setSubTab}
                                onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
                                onOpenJournalModal={() => setIsJournalModalOpen(true)}
                                onOpenTransferModal={() => setIsTransferModalOpen(true)}
                            />
                        )}

                        {subTab === 'ledger' && (
                            <GeneralLedger
                                accounts={accounts}
                                entries={entries}
                                activeTrader={activeTrader}
                                onOpenAccountModal={() => setIsAccountModalOpen(true)}
                                onOpenJournalModal={() => setIsJournalModalOpen(true)}
                            />
                        )}

                        {(subTab === 'receivable' || subTab === 'payable') && (
                            <ReceivablesPayables
                                type={subTab}
                                activeTrader={activeTrader}
                                onRecordPayment={(item) => {
                                    showToast(`Payment recorded for ${item.partnerName}`, "success");
                                }}
                            />
                        )}

                        {subTab === 'cash' && (
                            <CashAndBank
                                accounts={accounts}
                                activeTrader={activeTrader}
                                onOpenTransferModal={() => setIsTransferModalOpen(true)}
                            />
                        )}

                        {subTab === 'expenses' && (
                            <ExpenseTracker
                                accounts={accounts}
                                activeTrader={activeTrader}
                                onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
                            />
                        )}

                        {subTab === 'statements' && (
                            <FinancialStatements
                                accounts={accounts}
                                entries={entries}
                                activeTrader={activeTrader}
                            />
                        )}

                        {subTab === 'settings' && (
                            <FinanceSettings
                                activeTrader={activeTrader}
                                onResetDefaults={fetchFinanceData}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Modal: New Account */}
            {isAccountModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <form onSubmit={handleSaveAccount}>
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900">Add Account to Ledger</h3>
                                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account Code</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. 1005"
                                        value={newAccount.code}
                                        onChange={e => setNewAccount({...newAccount, code: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Account Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Emergency Liquidity Reserve"
                                        value={newAccount.name}
                                        onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                                        <select 
                                            value={newAccount.type}
                                            onChange={e => setNewAccount({...newAccount, type: e.target.value as any})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                                        >
                                            <option value="Asset">Asset</option>
                                            <option value="Liability">Liability</option>
                                            <option value="Equity">Equity</option>
                                            <option value="Revenue">Revenue</option>
                                            <option value="Expense">Expense</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Current Assets"
                                            value={newAccount.category}
                                            onChange={e => setNewAccount({...newAccount, category: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md">
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: New Journal Entry */}
            {isJournalModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        <form onSubmit={handleSaveJournal}>
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Post Double-Entry Journal</h3>
                                    <p className="text-xs text-slate-400 font-medium">Debits must equal Credits.</p>
                                </div>
                                <button type="button" onClick={() => setIsJournalModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reference</label>
                                        <input 
                                            type="text" 
                                            value={newJournal.reference}
                                            onChange={e => setNewJournal({...newJournal, reference: e.target.value})}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Entry Date</label>
                                        <input 
                                            type="date" 
                                            value={newJournal.date}
                                            onChange={e => setNewJournal({...newJournal, date: e.target.value})}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Memo / Description</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Monthly store utility settlement"
                                        value={newJournal.description}
                                        onChange={e => setNewJournal({...newJournal, description: e.target.value})}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        required
                                    />
                                </div>

                                <div className="space-y-3 pt-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal Lines</p>
                                    {newJournal.lines.map((line, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                            <div className="col-span-6">
                                                <select
                                                    value={line.accountId}
                                                    onChange={e => {
                                                        const updated = [...newJournal.lines];
                                                        updated[idx].accountId = e.target.value;
                                                        setNewJournal({...newJournal, lines: updated});
                                                    }}
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                                    required
                                                >
                                                    <option value="">Select Account</option>
                                                    {accounts.map(a => (
                                                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.type})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number"
                                                    placeholder="Debit (0.00)"
                                                    value={line.debit || ''}
                                                    onChange={e => {
                                                        const updated = [...newJournal.lines];
                                                        updated[idx].debit = parseFloat(e.target.value) || 0;
                                                        if (updated[idx].debit > 0) updated[idx].credit = 0;
                                                        setNewJournal({...newJournal, lines: updated});
                                                    }}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number"
                                                    placeholder="Credit (0.00)"
                                                    value={line.credit || ''}
                                                    onChange={e => {
                                                        const updated = [...newJournal.lines];
                                                        updated[idx].credit = parseFloat(e.target.value) || 0;
                                                        if (updated[idx].credit > 0) updated[idx].debit = 0;
                                                        setNewJournal({...newJournal, lines: updated});
                                                    }}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button 
                                        type="button"
                                        onClick={() => setNewJournal({
                                            ...newJournal, 
                                            lines: [...newJournal.lines, { accountId: 0, debit: 0, credit: 0 }]
                                        })}
                                        className="text-xs font-bold text-blue-600 hover:underline pt-1"
                                    >
                                        + Add Line
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-600">
                                    Debits: {newJournal.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)} | 
                                    Credits: {newJournal.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsJournalModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md">
                                        Post Journal
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Record Expense */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <form onSubmit={handleSaveExpense}>
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900">Record Operational Expense</h3>
                                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Expense Title</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Retail Stall Electricity Bill"
                                        value={newExpense.title}
                                        onChange={e => setNewExpense({...newExpense, title: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                        <select 
                                            value={newExpense.category}
                                            onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        >
                                            <option value="Rent">Store Rent</option>
                                            <option value="Utilities">Electricity & Utilities</option>
                                            <option value="Wages">Wages & Casual Labor</option>
                                            <option value="Logistics">Transport & Fuel</option>
                                            <option value="Packaging">Packaging & Supplies</option>
                                            <option value="Licensing">Licenses & Permits</option>
                                            <option value="Marketing">Marketing & Ads</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount</label>
                                        <input 
                                            type="number"
                                            placeholder="0.00"
                                            value={newExpense.amount}
                                            onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Paid From</label>
                                        <select 
                                            value={newExpense.paidFrom}
                                            onChange={e => setNewExpense({...newExpense, paidFrom: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        >
                                            <option value="1001">Cash Drawer (1001)</option>
                                            <option value="1003">M-Pesa Till (1003)</option>
                                            <option value="1002">KCB Bank (1002)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payee / Vendor</label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. Kenya Power"
                                            value={newExpense.payee}
                                            onChange={e => setNewExpense({...newExpense, payee: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-md">
                                    Post Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Transfer Funds */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <form onSubmit={handleSaveTransfer}>
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900">Transfer & Sweep Funds</h3>
                                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From Account</label>
                                    <select 
                                        value={newTransfer.fromAccountId}
                                        onChange={e => setNewTransfer({...newTransfer, fromAccountId: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    >
                                        <option value="1001">Main Cash Drawer (1001)</option>
                                        <option value="1003">M-Pesa Business Till (1003)</option>
                                        <option value="1002">KCB Business Checking (1002)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To Account</label>
                                    <select 
                                        value={newTransfer.toAccountId}
                                        onChange={e => setNewTransfer({...newTransfer, toAccountId: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    >
                                        <option value="1002">KCB Business Checking (1002)</option>
                                        <option value="1001">Main Cash Drawer (1001)</option>
                                        <option value="1003">M-Pesa Business Till (1003)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Transfer Amount</label>
                                    <input 
                                        type="number"
                                        placeholder="0.00"
                                        value={newTransfer.amount}
                                        onChange={e => setNewTransfer({...newTransfer, amount: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Transfer Memo</label>
                                    <input 
                                        type="text"
                                        value={newTransfer.note}
                                        onChange={e => setNewTransfer({...newTransfer, note: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md">
                                    Execute Transfer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

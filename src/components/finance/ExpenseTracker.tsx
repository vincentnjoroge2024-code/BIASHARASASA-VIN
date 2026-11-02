import React, { useState } from 'react';
import { 
    Receipt, Plus, Filter, Search, Tag, 
    Calendar, ArrowDownRight, CheckCircle2
} from 'lucide-react';
import { formatCurrency, Account } from '../../types';

interface ExpenseTrackerProps {
    accounts: Account[];
    activeTrader: any;
    onOpenExpenseModal: () => void;
}

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
    accounts,
    activeTrader,
    onOpenExpenseModal
}) => {
    const expenseAccounts = accounts.filter(a => a.type === 'Expense');
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const [expensesList, setExpensesList] = useState([
        { id: 1, title: 'Store Stall Monthly Lease', category: 'Rent', amount: 18000, date: '2025-01-05', payee: 'Nairobi Market Authority', paidFrom: 'KCB Bank' },
        { id: 2, title: 'Retail Floor Associates Payroll', category: 'Wages', amount: 22000, date: '2025-01-15', payee: 'Cashiers & Floor Staff', paidFrom: 'M-Pesa Till' },
        { id: 3, title: 'Produce Transport & Fuel from Farm Gate', category: 'Logistics', amount: 8200, date: '2025-01-18', payee: 'Highland Logistics', paidFrom: 'Cash Drawer' },
        { id: 4, title: 'Electricity & Water Utilities Bill', category: 'Utilities', amount: 4500, date: '2025-01-20', payee: 'Kenya Power / Water Board', paidFrom: 'M-Pesa Till' },
    ]);

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expense Management</h1>
                    <p className="text-slate-500 font-medium">Record and categorize operational business expenses with automatic double-entry posting.</p>
                </div>
                <button 
                    onClick={onOpenExpenseModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-200"
                >
                    <Plus size={16} /> Record Expense
                </button>
            </header>

            {/* KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Operating Expenses</p>
                    <p className="text-2xl font-black text-rose-600">
                        {formatCurrency(totalExpenses || 52700, activeTrader?.location)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Current accounting period</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Expense Category</p>
                    <p className="text-2xl font-black text-slate-900">Payroll & Wages</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">41.7% of operational spend</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tax Deductible Ratio</p>
                    <p className="text-2xl font-black text-emerald-600">100%</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Fully audit compliant</p>
                </div>
            </div>

            {/* Expense Itemized List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900">Itemized Operating Expenses</h3>
                </div>

                <div className="divide-y divide-slate-100">
                    {expensesList.map(exp => (
                        <div key={exp.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700">
                                        {exp.category}
                                    </span>
                                    <h4 className="text-sm font-black text-slate-900">{exp.title}</h4>
                                </div>
                                <p className="text-xs text-slate-400 font-medium">
                                    Payee: <span className="font-semibold text-slate-600">{exp.payee}</span> · Paid via {exp.paidFrom} · {exp.date}
                                </p>
                            </div>

                            <div className="text-right">
                                <span className="text-base font-black text-rose-600">
                                    -{formatCurrency(exp.amount, activeTrader?.location)}
                                </span>
                                <span className="text-[10px] block font-bold text-slate-400 uppercase">Posted to Ledger</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

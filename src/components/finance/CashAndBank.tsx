import React, { useState } from 'react';
import { 
    Wallet, Banknote, Smartphone, ArrowRightLeft, 
    TrendingUp, ShieldCheck, CheckCircle2, Plus
} from 'lucide-react';
import { formatCurrency, Account } from '../../types';

interface CashAndBankProps {
    accounts: Account[];
    activeTrader: any;
    onOpenTransferModal: () => void;
}

export const CashAndBank: React.FC<CashAndBankProps> = ({
    accounts,
    activeTrader,
    onOpenTransferModal
}) => {
    const cashDrawer = accounts.find(a => a.code === '1001') || { balance: 45000, name: 'Main Cash Drawer', code: '1001' };
    const bankAccount = accounts.find(a => a.code === '1002') || { balance: 185000, name: 'KCB Business Checking', code: '1002' };
    const tillAccount = accounts.find(a => a.code === '1003') || { balance: 72400, name: 'M-Pesa Business Till', code: '1003' };

    const totalLiquidity = (cashDrawer.balance || 0) + (bankAccount.balance || 0) + (tillAccount.balance || 0);

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cash & Bank Liquidity</h1>
                    <p className="text-slate-500 font-medium">Manage treasury balances across POS tills, mobile money wallets, and commercial bank accounts.</p>
                </div>
                <button 
                    onClick={onOpenTransferModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-200"
                >
                    <ArrowRightLeft size={16} /> Transfer / Sweep Funds
                </button>
            </header>

            {/* Total Liquidity Banner */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Consolidated Liquid Reserves</span>
                        <h2 className="text-4xl font-black tracking-tight mt-1">{formatCurrency(totalLiquidity, activeTrader?.location)}</h2>
                        <p className="text-slate-400 text-xs mt-2 font-medium">Instant availability for supplier settlement and payroll.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                            <span className="text-sm font-black text-emerald-400 flex items-center gap-1 mt-0.5">
                                <CheckCircle2 size={14} /> Reconciled
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dedicated Account Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Banknote size={24} />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-400">Code: 1001</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900">{cashDrawer.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Physical cash register drawer on sales floor</p>
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold uppercase">Balance</span>
                        <span className="text-xl font-black text-slate-900">{formatCurrency(cashDrawer.balance || 0, activeTrader?.location)}</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Smartphone size={24} />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-400">Code: 1003</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900">{tillAccount.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Merchant Buy Goods Till 784920</p>
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold uppercase">Balance</span>
                        <span className="text-xl font-black text-slate-900">{formatCurrency(tillAccount.balance || 0, activeTrader?.location)}</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Wallet size={24} />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-400">Code: 1002</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900">{bankAccount.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Commercial Checking Account for settlements</p>
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold uppercase">Balance</span>
                        <span className="text-xl font-black text-slate-900">{formatCurrency(bankAccount.balance || 0, activeTrader?.location)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

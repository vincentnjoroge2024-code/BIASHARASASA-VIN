import React, { useState } from 'react';
import { 
    Settings, ShieldCheck, Lock, Globe, 
    Download, RefreshCw, CheckCircle2
} from 'lucide-react';
import { useAppContext } from '../../context';

interface FinanceSettingsProps {
    activeTrader: any;
    onResetDefaults: () => void;
}

export const FinanceSettings: React.FC<FinanceSettingsProps> = ({
    activeTrader,
    onResetDefaults
}) => {
    const { showToast } = useAppContext();
    const [fiscalYear, setFiscalYear] = useState('2025');
    const [currency, setCurrency] = useState('KES');
    const [lockDate, setLockDate] = useState('2024-12-31');
    const [enforceDoubleEntry, setEnforceDoubleEntry] = useState(true);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        showToast("Finance settings saved successfully", "success");
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <header>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Finance & Ledger Settings</h1>
                <p className="text-slate-500 font-medium">Configure accounting policies, fiscal year calendar, lock dates, and ledger controls.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-lg font-black text-slate-900">Accounting Policies</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Reporting Currency</label>
                            <select 
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                            >
                                <option value="KES">KES - Kenyan Shilling (KSh)</option>
                                <option value="USD">USD - US Dollar ($)</option>
                                <option value="UGX">UGX - Ugandan Shilling (USh)</option>
                                <option value="TZS">TZS - Tanzanian Shilling (TSh)</option>
                                <option value="EUR">EUR - Euro (€)</option>
                                <option value="GBP">GBP - British Pound (£)</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Fiscal Year</label>
                            <input 
                                type="text"
                                value={fiscalYear}
                                onChange={e => setFiscalYear(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Lock Date</label>
                        <input 
                            type="date"
                            value={lockDate}
                            onChange={e => setLockDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        />
                        <p className="text-[11px] text-slate-400">Transactions prior to this date cannot be modified without auditor authorization.</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-black text-slate-900">Strict Double-Entry Enforcement</p>
                            <p className="text-xs text-slate-500 font-medium">Require every journal entry to have balanced debits and credits.</p>
                        </div>
                        <input 
                            type="checkbox"
                            checked={enforceDoubleEntry}
                            onChange={e => setEnforceDoubleEntry(e.target.checked)}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={onResetDefaults}
                        className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
                    >
                        Restore Default Chart of Accounts
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-200"
                    >
                        Save Configuration
                    </button>
                </div>
            </form>
        </div>
    );
};

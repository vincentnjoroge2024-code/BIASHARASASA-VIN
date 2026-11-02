import React, { useState } from 'react';
import { Printer, Check, X, Scissors, Layers, Sliders, Zap, CheckCircle2 } from 'lucide-react';
import { PrinterSettings, ThermalPrinterModel } from '../types';
import { 
    THERMAL_PRINTER_PROFILES, 
    getStoredPrinterSettings, 
    saveStoredPrinterSettings, 
    generateTestReceipt,
    applyDynamicPrintStyles
} from '../utils/thermalPrinter';
import { useAppContext } from '../context';
import * as api from '../api';

interface PrinterSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRunTestPrint?: (model: ThermalPrinterModel) => void;
}

export const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({
    isOpen,
    onClose,
    onRunTestPrint
}) => {
    const { user, showToast } = useAppContext();
    const [settings, setSettings] = useState<PrinterSettings>(getStoredPrinterSettings());
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleModelChange = (model: ThermalPrinterModel) => {
        const is80 = model === 'premax_pos80c';
        const is58 = model === 'pos_58';
        setSettings(prev => ({
            ...prev,
            model,
            paperWidth: is80 ? '80mm' : is58 ? '58mm' : 'a4',
            autoCutter: is80 ? true : false,
            printerName: THERMAL_PRINTER_PROFILES[model].name
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            saveStoredPrinterSettings(settings);
            if (user?.traderId) {
                await api.saveTraderPrinterSettings(user.traderId, settings).catch(() => {});
            }
            showToast(`Thermal printer configured: ${THERMAL_PRINTER_PROFILES[settings.model].name}`, 'success');
            onClose();
        } catch (e: any) {
            showToast(e.message || 'Failed to save printer settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestPrint = (model: ThermalPrinterModel) => {
        saveStoredPrinterSettings({ ...settings, model });
        applyDynamicPrintStyles(model);
        if (onRunTestPrint) {
            onRunTestPrint(model);
        } else {
            showToast(`Generated test receipt for ${THERMAL_PRINTER_PROFILES[model].name}`, 'info');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden text-white flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-[#6366f1] border border-[#6366f1]/30 flex items-center justify-center shadow-md">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                                Thermal Printer Hardware Hub
                            </h2>
                            <p className="text-xs text-slate-400">
                                Premax POS-80C & POS-58 Driver Calibration
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    
                    {/* Primary Model Selection */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                            <Sliders size={13} className="text-[#6366f1]" />
                            Select Active Thermal Receipt Printer Model
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            
                            {/* Premax POS-80C Card */}
                            <div 
                                onClick={() => handleModelChange('premax_pos80c')}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                                    settings.model === 'premax_pos80c'
                                        ? 'bg-emerald-950/30 border-emerald-500 shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/20'
                                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                {settings.model === 'premax_pos80c' && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-black text-white">Premax POS-80C</span>
                                        <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                            80mm Roll
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-snug">
                                        High-speed thermal printer with auto guillotine paper cutter & cash drawer kick.
                                    </p>
                                </div>
                                <div className="space-y-1 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                                    <div className="flex justify-between">
                                        <span>Paper Width:</span>
                                        <span className="text-emerald-400 font-bold">80mm (72mm print)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Columns:</span>
                                        <span className="text-slate-200">48 Columns</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Auto Cutter:</span>
                                        <span className="text-emerald-400 font-bold">✓ Hardware Supported</span>
                                    </div>
                                </div>
                            </div>

                            {/* POS 58 Card */}
                            <div 
                                onClick={() => handleModelChange('pos_58')}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                                    settings.model === 'pos_58'
                                        ? 'bg-indigo-950/40 border-[#6366f1] shadow-lg shadow-indigo-900/20 ring-2 ring-[#6366f1]/20'
                                        : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                {settings.model === 'pos_58' && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-[#6366f1] text-white rounded-full flex items-center justify-center shadow">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-black text-white">POS-58 Series</span>
                                        <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                                            58mm Roll
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-snug">
                                        Compact 58mm mobile/desktop thermal printer with serrated tear-bar.
                                    </p>
                                </div>
                                <div className="space-y-1 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
                                    <div className="flex justify-between">
                                        <span>Paper Width:</span>
                                        <span className="text-indigo-400 font-bold">58mm (48mm print)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Columns:</span>
                                        <span className="text-slate-200">32 Columns</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Paper Cut:</span>
                                        <span className="text-amber-400 font-bold">Manual Tear-Bar</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Hardware Capabilities & Flags */}
                    <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/80 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                            <Zap size={14} className="text-amber-400" />
                            Hardware Feature Toggles
                        </h4>

                        <div className="space-y-2.5">
                            {/* Auto Cutter */}
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-700/40 transition">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                        <Scissors size={14} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">
                                            Premax POS-80C Auto Guillotine Cutter
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            Emits ESC/POS GS V 66 command for automatic receipt cut feed
                                        </span>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={settings.autoCutter}
                                    onChange={(e) => setSettings(prev => ({ ...prev, autoCutter: e.target.checked }))}
                                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                                />
                            </label>

                            {/* Cash Drawer Kick */}
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-700/40 transition">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                        <Layers size={14} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">
                                            RJ11 / RJ12 Cash Drawer Kickout Pulse
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            Sends standard 24V/12V pulse to open till drawer automatically
                                        </span>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={settings.cashDrawerKick}
                                    onChange={(e) => setSettings(prev => ({ ...prev, cashDrawerKick: e.target.checked }))}
                                    className="w-4 h-4 accent-[#6366f1] rounded cursor-pointer"
                                />
                            </label>

                            {/* Auto Print Toggle */}
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-700/40 transition">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                        <Printer size={14} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">
                                            Auto-Print Receipt on Checkout
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            Skip the print dialog and send directly to printer after sale
                                        </span>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={settings.autoPrintOnSale}
                                    onChange={(e) => setSettings(prev => ({ ...prev, autoPrintOnSale: e.target.checked }))}
                                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                                />
                            </label>

                            {/* Open Drawer on Sale */}
                            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-700/40 transition">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                        <Zap size={14} />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-200 block">
                                            Open Drawer on Every Sale
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            Automatically kick the drawer even if receipt printing is skipped
                                        </span>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={settings.openDrawerOnSale}
                                    onChange={(e) => setSettings(prev => ({ ...prev, openDrawerOnSale: e.target.checked }))}
                                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Instant Test Print Calibration Actions */}
                    <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Instant Hardware Test Prints
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 size={12} /> Ready for Test
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => handleTestPrint('premax_pos80c')}
                                className="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Printer size={14} />
                                <span>Test Premax POS-80C</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTestPrint('pos_58')}
                                className="px-3 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Printer size={14} />
                                <span>Test POS-58</span>
                            </button>
                        </div>
                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <Check size={16} />
                        <span>{isSaving ? 'Saving...' : 'Activate & Save Settings'}</span>
                    </button>
                </div>

            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { AlertTriangle, Check, RefreshCw, X, ShieldAlert, ArrowRight, Laptop, Cloud, Layers, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context';

export interface DataConflict {
    id: string;
    entityType: 'Inventory Item' | 'Purchase Order' | 'Sales Record' | 'Customer Account';
    entityName: string;
    skuOrRef: string;
    lastLocalEditTime: string;
    lastServerEditTime: string;
    localAuthor: string;
    serverAuthor: string;
    fields: {
        fieldName: string;
        label: string;
        localValue: string | number;
        serverValue: string | number;
        isConflicting: boolean;
    }[];
}

export interface ConflictResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    conflict?: DataConflict | null;
    onResolve?: (winningVersion: 'local' | 'server' | 'merged', mergedData?: Record<string, any>) => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
    isOpen,
    onClose,
    conflict,
    onResolve
}) => {
    const { showToast, logAuditAction } = useAppContext();

    if (!isOpen || !conflict) return null;

    // Track chosen field values for merge resolution
    const [selectedFields, setSelectedFields] = useState<Record<string, 'local' | 'server'>>(() => {
        const initial: Record<string, 'local' | 'server'> = {};
        conflict.fields.forEach(f => {
            initial[f.fieldName] = 'local';
        });
        return initial;
    });

    const toggleFieldChoice = (fieldName: string, choice: 'local' | 'server') => {
        setSelectedFields(prev => ({
            ...prev,
            [fieldName]: choice
        }));
    };

    const handleApplyResolution = (mode: 'local' | 'server' | 'merged') => {
        let finalValues: Record<string, any> = {};
        
        if (mode === 'local') {
            conflict.fields.forEach(f => { finalValues[f.fieldName] = f.localValue; });
            showToast(`Resolved collision for ${conflict.entityName}: Kept Local Device Version`, 'success');
        } else if (mode === 'server') {
            conflict.fields.forEach(f => { finalValues[f.fieldName] = f.serverValue; });
            showToast(`Resolved collision for ${conflict.entityName}: Accepted Cloud Server Version`, 'info');
        } else {
            conflict.fields.forEach(f => {
                const choice = selectedFields[f.fieldName] || 'local';
                finalValues[f.fieldName] = choice === 'local' ? f.localValue : f.serverValue;
            });
            showToast(`Resolved collision for ${conflict.entityName}: Custom Merged Version Applied`, 'success');
        }

        logAuditAction('Sync Data Conflict Resolved', {
            conflictId: conflict.id,
            entityType: conflict.entityType,
            entityName: conflict.entityName,
            resolutionMode: mode,
            appliedValues: finalValues
        }, 'warning');

        if (onResolve) {
            onResolve(mode, finalValues);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                
                {/* Warning Header */}
                <div className="p-4 sm:p-5 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-950 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg">
                            <ShieldAlert size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black uppercase tracking-wider">Sync Data Collision Detected</h3>
                                <span className="bg-slate-950 text-amber-400 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                                    Action Required
                                </span>
                            </div>
                            <p className="text-xs text-slate-900 font-medium">
                                Concurrent modifications found during background synchronization. Please resolve conflicts below.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-900 hover:bg-amber-600/20 rounded-xl transition cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Conflict Target Badge */}
                <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between border-b border-slate-800">
                    <div>
                        <span className="text-[10px] text-amber-400 font-mono uppercase font-bold tracking-widest block">
                            Target Entity: {conflict.entityType}
                        </span>
                        <h2 className="text-lg font-black text-white tracking-tight">{conflict.entityName}</h2>
                        <span className="text-xs font-mono text-slate-400">REF/SKU: {conflict.skuOrRef}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Collision ID</span>
                        <span className="text-xs font-mono font-bold text-slate-200">{conflict.id}</span>
                    </div>
                </div>

                {/* Side-by-Side Comparison Container */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
                    
                    {/* Header Columns */}
                    <div className="grid grid-cols-2 gap-4">
                        
                        {/* Local Version Header Card */}
                        <div className="bg-blue-50/80 border-2 border-blue-200 rounded-2xl p-4 relative shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-blue-900 font-black text-xs uppercase tracking-wider">
                                    <Laptop size={16} className="text-blue-600" /> Local Device Version
                                </div>
                                <span className="bg-blue-600 text-white text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                                    Offline Queue
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium">Edited: <span className="font-bold text-slate-800">{conflict.lastLocalEditTime}</span></p>
                            <p className="text-[11px] text-slate-500">Author: <span className="font-semibold text-slate-700">{conflict.localAuthor}</span></p>
                            <button
                                onClick={() => handleApplyResolution('local')}
                                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Check size={14} /> Keep Local Version Entirely
                            </button>
                        </div>

                        {/* Server Version Header Card */}
                        <div className="bg-purple-50/80 border-2 border-purple-200 rounded-2xl p-4 relative shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-purple-900 font-black text-xs uppercase tracking-wider">
                                    <Cloud size={16} className="text-purple-600" /> Cloud Server Version
                                </div>
                                <span className="bg-purple-600 text-white text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                                    Central DB
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium">Edited: <span className="font-bold text-slate-800">{conflict.lastServerEditTime}</span></p>
                            <p className="text-[11px] text-slate-500">Author: <span className="font-semibold text-slate-700">{conflict.serverAuthor}</span></p>
                            <button
                                onClick={() => handleApplyResolution('server')}
                                className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Check size={14} /> Keep Server Version Entirely
                            </button>
                        </div>

                    </div>

                    {/* Field Level Inspection Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Layers size={14} /> Field-by-Field Collision Breakdown
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold">Click value to toggle choice for custom merge</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {conflict.fields.map(field => {
                                const currentChoice = selectedFields[field.fieldName] || 'local';
                                return (
                                    <div key={field.fieldName} className={`p-3 sm:p-4 grid grid-cols-12 gap-3 items-center ${field.isConflicting ? 'bg-amber-50/40' : 'bg-white'}`}>
                                        
                                        {/* Field Label */}
                                        <div className="col-span-4">
                                            <span className="text-xs font-bold text-slate-900 block">{field.label}</span>
                                            {field.isConflicting ? (
                                                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                                    Mismatch
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-slate-400 font-medium inline-block mt-0.5">Matching</span>
                                            )}
                                        </div>

                                        {/* Local Value Column */}
                                        <div className="col-span-4">
                                            <button
                                                onClick={() => toggleFieldChoice(field.fieldName, 'local')}
                                                className={`w-full p-2.5 rounded-xl border text-left text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                                                    currentChoice === 'local'
                                                        ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-sm'
                                                        : 'bg-slate-50 hover:bg-blue-50 text-slate-800 border-slate-200'
                                                }`}
                                            >
                                                <span className="truncate">{String(field.localValue)}</span>
                                                {currentChoice === 'local' && <CheckCircle2 size={14} className="shrink-0 text-white" />}
                                            </button>
                                        </div>

                                        {/* Server Value Column */}
                                        <div className="col-span-4">
                                            <button
                                                onClick={() => toggleFieldChoice(field.fieldName, 'server')}
                                                className={`w-full p-2.5 rounded-xl border text-left text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                                                    currentChoice === 'server'
                                                        ? 'bg-purple-600 text-white border-purple-700 font-bold shadow-sm'
                                                        : 'bg-slate-50 hover:bg-purple-50 text-slate-800 border-slate-200'
                                                }`}
                                            >
                                                <span className="truncate">{String(field.serverValue)}</span>
                                                {currentChoice === 'server' && <CheckCircle2 size={14} className="shrink-0 text-white" />}
                                            </button>
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Footer Modal Controls */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800">
                    <span className="text-xs text-slate-400 font-mono font-medium">
                        Select individual fields above to build a custom merged record.
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                            Cancel & Postpone
                        </button>
                        <button
                            onClick={() => handleApplyResolution('merged')}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center gap-2 cursor-pointer"
                        >
                            <Check size={16} /> Apply Custom Merged Version
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

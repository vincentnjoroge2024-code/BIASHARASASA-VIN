import React from 'react';
import { useAppContext } from '../context';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const Toast: React.FC = () => {
    const { toast } = useAppContext();

    if (!toast) return null;

    const getStyles = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-emerald-600 text-white shadow-emerald-500/20';
            case 'error':
                return 'bg-red-600 text-white shadow-red-500/20';
            case 'warning':
                return 'bg-amber-500 text-white shadow-amber-500/20';
            case 'info':
            default:
                return 'bg-slate-900 text-white shadow-slate-900/20';
        }
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle2 size={18} />;
            case 'error':
                return <AlertCircle size={18} />;
            case 'warning':
                return <AlertTriangle size={18} />;
            case 'info':
            default:
                return <Info size={18} />;
        }
    };

    return (
        <div 
            className={`fixed bottom-8 right-8 ${getStyles()} px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-[100] min-w-[280px] border border-white/10 transition-all duration-300 transform animate-in fade-in slide-in-from-bottom-4`}
        >
            <div className="flex-shrink-0">
                {getIcon()}
            </div>
            <p className="flex-grow text-sm font-medium">{toast.message}</p>
        </div>
    );
};

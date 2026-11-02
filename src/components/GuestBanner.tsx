import React from 'react';
import { Zap, ArrowRight, UserPlus } from 'lucide-react';
import { useAppContext } from '../context';

interface GuestBannerProps {
    activeTab: string;
    onNavigate: (tab: string) => void;
}

export const GuestBanner: React.FC<GuestBannerProps> = ({ activeTab, onNavigate }) => {
    const { user, setUser } = useAppContext();
    const isGuest = user?.username === 'Guest Client';

    if (!isGuest) return null;

    const getInstruction = () => {
        switch (activeTab) {
            case 'tour': return "Welcome! Start your tour by launching the POS terminal.";
            case 'pos': return "Try scanning a barcode or adding a manual item to the cart.";
            case 'inventory': return "Check how stock levels react to your test sales.";
            case 'reports': return "Visualize the impact of your demo transactions here.";
            default: return "Explore the hybrid power of Biasharasasa!";
        }
    };

    const getNextStep = () => {
        switch (activeTab) {
            case 'tour': return { tab: 'pos', label: 'Go to POS' };
            case 'pos': return { tab: 'inventory', label: 'Check Stock' };
            case 'inventory': return { tab: 'reports', label: 'View Analytics' };
            default: return { tab: 'tour', label: 'Back to Tour' };
        }
    };

    const next = getNextStep();

    return (
        <div 
            className="fixed top-0 left-0 right-0 z-[60] bg-slate-900 text-white border-b border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300"
        >
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20">
                        <Zap size={14} className="text-white animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Guest Mode</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/20 hidden md:block" />
                    <p className="text-xs md:text-sm font-medium text-slate-300">
                        <span className="text-white font-bold">Instruction:</span> {getInstruction()}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => onNavigate(next.tab)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10 group cursor-pointer"
                    >
                        {next.label} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button 
                        onClick={() => setUser(null)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                    >
                        <UserPlus size={14} /> Finish & Register
                    </button>
                </div>
            </div>
        </div>
    );
};

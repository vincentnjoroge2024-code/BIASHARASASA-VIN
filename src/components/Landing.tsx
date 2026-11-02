import React from 'react';
import { LogoSVG } from './Logo';
import { Key, Rocket, ArrowRight, ShieldCheck, Zap, Globe, LayoutDashboard, Database } from 'lucide-react';

interface LandingProps {
    onLogin: () => void;
    onTour: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onLogin, onTour }) => {
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto px-4 py-8 bg-[#0a0f1d]">
            {/* Technical Background Layer */}
            <div 
                className="absolute inset-0 z-0 opacity-60 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url("/currency_bg.jpg")' }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1d]/80 via-transparent to-[#0a0f1d]"></div>
            </div>
            
            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <div className="transition-transform duration-700 hover:scale-105">
                            <LogoSVG className="w-24 h-24 shadow-2xl rounded-2xl" />
                        </div>
                    </div>
                    <h1 className="text-6xl font-black text-white tracking-tighter mb-4 drop-shadow-2xl">
                        BIASHARASASA
                    </h1>
                    <p className="text-xl text-blue-200/80 font-medium max-w-2xl mx-auto leading-relaxed">
                        The ultimate cloud-first Point of Sale & Global Inventory ecosystem. 
                        Empowering modern merchants with real-time analytics and seamless scalability.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                    {/* Login Option */}
                    <button
                        onClick={onLogin}
                        className="group relative bg-white rounded-3xl p-8 text-left shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] cursor-pointer overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Key size={120} />
                        </div>
                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Key size={28} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Merchant Sign In</h3>
                        <p className="text-slate-500 mb-8 leading-relaxed">
                            Access your dedicated merchant dashboard, manage live inventory, and process real-time sales.
                        </p>
                        <div className="flex items-center gap-2 text-blue-600 font-bold">
                            <span>Continue to Login</span>
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* Free Tour Option */}
                    <button
                        onClick={onTour}
                        className="group relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-left shadow-[0_20px_50px_rgba(0,115,207,0.3)] border border-blue-400/30 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] cursor-pointer overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-white">
                            <Rocket size={120} />
                        </div>
                        <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm group-hover:bg-white group-hover:text-blue-600 transition-colors">
                            <Rocket size={28} />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2">Take a Free Tour</h3>
                        <p className="text-blue-100/80 mb-8 leading-relaxed">
                            Explore all modules using our high-fidelity sandbox environment. No registration required.
                        </p>
                        <div className="flex items-center gap-2 text-white font-bold">
                            <span>Explore Demo App</span>
                            <Zap size={18} className="animate-pulse" />
                        </div>
                    </button>
                </div>

                {/* Features Bar */}
                <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-blue-200/50">
                    <div className="flex flex-col items-center gap-2">
                        <ShieldCheck size={20} />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black">Secure Ledger</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Globe size={20} />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black">Global Access</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <LayoutDashboard size={20} />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black">Live Analytics</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Database size={20} />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black">Offline Ready</span>
                    </div>
                </div>

                <div className="mt-12 text-blue-200/30 text-xs font-bold uppercase tracking-widest">
                    Version 2.5.0 • Powered by PrimeAxis Systems
                </div>
            </div>
        </div>
    );
};

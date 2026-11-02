import React from 'react';
import { motion } from 'motion/react';
import { useAppContext } from '../../context';
import { 
    ShoppingCart, Package, BarChart2, ShieldCheck, Globe, Zap, Users, Crown, 
    Smartphone, Database, Landmark, CheckCircle2, ArrowRight, Factory, Store, Building2, LayoutDashboard 
} from 'lucide-react';

interface TourTabProps {
    onNavigate: (tab: string) => void;
}

export const TourTab: React.FC<TourTabProps> = ({ onNavigate }) => {
    const { user, t } = useAppContext();
    const isGuest = user?.username === 'Guest Client';

    // Front Office modules: operations, sales register, inventory, production workshop
    const frontOfficeFeatures = [
        {
            id: 'pos',
            title: "Point of Sale (POS)",
            group: "Front Office",
            description: "High-speed transaction processing with offline capabilities. Scan barcodes, manage discounts, and print professional receipts instantly.",
            icon: ShoppingCart,
            color: "bg-blue-600",
            image: "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&q=80&w=800"
        },
        {
            id: 'inventory',
            title: "Smart Inventory",
            group: "Front Office",
            description: "Real-time stock tracking with configurable low-stock threshold alerts, category grouping, and 30-day stock movement analytics.",
            icon: Package,
            color: "bg-emerald-600",
            image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800"
        },
        {
            id: 'production',
            title: "Production Workshop",
            group: "Front Office",
            description: "Batch recipe production management, ingredient consumption logging, and automated finished goods stock replenishment.",
            icon: Factory,
            color: "bg-amber-600",
            image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800"
        },
        {
            id: 'traders',
            title: "Storefront Operations",
            group: "Front Office",
            description: "Floor operations management, station cashier assignments, vendor reorders, and real-time storefront sales analytics.",
            icon: LayoutDashboard,
            color: "bg-teal-600",
            image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800"
        }
    ];

    // Back Office modules: finance, taxes, reports, merchant management
    // Note: System Admin and Audit Log modules are strictly removed from the Free Tour!
    const backOfficeFeatures = [
        {
            id: 'finance',
            title: "Finance & Ledger",
            group: "Back Office",
            description: "Triple-entry automated business accounting. Real-time balance sheets, automated debit/credit journals, and reconciliation.",
            icon: Landmark,
            color: "bg-purple-600",
            image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800"
        },
        {
            id: 'tax',
            title: "Tax Compliance",
            group: "Back Office",
            description: "Automated KRA/ETR regulatory reporting, live VAT calculations, cryptographic receipt signatures, and tax filing exports.",
            icon: ShieldCheck,
            color: "bg-blue-700",
            image: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=800"
        },
        {
            id: 'reports',
            title: "Advanced Analytics",
            group: "Back Office",
            description: "Detailed sales reports and performance metrics. Visualize business revenue streams with interactive charts and growth insights.",
            icon: BarChart2,
            color: "bg-indigo-600",
            image: "https://images.unsplash.com/photo-1551288049-bbda48658a7d?auto=format&fit=crop&q=80&w=800"
        },
        {
            id: 'traders',
            title: "Traders Hub & Branches",
            group: "Back Office",
            description: "Synchronize multiple branches seamlessly. Manage distributor merchants, subscription tiers, and regional pricing regimes.",
            icon: Users,
            color: "bg-emerald-700",
            image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800"
        }
    ];

    const stats = [
        { label: "Uptime", value: "99.9%", icon: Zap },
        { label: "Security", value: "AES-256", icon: ShieldCheck },
        { label: "Support", value: "24/7", icon: Users },
        { label: "Scale", value: "Unlimited", icon: Crown }
    ];

    return (
        <div className="p-4 md:p-8 space-y-12 max-w-7xl mx-auto pb-20">
            {/* Hero Section */}
            <header className="text-center space-y-4 max-w-3xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider"
                >
                    <Crown size={14} /> Free Tour & Feature Showcase
                </motion.div>
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight"
                >
                    {t('tour_title')}
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg text-slate-600 leading-relaxed"
                >
                    {t('tour_subtitle')}
                </motion.p>
            </header>

            {/* Interactive Simulation Highlight */}
            {isGuest && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="relative p-8 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden shadow-2xl shadow-blue-500/20"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-48 -mt-48" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl -ml-32 -mb-32" />
                    
                    <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
                        <div className="flex-1 space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30">
                                <Zap size={14} className="fill-current" /> {t('tour_simulation_mode')}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
                                {t('tour_simulation_title')}
                            </h2>
                            <p className="text-blue-100/90 text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                                {t('tour_simulation_desc')}
                            </p>
                            <button 
                                onClick={() => onNavigate('pos')}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-105 active:scale-95 transition-all group"
                            >
                                {t('tour_start_pos_demo')} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <div className="w-full lg:w-1/2 grid grid-cols-2 gap-4">
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 space-y-2">
                                <div className="text-2xl">⚡</div>
                                <h4 className="font-bold text-sm">Real-time Data</h4>
                                <p className="text-[10px] text-blue-100/70">Observe instant stock updates as you ring up items.</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 space-y-2">
                                <div className="text-2xl">🧾</div>
                                <h4 className="font-bold text-sm">Compliant Receipts</h4>
                                <h5 className="text-[10px] text-blue-100/70">Generate simulated KRA/ETR compliant tax invoices.</h5>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 space-y-2">
                                <div className="text-2xl">🔄</div>
                                <h4 className="font-bold text-sm">Hybrid Sync</h4>
                                <h5 className="text-[10px] text-blue-100/70">Test offline mode by completing sales without a server.</h5>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 space-y-2">
                                <div className="text-2xl">📊</div>
                                <h4 className="font-bold text-sm">Instant Reports</h4>
                                <h5 className="text-[10px] text-blue-100/70">View your demo sales immediately in the Analytics hub.</h5>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Quick Start Guide */}
            <section className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-start gap-12">
                    <div className="flex-1 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <ShieldCheck size={12} /> Guest Mode Instructions
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 leading-tight">
                            How to use your <span className="text-blue-600">Guest Access</span>
                        </h2>
                        <p className="text-slate-600 leading-relaxed">
                            Welcome! You are in an interactive "No-Account" environment. Follow these instructions to understand the power of Biasharasasa:
                        </p>
                        
                        <div className="space-y-4 pt-4">
                            {[
                                { step: "01", title: "Test the POS Terminal", desc: "Open the POS tab and try adding items to a cart to see real-time tax calculation." },
                                { step: "02", title: "Manage Stock", desc: "Go to Inventory to see how stock levels update automatically after every simulated sale." },
                                { step: "03", title: "Audit Finance", desc: "Visit Finance & Ledger to see your automated business balance sheet." },
                                { step: "04", title: "Check Compliance", desc: "Ensure your business meets legal requirements in the Tax Compliance module." }
                            ].map((s, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className="text-2xl font-black text-slate-200 group-hover:text-blue-500 transition-colors leading-none pt-1 font-mono">{s.step}</div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{s.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full md:w-80 space-y-4">
                        <div className="p-6 bg-blue-600 rounded-3xl text-white space-y-4 shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10 space-y-4">
                                <Zap size={32} className="text-blue-200" />
                                <h3 className="text-lg font-black leading-tight uppercase tracking-tight">Interactive Demo Mode Active</h3>
                                <p className="text-xs text-blue-100 leading-relaxed font-medium">Click any module below or use the button below to start with the POS.</p>
                                <button 
                                    onClick={() => onNavigate('pos')}
                                    className="w-full bg-white text-blue-600 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-lg active:scale-95 cursor-pointer border-none"
                                >
                                    Launch POS Terminal
                                </button>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] text-slate-500 font-medium leading-relaxed">
                            💡 <strong>Tip:</strong> Guest data is localized. To save your progress across devices, please register for a permanent trader account.
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive Module Spotlight */}
            <section className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-2">
                        <div className="text-blue-600 text-xs font-black uppercase tracking-widest">Enterprise Suite</div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Financial & <span className="text-blue-600">Compliance Hub</span></h2>
                    </div>
                    <p className="text-slate-500 text-sm max-w-md">
                        Deep-dive into the two most powerful modules of the Biasharasasa suite designed for institutional-grade business management.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Finance Card */}
                    <motion.div 
                        whileHover={{ y: -5 }}
                        className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-slate-200/50 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-0 opacity-50" />
                        
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                                <Landmark size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Finance & Ledger</h3>
                                <p className="text-xs text-purple-600 font-bold uppercase tracking-widest">Module ID: FINANCE_PRO</p>
                            </div>
                        </div>

                        <p className="text-slate-600 leading-relaxed relative z-10">
                            A robust triple-entry accounting system that automates your journals, ledgers, and balance sheets in real-time.
                        </p>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            {[
                                { label: "Multi-Currency", icon: Globe },
                                { label: "Bank Reconcile", icon: Zap },
                                { label: "Profit Analytics", icon: BarChart2 },
                                { label: "Ledger Trails", icon: ShieldCheck }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <item.icon size={14} className="text-purple-600" />
                                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 flex items-center justify-between relative z-10">
                            <div className="flex -space-x-2">
                                {[1,2,3].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center overflow-hidden">
                                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="avatar" />
                                    </div>
                                ))}
                                <div className="w-8 h-8 rounded-full bg-purple-600 border-2 border-white flex items-center justify-center text-[8px] font-black text-white">+24</div>
                            </div>
                            <button 
                                onClick={() => onNavigate('finance')}
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-600 transition-all flex items-center gap-2 group cursor-pointer border-none shadow-lg active:scale-95"
                            >
                                Enter Module <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Tax Compliance Card */}
                    <motion.div 
                        whileHover={{ y: -5 }}
                        className="bg-slate-900 rounded-[2.5rem] p-8 space-y-6 shadow-2xl shadow-blue-900/20 relative overflow-hidden text-white"
                    >
                        <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-500/10 rounded-tl-full -z-0" />
                        
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
                                <ShieldCheck size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Tax Compliance</h3>
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Module ID: TAX_COMPLY</p>
                            </div>
                        </div>

                        <p className="text-slate-300 leading-relaxed relative z-10">
                            Automated regulatory reporting with KRA/ETR integration support. Manage VAT, withholding, and corporate tax returns seamlessly.
                        </p>

                        <div className="space-y-3 relative z-10">
                            {[
                                "Real-time VAT calculation on every POS sale",
                                "One-click generation of monthly tax reports",
                                "Digital ETR signature verification engine",
                                "Customizable tax categories for diverse regions"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
                                    <span className="text-xs font-medium text-slate-300">{item}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                    {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                                </div>
                                <span className="text-[10px] font-bold uppercase text-blue-400 tracking-widest">Verification Active</span>
                            </div>
                            <button 
                                onClick={() => onNavigate('tax')}
                                className="px-6 py-3 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2 group cursor-pointer border-none shadow-lg active:scale-95"
                            >
                                Review Compliance <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Front Office Modules Showcase */}
            <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <Store size={12} /> Front Office Suite
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            Store Operations & <span className="text-emerald-600">Sales Floor</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 text-xs md:text-sm max-w-md">
                        High-velocity checkout terminals, dynamic inventory balance alerts, and shop-floor manufacturing workflows.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {frontOfficeFeatures.map((feature, idx) => (
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, scale: 0.96 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.08 }}
                            className="group relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between"
                        >
                            <div className="aspect-[16/9] overflow-hidden relative">
                                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10" />
                                <img 
                                    src={feature.image} 
                                    alt={feature.title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 grayscale-[0.15] group-hover:grayscale-0"
                                />
                                <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                                    <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow">
                                        Front Office
                                    </span>
                                    <span className="bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                        Module 0{idx + 1}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6 md:p-8 space-y-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className={`${feature.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                                        <feature.icon size={24} />
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">{feature.title}</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <button 
                                        onClick={() => onNavigate(feature.id)}
                                        className="flex items-center gap-2 text-emerald-700 font-bold text-sm hover:gap-3 transition-all cursor-pointer"
                                    >
                                        Launch live {feature.title} <Zap size={16} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Back Office Modules Showcase */}
            <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <Building2 size={12} /> Back Office Suite
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            Management, Accounting & <span className="text-blue-600">Governance</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 text-xs md:text-sm max-w-md">
                        Automated ledger accounting, statutory tax reporting, comprehensive analytics, and multi-tenant merchant administration.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {backOfficeFeatures.map((feature, idx) => (
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, scale: 0.96 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.08 }}
                            className="group relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between"
                        >
                            <div className="aspect-[16/9] overflow-hidden relative">
                                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10" />
                                <img 
                                    src={feature.image} 
                                    alt={feature.title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 grayscale-[0.15] group-hover:grayscale-0"
                                />
                                <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                                    <span className="bg-blue-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow">
                                        Back Office
                                    </span>
                                    <span className="bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                        Module 0{idx + 1}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6 md:p-8 space-y-4 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className={`${feature.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                                        <feature.icon size={24} />
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-slate-900">{feature.title}</h3>
                                    <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <button 
                                        onClick={() => onNavigate(feature.id)}
                                        className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:gap-3 transition-all cursor-pointer"
                                    >
                                        Launch live {feature.title} <Zap size={16} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Hybrid Workflow Visual */}
            <section className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8 md:p-12 space-y-12">
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">The <span className="text-blue-600">Hybrid Advantage</span> Instruction</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Biasharasasa uses a sophisticated dual-channel data protocol to ensure your business stays online 24/7.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative">
                    {/* Visual Line Connectors (Desktop) */}
                    <div className="hidden lg:block absolute top-1/2 left-1/4 right-1/4 h-0.5 border-t-2 border-dashed border-slate-200 -translate-y-1/2 z-0" />
                    
                    <div className="w-full lg:w-1/3 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative z-10 space-y-4 text-center">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-500/20">
                            <ShoppingCart size={32} />
                        </div>
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">POS Terminal</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">Transactions are processed instantly with zero lag.</p>
                    </div>

                    <div className="w-full lg:w-1/3 flex flex-col gap-4 relative z-10">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-blue-500 transition-colors">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Globe size={20} />
                            </div>
                            <div className="text-left">
                                <h5 className="text-sm font-black text-slate-800">1. Cloud Sync</h5>
                                <p className="text-[10px] text-slate-500">Live analytics & global access.</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-emerald-500 transition-colors">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Database size={20} />
                            </div>
                            <div className="text-left">
                                <h5 className="text-sm font-black text-slate-800">2. Local Backup</h5>
                                <p className="text-[10px] text-slate-500">Physical redundancy on your IP.</p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/3 bg-slate-900 p-8 rounded-3xl shadow-xl relative z-10 space-y-4 text-center text-white">
                        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-500/20">
                            <ShieldCheck size={32} />
                        </div>
                        <h4 className="text-lg font-black uppercase tracking-tight">100% Uptime</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">Offline? No problem. Data syncs when you reconnect.</p>
                    </div>
                </div>
            </section>

            {/* Mobile Experience */}
            <section className="flex flex-col lg:flex-row items-center gap-12 py-12">
                <div className="flex-1 space-y-6">
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">
                        Built for <span className="text-emerald-600 underline decoration-emerald-200 underline-offset-8">Every Device</span>.
                    </h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
                        Whether you are using a professional desktop setup or a mobile device in the field, Biasharasasa adapts to your screen. Our mobile-first architecture ensures that your business never stops, even on the go.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-3 rounded-2xl">
                            <Smartphone className="text-blue-500" />
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Available on</div>
                                <div className="text-sm font-bold">Android & iOS</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-3 rounded-2xl">
                            <Globe className="text-emerald-500" />
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Access via</div>
                                <div className="text-sm font-bold">Web Browser</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <img 
                        src="https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80&w=800" 
                        alt="Mobile POS" 
                        className="relative rounded-3xl shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500"
                    />
                </div>
            </section>

            {/* Final CTA */}
            <footer className="text-center p-12 bg-blue-600 rounded-[2rem] text-white space-y-6">
                <h2 className="text-3xl font-black">Ready to scale your business?</h2>
                <p className="text-blue-100 max-w-xl mx-auto font-medium">
                    Join thousands of merchants who trust Biasharasasa for their daily operations. Start your journey today with our Tier 1 plan.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={() => onNavigate('pos')}
                        className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-black hover:bg-blue-50 transition-colors shadow-lg cursor-pointer"
                    >
                        Get Started Now
                    </button>
                    <button 
                        onClick={() => onNavigate('traders')}
                        className="bg-blue-700 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                        Talk to an Agent
                    </button>
                </div>
            </footer>
        </div>
    );
};

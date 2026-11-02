import React, { useState } from 'react';
import { Trader } from '../../../types';
import { Search, Edit2, Store, MapPin, Mail, Phone, ShieldCheck, ChevronRight } from 'lucide-react';

interface TraderListProps {
    traders: Trader[];
    onSelect?: (trader: Trader) => void;
    onEdit?: (trader: Trader) => void;
}

export const TraderList: React.FC<TraderListProps> = ({ traders, onSelect, onEdit }) => {
    const [search, setSearch] = useState('');

    const filteredTraders = traders.filter(t => {
        const q = search.toLowerCase();
        return (
            (t.fullName && t.fullName.toLowerCase().includes(q)) ||
            (t.businessName && t.businessName.toLowerCase().includes(q)) ||
            (t.email && t.email.toLowerCase().includes(q)) ||
            (t.location && t.location.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-4">
            {/* Search filter toolbar */}
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by name, business, email or city..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
            </div>

            {/* List items */}
            {filteredTraders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl p-6">
                    <Store size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-semibold text-sm">No traders found</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting your search criteria or add a new trader.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredTraders.map((trader) => (
                        <div
                            key={trader.id}
                            className="bg-white border border-slate-200 rounded-2xl p-4.5 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                            <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-600 transition-colors">
                                            {trader.businessName || trader.fullName}
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Owner: <span className="text-slate-700">{trader.fullName}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            trader.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                            trader.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {trader.status || 'active'}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                            {trader.plan || 'Basic'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 pt-1">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Mail size={13} className="text-slate-400 shrink-0" />
                                        <span className="truncate">{trader.email || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Phone size={13} className="text-slate-400 shrink-0" />
                                        <span className="truncate">{trader.phone || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate">
                                        <MapPin size={13} className="text-slate-400 shrink-0" />
                                        <span className="truncate">{trader.location || 'Nairobi'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate">
                                        <ShieldCheck size={13} className="text-slate-400 shrink-0" />
                                        <span className="truncate">Tax ID: {trader.taxId || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => onSelect && onSelect(trader)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
                                >
                                    Select Dashboard <ChevronRight size={14} />
                                </button>
                                {onEdit && (
                                    <button
                                        type="button"
                                        onClick={() => onEdit(trader)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border-none"
                                    >
                                        <Edit2 size={13} /> Edit
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TraderList;

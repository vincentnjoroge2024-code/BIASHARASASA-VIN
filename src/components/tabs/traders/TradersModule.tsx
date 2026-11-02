// traders/TradersModule.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useTraders } from '../../../hooks/useTraders';
import TraderList from './TraderList';
import TraderForm from './TraderForm';
import LoadingSpinner from '../../LoadingSpinner';
import { Trader } from '../../../types';
import { UserPlus, AlertTriangle } from 'lucide-react';

export const TradersModule: React.FC = () => {
    // ALL HOOKS CALLED FIRST - in the same order every render
    const [showForm, setShowForm] = useState(false);
    const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);
    const { user, isAuthenticated } = useAuth();
    const { traders, loading, error, fetchTraders, addTrader, updateTrader } = useTraders();

    useEffect(() => {
        if (isAuthenticated) {
            fetchTraders();
        }
    }, [isAuthenticated, fetchTraders]);

    // CONDITIONAL RETURNS AFTER ALL HOOKS
    if (!isAuthenticated) {
        return (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl max-w-md mx-auto my-12 shadow-sm">
                <p className="text-slate-700 font-semibold mb-2">Authentication Required</p>
                <p className="text-slate-500 text-xs">Please login to access the traders module.</p>
            </div>
        );
    }

    if (loading && traders.length === 0) {
        return <LoadingSpinner message="Loading traders directory..." />;
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 max-w-lg mx-auto my-8 flex items-start gap-3">
                <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-sm">Error Loading Traders</h4>
                    <p className="text-xs mt-1 text-red-600">{error.message}</p>
                    <button
                        onClick={() => fetchTraders()}
                        className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors border-none cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // RENDER COMPONENT
    return (
        <div className="traders-module space-y-6">
            <div className="header flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Traders Management</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Directory of accredited merchants, distributors, and storefront operators
                    </p>
                </div>
                <button
                    onClick={() => {
                        setSelectedTrader(null);
                        setShowForm(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer border-none active:scale-95 shrink-0"
                >
                    <UserPlus size={16} />
                    Add New Trader
                </button>
            </div>

            <TraderList
                traders={traders}
                onSelect={(trader) => {
                    setSelectedTrader(trader);
                }}
                onEdit={(trader) => {
                    setSelectedTrader(trader);
                    setShowForm(true);
                }}
            />

            {showForm && (
                <TraderForm
                    trader={selectedTrader}
                    onSave={async (data) => {
                        if (selectedTrader) {
                            await updateTrader(selectedTrader.id, data);
                        } else {
                            await addTrader(data);
                        }
                        setShowForm(false);
                        setSelectedTrader(null);
                    }}
                    onCancel={() => {
                        setShowForm(false);
                        setSelectedTrader(null);
                    }}
                />
            )}
        </div>
    );
};

export default TradersModule;

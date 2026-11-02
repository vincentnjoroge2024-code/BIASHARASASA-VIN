import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context';
import * as api from '../api';
import { Trader } from '../types';

export const useTradersData = () => {
    const context = useAppContext();
    const { user, refreshData, showToast } = context;
    const traders = useMemo(() => Array.isArray(context.traders) ? context.traders : [], [context.traders]);
    const inventory = useMemo(() => Array.isArray(context.inventory) ? context.inventory : [], [context.inventory]);
    const transactions = useMemo(() => Array.isArray(context.transactions) ? context.transactions : [], [context.transactions]);

    const [selectedTraderId, setSelectedTraderId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const isAuthenticated = !!user;

    const fetchTraders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            await refreshData();
        } catch (err: any) {
            const resolvedError = err instanceof Error ? err : new Error(err?.message || 'Failed to fetch traders');
            setError(resolvedError);
            if (showToast) showToast(resolvedError.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [refreshData, showToast]);

    const addTrader = useCallback(async (data: Partial<Trader>) => {
        try {
            setLoading(true);
            const res = await api.addTrader(data);
            if (showToast) showToast('Trader created successfully', 'success');
            await refreshData();
            return res;
        } catch (err: any) {
            const resolvedError = err instanceof Error ? err : new Error(err?.message || 'Failed to add trader');
            setError(resolvedError);
            if (showToast) showToast(resolvedError.message, 'error');
            throw resolvedError;
        } finally {
            setLoading(false);
        }
    }, [refreshData, showToast]);

    const updateTrader = useCallback(async (id: number, data: Partial<Trader>) => {
        try {
            setLoading(true);
            const res = await api.updateTrader(id, data);
            if (showToast) showToast('Trader updated successfully', 'success');
            await refreshData();
            return res;
        } catch (err: any) {
            const resolvedError = err instanceof Error ? err : new Error(err?.message || 'Failed to update trader');
            setError(resolvedError);
            if (showToast) showToast(resolvedError.message, 'error');
            throw resolvedError;
        } finally {
            setLoading(false);
        }
    }, [refreshData, showToast]);

    // Auto-select trader for managers, cashiers or staff on mount
    useEffect(() => {
        if (user && (user.role === 'manager' || user.role === 'cashier' || user.role === 'staff')) {
            const matchedTrader = traders.find(t => t.email.toLowerCase() === user.username.toLowerCase() || t.id === user.traderId);
            if (matchedTrader) {
                setSelectedTraderId(matchedTrader.id);
            }
        }
    }, [user, traders]);

    const selectedTrader = useMemo(() => {
        if (!selectedTraderId || !Array.isArray(traders)) return null;
        return traders.find(t => t.id === selectedTraderId) || null;
    }, [selectedTraderId, traders]);

    const traderTransactions = useMemo(() => {
        if (!selectedTrader || !Array.isArray(transactions)) return [];
        return transactions.filter(t => t.traderId === selectedTrader.id);
    }, [transactions, selectedTrader]);

    const traderInventory = useMemo(() => {
        if (!selectedTrader || !Array.isArray(inventory)) return [];
        return inventory.filter(item => item.traderId === selectedTrader.id);
    }, [selectedTrader, inventory]);

    const traderRevenue = useMemo(() => {
        if (!Array.isArray(traderTransactions)) return 0;
        return traderTransactions.reduce((sum, t) => sum + t.total, 0);
    }, [traderTransactions]);

    const lowStockCount = useMemo(() => {
        if (!Array.isArray(traderInventory)) return 0;
        return traderInventory.filter(item => item.quantity <= (item.reorderLevel || 5)).length;
    }, [traderInventory]);

    return {
        ...context,
        isAuthenticated,
        loading,
        error,
        fetchTraders,
        addTrader,
        updateTrader,
        selectedTraderId,
        setSelectedTraderId,
        selectedTrader,
        traderTransactions,
        traderInventory,
        traderRevenue,
        lowStockCount
    };
};

export const useTraders = useTradersData;
export default useTradersData;

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context';
import { useTradersData } from '../../hooks/useTradersData';
import * as api from '../../api';
import { 
    updateTrader,
    updateTraderPrinterSettings, 
    addInventoryItem, 
    updateInventoryItem, 
    deleteInventoryItem,
    bulkAddInventoryItems,
    extractInventoryFromDocument,
    bulkDeleteTraders,
    bulkUpdateTradersStatus,
    bulkUpdateTradersPlan
} from '../../api';
import * as XLSX from 'xlsx';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { 
    Users, ChevronLeft, Save, Plus, Trash2, Edit2, Settings, 
    Printer, Check, Package, Receipt, ShoppingBag, Eye, Upload,
    LayoutDashboard, DollarSign, ShoppingCart, BarChart2, Crown, FileText, ArrowRight, FileSpreadsheet,
    CheckCircle, RefreshCw, Filter, Search, X, Tag, AlertCircle, ShieldAlert, Download, ShieldCheck,
    Shield, Sliders, CheckSquare, Square, Info, Briefcase, ChevronRight, HelpCircle,
    Store, MapPin, Percent
} from 'lucide-react';
import { LogoSVG } from '../Logo';
import { 
    formatCurrency, formatCurrencyNoDecimals, getCurrencyByLocation
} from '../../types';
import { CsvImportModal } from '../CsvImportModal';

export const TradersTab: React.FC<{ setActiveTab?: (tab: string) => void }> = ({ setActiveTab }) => {
    const { 
        user, traders, inventory, transactions, refreshData, showToast, subscriptionPlans, logAuditAction,
        selectedTraderId, setSelectedTraderId, selectedTrader, traderTransactions, traderInventory, traderRevenue, lowStockCount
    } = useTradersData();

    const [selectedTraderIds, setSelectedTraderIds] = useState<number[]>([]);
    const [isBulkDeletingTraders, setIsBulkDeletingTraders] = useState(false);
    const [isBulkUpdatingTraders, setIsBulkUpdatingTraders] = useState(false);
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [isBulkPlanModalOpen, setIsBulkPlanModalOpen] = useState(false);
    const [bulkStatusTarget, setBulkStatusTarget] = useState<'active' | 'pending' | 'suspended'>('active');
    const [bulkPlanTarget, setBulkPlanTarget] = useState<string>('Basic');
    const [traderSearchTerm, setTraderSearchTerm] = useState('');
    const [traderStatusFilter, setTraderStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');
    const [traderPlanFilter, setTraderPlanFilter] = useState<'all' | string>('all');
    const [subTab, setSubTab] = useState<'dashboard' | 'inventory' | 'settings'>('dashboard');

    // State for managing Trader Inventory
    const [searchQuery, setSearchQuery] = useState('');
    const [invForm, setInvForm] = useState({
        name: '', sku: '', quantity: '', unitPrice: '', supplier: '', reorderLevel: ''
    });
    const [editingItem, setEditingItem] = useState<any | null>(null);

    // Bulk upload states
    const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
    const [bulkInput, setBulkInput] = useState('');
    const [bulkFormat, setBulkFormat] = useState<'csv' | 'json'>('csv');
    const [isUploadingBulk, setIsUploadingBulk] = useState(false);
    const [isExtractingAI, setIsExtractingAI] = useState(false);
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [csvModalMode, setCsvModalMode] = useState<'inventory' | 'traders'>('traders');

    // State for Printer Settings (pre-loaded when selecting trader)
    const [printerForm, setPrinterForm] = useState({
        receiptHeader: '',
        receiptFooter: '',
        showLogo: true,
        showBusinessName: true,
        showLocation: true,
        showPhone: true,
        showTaxId: true,
        showDiscount: true,
        logoUrl: '',
        applyTax: false,
        taxRate: 0,
        taxLabel: 'VAT'
    });

    const [profileForm, setProfileForm] = useState({
        businessName: '',
        fullName: '',
        email: '',
        phone: '',
        location: '',
        taxId: '',
        taxRate: 0,
        website: ''
    });

    // Sync forms when selectedTrader changes
    React.useEffect(() => {
        if (selectedTrader) {
            const hasTaxConfigured = selectedTrader.applyTax === true || 
                (selectedTrader.applyTax !== false && selectedTrader.taxRate !== undefined && Number(selectedTrader.taxRate) > 0);
            const traderTaxRate = selectedTrader.taxRate !== undefined ? Number(selectedTrader.taxRate) : 0;
            setPrinterForm({
                receiptHeader: selectedTrader.receiptHeader || 'Your trusted wholesale partner',
                receiptFooter: selectedTrader.receiptFooter || 'Goods once sold are not returnable.\nThank you for your business!',
                showLogo: selectedTrader.showLogo !== false,
                showBusinessName: selectedTrader.showBusinessName !== false,
                showLocation: selectedTrader.showLocation !== false,
                showPhone: selectedTrader.showPhone !== false,
                showTaxId: selectedTrader.showTaxId !== false,
                showDiscount: selectedTrader.showDiscount !== false,
                logoUrl: selectedTrader.logoUrl || '',
                applyTax: Boolean(hasTaxConfigured && traderTaxRate > 0),
                taxRate: traderTaxRate,
                taxLabel: selectedTrader.taxLabel || 'VAT'
            });
            setProfileForm({
                businessName: selectedTrader.businessName || '',
                fullName: selectedTrader.fullName || '',
                email: selectedTrader.email || '',
                phone: selectedTrader.phone || '',
                location: selectedTrader.location || '',
                taxId: selectedTrader.taxId || '',
                taxRate: traderTaxRate,
                website: (selectedTrader as any).website || ''
            });
        }
    }, [selectedTrader]);

    const filteredTraderInventory = useMemo(() => {
        if (!searchQuery.trim()) return traderInventory;
        const q = searchQuery.toLowerCase();
        return traderInventory.filter(item => 
            item.name.toLowerCase().includes(q) || 
            (item.sku && item.sku.toLowerCase().includes(q))
        );
    }, [traderInventory, searchQuery]);

    // Calculate Stock Movement Data (Sales over last 30 days)
    const stockMovementData = useMemo(() => {
        if (!traderTransactions.length) return [];
        
        const dataMap: Record<string, number> = {};
        const today = new Date();
        
        // Initialize last 30 days with 0
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dataMap[dateStr] = 0;
        }

        // Aggregate quantities from transactions
        traderTransactions.forEach(t => {
            if (dataMap[t.date] !== undefined) {
                const dayQty = t.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
                dataMap[t.date] += dayQty;
            }
        });

        return Object.entries(dataMap)
            .map(([date, quantity]) => ({ 
                date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), 
                quantity,
                fullDate: date 
            }))
            .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    }, [traderTransactions]);

    // Handle adding item to trader's inventory
    const handleAddInventory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTrader) return;

        try {
            const res: any = await addInventoryItem({
                ...invForm,
                traderId: selectedTrader.id,
                quantity: Number(invForm.quantity),
                unitPrice: Number(invForm.unitPrice),
                reorderLevel: Number(invForm.reorderLevel || 0)
            });
            if (res.queued) {
                showToast('Item saved locally and will sync when online', 'info');
            } else {
                showToast('Item added to personalized inventory', 'success');
                refreshData();
            }
            setInvForm({ name: '', sku: '', quantity: '', unitPrice: '', supplier: '', reorderLevel: '' });
        } catch (error: any) {
            showToast(error.message || 'Failed to add item', 'error');
        }
    };

    // Parse file upload for bulk inventory
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // If Excel spreadsheet (.xlsx, .xls)
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    setBulkInput(JSON.stringify(jsonData, null, 2));
                    setBulkFormat('json');
                    showToast('Excel spreadsheet parsed and loaded successfully!', 'success');
                } catch (err) {
                    showToast('Failed to parse Excel spreadsheet', 'error');
                }
            };
            reader.readAsArrayBuffer(file);
            return;
        }

        // If PDF, image or word files, run through Gemini AI extraction directly
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.pdf') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
            setIsExtractingAI(true);
            showToast('Extracting document details using Gemini AI...', 'info');
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64String = (reader.result as string).split(',')[1];
                    const mimeType = file.type || 'application/pdf';
                    const res = await extractInventoryFromDocument(base64String, mimeType, file.name);
                    if (res && res.success && res.items) {
                        setBulkInput(JSON.stringify(res.items, null, 2));
                        setBulkFormat('json');
                        showToast(`Gemini extracted ${res.items.length} items from ${file.name}!`, 'success');
                    } else {
                        showToast('Failed to extract stock items', 'error');
                    }
                } catch (err: any) {
                    showToast(err.message || 'Gemini extraction failed', 'error');
                } finally {
                    setIsExtractingAI(false);
                }
            };
            reader.readAsDataURL(file);
            return;
        }

        // For plain text, CSV, JSON files
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (file.name.endsWith('.json')) {
                try {
                    const parsed = JSON.parse(text);
                    const itemsArray = Array.isArray(parsed) ? parsed : [parsed];
                    setBulkInput(JSON.stringify(itemsArray, null, 2));
                    setBulkFormat('json');
                    showToast('JSON file loaded and parsed successfully!', 'success');
                } catch (err) {
                    showToast('Invalid JSON file format', 'error');
                }
            } else {
                setBulkInput(text);
                setBulkFormat('csv');
                showToast('CSV/Text file loaded successfully!', 'success');
            }
        };
        reader.readAsText(file);
    };

    // Process bulk upload items
    const handleBulkUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTrader) return;
        if (!bulkInput.trim()) {
            showToast('Please provide some CSV or JSON data first.', 'info');
            return;
        }

        setIsUploadingBulk(true);
        try {
            let parsedItems: any[] = [];
            if (bulkFormat === 'json') {
                const parsed = JSON.parse(bulkInput);
                parsedItems = Array.isArray(parsed) ? parsed : [parsed];
            } else {
                const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) {
                    showToast('CSV must include a header line and at least one data row.', 'error');
                    setIsUploadingBulk(false);
                    return;
                }
                
                // Read CSV lines
                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i].split(',').map(c => c.trim());
                    if (row.length === 0 || !row[0]) continue;

                    const name = row[0] || '';
                    const sku = row[1] || '';
                    const quantity = parseInt(row[2] || '0', 10);
                    const unitPrice = parseFloat(row[3] || '0');
                    const supplier = row[4] || '';
                    const reorderLevel = parseInt(row[5] || '0', 10);

                    if (name) {
                        parsedItems.push({
                            name,
                            sku,
                            quantity: isNaN(quantity) ? 0 : quantity,
                            unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
                            supplier,
                            reorderLevel: isNaN(reorderLevel) ? 0 : reorderLevel
                        });
                    }
                }
            }

            if (parsedItems.length === 0) {
                showToast('No valid items found to upload');
                setIsUploadingBulk(false);
                return;
            }

            const res = await bulkAddInventoryItems(selectedTrader.id, parsedItems);
            if (res.success) {
                showToast(`Successfully uploaded ${parsedItems.length} items in bulk!`, 'success');
                setBulkInput('');
                refreshData();
            } else {
                showToast('Failed to upload items', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Format error during bulk parsing', 'error');
        } finally {
            setIsUploadingBulk(false);
        }
    };

    // Handle quick updates to inventory (editing quantity/price)
    const handleUpdateInventory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        try {
            const res: any = await updateInventoryItem(editingItem.id, {
                name: editingItem.name,
                sku: editingItem.sku,
                quantity: Number(editingItem.quantity),
                unitPrice: Number(editingItem.unitPrice),
                supplier: editingItem.supplier,
                reorderLevel: Number(editingItem.reorderLevel || 0)
            });
            if (res.queued) {
                showToast('Updates saved locally and will sync when online', 'info');
            } else {
                showToast('Inventory item updated successfully', 'success');
                refreshData();
            }
            setEditingItem(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to update item', 'error');
        }
    };

    // Handle deleting inventory item
    const handleDeleteInventory = async (id: number) => {
        if (confirm('Delete this inventory item from the trader\'s stock?')) {
            try {
                await deleteInventoryItem(id);
                showToast('Item deleted successfully', 'success');
                refreshData();
            } catch (error: any) {
                showToast(error.message || 'Failed to delete item', 'error');
            }
        }
    };

    // Synchronize Profile details
    const handleSyncProfile = async () => {
        if (!selectedTrader) return;
        try {
            await updateTrader(selectedTrader.id, profileForm);
            showToast('Merchant profile synchronized across all nodes', 'success');
            if (logAuditAction) {
                await logAuditAction('trader_profile_sync', { traderId: selectedTrader.id, updates: profileForm }, 'info');
            }
            refreshData();
        } catch (error: any) {
            showToast(error.message || 'Synchronization failed', 'error');
        }
    };

    // Save printer settings
    const handleSavePrinterSettings = async () => {
        if (!selectedTrader) return;

        try {
            const res: any = await updateTraderPrinterSettings(selectedTrader.id, printerForm);
            if (res.success) {
                if (res.queued) {
                    showToast('POS Document & tax settings saved locally (will sync online)', 'info');
                } else {
                    const taxMsg = printerForm.applyTax ? `${printerForm.taxRate}% ${printerForm.taxLabel || 'Tax'}` : 'Tax Exempt';
                    showToast(`POS Document Architect configured! Sales tax (${taxMsg}) applied.`, 'success');
                    await refreshData();
                }
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to save printer settings', 'error');
        }
    };

    // Member management actions


    // Quick stock adjustment for trader inventory

    // Quick stock adjustment for trader inventory
    const handleQuickStockAdjust = async (item: any, delta: number) => {
        const newQty = Math.max(0, (item.quantity || 0) + delta);
        try {
            await updateInventoryItem(item.id, { quantity: newQty });
            showToast(`Stock updated: ${item.name} (${newQty})`, "success");
            refreshData();
        } catch (err: any) {
            showToast("Failed to adjust stock", "error");
        }
    };

    // Export Trader Inventory to CSV
    const handleExportTraderInventoryCsv = () => {
        if (filteredTraderInventory.length === 0) {
            showToast("No inventory items to export", "info");
            return;
        }
        const headers = ["Item Name", "SKU", "Supplier", "Quantity", "Unit Price", "Reorder Level", "Stock Status"];
        const rows = filteredTraderInventory.map(item => [
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.sku || '').replace(/"/g, '""')}"`,
            `"${(item.supplier || '').replace(/"/g, '""')}"`,
            item.quantity,
            item.unitPrice,
            item.reorderLevel ?? 0,
            item.quantity <= (item.reorderLevel || 5) ? "LOW STOCK" : "IN STOCK"
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${(selectedTrader?.businessName || 'trader').replace(/[^a-z0-9]/gi, '_')}_inventory.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Trader inventory exported to CSV", "success");
    };

    // Back to Traders list view
    const handleBack = () => {
        setSelectedTraderId(null);
        setEditingItem(null);
    };

    const isTraderUser = user && (user.role === 'manager' || user.role === 'cashier');
    const currentPlan = subscriptionPlans.find(p => p.name === selectedTrader?.plan);

    const filteredTraders = useMemo(() => {
        return traders.filter(t => {
            const matchesSearch = !traderSearchTerm.trim() || 
                (t.fullName && t.fullName.toLowerCase().includes(traderSearchTerm.toLowerCase())) ||
                (t.businessName && t.businessName.toLowerCase().includes(traderSearchTerm.toLowerCase())) ||
                (t.email && t.email.toLowerCase().includes(traderSearchTerm.toLowerCase())) ||
                (t.plan && t.plan.toLowerCase().includes(traderSearchTerm.toLowerCase()));
            const matchesStatus = traderStatusFilter === 'all' || t.status === traderStatusFilter;
            const matchesPlan = traderPlanFilter === 'all' || t.plan === traderPlanFilter;
            return matchesSearch && matchesStatus && matchesPlan;
        });
    }, [traders, traderSearchTerm, traderStatusFilter, traderPlanFilter]);

    const toggleSelectAllTraders = () => {
        if (selectedTraderIds.length === filteredTraders.length && filteredTraders.length > 0) {
            setSelectedTraderIds([]);
        } else {
            setSelectedTraderIds(filteredTraders.map(t => t.id));
        }
    };

    const toggleSelectTrader = (id: number) => {
        setSelectedTraderIds(prev => 
            prev.includes(id) ? prev.filter(traderId => traderId !== id) : [...prev, id]
        );
    };

    const handleBulkDeleteTraders = async () => {
        if (selectedTraderIds.length === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedTraderIds.length} selected traders? This will permanently delete their profiles and accounts.`)) {
            setIsBulkDeletingTraders(true);
            try {
                await bulkDeleteTraders(selectedTraderIds);
                if (logAuditAction) {
                    await logAuditAction('trader_bulk_delete', { count: selectedTraderIds.length, traderIds: selectedTraderIds }, 'critical');
                }
                showToast(`${selectedTraderIds.length} traders deleted successfully`, 'success');
                setSelectedTraderIds([]);
                refreshData();
            } catch (error: any) {
                showToast(error.message || 'Failed to delete traders', 'error');
            } finally {
                setIsBulkDeletingTraders(false);
            }
        }
    };

    const handleBulkUpdateStatus = async (status: string) => {
        if (selectedTraderIds.length === 0) return;
        setIsBulkUpdatingTraders(true);
        try {
            await bulkUpdateTradersStatus(selectedTraderIds, status);
            if (logAuditAction) {
                await logAuditAction('trader_bulk_status', { count: selectedTraderIds.length, status }, 'warning');
            }
            showToast(`Updated status to "${status}" for ${selectedTraderIds.length} traders`, 'success');
            setSelectedTraderIds([]);
            setIsBulkStatusModalOpen(false);
            refreshData();
        } catch (error: any) {
            showToast(error.message || 'Failed to update trader status', 'error');
        } finally {
            setIsBulkUpdatingTraders(false);
        }
    };

    const handleBulkUpdatePlan = async (plan: string) => {
        if (selectedTraderIds.length === 0) return;
        setIsBulkUpdatingTraders(true);
        try {
            await bulkUpdateTradersPlan(selectedTraderIds, plan);
            if (logAuditAction) {
                await logAuditAction('trader_bulk_plan', { count: selectedTraderIds.length, plan }, 'warning');
            }
            showToast(`Assigned plan "${plan}" to ${selectedTraderIds.length} traders`, 'success');
            setSelectedTraderIds([]);
            setIsBulkPlanModalOpen(false);
            refreshData();
        } catch (error: any) {
            showToast(error.message || 'Failed to update trader plans', 'error');
        } finally {
            setIsBulkUpdatingTraders(false);
        }
    };

    const handleExportSelectedTradersCsv = () => {
        if (selectedTraderIds.length === 0) return;
        const selected = traders.filter(t => selectedTraderIds.includes(t.id));
        const headers = ["ID", "Full Name", "Business Name", "Email", "Phone", "Location", "Tax ID", "Plan", "Discount Rate", "Status", "Joined"];
        const rows = selected.map(t => [
            t.id,
            `"${(t.fullName || '').replace(/"/g, '""')}"`,
            `"${(t.businessName || '').replace(/"/g, '""')}"`,
            `"${(t.email || '').replace(/"/g, '""')}"`,
            `"${(t.phone || '').replace(/"/g, '""')}"`,
            `"${(t.location || '').replace(/"/g, '""')}"`,
            `"${(t.taxId || '').replace(/"/g, '""')}"`,
            `"${(t.plan || '').replace(/"/g, '""')}"`,
            `${t.discountRate || 0}%`,
            `"${(t.status || '').replace(/"/g, '""')}"`,
            `"${(t.customerSince || t.joined || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `traders_selected_${selectedTraderIds.length}_accounts.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${selectedTraderIds.length} traders to CSV`, 'success');
    };

    return (
        <div className="w-full h-full overflow-hidden">
            {selectedTrader ? (
                <div className="p-6 overflow-y-auto w-full h-full bg-slate-50/50 dark:bg-slate-950/60 backdrop-blur-[1px] space-y-6">
                {/* Branding Instructional Zoom */}
                <div className="bg-slate-900 border-l-4 border-emerald-500 p-6 text-white shadow-2xl relative overflow-hidden shrink-0 rounded-r-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                            <LogoSVG className="w-10 h-10" />
                        </div>
                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">Merchant Operations Hub</h3>
                            <h2 className="text-xl font-black uppercase tracking-tight">
                                {subTab === 'dashboard' ? 'Real-time Merchant Intelligence' : 
                                 subTab === 'settings' ? 'Global Node Configuration & Settings' : 'Global Vendor Network Control'}
                            </h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-3xl">
                                Managing terminal node <span className="text-emerald-400">{selectedTrader.businessName || selectedTrader.fullName}</span>. 
                                Every operational adjustment is cryptographically recorded and synced across the Primeaxis secure network layer.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            <div className="text-[9px] font-black bg-emerald-600/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-[0.2em]">
                                <ShieldCheck size={10} className="inline mr-2" /> Secure Node Access
                            </div>
                            <div className="text-[9px] font-black bg-blue-600/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 uppercase tracking-[0.2em]">
                                <RefreshCw size={10} className="inline mr-2" /> Network Synced
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hub Header */}
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        {!isTraderUser && (
                            <button 
                                onClick={handleBack}
                                className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 transition shadow-lg cursor-pointer group"
                            >
                                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            </button>
                        )}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                <ShoppingBag size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">Active Merchant Node</span>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{selectedTrader.fullName}</h3>
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {selectedTrader.businessName || 'No Registered Business'} &bull; {selectedTrader.location} &bull; {selectedTrader.plan} Account
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sub-Tabs Selector */}
                    <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner flex shrink-0 gap-1">
                        <button 
                            onClick={() => setSubTab('dashboard')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                subTab === 'dashboard' 
                                ? 'bg-slate-900 text-white shadow-xl' 
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                        >
                            <LayoutDashboard size={14} />
                            Overview
                        </button>
                        <button 
                            onClick={() => setSubTab('inventory')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                subTab === 'inventory' 
                                ? 'bg-slate-900 text-white shadow-xl' 
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                        >
                            <Package size={14} />
                            Stock ({traderInventory.length})
                        </button>
                        <button 
                            onClick={() => setSubTab('settings')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                subTab === 'settings' 
                                ? 'bg-slate-900 text-white shadow-xl' 
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                        >
                            <Settings size={14} />
                            Settings
                        </button>


                    </div>
                </div>

                {/* Sub-Tab 0: DASHBOARD OVERVIEW */}
                {subTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Card 1: Total Sales Transactions */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
                                    <h4 className="text-2xl font-black text-slate-800 mt-1">{traderTransactions.length}</h4>
                                    <span className="text-[10px] text-slate-400 mt-1 block">Completed transactions</span>
                                </div>
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Receipt size={24} />
                                </div>
                            </div>

                            {/* Card 2: Total Revenue */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Revenue</span>
                                    <h4 className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(traderRevenue, selectedTrader?.location)}</h4>
                                    <span className="text-[10px] text-slate-400 mt-1 block">Gross earnings volume</span>
                                </div>
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <DollarSign size={24} />
                                </div>
                            </div>

                            {/* Card 3: Products Catalog count */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Products</span>
                                    <h4 className="text-2xl font-black text-slate-800 mt-1">{traderInventory.length}</h4>
                                    <span className="text-[10px] text-slate-400 mt-1 block">Items in store catalog</span>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Package size={24} />
                                </div>
                            </div>

                            {/* Card 4: Low Stock Warnings */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Stock Alerts</span>
                                    <h4 className="text-2xl font-black text-amber-600 mt-1">{lowStockCount}</h4>
                                    <span className="text-[10px] text-slate-400 mt-1 block">Requires reordering attention</span>
                                </div>
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                    <ShoppingBag size={24} />
                                </div>
                            </div>
                        </div>

                        {/* POS Quick Terminal section */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Point of Sale (POS) Terminal Quick Actions</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <button 
                                    onClick={() => setActiveTab?.('pos')}
                                    className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/50 hover:from-indigo-100 border border-indigo-150 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm group flex flex-col justify-between h-28"
                                >
                                    <div className="p-2 bg-indigo-600 text-white rounded-lg w-fit">
                                        <ShoppingCart size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black text-slate-800">POS Register</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Launch billing terminal</span>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setSubTab('inventory')}
                                    className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:from-emerald-100 border border-emerald-150 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm group flex flex-col justify-between h-28"
                                >
                                    <div className="p-2 bg-emerald-600 text-white rounded-lg w-fit">
                                        <Package size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black text-slate-800">Add Stock</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Manage your inventory</span>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setSubTab('settings')}
                                    className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 border border-blue-150 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm group flex flex-col justify-between h-28"
                                >
                                    <div className="p-2 bg-blue-600 text-white rounded-lg w-fit">
                                        <Settings size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black text-slate-800">Trader Settings</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Configure hub & node</span>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setActiveTab?.('reports')}
                                    className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 hover:from-purple-100 border border-purple-150 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm group flex flex-col justify-between h-28"
                                >
                                    <div className="p-2 bg-purple-600 text-white rounded-lg w-fit">
                                        <BarChart2 size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black text-slate-800">Sales Reports</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Audit transactions log</span>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setActiveTab?.('regime')}
                                    className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 hover:from-amber-100 border border-amber-150 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm group flex flex-col justify-between h-28 col-span-2 md:col-span-1"
                                >
                                    <div className="p-2 bg-amber-600 text-white rounded-lg w-fit">
                                        <Crown size={16} />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black text-slate-800">Subscriptions</span>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Manage billing tier</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Recent Transactions list */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <FileText size={16} className="text-slate-500" />
                                    Recent POS Transactions Log
                                </h4>
                                <button 
                                    onClick={() => setActiveTab?.('reports')}
                                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    View all reports <ArrowRight size={12} />
                                </button>
                            </div>
                            
                            {traderTransactions.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Receipt size={36} className="mx-auto mb-2 opacity-25" />
                                    <p className="text-xs">No transactions recorded for this terminal register yet.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100/50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                <th className="p-4">Invoice No</th>
                                                <th className="p-4">Date & Time</th>
                                                <th className="p-4">Customer Name</th>
                                                <th className="p-4">Payment Method</th>
                                                <th className="p-4 text-center">Items count</th>
                                                <th className="p-4 text-right">Discount</th>
                                                <th className="p-4 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {traderTransactions.slice(0, 5).map((t) => (
                                                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition">
                                                    <td className="p-4 font-bold text-slate-900 font-mono">{t.invoiceNo}</td>
                                                    <td className="p-4 text-slate-600">{t.date} &bull; {t.time}</td>
                                                    <td className="p-4 text-slate-700 font-medium">{t.customerName}</td>
                                                    <td className="p-4">
                                                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t.paymentMethod}</span>
                                                    </td>
                                                    <td className="p-4 text-center text-slate-800 font-bold">{t.itemCount}</td>
                                                    <td className="p-4 text-right text-red-600 font-medium">-{formatCurrency(t.discountAmount, selectedTrader?.location)} ({t.discountRate}%)</td>
                                                    <td className="p-4 text-right font-bold text-emerald-600">{formatCurrency(t.total, selectedTrader?.location)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Sub-Tab 1: PERSONALIZED STOCK MANAGEMENT */}
                {subTab === 'inventory' && (
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
                        {/* Left Side: Inventory Table */}
                        <div className="flex flex-col gap-4">
                            {/* Inventory Header Controls */}
                            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                    <ShoppingBag size={16} className="text-green-600" />
                                    Trader Inventory & Levels
                                </h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportTraderInventoryCsv}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
                                        title="Export stock as CSV"
                                    >
                                        <Download size={14} />
                                        Export CSV
                                    </button>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="Search stock..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-4 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none w-56 bg-slate-50/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stock Movement Chart */}
                            {traderTransactions.length > 0 && (
                                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 mb-2">
                                    <h5 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                        <BarChart2 size={14} className="text-blue-500" />
                                        Stock Movement (Units Sold - Last 30 Days)
                                    </h5>
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stockMovementData}>
                                                <defs>
                                                    <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{fontSize: 10, fill: '#64748b'}}
                                                    minTickGap={20}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{fontSize: 10, fill: '#64748b'}}
                                                />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                    labelStyle={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}
                                                />
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="quantity" 
                                                    name="Units Sold"
                                                    stroke="#10b981" 
                                                    strokeWidth={2}
                                                    fillOpacity={1} 
                                                    fill="url(#colorQty)" 
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Inventory Table Container */}
                            {filteredTraderInventory.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <Package size={54} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No items in stock. Create some items below or upload inventory.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Item Name</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">SKU</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Supplier</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Qty Available</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Price</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Reorder Lvl</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTraderInventory.map((item) => {
                                                const isLow = item.quantity <= (item.reorderLevel || 5);
                                                return (
                                                    <tr key={item.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition ${isLow ? 'bg-red-50/30' : ''}`}>
                                                        <td className="p-4 text-sm font-bold text-slate-900">{item.name}</td>
                                                        <td className="p-4 text-sm text-slate-600 font-mono text-xs">{item.sku || '—'}</td>
                                                        <td className="p-4 text-sm text-slate-500">{item.supplier || '—'}</td>
                                                        <td className="p-4 text-sm text-center font-bold">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickStockAdjust(item, -1)}
                                                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                                                                    title="Decrease stock by 1"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className={isLow ? "text-red-600 bg-red-50 px-2 py-0.5 rounded font-mono font-bold" : "text-slate-800 font-mono font-bold"}>
                                                                    {item.quantity}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickStockAdjust(item, 1)}
                                                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                                                                    title="Increase stock by 1"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-sm text-right font-bold text-emerald-600">{formatCurrency(item.unitPrice, selectedTrader?.location)}</td>
                                                        <td className="p-4 text-sm text-center text-slate-600 font-mono text-xs">{item.reorderLevel ?? 0}</td>
                                                        <td className="p-4 text-sm text-center">
                                                            {isLow ? (
                                                                <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                                                    LOW STOCK
                                                                </span>
                                                            ) : (
                                                                <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                                                                    STABLE
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-sm text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <button 
                                                                    onClick={() => setEditingItem(item)}
                                                                    className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition cursor-pointer"
                                                                    title="Edit Stock"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteInventory(item.id)}
                                                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded transition cursor-pointer"
                                                                    title="Delete Item"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Create / Edit Form under list */}
                            {editingItem ? (
                                <div className="bg-white border-2 border-blue-200 rounded-xl p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-blue-900 text-sm">✏️ Edit Inventory Stock details</h4>
                                        <button onClick={() => setEditingItem(null)} className="text-slate-500 hover:text-slate-800 text-xs font-bold">&times; Cancel</button>
                                    </div>
                                    <form onSubmit={handleUpdateInventory} className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Item Name</label>
                                            <input required type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">SKU</label>
                                            <input type="text" value={editingItem.sku || ''} onChange={e => setEditingItem({...editingItem, sku: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                                            <input required type="number" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price ({getCurrencyByLocation(selectedTrader?.location).symbol})</label>
                                            <input required type="number" step="0.01" value={editingItem.unitPrice} onChange={e => setEditingItem({...editingItem, unitPrice: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Threshold</label>
                                            <input type="number" value={editingItem.reorderLevel || 0} onChange={e => setEditingItem({...editingItem, reorderLevel: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-2 rounded-lg transition h-[38px] cursor-pointer">
                                                Update
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : null}
                        </div>

                        {/* Right Column: Add Stock Sidebar with Single / Bulk toggle */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex border-b border-slate-100 pb-3 mb-4 justify-between items-center">
                                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                                    <Package size={16} className="text-green-600" />
                                    Manage Stock Input
                                </h4>
                                <div className="bg-slate-100 p-0.5 rounded-lg flex shrink-0 border border-slate-200">
                                    <button 
                                        onClick={() => setUploadMode('single')}
                                        className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${uploadMode === 'single' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        Single
                                    </button>
                                    <button 
                                        onClick={() => setUploadMode('bulk')}
                                        className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${uploadMode === 'bulk' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                                    >
                                        Bulk
                                    </button>
                                </div>
                            </div>

                            {uploadMode === 'single' ? (
                                <div className="flex flex-col gap-4">
                                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                        Enter a single custom item for this specific trader's POS inventory.
                                    </p>
                                    <form onSubmit={handleAddInventory} className="flex flex-col gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Name *</label>
                                            <input 
                                                required 
                                                type="text" 
                                                value={invForm.name} 
                                                onChange={e => setInvForm({...invForm, name: e.target.value})}
                                                placeholder="e.g. Avocado Grade A" 
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">SKU Code</label>
                                            <input 
                                                type="text" 
                                                value={invForm.sku} 
                                                onChange={e => setInvForm({...invForm, sku: e.target.value})}
                                                placeholder="e.g. AV005" 
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none font-mono" 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Stock Qty *</label>
                                                <input 
                                                    required 
                                                    type="number" 
                                                    value={invForm.quantity} 
                                                    onChange={e => setInvForm({...invForm, quantity: e.target.value})}
                                                    placeholder="100" 
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Price ({getCurrencyByLocation(selectedTrader?.location).symbol}) *</label>
                                                <input 
                                                    required 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={invForm.unitPrice} 
                                                    onChange={e => setInvForm({...invForm, unitPrice: e.target.value})}
                                                    placeholder="50.00" 
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
                                            <input 
                                                type="text" 
                                                value={invForm.supplier} 
                                                onChange={e => setInvForm({...invForm, supplier: e.target.value})}
                                                placeholder="e.g. Meru Farms Co" 
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Reorder Level Alert</label>
                                            <input 
                                                type="number" 
                                                value={invForm.reorderLevel} 
                                                onChange={e => setInvForm({...invForm, reorderLevel: e.target.value})}
                                                placeholder="10" 
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                                            />
                                        </div>
                                        <button type="submit" className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded-lg text-sm shadow transition mt-2 cursor-pointer">
                                            Create Stock Item
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    <div className="bg-slate-900 border-l-4 border-emerald-500 rounded-3xl p-8 mb-6 relative overflow-hidden text-white shadow-2xl">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                                        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
                                            <div className="w-20 h-20 bg-emerald-600/20 rounded-[2rem] flex items-center justify-center border border-emerald-500/30 shrink-0 shadow-lg">
                                                <FileSpreadsheet size={40} className="text-emerald-400" />
                                            </div>
                                            <div className="flex-1 space-y-3 text-center lg:text-left">
                                                <h4 className="text-sm font-black uppercase tracking-[0.4em] text-emerald-400">Primeaxis Advanced Import</h4>
                                                <h2 className="text-3xl font-black uppercase tracking-tight leading-none">High-Fidelity Bulk Stock Upload</h2>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-3xl">
                                                    Rapid data ingestion engine with Gemini AI validation. Supports complex relational structures, 
                                                    auto-mapping, and duplicate collision prevention.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCsvModalMode('inventory');
                                                    setIsCsvModalOpen(true);
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest px-8 py-4 rounded-2xl text-xs shadow-2xl shadow-emerald-600/30 transition flex items-center gap-3 cursor-pointer shrink-0"
                                            >
                                                <FileSpreadsheet size={18} /> OPEN IMPORT WIZARD
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                                                <Upload size={16} />
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Manual Data Stream</h4>
                                        </div>
                                        
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 leading-relaxed">
                                            Paste CSV/JSON raw data or drop a physical inventory file below for parsing.
                                        </p>

                                        <form onSubmit={handleBulkUpload} className="flex flex-col gap-6">
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="bulkFormat" 
                                                        checked={bulkFormat === 'csv'} 
                                                        onChange={() => setBulkFormat('csv')} 
                                                        className="cursor-pointer text-green-700 focus:ring-green-500" 
                                                    />
                                                    CSV Format
                                                </label>
                                                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                                                    <input 
                                                        type="radio" 
                                                        name="bulkFormat" 
                                                        checked={bulkFormat === 'json'} 
                                                        onChange={() => setBulkFormat('json')} 
                                                        className="cursor-pointer text-green-700 focus:ring-green-500" 
                                                    />
                                                    JSON Format
                                                </label>
                                            </div>

                                            <div className="border-2 border-dashed border-slate-200 hover:border-green-500 rounded-xl p-4 text-center transition bg-slate-50/50">
                                                {isExtractingAI ? (
                                                    <div className="flex flex-col items-center justify-center py-2">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-700 mb-2"></div>
                                                        <span className="text-xs font-bold text-green-800">Gemini AI is extracting stock details...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="mx-auto mb-2 text-slate-400" size={24} />
                                                        <label className="block text-xs font-bold text-slate-700 mb-1 cursor-pointer hover:text-green-700">
                                                            Click to Upload Stock File
                                                            <span className="text-[10px] text-slate-400 block mt-0.5">Supports PDF, Excel (.xlsx/.xls), CSV, JSON, PNG, JPG</span>
                                                            <input 
                                                                type="file" 
                                                                accept=".csv,.json,.xlsx,.xls,.pdf,.png,.jpg,.jpeg" 
                                                                onChange={handleFileUpload} 
                                                                className="hidden" 
                                                            />
                                                        </label>
                                                        <span className="text-[10px] text-slate-400 block">Maximum size 10MB</span>
                                                    </>
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-xs font-bold text-slate-700">Or Paste Raw Data Below</label>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            if (bulkFormat === 'csv') {
                                                                setBulkInput("Name, SKU, Stock Qty, Price (KSh), Supplier, Reorder Level\nFresh Mangos, MN002, 120, 45.00, Kisumu Farms, 15\nOrganic Spinach, SP010, 80, 25.00, Naivasha Co, 10");
                                                            } else {
                                                                setBulkInput(JSON.stringify([
                                                                    { name: "Fresh Mangos", sku: "MN002", quantity: 120, unitPrice: 45, supplier: "Kisumu Farms", reorderLevel: 15 },
                                                                    { name: "Organic Spinach", sku: "SP010", quantity: 80, unitPrice: 25, supplier: "Naivasha Co", reorderLevel: 10 }
                                                                ], null, 2));
                                                            }
                                                        }}
                                                        className="text-[10px] text-green-700 hover:underline font-bold"
                                                    >
                                                        Insert Template
                                                    </button>
                                                </div>
                                                <textarea 
                                                    rows={6}
                                                    value={bulkInput}
                                                    onChange={e => setBulkInput(e.target.value)}
                                                    placeholder={bulkFormat === 'csv' 
                                                        ? "Name, SKU, Stock Qty, Price (KSh), Supplier, Reorder Level\nFresh Mangos, MN002, 120, 45, Kisumu Farms, 15" 
                                                        : '[\n  { "name": "Fresh Mangos", "sku": "MN002", "quantity": 120, "unitPrice": 45 }\n]'
                                                    }
                                                    className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-[11px] focus:ring-2 focus:ring-green-500 outline-none leading-normal resize-y"
                                                />
                                            </div>

                                            <button 
                                                type="submit" 
                                                disabled={isUploadingBulk || !bulkInput.trim()}
                                                className="w-full flex items-center justify-center gap-1 bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded-lg text-sm shadow transition cursor-pointer disabled:opacity-50"
                                            >
                                                <Upload size={14} />
                                                {isUploadingBulk ? 'Uploading stock...' : 'Upload Stock in Bulk'}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Sub-Tab 2: TRADER SETTING HUB & SYSTEM CONFIG */}
                {subTab === 'settings' && (
                    <div className="space-y-8 pb-20">
                        {/* Settings Overview Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            
                            {/* 1. Profile & Identity */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col h-full">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Profile & Identity</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Manage node baseline data</p>
                                    </div>
                                </div>
                                <div className="space-y-6 flex-1">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Business / Legal Name</label>
                                        <input 
                                            type="text" 
                                            value={profileForm.businessName}
                                            onChange={e => setProfileForm({...profileForm, businessName: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Contact Email</label>
                                        <input 
                                            type="email" 
                                            value={profileForm.email}
                                            onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tax ID / PIN</label>
                                            <input 
                                                type="text" 
                                                value={profileForm.taxId}
                                                onChange={e => setProfileForm({...profileForm, taxId: e.target.value})}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                                            <input 
                                                type="text" 
                                                value={profileForm.phone}
                                                onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Geographic Location</label>
                                        <input 
                                            type="text" 
                                            value={profileForm.location}
                                            onChange={e => setProfileForm({...profileForm, location: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Indicated Tax Rate (%)</label>
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                Trader Setting
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={profileForm.taxRate ?? 16}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value);
                                                    const rate = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
                                                    setProfileForm({...profileForm, taxRate: rate});
                                                    setPrinterForm(prev => ({ ...prev, taxRate: rate }));
                                                }}
                                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                                disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                                placeholder="16.0"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">%</span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-1 font-bold">Standard statutory percentage tax rate specified for this trader's business.</p>
                                    </div>
                                </div>
                                
                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <button 
                                        onClick={handleSyncProfile}
                                        disabled={user?.role !== 'admin' && user?.role !== 'manager'}
                                        className="w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-xl text-[10px] shadow-lg hover:bg-slate-800 disabled:bg-slate-300 transition"
                                    >
                                        Synchronize Profile
                                    </button>
                                </div>
                            </div>

                            {/* 2. Subscription & Status */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                                        <Crown size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Subscription & Plan</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Billing & access status</p>
                                    </div>
                                </div>
                                <div className="bg-slate-900 text-white p-6 rounded-2xl mb-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
                                    <div className="relative z-10">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">Current active plan</span>
                                        <h3 className="text-2xl font-black uppercase tracking-tight mt-1">{selectedTrader.plan}</h3>
                                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end">
                                            <div>
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Expires At</span>
                                                <div className="text-sm font-black text-slate-200 mt-1">{selectedTrader.subscriptionExpiresAt || 'Indefinite'}</div>
                                            </div>
                                            <button className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-900 px-3 py-1.5 rounded-lg shadow-lg shadow-amber-500/20">Upgrade</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                                <DollarSign size={14} />
                                            </div>
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Auto-Renewal</span>
                                        </div>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={selectedTrader.autoRenew} readOnly className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                                                <ShieldCheck size={14} />
                                            </div>
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Network Access</span>
                                        </div>
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">Authorized</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Global System Config */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center">
                                        <Settings size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Node Config</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Internal system protocols</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Backup Management Path</label>
                                        <input 
                                            type="text" 
                                            defaultValue={selectedTrader.backupPath || '/primeaxis/backups/node-001'}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 font-mono focus:ring-2 focus:ring-slate-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Node Local IP Gateway</label>
                                        <input 
                                            type="text" 
                                            defaultValue={selectedTrader.serverIp || '192.168.1.45'}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 font-mono focus:ring-2 focus:ring-slate-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <button className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl hover:bg-slate-800 transition">
                                            Initiate Global Data Sync
                                        </button>
                                        <button className="w-full py-3 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-100 transition">
                                            Purge Node Cache
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* High-Fidelity Receipt Customizer Section (Original Printer Content) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start pt-12 border-t border-slate-200">
                            {/* Customizer Panel */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col gap-6">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                        <Printer size={16} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">POS Document Architect</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Design thermal outputs</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-6">
                                    {/* Custom Logo/Symbol Upload */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thermal Branding Symbol</label>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            {printerForm.logoUrl ? (
                                                <div className="relative shrink-0">
                                                    <img 
                                                        src={printerForm.logoUrl} 
                                                        alt="Uploaded Logo" 
                                                        className="w-20 h-20 object-contain rounded-xl border border-slate-200 bg-white shadow-sm" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setPrinterForm({...printerForm, logoUrl: ''})}
                                                        className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-full p-1 shadow-lg transition w-6 h-6 flex items-center justify-center font-bold"
                                                        title="Remove Logo"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-white text-slate-300 shrink-0">
                                                    <Upload size={20} />
                                                    <span className="text-[9px] font-black mt-2 uppercase tracking-tighter">EMPTY</span>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <label className="inline-block bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-sm cursor-pointer transition">
                                                    Inject custom symbol
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                if (file.size > 2 * 1024 * 1024) {
                                                                    showToast('Image is too large. Please select an image under 2MB.');
                                                                    return;
                                                                }
                                                                const reader = new FileReader();
                                                                reader.onload = () => {
                                                                    setPrinterForm({
                                                                        ...printerForm,
                                                                        logoUrl: reader.result as string
                                                                    });
                                                                    showToast('Custom logo loaded! Remember to save changes.');
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="hidden" 
                                                    />
                                                </label>
                                                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tight">Supports PNG, JPG, SVG up to 2MB. Stored on trader's secure node.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Header Note */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">High-Visibility Header Slogan</label>
                                        <input 
                                            type="text" 
                                            value={printerForm.receiptHeader}
                                            onChange={e => setPrinterForm({...printerForm, receiptHeader: e.target.value})}
                                            placeholder="Your trusted wholesale partner"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                                        />
                                    </div>

                                    {/* Footer Note */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Legal Disclaimers & Footer Notes</label>
                                        <textarea 
                                            rows={3}
                                            value={printerForm.receiptFooter}
                                            onChange={e => setPrinterForm({...printerForm, receiptFooter: e.target.value})}
                                            placeholder="Goods once sold are not returnable."
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none font-mono leading-relaxed"
                                        />
                                    </div>

                                    {/* Percentage Tax Setting to be applied on the sale */}
                                    <div className="bg-gradient-to-br from-emerald-50/70 to-slate-50 border-2 border-emerald-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                                    <Percent size={15} />
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider">POS Document Architect — Tax Rate Setting</h5>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Indicate the statutory percentage tax rate applied on trader's settings</p>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                printerForm.applyTax 
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                                    : 'bg-slate-200 text-slate-600 border-slate-300'
                                            }`}>
                                                {printerForm.applyTax ? `${printerForm.taxRate}% Specified` : 'Tax Exempt'}
                                            </span>
                                        </div>

                                        {/* Toggle Switch to Indicate Tax on Documents */}
                                        <label className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-400 transition select-none">
                                            <div className="flex flex-col pr-3">
                                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Apply Percentage Tax to POS Sales</span>
                                                <span className="text-[9px] text-slate-400 font-medium">Automatic tax is removed from checkout. The percentage tax indicated here will be applied directly to your sales and POS receipts.</span>
                                            </div>
                                            <input 
                                                type="checkbox"
                                                checked={printerForm.applyTax}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setPrinterForm({ 
                                                        ...printerForm, 
                                                        applyTax: checked,
                                                        taxRate: checked && printerForm.taxRate === 0 ? 16 : (checked ? printerForm.taxRate : 0)
                                                    });
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                            />
                                        </label>

                                        {/* Tax Rate % Input and Label */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                                                    Sales Tax Percentage (%)
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        disabled={!printerForm.applyTax}
                                                        value={printerForm.taxRate}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value);
                                                            setPrinterForm({ 
                                                                ...printerForm, 
                                                                taxRate: isNaN(val) ? 0 : Math.max(0, Math.min(100, val)) 
                                                            });
                                                        }}
                                                        className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none font-mono disabled:bg-slate-100 disabled:text-slate-400"
                                                        placeholder="16.0"
                                                    />
                                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">%</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
                                                    Tax Protocol Label / Name
                                                </label>
                                                <input 
                                                    type="text"
                                                    disabled={!printerForm.applyTax}
                                                    value={printerForm.taxLabel}
                                                    onChange={e => setPrinterForm({ ...printerForm, taxLabel: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none font-mono disabled:bg-slate-100 disabled:text-slate-400"
                                                    placeholder="VAT"
                                                />
                                            </div>
                                        </div>

                                        {/* Fast Statutory Presets */}
                                        <div>
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Statutory & Regional Presets:</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { label: '0% (Exempt)', rate: 0, taxLabel: 'TAX EXEMPT' },
                                                    { label: '5% (Reduced)', rate: 5, taxLabel: 'VAT 5%' },
                                                    { label: '8% (Fuel / Eco)', rate: 8, taxLabel: 'VAT 8%' },
                                                    { label: '16% (Standard VAT)', rate: 16, taxLabel: 'VAT' },
                                                    { label: '18% (EAC Standard)', rate: 18, taxLabel: 'VAT 18%' }
                                                ].map(p => (
                                                    <button
                                                        key={p.label}
                                                        type="button"
                                                        onClick={() => setPrinterForm({ 
                                                            ...printerForm, 
                                                            applyTax: p.rate > 0, 
                                                            taxRate: p.rate, 
                                                            taxLabel: p.taxLabel 
                                                        })}
                                                        className={`text-[9px] font-black px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                                                            printerForm.applyTax && printerForm.taxRate === p.rate
                                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Checklist Toggle Switches */}
                                    <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-2">Metadata Visibility Protocols:</span>
                                        
                                        {[
                                            { id: 'showLogo', label: 'Thermal Brand Symbol', desc: 'Render node signature icon' },
                                            { id: 'showBusinessName', label: 'Business Entity Identity', desc: 'Display registered trading name' },
                                            { id: 'showLocation', label: 'Geographic Coordinates', desc: 'Show physical node address' },
                                            { id: 'showPhone', label: 'Communications Gateway', desc: 'Show primary contact phone' },
                                            { id: 'showTaxId', label: 'Fiscal Compliance ID', desc: 'Render tax/registration number' },
                                            { id: 'showDiscount', label: 'Fiscal Reductions', desc: 'Display discount calculations' },
                                            { id: 'applyTax', label: 'Fiscal Tax Protocol', desc: 'Calculate & render tax breakdown on sale' }
                                        ].map((item) => (
                                            <label key={item.id} className="flex items-center justify-between p-2 hover:bg-white/50 rounded-xl cursor-pointer select-none transition">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{item.label}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.desc}</span>
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    checked={(printerForm as any)[item.id]}
                                                    onChange={e => setPrinterForm({...printerForm, [item.id]: e.target.checked})}
                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <button 
                                        onClick={handleSavePrinterSettings}
                                        className="flex-1 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest py-4 rounded-2xl text-xs shadow-2xl transition cursor-pointer"
                                    >
                                        <Save size={16} />
                                        Update Node Config
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => window.print()}
                                        className="flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-black uppercase tracking-widest px-6 py-4 rounded-2xl text-xs border-2 border-slate-900 transition cursor-pointer"
                                    >
                                        <Printer size={16} />
                                        Sample
                                    </button>
                                </div>
                            </div>

                            {/* Interactive Receipt Mockup */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                                        <Eye size={14} className="text-emerald-500" /> Output Stream Simulator
                                    </span>
                                    <span className="bg-slate-900 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">v4.2 Secure</span>
                                </div>
                                
                                <div className="bg-white border-2 border-slate-300 rounded-[2rem] p-8 shadow-2xl relative max-w-sm w-full mx-auto font-mono text-[11px] text-black overflow-hidden">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-2 bg-slate-200 rounded-b-xl"></div>
                                    <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full p-1 animate-pulse">
                                        <ShieldCheck size={10} />
                                    </div>

                                {/* Thermal Header */}
                                <div className="text-center mt-6 mb-8">
                                    {printerForm.showLogo && (
                                        printerForm.logoUrl ? (
                                            <img 
                                                src={printerForm.logoUrl} 
                                                alt="Custom Logo" 
                                                className="w-20 h-20 object-contain mx-auto mb-3 grayscale brightness-75" 
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <LogoSVG className="w-12 h-12 mx-auto mb-3 grayscale brightness-75" />
                                        )
                                    )}
                                    <h3 className="font-black text-lg uppercase tracking-tighter leading-none mb-1">
                                        {printerForm.showBusinessName && selectedTrader.businessName && selectedTrader.businessName !== '—'
                                            ? selectedTrader.businessName 
                                            : 'Primeaxis Node'}
                                    </h3>
                                    {printerForm.receiptHeader && <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-tight">"{printerForm.receiptHeader}"</p>}
                                    {printerForm.showLocation && (
                                        <p className="text-[9px] text-slate-800 mt-2 font-bold uppercase tracking-widest">{selectedTrader.location || 'Nairobi Hub'}</p>
                                    )}
                                    <div className="mt-4 font-black uppercase border-2 border-black inline-block px-3 py-1 text-[12px] tracking-widest">
                                        Fiscal Receipt
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="border-b-2 border-black border-dashed pb-3 mb-4 space-y-1">
                                    <div className="flex justify-between">
                                        <span className="font-bold">TXN ID:</span><span className="font-black">PRM-99283-X</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">TIMESTAMP:</span><span className="font-black">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">NODE OPS:</span><span className="font-black uppercase">{selectedTrader.fullName}</span>
                                    </div>
                                    {printerForm.showPhone && selectedTrader.phone && selectedTrader.phone !== '—' && (
                                        <div className="flex justify-between">
                                            <span className="font-bold">TEL:</span><span className="font-black">{selectedTrader.phone}</span>
                                        </div>
                                    )}
                                    {printerForm.showTaxId && selectedTrader.taxId && selectedTrader.taxId !== '—' && (
                                        <div className="flex justify-between">
                                            <span className="font-bold">TAX REF:</span><span className="font-black">{selectedTrader.taxId}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Sample Items */}
                                <div className="mb-2">
                                    <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
                                        <span>Item Description</span><span>Total</span>
                                    </div>
                                    <div className="mb-1">
                                        <div className="flex justify-between">
                                            <span>Fresh Tomatoes</span><span>{getCurrencyByLocation(selectedTrader?.location).symbol} 400.00</span>
                                        </div>
                                        <div className="text-[9px] pl-2 text-slate-500">5 x {getCurrencyByLocation(selectedTrader?.location).symbol} 80.00</div>
                                    </div>
                                    <div className="mb-1">
                                        <div className="flex justify-between">
                                            <span>Milk 1L Pack</span><span>{getCurrencyByLocation(selectedTrader?.location).symbol} 300.00</span>
                                        </div>
                                        <div className="text-[9px] pl-2 text-slate-500">2 x {getCurrencyByLocation(selectedTrader?.location).symbol} 150.00</div>
                                    </div>
                                </div>

                                {/* Totals calculation */}
                                {(() => {
                                    const sub = 700;
                                    const disc = selectedTrader.discountRate > 0 && printerForm.showDiscount 
                                        ? (sub * selectedTrader.discountRate) / 100 
                                        : 0;
                                    const taxable = sub - disc;
                                    const effectiveRate = printerForm.applyTax ? (Number(printerForm.taxRate) || 0) : 0;
                                    const taxAmt = (taxable * effectiveRate) / 100;
                                    const grandTotal = taxable + taxAmt;
                                    const cur = getCurrencyByLocation(selectedTrader?.location);

                                    return (
                                        <div className="border-t-2 border-black border-dashed pt-4 flex flex-col gap-1.5">
                                            <div className="flex justify-between font-bold">
                                                <span>Subtotal:</span><span>{cur.symbol} {sub.toFixed(2)}</span>
                                            </div>
                                            {disc > 0 && (
                                                <div className="flex justify-between font-black text-slate-700 italic">
                                                    <span>Node Discount ({selectedTrader.discountRate}%):</span>
                                                    <span>-{cur.symbol} {disc.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {printerForm.applyTax && effectiveRate > 0 ? (
                                                <div className="flex justify-between font-black text-slate-900">
                                                    <span>{printerForm.taxLabel || 'VAT'} ({effectiveRate}%):</span>
                                                    <span>+{cur.symbol} {taxAmt.toFixed(2)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between text-slate-400 italic font-medium">
                                                    <span>Sales Tax (0% Exempt):</span>
                                                    <span>{cur.symbol} 0.00</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-black text-sm border-t-2 border-black pt-2 mt-2 tracking-tighter">
                                                <span>GRAND TOTAL ({cur.code}):</span>
                                                <span>{cur.symbol} {grandTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Mock thermal footer message */}
                                <div className="text-center mt-8 text-[9px] font-black text-slate-900 border-t-2 border-slate-100 pt-5 uppercase tracking-widest leading-relaxed">
                                    {printerForm.receiptFooter.split('\n').map((line, idx) => (
                                        <p key={idx} className="mb-0.5">{line}</p>
                                    ))}
                                    <p className="mt-4 text-[7px] text-slate-400">Authenticated by Primeaxis Secure Mesh</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                )}

            </div>
            ) : (
            <div className="p-6 overflow-y-auto w-full h-full bg-blue-50/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-2xl tracking-tight font-black text-slate-800">📋 All Onboarded Traders</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Manage merchant accounts, tier plans, active privileges, and batch updates.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm shadow-xs font-bold text-slate-600">
                        {filteredTraders.length} of {traders.length} traders
                    </span>
                    <button
                        onClick={() => {
                            setCsvModalMode('traders');
                            setIsCsvModalOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                        <FileSpreadsheet size={15} /> CSV Import Tool
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 shadow-xs flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px] relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search trader name, business, email, plan..."
                        value={traderSearchTerm}
                        onChange={e => setTraderSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Status:</span>
                    <select 
                        value={traderStatusFilter}
                        onChange={e => setTraderStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium outline-none"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Plan:</span>
                    <select 
                        value={traderPlanFilter}
                        onChange={e => setTraderPlanFilter(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium outline-none"
                    >
                        <option value="all">All Plans</option>
                        <option value="Starter">Starter ($50/mo)</option>
                        <option value="Pro">Pro ($100/mo)</option>
                        <option value="Premium / Enterprise">Premium / Enterprise ($250/mo)</option>
                        <option value="Distributor / Wholesale">Distributor / Wholesale ($500/mo)</option>
                        <option value="Basic">Basic (Legacy)</option>
                        <option value="Enterprise">Enterprise (Legacy)</option>
                        <option value="Distributor">Distributor (Legacy)</option>
                    </select>
                </div>
                {(traderSearchTerm || traderStatusFilter !== 'all' || traderPlanFilter !== 'all') && (
                    <button 
                        onClick={() => {
                            setTraderSearchTerm('');
                            setTraderStatusFilter('all');
                            setTraderPlanFilter('all');
                        }}
                        className="text-xs text-blue-600 font-bold hover:underline px-2 py-1"
                    >
                        Reset Filters
                    </button>
                )}
            </div>

            {/* Bulk Actions Menu Toolbar */}
            {selectedTraderIds.length > 0 && (
                <div className="bg-blue-900 text-white p-3 rounded-xl mb-4 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-800 text-blue-200 px-2.5 py-1 rounded-lg text-xs font-black tracking-wide uppercase flex items-center gap-1.5">
                            <CheckCircle size={14} className="text-emerald-400" />
                            <span>{selectedTraderIds.length} Traders Selected</span>
                        </div>
                        <span className="text-xs text-blue-200 hidden sm:inline">Perform bulk operations on selected accounts</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status dropdown / button */}
                        <div className="flex items-center bg-blue-800 rounded-lg p-0.5 border border-blue-700">
                            <button
                                onClick={() => handleBulkUpdateStatus('active')}
                                disabled={isBulkUpdatingTraders}
                                className="px-2.5 py-1 rounded text-xs font-bold hover:bg-emerald-600 hover:text-white text-emerald-300 transition disabled:opacity-50 cursor-pointer"
                                title="Mark all selected traders as Active"
                            >
                                Set Active
                            </button>
                            <button
                                onClick={() => handleBulkUpdateStatus('pending')}
                                disabled={isBulkUpdatingTraders}
                                className="px-2.5 py-1 rounded text-xs font-bold hover:bg-amber-600 hover:text-white text-amber-300 transition disabled:opacity-50 cursor-pointer"
                                title="Mark all selected traders as Pending"
                            >
                                Set Pending
                            </button>
                            <button
                                onClick={() => handleBulkUpdateStatus('suspended')}
                                disabled={isBulkUpdatingTraders}
                                className="px-2.5 py-1 rounded text-xs font-bold hover:bg-red-600 hover:text-white text-rose-300 transition disabled:opacity-50 cursor-pointer"
                                title="Mark all selected traders as Suspended"
                            >
                                Suspend
                            </button>
                        </div>

                        {/* Plan change button */}
                        <button
                            onClick={() => setIsBulkPlanModalOpen(true)}
                            className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <Crown size={13} className="text-amber-400" />
                            Change Plan
                        </button>

                        {/* Export selected CSV */}
                        <button
                            onClick={handleExportSelectedTradersCsv}
                            className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <FileSpreadsheet size={13} className="text-emerald-400" />
                            Export CSV
                        </button>

                        {/* Delete selected */}
                        <button
                            onClick={handleBulkDeleteTraders}
                            disabled={isBulkDeletingTraders}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                            {isBulkDeletingTraders ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            Delete ({selectedTraderIds.length})
                        </button>

                        {/* Clear selection */}
                        <button
                            onClick={() => setSelectedTraderIds([])}
                            className="text-blue-300 hover:text-white text-xs font-bold px-2 py-1 transition cursor-pointer"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
            )}

            {filteredTraders.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <Users size={64} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold text-slate-600">No traders match the current criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try changing your search term or filter parameters.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                                <th className="p-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={filteredTraders.length > 0 && selectedTraderIds.length === filteredTraders.length}
                                        onChange={toggleSelectAllTraders}
                                    />
                                </th>
                                <th className="p-4 text-sm text-slate-700">#</th>
                                <th className="p-4 text-sm text-slate-700">Name</th>
                                <th className="p-4 text-sm text-slate-700">Business</th>
                                <th className="p-4 text-sm text-slate-700">Email</th>
                                <th className="p-4 text-sm text-slate-700 font-mono text-xs">Plan Tier</th>
                                <th className="p-4 text-sm text-slate-700">Discount</th>
                                <th className="p-4 text-sm text-slate-700">Status</th>
                                <th className="p-4 text-sm text-slate-700 text-center">Manage Account</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTraders.map((t, i) => {
                                const isSelected = selectedTraderIds.includes(t.id);
                                return (
                                    <tr 
                                        key={t.id} 
                                        className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition ${
                                            isSelected ? 'bg-blue-50/60' : ''
                                        }`}
                                    >
                                        <td className="p-4 w-10">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => toggleSelectTrader(t.id)}
                                            />
                                        </td>
                                        <td className="p-4 text-sm text-slate-400">{i + 1}</td>
                                        <td className="p-4 text-sm font-bold text-slate-800">{t.fullName}</td>
                                        <td className="p-4 text-sm text-slate-600">{t.businessName || '—'}</td>
                                        <td className="p-4 text-sm text-slate-600 font-mono text-xs">{t.email}</td>
                                        <td className="p-4 text-sm">
                                            <span className="bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded text-xs font-bold">{t.plan}</span>
                                        </td>
                                        <td className="p-4 text-sm text-emerald-600 font-bold">{t.discountRate}%</td>
                                        <td className="p-4 text-sm">
                                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                                                t.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                t.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                'bg-red-100 text-red-800 border border-red-200'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-center">
                                            <button 
                                                onClick={() => setSelectedTraderId(t.id)}
                                                className="bg-green-700 hover:bg-green-800 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                                            >
                                                <Settings size={12} />
                                                Hub & Settings
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Bulk Plan Modal */}
            {isBulkPlanModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                                    <Crown size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Batch Update Subscription Plan</h3>
                                    <p className="text-[11px] text-slate-400">Assigning new plan to {selectedTraderIds.length} selected traders</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsBulkPlanModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Select Target Plan Tier</label>
                                <select 
                                    value={bulkPlanTarget}
                                    onChange={e => setBulkPlanTarget(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Starter">Starter ($50/mo · 50 stock items · 3 users)</option>
                                    <option value="Pro">Pro ($100/mo · 100 stock items · 5 users)</option>
                                    <option value="Premium / Enterprise">Premium / Enterprise ($250/mo · 101–500 items · 10 users)</option>
                                    <option value="Distributor / Wholesale">Distributor / Wholesale ($500/mo · 500+ items · 100–200 vendors)</option>
                                </select>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsBulkPlanModalOpen(false)}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleBulkUpdatePlan(bulkPlanTarget)}
                                    disabled={isBulkUpdatingTraders}
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    {isBulkUpdatingTraders ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                    Apply Plan to {selectedTraderIds.length} Traders
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            </div>
        )}
        <CsvImportModal 
            isOpen={isCsvModalOpen} 
            onClose={() => setIsCsvModalOpen(false)} 
            defaultMode={csvModalMode} 
            traderId={selectedTraderId || undefined} 
        />
    </div>
);
};

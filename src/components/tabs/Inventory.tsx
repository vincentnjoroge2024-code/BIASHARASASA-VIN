import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../../context';
import { 
    addInventoryItem, 
    deleteInventoryItem, 
    bulkDeleteInventoryItems,
    bulkUpdateInventoryItems,
    importData, 
    exportData, 
    bulkAddInventoryItems, 
    updateInventoryItem,
    getMarketplace,
    getInteropRequests,
    createInteropRequest,
    updateInteropRequestStatus,
    getPurchaseOrders,
    getGoodsReceiptNotes,
    syncOfflineData,
    logTraderBackupSync
} from '../../api';
import { 
    Package, Trash2, Upload, Download, Search, FileSpreadsheet, RefreshCw, Printer,
    ChevronRight, Info, DollarSign, Truck, FileText, X, Plus, AlertCircle, 
    ExternalLink, Barcode, Tag, Box, Globe, Share2, ShoppingBag, ArrowRightLeft,
    Clock, CheckCircle, XCircle, Building, ArrowUpRight, ArrowDownLeft, MessageSquare,
    Users, FileDown, Receipt, LayoutGrid, AlertTriangle, Filter, Sliders, BarChart, PieChart, History, Settings, Server, ShieldAlert, ShieldCheck, Zap,
    Activity, Calendar, Sparkles, Check
} from 'lucide-react';
import { formatCurrency, InventoryItem, InteropRequest, PurchaseOrder, GoodsReceiptNote } from '../../types';
import { getAuditLogs } from '../../api';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentModal } from '../DocumentModal';
import { ConflictResolutionModal, DataConflict } from '../ConflictResolutionModal';
import { CsvImportModal } from '../CsvImportModal';
import { A4InventoryReportModal } from '../A4InventoryReportModal';
import * as XLSX from 'xlsx';

type FormTab = 'general' | 'pricing' | 'supply' | 'details';
type InventorySubTab = 'my-inventory' | 'marketplace' | 'requests' | 'documents' | 'analytics' | 'bulk-import' | 'settings';

export const InventoryTab: React.FC = () => {
    const { 
        inventory: rawInventory, traders, refreshData, showToast, user, t, 
        isOnline, isSyncing, logAuditAction, 
        localServerIp, setLocalServerIp,
        selectedSellingPoint, setSelectedSellingPoint 
    } = useAppContext();
    const inventory = Array.isArray(rawInventory) ? rawInventory : [];
    const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('my-inventory');
    
    // Interop states
    const [marketplace, setMarketplace] = useState<(InventoryItem & { businessName: string })[]>([]);
    const [requests, setRequests] = useState<InteropRequest[]>([]);
    const [loadingNetwork, setLoadingNetwork] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const isSystemAdmin = user?.role === 'admin' && (user?.username?.toLowerCase().includes('admin') || !user?.traderId);
    const loggedInTrader = user?.traderId 
        ? traders.find(t => t.id === user.traderId) 
        : (traders.find(t => t.email.toLowerCase() === user?.username.toLowerCase()) || (isSystemAdmin ? traders[0] : null));

    const effectiveTraderId = loggedInTrader?.id || user?.traderId || (user as any)?.trader_id || null;
    const effectiveTenantId = (user as any)?.tenant_id || (effectiveTraderId ? `tenant_${effectiveTraderId}` : null);

    const [searchQuery, setSearchQuery] = useState('');
    
    // RBAC Permission Helpers
    const permissions = user?.permissions || { 
        pos: true, inventory: true, production: true, finance: true, tax: true, reports: true, hr: true, manage_team: true 
    };
    const canAdd = permissions.inventory || isSystemAdmin;
    const canEdit = permissions.inventory || isSystemAdmin;
    const canDelete = permissions.inventory || isSystemAdmin;
    const canImport = permissions.inventory || isSystemAdmin;
    
    const [uploading, setUploading] = useState(false);
    const [isSyncingData, setIsSyncingData] = useState(false);
    const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
    const notifiedItemsRef = useRef<Set<number>>(new Set());
    const [lowStockCount, setLowStockCount] = useState(0);

    const safeInventory = useMemo(() => Array.isArray(inventory) ? inventory : [], [inventory]);

    // Automated Notification System: Monitor inventory for low stock levels
    useEffect(() => {
        if (!safeInventory || safeInventory.length === 0) return;

        const myInventory = !isSystemAdmin
            ? (effectiveTraderId || effectiveTenantId 
                ? safeInventory.filter(item => {
                    if (effectiveTraderId && item.traderId === effectiveTraderId) return true;
                    if (effectiveTenantId && item.tenantId === effectiveTenantId) return true;
                    if (effectiveTraderId && item.tenantId === `tenant_${effectiveTraderId}`) return true;
                    return false;
                })
                : [])
            : safeInventory;

        const currentlyLow = myInventory.filter(item => item.quantity <= (item.reorderLevel || 0));
        setLowStockCount(currentlyLow.length);

        // Notify user about newly discovered low stock items
        currentlyLow.forEach(item => {
            if (!notifiedItemsRef.current.has(item.id)) {
                showToast(`Alert: ${item.name} is low on stock (${item.quantity} remaining). Threshold: ${item.reorderLevel}`, "warning");
                notifiedItemsRef.current.add(item.id);
            }
        });

        // Clean up notified set if items are no longer low or removed
        const currentlyLowIds = new Set(currentlyLow.map(i => i.id));
        notifiedItemsRef.current.forEach(id => {
            if (!currentlyLowIds.has(id)) {
                notifiedItemsRef.current.delete(id);
            }
        });
    }, [inventory, loggedInTrader, showToast]);
    const [isA4ReportOpen, setIsA4ReportOpen] = useState(false);
    const [activeFormTab, setActiveFormTab] = useState<FormTab>('general');
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
    const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [bulkUpdateField, setBulkUpdateField] = useState<'category' | 'taxCategory' | 'reorderLevel' | 'supplier' | 'status'>('category');
    const [bulkUpdateValue, setBulkUpdateValue] = useState<string>('');
    const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

    // Document Modal State
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docType, setDocType] = useState<'Purchase Order' | 'Goods Receipt Note'>('Purchase Order');
    const [docData, setDocData] = useState<PurchaseOrder | GoodsReceiptNote | null>(null);
    const [loadingDoc, setLoadingDoc] = useState(false);

    // Single Request Modal State
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestModalItem, setRequestModalItem] = useState<(InventoryItem & { businessName: string }) | null>(null);
    const [requestQuantity, setRequestQuantity] = useState(1);
    const [requestNotes, setRequestNotes] = useState('');
    const [submittingRequest, setSubmittingRequest] = useState(false);

    // Stock Adjustment Modal State
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
    const [adjustmentQty, setAdjustmentQty] = useState(0);
    const [adjustmentReason, setAdjustmentReason] = useState('Damaged');
    const [adjustmentNotes, setAdjustmentNotes] = useState('');
    const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

    // Rejection Modal State
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [submittingRejection, setSubmittingRejection] = useState(false);

    // Stock History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

    // Conflict Resolution Modal State
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [activeConflict, setActiveConflict] = useState<DataConflict | null>(null);

    // Bulk Import Tab States
    const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'summary'>('upload');
    const [importStrategy, setImportStrategy] = useState<'skip' | 'overwrite' | 'append'>('skip');
    const [importRawText, setImportRawText] = useState('');
    const [importFileName, setImportFileName] = useState('');
    const [importCsvHeaders, setImportCsvHeaders] = useState<string[]>([]);
    const [importCsvRows, setImportCsvRows] = useState<string[][]>([]);
    const [importColumnMap, setImportColumnMap] = useState<Record<string, string>>({});
    const [importParsedRows, setImportParsedRows] = useState<any[]>([]);
    const [importActiveFilter, setImportActiveFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
    const [importResult, setImportResult] = useState<{addedCount: number, updatedCount: number, skippedCount: number, message: string} | null>(null);
    const [isDraggingImportFile, setIsDraggingImportFile] = useState(false);
    const [importInputMode, setImportInputMode] = useState<'upload' | 'paste'>('upload');
    const [pastedDataText, setPastedDataText] = useState('');
    const [editingRowId, setEditingRowId] = useState<number | null>(null);

    const handleTriggerConflictResolution = (customConflict?: DataConflict) => {
        const itemToUse = filteredInventory[0];
        const conflictToUse: DataConflict = customConflict || {
            id: `COL-INV-${Math.floor(1000 + Math.random() * 9000)}`,
            entityType: 'Inventory Item',
            entityName: itemToUse?.name || 'Tomatoes - Fresh Grade A',
            skuOrRef: itemToUse?.sku || 'T001',
            lastLocalEditTime: '2 mins ago (Local Device POS)',
            lastServerEditTime: '5 mins ago (Central Cloud API)',
            localAuthor: loggedInTrader?.fullName || 'POS Offline Cashier',
            serverAuthor: 'Central Logistics Database',
            fields: [
                { 
                    fieldName: 'quantity', 
                    label: 'Stock Quantity', 
                    localValue: (itemToUse?.quantity || 300) + 50, 
                    serverValue: itemToUse?.quantity || 250, 
                    isConflicting: true 
                },
                { 
                    fieldName: 'unitPrice', 
                    label: 'Unit Selling Price', 
                    localValue: `FBu ${(itemToUse?.unitPrice || 80) + 10}`, 
                    serverValue: `FBu ${itemToUse?.unitPrice || 80}`, 
                    isConflicting: true 
                },
                { 
                    fieldName: 'costPrice', 
                    label: 'Unit Cost Price', 
                    localValue: `FBu ${(itemToUse?.costPrice || 65)}`, 
                    serverValue: `FBu ${(itemToUse?.costPrice || 60)}`, 
                    isConflicting: true 
                },
                { 
                    fieldName: 'location', 
                    label: 'Warehouse Node', 
                    localValue: 'Bujumbura Store #1', 
                    serverValue: 'Bujumbura Main Depot', 
                    isConflicting: true 
                },
                { 
                    fieldName: 'reorderLevel', 
                    label: 'Reorder Threshold', 
                    localValue: itemToUse?.reorderLevel || 50, 
                    serverValue: itemToUse?.reorderLevel || 50, 
                    isConflicting: false 
                }
            ]
        };
        setActiveConflict(conflictToUse);
        setIsConflictModalOpen(true);
    };
    const [itemAuditLogs, setItemAuditLogs] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleViewPO = async (requestId: number) => {
        setLoadingDoc(true);
        try {
            const res = await getPurchaseOrders(requestId);
            if (res && res.length > 0) {
                setDocType('Purchase Order');
                setDocData(res[0]);
                setIsDocModalOpen(true);
            } else {
                showToast("Purchase Order not found", "error");
            }
        } catch (err) {
            showToast("Failed to load Purchase Order", "error");
        } finally {
            setLoadingDoc(false);
        }
    };

    const handleBulkApprovePOs = async () => {
        if (selectedRequestIds.length === 0) {
            showToast("Please select Purchase Orders (POs) or requests to approve", "info");
            return;
        }
        setLoadingNetwork(true);
        try {
            let successCount = 0;
            for (const id of selectedRequestIds) {
                const res = await updateInteropRequestStatus(id, 'approved', 'Bulk PO Approved by Trader');
                if (res.success) successCount++;
            }
            showToast(`Bulk Action Completed: Approved ${successCount} Purchase Order(s) successfully! Sub-items cleared & reserved.`, "success");
            setSelectedRequestIds([]);
            fetchNetworkData();
            refreshData();
            await logAuditAction('bulk_po_approval', { approvedCount: successCount, requestIds: selectedRequestIds }, 'info');
        } catch (err: any) {
            showToast("Failed to bulk approve POs: " + (err.message || 'Unknown error'), "error");
        } finally {
            setLoadingNetwork(false);
        }
    };

    const handleBulkApproveGRNs = async () => {
        if (selectedRequestIds.length === 0) {
            showToast("Please select Goods Receipt Notes (GRNs) or shipped items to confirm receipt", "info");
            return;
        }
        setLoadingNetwork(true);
        try {
            let successCount = 0;
            for (const id of selectedRequestIds) {
                const res = await updateInteropRequestStatus(id, 'received', 'Bulk GRN Confirmed & Stock Added');
                if (res.success) successCount++;
            }
            showToast(`Bulk Action Completed: Confirmed & Approved ${successCount} Goods Receipt Note(s) (GRN)! Items added to inventory.`, "success");
            setSelectedRequestIds([]);
            fetchNetworkData();
            refreshData();
            await logAuditAction('bulk_grn_approval', { grnCount: successCount, requestIds: selectedRequestIds }, 'info');
        } catch (err: any) {
            showToast("Failed to bulk approve GRNs: " + (err.message || 'Unknown error'), "error");
        } finally {
            setLoadingNetwork(false);
        }
    };

    const handleBulkRejectRequests = async () => {
        if (selectedRequestIds.length === 0) return;
        setLoadingNetwork(true);
        try {
            let successCount = 0;
            for (const id of selectedRequestIds) {
                const res = await updateInteropRequestStatus(id, 'rejected', 'Bulk rejected by trader');
                if (res.success) successCount++;
            }
            showToast(`Bulk Action Completed: Declined ${successCount} request(s).`, "info");
            setSelectedRequestIds([]);
            fetchNetworkData();
            refreshData();
        } catch (err: any) {
            showToast("Failed to bulk reject requests", "error");
        } finally {
            setLoadingNetwork(false);
        }
    };

    const handleConsolidatePO = () => {
        if (selectedRequestIds.length === 0) return;
        
        const selectedRequests = outgoingRequests.filter(r => selectedRequestIds.includes(r.id));
        if (selectedRequests.length === 0) return;
        
        // Check if all selected requests are from the same provider
        const firstProviderId = selectedRequests[0].providerId;
        const differentProviders = selectedRequests.some(r => r.providerId !== firstProviderId);
        
        if (differentProviders) {
            showToast("Please select requests from the same supplier to consolidate into one PO.", "error");
            return;
        }
        
        const requester = traders.find(t => t.id === selectedRequests[0].requesterId);
        const provider = traders.find(t => t.id === selectedRequests[0].providerId);
        
        const consolidatedItems = selectedRequests.map(req => ({
            name: req.itemName,
            sku: req.sku,
            quantity: req.quantity,
            price: req.price,
            total: req.quantity * req.price
        }));
        
        const totalAmount = consolidatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
        
        setDocType('Purchase Order');
        setDocData({
            id: 0,
            poNumber: `CON-PO-${Date.now().toString().slice(-6)}`,
            requestId: selectedRequests[0].id, // Reference one of them
            requesterId: selectedRequests[0].requesterId,
            providerId: selectedRequests[0].providerId,
            items: consolidatedItems,
            total: totalAmount,
            status: 'draft',
            createdAt: new Date().toISOString(),
            // UI specific
            requester: requester,
            provider: provider
        } as any);
        
        setIsDocModalOpen(true);
    };

    const handleViewGRN = async (requestId: number) => {
        setLoadingDoc(true);
        try {
            const res = await getGoodsReceiptNotes(requestId);
            if (res && res.length > 0) {
                setDocType('Goods Receipt Note');
                setDocData(res[0]);
                setIsDocModalOpen(true);
            } else {
                showToast("Goods Receipt Note not found", "error");
            }
        } catch (err) {
            showToast("Failed to load Goods Receipt Note", "error");
        } finally {
            setLoadingDoc(false);
        }
    };

    const initialFormData = {
        name: '', sku: '', barcode: '', category: '', brand: '', model: '', uom: 'pcs',
        quantity: '', unitPrice: '', costPrice: '', wholesalePrice: '', retailPrice: '', taxCategory: 'General', taxRate: '0',
        supplier: '', manufacturer: '', countryOfOrigin: '', reorderLevel: '',
        description: '', images: [] as string[], location: ''
    };

    const [formData, setFormData] = useState(initialFormData);

    // Automated Low Stock Notification System
    useEffect(() => {
        if (!safeInventory || safeInventory.length === 0) return;

        const myItems = !isSystemAdmin
            ? safeInventory.filter(item => {
                if (effectiveTraderId && item.traderId === effectiveTraderId) return true;
                if (effectiveTenantId && item.tenantId === effectiveTenantId) return true;
                if (effectiveTraderId && item.tenantId === `tenant_${effectiveTraderId}`) return true;
                return false;
            })
            : safeInventory;
        const lowStockItems = myItems.filter(item => {
            const isLow = item.quantity <= (item.reorderLevel || 0);
            const alreadyNotified = notifiedItemsRef.current.has(item.id);
            return isLow && !alreadyNotified;
        });

        if (lowStockItems.length > 0) {
            lowStockItems.forEach(item => {
                showToast(`Low Stock Alert: ${item.name} (Qty: ${item.quantity})`, 'info');
                notifiedItemsRef.current.add(item.id);
            });
        }
    }, [inventory, isSystemAdmin, effectiveTraderId, effectiveTenantId, showToast]);

    // View and Batch Restock States
    const [marketplaceViewMode, setMarketplaceViewMode] = useState<'grouped' | 'grid'>('grouped');
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
    const [restockItemsState, setRestockItemsState] = useState<{ [sku: string]: { checked: boolean; quantity: number } }>({});
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [restockNotes, setRestockNotes] = useState('');
    const [submittingRestock, setSubmittingRestock] = useState(false);

    const getSuggestedQty = (sku: string) => {
        const userItem = inventory.find(i => i.sku === sku && i.traderId === effectiveTraderId);
        if (userItem) {
            const low = userItem.quantity <= userItem.reorderLevel;
            if (low) {
                return Math.max(1, (userItem.reorderLevel * 2) - userItem.quantity);
            }
        }
        return 1;
    };

    const handleOpenRestockModal = (supplierTrader: any, prefilledSkus?: { [sku: string]: number }) => {
        setSelectedSupplier(supplierTrader);
        
        // Find all products listed by this supplier in the marketplace
        const supplierMarketplaceItems = marketplace.filter(item => item.traderId === supplierTrader.id);
        
        const initialStates: { [sku: string]: { checked: boolean; quantity: number } } = {};
        supplierMarketplaceItems.forEach(item => {
            const hasPrefill = prefilledSkus && prefilledSkus[item.sku] !== undefined;
            initialStates[item.sku] = {
                checked: hasPrefill,
                quantity: hasPrefill ? prefilledSkus[item.sku] : getSuggestedQty(item.sku)
            };
        });
        
        setRestockItemsState(initialStates);
        setRestockNotes('');
        setIsRestockModalOpen(true);
    };

    const handleSubmitBatchRestock = async () => {
        if (!effectiveTraderId) {
            showToast("You must be logged in as a trader to make requests", "error");
            return;
        }
        if (!selectedSupplier) return;

        const itemsToRequest = marketplace.filter(item => {
            if (item.traderId !== selectedSupplier.id) return false;
            const state = restockItemsState[item.sku];
            return state && state.checked && state.quantity > 0;
        });

        if (itemsToRequest.length === 0) {
            showToast("Please select at least one item to restock", "error");
            return;
        }

        setSubmittingRestock(true);
        try {
            let successCount = 0;
            for (const item of itemsToRequest) {
                const state = restockItemsState[item.sku];
                const res = await createInteropRequest({
                    requesterId: effectiveTraderId,
                    providerId: selectedSupplier.id,
                    itemName: item.name,
                    sku: item.sku,
                    quantity: state.quantity,
                    price: item.unitPrice,
                    notes: restockNotes
                });
                if (res.success) {
                    successCount++;
                }
            }

            if (successCount > 0) {
                showToast(`Successfully created ${successCount} restocking requests and Purchase Orders!`, "success");
                setIsRestockModalOpen(false);
                fetchNetworkData();
                refreshData();
            } else {
                showToast("Failed to create restocking requests", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Failed to create restocking requests", "error");
        } finally {
            setSubmittingRestock(false);
        }
    };

    const fetchNetworkData = async () => {
        setLoadingNetwork(true);
        try {
            const [mRes, rRes] = await Promise.all([
                getMarketplace(),
                getInteropRequests(effectiveTraderId || undefined)
            ]);
            const filteredMarket = (mRes as any[]).filter(i => {
                // 1. Never show own items
                if (i.traderId === effectiveTraderId) return false;
                
                // 2. Admins see everything else
                if (user?.role === 'admin') return true;
                
                // 3. For traders, filter by "related" data (Same Location or Same Distributor Network)
                const traderLocation = loggedInTrader?.location;
                const traderDistributorId = loggedInTrader?.distributorId;
                
                // If trader has a location, show items from same location
                const matchesLocation = traderLocation && i.location === traderLocation;
                
                // If trader has a distributor, show items from that distributor or other traders under same distributor
                const matchesDistributor = traderDistributorId && (i.traderId === traderDistributorId || i.distributorId === traderDistributorId);
                
                // If neither location nor distributor is set on the logged-in trader, show everything (fallback)
                if (!traderLocation && !traderDistributorId) return true;
                
                return matchesLocation || matchesDistributor;
            });
            setMarketplace(filteredMarket);
            setRequests(rRes);
        } catch (err) {
            console.error("Failed to fetch network data:", err);
            showToast("Failed to load business network data", "error");
        } finally {
            setLoadingNetwork(false);
        }
    };

    const handleFullSync = async () => {
        setIsSyncingData(true);
        try {
            showToast("Synchronizing inventory and network data...", "info");
            
            // 1. Flush local offline queue if any
            const syncedCount = await syncOfflineData();
            
            // 2. Refresh inventory, traders, transactions & products
            await refreshData();
            
            // 3. Refresh network marketplace & interop requests
            await fetchNetworkData();
            
            if (effectiveTraderId) {
                await logTraderBackupSync(effectiveTraderId).catch(() => {});
            }
            
            await logAuditAction("Inventory Control Sync Executed", {
                traderId: effectiveTraderId,
                syncedOfflineCount: syncedCount,
                timestamp: new Date().toISOString()
            }, "info");

            if (syncedCount > 0) {
                showToast(`Sync completed! Synchronized ${syncedCount} offline transaction(s) & updated live inventory.`, "success");
            } else {
                showToast("Inventory & Business Network synchronized successfully!", "success");
            }
        } catch (err: any) {
            console.error("Sync error:", err);
            showToast("Sync error: " + (err?.message || "Server error"), "error");
        } finally {
            setIsSyncingData(false);
        }
    };

    useEffect(() => {
        if (activeSubTab !== 'my-inventory') {
            fetchNetworkData();
        }
    }, [activeSubTab, effectiveTraderId]);

    const handleCreateRequest = (item: InventoryItem & { businessName: string }) => {
        setRequestModalItem(item);
        setRequestQuantity(getSuggestedQty(item.sku));
        setRequestNotes('');
        setIsRequestModalOpen(true);
    };

    const handleSubmitRequest = async () => {
        if (!effectiveTraderId || !requestModalItem) return;
        
        setSubmittingRequest(true);
        try {
            const res = await createInteropRequest({
                requesterId: effectiveTraderId,
                providerId: requestModalItem.traderId!,
                itemName: requestModalItem.name,
                sku: requestModalItem.sku,
                quantity: requestQuantity,
                price: requestModalItem.unitPrice,
                notes: requestNotes
            });

            if (res.success) {
                showToast("Stock request sent successfully!", "success");
                setIsRequestModalOpen(false);
                fetchNetworkData();
                await logAuditAction('stock_request_create', { 
                    itemName: requestModalItem.name, 
                    quantity: requestQuantity,
                    provider: requestModalItem.businessName
                }, 'info');
            }
        } catch (err: any) {
            showToast(err.message || "Failed to create request", "error");
        } finally {
            setSubmittingRequest(false);
        }
    };

    const handleOpenAdjustment = (item: InventoryItem) => {
        setAdjustmentItem(item);
        setAdjustmentQty(0);
        setAdjustmentReason('Damaged');
        setAdjustmentNotes('');
        setIsAdjustmentModalOpen(true);
    };

    const handleAdjustmentSubmit = async () => {
        if (!adjustmentItem) return;
        if (adjustmentQty === 0) {
            showToast("Adjustment quantity cannot be zero", "error");
            return;
        }

        setSubmittingAdjustment(true);
        try {
            const newQuantity = adjustmentItem.quantity + adjustmentQty;
            if (newQuantity < 0) {
                showToast("Adjustment would result in negative stock", "error");
                setSubmittingAdjustment(false);
                return;
            }

            await updateInventoryItem(adjustmentItem.id, {
                ...adjustmentItem,
                quantity: newQuantity
            });

            await logAuditAction('inventory_adjustment', {
                itemId: adjustmentItem.id,
                itemName: adjustmentItem.name,
                previousQty: adjustmentItem.quantity,
                adjustment: adjustmentQty,
                reason: adjustmentReason,
                notes: adjustmentNotes
            }, adjustmentQty < 0 ? 'warning' : 'info');

            showToast(`Stock adjusted successfully. New balance: ${newQuantity}`, "success");
            setIsAdjustmentModalOpen(false);
            refreshData();
        } catch (err: any) {
            showToast(err.message || "Failed to adjust stock", "error");
        } finally {
            setSubmittingAdjustment(false);
        }
    };

    const handleOpenReject = (requestId: number) => {
        setRejectingRequestId(requestId);
        setRejectionReason('');
        setIsRejectModalOpen(true);
    };

    const handleSubmitRejection = async () => {
        if (!rejectingRequestId) return;
        setSubmittingRejection(true);
        try {
            await handleUpdateStatus(rejectingRequestId, 'rejected', rejectionReason);
            setIsRejectModalOpen(false);
        } finally {
            setSubmittingRejection(false);
        }
    };

    const handleUpdateStatus = async (requestId: number, status: string, notes?: string) => {
        try {
            const res = await updateInteropRequestStatus(requestId, status as any, notes);
            if (res.success) {
                showToast(`Request ${status} successfully`, "success");
                fetchNetworkData();
                if (status === 'received') refreshData();
                
                // Log audit
                const req = requests.find(r => r.id === requestId);
                await logAuditAction('stock_request_update', { 
                    requestId, 
                    status, 
                    itemName: req?.itemName,
                    notes: notes
                }, status === 'rejected' ? 'warning' : 'info');
            }
        } catch (err: any) {
            showToast(err.message || "Failed to update status", "error");
        }
    };

    const handleViewHistory = async (item: InventoryItem) => {
        setHistoryItem(item);
        setLoadingHistory(true);
        setIsHistoryModalOpen(true);
        try {
            const logs = await getAuditLogs();
            // Filter logs related to this product
            const itemLogs = logs.filter((l: any) => 
                (l.details?.itemId === item.id || l.details?.itemName === item.name || l.details?.sku === item.sku)
            ).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setItemAuditLogs(itemLogs);
        } catch (err) {
            showToast("Failed to load history", "error");
        } finally {
            setLoadingHistory(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'rejected': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'received': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock size={14} />;
            case 'approved': return <CheckCircle size={14} />;
            case 'rejected': return <XCircle size={14} />;
            case 'shipped': return <Truck size={14} />;
            case 'received': return <Package size={14} />;
            default: return null;
        }
    };

    const filteredMarketplace = useMemo(() => {
        // Find SKUs that already have an active request from this trader
        const activeRequestKeys = new Set(
            requests
                .filter(r => r.requesterId === effectiveTraderId && ['pending', 'approved', 'shipped'].includes(r.status))
                .map(r => `${r.providerId}-${r.sku}`)
        );

        return marketplace.filter(i => {
            // Remove if already requested
            const requestKey = `${i.traderId}-${i.sku}`;
            if (activeRequestKeys.has(requestKey)) return false;

            return i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   i.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   (i.sku && i.sku.toLowerCase().includes(searchQuery.toLowerCase()));
        });
    }, [marketplace, searchQuery, requests, effectiveTraderId]);

    const groupedMarketplace = useMemo(() => {
        const groups: { [traderId: number]: { businessName: string; location?: string; trader: any; items: typeof marketplace } } = {};
        filteredMarketplace.forEach(item => {
            if (!item.traderId) return;
            if (!groups[item.traderId]) {
                const traderObj = traders.find(t => t.id === item.traderId);
                groups[item.traderId] = {
                    businessName: item.businessName || traderObj?.businessName || `Supplier #${item.traderId}`,
                    location: traderObj?.location,
                    trader: traderObj || { id: item.traderId, businessName: item.businessName, location: 'Unknown' },
                    items: []
                };
            }
            groups[item.traderId].items.push(item);
        });
        return Object.values(groups);
    }, [filteredMarketplace, traders]);

    const lowStockItemsBySupplier = useMemo(() => {
        if (!Array.isArray(inventory)) return {};
        const myItems = inventory.filter(item => item.traderId === effectiveTraderId);
        const lowItems = myItems.filter(item => item.quantity <= item.reorderLevel);
        
        const groups: { [supplierName: string]: typeof lowItems } = {};
        lowItems.forEach(item => {
            const supplierName = item.supplier || 'Unassigned Supplier';
            if (!groups[supplierName]) groups[supplierName] = [];
            groups[supplierName].push(item);
        });
        
        return groups;
    }, [inventory, effectiveTraderId]);

    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            const matchesSearch = r.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 (r.requesterBusiness?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                 (r.providerBusiness?.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [requests, searchQuery, filterStatus]);

    const outgoingRequests = useMemo(() => 
        filteredRequests.filter(r => r.requesterId === effectiveTraderId),
    [filteredRequests, effectiveTraderId]);

    const incomingRequests = useMemo(() => 
        filteredRequests.filter(r => r.providerId === effectiveTraderId),
    [filteredRequests, effectiveTraderId]);

    const incomingStock = useMemo(() => 
        outgoingRequests.filter(r => r.status === 'shipped'),
    [outgoingRequests]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Automatically issue SKU if missing
            let finalSku = formData.sku;
            if (!finalSku || finalSku.trim() === '') {
                const prefix = (formData.name || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'ITM');
                const rand = Math.floor(1000 + Math.random() * 9000);
                finalSku = `${prefix}-${rand}`;
            }

            const itemData: Partial<InventoryItem> = {
                ...formData,
                sku: finalSku,
                traderId: effectiveTraderId || (loggedInTrader ? loggedInTrader.id : null),
                tenantId: effectiveTenantId || (effectiveTraderId ? `tenant_${effectiveTraderId}` : undefined),
                quantity: Number(formData.quantity || 0),
                unitPrice: Number(formData.unitPrice || 0),
                costPrice: Number(formData.costPrice || 0),
                wholesalePrice: Number(formData.wholesalePrice || 0),
                retailPrice: Number(formData.retailPrice || 0),
                taxRate: Number(formData.taxRate || 0),
                reorderLevel: Number(formData.reorderLevel || 0)
            };

            let res: any;
            if (isEditMode && selectedItem) {
                res = await updateInventoryItem(selectedItem.id, itemData);
                await logAuditAction('inventory_update', { itemId: selectedItem.id, itemName: itemData.name }, 'info');
                showToast('Item updated successfully', 'success');
            } else {
                res = await addInventoryItem(itemData);
                await logAuditAction('inventory_create', { itemName: itemData.name, quantity: itemData.quantity }, 'info');
                showToast('Item added to inventory', 'success');
            }

            refreshData();
            handleCloseForm();
        } catch (error: any) {
            showToast(error.message || 'Failed to save item', 'error');
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setSelectedItem(item);
        setFormData({
            name: item.name,
            sku: item.sku || '',
            barcode: item.barcode || '',
            category: item.category || '',
            brand: item.brand || '',
            model: item.model || '',
            uom: item.uom || 'pcs',
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            costPrice: String(item.costPrice),
            wholesalePrice: String(item.wholesalePrice || ''),
            retailPrice: String(item.retailPrice || ''),
            taxCategory: item.taxCategory || 'General',
            taxRate: String(item.taxRate || '0'),
            supplier: item.supplier || '',
            manufacturer: item.manufacturer || '',
            countryOfOrigin: item.countryOfOrigin || '',
            reorderLevel: String(item.reorderLevel),
            description: item.description || '',
            images: item.images || [],
            location: item.location || ''
        });
        setIsEditMode(true);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setIsEditMode(false);
        setSelectedItem(null);
        setFormData(initialFormData);
        setActiveFormTab('general');
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this item?')) {
            try {
                const item = inventory.find(i => i.id === id);
                await deleteInventoryItem(id);
                await logAuditAction('inventory_delete', { itemId: id, itemName: item?.name }, 'warning');
                showToast('Item deleted', 'success');
                refreshData();
                setSelectedItemIds(prev => prev.filter(itemId => itemId !== id));
            } catch (error: any) {
                showToast(error.message || 'Failed to delete item', 'error');
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedItemIds.length === 0) return;
        
        if (confirm(`Are you sure you want to delete ${selectedItemIds.length} selected items?`)) {
            setIsBulkDeleting(true);
            try {
                await bulkDeleteInventoryItems(selectedItemIds);
                await logAuditAction('inventory_bulk_delete', { count: selectedItemIds.length, itemIds: selectedItemIds }, 'critical');
                showToast(`${selectedItemIds.length} items deleted successfully`, 'success');
                setSelectedItemIds([]);
                refreshData();
            } catch (error: any) {
                showToast(error.message || 'Failed to delete items', 'error');
            } finally {
                setIsBulkDeleting(false);
            }
        }
    };

    const handleBulkUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItemIds.length === 0 || !bulkUpdateValue.trim()) return;

        setIsBulkUpdating(true);
        try {
            const updates: Partial<InventoryItem> = {};
            if (bulkUpdateField === 'category') updates.category = bulkUpdateValue.trim();
            if (bulkUpdateField === 'taxCategory') {
                updates.taxCategory = bulkUpdateValue.trim();
                if (bulkUpdateValue === 'Zero Rated' || bulkUpdateValue === 'Exempt') updates.taxRate = 0;
                else if (bulkUpdateValue === 'General (16%)' || bulkUpdateValue === 'General') updates.taxRate = 16;
            }
            if (bulkUpdateField === 'reorderLevel') updates.reorderLevel = parseInt(bulkUpdateValue, 10) || 0;
            if (bulkUpdateField === 'supplier') updates.supplier = bulkUpdateValue.trim();

            await bulkUpdateInventoryItems(selectedItemIds, updates);
            await logAuditAction('inventory_bulk_update', { count: selectedItemIds.length, field: bulkUpdateField, value: bulkUpdateValue }, 'warning');
            showToast(`Successfully updated ${selectedItemIds.length} items`, 'success');
            setIsBulkUpdateModalOpen(false);
            setBulkUpdateValue('');
            setSelectedItemIds([]);
            refreshData();
        } catch (error: any) {
            showToast(error.message || 'Failed to update items', 'error');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleExportSelectedToCsv = () => {
        if (selectedItemIds.length === 0) return;
        const selectedItems = Array.isArray(inventory) ? inventory.filter(i => selectedItemIds.includes(i.id)) : [];
        const headers = ["ID", "Name", "SKU", "Barcode", "Category", "Quantity", "Unit Price", "Cost Price", "Tax Category", "Tax Rate", "Reorder Level", "Supplier"];
        const rows = selectedItems.map(item => [
            item.id,
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.sku || '').replace(/"/g, '""')}"`,
            `"${(item.barcode || '').replace(/"/g, '""')}"`,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            item.quantity,
            item.unitPrice,
            item.costPrice || 0,
            `"${(item.taxCategory || 'General').replace(/"/g, '""')}"`,
            item.taxRate || 0,
            item.reorderLevel || 0,
            `"${(item.supplier || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `inventory_selected_${selectedItemIds.length}_items.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${selectedItemIds.length} items to CSV`, 'success');
    };

    const toggleSelectAll = () => {
        if (selectedItemIds.length === filteredInventory.length) {
            setSelectedItemIds([]);
        } else {
            setSelectedItemIds(filteredInventory.map(item => item.id));
        }
    };

    const toggleSelectItem = (id: number) => {
        setSelectedItemIds(prev => 
            prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
        );
    };

    const downloadCsvTemplate = () => {
        const content = "Item Name,SKU,Category,Supplier,Buying Price,Selling Price,Quantity,Reorder Level,Description\n" +
                  "Basmati Rice 25kg,SKU-RICE-25,Cereals,Mwea Millers,2200,2800,50,10,Premium long grain aromatic rice\n" +
                  "Pure Cooking Oil 5L,SKU-OIL-5L,Groceries,Bidco Africa,1100,1350,30,5,5 Liter refined vegetable oil\n" +
                  "Wheat Flour 2kg,SKU-WHEAT-2K,Baking,Ungu Limited,160,200,100,20,Fortified all-purpose baking flour\n" +
                  "Sugar White 1kg,SKU-SUGAR-1K,Groceries,Mumias Sugar,140,175,80,15,Refined cane sugar\n" +
                  "Full Cream Milk 500ml,SKU-MILK-500,Dairy,Brookside,55,70,120,25,Fresh pasteurized whole milk\n";
        const filename = "biashara_inventory_template.csv";
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV Template downloaded', 'info');
    };

    const downloadExcelTemplate = () => {
        try {
            const data = [
                ['Item Name', 'SKU', 'Category', 'Supplier', 'Buying Price', 'Selling Price', 'Quantity', 'Reorder Level', 'Description'],
                ['Basmati Rice 25kg', 'SKU-RICE-25', 'Cereals', 'Mwea Millers', 2200, 2800, 50, 10, 'Premium long grain aromatic rice'],
                ['Pure Cooking Oil 5L', 'SKU-OIL-5L', 'Groceries', 'Bidco Africa', 1100, 1350, 30, 5, '5 Liter refined vegetable oil'],
                ['Wheat Flour 2kg', 'SKU-WHEAT-2K', 'Baking', 'Ungu Limited', 160, 200, 100, 20, 'Fortified all-purpose baking flour'],
                ['Sugar White 1kg', 'SKU-SUGAR-1K', 'Groceries', 'Mumias Sugar', 140, 175, 80, 15, 'Refined cane sugar'],
                ['Full Cream Milk 500ml', 'SKU-MILK-500', 'Dairy', 'Brookside', 55, 70, 120, 25, 'Fresh pasteurized whole milk']
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory Template');
            XLSX.writeFile(wb, 'biashara_inventory_template.xlsx');
            showToast('Excel Template downloaded', 'info');
        } catch (err: any) {
            downloadCsvTemplate();
        }
    };

    const downloadTemplate = downloadCsvTemplate;

    // Bulk Import Logic
    const inventoryFields = [
        { key: 'name', label: 'Item Name', required: true, aliases: ['name', 'item', 'product', 'title', 'item name', 'product name'] },
        { key: 'sku', label: 'SKU / Item Code', required: false, aliases: ['sku', 'code', 'item code', 'product code', 'barcode'] },
        { key: 'category', label: 'Category', required: false, aliases: ['category', 'type', 'group', 'department'] },
        { key: 'supplier', label: 'Supplier / Vendor', required: false, aliases: ['supplier', 'vendor', 'brand', 'manufacturer'] },
        { key: 'buyingPrice', label: 'Buying / Cost Price (KES)', required: false, aliases: ['buying price', 'cost price', 'cost', 'buying_price', 'buyingprice', 'cost_price'] },
        { key: 'sellingPrice', label: 'Selling Price (KES)', required: false, aliases: ['selling price', 'unit price', 'price', 'selling_price', 'retail price', 'unit_price'] },
        { key: 'quantity', label: 'Quantity / Stock', required: false, aliases: ['quantity', 'stock', 'qty', 'count', 'amount', 'initial stock'] },
        { key: 'reorderLevel', label: 'Reorder Level', required: false, aliases: ['reorder level', 'reorder', 'min stock', 'minimum stock'] },
        { key: 'description', label: 'Description', required: false, aliases: ['description', 'notes', 'details'] },
    ];

    const parseCSV = (text: string): string[][] => {
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines: string[][] = [];
        let row: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText[i];
            const nextChar = cleanText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                row.push(current.trim());
                if (row.some(cell => cell.length > 0)) {
                    lines.push(row);
                }
                row = [];
                current = '';
            } else {
                current += char;
            }
        }
        if (current.length > 0 || row.length > 0) {
            row.push(current.trim());
            if (row.some(cell => cell.length > 0)) {
                lines.push(row);
            }
        }
        return lines;
    };

    const processParsedHeadersAndRows = (headers: string[], dataRows: string[][], filename: string) => {
        if (!headers.length || !dataRows.length) {
            showToast("No data rows found in uploaded file", "error");
            return;
        }

        setImportFileName(filename);
        setImportCsvHeaders(headers);
        setImportCsvRows(dataRows);

        // Auto map columns with smart alias matching
        const initialMap: Record<string, string> = {};
        inventoryFields.forEach(field => {
            const matchedHeader = headers.find(h => {
                const lowerH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                return field.aliases.some(alias => {
                    const lowerA = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return lowerH === lowerA || lowerH.includes(lowerA) || lowerA.includes(lowerH);
                });
            });
            if (matchedHeader) {
                initialMap[field.key] = matchedHeader;
            }
        });

        setImportColumnMap(initialMap);
        setImportStep('mapping');
        showToast(`Loaded ${dataRows.length} rows ready for schema mapping`, 'info');
    };

    const getImportSampleValues = (header: string, limit = 2) => {
        const headerIdx = importCsvHeaders.indexOf(header);
        if (headerIdx === -1) return '';
        const samples = importCsvRows
            .slice(0, 5)
            .map(r => r[headerIdx])
            .filter(Boolean)
            .slice(0, limit);
        return samples.join(', ');
    };

    const handleFileSelected = (file: File) => {
        if (!file) return;
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = ev.target?.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    if (!firstSheetName) {
                        showToast("Excel workbook contains no sheets", "error");
                        return;
                    }
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    if (!jsonRows || jsonRows.length === 0) {
                        showToast("Excel sheet has no readable rows", "error");
                        return;
                    }
                    const rawHeaders = (jsonRows[0] || []).map((h: any) => String(h || '').trim());
                    const headers = rawHeaders.filter(h => h.length > 0);
                    const rawDataRows = jsonRows.slice(1);
                    const dataRows: string[][] = rawDataRows
                        .map(r => r.slice(0, headers.length).map((c: any) => String(c !== undefined && c !== null ? c : '').trim()))
                        .filter(r => r.some(c => c.length > 0));

                    processParsedHeadersAndRows(headers, dataRows, file.name);
                } catch (err: any) {
                    showToast("Failed to parse Excel file: " + err.message, "error");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target?.result as string;
                setImportRawText(text);
                const lines = parseCSV(text);
                if (lines.length === 0) {
                    showToast("No readable rows found in CSV", "error");
                    return;
                }
                const headers = lines[0].map(h => h.trim());
                const dataRows = lines.slice(1);
                processParsedHeadersAndRows(headers, dataRows, file.name);
            };
            reader.readAsText(file);
        }
    };

    const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelected(file);
        }
    };

    const handlePasteImport = () => {
        if (!pastedDataText.trim()) {
            showToast("Please paste CSV or tabular data first", "error");
            return;
        }
        const lines = parseCSV(pastedDataText);
        if (lines.length === 0) {
            showToast("Could not parse pasted data into tabular rows", "error");
            return;
        }
        const headers = lines[0].map(h => h.trim());
        const dataRows = lines.slice(1);
        processParsedHeadersAndRows(headers, dataRows, "pasted_data.csv");
    };

    const validateSingleRow = (mappedData: Record<string, any>, existingItems: InventoryItem[], strategy: string) => {
        const messages: string[] = [];
        let status: 'valid' | 'warning' | 'error' = 'valid';
        let collisionMatch: string | undefined;

        const name = (mappedData.name || '').trim();
        const sku = (mappedData.sku || '').trim();
        const qtyStr = mappedData.quantity;
        const priceStr = mappedData.sellingPrice;

        if (!name) {
            status = 'error';
            messages.push('Missing required Item Name');
        }

        if (qtyStr !== '' && qtyStr !== undefined && isNaN(Number(qtyStr))) {
            status = 'error';
            messages.push('Quantity must be a valid number');
        }

        if (priceStr !== '' && priceStr !== undefined && isNaN(Number(priceStr))) {
            status = 'error';
            messages.push('Price must be a valid number');
        }

        // Check collisions against live inventory
        const existing = existingItems.find(i => 
            (sku && i.sku && i.sku.toLowerCase() === sku.toLowerCase()) ||
            (name && i.name.toLowerCase() === name.toLowerCase())
        );

        if (existing) {
            collisionMatch = existing.sku ? `SKU: ${existing.sku}` : `Name: ${existing.name}`;
            if (status !== 'error') {
                status = 'warning';
                messages.push(`Matches existing item (${collisionMatch}). Collision Action: ${strategy.toUpperCase()}`);
            }
        }

        return { status, messages, collisionMatch };
    };

    const buildImportParsedRows = () => {
        const rows: any[] = [];

        importCsvRows.forEach((row, idx) => {
            const rawData: Record<string, string> = {};
            importCsvHeaders.forEach((h, hIdx) => {
                rawData[h] = row[hIdx] || '';
            });

            const mappedData: Record<string, any> = {};
            inventoryFields.forEach(f => {
                const mappedHeader = importColumnMap[f.key];
                mappedData[f.key] = mappedHeader ? (rawData[mappedHeader] || '').trim() : '';
            });

            const { status, messages, collisionMatch } = validateSingleRow(mappedData, inventory, importStrategy);

            rows.push({
                id: idx + 1,
                rawData,
                mappedData,
                status,
                messages,
                selected: status !== 'error',
                collisionMatch
            });
        });

        setImportParsedRows(rows);
        setImportStep('preview');
    };

    const handleAutoFixAllRows = () => {
        setImportParsedRows(prev => prev.map((row, idx) => {
            const updatedMapped = { ...row.mappedData };
            // If missing SKU, auto generate a professional code
            if (!updatedMapped.sku || updatedMapped.sku.trim() === '') {
                const cleanPrefix = (updatedMapped.name || 'ITEM').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'ITM');
                updatedMapped.sku = `SKU-${cleanPrefix}-${String(100 + idx).padStart(3, '0')}`;
            }
            // If missing or invalid selling price, fallback to 100
            if (!updatedMapped.sellingPrice || isNaN(Number(updatedMapped.sellingPrice)) || Number(updatedMapped.sellingPrice) <= 0) {
                updatedMapped.sellingPrice = '100';
            }
            // If missing or invalid buying price, fallback to 80% of selling price
            if (!updatedMapped.buyingPrice || isNaN(Number(updatedMapped.buyingPrice))) {
                updatedMapped.buyingPrice = String(Math.round(Number(updatedMapped.sellingPrice) * 0.8));
            }
            // If missing quantity, fallback to 10
            if (!updatedMapped.quantity || isNaN(Number(updatedMapped.quantity))) {
                updatedMapped.quantity = '10';
            }
            // If missing category, fallback to 'General'
            if (!updatedMapped.category) {
                updatedMapped.category = 'General';
            }

            const { status, messages, collisionMatch } = validateSingleRow(updatedMapped, inventory, importStrategy);
            return {
                ...row,
                mappedData: updatedMapped,
                status,
                messages,
                collisionMatch,
                selected: status !== 'error'
            };
        }));
        showToast("Auto-generated missing SKUs and resolved standard row defaults!", "success");
    };

    const handleInlineUpdateCell = (rowId: number, field: string, val: string) => {
        setImportParsedRows(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            const updatedMapped = { ...row.mappedData, [field]: val };
            const { status, messages, collisionMatch } = validateSingleRow(updatedMapped, inventory, importStrategy);
            return {
                ...row,
                mappedData: updatedMapped,
                status,
                messages,
                collisionMatch,
                selected: status !== 'error'
            };
        }));
    };

    const handleToggleSelectAll = (select: boolean) => {
        setImportParsedRows(prev => prev.map(r => ({
            ...r,
            selected: r.status === 'error' ? false : select
        })));
    };

    const handleExecuteImport = async () => {
        const selectedRows = importParsedRows.filter(r => r.selected && r.status !== 'error');
        if (selectedRows.length === 0) {
            showToast("No valid rows selected for import", "info");
            return;
        }

        setImportStep('importing');

        try {
            const targetTraderId = effectiveTraderId || (loggedInTrader ? loggedInTrader.id : (user?.traderId || 0));
            const targetTenantId = effectiveTenantId || (targetTraderId ? `tenant_${targetTraderId}` : undefined);
            const itemsToUpload = selectedRows.map(r => ({
                name: r.mappedData.name,
                sku: r.mappedData.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                category: r.mappedData.category || 'General',
                supplier: r.mappedData.supplier || '—',
                buyingPrice: parseFloat(r.mappedData.buyingPrice || '0') || 0,
                sellingPrice: parseFloat(r.mappedData.sellingPrice || '0') || 0,
                unitPrice: parseFloat(r.mappedData.sellingPrice || '0') || 0,
                costPrice: parseFloat(r.mappedData.buyingPrice || '0') || 0,
                quantity: parseInt(r.mappedData.quantity || '0', 10) || 0,
                reorderLevel: parseInt(r.mappedData.reorderLevel || '5', 10) || 5,
                description: r.mappedData.description || '',
                traderId: targetTraderId || null,
                tenantId: targetTenantId
            }));

            const res = await bulkAddInventoryItems(targetTraderId, itemsToUpload, importStrategy);
            
            setImportResult({
                addedCount: res.addedCount !== undefined ? res.addedCount : itemsToUpload.length,
                updatedCount: res.updatedCount || 0,
                skippedCount: res.skippedCount || 0,
                message: res.message || 'Import processed successfully'
            });

            await logAuditAction('csv_import_inventory', { 
                count: itemsToUpload.length, 
                strategy: importStrategy, 
                fileName: importFileName,
                added: res.addedCount,
                updated: res.updatedCount,
                skipped: res.skippedCount
            }, 'info');

            await refreshData();
            showToast("Bulk inventory import completed successfully!", "success");
            setImportStep('summary');
        } catch (err: any) {
            showToast("Import failed: " + (err.message || 'Unknown error'), "error");
            setImportStep('preview');
        }
    };

    const handleExport = async () => {
        try {
            const data = await exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast('Export successful', 'success');
        } catch (error: any) {
            showToast('Export failed', 'error');
        }
    };

    const filteredInventory = useMemo(() => {
        const safe = Array.isArray(inventory) ? inventory : [];
        let base: InventoryItem[] = [];

        if (isSystemAdmin && !effectiveTraderId) {
            base = safe;
        } else if (effectiveTraderId || effectiveTenantId) {
            // Strict tenant isolation: only items strictly belonging to this trader / tenant
            base = safe.filter(item => {
                if (effectiveTraderId && item.traderId === effectiveTraderId) return true;
                if (effectiveTenantId && item.tenantId === effectiveTenantId) return true;
                if (effectiveTraderId && item.tenantId === `tenant_${effectiveTraderId}`) return true;
                return false;
            });
        } else {
            // Non-admin tenant with unidentified credentials: empty inventory (zero cross-tenant leak guarantee)
            base = [];
        }
        
        if (showOnlyLowStock) {
            base = base.filter(item => item.quantity <= (item.reorderLevel || 0));
        }

        if (!searchQuery.trim()) return base;
        const q = searchQuery.toLowerCase();
        return base.filter(item => 
            item.name.toLowerCase().includes(q) || 
            (item.sku && item.sku.toLowerCase().includes(q)) ||
            (item.barcode && item.barcode.toLowerCase().includes(q)) ||
            (item.category && item.category.toLowerCase().includes(q))
        );
    }, [inventory, searchQuery, isSystemAdmin, effectiveTraderId, effectiveTenantId, showOnlyLowStock]);

    const stockValuation = useMemo(() => {
        return filteredInventory.reduce((acc, item) => ({
            totalCost: acc.totalCost + ((item.costPrice || 0) * item.quantity),
            totalValue: acc.totalValue + ((item.unitPrice || 0) * item.quantity),
            totalQty: acc.totalQty + item.quantity
        }), { totalCost: 0, totalValue: 0, totalQty: 0 });
    }, [filteredInventory]);

    const isGuest = user?.username === 'Guest Client';

    return (
        <div className="p-6 overflow-y-auto w-full h-full bg-slate-50/50 dark:bg-slate-950/60 backdrop-blur-[1px] space-y-6">
            {/* Instructional Zoom (Guest Only) */}
            {isGuest && (
                <div className="bg-slate-900 border-l-4 border-indigo-500 p-6 text-white shadow-2xl relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                            <Package size={32} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Core Intelligence</h3>
                            <h2 className="text-xl font-black uppercase tracking-tight">Advanced Inventory Control</h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-3xl">
                                Real-time stock monitoring with multi-node synchronization. Every adjustment is cryptographically recorded 
                                and broadcasted across the primeaxis network.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            <div className="text-[9px] font-black bg-indigo-600/10 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 uppercase tracking-[0.2em]">
                                <ShieldCheck size={10} className="inline mr-2" /> Local Server Encrypted
                            </div>
                            <div className="text-[9px] font-black bg-emerald-600/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-[0.2em]">
                                <Zap size={10} className="inline mr-2" /> Monitoring Active
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Area */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <Package className="text-white" size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Inventory Control</h1>
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider" title="Strict Multi-Tenant Row-Level Security: stock is private to this trader account">
                                    <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
                                    <span>{loggedInTrader?.businessName || (user as any)?.business_name || (isSystemAdmin ? 'Global Admin Inventory' : 'Tenant Isolated Stock')}</span>
                                </div>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stock & Resource Management System</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit overflow-x-auto no-scrollbar">
                        {[
                            { id: 'my-inventory', label: t('my_inventory'), icon: Box },
                            { id: 'marketplace', label: t('global_marketplace'), icon: Globe },
                            { id: 'requests', label: t('stock_requests'), icon: ArrowRightLeft },
                            { id: 'documents', label: 'Documents', icon: FileText },
                            { id: 'analytics', label: 'Analytics', icon: BarChart },
                            { id: 'bulk-import', label: 'Bulk Import', icon: Upload },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSubTab(tab.id as InventorySubTab)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                    activeSubTab === tab.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 translate-y-[-1px]'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2" />
                        <button
                            onClick={() => setActiveSubTab('settings')}
                            className={`p-2.5 rounded-xl transition-all ${
                                activeSubTab === 'settings'
                                    ? 'bg-slate-900 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Settings size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Real-time Stats Cards */}
                    {activeSubTab === 'my-inventory' && (
                        <div className="flex items-stretch gap-4">
                            <div className="tech-card px-6 py-4 flex flex-col justify-center min-w-[180px]">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Valuation</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                                    <span className="text-xs text-indigo-500">KES</span>
                                    {stockValuation.totalCost.toLocaleString()}
                                </div>
                            </div>
                            <div className="tech-card px-6 py-4 flex flex-col justify-center min-w-[180px]">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Potential</div>
                                <div className="text-lg font-black text-indigo-600 flex items-baseline gap-1">
                                    <span className="text-xs">KES</span>
                                    {stockValuation.totalValue.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleFullSync}
                            disabled={isSyncingData || isSyncing}
                            className={`tech-button flex items-center gap-2 px-5 py-3 ${
                                isSyncingData || isSyncing ? 'bg-indigo-50 text-indigo-600 animate-pulse' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                            }`}
                        >
                            <RefreshCw size={14} className={isSyncingData || isSyncing ? 'animate-spin' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {isSyncingData || isSyncing ? 'Synchronizing...' : 'Full Sync'}
                            </span>
                            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'} shadow-sm`} />
                        </button>

                        {lowStockCount > 0 && (
                            <button
                                onClick={() => {
                                    setShowOnlyLowStock(true);
                                    setActiveSubTab('my-inventory');
                                }}
                                className="bg-rose-600 text-white px-5 py-3 rounded-xl shadow-lg shadow-rose-600/20 animate-bounce flex items-center gap-2 border-2 border-white dark:border-slate-900"
                            >
                                <AlertTriangle size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{lowStockCount} Alerts</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Bar & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="SEARCH SKU, BARCODE OR NAME..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="tech-input w-full pl-12 pr-4 py-3 text-[11px] font-black uppercase tracking-widest"
                        />
                    </div>

                    {activeSubTab === 'requests' && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'pending', label: 'Pending', color: 'text-amber-600' },
                                { id: 'approved', label: 'Approved', color: 'text-indigo-600' },
                                { id: 'shipped', label: 'In-Transit', color: 'text-purple-600' },
                                { id: 'received', label: 'Received', color: 'text-emerald-600' },
                                { id: 'rejected', label: 'Declined', color: 'text-rose-600' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setFilterStatus(filter.id)}
                                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                                        filterStatus === filter.id 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                            : `text-slate-400 hover:text-slate-600 ${filter.color}`
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeSubTab === 'documents' && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'po', label: 'PO', color: 'text-indigo-600' },
                                { id: 'grn', label: 'GRN', color: 'text-emerald-600' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setFilterStatus(filter.id)}
                                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                                        filterStatus === filter.id 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                            : `text-slate-400 hover:text-slate-600 ${filter.color}`
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {activeSubTab === 'my-inventory' && (
                        <>
                            {canAdd && (
                                <button 
                                    onClick={() => setIsFormOpen(true)}
                                    className="tech-button bg-indigo-600 text-white px-6 py-3 flex items-center gap-2 border-none shadow-indigo-600/20"
                                >
                                    <Plus size={18} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Register Product</span>
                                </button>
                            )}

                            {canImport && (
                                <button 
                                    onClick={() => setActiveSubTab('bulk-import')}
                                    className="tech-button bg-white text-emerald-600 border-emerald-200 px-6 py-3 flex items-center gap-2 hover:bg-emerald-50 transition-colors"
                                >
                                    <FileSpreadsheet size={18} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Bulk Import CSV</span>
                                </button>
                            )}

                            <button 
                                onClick={downloadTemplate}
                                className="tech-button bg-white text-slate-600 border-slate-200 px-6 py-3 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                            >
                                <Download size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Download Template</span>
                            </button>

                            <button 
                                onClick={() => setIsA4ReportOpen(true)}
                                className="tech-button bg-slate-900 text-white px-5 py-3 border-none flex items-center gap-2"
                            >
                                <Printer size={16}/>
                                <span className="text-[10px] font-black uppercase tracking-widest">A4 Audit</span>
                            </button>

                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block" />

                            <button onClick={handleExport} className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Export JSON Backup">
                                <Download size={20}/>
                            </button>
                        </>
                    )}

                    {(activeSubTab === 'marketplace' || activeSubTab === 'requests' || activeSubTab === 'documents') && (
                        <button 
                            onClick={handleFullSync}
                            disabled={isSyncingData || loadingNetwork}
                            className="tech-button flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border-slate-200 hover:border-indigo-400"
                            title="Synchronize business network, marketplace, and inventory requests"
                        >
                            <RefreshCw size={14} className={isSyncingData || loadingNetwork ? 'animate-spin' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Sync Network & Inventory</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-8">
                {activeSubTab === 'my-inventory' ? (
                    <div className="space-y-6">
                        {/* Low Stock Notification Banner */}
                        {Object.keys(lowStockItemsBySupplier).length > 0 && !showOnlyLowStock && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500 text-white rounded-lg">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-amber-900">Inventory Alert: Low Stock Detected</h5>
                                        <p className="text-xs text-amber-700">Some items are below their minimum threshold. Restock recommended.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowOnlyLowStock(true)}
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black px-4 py-2 rounded-xl transition shadow-sm uppercase tracking-widest"
                                >
                                    Filter Low Stock
                                </button>
                            </div>
                        )}

                        {showOnlyLowStock && (
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-600 text-white rounded-lg">
                                        <Filter size={18} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-blue-900">Viewing Low Stock Items Only</h5>
                                        <p className="text-xs text-blue-700">Showing all items currently below their reorder levels.</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowOnlyLowStock(false)}
                                    className="text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-widest"
                                >
                                    Show All Items
                                </button>
                            </div>
                        )}

                        {/* Smart Restock Assistant Card */}
                        {Object.keys(lowStockItemsBySupplier).length > 0 && (
                            <div className="bg-slate-900 border-l-4 border-amber-500 rounded-r-3xl p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
                                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center gap-8">
                                    <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30 shrink-0 shadow-lg shadow-amber-500/10">
                                        <Zap className="text-amber-400" size={32} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-amber-500">Logistics Intelligence</h3>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Smart Restock Optimization</h2>
                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-3xl">
                                            The system has identified {Object.keys(lowStockItemsBySupplier).length} supply chains with critical stock depletion. 
                                            Automated B2B fulfillment protocols are ready for deployment.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                                        <button 
                                            onClick={() => setShowOnlyLowStock(true)}
                                            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition shadow-lg shadow-amber-600/20"
                                        >
                                            Inspect Alerts
                                        </button>
                                        <div className="w-px h-8 bg-slate-800 mx-2 hidden xl:block" />
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest">Protocol Active</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
                                    {Object.entries(lowStockItemsBySupplier).map(([supplierName, items]) => {
                                        const matchingTrader = traders.find(t => t.businessName.toLowerCase() === supplierName.toLowerCase() && t.id !== effectiveTraderId);
                                        return (
                                            <div key={supplierName} className="bg-slate-800/50 border border-slate-700 p-5 rounded-2xl space-y-4 hover:border-amber-500/50 transition-colors group">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supplier Node</div>
                                                        <div className="text-sm font-black text-white uppercase truncate max-w-[200px]">
                                                            {supplierName || 'INDEPENDENT SOURCE'}
                                                        </div>
                                                    </div>
                                                    <div className="bg-amber-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                                                        {items.length} ITEMS
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    {items.slice(0, 3).map(item => (
                                                        <div key={item.id} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight text-slate-400 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                                            <span className="truncate max-w-[140px] group-hover:text-amber-400 transition-colors">{item.name}</span>
                                                            <span className="text-amber-500 font-mono">{item.quantity} / {item.reorderLevel}</span>
                                                        </div>
                                                    ))}
                                                    {items.length > 3 && (
                                                        <div className="text-[9px] text-slate-500 font-black italic text-center pt-1">+ {items.length - 3} additional items below threshold</div>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    {matchingTrader ? (
                                                        <button 
                                                            onClick={() => {
                                                                setActiveSubTab('marketplace');
                                                                setMarketplaceViewMode('grouped');
                                                                
                                                                const prefills: { [sku: string]: number } = {};
                                                                items.forEach(it => {
                                                                    prefills[it.sku] = Math.max(1, (it.reorderLevel * 2) - it.quantity);
                                                                });
                                                                
                                                                setTimeout(() => {
                                                                    handleOpenRestockModal(matchingTrader, prefills);
                                                                }, 250);
                                                            }}
                                                            className="w-full tech-button bg-amber-600/10 text-amber-500 border-amber-500/20 hover:bg-amber-600 hover:text-white py-3 flex items-center justify-center gap-2"
                                                        >
                                                            <Truck size={14} /> 
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Deploy Restock Order</span>
                                                        </button>
                                                    ) : (
                                                        <div className="text-[9px] text-slate-500 font-black bg-slate-900 py-3 rounded-xl text-center uppercase tracking-[0.2em] border border-slate-800">
                                                            Manual Procurement Required
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="tech-card overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                                        <Box size={16} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-widest">Active Inventory Directory</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">{filteredInventory.length} Nodes Online</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedItemIds.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20">
                                            <CheckCircle size={14} />
                                            <span>{selectedItemIds.length} MARKED</span>
                                        </div>
                                        
                                        <button 
                                            onClick={() => {
                                                setBulkUpdateField('category');
                                                setBulkUpdateValue('');
                                                setIsBulkUpdateModalOpen(true);
                                            }}
                                            className="tech-button px-4 py-2 bg-white text-slate-600 text-[9px] font-black uppercase tracking-widest border-slate-200"
                                        >
                                            <Tag size={12} className="text-slate-400" />
                                            Batch Update
                                        </button>

                                        <button 
                                            onClick={handleExportSelectedToCsv}
                                            className="tech-button px-4 py-2 bg-white text-slate-600 text-[9px] font-black uppercase tracking-widest border-slate-200"
                                        >
                                            <FileSpreadsheet size={12} className="text-emerald-500" />
                                            Export CSV
                                        </button>

                                        <button 
                                            onClick={handleBulkDelete}
                                            disabled={isBulkDeleting}
                                            className="tech-button px-4 py-2 bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white text-[9px] font-black uppercase tracking-widest"
                                        >
                                            {isBulkDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                            Wipe Selected
                                        </button>

                                        <button 
                                            onClick={() => setSelectedItemIds([])}
                                            className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest px-2"
                                        >
                                            Deselect
                                        </button>
                                    </div>
                                )}
                            </div>

                        {filteredInventory.length === 0 ? (
                            <div className="text-center py-32 bg-white dark:bg-slate-900">
                                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Package size={40} className="text-slate-200 dark:text-slate-700" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Zero Registry Hits</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">No inventory nodes match the current filter criteria.</p>
                                <button onClick={() => setIsFormOpen(true)} className="mt-8 tech-button bg-indigo-600 text-white px-8 py-3 border-none">
                                    Register First SKU
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="tech-table">
                                    <thead>
                                        <tr>
                                            <th className="w-10">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    checked={filteredInventory.length > 0 && selectedItemIds.length === filteredInventory.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </th>
                                            <th>Identification</th>
                                            <th>Economics</th>
                                            <th className="text-center">Availability</th>
                                            <th className="text-right">Classification</th>
                                            <th className="text-right">Operations</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInventory.map((item) => {
                                            const owner = item.traderId ? traders.find(t => t.id === item.traderId) : null;
                                            const isLowStock = item.quantity <= (item.reorderLevel || 0);
                                            return (
                                                <tr key={item.id} className={`group ${selectedItemIds.includes(item.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : (isLowStock ? 'bg-rose-50/30 dark:bg-rose-900/5' : '')}`}>
                                                    <td className="w-10">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            checked={selectedItemIds.includes(item.id)}
                                                            onChange={() => toggleSelectItem(item.id)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm border ${isLowStock ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'} group-hover:scale-105 group-hover:rotate-2 group-hover:shadow-indigo-500/10`}>
                                                                <Package size={22} />
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{item.name}</div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[9px] bg-slate-900 text-white font-black px-2 py-0.5 rounded uppercase tracking-widest leading-none">SKU: {item.sku || 'UNSET'}</span>
                                                                    {item.barcode && <span className="text-[9px] flex items-center gap-1 text-slate-400 font-bold uppercase tracking-widest"><Barcode size={10} /> {item.barcode}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded flex items-center gap-1.5">
                                                                    <span className="text-[8px] font-black text-indigo-400 uppercase">MSRP</span>
                                                                    <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400">{formatCurrency(item.unitPrice, owner?.location)}</span>
                                                                </div>
                                                                {item.wholesalePrice ? (
                                                                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded flex items-center gap-1.5">
                                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">B2B</span>
                                                                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{formatCurrency(item.wholesalePrice, owner?.location)}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] flex items-center gap-2">
                                                                COST: {formatCurrency(item.costPrice || 0, owner?.location)}
                                                                <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                                                                MARGIN: <span className="text-emerald-500">{(((item.unitPrice - item.costPrice) / item.unitPrice) * 100).toFixed(0)}%</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <div className={`text-sm font-black font-mono w-14 h-10 flex items-center justify-center rounded-xl border-2 transition-all duration-300 ${isLowStock ? 'bg-rose-600 text-white border-white dark:border-slate-900 shadow-lg shadow-rose-600/20' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 shadow-sm'}`}>
                                                                {item.quantity}
                                                            </div>
                                                            {isLowStock && (
                                                                <span className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] mt-1.5 animate-pulse">
                                                                    DEPLETED
                                                                </span>
                                                            )}
                                                            <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">{item.uom || 'units'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">{item.category || 'GENERAL'}</div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                    <Globe size={10} /> {item.countryOfOrigin || 'INTL'}
                                                                </span>
                                                            </div>
                                                            {owner && <div className="text-[8px] font-black text-indigo-500 mt-1.5 uppercase tracking-[0.2em] border-t border-indigo-500/10 pt-1">{owner.businessName}</div>}
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleViewHistory(item)}
                                                                className="p-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                                                                title="Activity Logs"
                                                            >
                                                                <History size={18} />
                                                            </button>
                                                            {canEdit && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => handleOpenAdjustment(item)}
                                                                        className="p-3 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                                                                        title="Override Stock"
                                                                    >
                                                                        <Sliders size={18} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleEdit(item)}
                                                                        className="p-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                                                                        title="Edit Configuration"
                                                                    >
                                                                        <ExternalLink size={18} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {canDelete && (
                                                                <button 
                                                                    onClick={() => handleDelete(item.id)}
                                                                    className="p-3 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                                                    title="Wipe Node"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                ) : activeSubTab === 'analytics' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                            <div className="lg:col-span-1 tech-card p-6 border-l-4 border-indigo-600 bg-white dark:bg-slate-900">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-[0.2em]">Inventory Health</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Global Coverage</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total SKUs</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{filteredInventory.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Units</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{stockValuation.totalQty.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-[10px] text-rose-600 font-black uppercase tracking-widest">Low Stock Nodes</span>
                                        </div>
                                        <span className="text-sm font-black text-rose-600 font-mono">{filteredInventory.filter(i => i.quantity <= (i.reorderLevel || 0)).length}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-1 tech-card p-6 border-l-4 border-emerald-500 bg-white dark:bg-slate-900">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                                        <DollarSign size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-[0.2em]">Asset Valuation</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Capital Liquidity</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Cost Basis</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{formatCurrency(stockValuation.totalCost, loggedInTrader?.location)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-50 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Retail value</span>
                                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{formatCurrency(stockValuation.totalValue, loggedInTrader?.location)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Gross Margin</span>
                                        <span className="text-sm font-black text-emerald-600 font-mono">{(((stockValuation.totalValue - stockValuation.totalCost) / stockValuation.totalValue) * 100 || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -mr-32 -mt-32" />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="space-y-1">
                                            <h4 className="text-white font-black text-xs uppercase tracking-[0.3em]">Telemetry Scan</h4>
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Category Distribution</h3>
                                        </div>
                                        <BarChart size={24} className="text-indigo-400" />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {Array.from(new Set(filteredInventory.map(i => i.category || 'Standard'))).slice(0, 4).map(cat => {
                                            const catItems = filteredInventory.filter(i => (i.category || 'Standard') === cat);
                                            const totalCatQty = catItems.reduce((acc, i) => acc + i.quantity, 0);
                                            const percentage = (totalCatQty / stockValuation.totalQty) * 100 || 0;
                                            return (
                                                <div key={cat} className="space-y-2">
                                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                        <span>{cat}</span>
                                                        <span className="text-indigo-400">{percentage.toFixed(0)}%</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden border border-slate-800">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${percentage}%` }}
                                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                                            className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.3)]"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="relative z-10 pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Real-time Node Distribution Active</span>
                                    </div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">PrimeAxis Data Stream</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="tech-card p-8 border-t-4 border-amber-500 bg-white dark:bg-slate-900">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-500">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-widest">Critical Reorder Queue</h4>
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">High Priority Fulfillment</p>
                                        </div>
                                    </div>
                                    <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-1 rounded-lg">
                                        {filteredInventory.filter(i => i.quantity <= (i.reorderLevel || 0)).length} ALERTS
                                    </span>
                                </div>
                                
                                <div className="space-y-3">
                                    {filteredInventory.filter(i => i.quantity <= (i.reorderLevel || 0)).length === 0 ? (
                                        <div className="py-16 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <CheckCircle className="mx-auto text-emerald-500 mb-3" size={32} />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Stock Nodes Fully Operational</p>
                                        </div>
                                    ) : (
                                        filteredInventory.filter(i => i.quantity <= (i.reorderLevel || 0)).slice(0, 5).map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl transition group hover:shadow-xl hover:shadow-amber-500/5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-rose-600 text-white rounded-xl flex flex-col items-center justify-center font-black shadow-lg shadow-rose-600/20">
                                                        <span className="text-sm">{item.quantity}</span>
                                                        <span className="text-[7px] uppercase tracking-tighter opacity-70">LEFT</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-amber-500 transition-colors">{item.name}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[8px] text-slate-400 font-black uppercase">Threshold: {item.reorderLevel}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                            <span className="text-[8px] text-slate-400 font-black uppercase">SKU: {item.sku}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setActiveSubTab('marketplace');
                                                        setSearchQuery(item.sku);
                                                    }}
                                                    className="w-10 h-10 bg-white dark:bg-slate-900 text-slate-400 hover:text-amber-500 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center justify-center shadow-sm"
                                                >
                                                    <Truck size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="tech-card p-8 border-t-4 border-indigo-500 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-500">
                                            <PieChart size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white text-[11px] uppercase tracking-widest">Inventory Event Log</h4>
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Automated System Audit</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monitoring</span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700">
                                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                                                <Info size={14} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Cloud Registry Sync Successful</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[8px] text-indigo-500 font-black uppercase tracking-widest">Global Node Refresh</span>
                                                    <span className="text-[8px] text-slate-400 font-mono uppercase">T + {new Date().toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700">
                                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                                                <Zap size={14} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">Valuation Recalculation Node Online</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">PrimeAxis Engine</span>
                                                    <span className="text-[8px] text-slate-400 font-mono uppercase">T + {new Date().toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeSubTab === 'marketplace' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="bg-slate-900 border-l-4 border-indigo-600 rounded-r-3xl p-8 mb-8 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-32 -mt-32" />
                            <div className="relative z-10 flex flex-col xl:flex-row xl:items-center gap-8">
                                <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shrink-0 shadow-lg shadow-indigo-600/20">
                                    <ShoppingBag size={32} className="text-indigo-400" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-500">Business Network</h3>
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Global Merchant Marketplace</h2>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-3xl">
                                        Interface with verified B2B fulfillment nodes. Synchronize procurement across the PrimeAxis supply network. 
                                        Execute bulk restock protocols and request direct stock fulfillment.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest">Network Online</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-800 mx-2 hidden xl:block" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Terminal 04</span>
                                </div>
                            </div>
                        </div>

                        {/* View Toggle Bar */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5">
                                <button 
                                    onClick={() => setMarketplaceViewMode('grouped')}
                                    className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2.5 ${marketplaceViewMode === 'grouped' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                >
                                    <Building size={14} />
                                    Supplier Nodes
                                </button>
                                <button 
                                    onClick={() => setMarketplaceViewMode('grid')}
                                    className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2.5 ${marketplaceViewMode === 'grid' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                >
                                    <LayoutGrid size={14} />
                                    Asset Grid
                                </button>
                            </div>
                            <div className="flex items-center gap-4 px-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                        {marketplaceViewMode === 'grouped' ? 'Partners' : 'Stock Nodes'}
                                    </span>
                                    <span className="bg-slate-900 text-white text-[10px] font-black font-mono px-2 py-0.5 rounded shadow-sm">
                                        {marketplaceViewMode === 'grouped' ? groupedMarketplace.length : filteredMarketplace.length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {loadingNetwork ? (
                            <div className="flex flex-col items-center justify-center py-40 text-slate-400">
                                <div className="relative">
                                    <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-600 rounded-full animate-spin mb-8" />
                                    <RefreshCw className="absolute inset-0 m-auto text-indigo-500 animate-pulse" size={24} />
                                </div>
                                <p className="font-black text-[11px] text-slate-600 uppercase tracking-[0.3em] animate-pulse">Synchronizing Supply Chain Terminal...</p>
                            </div>
                        ) : filteredMarketplace.length === 0 ? (
                            <div className="tech-card p-32 text-center bg-white dark:bg-slate-900">
                                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8">
                                    <ShoppingBag className="text-slate-200 dark:text-slate-700" size={48} />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Zero Network Hits</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest mt-3 max-w-sm mx-auto leading-relaxed">No external inventory nodes match the current scan. Re-verify filters or wait for global listing sync.</p>
                            </div>
                        ) : marketplaceViewMode === 'grouped' ? (
                            <div className="space-y-12">
                                {groupedMarketplace.map((supplier) => {
                                    const supplierMarketItems = marketplace.filter(i => i.traderId === supplier.trader.id);
                                    return (
                                        <div key={supplier.trader.id} className="tech-card p-8 bg-white dark:bg-slate-900 group border-l-4 border-slate-200 dark:border-slate-800 hover:border-indigo-600 transition-all duration-500">
                                            {/* Supplier Header Info */}
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-50 dark:border-slate-800 pb-8 mb-8">
                                                <div className="flex items-center gap-6">
                                                    <div className="relative">
                                                        {supplier.trader.logoUrl ? (
                                                            <img src={supplier.trader.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2 shadow-sm" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <div className="w-16 h-16 bg-gradient-to-tr from-slate-800 to-slate-900 dark:from-indigo-900 dark:to-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl border border-slate-700 shadow-xl">
                                                                {supplier.businessName.substring(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="font-black text-slate-900 dark:text-white text-xl uppercase tracking-tight">{supplier.businessName}</h4>
                                                            <span className="text-[8px] bg-slate-900 text-white font-black px-2 py-0.5 rounded-lg uppercase tracking-[0.2em] border border-slate-700">Verified Partner</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                                                                <Globe size={12} className="text-indigo-500" />
                                                                {supplier.location || 'Nairobi Area'}
                                                            </div>
                                                            <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{supplier.trader.email || 'partner.network'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    <button 
                                                        onClick={() => handleOpenRestockModal(supplier.trader)}
                                                        className="tech-button bg-indigo-600 text-white border-none px-8 py-4 flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20"
                                                    >
                                                        <Truck size={16} /> 
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Consolidated Restock Protocol</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* List of Products from this Supplier */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                {supplierMarketItems.map(item => {
                                                    const userItem = inventory.find(i => i.sku === item.sku && i.traderId === effectiveTraderId);
                                                    const isLowInMyStock = userItem && userItem.quantity <= userItem.reorderLevel;
                                                    return (
                                                        <div key={item.id} className="tech-card p-6 bg-slate-50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 border-slate-100 dark:border-slate-700/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 flex flex-col justify-between group/item">
                                                            <div className="space-y-4">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="bg-slate-900 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-widest">SKU: {item.sku}</div>
                                                                    <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">{formatCurrency(item.unitPrice, loggedInTrader?.location)}</div>
                                                                </div>
                                                                <h5 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-tight leading-relaxed group-hover/item:text-indigo-600 transition-colors">{item.name}</h5>
                                                            </div>
                                                            
                                                            <div className="mt-6 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="space-y-1">
                                                                        <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Network Availability</div>
                                                                        <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 font-mono">{item.quantity} {item.uom || 'units'}</div>
                                                                    </div>
                                                                    <div className="text-right space-y-1">
                                                                        <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Local Registry</div>
                                                                        {userItem ? (
                                                                            <div className={`text-[11px] font-black font-mono flex items-center justify-end gap-1.5 ${isLowInMyStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                                {userItem.quantity} {item.uom || 'units'}
                                                                                {isLowInMyStock && <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.6)]" />}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-indigo-500 font-black text-[8px] uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">New Entry</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                <button 
                                                                    onClick={() => handleOpenRestockModal(supplier.trader, { [item.sku]: getSuggestedQty(item.sku) })}
                                                                    className="w-full tech-button bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 py-2 text-[9px] font-black uppercase tracking-[0.2em]"
                                                                >
                                                                    Accelerated Request
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredMarketplace.map(item => (
                                    <div key={item.id} className="tech-card bg-white dark:bg-slate-900 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group shadow-lg flex flex-col justify-between">
                                        <div className="p-8">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="bg-slate-900 text-white text-[9px] font-black px-2.5 py-1 rounded-lg font-mono uppercase tracking-widest shadow-sm">
                                                    {item.sku || 'UNSET'}
                                                </div>
                                                <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800 uppercase tracking-widest">
                                                    {item.quantity} {item.uom}
                                                </div>
                                            </div>
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 group-hover:text-indigo-600 transition-colors leading-relaxed min-h-[40px] line-clamp-2">{item.name}</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-8 font-black uppercase tracking-widest">
                                                <Building size={14} className="text-indigo-500" />
                                                <span className="truncate">{item.businessName}</span>
                                            </div>
                                            <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-50 dark:border-slate-800">
                                                <div className="space-y-1">
                                                    <div className="text-[8px] text-slate-400 uppercase font-black tracking-[0.2em]">Procurement Basis</div>
                                                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono">{formatCurrency(item.unitPrice, loggedInTrader?.location)}</div>
                                                </div>
                                                <button 
                                                    onClick={() => handleCreateRequest(item)}
                                                    className="w-12 h-12 bg-slate-900 text-white hover:bg-indigo-600 rounded-2xl shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center border border-slate-700"
                                                    title="Initialize Request"
                                                >
                                                    <Plus size={24} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Truck size={14} className="text-slate-300 dark:text-slate-600" /> 
                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Node Logistics Active</span>
                                            </div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            ) : activeSubTab === 'requests' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Header Summary Stats for Requests */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="tech-card p-6 bg-white dark:bg-slate-900 border-l-4 border-indigo-500 shadow-xl group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                        {requests.filter(r => r.traderId === effectiveTraderId && r.status === 'pending').length}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Awaiting Fulfillment</div>
                                </div>
                            </div>
                        </div>
                        <div className="tech-card p-6 bg-white dark:bg-slate-900 border-l-4 border-emerald-500 shadow-xl group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                        {requests.filter(r => r.traderId === effectiveTraderId && r.status === 'received').length}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Inventory Ingested</div>
                                </div>
                            </div>
                        </div>
                        <div className="tech-card p-6 bg-white dark:bg-slate-900 border-l-4 border-blue-500 shadow-xl group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                        {incomingRequests.filter(r => r.status === 'pending' || r.status === 'shipped').length}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Outgoing Logistics</div>
                                </div>
                            </div>
                        </div>
                        <div className="tech-card p-6 bg-slate-900 border-l-4 border-slate-700 shadow-xl group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <div className="text-xl font-black text-white font-mono">
                                        ACTIVE
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Registry Link</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Outbound Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                                        <ArrowUpRight size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-lg">Outbound Asset Procurement</h3>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Purchasing and Restock Activity</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setActiveSubTab('marketplace')}
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-[0.15em] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-1.5 rounded-lg transition-all"
                                >
                                    Marketplace Terminal
                                </button>
                            </div>

                            <div className="space-y-4">
                                {requests.filter(r => r.traderId === effectiveTraderId).length === 0 ? (
                                    <div className="tech-card bg-white dark:bg-slate-900 p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                                        <ShoppingBag size={48} className="mx-auto mb-6 text-slate-200 dark:text-slate-700 opacity-50" />
                                        <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">No procurement activity detected in registry.</p>
                                    </div>
                                ) : (
                                    requests.filter(r => r.traderId === effectiveTraderId).map(req => (
                                        <div key={req.id} className="tech-card p-6 bg-white dark:bg-slate-900 hover:shadow-2xl transition-all duration-500 group border-l-4 border-slate-200 dark:border-slate-800 hover:border-indigo-600">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="font-black text-slate-900 dark:text-white text-base uppercase tracking-tight">{req.itemName}</h4>
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border flex items-center gap-1.5 uppercase tracking-[0.2em] shadow-sm ${getStatusColor(req.status)}`}>
                                                            <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                            <Building size={12} className="text-indigo-500" />
                                                            <span className="text-slate-700 dark:text-slate-300">Supplier: {req.providerBusiness}</span>
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest font-mono">ID: #{String(req.id).substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right space-y-1">
                                                    <div className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tighter leading-none">{formatCurrency(req.price * req.quantity, loggedInTrader?.location)}</div>
                                                    <div className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{req.quantity} units requested</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-slate-800">
                                                <div className="text-[9px] text-slate-400 flex items-center gap-2 font-mono font-black uppercase tracking-widest">
                                                    <Calendar size={12} className="text-slate-300 dark:text-slate-600" />
                                                    INIT: {new Date(req.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleViewPO(req.id)}
                                                        className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-900 hover:text-white rounded-xl transition-all text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 flex items-center gap-2 shadow-sm"
                                                        title="Retrieve PO Node"
                                                    >
                                                        <FileDown size={14} />
                                                        <span className="text-[9px] font-black uppercase tracking-widest">PO</span>
                                                    </button>
                                                    {req.status === 'received' && (
                                                        <button 
                                                            onClick={() => handleViewGRN(req.id)}
                                                            className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-600 hover:text-white rounded-xl transition-all text-emerald-600 border border-emerald-100 dark:border-emerald-800 flex items-center gap-2 shadow-sm"
                                                            title="Retrieve GRN Node"
                                                        >
                                                            <Receipt size={14} />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">GRN</span>
                                                        </button>
                                                    )}
                                                    {req.status === 'shipped' && (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(req.id, 'received')}
                                                            className="tech-button bg-indigo-600 text-white border-none py-2 px-5 shadow-lg shadow-indigo-600/20"
                                                        >
                                                            <Package size={14} />
                                                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Confirm Delivery</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                                <h4 className="font-black text-slate-900 mb-6 flex items-center gap-3">
                                    <AlertTriangle size={20} className="text-amber-500" />
                                    Critical Reorder Actions
                                </h4>
                                <div className="space-y-4">
                                    {filteredInventory.filter(i => i.quantity <= (i.reorderLevel || 0)).length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 italic text-sm">
                                            Inventory levels are optimal. No reorders needed.
                                        </div>
                                    ) : (
                                        filteredInventory.filter(i => i.quantity <= (i.reorderLevel || 0)).slice(0, 5).map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-white border border-slate-100 rounded-2xl transition hover:shadow-md">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-black shadow-sm">
                                                        {item.quantity}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-slate-900 leading-tight">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">MIN: {item.reorderLevel} • SKU: {item.sku}</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setActiveSubTab('marketplace');
                                                        setSearchQuery(item.sku);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Find Sourcing"
                                                >
                                                    <Truck size={18} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm overflow-hidden flex flex-col">
                                <h4 className="font-black text-slate-900 mb-6 flex items-center gap-3">
                                    <PieChart size={20} className="text-indigo-500" />
                                    Recent Inventory Logs
                                </h4>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                    {/* Placeholder for real logs fetched from context if available */}
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Latest System Audit Events</div>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50">
                                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                                <Info size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">Inventory Dashboard Sync Completed</p>
                                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{new Date().toLocaleTimeString()} • SYSTEM</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50">
                                            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                                                <Tag size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">Valuation Engine Recalculated</p>
                                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{new Date().toLocaleTimeString()} • ENGINE</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="animate-in fade-in duration-500">
                        {/* Summary Stats for Requests */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
                                    <Clock size={28} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 font-mono">
                                        {outgoingRequests.filter(r => r.status === 'pending').length}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pending Requests</div>
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                                    <Truck size={28} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 font-mono">
                                        {incomingStock.length}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Stock In-Transit</div>
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                                    <CheckCircle size={28} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-slate-900 font-mono">
                                        {incomingRequests.filter(r => r.status === 'pending').length}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Incoming Actions</div>
                                </div>
                            </div>
                        </div>

                        {/* Bulk Operations Toolbar for POs and GRNs */}
                        {selectedRequestIds.length > 0 && (
                            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 mb-8">
                                <div className="flex items-center gap-3">
                                    <span className="bg-blue-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider font-mono">
                                        {selectedRequestIds.length} Selected
                                    </span>
                                    <div>
                                        <div className="text-sm font-black text-white">Bulk PO & GRN Workflow Active</div>
                                        <div className="text-[10px] text-slate-400 font-medium">Approve POs to clear sub-items or confirm GRNs to update stock across all selling points</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={handleBulkApprovePOs}
                                        disabled={loadingNetwork}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-5 py-2.5 rounded-xl transition shadow-lg flex items-center gap-2 uppercase tracking-wider cursor-pointer"
                                        title="Approve selected POs in bulk to clear sub-items"
                                    >
                                        <CheckCircle size={16} /> Bulk Approve POs
                                    </button>
                                    <button
                                        onClick={handleBulkApproveGRNs}
                                        disabled={loadingNetwork}
                                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-5 py-2.5 rounded-xl transition shadow-lg flex items-center gap-2 uppercase tracking-wider cursor-pointer"
                                        title="Approve selected GRNs in bulk to add stock to inventory"
                                    >
                                        <Receipt size={16} /> Bulk Approve GRNs
                                    </button>
                                    <button
                                        onClick={handleConsolidatePO}
                                        disabled={loadingNetwork}
                                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition shadow-lg flex items-center gap-2 uppercase tracking-wider cursor-pointer"
                                    >
                                        <Share2 size={16} /> Consolidate PO
                                    </button>
                                    <button
                                        onClick={handleBulkRejectRequests}
                                        disabled={loadingNetwork}
                                        className="bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center gap-2 uppercase tracking-wider cursor-pointer"
                                    >
                                        <XCircle size={16} /> Bulk Decline
                                    </button>
                                    <button
                                        onClick={() => setSelectedRequestIds([])}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Outgoing Requests & Incoming Stock */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg uppercase tracking-tighter">
                                        <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-500/20"><ArrowUpRight size={20} /></div>
                                        Stock Requests & Transit
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        {selectedRequestIds.length > 1 && (
                                            <button 
                                                onClick={handleConsolidatePO}
                                                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-4 py-2 rounded-xl transition shadow-lg flex items-center gap-2 uppercase tracking-widest animate-in fade-in slide-in-from-right-4"
                                            >
                                                <Share2 size={14} /> Consolidate to PO
                                            </button>
                                        )}
                                        <span className="text-[10px] bg-slate-900 text-white font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                            {outgoingRequests.length} Records
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    {loadingNetwork ? (
                                        <div className="flex flex-col items-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                            <RefreshCw className="animate-spin text-blue-500 mb-3" size={32} />
                                            <p className="text-xs font-bold text-slate-400">Loading your requests...</p>
                                        </div>
                                    ) : outgoingRequests.length === 0 ? (
                                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 italic text-sm shadow-sm">
                                            <ArrowRightLeft className="mx-auto mb-4 opacity-20" size={48} />
                                            No stock requests sent yet.
                                        </div>
                                    ) : (
                                        outgoingRequests.map(req => (
                                            <div key={req.id} className={`bg-white border-2 rounded-3xl p-6 shadow-sm transition-all duration-300 relative ${req.status === 'shipped' ? 'border-blue-600 ring-4 ring-blue-600/5' : 'border-slate-200'} ${selectedRequestIds.includes(req.id) ? 'border-blue-600 bg-blue-50/10' : ''}`}>
                                                <div className="absolute top-6 left-2">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedRequestIds.includes(req.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedRequestIds([...selectedRequestIds, req.id]);
                                                            } else {
                                                                setSelectedRequestIds(selectedRequestIds.filter(id => id !== req.id));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex justify-between items-start mb-5 ml-8">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h4 className="font-black text-slate-900 text-base">{req.itemName}</h4>
                                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 uppercase tracking-tighter ${getStatusColor(req.status)}`}>
                                                                {getStatusIcon(req.status)} {req.status === 'shipped' ? 'IN TRANSIT' : req.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                                            <Building size={14} className="text-slate-300" />
                                                            Source: <span className="text-slate-900">{req.providerBusiness}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-black text-slate-900 font-mono tracking-tighter">KES {(req.price * req.quantity).toLocaleString()}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{req.quantity} units @ KES {req.price}</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center justify-between pt-5 border-t border-slate-50 ml-8">
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-2 font-bold uppercase tracking-widest font-mono">
                                                        <Clock size={12} /> {new Date(req.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {req.status === 'pending' && (
                                                            <button 
                                                                onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition text-[10px] font-black uppercase tracking-wider border border-rose-200"
                                                                title="Cancel Request"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleViewPO(req.id)}
                                                            className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-blue-600 flex items-center gap-1.5"
                                                            title="View Purchase Order"
                                                        >
                                                            <FileDown size={16} />
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">PO</span>
                                                        </button>
                                                        {req.status === 'received' && (
                                                            <button 
                                                                onClick={() => handleViewGRN(req.id)}
                                                                className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-emerald-600 flex items-center gap-1.5"
                                                                title="View Receipt Note"
                                                            >
                                                                <Receipt size={16} />
                                                                <span className="text-[10px] font-black uppercase tracking-tighter">GRN</span>
                                                            </button>
                                                        )}
                                                        {req.status === 'shipped' && (
                                                            <button 
                                                                onClick={() => handleUpdateStatus(req.id, 'received')}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-5 py-2.5 rounded-xl transition shadow-xl shadow-emerald-600/20 flex items-center gap-2 uppercase tracking-widest"
                                                            >
                                                                <Package size={14} /> Confirm Delivery
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Incoming Supply Requests */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg uppercase tracking-tighter">
                                        <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20"><ArrowDownLeft size={20} /></div>
                                        Incoming Fulfillment
                                    </h3>
                                    <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-200">
                                        {incomingRequests.filter(r => r.status === 'pending').length} Actions Required
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {loadingNetwork ? (
                                        <div className="flex flex-col items-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                            <RefreshCw className="animate-spin text-blue-500 mb-3" size={32} />
                                            <p className="text-xs font-bold text-slate-400">Loading incoming requests...</p>
                                        </div>
                                    ) : incomingRequests.length === 0 ? (
                                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 italic text-sm shadow-sm">
                                            <Truck className="mx-auto mb-4 opacity-20" size={48} />
                                            No fulfillment requests found.
                                        </div>
                                    ) : (
                                        incomingRequests.map(req => (
                                            <div key={req.id} className={`bg-white border-2 rounded-3xl p-6 shadow-sm transition-all duration-300 relative ${req.status === 'pending' ? 'border-blue-600 ring-4 ring-blue-600/5' : 'border-slate-200'} ${selectedRequestIds.includes(req.id) ? 'border-blue-600 bg-blue-50/10' : ''}`}>
                                                <div className="absolute top-6 left-2">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedRequestIds.includes(req.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedRequestIds([...selectedRequestIds, req.id]);
                                                            } else {
                                                                setSelectedRequestIds(selectedRequestIds.filter(id => id !== req.id));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="ml-8">
                                                    <div className="flex justify-between items-start mb-5">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <h4 className="font-black text-slate-900 text-base">{req.itemName}</h4>
                                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 uppercase tracking-tighter ${getStatusColor(req.status)}`}>
                                                                    {getStatusIcon(req.status)} {req.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                                                <Users size={14} className="text-blue-400" />
                                                                Requester: <span className="text-slate-900">{req.requesterBusiness}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-slate-900 font-mono tracking-tighter">KES {(req.price * req.quantity).toLocaleString()}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{req.quantity} units</div>
                                                        </div>
                                                    </div>

                                                {req.notes && (
                                                    <div className="bg-slate-50 rounded-2xl p-4 mb-5 text-[11px] text-slate-600 flex items-start gap-3 italic border border-slate-100">
                                                        <MessageSquare size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                                        "{req.notes}"
                                                    </div>
                                                )}
                                                
                                                <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono font-bold uppercase tracking-widest">
                                                        #{req.id} • {new Date(req.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button 
                                                            onClick={() => handleViewPO(req.id)}
                                                            className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-blue-600 flex items-center gap-1.5"
                                                            title="View Order Request"
                                                        >
                                                            <FileDown size={16} />
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">PO</span>
                                                        </button>
                                                        {req.status === 'received' && (
                                                            <button 
                                                                onClick={() => handleViewGRN(req.id)}
                                                                className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-emerald-600 flex items-center gap-1.5"
                                                                title="View Receipt Confirmed"
                                                            >
                                                                <Receipt size={16} />
                                                                <span className="text-[10px] font-black uppercase tracking-tighter">GRN</span>
                                                            </button>
                                                        )}
                                                        {req.status === 'pending' && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleOpenReject(req.id)}
                                                                    className="text-slate-400 hover:text-rose-600 text-[10px] font-black px-4 py-2 rounded-xl transition uppercase tracking-widest"
                                                                >
                                                                    Decline
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleUpdateStatus(req.id, 'approved')}
                                                                    className="bg-slate-900 hover:bg-blue-600 text-white text-[10px] font-black px-5 py-2.5 rounded-xl transition shadow-xl flex items-center gap-2 uppercase tracking-widest"
                                                                >
                                                                    <CheckCircle size={14} /> Approve
                                                                </button>
                                                            </>
                                                        )}
                                                        {req.status === 'approved' && (
                                                            <button 
                                                                onClick={() => handleUpdateStatus(req.id, 'shipped')}
                                                                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-5 py-2.5 rounded-xl transition shadow-xl shadow-blue-600/20 flex items-center gap-2 uppercase tracking-widest"
                                                            >
                                                                <Truck size={14} /> Mark Shipped
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeSubTab === 'documents' ? (
                    <div className="animate-in fade-in duration-500">
                        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document No.</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner Business</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[...requests]
                                        .filter(r => r.requesterId === effectiveTraderId || r.providerId === effectiveTraderId)
                                        .flatMap(req => {
                                            const docs = [];
                                            if (req.poNumber && (filterStatus === 'all' || filterStatus === 'po')) {
                                                docs.push({ id: req.id, no: req.poNumber, type: 'PO', date: req.createdAt, partner: req.requesterId === effectiveTraderId ? req.providerBusiness : req.requesterBusiness });
                                            }
                                            if (req.grnNumber && (filterStatus === 'all' || filterStatus === 'grn')) {
                                                docs.push({ id: req.id, no: req.grnNumber, type: 'GRN', date: req.updatedAt, partner: req.requesterId === effectiveTraderId ? req.providerBusiness : req.requesterBusiness });
                                            }
                                            return docs;
                                        })
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((doc, idx) => (
                                            <tr key={`${doc.type}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-mono font-black text-blue-600 text-xs">{doc.no}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${doc.type === 'PO' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                                        {doc.type === 'PO' ? 'Purchase Order' : 'Receipt Note'}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-700 text-xs">{doc.partner}</td>
                                                <td className="p-4 text-slate-400 text-xs font-mono">{new Date(doc.date).toLocaleDateString()}</td>
                                                <td className="p-4 text-right">
                                                    <button 
                                                        onClick={() => doc.type === 'PO' ? handleViewPO(doc.id) : handleViewGRN(doc.id)}
                                                        className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition shadow-sm"
                                                        title="Generate PDF"
                                                    >
                                                        <FileDown size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    {requests.filter(r => r.requesterId === effectiveTraderId || r.providerId === effectiveTraderId).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400 italic text-xs font-bold">
                                                No supply chain documents found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeSubTab === 'bulk-import' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                            {/* Import Header */}
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-200 dark:shadow-none">
                                            <Upload size={32} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Inventory Ingestion Terminal</h3>
                                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                                                    EXCEL & CSV READY
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Scale stock directory with smart schema mapping, inline editing & collision resolution</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button 
                                            onClick={downloadExcelTemplate}
                                            className="tech-button bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 px-5 py-2.5 flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors shadow-xs"
                                            title="Download pre-formatted Excel template (.xlsx)"
                                        >
                                            <FileSpreadsheet size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Excel Blueprint (.xlsx)</span>
                                        </button>

                                        <button 
                                            onClick={downloadCsvTemplate}
                                            className="tech-button bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 px-5 py-2.5 flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors shadow-xs"
                                            title="Download CSV format template"
                                        >
                                            <Download size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">CSV Template</span>
                                        </button>

                                        <button 
                                            onClick={() => setIsCsvImportOpen(true)}
                                            className="tech-button bg-slate-900 text-white border-none px-5 py-2.5 flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-xs"
                                            title="Launch dedicated pop-up modal wizard"
                                        >
                                            <ExternalLink size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Modal Wizard</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Step Progress */}
                                <div className="flex items-center gap-4 mt-8">
                                    {[
                                        { id: 'upload', label: '1. SOURCE', icon: FileDown },
                                        { id: 'mapping', label: '2. SCHEMA', icon: LayoutGrid },
                                        { id: 'preview', label: '3. VALIDATE & EDIT', icon: CheckCircle },
                                        { id: 'summary', label: '4. FINALIZE', icon: ShieldCheck },
                                    ].map((step, idx) => {
                                        const steps = ['upload', 'mapping', 'preview', 'importing', 'summary'];
                                        const currentIdx = steps.indexOf(importStep);
                                        const stepIdx = steps.indexOf(step.id);
                                        const isActive = importStep === step.id || (step.id === 'preview' && importStep === 'importing');
                                        const isCompleted = stepIdx < currentIdx && step.id !== 'summary';

                                        return (
                                            <React.Fragment key={step.id}>
                                                <div className={`flex items-center gap-3 transition-all duration-300 ${isActive ? 'opacity-100 scale-105' : isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 ${isActive ? 'bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white' : isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                                                        {isCompleted ? <CheckCircle size={16} /> : <step.icon size={16} />}
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{step.label}</span>
                                                </div>
                                                {idx < 3 && <div className={`flex-1 h-px ${stepIdx < currentIdx ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step Content */}
                            <div className="p-8 min-h-[400px]">
                                {importStep === 'upload' && (
                                    <div className="max-w-3xl mx-auto py-8 space-y-6">
                                        {/* Dual Input Method Selector */}
                                        <div className="flex justify-center">
                                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                <button
                                                    onClick={() => setImportInputMode('upload')}
                                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                                        importInputMode === 'upload' 
                                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-black' 
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    <Upload size={14} /> 📁 File Upload (.xlsx, .xls, .csv)
                                                </button>
                                                <button
                                                    onClick={() => setImportInputMode('paste')}
                                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                                        importInputMode === 'paste' 
                                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-black' 
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                                    }`}
                                                >
                                                    <FileText size={14} /> 📋 Direct Clipboard Paste
                                                </button>
                                            </div>
                                        </div>

                                        {importInputMode === 'upload' ? (
                                            <div 
                                                onDragOver={(e) => { e.preventDefault(); setIsDraggingImportFile(true); }}
                                                onDragLeave={() => setIsDraggingImportFile(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingImportFile(false);
                                                    const dropped = e.dataTransfer.files?.[0];
                                                    if (dropped) handleFileSelected(dropped);
                                                }}
                                                className={`border-2 border-dashed rounded-[3rem] p-14 text-center transition-all cursor-pointer group relative overflow-hidden ${
                                                    isDraggingImportFile 
                                                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 scale-[1.01]' 
                                                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-900/30'
                                                }`}
                                                onClick={() => document.getElementById('bulk-import-input')?.click()}
                                            >
                                                <div className="relative z-10">
                                                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 transition-transform">
                                                        <FileSpreadsheet size={42} className="text-emerald-500" />
                                                    </div>
                                                    <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                                                        {importFileName ? `Selected: ${importFileName}` : 'Initialize Data Ingestion Stream'}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed mb-6">
                                                        Drag and drop your Excel (.xlsx, .xls) or CSV file here<br/>to begin automated schema mapping
                                                    </p>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            document.getElementById('bulk-import-input')?.click();
                                                        }}
                                                        className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-transform active:scale-95"
                                                    >
                                                        Select Spreadsheet File
                                                    </button>
                                                </div>
                                                <input 
                                                    id="bulk-import-input"
                                                    type="file" 
                                                    className="hidden" 
                                                    accept=".xlsx,.xls,.csv,.tsv,.txt"
                                                    onChange={handleImportFileUpload}
                                                />
                                            </div>
                                        ) : (
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider">Paste Tabular or CSV Content</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">Row 1 must be headers</span>
                                                </div>
                                                <textarea
                                                    rows={8}
                                                    value={pastedDataText}
                                                    onChange={(e) => setPastedDataText(e.target.value)}
                                                    placeholder="Item Name&#9;SKU&#9;Category&#9;Supplier&#9;Buying Price&#9;Selling Price&#9;Quantity&#9;Reorder Level&#10;Basmati Rice 25kg&#9;SKU-RICE-25&#9;Cereals&#9;Mwea Millers&#9;2200&#9;2800&#9;50&#9;10&#10;Pure Cooking Oil 5L&#9;SKU-OIL-5L&#9;Groceries&#9;Bidco Africa&#9;1100&#9;1350&#9;30&#9;5"
                                                    className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 leading-relaxed"
                                                />
                                                <button
                                                    onClick={handlePasteImport}
                                                    disabled={!pastedDataText.trim()}
                                                    className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-xs py-3.5 rounded-2xl transition shadow-lg uppercase tracking-wider cursor-pointer"
                                                >
                                                    Process Pasted Matrix →
                                                </button>
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-5 rounded-3xl">
                                                <div className="flex items-center gap-2.5 mb-1.5 text-amber-600 dark:text-amber-400">
                                                    <Info size={16} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Excel & CSV Formatting</span>
                                                </div>
                                                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                                    Supports standard .xlsx workbooks, UTF-8 CSVs, and comma or tab-separated sheets. Multi-sheet workbooks read from the primary active tab.
                                                </p>
                                            </div>
                                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 p-5 rounded-3xl">
                                                <div className="flex items-center gap-2.5 mb-1.5 text-indigo-600 dark:text-indigo-400">
                                                    <Sparkles size={16} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Smart Ingestion Engine</span>
                                                </div>
                                                <p className="text-[11px] text-indigo-800 dark:text-indigo-300 font-medium leading-relaxed">
                                                    Our engine matches column variations (e.g. "Item", "Product", "Buying Price", "Cost") and validates duplicate SKUs before committing.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {importStep === 'mapping' && (
                                    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                            <div>
                                                <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Schema Alignment Matrix</h4>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Map your spreadsheet columns to the Biashara POS data structure with live value previews</p>
                                            </div>
                                            <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800 uppercase tracking-widest w-fit">
                                                Source: {importFileName || 'spreadsheet'} ({importCsvHeaders.length} cols / {importCsvRows.length} rows)
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            {inventoryFields.map(field => {
                                                const selectedHeader = importColumnMap[field.key];
                                                const sampleStr = selectedHeader ? getImportSampleValues(selectedHeader) : '';
                                                return (
                                                    <div key={field.key} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4.5 rounded-2xl hover:border-slate-400 transition-colors space-y-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${field.required ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-400'}`}>
                                                                    {field.required ? <AlertCircle size={16} /> : <Tag size={16} />}
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Database Field: {field.key}</div>
                                                                </div>
                                                            </div>

                                                            <select 
                                                                value={importColumnMap[field.key] || ''}
                                                                onChange={(e) => setImportColumnMap(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                                className="w-48 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                                            >
                                                                <option value="">-- Ignore Field --</option>
                                                                {importCsvHeaders.map(h => (
                                                                    <option key={h} value={h}>{h}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {selectedHeader && sampleStr && (
                                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800 font-medium">
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Sample:</span> {sampleStr}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                                            <button 
                                                onClick={() => setImportStep('upload')}
                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black uppercase tracking-widest px-4 py-2 cursor-pointer"
                                            >
                                                ← Back to Source
                                            </button>
                                            <button 
                                                onClick={buildImportParsedRows}
                                                className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white px-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all cursor-pointer flex items-center gap-2"
                                            >
                                                Proceed to Validation Matrix <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {importStep === 'preview' && (
                                    <div className="animate-in fade-in duration-500 space-y-6">
                                        
                                        {/* Collision & Deduplication Strategy Selector */}
                                        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                                                    <ShieldCheck size={16} /> Conflict Resolution & Collision Policy
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium">Controls how duplicate SKUs / item names are resolved</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setImportStrategy('skip')}
                                                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${importStrategy === 'skip' ? 'bg-indigo-600/30 border-indigo-500 text-white ring-2 ring-indigo-500/50' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                                >
                                                    <div className="font-bold text-xs flex items-center justify-between">
                                                        🛡️ Skip Existing
                                                        {importStrategy === 'skip' && <Check size={14} className="text-indigo-400" />}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1">Preserves existing records intact. Duplicate matching rows are safely bypassed.</div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setImportStrategy('overwrite')}
                                                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${importStrategy === 'overwrite' ? 'bg-amber-600/30 border-amber-500 text-white ring-2 ring-amber-500/50' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                                >
                                                    <div className="font-bold text-xs flex items-center justify-between">
                                                        🔄 Overwrite & Merge
                                                        {importStrategy === 'overwrite' && <Check size={14} className="text-amber-400" />}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1">Updates price, cost, and stock quantities on matching SKUs from file.</div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setImportStrategy('append')}
                                                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${importStrategy === 'append' ? 'bg-purple-600/30 border-purple-500 text-white ring-2 ring-purple-500/50' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                                >
                                                    <div className="font-bold text-xs flex items-center justify-between">
                                                        ➕ Force Append All
                                                        {importStrategy === 'append' && <Check size={14} className="text-purple-400" />}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1">Imports every row as new, appending automated numerical suffixes to duplicate SKUs.</div>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Action Toolbar: Filter Pills, Auto-Fix, Batch Select */}
                                        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {(['all', 'valid', 'warning', 'error'] as const).map(f => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setImportActiveFilter(f)}
                                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                            importActiveFilter === f 
                                                                ? 'bg-slate-900 text-white shadow-sm' 
                                                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        {f === 'all' && `All Rows (${importParsedRows.length})`}
                                                        {f === 'valid' && `🟢 Valid (${importParsedRows.filter(r => r.status === 'valid').length})`}
                                                        {f === 'warning' && `🟡 Duplicates (${importParsedRows.filter(r => r.status === 'warning').length})`}
                                                        {f === 'error' && `🔴 Faults (${importParsedRows.filter(r => r.status === 'error').length})`}
                                                    </button>
                                                ))}

                                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

                                                <button
                                                    onClick={() => handleToggleSelectAll(true)}
                                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 cursor-pointer"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    onClick={() => handleToggleSelectAll(false)}
                                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                                                >
                                                    Deselect All
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {importParsedRows.some(r => r.status === 'error') && (
                                                    <button
                                                        onClick={handleAutoFixAllRows}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                                                        title="Auto-generate missing SKUs and fallback defaults for errors"
                                                    >
                                                        <Sparkles size={14} /> Auto-Fix Missing SKUs & Defaults
                                                    </button>
                                                )}

                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    Ready to Ingest: <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                                        {importParsedRows.filter(r => r.selected && r.status !== 'error').length}
                                                    </span> / {importParsedRows.length}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Interactive Data Table with Inline Editing */}
                                        <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-x-auto max-h-[380px] bg-white dark:bg-slate-900">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-black sticky top-0 z-10">
                                                    <tr>
                                                        <th className="p-3 w-10 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={importParsedRows.length > 0 && importParsedRows.filter(r => r.status !== 'error').every(r => r.selected)}
                                                                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                                                                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                                            />
                                                        </th>
                                                        <th className="p-3 w-12 text-center text-slate-400">#</th>
                                                        <th className="p-3">Status</th>
                                                        <th className="p-3">Item Name</th>
                                                        <th className="p-3">SKU</th>
                                                        <th className="p-3">Category</th>
                                                        <th className="p-3 text-right">Buying (KES)</th>
                                                        <th className="p-3 text-right">Selling (KES)</th>
                                                        <th className="p-3 text-center">Stock</th>
                                                        <th className="p-3">Diagnostics</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                                    {importParsedRows
                                                        .filter(r => importActiveFilter === 'all' ? true : r.status === importActiveFilter)
                                                        .map((row) => (
                                                        <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${!row.selected ? 'opacity-40 bg-slate-50/50' : ''}`}>
                                                            <td className="p-3 text-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={row.selected}
                                                                    onChange={() => setImportParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, selected: !r.selected } : r))}
                                                                    disabled={row.status === 'error'}
                                                                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                                                />
                                                            </td>
                                                            <td className="p-3 text-center font-mono text-[10px] text-slate-400">{row.id}</td>
                                                            <td className="p-3">
                                                                {row.status === 'valid' && (
                                                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                                        <CheckCircle size={12} /> Valid
                                                                    </span>
                                                                )}
                                                                {row.status === 'warning' && (
                                                                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                                        <AlertTriangle size={12} /> Match
                                                                    </span>
                                                                )}
                                                                {row.status === 'error' && (
                                                                    <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                                        <XCircle size={12} /> Error
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-2 font-bold text-slate-900 dark:text-white">
                                                                <input 
                                                                    type="text"
                                                                    value={row.mappedData.name || ''}
                                                                    onChange={(e) => handleInlineUpdateCell(row.id, 'name', e.target.value)}
                                                                    placeholder="Item name"
                                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded font-bold"
                                                                />
                                                            </td>
                                                            <td className="p-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                                                <input 
                                                                    type="text"
                                                                    value={row.mappedData.sku || ''}
                                                                    onChange={(e) => handleInlineUpdateCell(row.id, 'sku', e.target.value)}
                                                                    placeholder="Auto-generate"
                                                                    className="w-28 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-slate-500">
                                                                <input 
                                                                    type="text"
                                                                    value={row.mappedData.category || ''}
                                                                    onChange={(e) => handleInlineUpdateCell(row.id, 'category', e.target.value)}
                                                                    placeholder="General"
                                                                    className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-right font-mono">
                                                                <input 
                                                                    type="number"
                                                                    value={row.mappedData.buyingPrice || ''}
                                                                    onChange={(e) => handleInlineUpdateCell(row.id, 'buyingPrice', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-20 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                                <input 
                                                                    type="number"
                                                                    value={row.mappedData.sellingPrice || ''}
                                                                    onChange={(e) => handleInlineUpdateCell(row.id, 'sellingPrice', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-20 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded font-bold"
                                                                />
                                                            </td>
                                                            <td className="p-2 text-center font-bold">
                                                                <input 
                                                                    type="number"
                                                                    value={row.mappedData.quantity || ''}
                                                                    onChange={(e) => handleInlineUpdateCell(row.id, 'quantity', e.target.value)}
                                                                    placeholder="0"
                                                                    className="w-16 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                                />
                                                            </td>
                                                            <td className="p-3 text-[11px] text-slate-500 italic max-w-[200px] truncate">
                                                                {row.messages.join(' | ') || 'Ready for ingestion'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <button 
                                                onClick={() => setImportStep('mapping')}
                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black uppercase tracking-widest px-4 py-2 cursor-pointer"
                                            >
                                                ← Back to Mapping
                                            </button>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                        {importParsedRows.filter(r => r.selected && r.status !== 'error').length} Records Selected
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Policy: {importStrategy.toUpperCase()}</div>
                                                </div>
                                                <button 
                                                    onClick={handleExecuteImport}
                                                    disabled={importParsedRows.filter(r => r.selected && r.status !== 'error').length === 0}
                                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all cursor-pointer flex items-center gap-2"
                                                >
                                                    <CheckCircle size={16} /> Finalize Ingestion
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {importStep === 'importing' && (
                                    <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse space-y-4">
                                        <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center relative">
                                            <RefreshCw size={40} className="text-white animate-spin" />
                                            <div className="absolute inset-0 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
                                        </div>
                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ingesting Spreadsheet Stream...</h4>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Applying `{importStrategy}` deduplication policy to Central Inventory Store</p>
                                    </div>
                                )}

                                {importStep === 'summary' && importResult && (
                                    <div className="max-w-2xl mx-auto py-10 text-center animate-in zoom-in-95 duration-500 space-y-8">
                                        <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200">
                                            <ShieldCheck size={42} />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ingestion Cycle Complete</h4>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{importResult.message}</p>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-5 rounded-3xl">
                                                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mb-1">{importResult.addedCount}</div>
                                                <div className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">New Items Added</div>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-5 rounded-3xl">
                                                <div className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono mb-1">{importResult.updatedCount}</div>
                                                <div className="text-[9px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">Records Updated</div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl">
                                                <div className="text-3xl font-black text-slate-500 font-mono mb-1">{importResult.skippedCount}</div>
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nodes Skipped</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center gap-4 pt-4">
                                            <button 
                                                onClick={() => {
                                                    setImportStep('upload');
                                                    setImportResult(null);
                                                    setImportFileName('');
                                                }}
                                                className="tech-button bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 px-8 py-3.5 cursor-pointer"
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-widest">New Ingestion Batch</span>
                                            </button>
                                            <button 
                                                onClick={() => setActiveSubTab('my-inventory')}
                                                className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white px-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl cursor-pointer"
                                            >
                                                Return to Directory
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : activeSubTab === 'settings' ? (
                    <div className="animate-in fade-in duration-500 max-w-2xl">
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                                    <Globe size={24} />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-slate-900">System Backup & Network Settings</h4>
                                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-0.5">Admin Configuration Area</p>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                            <Server size={20} />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-black text-slate-900">Local Server Backup</h5>
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed">Configuring a local server IP enables the trader to backup encrypted transaction data to their own infrastructure alongside cloud synchronization.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Target Server IP Address</label>
                                            <input 
                                                type="text" 
                                                value={localServerIp}
                                                onChange={(e) => setLocalServerIp(e.target.value)}
                                                placeholder="e.g. 192.168.1.100" 
                                                className="w-full px-5 py-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-white text-sm font-mono font-bold transition-all"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                    Cloud Sync Status: {isOnline ? 'Active & Connected' : 'Offline Mode'}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={handleFullSync}
                                                disabled={isSyncingData}
                                                className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                                            >
                                                <RefreshCw size={12} className={isSyncingData ? 'animate-spin' : ''} /> Test Sync
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={handleFullSync}
                                        disabled={isSyncingData}
                                        className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black shadow-lg hover:bg-blue-700 transition uppercase tracking-widest flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={isSyncingData ? 'animate-spin' : ''} />
                                        {isSyncingData ? 'Syncing...' : 'Run Sync Now'}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (effectiveTraderId) logTraderBackupSync(effectiveTraderId).catch(() => {});
                                            showToast("Local server configuration saved & sync test initiated", "success");
                                        }}
                                        className="px-8 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition uppercase tracking-widest cursor-pointer"
                                    >
                                        Save Configuration
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Advanced Product Form Modal */}
            <DocumentModal 
                isOpen={isDocModalOpen}
                onClose={() => setIsDocModalOpen(false)}
                documentType={docType}
                data={docData}
                onPrint={async () => {
                    if (docType === 'Purchase Order' && docData && 'requestId' in docData) {
                        try {
                            const res = await updateInteropRequestStatus(docData.requestId, 'received');
                            if (res.success) {
                                showToast("Purchase Order printed. Goods Receipt Note (GRN) is now activated!", "success");
                                fetchNetworkData();
                                refreshData();
                            }
                        } catch (err: any) {
                            showToast(err.message || "Failed to auto-activate GRN", "error");
                        }
                    }
                }}
            />

            {/* Bulk Restock Modal */}
            <AnimatePresence>
                {isRestockModalOpen && selectedSupplier && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
                                        <Truck size={22} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-slate-900">
                                            Bulk Purchase Order Request
                                        </h4>
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">Sourcing from: <span className="font-bold text-slate-700">{selectedSupplier.businessName}</span> • {selectedSupplier.location}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsRestockModalOpen(false)} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body: List of Sourced Items with Inputs */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800 font-bold flex items-center gap-3">
                                    <Info size={16} className="text-blue-500 shrink-0" />
                                    Select the items you wish to restock. Checked items will be automatically bundled into a standard B2B Purchase Order (PO).
                                </div>

                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="p-4 w-12 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                        checked={marketplace.filter(i => i.traderId === selectedSupplier.id).every(item => restockItemsState[item.sku]?.checked)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            const updated = { ...restockItemsState };
                                                            marketplace.filter(i => i.traderId === selectedSupplier.id).forEach(item => {
                                                                if (updated[item.sku]) {
                                                                    updated[item.sku].checked = checked;
                                                                } else {
                                                                    updated[item.sku] = { checked, quantity: getSuggestedQty(item.sku) };
                                                                }
                                                            });
                                                            setRestockItemsState(updated);
                                                        }}
                                                    />
                                                </th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Information</th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Current Stock</th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Supplier Price</th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-40">Order Qty</th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {marketplace.filter(i => i.traderId === selectedSupplier.id).map(item => {
                                                const state = restockItemsState[item.sku] || { checked: false, quantity: 1 };
                                                const userItem = inventory.find(ui => ui.sku === item.sku && ui.traderId === effectiveTraderId);
                                                const itemSubtotal = (item.unitPrice * state.quantity) || 0;
                                                return (
                                                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${state.checked ? 'bg-blue-50/10' : ''}`}>
                                                        <td className="p-4 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded text-blue-600 focus:ring-blue-500"
                                                                checked={state.checked}
                                                                onChange={(e) => {
                                                                    setRestockItemsState({
                                                                        ...restockItemsState,
                                                                        [item.sku]: { ...state, checked: e.target.checked }
                                                                    });
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {item.sku}</div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="text-xs font-semibold text-slate-700">
                                                                {userItem ? `${userItem.quantity} ${item.uom || 'pcs'}` : '—'}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">in your store</div>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-600">
                                                            KES {item.unitPrice.toLocaleString()}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button 
                                                                    type="button"
                                                                    disabled={!state.checked}
                                                                    onClick={() => {
                                                                        const val = Math.max(1, state.quantity - 1);
                                                                        setRestockItemsState({
                                                                            ...restockItemsState,
                                                                            [item.sku]: { ...state, quantity: val }
                                                                        });
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition font-black"
                                                                >
                                                                    -
                                                                </button>
                                                                <input 
                                                                    type="number" 
                                                                    min="1"
                                                                    disabled={!state.checked}
                                                                    value={state.quantity}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value, 10);
                                                                        setRestockItemsState({
                                                                            ...restockItemsState,
                                                                            [item.sku]: { ...state, quantity: isNaN(val) ? 1 : Math.max(1, val) }
                                                                        });
                                                                    }}
                                                                    className="w-14 text-center border border-slate-200 rounded-lg py-1 text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
                                                                />
                                                                <button 
                                                                    type="button"
                                                                    disabled={!state.checked}
                                                                    onClick={() => {
                                                                        const val = state.quantity + 1;
                                                                        setRestockItemsState({
                                                                            ...restockItemsState,
                                                                            [item.sku]: { ...state, quantity: val }
                                                                        });
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition font-black"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right font-mono font-black text-slate-900 text-xs">
                                                            {state.checked ? `KES ${itemSubtotal.toLocaleString()}` : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Sourcing Instructions / Notes */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Sourcing Notes & Instructions (PO Notes)</label>
                                    <textarea 
                                        value={restockNotes}
                                        onChange={(e) => setRestockNotes(e.target.value)}
                                        placeholder="Specify transport terms, preferred delivery location, bulk discounts or any specific routing instructions..."
                                        rows={3}
                                        className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 text-xs resize-none"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer Summary */}
                            <div className="p-8 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-center sm:text-left">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Consolidated Order Total</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono">
                                        KES {marketplace.filter(i => i.traderId === selectedSupplier.id && restockItemsState[i.sku]?.checked)
                                            .reduce((sum, i) => sum + (i.unitPrice * (restockItemsState[i.sku]?.quantity || 0)), 0)
                                            .toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsRestockModalOpen(false)}
                                        className="px-6 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="button" 
                                        disabled={submittingRestock || marketplace.filter(i => i.traderId === selectedSupplier.id && restockItemsState[i.sku]?.checked).length === 0}
                                        onClick={handleSubmitBatchRestock}
                                        className="bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
                                    >
                                        {submittingRestock ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={14} /> Generating POs...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={14} /> Send Purchase Orders
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white w-full max-w-5xl max-h-[92vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/80 sticky top-0 z-10">
                                <div>
                                    <h4 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                                            <Package size={22} />
                                        </div>
                                        {isEditMode ? 'Update Product Profile' : 'New Product Registration'}
                                    </h4>
                                    <p className="text-slate-500 mt-1 text-sm">Full lifecycle product management including pricing, supply chain, and categorization.</p>
                                </div>
                                <button onClick={handleCloseForm} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto flex bg-slate-50/30">
                                {/* Side Navigation Tabs */}
                                <div className="w-64 border-r border-slate-100 p-6 space-y-3 bg-white/50 backdrop-blur-sm">
                                    <button 
                                        onClick={() => setActiveFormTab('general')}
                                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${activeFormTab === 'general' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-2' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${activeFormTab === 'general' ? 'bg-white/10' : 'bg-slate-100'}`}><Info size={16} /></div>
                                        General Information
                                    </button>
                                    <button 
                                        onClick={() => setActiveFormTab('pricing')}
                                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${activeFormTab === 'pricing' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-2' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${activeFormTab === 'pricing' ? 'bg-white/10' : 'bg-slate-100'}`}><DollarSign size={16} /></div>
                                        Pricing & Taxation
                                    </button>
                                    <button 
                                        onClick={() => setActiveFormTab('supply')}
                                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${activeFormTab === 'supply' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-2' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${activeFormTab === 'supply' ? 'bg-white/10' : 'bg-slate-100'}`}><Truck size={16} /></div>
                                        Stock & Sourcing
                                    </button>
                                    <button 
                                        onClick={() => setActiveFormTab('details')}
                                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${activeFormTab === 'details' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-2' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${activeFormTab === 'details' ? 'bg-white/10' : 'bg-slate-100'}`}><FileText size={16} /></div>
                                        Product Details
                                    </button>

                                    <div className="mt-12 p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                                        <h5 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Form Assistant</h5>
                                        <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                                            Categorizing your products helps in generating accurate reports and managing stock alerts effectively.
                                        </p>
                                    </div>
                                </div>

                                {/* Form Content Area */}
                                <div className="flex-1 p-10 bg-white">
                                    <form id="productForm" onSubmit={handleFormSubmit} className="max-w-3xl mx-auto">
                                        {activeFormTab === 'general' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                                    <h5 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Product Identity</h5>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="col-span-2">
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Official Product Name *</label>
                                                        <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold placeholder:text-slate-300" placeholder="e.g. Organic Brown Rice - Extra Long Grain" />
                                                    </div>
                                                    <div>
                                                        <label className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                                            <span>SKU / Unique ID *</span>
                                                            {!formData.sku && (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => {
                                                                        const prefix = (formData.name || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'ITM');
                                                                        const rand = Math.floor(1000 + Math.random() * 9000);
                                                                        setFormData({ ...formData, sku: `${prefix}-${rand}` });
                                                                    }}
                                                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all lowercase"
                                                                >
                                                                    <Sparkles size={10} /> <span>Issue SKU</span>
                                                                </button>
                                                            )}
                                                        </label>
                                                        <input required name="sku" value={formData.sku} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-mono font-bold" placeholder="BRN-RIC-001" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Barcode / UPC Number</label>
                                                        <input name="barcode" value={formData.barcode} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-mono" placeholder="890123456789" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Market Category</label>
                                                        <select name="category" value={formData.category} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold">
                                                            <option value="">Select Category</option>
                                                            <option value="Grains">Grains & Cereals</option>
                                                            <option value="Vegetables">Vegetables & Fruits</option>
                                                            <option value="Dairy">Dairy & Eggs</option>
                                                            <option value="Beverages">Beverages</option>
                                                            <option value="Bakery">Bakery & Pastries</option>
                                                            <option value="Hardware">Hardware & Tools</option>
                                                            <option value="Electronics">Electronics</option>
                                                            <option value="Clothing">Clothing & Apparel</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Unit of Measure (UoM)</label>
                                                        <input name="uom" value={formData.uom} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm" placeholder="kg, packet, piece, tray..." />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Brand Name</label>
                                                        <input name="brand" value={formData.brand} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm" placeholder="e.g. Daawat Premium" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Model / Variant</label>
                                                        <input name="model" value={formData.model} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm" placeholder="e.g. 2kg Eco-Pack" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeFormTab === 'pricing' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                                                    <h5 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Costing & Profitability</h5>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Unit Cost (Buying Price) *</label>
                                                        <div className="relative group">
                                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">KES</div>
                                                            <input required type="number" step="0.01" name="costPrice" value={formData.costPrice} onChange={handleChange} className="w-full pl-16 pr-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-600/10 focus:border-emerald-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-mono font-bold" placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Standard Selling Price *</label>
                                                        <div className="relative">
                                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-300 font-bold text-sm">KES</div>
                                                            <input required type="number" step="0.01" name="unitPrice" value={formData.unitPrice} onChange={handleChange} className="w-full pl-16 pr-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-mono font-bold text-blue-700" placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Wholesale / Bulk Price</label>
                                                        <div className="relative">
                                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">KES</div>
                                                            <input type="number" step="0.01" name="wholesalePrice" value={formData.wholesalePrice} onChange={handleChange} className="w-full pl-16 pr-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-mono" placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Retail List Price (MSRP)</label>
                                                        <div className="relative">
                                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">KES</div>
                                                            <input type="number" step="0.01" name="retailPrice" value={formData.retailPrice} onChange={handleChange} className="w-full pl-16 pr-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-mono" placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Regulatory Tax Category</label>
                                                        <select name="taxCategory" value={formData.taxCategory} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold">
                                                            <option value="General">Standard VAT (16%)</option>
                                                            <option value="Zero-Rated">Zero Rated (0%)</option>
                                                            <option value="Exempt">Exempt Products (No Tax)</option>
                                                            <option value="Special">Special / Excise Tax</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Taxation Rate (%)</label>
                                                        <div className="relative">
                                                            <input type="number" step="0.1" name="taxRate" value={formData.taxRate} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold" placeholder="0.0" />
                                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeFormTab === 'supply' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-1.5 h-6 bg-amber-600 rounded-full"></div>
                                                    <h5 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Supply Chain & Inventory</h5>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Initial Opening Stock *</label>
                                                        <input required type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold" placeholder="0" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Critical Re-order Level *</label>
                                                        <input required type="number" name="reorderLevel" value={formData.reorderLevel} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-600/10 focus:border-amber-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold text-amber-700" placeholder="10" />
                                                        <p className="text-[9px] text-amber-500 mt-2 font-bold uppercase tracking-wider ml-1">Alert triggered at this level</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Physical Storage Location</label>
                                                        <input name="location" value={formData.location || ''} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-bold" placeholder="e.g. Warehouse A, Shelf 4, Nairobi Main" />
                                                    </div>
                                                    <div className="col-span-2 space-y-3">
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Preferred Supplier & B2B Allocation</label>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">B2B Network Partner (Optional auto-match)</span>
                                                                <select 
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val) {
                                                                            setFormData(prev => ({ ...prev, supplier: val }));
                                                                        }
                                                                    }}
                                                                    value={traders.some(t => t.businessName === formData.supplier) ? formData.supplier : ""}
                                                                    className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
                                                                >
                                                                    <option value="">-- Choose verified partner --</option>
                                                                    {traders.filter(t => t.id !== effectiveTraderId).map(t => (
                                                                        <option key={t.id} value={t.businessName}>{t.businessName} ({t.location})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Supplier Business Name</span>
                                                                <input 
                                                                    name="supplier" 
                                                                    value={formData.supplier} 
                                                                    onChange={handleChange} 
                                                                    className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm font-semibold" 
                                                                    placeholder="e.g. National Cereals & Produce Board" 
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 font-semibold ml-1">Connecting a product to an active network supplier enables automated bulk restocking, PO generation, and lead-time tracking.</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Main Manufacturer</label>
                                                        <input name="manufacturer" value={formData.manufacturer} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm" placeholder="OEM or Factory Name" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Country of Origin</label>
                                                        <input name="countryOfOrigin" value={formData.countryOfOrigin} onChange={handleChange} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all text-sm" placeholder="e.g. Burundi" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeFormTab === 'details' && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="w-1.5 h-6 bg-slate-800 rounded-full"></div>
                                                    <h5 className="text-lg font-bold text-slate-800 uppercase tracking-tighter">Marketing & Media</h5>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Comprehensive Product Description</label>
                                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={8} className="w-full px-5 py-4 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-600/10 focus:border-slate-600 bg-slate-50/50 focus:bg-white transition-all resize-none text-sm leading-relaxed" placeholder="Detailed product specifications, technical details, handling guidelines..." />
                                                </div>
                                                <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                                                    <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Product Media Assets</h6>
                                                    <div className="grid grid-cols-4 gap-4 mb-4">
                                                        <div className="aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 hover:text-blue-500 hover:border-blue-200 transition-all cursor-pointer bg-white group">
                                                            <Plus size={20} className="group-hover:scale-110 transition-transform" />
                                                            <span className="text-[9px] font-bold mt-2">ADD IMAGE</span>
                                                        </div>
                                                        {formData.images.map((img, idx) => (
                                                            <div key={idx} className="aspect-square bg-slate-200 rounded-2xl overflow-hidden relative shadow-sm border border-white">
                                                                <img src={img} alt="Product" className="w-full h-full object-cover" />
                                                                <button type="button" onClick={() => setFormData({...formData, images: formData.images.filter((_, i) => i !== idx)})} className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <input name="images_input" placeholder="Paste image URL and press Enter" onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = (e.target as HTMLInputElement).value;
                                                            if (val) {
                                                                setFormData({...formData, images: [...formData.images, val]});
                                                                (e.target as HTMLInputElement).value = '';
                                                            }
                                                        }
                                                    }} className="w-full px-5 py-3 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 bg-white transition-all text-xs" />
                                                </div>
                                            </div>
                                        )}
                                    </form>
                                </div>
                            </div>

                            {/* Modal Footer Area */}
                            <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between px-10">
                                <button 
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="px-8 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-slate-900 hover:bg-white transition-all"
                                >
                                    Cancel & Close
                                </button>
                                <div className="flex gap-4">
                                    {activeFormTab !== 'general' && (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (activeFormTab === 'pricing') setActiveFormTab('general');
                                                else if (activeFormTab === 'supply') setActiveFormTab('pricing');
                                                else if (activeFormTab === 'details') setActiveFormTab('supply');
                                            }}
                                            className="px-8 py-3 rounded-2xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:shadow-xl transition-all"
                                        >
                                            Back
                                        </button>
                                    )}
                                    {activeFormTab !== 'details' ? (
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (activeFormTab === 'general') setActiveFormTab('pricing');
                                                else if (activeFormTab === 'pricing') setActiveFormTab('supply');
                                                else if (activeFormTab === 'supply') setActiveFormTab('details');
                                            }}
                                            className="bg-slate-900 text-white px-10 py-3 rounded-2xl text-sm font-bold hover:bg-blue-600 transition-all flex items-center gap-3 shadow-xl shadow-slate-200"
                                        >
                                            Save & Continue <ChevronRight size={18} />
                                        </button>
                                    ) : (
                                        <button 
                                            type="submit"
                                            form="productForm"
                                            className="bg-blue-600 text-white px-12 py-3 rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                                        >
                                            {isEditMode ? 'Complete Updates' : 'Finalize Onboarding'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Single Request Modal */}
            <AnimatePresence>
                {isRequestModalOpen && requestModalItem && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white"
                        >
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                                        <Plus size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Stock Fulfillment Request</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Fulfillment via {requestModalItem.businessName}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsRequestModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Item</span>
                                        <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">SKU: {requestModalItem.sku}</span>
                                    </div>
                                    <h5 className="font-black text-slate-900 text-lg leading-tight">{requestModalItem.name}</h5>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Exchange Price</span>
                                            <span className="text-xl font-black text-slate-900 font-mono tracking-tighter">KES {requestModalItem.unitPrice.toLocaleString()}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Supplier Available</span>
                                            <span className="text-sm font-black text-emerald-600">{requestModalItem.quantity} {requestModalItem.uom || 'pcs'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Request Quantity *</label>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => setRequestQuantity(Math.max(1, requestQuantity - 1))}
                                                className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all font-black text-lg"
                                            >
                                                -
                                            </button>
                                            <input 
                                                type="number" 
                                                value={requestQuantity}
                                                onChange={(e) => setRequestQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="flex-1 h-12 text-center border-2 border-slate-100 rounded-xl font-mono font-black text-xl text-slate-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 transition-all outline-none"
                                            />
                                            <button 
                                                onClick={() => setRequestQuantity(requestQuantity + 1)}
                                                className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all font-black text-lg"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Request Notes (Optional)</label>
                                        <textarea 
                                            value={requestNotes}
                                            onChange={(e) => setRequestNotes(e.target.value)}
                                            placeholder="Specify shipping instructions, urgent delivery, or special requests..."
                                            rows={3}
                                            className="w-full px-5 py-4 border-2 border-slate-50 bg-slate-50/30 rounded-2xl outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 text-sm font-medium transition-all resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Estimated Total</span>
                                    <span className="text-xl font-black text-slate-900 font-mono">KES {(requestModalItem.unitPrice * requestQuantity).toLocaleString()}</span>
                                </div>
                                <button 
                                    disabled={submittingRequest}
                                    onClick={handleSubmitRequest}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-xs font-black transition shadow-xl shadow-blue-500/20 flex items-center gap-3 uppercase tracking-widest"
                                >
                                    {submittingRequest ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                    Send Fulfillment Request
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Stock Adjustment Modal */}
            <AnimatePresence>
                {isAdjustmentModalOpen && adjustmentItem && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white"
                        >
                            <div className="p-8 border-b border-slate-100 bg-amber-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                        <Sliders size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Manual Stock Adjustment</h4>
                                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">Inventory correction log</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAdjustmentModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjusting Item</span>
                                        <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">SKU: {adjustmentItem.sku}</span>
                                    </div>
                                    <h5 className="font-black text-slate-900 text-lg">{adjustmentItem.name}</h5>
                                    <div className="mt-4 flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current System Balance</span>
                                        <span className="text-lg font-black text-slate-900 font-mono">{adjustmentItem.quantity} {adjustmentItem.uom || 'pcs'}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Adjustment Value (+/-)</label>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => setAdjustmentQty(adjustmentQty - 1)}
                                                className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50 transition-all font-black text-lg"
                                            >
                                                -
                                            </button>
                                            <input 
                                                type="number" 
                                                value={adjustmentQty}
                                                onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                                                className={`flex-1 h-12 text-center border-2 rounded-xl font-mono font-black text-xl focus:ring-4 transition-all outline-none ${adjustmentQty > 0 ? 'text-emerald-600 border-emerald-100 focus:border-emerald-600 focus:ring-emerald-600/5' : adjustmentQty < 0 ? 'text-red-600 border-red-100 focus:border-red-600 focus:ring-red-600/5' : 'text-slate-400 border-slate-100 focus:border-slate-400 focus:ring-slate-400/5'}`}
                                            />
                                            <button 
                                                onClick={() => setAdjustmentQty(adjustmentQty + 1)}
                                                className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 transition-all font-black text-lg"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Reason Code</label>
                                        <select 
                                            value={adjustmentReason}
                                            onChange={(e) => setAdjustmentReason(e.target.value)}
                                            className="w-full px-4 py-3 border-2 border-slate-50 bg-slate-50/50 rounded-2xl outline-none focus:border-amber-500 text-xs font-bold transition-all"
                                        >
                                            <option value="Damaged">Damaged / Expired</option>
                                            <option value="Returned">Customer Return</option>
                                            <option value="Found">Inventory Audit Found</option>
                                            <option value="Correction">Data Entry Correction</option>
                                            <option value="Promo">Promotional Giveaway</option>
                                            <option value="Theft">Shrinkage / Theft</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col justify-end">
                                        <div className="p-3 bg-slate-900 rounded-2xl text-center">
                                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">New Calculated Balance</span>
                                            <span className="text-base font-black text-white font-mono">{adjustmentItem.quantity + adjustmentQty} {adjustmentItem.uom || 'pcs'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Adjustment Narrative / Audit Notes</label>
                                        <textarea 
                                            value={adjustmentNotes}
                                            onChange={(e) => setAdjustmentNotes(e.target.value)}
                                            placeholder="Explain why this manual adjustment is being performed..."
                                            rows={3}
                                            className="w-full px-5 py-4 border-2 border-slate-50 bg-slate-50/30 rounded-2xl outline-none focus:ring-4 focus:ring-amber-600/5 focus:border-amber-600 text-sm font-medium transition-all resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                                <button 
                                    disabled={submittingAdjustment || adjustmentQty === 0}
                                    onClick={handleAdjustmentSubmit}
                                    className="bg-amber-600 hover:bg-amber-700 text-white px-10 py-3 rounded-2xl text-xs font-black transition shadow-xl shadow-amber-500/20 flex items-center gap-3 uppercase tracking-widest"
                                >
                                    {submittingAdjustment ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                    Commit Adjustment
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Rejection Modal */}
            <AnimatePresence>
                {isRejectModalOpen && (
                    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-white"
                        >
                            <div className="p-8 border-b border-slate-100 bg-rose-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                                        <XCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Decline Request</h4>
                                        <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest mt-0.5">Stock fulfillment rejection</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsRejectModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <p className="text-sm text-slate-500 font-medium">Please provide a reason for declining this stock fulfillment request. This will be visible to the requester.</p>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Rejection Reason *</label>
                                    <textarea 
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="e.g. Out of stock, price mismatch, logistics delay..."
                                        rows={4}
                                        className="w-full px-5 py-4 border-2 border-slate-50 bg-slate-50/30 rounded-2xl outline-none focus:ring-4 focus:ring-rose-600/5 focus:border-rose-600 text-sm font-medium transition-all resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4">
                                <button 
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="px-6 py-3 rounded-2xl text-xs font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={submittingRejection || !rejectionReason.trim()}
                                    onClick={handleSubmitRejection}
                                    className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-2xl text-xs font-black transition shadow-xl shadow-rose-500/20 flex items-center gap-3 uppercase tracking-widest disabled:opacity-50"
                                >
                                    {submittingRejection ? <RefreshCw className="animate-spin" size={16} /> : <X size={16} />}
                                    Confirm Decline
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Stock History Modal */}
            <AnimatePresence>
                {isHistoryModalOpen && historyItem && (
                    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-white flex flex-col max-h-[85vh]"
                        >
                            <div className="p-8 border-b border-slate-100 bg-indigo-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                        <History size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 tracking-tight">Product Stock Ledger</h4>
                                        <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-0.5">Full audit history for SKU: {historyItem.sku}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="bg-slate-900 text-white p-6 rounded-3xl flex justify-between items-center shadow-xl">
                                    <div>
                                        <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Current Balance</h5>
                                        <p className="text-3xl font-black font-mono tracking-tighter">{historyItem.quantity} <span className="text-lg opacity-50">{historyItem.uom || 'pcs'}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Portfolio Item</h5>
                                        <p className="text-sm font-black truncate max-w-[200px]">{historyItem.name}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-2">Movement Timeline</h6>
                                    {loadingHistory ? (
                                        <div className="py-20 flex flex-col items-center">
                                            <RefreshCw className="animate-spin text-indigo-600 mb-3" size={32} />
                                            <p className="text-xs font-bold text-slate-400">Fetching audit logs...</p>
                                        </div>
                                    ) : itemAuditLogs.length === 0 ? (
                                        <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 italic text-sm">
                                            No recent stock movements found in system logs.
                                        </div>
                                    ) : (
                                        itemAuditLogs.map((log, idx) => (
                                            <div key={log.id || idx} className="flex gap-4 group">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${log.severity === 'warning' || log.severity === 'critical' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                                                        {log.action.includes('adjust') ? <Sliders size={14} /> : log.action.includes('request') ? <Truck size={14} /> : <Package size={14} />}
                                                    </div>
                                                    <div className="w-px h-full bg-slate-100 group-last:bg-transparent min-h-[40px]"></div>
                                                </div>
                                                <div className="flex-1 pb-6">
                                                    <div className="bg-slate-50/50 group-hover:bg-white border border-slate-100 group-hover:border-indigo-100 group-hover:shadow-md p-4 rounded-2xl transition-all">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</span>
                                                            <span className="text-[9px] font-bold font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                                            {log.details?.reason ? `[${log.details.reason}] ` : ''}
                                                            {log.details?.adjustment ? (log.details.adjustment > 0 ? `Stock increased by ${log.details.adjustment}` : `Stock decreased by ${Math.abs(log.details.adjustment)}`) : ''}
                                                            {log.details?.notes || 'System transaction recorded'}
                                                        </p>
                                                        <div className="mt-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Users size={10} /> {log.username} • {log.details?.status || 'COMPLETED'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">End of transaction record</span>
                                <button 
                                    onClick={() => setIsHistoryModalOpen(false)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-xs font-black transition shadow-xl shadow-indigo-500/20 uppercase tracking-widest"
                                >
                                    Close Ledger
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Update Modal */}
            {isBulkUpdateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
                    >
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                    <Tag size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Batch Update Items</h3>
                                    <p className="text-[11px] text-slate-400">Applying changes to {selectedItemIds.length} selected items</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsBulkUpdateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleBulkUpdate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Field to Update</label>
                                <select 
                                    value={bulkUpdateField}
                                    onChange={(e: any) => {
                                        setBulkUpdateField(e.target.value);
                                        setBulkUpdateValue('');
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="category">Category</option>
                                    <option value="taxCategory">Tax Category / VAT Rate</option>
                                    <option value="reorderLevel">Reorder Level Threshold</option>
                                    <option value="supplier">Supplier / Vendor</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">New Value</label>
                                {bulkUpdateField === 'taxCategory' ? (
                                    <select 
                                        value={bulkUpdateValue}
                                        onChange={e => setBulkUpdateValue(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select Tax Class...</option>
                                        <option value="General (16%)">General (16% Standard VAT)</option>
                                        <option value="Zero Rated">Zero Rated (0% VAT)</option>
                                        <option value="Exempt">Exempt (0% VAT)</option>
                                    </select>
                                ) : bulkUpdateField === 'reorderLevel' ? (
                                    <input 
                                        type="number"
                                        min="0"
                                        required
                                        value={bulkUpdateValue}
                                        onChange={e => setBulkUpdateValue(e.target.value)}
                                        placeholder="e.g. 10"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                ) : (
                                    <input 
                                        type="text"
                                        required
                                        value={bulkUpdateValue}
                                        onChange={e => setBulkUpdateValue(e.target.value)}
                                        placeholder={`Enter new ${bulkUpdateField}...`}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsBulkUpdateModalOpen(false)}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isBulkUpdating || !bulkUpdateValue.trim()}
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                                >
                                    {isBulkUpdating ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                    Apply to {selectedItemIds.length} Items
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            <DocumentModal
                isOpen={isDocModalOpen}
                onClose={() => setIsDocModalOpen(false)}
                documentType={docType}
                data={docData}
            />
            <ConflictResolutionModal
                isOpen={isConflictModalOpen}
                onClose={() => setIsConflictModalOpen(false)}
                conflict={activeConflict}
            />
            <CsvImportModal 
                isOpen={isCsvImportOpen} 
                onClose={() => setIsCsvImportOpen(false)} 
                defaultMode="inventory" 
                traderId={loggedInTrader?.id} 
            />
            <A4InventoryReportModal 
                isOpen={isA4ReportOpen} 
                onClose={() => setIsA4ReportOpen(false)} 
                inventory={filteredInventory} 
                trader={loggedInTrader} 
            />
        </div>
    );
};

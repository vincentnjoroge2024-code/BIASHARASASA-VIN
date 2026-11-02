import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { bulkAddInventoryItems, bulkImportTraders } from '../api';
import { 
    X, FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, XCircle, 
    RefreshCw, ShieldCheck, ArrowRight, ArrowLeft, Table, HelpCircle, FileText, Check, 
    Sparkles, Edit3, Filter, CheckSquare, Square, FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

export type ImportMode = 'inventory' | 'traders';
export type CollisionStrategy = 'skip' | 'overwrite' | 'append';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultMode?: ImportMode;
    traderId?: number;
}

interface ColumnMap {
    [key: string]: string; // fieldName -> csvHeaderName
}

interface ParsedRow {
    id: number;
    rawData: Record<string, string>;
    mappedData: Record<string, any>;
    status: 'valid' | 'warning' | 'error';
    messages: string[];
    selected: boolean;
    collisionMatch?: string;
}

export function parseCSV(text: string): string[][] {
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
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
    isOpen,
    onClose,
    defaultMode = 'inventory',
    traderId
}) => {
    const { inventory, traders, refreshData, showToast, logAuditAction, user } = useAppContext();
    const [mode, setMode] = useState<ImportMode>(defaultMode);
    const [strategy, setStrategy] = useState<CollisionStrategy>('skip');
    
    // Input state
    const [inputMethod, setInputMethod] = useState<'file' | 'paste'>('file');
    const [rawText, setRawText] = useState<string>('');
    const [fileName, setFileName] = useState<string>('');
    const [fileSizeStr, setFileSizeStr] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'summary'>('upload');
    
    // Parsed states
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<string[][]>([]);
    const [columnMap, setColumnMap] = useState<ColumnMap>({});
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
    const [editingCell, setEditingCell] = useState<{ rowId: number; field: string } | null>(null);
    
    // Result summary
    const [importResult, setImportResult] = useState<{
        addedCount: number;
        updatedCount: number;
        skippedCount: number;
        message: string;
    } | null>(null);

    useEffect(() => {
        setMode(defaultMode);
    }, [defaultMode, isOpen]);

    if (!isOpen) return null;

    // Reset workflow
    const handleReset = () => {
        setStep('upload');
        setRawText('');
        setFileName('');
        setFileSizeStr('');
        setCsvHeaders([]);
        setCsvRows([]);
        setColumnMap({});
        setParsedRows([]);
        setImportResult(null);
        setEditingCell(null);
    };

    // Standard fields definition
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

    const traderFields = [
        { key: 'fullName', label: 'Full / Manager Name', required: true, aliases: ['full name', 'name', 'manager', 'contact name', 'owner'] },
        { key: 'businessName', label: 'Business / Shop Name', required: false, aliases: ['business name', 'shop name', 'company', 'trader name', 'business', 'store name'] },
        { key: 'email', label: 'Email Address', required: false, aliases: ['email', 'e-mail', 'contact email', 'mail'] },
        { key: 'phone', label: 'Phone Number', required: false, aliases: ['phone', 'mobile', 'telephone', 'contact', 'msisdn'] },
        { key: 'location', label: 'Location / Town', required: false, aliases: ['location', 'city', 'town', 'branch', 'address'] },
        { key: 'taxId', label: 'Tax ID / KRA PIN', required: false, aliases: ['tax id', 'kra pin', 'tax_id', 'pin', 'vat'] },
        { key: 'plan', label: 'Subscription Plan', required: false, aliases: ['plan', 'tier', 'subscription'] },
    ];

    const currentFields = mode === 'inventory' ? inventoryFields : traderFields;

    // Excel & CSV Template Downloads
    const handleDownloadExcelTemplate = () => {
        try {
            if (mode === 'inventory') {
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
                XLSX.utils.book_append_sheet(wb, ws, 'Inventory Blueprint');
                XLSX.writeFile(wb, 'biashara_inventory_template.xlsx');
            } else {
                const data = [
                    ['Full Name', 'Business Name', 'Email', 'Phone', 'Location', 'Tax ID', 'Plan'],
                    ['Jane Wanjiku', 'Wanjiku Enterprises', 'jane@wanjiku.co.ke', '+254712345678', 'Nairobi Main Stall', 'P051234567A', 'Gold'],
                    ['David Omondi', 'Lake Basin Wholesalers', 'david@lakebasin.co.ke', '+254722987654', 'Kisumu Depot', 'P059876543B', 'Enterprise'],
                    ['Amina Hassan', 'Coast Traders', 'amina@coasttraders.co.ke', '+254733445566', 'Mombasa Branch', 'P058889990C', 'Basic']
                ];
                const ws = XLSX.utils.aoa_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Traders Blueprint');
                XLSX.writeFile(wb, 'biashara_traders_template.xlsx');
            }
            showToast('Excel Template (.xlsx) downloaded successfully', 'success');
        } catch (err: any) {
            handleDownloadCsvTemplate();
        }
    };

    const handleDownloadCsvTemplate = () => {
        let content = '';
        let filename = '';
        if (mode === 'inventory') {
            content = "Item Name,SKU,Category,Supplier,Buying Price,Selling Price,Quantity,Reorder Level,Description\n" +
                      "Basmati Rice 25kg,SKU-RICE-25,Cereals,Mwea Millers,2200,2800,50,10,Premium long grain aromatic rice\n" +
                      "Pure Cooking Oil 5L,SKU-OIL-5L,Groceries,Bidco Africa,1100,1350,30,5,5 Liter refined vegetable oil\n" +
                      "Wheat Flour 2kg,SKU-WHEAT-2K,Baking,Ungu Limited,160,200,100,20,Fortified all-purpose baking flour\n" +
                      "Sugar White 1kg,SKU-SUGAR-1K,Groceries,Mumias Sugar,140,175,80,15,Refined cane sugar\n";
            filename = "biashara_inventory_template.csv";
        } else {
            content = "Full Name,Business Name,Email,Phone,Location,Tax ID,Plan\n" +
                      "Jane Wanjiku,Wanjiku Enterprises,jane@wanjiku.co.ke,+254712345678,Nairobi Main Stall,P051234567A,Gold\n" +
                      "David Omondi,Lake Basin Wholesalers,david@lakebasin.co.ke,+254722987654,Kisumu Depot,P059876543B,Enterprise\n" +
                      "Amina Hassan,Coast Traders,amina@coasttraders.co.ke,+254733445566,Mombasa Branch,P058889990C,Basic\n";
            filename = "biashara_traders_template.csv";
        }

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`CSV Template '${filename}' downloaded!`, 'info');
    };

    // Unified file reader supporting Excel (.xlsx, .xls) and CSV (.csv, .tsv, .txt)
    const handleProcessFile = (file: File) => {
        if (!file) return;
        setFileName(file.name);
        const sizeKb = (file.size / 1024).toFixed(1);
        setFileSizeStr(`${sizeKb} KB`);

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = ev.target?.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    if (!firstSheetName) {
                        showToast("Excel workbook contains no readable sheets", "error");
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

                    initMappingFromHeadersAndRows(headers, dataRows);
                } catch (err: any) {
                    showToast("Failed to parse Excel file: " + (err.message || 'Corrupt format'), "error");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target?.result as string;
                setRawText(text);
                const lines = parseCSV(text);
                if (lines.length === 0) {
                    showToast("No readable rows found in CSV", "error");
                    return;
                }
                const headers = lines[0].map(h => h.trim());
                const dataRows = lines.slice(1);
                initMappingFromHeadersAndRows(headers, dataRows);
            };
            reader.readAsText(file);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleProcessFile(file);
    };

    const handlePasteSubmit = () => {
        if (!rawText.trim()) {
            showToast("Please paste CSV or tabular data first", "error");
            return;
        }
        const lines = parseCSV(rawText);
        if (lines.length === 0) {
            showToast("Could not parse pasted data into tabular rows", "error");
            return;
        }
        const headers = lines[0].map(h => h.trim());
        const dataRows = lines.slice(1);
        setFileName('pasted_clipboard_data.csv');
        setFileSizeStr(`${(new Blob([rawText]).size / 1024).toFixed(1)} KB`);
        initMappingFromHeadersAndRows(headers, dataRows);
    };

    // Auto map columns based on aliases
    const initMappingFromHeadersAndRows = (headers: string[], dataRows: string[][]) => {
        if (headers.length === 0 || dataRows.length === 0) {
            showToast("Document has headers but no data rows", "warning");
            return;
        }

        setCsvHeaders(headers);
        setCsvRows(dataRows);

        const initialMap: ColumnMap = {};
        currentFields.forEach(field => {
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

        setColumnMap(initialMap);
        setStep('mapping');
        showToast(`Parsed ${dataRows.length} rows with ${headers.length} columns`, "info");
    };

    // Helper: validate single row
    const validateRow = (mappedData: Record<string, any>, currentStrategy: CollisionStrategy) => {
        const messages: string[] = [];
        let status: 'valid' | 'warning' | 'error' = 'valid';
        let collisionMatch: string | undefined;

        if (mode === 'inventory') {
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
            } else if (Number(qtyStr) < 0) {
                status = 'error';
                messages.push('Quantity cannot be negative');
            }

            if (priceStr !== '' && priceStr !== undefined && isNaN(Number(priceStr))) {
                status = 'error';
                messages.push('Price must be a valid number');
            }

            // Check collisions against live inventory
            const existing = inventory.find(i => 
                (sku && i.sku && i.sku.toLowerCase() === sku.toLowerCase()) ||
                (name && i.name.toLowerCase() === name.toLowerCase())
            );

            if (existing) {
                collisionMatch = existing.sku ? `SKU: ${existing.sku}` : `Name: ${existing.name}`;
                if (status !== 'error') {
                    status = 'warning';
                    messages.push(`Matches existing item (${collisionMatch}). Action: ${currentStrategy.toUpperCase()}`);
                }
            }
        } else {
            const fullName = (mappedData.fullName || '').trim();
            const email = (mappedData.email || '').trim();

            if (!fullName) {
                status = 'error';
                messages.push('Missing required Full/Manager Name');
            }

            if (email && !email.includes('@')) {
                status = 'warning';
                messages.push('Email format looks irregular');
            }

            const existing = traders.find(t => 
                (email && t.email.toLowerCase() === email.toLowerCase()) ||
                (fullName && t.fullName.toLowerCase() === fullName.toLowerCase()) ||
                (mappedData.businessName && t.businessName.toLowerCase() === mappedData.businessName.toLowerCase())
            );

            if (existing) {
                collisionMatch = existing.businessName || existing.email || existing.fullName;
                if (status !== 'error') {
                    status = 'warning';
                    messages.push(`Matches existing Trader (${collisionMatch}). Action: ${currentStrategy.toUpperCase()}`);
                }
            }
        }

        return { status, messages, collisionMatch };
    };

    // Perform validation and build parsed rows
    const buildParsedRows = () => {
        const rows: ParsedRow[] = [];

        csvRows.forEach((row, idx) => {
            const rawData: Record<string, string> = {};
            csvHeaders.forEach((h, hIdx) => {
                rawData[h] = row[hIdx] || '';
            });

            const mappedData: Record<string, any> = {};
            currentFields.forEach(f => {
                const mappedHeader = columnMap[f.key];
                mappedData[f.key] = mappedHeader ? (rawData[mappedHeader] || '').trim() : '';
            });

            const { status, messages, collisionMatch } = validateRow(mappedData, strategy);

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

        setParsedRows(rows);
        setStep('preview');
    };

    // Auto-fix missing SKUs and fallback defaults
    const handleAutoFixAll = () => {
        setParsedRows(prev => prev.map((row, idx) => {
            const updated = { ...row.mappedData };
            if (mode === 'inventory') {
                if (!updated.sku || updated.sku.trim() === '') {
                    const prefix = (updated.name || 'ITEM').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'ITM');
                    updated.sku = `SKU-${prefix}-${String(100 + idx).padStart(3, '0')}`;
                }
                if (!updated.sellingPrice || isNaN(Number(updated.sellingPrice)) || Number(updated.sellingPrice) <= 0) {
                    updated.sellingPrice = '100';
                }
                if (!updated.buyingPrice || isNaN(Number(updated.buyingPrice))) {
                    updated.buyingPrice = String(Math.round(Number(updated.sellingPrice) * 0.8));
                }
                if (!updated.quantity || isNaN(Number(updated.quantity))) {
                    updated.quantity = '10';
                }
                if (!updated.category) {
                    updated.category = 'General';
                }
            } else {
                if (!updated.businessName && updated.fullName) {
                    updated.businessName = `${updated.fullName}'s Shop`;
                }
                if (!updated.plan) {
                    updated.plan = 'Basic';
                }
                if (!updated.location) {
                    updated.location = 'Nairobi';
                }
            }

            const { status, messages, collisionMatch } = validateRow(updated, strategy);
            return {
                ...row,
                mappedData: updated,
                status,
                messages,
                collisionMatch,
                selected: status !== 'error'
            };
        }));
        showToast("Auto-generated missing SKUs & defaulted values successfully!", "success");
    };

    // Update individual cell inline
    const handleUpdateCell = (rowId: number, field: string, val: string) => {
        setParsedRows(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            const updated = { ...row.mappedData, [field]: val };
            const { status, messages, collisionMatch } = validateRow(updated, strategy);
            return {
                ...row,
                mappedData: updated,
                status,
                messages,
                collisionMatch,
                selected: status !== 'error'
            };
        }));
    };

    // Re-evaluate preview rows when strategy changes
    useEffect(() => {
        if (step === 'preview') {
            setParsedRows(prev => prev.map(row => {
                const { status, messages, collisionMatch } = validateRow(row.mappedData, strategy);
                return {
                    ...row,
                    status,
                    messages,
                    collisionMatch,
                    selected: status !== 'error' ? row.selected : false
                };
            }));
        }
    }, [strategy]);

    // Handle Bulk Import Execution
    const handleExecuteImport = async () => {
        const selectedRows = parsedRows.filter(r => r.selected && r.status !== 'error');
        if (selectedRows.length === 0) {
            showToast("No valid rows selected for import", "info");
            return;
        }

        setStep('importing');

        try {
            if (mode === 'inventory') {
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
                    description: r.mappedData.description || ''
                }));

                const targetTraderId = traderId || (user as any)?.traderId || 0;
                const res = await bulkAddInventoryItems(targetTraderId, itemsToUpload, strategy);
                
                setImportResult({
                    addedCount: res.addedCount !== undefined ? res.addedCount : itemsToUpload.length,
                    updatedCount: res.updatedCount || 0,
                    skippedCount: res.skippedCount || 0,
                    message: res.message || 'Batch imported successfully'
                });

                await logAuditAction('csv_import_inventory', { 
                    count: itemsToUpload.length, 
                    strategy, 
                    fileName 
                }, 'info');

            } else {
                const tradersToUpload = selectedRows.map(r => ({
                    fullName: r.mappedData.fullName,
                    businessName: r.mappedData.businessName || r.mappedData.fullName,
                    email: r.mappedData.email,
                    phone: r.mappedData.phone || '—',
                    location: r.mappedData.location || 'Nairobi',
                    taxId: r.mappedData.taxId || '—',
                    plan: r.mappedData.plan || 'Basic'
                }));

                const res = await bulkImportTraders(tradersToUpload, strategy);

                setImportResult({
                    addedCount: res.addedCount !== undefined ? res.addedCount : tradersToUpload.length,
                    updatedCount: res.updatedCount || 0,
                    skippedCount: res.skippedCount || 0,
                    message: res.message || 'Traders imported successfully'
                });

                await logAuditAction('csv_import_traders', { 
                    count: tradersToUpload.length, 
                    strategy, 
                    fileName 
                }, 'info');
            }

            await refreshData();
            showToast("Bulk import completed successfully!", "success");
            setStep('summary');
        } catch (err: any) {
            showToast("Import failed: " + (err.message || 'Unknown error'), "error");
            setStep('preview');
        }
    };

    // Filtered row selection for preview
    const filteredRows = parsedRows.filter(r => {
        if (activeFilter === 'valid') return r.status === 'valid';
        if (activeFilter === 'warning') return r.status === 'warning';
        if (activeFilter === 'error') return r.status === 'error';
        return true;
    });

    const validCount = parsedRows.filter(r => r.status === 'valid').length;
    const warningCount = parsedRows.filter(r => r.status === 'warning').length;
    const errorCount = parsedRows.filter(r => r.status === 'error').length;
    const selectedCount = parsedRows.filter(r => r.selected && r.status !== 'error').length;

    // Get sample values for a header column
    const getSampleValues = (header: string, limit = 2) => {
        const headerIdx = csvHeaders.indexOf(header);
        if (headerIdx === -1) return '';
        const samples = csvRows
            .slice(0, 5)
            .map(r => r[headerIdx])
            .filter(Boolean)
            .slice(0, limit);
        return samples.join(', ');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
                
                {/* Header Bar */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                            <FileSpreadsheet size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                Bulk Data Ingestion Terminal
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase tracking-widest">
                                    {mode.toUpperCase()}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Parse, map, inline-edit, validate, and bulk populate data with real-time collision prevention
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Mode switch */}
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                            <button
                                onClick={() => { setMode('inventory'); handleReset(); }}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${mode === 'inventory' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                📦 Inventory
                            </button>
                            <button
                                onClick={() => { setMode('traders'); handleReset(); }}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${mode === 'traders' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                👥 Traders
                            </button>
                        </div>

                        <button 
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Progress Steps Bar */}
                <div className="px-6 py-3 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <span className={`flex items-center gap-1.5 ${step === 'upload' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px]">1</span> Upload
                        </span>
                        <ArrowRight size={12} className="text-slate-300 dark:text-slate-700" />
                        <span className={`flex items-center gap-1.5 ${step === 'mapping' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px]">2</span> Map Schema
                        </span>
                        <ArrowRight size={12} className="text-slate-300 dark:text-slate-700" />
                        <span className={`flex items-center gap-1.5 ${step === 'preview' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px]">3</span> Validate & Edit
                        </span>
                        <ArrowRight size={12} className="text-slate-300 dark:text-slate-700" />
                        <span className={`flex items-center gap-1.5 ${step === 'summary' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'}`}>
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px]">4</span> Results
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDownloadExcelTemplate}
                            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold text-[11px] cursor-pointer"
                            title="Download standard formatted Excel .xlsx template"
                        >
                            <Download size={13} /> Excel Template (.xlsx)
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button 
                            onClick={handleDownloadCsvTemplate}
                            className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                            title="Download standard CSV template"
                        >
                            <Download size={13} /> CSV
                        </button>
                    </div>
                </div>

                {/* Body Content per Step */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* STEP 1: UPLOAD */}
                    {step === 'upload' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <HelpCircle className="text-indigo-500" size={20} />
                                    <div className="text-xs text-slate-600 dark:text-slate-300">
                                        Importing into <span className="font-black text-slate-900 dark:text-white uppercase">{mode}</span>. Supports Excel spreadsheets (<span className="font-mono text-emerald-600 font-bold">.xlsx, .xls</span>) and text files (<span className="font-mono text-indigo-600 font-bold">.csv, .tsv</span>).
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setInputMethod('file')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${inputMethod === 'file' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        📁 File Upload
                                    </button>
                                    <button
                                        onClick={() => setInputMethod('paste')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${inputMethod === 'paste' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        📝 Paste Table
                                    </button>
                                </div>
                            </div>

                            {inputMethod === 'file' ? (
                                <div 
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                        const droppedFile = e.dataTransfer.files?.[0];
                                        if (droppedFile) handleProcessFile(droppedFile);
                                    }}
                                    className={`border-2 border-dashed rounded-3xl p-10 text-center transition group flex flex-col items-center justify-center space-y-4 ${
                                        isDragging 
                                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]' 
                                            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/30'
                                    }`}
                                >
                                    <div className="p-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full group-hover:scale-110 transition duration-300">
                                        <Upload size={32} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">
                                            {fileName ? `Ready: ${fileName} (${fileSizeStr})` : 'Drag and drop your Excel (.xlsx) or CSV file here'}
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Auto-detects UTF-8, commas, tabs, and Excel workbooks
                                        </p>
                                    </div>
                                    <input 
                                        type="file" 
                                        accept=".xlsx,.xls,.csv,.tsv,.txt"
                                        onChange={handleFileUpload}
                                        className="hidden" 
                                        id="csv-file-input"
                                    />
                                    <label 
                                        htmlFor="csv-file-input" 
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-2.5 rounded-2xl shadow-lg cursor-pointer transition flex items-center gap-2"
                                    >
                                        <FileSpreadsheet size={16} /> Choose File (.xlsx / .csv)
                                    </label>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>Paste Tabular or CSV Data Here:</span>
                                        <span className="text-[10px] text-slate-400 font-mono">Top row must be column headers</span>
                                    </label>
                                    <textarea
                                        rows={8}
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        placeholder={mode === 'inventory' 
                                            ? "Item Name\tSKU\tCategory\tBuying Price\tSelling Price\tQuantity\nBasmati Rice 25kg\tSKU-RICE-25\tCereals\t2200\t2800\t50\nPure Cooking Oil 5L\tSKU-OIL-5L\tGroceries\t1100\t1350\t30"
                                            : "Full Name\tBusiness Name\tEmail\tPhone\tLocation\nJane Wanjiku\tWanjiku Enterprises\tjane@wanjiku.co.ke\t+254712345678\tNairobi"}
                                        className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200"
                                    />
                                    <button
                                        onClick={handlePasteSubmit}
                                        disabled={!rawText.trim()}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        Parse & Continue <ArrowRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: MAPPING */}
                    {step === 'mapping' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Column Header Alignment</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Match your spreadsheet headers to standard database fields. Live sample values shown below.</p>
                                </div>
                                <span className="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold px-3 py-1 rounded-full border border-indigo-500/20 w-fit">
                                    {csvHeaders.length} Columns Detected • {csvRows.length} Rows
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentFields.map(f => {
                                    const selectedHeader = columnMap[f.key];
                                    const sampleStr = selectedHeader ? getSampleValues(selectedHeader) : '';
                                    return (
                                        <div key={f.key} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                        {f.label}
                                                        {f.required && <span className="text-rose-500 text-xs">*</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">Key: {f.key}</div>
                                                </div>

                                                <select
                                                    value={columnMap[f.key] || ''}
                                                    onChange={(e) => setColumnMap({ ...columnMap, [f.key]: e.target.value })}
                                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3 py-1.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[160px]"
                                                >
                                                    <option value="">-- Ignore Field --</option>
                                                    {csvHeaders.map(h => (
                                                        <option key={h} value={h}>Header: "{h}"</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {selectedHeader && sampleStr && (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate bg-white/70 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Sample:</span> {sampleStr}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1"
                                >
                                    <ArrowLeft size={14} /> Back
                                </button>
                                <button
                                    onClick={buildParsedRows}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-2.5 rounded-2xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                                >
                                    Proceed to Validation & Preview <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PREVIEW & COLLISION SETTINGS */}
                    {step === 'preview' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            
                            {/* Collision Strategy Cards */}
                            <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                                        <ShieldCheck size={16} /> Data Integrity & Collision Protocol
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">Controls duplicate matching behavior</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStrategy('skip')}
                                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${strategy === 'skip' ? 'bg-indigo-600/30 border-indigo-500 text-white ring-2 ring-indigo-500/50' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <div className="font-bold text-xs flex items-center justify-between">
                                            🛡️ Skip Duplicates
                                            {strategy === 'skip' && <Check size={14} className="text-indigo-400" />}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1">Preserves existing records intact; existing items are left unmodified.</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setStrategy('overwrite')}
                                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${strategy === 'overwrite' ? 'bg-amber-600/30 border-amber-500 text-white ring-2 ring-amber-500/50' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <div className="font-bold text-xs flex items-center justify-between">
                                            🔄 Overwrite & Merge
                                            {strategy === 'overwrite' && <Check size={14} className="text-amber-400" />}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1">Updates existing item prices and restocks quantity from spreadsheet.</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setStrategy('append')}
                                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${strategy === 'append' ? 'bg-purple-600/30 border-purple-500 text-white ring-2 ring-purple-500/50' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <div className="font-bold text-xs flex items-center justify-between">
                                            ➕ Force Append All
                                            {strategy === 'append' && <Check size={14} className="text-purple-400" />}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1">Creates new distinct item records, auto-generating unique suffix if needed.</div>
                                    </button>
                                </div>
                            </div>

                            {/* Toolbar: Filters, Batch Select, Auto-Fix */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setActiveFilter('all')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        All ({parsedRows.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('valid')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeFilter === 'valid' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'}`}
                                    >
                                        🟢 Valid ({validCount})
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('warning')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeFilter === 'warning' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}
                                    >
                                        🟡 Matches ({warningCount})
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('error')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeFilter === 'error' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'}`}
                                    >
                                        🔴 Errors ({errorCount})
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    {errorCount > 0 && (
                                        <button
                                            onClick={handleAutoFixAll}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                                            title="Auto-generate missing SKUs and fallback defaults for errors"
                                        >
                                            <Sparkles size={13} /> Auto-Fix All Missing SKUs
                                        </button>
                                    )}

                                    <div className="text-xs font-bold text-slate-500 pl-2">
                                        Selected: <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black text-sm">{selectedCount}</span> / {parsedRows.length}
                                    </div>
                                </div>
                            </div>

                            {/* Preview Data Table with Inline Editing */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto max-h-[340px]">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-black sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 w-10 text-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedCount > 0 && selectedCount === parsedRows.filter(r => r.status !== 'error').length}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setParsedRows(parsedRows.map(r => r.status === 'error' ? r : { ...r, selected: isChecked }));
                                                    }}
                                                    className="rounded border-slate-300 cursor-pointer"
                                                />
                                            </th>
                                            <th className="p-3 w-12 text-center">#</th>
                                            <th className="p-3">Status</th>
                                            {mode === 'inventory' ? (
                                                <>
                                                    <th className="p-3">Item Name</th>
                                                    <th className="p-3">SKU</th>
                                                    <th className="p-3">Category</th>
                                                    <th className="p-3 text-right">Buying (KES)</th>
                                                    <th className="p-3 text-right">Selling (KES)</th>
                                                    <th className="p-3 text-center">Stock</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="p-3">Full Name</th>
                                                    <th className="p-3">Business Name</th>
                                                    <th className="p-3">Email</th>
                                                    <th className="p-3">Phone</th>
                                                    <th className="p-3">Location</th>
                                                </>
                                            )}
                                            <th className="p-3">Diagnostics</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                        {filteredRows.map(row => (
                                            <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!row.selected ? 'opacity-40 bg-slate-100/50 dark:bg-slate-900/50' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <input 
                                                        type="checkbox"
                                                        disabled={row.status === 'error'}
                                                        checked={row.selected}
                                                        onChange={(e) => {
                                                            const val = e.target.checked;
                                                            setParsedRows(parsedRows.map(r => r.id === row.id ? { ...r, selected: val } : r));
                                                        }}
                                                        className="rounded border-slate-300 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-3 text-center text-slate-400 font-mono text-[10px]">{row.id}</td>
                                                <td className="p-3">
                                                    {row.status === 'valid' && (
                                                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                            <CheckCircle2 size={11} /> Valid
                                                        </span>
                                                    )}
                                                    {row.status === 'warning' && (
                                                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                            <AlertTriangle size={11} /> Match
                                                        </span>
                                                    )}
                                                    {row.status === 'error' && (
                                                        <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                                                            <XCircle size={11} /> Error
                                                        </span>
                                                    )}
                                                </td>

                                                {mode === 'inventory' ? (
                                                    <>
                                                        <td className="p-2 font-bold text-slate-900 dark:text-white">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.name || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'name', e.target.value)}
                                                                placeholder="Item name"
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.sku || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'sku', e.target.value)}
                                                                placeholder="SKU"
                                                                className="w-28 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-slate-500">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.category || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'category', e.target.value)}
                                                                placeholder="General"
                                                                className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right font-mono">
                                                            <input 
                                                                type="number"
                                                                value={row.mappedData.buyingPrice || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'buyingPrice', e.target.value)}
                                                                placeholder="0"
                                                                className="w-20 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                            <input 
                                                                type="number"
                                                                value={row.mappedData.sellingPrice || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'sellingPrice', e.target.value)}
                                                                placeholder="0"
                                                                className="w-20 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded font-bold"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-center font-bold">
                                                            <input 
                                                                type="number"
                                                                value={row.mappedData.quantity || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'quantity', e.target.value)}
                                                                placeholder="0"
                                                                className="w-16 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-2 font-bold text-slate-900 dark:text-white">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.fullName || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'fullName', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-slate-700 dark:text-slate-300">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.businessName || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'businessName', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-slate-500 font-mono text-[11px]">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.email || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'email', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-slate-500">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.phone || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'phone', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-slate-500">
                                                            <input 
                                                                type="text"
                                                                value={row.mappedData.location || ''}
                                                                onChange={(e) => handleUpdateCell(row.id, 'location', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1 py-0.5 rounded"
                                                            />
                                                        </td>
                                                    </>
                                                )}

                                                <td className="p-3 text-[11px] text-slate-500 italic max-w-[200px] truncate">
                                                    {row.messages.join(' | ') || 'Ready for import'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => setStep('mapping')}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1"
                                >
                                    <ArrowLeft size={14} /> Back to Mapping
                                </button>
                                <button
                                    onClick={handleExecuteImport}
                                    disabled={selectedCount === 0}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs px-8 py-3 rounded-2xl shadow-xl transition flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                                >
                                    <CheckCircle2 size={16} /> Import {selectedCount} Selected Row(s)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: IMPORTING SPINNER */}
                    {step === 'importing' && (
                        <div className="py-16 text-center space-y-4 animate-in fade-in duration-200">
                            <RefreshCw size={48} className="animate-spin text-indigo-600 mx-auto" />
                            <h4 className="font-black text-lg text-slate-900 dark:text-white">Ingesting Data into Database...</h4>
                            <p className="text-xs text-slate-400">Applying collision strategy `{strategy}` and logging audit trail</p>
                        </div>
                    )}

                    {/* STEP 5: SUMMARY REPORT */}
                    {step === 'summary' && importResult && (
                        <div className="space-y-6 text-center py-6 animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/20">
                                <CheckCircle2 size={36} />
                            </div>

                            <div>
                                <h3 className="font-black text-2xl text-slate-900 dark:text-white">Bulk Data Population Complete!</h3>
                                <p className="text-xs text-slate-500 mt-1">{importResult.message}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{importResult.addedCount}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">New Records Added</div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-800">
                                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{importResult.updatedCount}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Updated / Merged</div>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="text-2xl font-black text-slate-600 dark:text-slate-300 font-mono">{importResult.skippedCount}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Skipped Duplicates</div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-3">
                                <button
                                    onClick={handleReset}
                                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs px-6 py-3 rounded-2xl transition cursor-pointer"
                                >
                                    Import Another Batch
                                </button>
                                <button
                                    onClick={onClose}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-8 py-3 rounded-2xl shadow-xl transition cursor-pointer uppercase tracking-wider"
                                >
                                    Close & Return to Terminal
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

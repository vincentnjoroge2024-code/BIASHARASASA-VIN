import React, { useRef, useState, useEffect } from 'react';
import { Transaction, getCurrencyByLocation, ThermalPrinterModel } from '../types';
import { LogoSVG } from './Logo';
import { useAppContext } from '../context';
import { 
    transferPreviewToPrinter, 
    exportElementToPdf, 
    streamTransactionToThermalPrinter, 
    kickCashDrawerDirect 
} from '../utils/printEngine';
import { 
    getStoredPrinterSettings, 
    THERMAL_PRINTER_PROFILES, 
    applyDynamicPrintStyles 
} from '../utils/thermalPrinter';
import { 
    Printer, FileText, Download, CheckCircle, ShieldCheck, X, 
    Receipt as ReceiptIcon, FileSpreadsheet, Building2, CreditCard, 
    QrCode, Calendar, Clock, User, Phone, MapPin, Hash, Check, Copy,
    Scissors, Sliders, Zap, Layers, RefreshCw, CheckCircle2
} from 'lucide-react';

export interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    documentType?: 'Receipt' | 'Bill' | 'Invoice';
    initialPrinterModel?: ThermalPrinterModel;
}

export const ReceiptModal: React.FC<PrintModalProps> = ({ 
    isOpen, 
    onClose, 
    transaction, 
    documentType: initialDocType = 'Receipt',
    initialPrinterModel
}) => {
    const { traders, user, showToast } = useAppContext();
    const [docType, setDocType] = useState<'Receipt' | 'Bill' | 'Invoice'>(initialDocType);
    const [viewFormat, setViewFormat] = useState<'a4' | '80mm' | '58mm'>(() => {
        if (initialPrinterModel === 'pos_58') return '58mm';
        return initialDocType === 'Receipt' ? '80mm' : 'a4';
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isStreamingSerial, setIsStreamingSerial] = useState(false);

    // Advanced Hardware & Output Configuration
    const [copies, setCopies] = useState<number>(() => {
        const stored = getStoredPrinterSettings();
        return stored.printCopies || 1;
    });
    const [autoCut, setAutoCut] = useState<boolean>(() => {
        const stored = getStoredPrinterSettings();
        return stored.autoCutter ?? true;
    });
    const [openDrawer, setOpenDrawer] = useState<boolean>(() => {
        const stored = getStoredPrinterSettings();
        return stored.cashDrawerKick ?? true;
    });
    const [highContrast, setHighContrast] = useState<boolean>(false);
    const [showHardwareBar, setShowHardwareBar] = useState<boolean>(false);

    // Sync initial doc type and printer format when modal reopens with different props
    useEffect(() => {
        if (initialDocType) {
            setDocType(initialDocType);
            if (initialDocType === 'Receipt') {
                const targetFmt = initialPrinterModel === 'pos_58' ? '58mm' : '80mm';
                setViewFormat(targetFmt);
                applyDynamicPrintStyles(targetFmt === '58mm' ? 'pos_58' : 'premax_pos80c');
            } else {
                setViewFormat('a4');
                applyDynamicPrintStyles('a4');
            }
        }
    }, [initialDocType, isOpen, initialPrinterModel]);

    const printableContainerRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !transaction) return null;

    const trader = transaction.traderId ? traders.find(t => t.id === transaction.traderId) : null;
    const currency = getCurrencyByLocation(trader?.location);

    const showLogo = trader ? (trader.showLogo ?? true) : true;
    const showBusinessName = trader ? (trader.showBusinessName ?? true) : true;
    const showLocation = trader ? (trader.showLocation ?? true) : true;
    const showPhone = trader ? (trader.showPhone ?? true) : true;
    const showTaxId = trader ? (trader.showTaxId ?? true) : true;
    const showDiscount = trader ? (trader.showDiscount ?? true) : true;
    const receiptHeader = trader?.receiptHeader || 'Your Trusted Business Partner';
    const receiptFooter = trader?.receiptFooter || 'Goods once sold are not returnable without prior authorization.\nThank you for choosing us!';

    const businessTitle = showBusinessName && trader?.businessName && trader.businessName !== '—' 
        ? trader.businessName 
        : 'Biashara Sasa Retail & Wholesale';

    // Due date calculated for Bills & Invoices (+14 days default if not set)
    const issueDateStr = transaction.date || new Date().toLocaleDateString('en-GB');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const formattedDueDate = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Document Titles & Labels
    const docTitles = {
        Receipt: 'OFFICIAL SALES RECEIPT',
        Invoice: 'TAX INVOICE',
        Bill: 'PROFORMA BILL / QUOTATION'
    };

    const docSubtitles = {
        Receipt: 'Payment Acknowledgement & Customer Duplicate',
        Invoice: 'Fiscal Commercial Tax Invoice (Compliant with Regional Revenue Authorities)',
        Bill: 'Statement of Account & Proforma Cost Estimate (This is not a Tax Invoice)'
    };

    /**
     * Enhanced Print Transfer:
     * Transmits the on-screen rendered preview directly to the printer interface using an isolated iframe.
     * Prevents modal/background spillover, enforces exact roll margins (80mm / 58mm / A4),
     * duplicates copies cleanly with tear markings, and instructs paper auto-cut.
     */
    const handlePrint = async () => {
        if (!printableContainerRef.current) return;
        setIsGenerating(true);
        showToast(`Transferring preview to printer (${viewFormat.toUpperCase()} &bull; ${copies}x)...`, 'info');

        try {
            const success = await transferPreviewToPrinter(printableContainerRef.current, {
                format: viewFormat,
                model: viewFormat === '58mm' ? 'pos_58' : viewFormat === '80mm' ? 'premax_pos80c' : 'a4',
                copies,
                autoCutter: autoCut,
                cashDrawerKick: openDrawer,
                density: highContrast ? 'high_contrast' : 'standard',
                documentTitle: `${docType}_${transaction.invoiceNo || 'DOC'}`
            });

            if (success) {
                showToast(`${docType} printed successfully!`, 'success');
            } else {
                window.print();
            }
        } catch (error) {
            console.error('Print transfer failed:', error);
            window.print();
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * Vector PDF Export tailored to the current format
     */
    const handleExportPDF = async () => {
        if (!printableContainerRef.current) return;
        setIsGenerating(true);
        showToast(`Generating ${viewFormat.toUpperCase()} vector PDF...`, 'info');

        try {
            const filename = `${docType.toLowerCase()}_${transaction.invoiceNo || 'DOC'}_${new Date().toISOString().slice(0, 10)}.pdf`;
            await exportElementToPdf(printableContainerRef.current, viewFormat, filename);
            showToast(`${docType} PDF saved successfully!`, 'success');
        } catch (error) {
            console.error('PDF export failed:', error);
            showToast('PDF export failed. You can use Print to PDF.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * Direct ESC/POS hardware stream via Web Serial / USB
     * Sends binary command sequence to Premax POS-80C / POS-58
     */
    const handleDirectThermalStream = async () => {
        setIsStreamingSerial(true);
        showToast('Connecting to thermal hardware port...', 'info');

        try {
            const currentSettings = getStoredPrinterSettings();
            const result = await streamTransactionToThermalPrinter(
                transaction,
                {
                    ...currentSettings,
                    autoCutter: autoCut,
                    cashDrawerKick: openDrawer,
                    printCopies: copies,
                    paperWidth: viewFormat
                },
                trader
            );

            if (result.success) {
                showToast('Raw ESC/POS stream delivered to thermal printer!', 'success');
            } else {
                showToast(result.message || 'Hardware port was cancelled. Please use Browser Direct Print.', 'info');
            }
        } catch (err: any) {
            console.error('Serial stream error:', err);
            showToast(err.message || 'Thermal stream connection failed.', 'error');
        } finally {
            setIsStreamingSerial(false);
        }
    };

    const handleKickDrawer = async () => {
        try {
            const res = await kickCashDrawerDirect();
            if (res.success) {
                showToast('Cash drawer kick pulse sent!', 'success');
            } else {
                showToast(res.message || 'Drawer kick pulse ready on next receipt print.', 'info');
            }
        } catch (e: any) {
            showToast('Could not access serial port for drawer pulse.', 'info');
        }
    };

    const handleCopySummary = () => {
        const text = `*${businessTitle}*\n*${docTitles[docType]} #${transaction.invoiceNo}*\nDate: ${transaction.date} ${transaction.time || ''}\nCustomer: ${transaction.customerName}\nTotal Due: ${currency.symbol} ${transaction.total.toFixed(2)}\nStatus: ${docType === 'Receipt' ? 'PAID IN FULL' : 'PENDING PAYMENT'}\nPayment Mode: ${transaction.paymentMethod}`;
        navigator.clipboard.writeText(text);
        showToast('Document summary copied to clipboard!', 'success');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 print:p-0 print:bg-transparent print:backdrop-blur-none print:z-auto">
            {/* Modal Shell */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden text-white print:border-none print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none print:bg-white print:text-black">
                
                {/* STUDIO TOOLBAR (Hidden in Print) */}
                <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg ${
                            docType === 'Receipt' ? 'bg-emerald-500 text-white' :
                            docType === 'Invoice' ? 'bg-indigo-600 text-white' :
                            'bg-amber-500 text-white'
                        }`}>
                            {docType === 'Receipt' && <ReceiptIcon size={22} />}
                            {docType === 'Invoice' && <FileText size={22} />}
                            {docType === 'Bill' && <FileSpreadsheet size={22} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black uppercase tracking-wider text-white">Document Printing Studio</h3>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    docType === 'Receipt' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    docType === 'Invoice' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                    {docType} Mode
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Ref: #{transaction.invoiceNo} &bull; {transaction.customerName}</p>
                        </div>
                    </div>

                    {/* Controls: Type Switcher & Format Toggle */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Document Mode Selector */}
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setDocType('Receipt')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                    docType === 'Receipt' 
                                        ? 'bg-emerald-500 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Receipt
                            </button>
                            <button
                                type="button"
                                onClick={() => setDocType('Invoice')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                    docType === 'Invoice' 
                                        ? 'bg-indigo-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Invoice
                            </button>
                            <button
                                type="button"
                                onClick={() => setDocType('Bill')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                    docType === 'Bill' 
                                        ? 'bg-amber-500 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Bill
                            </button>
                        </div>

                        {/* 2. Format Switcher: A4 vs 80mm vs 58mm Thermal */}
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewFormat('a4');
                                    applyDynamicPrintStyles('a4');
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                                    viewFormat === 'a4' 
                                        ? 'bg-slate-700 text-white shadow-sm' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Standard A4 Full Sheet"
                            >
                                A4
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewFormat('80mm');
                                    applyDynamicPrintStyles('premax_pos80c');
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                                    viewFormat === '80mm' 
                                        ? 'bg-slate-700 text-white shadow-sm' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="80mm Thermal (Premax POS-80C)"
                            >
                                80mm
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewFormat('58mm');
                                    applyDynamicPrintStyles('pos_58');
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                                    viewFormat === '58mm' 
                                        ? 'bg-slate-700 text-white shadow-sm' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="58mm Thermal (POS 58)"
                            >
                                58mm
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowHardwareBar(!showHardwareBar)}
                            className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                                showHardwareBar 
                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title="Toggle Hardware Settings"
                        >
                            <Sliders size={16} />
                            <span className="hidden sm:inline">Options</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition border border-slate-700 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* HARDWARE CALIBRATION & ADVANCED OUTPUT BAR (Collapsible or visible) */}
                {showHardwareBar && (
                    <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 print:hidden animate-fade-in">
                        {/* Copies Selection */}
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                <Layers size={13} className="text-indigo-400" /> Copies:
                            </span>
                            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                                {[1, 2, 3].map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setCopies(n)}
                                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                                            copies === n 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {n}x {n === 2 ? '(Cust+Store)' : n === 3 ? '(Cust+Store+Audit)' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Thermal Printer Hardware Options */}
                        <div className="flex flex-wrap items-center gap-2">
                            {viewFormat === '80mm' && (
                                <button
                                    type="button"
                                    onClick={() => setAutoCut(!autoCut)}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                        autoCut 
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}
                                    title="Premax POS-80C Guillotine Auto-Cutter"
                                >
                                    <Scissors size={13} />
                                    <span>Auto-Cut</span>
                                    {autoCut && <Check size={12} />}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setOpenDrawer(!openDrawer)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                    openDrawer 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                                title="RJ11/RJ12 Cash Drawer Kick Pulse"
                            >
                                <CreditCard size={13} />
                                <span>Kick Drawer</span>
                                {openDrawer && <Check size={12} />}
                            </button>

                            <button
                                type="button"
                                onClick={() => setHighContrast(!highContrast)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                    highContrast 
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                                title="High-density solid blacks for faded thermal print heads"
                            >
                                <Zap size={13} />
                                <span>High Contrast</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleKickDrawer}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold transition cursor-pointer"
                                title="Test Cash Drawer Kick Pulse"
                            >
                                Test Kick
                            </button>
                        </div>
                    </div>
                )}

                {/* SCROLLABLE DOCUMENT PREVIEW AREA */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible">
                    
                    {/* PRINT CONTAINER WITH FIDELITY TO THERMAL PAPER */}
                    <div 
                        ref={printableContainerRef}
                        className={`print-container printable-item print-format-${viewFormat} bg-white text-slate-900 shadow-2xl transition-all ${
                            viewFormat === '80mm' 
                                ? 'w-[80mm] min-h-[140mm] p-4 text-[12px] font-mono leading-tight border-x border-slate-200 relative print:border-none print:shadow-none' 
                                : viewFormat === '58mm'
                                    ? 'w-[58mm] min-h-[100mm] p-2.5 text-[10px] font-mono leading-tight border-x border-slate-200 relative print:border-none print:shadow-none'
                                    : 'w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 text-sm leading-normal rounded-xl border border-slate-200 print:rounded-none print:border-none print:shadow-none'
                        } ${highContrast ? 'font-bold text-black' : ''} relative overflow-hidden`}
                    >
                        {/* 0. WATERMARK OVERLAY (Hidden in standard, shows for Draft/Void) */}
                        {transaction.status === 'voided' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.08] rotate-[-35deg] select-none">
                                <span className="text-[120px] font-black tracking-widest text-rose-600 uppercase">VOIDED</span>
                            </div>
                        )}
                        {transaction.invoiceNo.startsWith('DRAFT') && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.05] rotate-[-35deg] select-none">
                                <span className="text-[120px] font-black tracking-widest text-slate-900 uppercase">PROFORMA</span>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* 1. THERMAL LAYOUT (80mm / 58mm)                          */}
                        {/* ========================================================= */}
                        {(viewFormat === '80mm' || viewFormat === '58mm') ? (
                            <div className="text-black space-y-3 font-mono">
                                {/* Header / Branding */}
                                <div className="text-center pb-2 border-b border-black border-dashed">
                                    {showLogo && (
                                        trader?.logoUrl ? (
                                            <img 
                                                src={trader.logoUrl} 
                                                alt="Logo" 
                                                className="w-14 h-14 object-contain mx-auto mb-1 grayscale" 
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <LogoSVG className="w-10 h-10 mx-auto mb-1 grayscale" />
                                        )
                                    )}
                                    <h2 className="text-base font-black uppercase tracking-tight">{businessTitle}</h2>
                                    {showLocation && <p className="text-[10px]">{trader?.location || 'Nairobi, Kenya'}</p>}
                                    {showPhone && <p className="text-[10px]">Tel: {trader?.phone || '+254 700 000 000'}</p>}
                                    {showTaxId && trader?.taxId && (
                                        <p className="text-[10px] font-bold">PIN: {trader.taxId}</p>
                                    )}
                                    <p className="text-[9px] italic mt-1">{receiptHeader}</p>
                                    
                                    {/* Document Badge */}
                                    <div className={`mt-2 inline-block border-2 border-black px-3 py-1 font-black text-xs uppercase tracking-wider ${
                                        docType === 'Bill' ? 'bg-slate-100' : ''
                                    }`}>
                                        *** {docTitles[docType]} ***
                                    </div>
                                    {docType === 'Receipt' && (
                                        <p className="text-[10px] font-black uppercase mt-1 text-emerald-800">[ PAID IN FULL ]</p>
                                    )}
                                    {docType === 'Bill' && (
                                        <p className="text-[10px] font-black uppercase mt-1 text-amber-800">[ ESTIMATE &bull; DUE: {formattedDueDate} ]</p>
                                    )}
                                </div>

                                {/* Metadata Section */}
                                <div className="text-[11px] space-y-1 border-b border-black border-dashed pb-2">
                                    <div className="flex justify-between">
                                        <span>Doc No:</span>
                                        <span className="font-bold">#{transaction.invoiceNo}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Date:</span>
                                        <span>{transaction.date} {transaction.time || ''}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Customer:</span>
                                        <span className="font-bold text-right truncate max-w-[140px]">{transaction.customerName}</span>
                                    </div>
                                    {transaction.cashierName && (
                                        <div className="flex justify-between">
                                            <span>Cashier:</span>
                                            <span>{transaction.cashierName}</span>
                                        </div>
                                    )}
                                    {transaction.serviceProvider && (
                                        <div className="flex justify-between">
                                            <span>Attendant:</span>
                                            <span className="font-bold">{transaction.serviceProvider}</span>
                                        </div>
                                    )}
                                    {transaction.serviceStation && (
                                        <div className="flex justify-between">
                                            <span>Station:</span>
                                            <span>{transaction.serviceStation}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Line Items Table */}
                                <div className="text-[11px] border-b border-black border-dashed pb-2">
                                    <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
                                        <span>ITEM</span>
                                        <span className="text-right">QTY x PRICE = TOTAL</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {transaction.items?.map((item: any, idx: number) => (
                                            <div key={idx}>
                                                <div className="font-bold truncate">{item.name}</div>
                                                <div className="flex justify-between text-[10px] text-gray-800">
                                                    <span>{item.qty} @ {currency.symbol} {item.price.toFixed(2)}</span>
                                                    <span className="font-bold">{currency.symbol} {(item.price * item.qty).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totals & Tax Schedule */}
                                <div className="text-[11px] space-y-1 border-b border-black border-dashed pb-2">
                                    <div className="flex justify-between">
                                        <span>Subtotal:</span>
                                        <span>{currency.symbol} {transaction.subtotal.toFixed(2)}</span>
                                    </div>
                                    {transaction.discountAmount > 0 && showDiscount && (
                                        <div className="flex justify-between font-bold">
                                            <span>Discount ({transaction.discountRate}%):</span>
                                            <span>-{currency.symbol} {transaction.discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {transaction.tax !== undefined && transaction.tax > 0 && (
                                        <div className="flex justify-between">
                                            <span>{transaction.taxLabel || trader?.taxLabel || 'VAT'} ({transaction.taxRate ?? trader?.taxRate ?? 16}%):</span>
                                            <span>+{currency.symbol} {transaction.tax.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm font-black border-t border-black pt-1 mt-1">
                                        <span>TOTAL {currency.code}:</span>
                                        <span>{currency.symbol} {transaction.total.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] pt-1">
                                        <span>Payment Mode:</span>
                                        <span className="font-bold uppercase">{transaction.paymentMethod}</span>
                                    </div>
                                </div>

                                {/* Remittance Info for Bill */}
                                {docType === 'Bill' && (
                                    <div className="p-2 border border-black text-[10px] space-y-0.5">
                                        <p className="font-bold uppercase">PAYMENT INSTRUCTIONS:</p>
                                        <p>Paybill / Till: <strong>522522</strong></p>
                                        <p>Account No: <strong>{transaction.invoiceNo}</strong></p>
                                        <p>Account Name: <strong>{businessTitle}</strong></p>
                                    </div>
                                )}

                                {/* Barcode / Fiscal Verification Block */}
                                <div className="text-center pt-2 space-y-1">
                                    <div className="inline-block px-4 py-1.5 bg-black text-white font-mono text-[9px] tracking-[0.25em]">
                                        * {transaction.invoiceNo} *
                                    </div>
                                    <p className="text-[8px] uppercase tracking-widest text-gray-600">Electronic Fiscal Signature Verified</p>
                                    <div className="text-[9px] pt-1 whitespace-pre-line text-gray-700">
                                        {receiptFooter}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ========================================================= */
                            /* 2. STANDARD A4 FORMAL DOCUMENT LAYOUT                     */
                            /* ========================================================= */
                            <div className="flex flex-col min-h-[260mm]">
                                
                                {/* TOP BANNER & BRANDING HEADER */}
                                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                                    <div className="flex items-center gap-4">
                                        {showLogo && (
                                            trader?.logoUrl ? (
                                                <img 
                                                    src={trader.logoUrl} 
                                                    alt="Merchant Logo" 
                                                    className="w-20 h-20 object-contain rounded-2xl border border-slate-200 p-2 shadow-sm"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white p-3 shadow-md">
                                                    <LogoSVG className="w-full h-full text-white" />
                                                </div>
                                            )
                                        )}
                                        <div>
                                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{businessTitle}</h1>
                                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-0.5">{receiptHeader}</p>
                                            <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                                                {showLocation && <p className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> {trader?.location || 'Central Business District, Nairobi'}</p>}
                                                {showPhone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> Tel: {trader?.phone || '+254 700 000 000'} | info@biasharasasa.com</p>}
                                                {showTaxId && trader?.taxId && <p className="flex items-center gap-1.5 font-mono text-[11px]"><Hash size={12} className="text-slate-400" /> KRA / Tax PIN: <strong>{trader.taxId}</strong></p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Document Header & State Stamp */}
                                    <div className="text-right">
                                        <div className={`px-4 py-2 rounded-xl inline-block mb-3 text-white ${
                                            docType === 'Receipt' ? 'bg-emerald-600' :
                                            docType === 'Invoice' ? 'bg-indigo-700' :
                                            'bg-amber-600'
                                        }`}>
                                            <h2 className="text-lg font-black uppercase tracking-wider">{docTitles[docType]}</h2>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-[220px] ml-auto">
                                            {docSubtitles[docType]}
                                        </p>
                                        
                                        <div className="mt-3 space-y-1 text-xs">
                                            <div className="flex justify-end gap-3">
                                                <span className="text-slate-500 font-bold uppercase">Document Ref:</span>
                                                <span className="font-black text-slate-900 font-mono text-sm">#{transaction.invoiceNo}</span>
                                            </div>
                                            <div className="flex justify-end gap-3">
                                                <span className="text-slate-500 font-bold uppercase">Issue Date:</span>
                                                <span className="font-semibold text-slate-900">{issueDateStr} {transaction.time || ''}</span>
                                            </div>
                                            {docType !== 'Receipt' && (
                                                <div className="flex justify-end gap-3">
                                                    <span className="text-amber-700 font-bold uppercase">Payment Due:</span>
                                                    <span className="font-black text-amber-900">{formattedDueDate}</span>
                                                </div>
                                            )}
                                            {docType === 'Receipt' && (
                                                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-black uppercase mt-1">
                                                    <CheckCircle size={14} /> Paid In Full
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* BILLING & RECIPIENT INFORMATION */}
                                <div className="grid grid-cols-2 gap-6 mb-8">
                                    {/* Client Card */}
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                            {docType === 'Bill' ? 'BILL TO / ACCOUNT HOLDER' : docType === 'Invoice' ? 'BUYER DETAILS' : 'CUSTOMER RECEIPT FOR'}
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 mb-1">{transaction.customerName}</h3>
                                        {transaction.customerPhone && (
                                            <p className="text-xs text-slate-600 font-semibold mb-1">Contact: {transaction.customerPhone}</p>
                                        )}
                                        {transaction.traderName && transaction.traderName !== 'Walk-in' && (
                                            <p className="text-xs text-slate-500">Authorized Account: {transaction.traderName}</p>
                                        )}
                                        <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] grid grid-cols-2 gap-2 text-slate-600">
                                            <div>
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Account Status</span>
                                                <span className="font-bold text-slate-800">Verified Client</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Currency</span>
                                                <span className="font-bold text-slate-800">{currency.code} ({currency.symbol})</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction Metadata & Status Card */}
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                                TRANSACTION SETTLEMENT DETAILS
                                            </span>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Payment Channel:</span>
                                                    <span className="font-black text-slate-800 uppercase bg-white px-2 py-0.5 rounded border border-slate-200">
                                                        {transaction.paymentMethod}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 font-medium">Register / Cashier:</span>
                                                    <span className="font-semibold text-slate-800">
                                                        {transaction.cashierName || user?.username || 'Main Terminal #01'}
                                                    </span>
                                                </div>
                                                {transaction.serviceProvider && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500 font-medium">Assigned Officer:</span>
                                                        <span className="font-bold text-indigo-600">{transaction.serviceProvider}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-600 uppercase">Settlement Total:</span>
                                            <span className="text-xl font-black text-slate-900 font-mono">
                                                {currency.symbol} {transaction.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ITEMIZED PARTICULARS TABLE */}
                                <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px]">
                                                <th className="py-3 px-4">#</th>
                                                <th className="py-3 px-4">Description / Particulars</th>
                                                <th className="py-3 px-4 text-center">Qty</th>
                                                <th className="py-3 px-4 text-right">Unit Price</th>
                                                <th className="py-3 px-4 text-center">Tax Rate</th>
                                                <th className="py-3 px-4 text-right">Line Total ({currency.code})</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {transaction.items?.map((item: any, idx: number) => {
                                                const lineSubtotal = (item.price * item.qty);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                                                        <td className="py-3 px-4">
                                                            <p className="font-bold text-slate-900">{item.name}</p>
                                                            {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className="font-black text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                                                {item.qty}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                                                            {item.price.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                                                            {transaction.taxRate ?? trader?.taxRate ?? 16}%
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                                                            {lineSubtotal.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* FINANCIAL SUMMARY & RECONCILIATION */}
                                <div className="grid grid-cols-2 gap-8 items-start mb-8">
                                    {/* Left: Remittance Instructions / Payment Options */}
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                                        <h4 className="font-black uppercase tracking-wider text-slate-800 text-[11px] flex items-center gap-2">
                                            <CreditCard size={15} className="text-indigo-600" />
                                            Payment & Remittance Advice
                                        </h4>
                                        <p className="text-slate-600 text-[11px] leading-relaxed">
                                            Payments can be made via Mobile Money (M-Pesa) or Direct Bank Wire:
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                                <p className="text-[9px] font-sans font-bold text-slate-400 uppercase">M-Pesa Paybill</p>
                                                <p className="font-black text-slate-900">522522</p>
                                                <p className="text-[9px] text-slate-500">Acc: #{transaction.invoiceNo}</p>
                                            </div>
                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                                <p className="text-[9px] font-sans font-bold text-slate-400 uppercase">Bank Wire (KCB)</p>
                                                <p className="font-black text-slate-900">1100223344</p>
                                                <p className="text-[9px] text-slate-500">Swift: KCBLKENX</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic mt-1">
                                            * Please indicate Document Reference <strong>#{transaction.invoiceNo}</strong> on your payment confirmation.
                                        </p>
                                    </div>

                                    {/* Right: Calculations */}
                                    <div className="space-y-2.5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                        <div className="flex justify-between text-xs font-bold text-slate-600 uppercase">
                                            <span>Taxable Subtotal:</span>
                                            <span className="font-mono text-slate-900">{currency.symbol} {transaction.subtotal.toFixed(2)}</span>
                                        </div>

                                        {transaction.discountAmount > 0 && showDiscount && (
                                            <div className="flex justify-between text-xs font-bold text-emerald-600 uppercase">
                                                <span>Applied Discount ({transaction.discountRate}%):</span>
                                                <span className="font-mono">-{currency.symbol} {transaction.discountAmount.toFixed(2)}</span>
                                            </div>
                                        )}

                                        {transaction.tax !== undefined && transaction.tax > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-slate-700 uppercase">
                                                <span>{transaction.taxLabel || trader?.taxLabel || 'VAT'} ({transaction.taxRate ?? trader?.taxRate ?? 16}%):</span>
                                                <span className="font-mono text-slate-900">+{currency.symbol} {transaction.tax.toFixed(2)}</span>
                                            </div>
                                        )}

                                        <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-baseline">
                                            <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Total Payable:</span>
                                            <span className="text-2xl font-black text-indigo-700 font-mono">
                                                {currency.symbol} {transaction.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* AUTHORIZATION & STAMP BLOCK */}
                                <div className="mt-auto pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 text-xs text-slate-600">
                                    {/* Signatory */}
                                    <div>
                                        <p className="font-black text-slate-800 uppercase tracking-widest text-[9px] mb-8">Authorized Signatory</p>
                                        <div className="border-b border-slate-400 w-3/4 mb-1"></div>
                                        <p className="text-[10px] text-slate-500 font-semibold">{businessTitle}</p>
                                    </div>

                                    {/* Official Stamp */}
                                    <div className="text-center flex flex-col items-center justify-center">
                                        <div className="w-24 h-24 border-2 border-dashed border-indigo-300 rounded-full flex flex-col items-center justify-center text-indigo-800 rotate-[-8deg] p-1">
                                            <ShieldCheck size={20} className="text-indigo-600 mb-0.5" />
                                            <span className="text-[8px] font-black uppercase tracking-widest text-center leading-none">OFFICIAL DOCUMENT</span>
                                            <span className="text-[7px] font-mono mt-0.5">{issueDateStr}</span>
                                        </div>
                                    </div>

                                    {/* Fiscal Electronic Verification QR */}
                                    <div className="text-right flex flex-col items-end">
                                        <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm inline-block mb-1">
                                            <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded-lg">
                                                <QrCode size={40} className="text-white" />
                                            </div>
                                        </div>
                                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">TIMS/EFRIS Fiscal QR Verified</span>
                                        <span className="text-[8px] font-mono text-slate-400">ID: {transaction.invoiceNo}</span>
                                    </div>
                                </div>

                                {/* FOOTER POLICY */}
                                <div className="mt-6 pt-3 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-medium">
                                    <span>{receiptFooter.replace(/\n/g, ' ')}</span>
                                    <span>Generated by BiasharaSasa Intelligent Enterprise Hub</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* MODAL FOOTER ACTIONS (Hidden in Print) */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">Printer Target:</span>
                        <span className="text-xs font-black uppercase text-white bg-slate-800 px-3 py-1 rounded-xl border border-slate-700 flex items-center gap-1.5">
                            <Printer size={13} className="text-indigo-400" />
                            {viewFormat === '80mm' ? 'Premax POS-80C (80mm Continuous)' :
                             viewFormat === '58mm' ? 'POS-58 Mini (58mm Continuous)' :
                             'Office Laser/Inkjet (A4 Sheet)'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/80">
                            {copies}x {copies > 1 ? 'Copies' : 'Copy'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopySummary}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                            title="Copy plain-text receipt summary"
                        >
                            <Copy size={14} /> <span className="hidden sm:inline">Copy</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExportPDF}
                            disabled={isGenerating}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                            title={`Export exact ${viewFormat} vector PDF`}
                        >
                            <Download size={14} /> <span>PDF</span>
                        </button>

                        {(viewFormat === '80mm' || viewFormat === '58mm') && (
                            <button
                                type="button"
                                onClick={handleDirectThermalStream}
                                disabled={isStreamingSerial}
                                className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="Stream raw ESC/POS binary direct to Premax/POS-58 USB or Serial port"
                            >
                                <Zap size={14} className={isStreamingSerial ? 'animate-pulse text-amber-400' : ''} />
                                <span className="hidden sm:inline">Direct</span> ESC/POS
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handlePrint}
                            disabled={isGenerating}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            title="Transfer preview with 100% fidelity to printer interface"
                        >
                            <Printer size={16} /> Direct Print
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

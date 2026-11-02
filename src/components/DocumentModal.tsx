import React, { useRef, useState } from 'react';
import { PurchaseOrder, GoodsReceiptNote, Trader, getCurrencyByLocation } from '../types';
import { LogoSVG } from './Logo';
import { useAppContext } from '../context';
import { transferPreviewToPrinter, exportElementToPdf } from '../utils/printEngine';
import { FileText, Download, Printer, X, BadgeCheck } from 'lucide-react';

export interface DocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentType: 'Purchase Order' | 'Goods Receipt Note';
    data: PurchaseOrder | GoodsReceiptNote | null;
    onPrint?: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ isOpen, onClose, documentType, data, onPrint }) => {
    const { traders, showToast } = useAppContext();
    const docRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    if (!isOpen || !data) return null;

    const requester = traders.find(t => t.id === data.requesterId);
    const provider = traders.find(t => t.id === data.providerId);
    const currency = getCurrencyByLocation(requester?.location);
    const docNumber = documentType === 'Purchase Order' ? (data as PurchaseOrder).poNumber : (data as GoodsReceiptNote).grnNumber;
    const items = documentType === 'Purchase Order' ? (data as PurchaseOrder).items : (data as GoodsReceiptNote).items;
    const date = documentType === 'Purchase Order' ? (data as PurchaseOrder).createdAt : (data as GoodsReceiptNote).receivedDate;
    const isConsolidated = documentType === 'Purchase Order' && docNumber?.startsWith('CON-PO-');

    const handlePrint = async () => {
        if (!docRef.current) return;
        setIsGenerating(true);
        showToast(`Transferring ${documentType} to printer...`, 'info');
        try {
            const success = await transferPreviewToPrinter(docRef.current, {
                format: 'a4',
                model: 'a4',
                documentTitle: `${documentType}_${docNumber}`
            });
            if (success) {
                showToast(`${documentType} sent to printer!`, 'success');
            } else {
                window.print();
            }
            if (onPrint) onPrint();
        } catch (e) {
            console.error('Print transfer failed:', e);
            window.print();
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportPDF = async () => {
        if (!docRef.current) return;
        setIsGenerating(true);
        showToast(`Generating ${documentType} PDF...`, 'info');
        
        try {
            const filename = `${documentType.toLowerCase().replace(/ /g, '_')}_${docNumber}.pdf`;
            await exportElementToPdf(docRef.current, 'a4', filename);
            showToast('PDF exported successfully!', 'success');
            if (onPrint) onPrint();
        } catch (error) {
            console.error('PDF export failed:', error);
            showToast('Failed to export PDF', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-white/20">
                {/* Header - Not printed */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                            <LogoSVG className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">{documentType.toUpperCase()}</h2>
                            <p className="text-xs font-bold text-slate-400 font-mono mt-0.5">REF: {docNumber}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50/50 scrollbar-hide">
                    <div ref={docRef} className="print-container bg-white p-6 sm:p-12 shadow-sm border border-slate-200/80 rounded-3xl min-h-[600px] text-slate-900 print:shadow-none print:border-none print:rounded-none print:p-0">
                        
                        {/* LPO Main Title Row */}
                        <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase mb-3">
                                    {documentType.toUpperCase()}
                                </h1>
                                <div className="space-y-1">
                                    <p className="text-xs sm:text-sm font-black text-slate-600 font-mono">
                                        NO: <span className="text-slate-900">{docNumber}</span>
                                    </p>
                                    <p className="text-xs sm:text-sm font-black text-slate-600 font-mono">
                                        DATE: <span className="text-slate-900">{new Date(date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <h2 className="text-xl sm:text-2xl font-bold text-blue-600 tracking-tight mb-2">
                                    {requester?.businessName || requester?.fullName || 'kasungu enterprises'}
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 font-medium">{requester?.location || 'bujumbura'}</p>
                                <p className="text-xs sm:text-sm text-slate-600 font-medium">{requester?.phone || '897653467'}</p>
                                <p className="text-xs sm:text-sm text-slate-600 font-medium">{requester?.email || 'kasungu@bizpro.com'}</p>
                            </div>
                        </div>

                        {/* Addresses Section: FROM (REQUESTER) vs TO (SUPPLIER/PROVIDER) */}
                        <div className="grid grid-cols-2 gap-8 my-8 pb-8 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">FROM (REQUESTER)</h3>
                                <p className="text-base sm:text-lg font-bold text-slate-900">{requester?.businessName || requester?.fullName || 'kasungu enterprises'}</p>
                                <p className="text-xs sm:text-sm text-slate-600 mt-1">{requester?.location || 'bujumbura'}</p>
                                {requester?.taxId && requester.taxId !== '—' && (
                                    <p className="text-xs text-slate-500 font-mono mt-1 font-semibold">PIN/TAX ID: {requester.taxId}</p>
                                )}
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">TO (SUPPLIER/PROVIDER)</h3>
                                <p className="text-base sm:text-lg font-bold text-slate-900">{provider?.businessName || provider?.fullName || 'Main Supplier Depot'}</p>
                                <p className="text-xs sm:text-sm text-slate-600 mt-1">{provider?.location || 'Central Distribution'}</p>
                                {provider?.phone && <p className="text-xs text-slate-500 mt-0.5">{provider.phone}</p>}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-8">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-t-2 border-b-2 border-slate-900 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                        <th className="py-3 pr-2">DESCRIPTION</th>
                                        <th className="py-3 px-2 text-center">SKU</th>
                                        <th className="py-3 px-2 text-center">QTY</th>
                                        <th className="py-3 px-2 text-right">UNIT PRICE</th>
                                        <th className="py-3 pl-2 text-right">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, idx) => {
                                        const qty = documentType === 'Purchase Order' ? (item as any).quantity : (item as any).quantityReceived;
                                        const total = qty * item.price;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-4 pr-2">
                                                    <p className="text-base sm:text-lg font-bold text-slate-900">{item.name}</p>
                                                </td>
                                                <td className="py-4 px-2 text-center text-xs font-mono text-slate-400">{item.sku}</td>
                                                <td className="py-4 px-2 text-center text-base sm:text-lg font-black text-slate-900 font-mono">
                                                    {qty}
                                                </td>
                                                <td className="py-4 px-2 text-right text-xs sm:text-sm font-medium text-slate-700 font-mono">
                                                    {currency.symbol} {item.price.toLocaleString()}
                                                </td>
                                                <td className="py-4 pl-2 text-right text-base sm:text-lg font-black text-slate-900 font-mono">
                                                    {currency.symbol} {total.toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Grand Total Row */}
                        <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center my-6">
                            <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                                GRAND TOTAL
                            </span>
                            <span className="text-2xl sm:text-3xl font-black text-blue-600 font-mono">
                                {currency.symbol} {items.reduce((acc, item) => acc + ((documentType === 'Purchase Order' ? (item as any).quantity : (item as any).quantityReceived) * item.price), 0).toLocaleString()}
                            </span>
                        </div>

                        {/* Signatures & Verification */}
                        <div className="mt-16 pt-8 border-t border-slate-100 grid grid-cols-2 gap-8 text-center">
                            <div>
                                <div className="border-b border-slate-300 w-3/4 mx-auto mb-2 h-10"></div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</h3>
                                <p className="text-xs font-bold text-slate-800 mt-1">{requester?.fullName || 'Store Manager'}</p>
                            </div>
                            <div>
                                <div className="border-b border-slate-300 w-3/4 mx-auto mb-2 h-10"></div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier Stamp & Signature</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 italic">Verified Provider</p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Action Buttons (Dark Navy Print vs Royal Blue PDF) */}
                <div className="p-4 sm:p-5 bg-white border-t border-slate-100 grid grid-cols-2 gap-4 print:hidden">
                    <button 
                        onClick={handlePrint}
                        className="bg-[#0f172a] hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                        <Printer size={18} /> PRINT DOCUMENT
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        className="bg-[#2563eb] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer"
                    >
                        <Download size={18} /> SAVE AS PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

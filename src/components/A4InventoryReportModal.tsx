import React, { useRef, useState } from 'react';
import { InventoryItem, Trader, formatCurrency } from '../types';
import { LogoSVG } from './Logo';
import { useAppContext } from '../context';
import { transferPreviewToPrinter, exportElementToPdf } from '../utils/printEngine';
import { Printer, Download, X, Package, ShieldCheck, FileSpreadsheet, AlertTriangle, Layers, Calendar } from 'lucide-react';

export interface A4InventoryReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: InventoryItem[];
    trader?: Trader | null;
    reportTitle?: string;
}

export const A4InventoryReportModal: React.FC<A4InventoryReportModalProps> = ({
    isOpen,
    onClose,
    inventory,
    trader,
    reportTitle = 'INVENTORY STOCK & VALUATION REPORT'
}) => {
    const { user, showToast } = useAppContext();
    const reportRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const safeInventory = Array.isArray(inventory) ? inventory : [];
    const totalSkus = safeInventory.length;
    const totalUnits = safeInventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalCostValue = safeInventory.reduce((sum, item) => sum + (item.costPrice || 0) * item.quantity, 0);
    const totalRetailValue = safeInventory.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0);
    const estimatedMargin = totalRetailValue > 0 ? (((totalRetailValue - totalCostValue) / totalRetailValue) * 100).toFixed(1) : '0';
    const lowStockItems = safeInventory.filter(item => item.quantity <= (item.reorderLevel || 0));

    // Grouping by category
    const categoriesMap: { [cat: string]: { count: number; qty: number; cost: number; value: number } } = {};
    safeInventory.forEach(item => {
        const cat = item.category || 'Standard';
        if (!categoriesMap[cat]) {
            categoriesMap[cat] = { count: 0, qty: 0, cost: 0, value: 0 };
        }
        categoriesMap[cat].count += 1;
        categoriesMap[cat].qty += item.quantity;
        categoriesMap[cat].cost += (item.costPrice || 0) * item.quantity;
        categoriesMap[cat].value += (item.unitPrice || 0) * item.quantity;
    });

    const handlePrint = async () => {
        if (!reportRef.current) return;
        setIsGenerating(true);
        showToast('Transferring valuation report to printer...', 'info');
        try {
            const success = await transferPreviewToPrinter(reportRef.current, {
                format: 'a4',
                model: 'a4',
                documentTitle: `Inventory_Report_${new Date().toISOString().split('T')[0]}`
            });
            if (success) {
                showToast('Valuation report sent to printer!', 'success');
            } else {
                window.print();
            }
        } catch (e) {
            console.error('Print transfer failed:', e);
            window.print();
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsGenerating(true);
        try {
            showToast('Generating A4 PDF Document...', 'info');
            const filename = `Inventory_Report_A4_${new Date().toISOString().split('T')[0]}.pdf`;
            await exportElementToPdf(reportRef.current, 'a4', filename);
            showToast('A4 PDF Exported successfully!', 'success');
        } catch (error) {
            console.error('Failed to export A4 PDF:', error);
            showToast('PDF Export failed. Please try printing to PDF.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Modal Header */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black uppercase tracking-wider">A4 Inventory Printing Studio</h3>
                                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                                    A4 Portrait Format
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400">Standardized A4 Report Layout for Audits & Regulatory Compliance</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                            <Printer size={16} /> Print A4 Report
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                            <Download size={16} /> Export A4 PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Printable Document Area */}
                <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 scrollbar-hide">
                    <div
                        ref={reportRef}
                        className="print-container bg-white p-8 sm:p-12 shadow-lg border border-slate-200 rounded-2xl mx-auto text-slate-900 print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0"
                        style={{ maxWidth: '210mm', minHeight: '297mm' }}
                    >
                        {/* Report Top Header */}
                        <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900 mb-6">
                            <div>
                                {trader?.logoUrl ? (
                                    <img
                                        src={trader.logoUrl}
                                        alt="Logo"
                                        className="h-14 object-contain mb-3"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                                            <LogoSVG className="w-5 h-5 text-white" />
                                        </div>
                                        <span className="font-black text-slate-900 text-lg uppercase tracking-tight">
                                            {trader?.businessName || 'BIASHARA SASA'}
                                        </span>
                                    </div>
                                )}
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{reportTitle}</h1>
                                <p className="text-xs text-slate-500 font-bold tracking-wide mt-1">STANDARD A4 AUDIT & BALANCE DOCUMENT</p>
                            </div>

                            <div className="text-right">
                                <p className="font-black text-slate-900 text-base">{trader?.businessName || trader?.fullName || 'Main Store'}</p>
                                <p className="text-xs text-slate-600 font-medium">{trader?.location || 'Central Depot'}</p>
                                <p className="text-xs text-slate-500">{trader?.phone || trader?.email || ''}</p>
                                {trader?.taxId && trader.taxId !== '—' && (
                                    <p className="text-xs font-mono font-bold text-slate-700 mt-1">KRA PIN / TAX ID: {trader.taxId}</p>
                                )}
                                <div className="mt-3 inline-block bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Report Date & Time</p>
                                    <p className="text-xs font-mono font-bold text-slate-800">{formattedDate} at {formattedTime}</p>
                                    <p className="text-[10px] text-slate-500">Generated By: {user?.username || 'System Administrator'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Executive Financial Summary Grid */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total SKUs</span>
                                <span className="text-xl font-black text-slate-900">{totalSkus}</span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Stock Units</span>
                                <span className="text-xl font-black text-slate-900">{totalUnits.toLocaleString()}</span>
                            </div>
                            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block mb-1">Total Cost Value</span>
                                <span className="text-lg font-black text-blue-900">{formatCurrency(totalCostValue, trader?.location)}</span>
                            </div>
                            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Total Retail Value</span>
                                <span className="text-lg font-black text-emerald-900">{formatCurrency(totalRetailValue, trader?.location)}</span>
                            </div>
                        </div>

                        {/* Inventory Category Breakdown */}
                        <div className="mb-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                <Layers size={14} /> Valuation Summary by Category
                            </h2>
                            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-widest">
                                        <th className="p-2.5">Category</th>
                                        <th className="p-2.5 text-center">SKU Count</th>
                                        <th className="p-2.5 text-center">Units</th>
                                        <th className="p-2.5 text-right">Cost Value</th>
                                        <th className="p-2.5 text-right">Retail Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(categoriesMap).map(([catName, stats], idx) => (
                                        <tr key={catName} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="p-2.5 font-bold text-slate-800">{catName}</td>
                                            <td className="p-2.5 text-center font-mono">{stats.count}</td>
                                            <td className="p-2.5 text-center font-mono font-bold">{stats.qty.toLocaleString()}</td>
                                            <td className="p-2.5 text-right font-mono text-slate-700">{formatCurrency(stats.cost, trader?.location)}</td>
                                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrency(stats.value, trader?.location)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Detailed Inventory Item Table */}
                        <div className="mb-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                <Package size={14} /> Itemized Stock Balance List
                            </h2>
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-widest">
                                            <th className="p-2.5">SKU / Code</th>
                                            <th className="p-2.5">Product Name</th>
                                            <th className="p-2.5 text-center">Category</th>
                                            <th className="p-2.5 text-center">In-Stock Qty</th>
                                            <th className="p-2.5 text-right">Unit Cost</th>
                                            <th className="p-2.5 text-right">Retail Price</th>
                                            <th className="p-2.5 text-right">Stock Valuation</th>
                                            <th className="p-2.5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {safeInventory.map((item, idx) => {
                                            const isLow = item.quantity <= (item.reorderLevel || 0);
                                            const itemValue = item.quantity * (item.unitPrice || 0);
                                            return (
                                                <tr key={item.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                                    <td className="p-2.5 font-mono text-[11px] font-bold text-slate-600">{item.sku}</td>
                                                    <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                                                    <td className="p-2.5 text-center text-[10px] text-slate-500 font-medium">{item.category || 'Standard'}</td>
                                                    <td className="p-2.5 text-center font-mono font-black text-slate-900">{item.quantity}</td>
                                                    <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(item.costPrice || 0, trader?.location)}</td>
                                                    <td className="p-2.5 text-right font-mono text-slate-800">{formatCurrency(item.unitPrice || 0, trader?.location)}</td>
                                                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(itemValue, trader?.location)}</td>
                                                    <td className="p-2.5 text-center">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                                            isLow ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                        }`}>
                                                            {isLow ? 'Low Stock' : 'OK'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Signatures & Approvals Section */}
                        <div className="mt-12 pt-6 border-t-2 border-slate-200 grid grid-cols-3 gap-6 text-center avoid-break">
                            <div>
                                <div className="border-b border-slate-400 h-10 w-3/4 mx-auto mb-2"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Prepared By</p>
                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Inventory Manager Signature</p>
                            </div>
                            <div>
                                <div className="border-b border-slate-400 h-10 w-3/4 mx-auto mb-2"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Verified By</p>
                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Internal Audit Signature</p>
                            </div>
                            <div>
                                <div className="border-b border-slate-400 h-10 w-3/4 mx-auto mb-2"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Approved By</p>
                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">Director / Stamp & Sign</p>
                            </div>
                        </div>

                        {/* Document Footer */}
                        <div className="mt-8 text-center border-t border-slate-100 pt-4 flex items-center justify-between text-[9px] text-slate-400 uppercase font-mono tracking-wider">
                            <span>Standard A4 Document Format</span>
                            <span>Confidential Internal Audit Sheet</span>
                            <span>Biashara Sasa Engine</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

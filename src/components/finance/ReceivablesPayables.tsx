import React, { useState } from 'react';
import { 
    Users, ShoppingCart, Plus, CheckCircle2, Clock, 
    AlertTriangle, DollarSign, Calendar, Search, Printer, FileText, FileSpreadsheet
} from 'lucide-react';
import { formatCurrency, Transaction } from '../../types';
import { ReceiptModal } from '../ReceiptModal';

interface ReceivablesPayablesProps {
    type: 'receivable' | 'payable';
    activeTrader: any;
    onRecordPayment: (item: any) => void;
}

export const ReceivablesPayables: React.FC<ReceivablesPayablesProps> = ({
    type,
    activeTrader,
    onRecordPayment
}) => {
    const isReceivable = type === 'receivable';
    const [printDoc, setPrintDoc] = useState<{ type: 'Receipt' | 'Bill' | 'Invoice', data: Transaction } | null>(null);

    const handlePrintDoc = (item: any, docType: 'Receipt' | 'Bill' | 'Invoice') => {
        const docTx: Transaction = {
            id: item.id,
            invoiceNo: item.docNumber,
            traderId: activeTrader?.id || null,
            traderName: activeTrader?.fullName || activeTrader?.businessName || 'Biashara Merchant',
            businessName: activeTrader?.businessName || 'Biashara Sasa Enterprise',
            customerName: item.partnerName,
            customerPhone: '+254 700 000 000',
            date: item.issueDate,
            time: '10:00',
            paymentMethod: item.status === 'paid' ? 'Bank Wire / M-Pesa' : 'Trade Credit / On Account',
            cashierName: 'Finance Accounts Officer',
            subtotal: item.totalAmount / 1.16,
            discountRate: 0,
            discountAmount: 0,
            tax: item.totalAmount - (item.totalAmount / 1.16),
            taxRate: 16,
            taxLabel: 'VAT (16%)',
            total: item.totalAmount,
            itemCount: 1,
            items: [
                {
                    id: 1,
                    name: isReceivable 
                        ? `Trade Credit Facility - Account Settlement for ${item.partnerName}`
                        : `Commercial Supply Order Settlement - ${item.partnerName}`,
                    price: item.totalAmount / 1.16,
                    qty: 1,
                    sku: item.docNumber
                }
            ]
        };
        setPrintDoc({ type: docType, data: docTx });
    };

    // Sample active credit lines / bills
    const [items, setItems] = useState([
        {
            id: 1,
            partnerName: isReceivable ? 'Mama Wanjiku Kiosk' : 'Kipkeino Dairy Ltd',
            docNumber: isReceivable ? 'INV-REC-0104' : 'BILL-SUP-2025',
            issueDate: '2025-01-10',
            dueDate: '2025-01-25',
            totalAmount: isReceivable ? 8500 : 22000,
            paidAmount: isReceivable ? 3000 : 10000,
            status: 'partial'
        },
        {
            id: 2,
            partnerName: isReceivable ? 'Njoro Green Cafe' : 'Mount Kenya Farm Aggregators',
            docNumber: isReceivable ? 'INV-REC-0108' : 'BILL-SUP-2028',
            issueDate: '2025-01-14',
            dueDate: '2025-02-05',
            totalAmount: isReceivable ? 10000 : 12000,
            paidAmount: 0,
            status: 'pending'
        }
    ]);

    const totalOutstanding = items.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
    const totalSettled = items.reduce((sum, i) => sum + i.paidAmount, 0);

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                        {isReceivable ? 'Accounts Receivable' : 'Accounts Payable'}
                    </h1>
                    <p className="text-slate-500 font-medium">
                        {isReceivable 
                            ? 'Monitor customer credit balances, aged debt, and incoming settlements.' 
                            : 'Track supplier invoices, vendor bills, and trade obligations.'}
                    </p>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
                    <p className={`text-2xl font-black ${isReceivable ? 'text-blue-600' : 'text-rose-600'}`}>
                        {formatCurrency(totalOutstanding, activeTrader?.location)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">{items.length} active {isReceivable ? 'invoices' : 'supplier bills'}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Settled (Paid)</p>
                    <p className="text-2xl font-black text-emerald-600">
                        {formatCurrency(totalSettled, activeTrader?.location)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Recorded this period</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Settlement Term</p>
                    <p className="text-2xl font-black text-slate-800">14 Days</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Standard trade credit</p>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900">
                        {isReceivable ? 'Active Customer Credit Invoices' : 'Outstanding Supplier Invoices'}
                    </h3>
                </div>

                <div className="divide-y divide-slate-100">
                    {items.map(item => {
                        const balanceDue = item.totalAmount - item.paidAmount;
                        return (
                            <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                            {item.docNumber}
                                        </span>
                                        <h4 className="text-base font-black text-slate-900">{item.partnerName}</h4>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                                        <span>Issued: {item.issueDate}</span>
                                        <span>Due: {item.dueDate}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-6">
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900">
                                            Balance: {formatCurrency(balanceDue, activeTrader?.location)}
                                        </p>
                                        <p className="text-xs text-slate-400 font-medium">
                                            Total: {formatCurrency(item.totalAmount, activeTrader?.location)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handlePrintDoc(item, 'Bill')}
                                                className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
                                                title="Print Proforma Bill / Statement"
                                            >
                                                Bill
                                            </button>
                                            <button
                                                onClick={() => handlePrintDoc(item, 'Invoice')}
                                                className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
                                                title="Print Tax Invoice"
                                            >
                                                Invoice
                                            </button>
                                            <button
                                                onClick={() => handlePrintDoc(item, 'Receipt')}
                                                className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
                                                title="Print Payment Receipt"
                                            >
                                                Receipt
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => onRecordPayment(item)}
                                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm ml-1"
                                        >
                                            {isReceivable ? 'Settle' : 'Pay'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <ReceiptModal 
                isOpen={!!printDoc}
                onClose={() => setPrintDoc(null)}
                transaction={printDoc?.data || null}
                documentType={printDoc?.type}
            />
        </div>
    );
};

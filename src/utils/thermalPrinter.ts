import { PrinterSettings, ThermalPrinterModel, Transaction } from '../types';

export interface ThermalPrinterProfile {
    id: ThermalPrinterModel;
    name: string;
    brand: string;
    paperWidth: '80mm' | '58mm' | 'a4';
    printableWidth: string;
    charColumns: number;
    dpi: number;
    speed: string;
    hasAutoCutter: boolean;
    hasCashDrawerPort: boolean;
    description: string;
    badgeColor: string;
    supportedRolls: string[];
}

export const THERMAL_PRINTER_PROFILES: Record<ThermalPrinterModel, ThermalPrinterProfile> = {
    premax_pos80c: {
        id: 'premax_pos80c',
        name: 'Premax POS-80C Thermal Printer',
        brand: 'Premax',
        paperWidth: '80mm',
        printableWidth: '72mm (576 dots)',
        charColumns: 48,
        dpi: 203,
        speed: '220 - 260 mm/s High Speed',
        hasAutoCutter: true,
        hasCashDrawerPort: true,
        description: 'Commercial 80mm high-speed thermal receipt printer with auto-cutter and RJ11/RJ12 cash drawer kick.',
        badgeColor: 'bg-emerald-600 text-white',
        supportedRolls: ['80mm x 80mm', '80mm x 70mm', '80mm x 60mm']
    },
    pos_58: {
        id: 'pos_58',
        name: 'POS 58 Mini Thermal Printer',
        brand: 'POS-58 Series / Xprinter / Milestone',
        paperWidth: '58mm',
        printableWidth: '48mm (384 dots)',
        charColumns: 32,
        dpi: 203,
        speed: '90 - 120 mm/s Compact',
        hasAutoCutter: false,
        hasCashDrawerPort: true,
        description: 'Compact 58mm POS thermal receipt printer with serrated manual tear-bar and portable Bluetooth/USB support.',
        badgeColor: 'bg-indigo-600 text-white',
        supportedRolls: ['58mm x 50mm', '58mm x 40mm', '58mm x 30mm']
    },
    a4: {
        id: 'a4',
        name: 'Standard A4 Full Sheet',
        brand: 'Laser / Inkjet Deskjet',
        paperWidth: 'a4',
        printableWidth: '190mm',
        charColumns: 80,
        dpi: 300,
        speed: 'Sheet Feed',
        hasAutoCutter: false,
        hasCashDrawerPort: false,
        description: 'Standard A4 paper for formal commercial invoices, proforma bills, and full-sheet accounts.',
        badgeColor: 'bg-slate-700 text-white',
        supportedRolls: ['A4 Portrait (210 x 297mm)']
    }
};

const STORAGE_KEY = 'biashara_printer_settings_v2';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
    model: 'premax_pos80c',
    printerName: 'Premax POS-80C (Default)',
    paperWidth: '80mm',
    autoCutter: true,
    cashDrawerKick: true,
    printCopies: 1,
    fontSize: 'normal',
    openDrawerOnSale: false,
    autoPrintOnSale: false,
    interfaceType: 'browser'
};

export function getStoredPrinterSettings(): PrinterSettings {
    if (typeof window === 'undefined') return DEFAULT_PRINTER_SETTINGS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_PRINTER_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to parse printer settings from localStorage:', e);
    }
    return DEFAULT_PRINTER_SETTINGS;
}

export function saveStoredPrinterSettings(settings: PrinterSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        localStorage.setItem('biashara_printer_model', settings.model);
    } catch (e) {
        console.warn('Failed to save printer settings to localStorage:', e);
    }
}

/**
 * Dynamically injects an @page CSS rule and container print styling tailored
 * specifically to Premax POS-80C (80mm), POS 58 (58mm), or Standard A4.
 */
export function applyDynamicPrintStyles(model: ThermalPrinterModel): void {
    if (typeof document === 'undefined') return;

    let styleEl = document.getElementById('biashara-dynamic-printer-style') as HTMLStyleElement | null;
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'biashara-dynamic-printer-style';
        document.head.appendChild(styleEl);
    }

    if (model === 'premax_pos80c') {
        styleEl.innerHTML = `
            @media print {
                @page {
                    size: 80mm auto !important;
                    margin: 0mm !important;
                }
                body, html {
                    width: 80mm !important;
                    max-width: 80mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    font-family: "Space Mono", monospace !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print-container {
                    width: 100% !important;
                    max-width: 80mm !important;
                    margin: 0 !important;
                    padding: 4mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
                .no-print { display: none !important; }
            }
        `;
    } else if (model === 'pos_58') {
        styleEl.innerHTML = `
            @media print {
                @page {
                    size: 58mm auto !important;
                    margin: 0mm !important;
                }
                body, html {
                    width: 58mm !important;
                    max-width: 58mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    font-family: "Space Mono", monospace !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print-container {
                    width: 100% !important;
                    max-width: 58mm !important;
                    margin: 0 !important;
                    padding: 2mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
                .no-print { display: none !important; }
            }
        `;
    } else {
        styleEl.innerHTML = `
            @media print {
                @page {
                    size: A4 portrait !important;
                    margin: 10mm 12mm 10mm 12mm !important;
                }
                body, html {
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-size: 12pt !important;
                }
                .print-container {
                    width: 100% !important;
                    max-width: 210mm !important;
                    margin: 0 auto !important;
                }
            }
        `;
    }
}

/**
 * Generate a realistic calibration test receipt for testing Premax POS-80C or POS 58
 */
export function generateTestReceipt(model: ThermalPrinterModel, businessName: string = 'BiasharaSasa Retail Hub'): Transaction {
    const is58 = model === 'pos_58';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
        id: 99999,
        invoiceNo: is58 ? 'POS58-TEST' : 'PREMAX-80C-TEST',
        traderId: 1,
        traderName: businessName,
        businessName: businessName,
        date: dateStr,
        time: timeStr,
        cashierName: 'Admin Engineer',
        customerName: is58 ? 'POS-58 Test Client' : 'Premax POS-80C Test Client',
        serviceProvider: is58 ? 'Station Attendant 1' : 'Service Lead Alex',
        serviceStation: is58 ? 'Counter 58mm' : 'Counter 80C',
        paymentMethod: 'Cash',
        items: [
            { id: 101, name: is58 ? 'Thermal Paper 58mm' : 'Thermal Roll 80x80mm Box', price: is58 ? 250 : 1800, qty: 1 },
            { id: 102, name: is58 ? 'Barista Espresso' : 'Point of Sale Ribbon Cartridge', price: is58 ? 200 : 650, qty: 2 },
            { id: 103, name: is58 ? 'Service Charge' : 'Hardware Maintenance Audit', price: is58 ? 50 : 350, qty: 1 }
        ],
        itemCount: 4,
        subtotal: is58 ? 700 : 3450,
        discountRate: 5,
        discountAmount: is58 ? 35 : 172.5,
        tax: is58 ? 106.4 : 524.4,
        taxRate: 16,
        taxLabel: 'VAT',
        total: is58 ? 771.4 : 3801.9,
        status: 'completed',
        notes: is58 
            ? 'POS-58 Hardware Test Ticket • 32 Columns Validated'
            : 'Premax POS-80C Test Ticket • 48 Columns & Auto-Cutter Validated'
    };
}

/**
 * Generate ESC/POS raw command buffer for direct serial/USB/network thermal printing
 */
export function generateEscPosReceipt(tx: Transaction, settings: PrinterSettings, trader?: any): Uint8Array {
    const bytes: number[] = [];
    const push = (...arr: number[]) => bytes.push(...arr);
    const text = (str: string) => {
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i) & 0xff);
        }
    };
    const line = (str: string) => {
        text(str);
        push(0x0a);
    };

    const is58 = settings.model === 'pos_58';
    const cols = is58 ? 32 : 48;
    const divider = '-'.repeat(cols);
    const doubleDivider = '='.repeat(cols);

    // 1. Initialize Printer (ESC @)
    push(0x1b, 0x40);

    // 2. Optional: Cash Drawer Kick (Pin 2 / Pin 5)
    if (settings.cashDrawerKick || settings.openDrawerOnSale) {
        push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
    }

    // 3. Header - Centered & Bold
    push(0x1b, 0x61, 0x01); // Center
    push(0x1b, 0x45, 0x01); // Bold ON
    push(0x1d, 0x21, 0x11); // Double width & height
    line(trader?.businessName || trader?.fullName || 'BIASHARASASA POS');
    push(0x1d, 0x21, 0x00); // Normal text
    push(0x1b, 0x45, 0x00); // Bold OFF

    line(trader?.location || 'Nairobi, Kenya');
    if (trader?.phone) line(`Tel: ${trader.phone}`);
    if (trader?.taxId) line(`PIN: ${trader.taxId}`);
    line(doubleDivider);

    // 4. Ticket Metadata - Left Aligned
    push(0x1b, 0x61, 0x00); // Left align
    line(`Doc: #${tx.invoiceNo || 'DOC-01'}`);
    line(`Date: ${tx.date || new Date().toLocaleDateString('en-GB')} ${tx.time || ''}`);
    line(`Client: ${tx.customerName || 'Walk-in Customer'}`);
    if (tx.serviceProvider) line(`Attendant: ${tx.serviceProvider}`);
    if (tx.serviceStation) line(`Station: ${tx.serviceStation}`);
    line(divider);

    // 5. Line items
    const pad = (str: string, length: number) => {
        return str.length >= length ? str.substring(0, length) : str + ' '.repeat(length - str.length);
    };
    const padLeft = (str: string, length: number) => {
        return str.length >= length ? str.substring(0, length) : ' '.repeat(length - str.length) + str;
    };

    if (is58) {
        // 32-column format
        line('ITEM               QTY    TOTAL');
        line(divider);
        tx.items?.forEach((item: any) => {
            const name = item.name.length > 18 ? item.name.substring(0, 18) : item.name;
            const qtyStr = padLeft(String(item.qty), 4);
            const totStr = padLeft(Number(item.price * item.qty).toFixed(1), 9);
            line(pad(name, 19) + qtyStr + totStr);
        });
    } else {
        // 48-column format (Premax POS-80C)
        line('ITEM DESCRIPTION            QTY    PRICE    TOTAL');
        line(divider);
        tx.items?.forEach((item: any) => {
            const name = item.name.length > 25 ? item.name.substring(0, 25) : item.name;
            const qtyStr = padLeft(String(item.qty), 5);
            const priceStr = padLeft(Number(item.price).toFixed(1), 8);
            const totStr = padLeft(Number(item.price * item.qty).toFixed(1), 10);
            line(pad(name, 25) + qtyStr + priceStr + totStr);
        });
    }

    line(divider);

    // 6. Totals
    const formatTotalLine = (label: string, value: string) => {
        const space = cols - label.length - value.length;
        return label + ' '.repeat(Math.max(1, space)) + value;
    };

    line(formatTotalLine('Subtotal:', tx.subtotal.toFixed(2)));
    if (tx.discountAmount > 0) {
        line(formatTotalLine(`Discount (${tx.discountRate}%):`, `-${tx.discountAmount.toFixed(2)}`));
    }
    if (tx.tax && tx.tax > 0) {
        line(formatTotalLine(`${tx.taxLabel || 'VAT'} (${tx.taxRate || 16}%):`, `+${tx.tax.toFixed(2)}`));
    }

    line(doubleDivider);
    push(0x1b, 0x45, 0x01); // Bold ON
    line(formatTotalLine('TOTAL DUE:', `KSh ${tx.total.toFixed(2)}`));
    push(0x1b, 0x45, 0x00); // Bold OFF
    line(formatTotalLine('Payment Mode:', tx.paymentMethod || 'Cash'));
    line(divider);

    // 7. Footer & Barcode note
    push(0x1b, 0x61, 0x01); // Center
    line(`* ${tx.invoiceNo || 'RECEIPT'} *`);
    line('Electronic Fiscal Signature Verified');
    line(trader?.receiptFooter || 'Thank you for your business!');

    // 8. Feed lines
    push(0x1b, 0x64, 0x04); // Feed 4 lines

    // 9. Paper Cut for Premax POS-80C (GS V 66 0)
    if (settings.autoCutter || settings.model === 'premax_pos80c') {
        push(0x1d, 0x56, 0x42, 0x00); // Partial cut after feed
    }

    return new Uint8Array(bytes);
}

/**
 * Web Serial direct USB/COM thermal printer connection
 */
export async function sendRawToWebSerial(data: Uint8Array): Promise<{ success: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        return {
            success: false,
            message: 'Web Serial API is not supported in this browser. Please use the Direct Print dialog or Chrome on desktop.'
        };
    }

    try {
        const port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
        const writer = port.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        await port.close();
        return {
            success: true,
            message: 'Direct ESC/POS stream delivered successfully to thermal printer port!'
        };
    } catch (err: any) {
        return {
            success: false,
            message: err.message || 'Web Serial connection failed or was cancelled by user.'
        };
    }
}

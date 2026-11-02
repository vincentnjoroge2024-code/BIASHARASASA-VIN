// src/utils/printEngine.ts
// Enterprise-Grade Printing Engine for BiasharaSasa POS & Multi-Tenant Retail
// High-fidelity transfer of on-screen preview output directly to printer interfaces
// Supports Premax POS-80C (80mm), POS-58 Mini (58mm), Standard A4, and Direct ESC/POS Hardware Streams

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ThermalPrinterModel, PrinterSettings, Transaction } from '../types';
import { 
    generateEscPosReceipt, 
    sendRawToWebSerial, 
    getStoredPrinterSettings, 
    applyDynamicPrintStyles 
} from './thermalPrinter';

export type PrintFormat = '80mm' | '58mm' | 'a4';

export interface TransferPrintOptions {
    format: PrintFormat;
    model?: ThermalPrinterModel;
    documentTitle?: string;
    copies?: number;
    cashDrawerKick?: boolean;
    autoCutter?: boolean;
    density?: 'standard' | 'high_contrast' | 'compact';
    customStyles?: string;
    onBeforePrint?: () => void;
    onAfterPrint?: () => void;
    onError?: (error: Error) => void;
}

/**
 * Isolated Iframe Print Transfer:
 * Copies the exact preview element into a hidden, clean iframe with matching paper geometry,
 * all inherited CSS stylesheets, web fonts, and exact @page sizing rules.
 * This guarantees the browser's printer interface receives ONLY the pristine preview document.
 */
export async function transferPreviewToPrinter(
    target: HTMLElement | string,
    options: TransferPrintOptions
): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
        if (options.onBeforePrint) options.onBeforePrint();

        // 1. Resolve element
        const element = typeof target === 'string' 
            ? document.getElementById(target) 
            : target;

        if (!element) {
            throw new Error('Print target element was not found in the DOM.');
        }

        const format = options.format || '80mm';
        const copies = Math.max(1, Math.min(5, options.copies || 1));
        const docTitle = options.documentTitle || 'BiasharaSasa_Document';

        // 2. Also inject dynamic print styles into parent window as fallback
        const model: ThermalPrinterModel = options.model || (format === '58mm' ? 'pos_58' : format === '80mm' ? 'premax_pos80c' : 'a4');
        applyDynamicPrintStyles(model);

        // 3. Remove existing print iframe if any
        const existingIframe = document.getElementById('biashara-isolated-print-frame');
        if (existingIframe) {
            existingIframe.remove();
        }

        // 4. Create isolated hidden print frame
        const iframe = document.createElement('iframe');
        iframe.id = 'biashara-isolated-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
            throw new Error('Failed to initialize isolated printing frame document.');
        }

        // 5. Gather all style tags and link[rel="stylesheet"] from current document
        let styleTagsHtml = '';
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
            styleTagsHtml += link.outerHTML + '\n';
        });

        const styles = document.querySelectorAll('style');
        styles.forEach(style => {
            if (style.id !== 'biashara-dynamic-printer-style') {
                styleTagsHtml += `<style>${style.innerHTML}</style>\n`;
            }
        });

        // 6. Define format-specific page sizing and typographic rules
        let pageCss = '';
        if (format === '80mm') {
            pageCss = `
                @page {
                    size: 80mm auto !important;
                    margin: 0mm !important;
                }
                html, body {
                    width: 80mm !important;
                    max-width: 80mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    font-family: "Space Mono", "Montserrat", ui-monospace, monospace !important;
                    font-size: 11px !important;
                    line-height: 1.25 !important;
                }
                .print-content-wrapper {
                    width: 100% !important;
                    max-width: 80mm !important;
                    margin: 0 !important;
                    background: #ffffff !important;
                }
                /* Ensure the captured preview container expands correctly */
                .print-container {
                    width: 100% !important;
                    max-width: 80mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
            `;
        } else if (format === '58mm') {
            pageCss = `
                @page {
                    size: 58mm auto !important;
                    margin: 0mm !important;
                }
                html, body {
                    width: 58mm !important;
                    max-width: 58mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    font-family: "Space Mono", "Montserrat", ui-monospace, monospace !important;
                    font-size: 9.5px !important;
                    line-height: 1.2 !important;
                }
                .print-content-wrapper {
                    width: 100% !important;
                    max-width: 58mm !important;
                    margin: 0 !important;
                    background: #ffffff !important;
                }
                .print-container {
                    width: 100% !important;
                    max-width: 58mm !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
            `;
        } else {
            pageCss = `
                @page {
                    size: A4 portrait !important;
                    margin: 0mm !important; /* Let content handle margins */
                }
                html, body {
                    width: 100% !important;
                    max-width: 210mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    color: #0f172a !important;
                    font-family: "Montserrat", sans-serif !important;
                    font-size: 11pt !important;
                    line-height: 1.5 !important;
                }
                .print-content-wrapper {
                    width: 100% !important;
                    max-width: 210mm !important;
                    margin: 0 auto !important;
                    background: #ffffff !important;
                }
                .print-container {
                    width: 100% !important;
                    max-width: 210mm !important;
                    margin: 0 auto !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                }
            `;
        }

        // Additional high-contrast / density styles
        const densityCss = options.density === 'high_contrast' 
            ? `* { font-weight: 700 !important; color: #000000 !important; }`
            : options.density === 'compact'
                ? `* { line-height: 1.1 !important; padding-top: 1px !important; padding-bottom: 1px !important; }`
                : '';

        // 7. Duplicate content for multiple copies if requested
        const contentHtml = element.outerHTML;
        let finalBodyHtml = '';

        // If the element has children with 'printable-item' class, we treat them as individual pages
        const children = element.querySelectorAll('.printable-item');
        const itemsToPrint = children.length > 0 ? Array.from(children) : [element];

        for (let i = 0; i < copies; i++) {
            const copyLabel = copies > 1 
                ? (i === 0 ? 'CUSTOMER COPY' : i === 1 ? 'MERCHANT / STORE COPY' : `COPY #${i + 1}`) 
                : '';

            const copyBanner = copyLabel ? `
                <div style="text-align: center; border-bottom: 1.5px dashed #000000; padding: 4px 0 6px 0; margin-bottom: 8px; font-weight: 900; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;">
                    *** ${copyLabel} ***
                </div>
            ` : '';

            itemsToPrint.forEach((item, itemIdx) => {
                const itemHtml = item.outerHTML;
                const isLastItem = itemIdx === itemsToPrint.length - 1 && i === copies - 1;
                
                finalBodyHtml += `
                    <div class="print-content-wrapper">
                        ${copyBanner}
                        ${itemHtml}
                    </div>
                `;

                if (!isLastItem) {
                    finalBodyHtml += `
                        <div style="page-break-after: always; border-top: 2px dashed #000000; margin: 16px 0 16px 0; padding-top: 8px; text-align: center; font-size: 9px; font-family: monospace;">
                            ----------------- [ NEXT DOCUMENT / TEAR HERE ] -----------------
                        </div>
                    `;
                }
            });
        }

        // 8. Write pristine HTML into isolated iframe
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>${docTitle}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
                ${styleTagsHtml}
                <style>
                    ${pageCss}
                    ${densityCss}
                    ${options.customStyles || ''}
                    
                    /* Universal Print Sanitizers & Studio Resets */
                    *, *::before, *::after {
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
                    .print\\:hidden, .print-hidden {
                        display: none !important;
                    }
                    img {
                        max-width: 100% !important;
                        height: auto !important;
                        filter: grayscale(100%) contrast(120%) !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    .font-mono, .font-monospace {
                        font-family: "Space Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
                    }
                    .font-sans {
                        font-family: "Montserrat", sans-serif !important;
                    }
                    /* Ensure headers are bold and high-contrast */
                    h1, h2, h3, h4, h5, h6, b, strong, .font-black, .font-bold {
                        font-weight: 700 !important;
                        color: #000000 !important;
                    }
                </style>
            </head>
            <body class="studio-print-mode">
                ${finalBodyHtml}
            </body>
            </html>
        `);
        iframeDoc.close();

        // 9. Ensure all images and fonts are fully loaded before dispatching print
        await new Promise<void>((resolve) => {
            const checkImages = () => {
                const images = Array.from(iframeDoc.images);
                if (images.length === 0) {
                    resolve();
                    return;
                }
                let loaded = 0;
                const total = images.length;
                let isResolved = false;

                const finish = () => {
                    if (!isResolved) {
                        isResolved = true;
                        resolve();
                    }
                };

                // Fallback timeout after 1.2s to prevent hanging on unreachable image URLs
                const timer = setTimeout(finish, 1200);

                images.forEach(img => {
                    if (img.complete) {
                        loaded++;
                        if (loaded >= total) {
                            clearTimeout(timer);
                            finish();
                        }
                    } else {
                        img.onload = img.onerror = () => {
                            loaded++;
                            if (loaded >= total) {
                                clearTimeout(timer);
                                finish();
                            }
                        };
                    }
                });
            };

            if (iframeDoc.readyState === 'complete') {
                checkImages();
            } else {
                iframe.onload = () => checkImages();
            }
        });

        // 10. Focus and execute system print dialog on the isolated frame
        const win = iframe.contentWindow;
        if (!win) {
            throw new Error('Unable to access printing window context.');
        }

        win.focus();
        win.print();

        if (options.onAfterPrint) options.onAfterPrint();

        // 11. Cleanup iframe after print dialog closes
        setTimeout(() => {
            try {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            } catch (e) {
                // Ignore cleanup race conditions
            }
        }, 3000);

        return true;
    } catch (err: any) {
        console.error('Print transfer failed:', err);
        if (options.onError) options.onError(err);
        
        // Ultimate fallback to standard window.print()
        window.print();
        return false;
    }
}

/**
 * High-Resolution Vector PDF Export tailored to 80mm, 58mm, or A4
 */
export async function exportElementToPdf(
    element: HTMLElement,
    format: PrintFormat,
    filename: string
): Promise<boolean> {
    const isThermal = format === '80mm' || format === '58mm';
    const rollWidth = format === '58mm' ? 58 : 80;

    const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = isThermal 
        ? new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [rollWidth, Math.max(120, (canvas.height * rollWidth) / canvas.width)]
        })
        : new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, isThermal ? pdfHeight : Math.min(pdfHeight, 287));
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

    return true;
}

/**
 * Direct ESC/POS Hardware Stream to Web Serial / USB Port
 */
export async function streamTransactionToThermalPrinter(
    tx: Transaction,
    settings?: PrinterSettings,
    trader?: any
): Promise<{ success: boolean; message: string }> {
    const activeSettings = settings || getStoredPrinterSettings();
    const rawData = generateEscPosReceipt(tx, activeSettings, trader);
    return await sendRawToWebSerial(rawData);
}

/**
 * Direct Cash Drawer Kick Pulse via Web Serial (ESC/POS: ESC p 0 25 250)
 */
export async function kickCashDrawerDirect(): Promise<{ success: boolean; message: string }> {
    // ESC p m t1 t2: 0x1B, 0x70, 0x00, 0x19, 0xFA
    const kickSequence = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    return await sendRawToWebSerial(kickSequence);
}

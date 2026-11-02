import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context';
import { processSale } from '../../api';
import { 
    Trash2, Plus, Minus, CheckCircle, Scan, Box, Search, Package, 
    ShoppingBag, ShieldCheck, ChevronUp, ChevronDown, Maximize2, Minimize2,
    RotateCcw, Sparkles, Scissors, Coffee, Wrench, Users, UserCheck, X, Layers, Store, Clock, PlusCircle,
    Printer, ArrowDown, ArrowUp, Sliders, CheckCircle2
} from 'lucide-react';
import { ReceiptModal } from '../ReceiptModal';
import { BarcodeScanner } from '../BarcodeScanner';
import { PrinterSettingsModal } from '../PrinterSettingsModal';
import { 
    getStoredPrinterSettings, 
    THERMAL_PRINTER_PROFILES, 
    generateTestReceipt,
    applyDynamicPrintStyles 
} from '../../utils/thermalPrinter';
import { Transaction, Product, PosTicket, ServiceVenueType, ThermalPrinterModel, formatCurrency, formatCurrencyNoDecimals } from '../../types';

export const POSTab: React.FC = () => {
    const { products, inventory, cart, setCart, traders, showToast, refreshData, user } = useAppContext();
    const permissions = user?.permissions || { 
        pos: true, inventory: true, production: true, finance: true, tax: true, reports: true, hr: true, manage_team: true 
    };
    const hasPosPermission = permissions.pos || user?.role === 'admin';

    const isTraderUser = user && (
        user.role === 'manager' || 
        user.role === 'cashier' || 
        user.role === 'staff' || 
        user.role === 'owner' || 
        user.role === 'tenant_admin' ||
        ['owner', 'manager', 'cashier', 'stock_controller', 'accountant', 'production_supervisor', 'service_provider', 'supervisor', 'staff'].includes(user.role.toLowerCase())
    ) && hasPosPermission;
    const loggedInTrader = isTraderUser && user.traderId 
        ? traders.find(t => t.id === user.traderId) 
        : (isTraderUser ? (traders.find(t => t.email.toLowerCase() === user.username.toLowerCase()) || traders[0]) : null);

    const [selectedTraderId, setSelectedTraderId] = useState<number | ''>(() => loggedInTrader ? loggedInTrader.id : '');
    const [isBannerCollapsed, setIsBannerCollapsed] = useState(true);
    const [isCartExpanded, setIsCartExpanded] = useState(false);
    const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
    const [isFooterCompact, setIsFooterCompact] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customerName, setCustomerName] = useState('Walk-in Customer');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [serviceProvider, setServiceProvider] = useState('');
    const [serviceStation, setServiceStation] = useState('Counter 1');
    const [venueType, setVenueType] = useState<ServiceVenueType>('general');
    const [printDoc, setPrintDoc] = useState<{ type: 'Receipt' | 'Bill' | 'Invoice', data: Transaction } | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    // Thermal Printer Driver State (Premax POS-80C & POS-58)
    const [printerModel, setPrinterModel] = useState<ThermalPrinterModel>(() => {
        const stored = getStoredPrinterSettings();
        return stored.model || 'premax_pos80c';
    });
    const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);

    useEffect(() => {
        if (loggedInTrader) {
            setSelectedTraderId(loggedInTrader.id);
        }
    }, [loggedInTrader]);

    // Multi-Customer Concurrent Serving & Tabs State
    const [tickets, setTickets] = useState<PosTicket[]>([
        { 
            id: 'tab-1', 
            label: 'Tab #1', 
            venueType: 'general', 
            serviceProvider: '', 
            serviceStation: 'Counter 1', 
            customerName: 'Walk-in Customer', 
            cart: [], 
            paymentMethod: 'Cash', 
            createdAt: Date.now() 
        }
    ]);
    const [activeTicketId, setActiveTicketId] = useState<string>('tab-1');

    // Current Cart Vertical Scroll State & References
    const cartScrollRef = useRef<HTMLDivElement>(null);
    const [canScrollDown, setCanScrollDown] = useState(false);
    const [isScrolledDown, setIsScrolledDown] = useState(false);

    const checkCartScroll = () => {
        const el = cartScrollRef.current;
        if (!el) return;
        const hasOverflow = el.scrollHeight > el.clientHeight + 10;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 25;
        const atTop = el.scrollTop <= 20;
        setCanScrollDown(hasOverflow && !atBottom);
        setIsScrolledDown(!atTop);
    };

    useEffect(() => {
        checkCartScroll();
        const el = cartScrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkCartScroll, { passive: true });
        window.addEventListener('resize', checkCartScroll);
        return () => {
            el.removeEventListener('scroll', checkCartScroll);
            window.removeEventListener('resize', checkCartScroll);
        };
    }, [cart, tickets, activeTicketId, isCartExpanded]);

    const scrollToCartBottom = () => {
        if (cartScrollRef.current) {
            cartScrollRef.current.scrollTo({
                top: cartScrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    const scrollToCartTop = () => {
        if (cartScrollRef.current) {
            cartScrollRef.current.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    };

    // Keep active ticket's cart in sync with context cart
    useEffect(() => {
        setTickets(prev => prev.map(t => {
            if (t.id === activeTicketId) {
                return { ...t, cart: [...cart] };
            }
            return t;
        }));
    }, [cart, activeTicketId]);

    const switchTicket = (targetId: string) => {
        if (targetId === activeTicketId) return;
        // 1. Snapshot current active tab state into tickets array
        setTickets(prev => prev.map(t => {
            if (t.id === activeTicketId) {
                return {
                    ...t,
                    cart: [...cart],
                    customerName,
                    paymentMethod: paymentMethod as any,
                    serviceProvider,
                    serviceStation,
                    venueType
                };
            }
            return t;
        }));

        // 2. Load target ticket state
        const target = tickets.find(t => t.id === targetId);
        if (target) {
            setActiveTicketId(targetId);
            setCart(target.cart || []);
            setCustomerName(target.customerName || 'Walk-in Customer');
            setPaymentMethod(target.paymentMethod || 'Cash');
            setServiceProvider(target.serviceProvider || '');
            setServiceStation(target.serviceStation || '');
            if (target.venueType) setVenueType(target.venueType);
        }
    };

    const addNewTicket = (type: ServiceVenueType = venueType, customLabel?: string, defaultProvider?: string, defaultStation?: string) => {
        setTickets(prev => {
            const updated = prev.map(t => {
                if (t.id === activeTicketId) {
                    return {
                        ...t,
                        cart: [...cart],
                        customerName,
                        paymentMethod: paymentMethod as any,
                        serviceProvider,
                        serviceStation,
                        venueType
                    };
                }
                return t;
            });

            const count = updated.length + 1;
            let label = customLabel;
            let station = defaultStation || '';
            let provider = defaultProvider || '';

            if (!label) {
                if (type === 'cafe') {
                    label = `Table ${count}`;
                    station = `Table ${count}`;
                    provider = defaultProvider || `Server ${count}`;
                } else if (type === 'salon') {
                    label = `Chair ${count}`;
                    station = `Chair ${count}`;
                    provider = defaultProvider || `Stylist ${count}`;
                } else if (type === 'service_center') {
                    label = `Bay ${count}`;
                    station = `Bay ${count}`;
                    provider = defaultProvider || `Tech ${count}`;
                } else {
                    label = `Tab #${count}`;
                    station = `Counter ${count}`;
                }
            }

            const newId = `tab-${Date.now()}`;
            const newTicket: PosTicket = {
                id: newId,
                label,
                venueType: type,
                serviceProvider: provider,
                serviceStation: station,
                customerName: 'Walk-in Customer',
                cart: [],
                paymentMethod: 'Cash',
                createdAt: Date.now()
            };

            setActiveTicketId(newId);
            setCart([]);
            setCustomerName('Walk-in Customer');
            setPaymentMethod('Cash');
            setServiceProvider(provider);
            setServiceStation(station);
            setVenueType(type);

            return [...updated, newTicket];
        });
        showToast('New customer tab opened', 'success');
    };

    const closeTicket = (ticketIdToClose: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (tickets.length <= 1) {
            setCart([]);
            setCustomerName('Walk-in Customer');
            setServiceProvider('');
            setServiceStation('Counter 1');
            setTickets([{
                id: 'tab-1',
                label: 'Tab #1',
                venueType: 'general',
                serviceProvider: '',
                serviceStation: 'Counter 1',
                customerName: 'Walk-in Customer',
                cart: [],
                paymentMethod: 'Cash',
                createdAt: Date.now()
            }]);
            setActiveTicketId('tab-1');
            showToast('Current tab cleared', 'info');
            return;
        }

        const remaining = tickets.filter(t => t.id !== ticketIdToClose);
        setTickets(remaining);

        if (activeTicketId === ticketIdToClose) {
            const nextTicket = remaining[0];
            setActiveTicketId(nextTicket.id);
            setCart(nextTicket.cart || []);
            setCustomerName(nextTicket.customerName || 'Walk-in Customer');
            setPaymentMethod(nextTicket.paymentMethod || 'Cash');
            setServiceProvider(nextTicket.serviceProvider || '');
            setServiceStation(nextTicket.serviceStation || '');
            if (nextTicket.venueType) setVenueType(nextTicket.venueType);
        }
        showToast('Customer tab closed', 'info');
    };

    const updateCurrentTicketLabel = (newLabel: string) => {
        setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, label: newLabel } : t));
    };

    const providerSuggestions = venueType === 'salon'
        ? ['Grace (Stylist)', 'David (Barber)', 'Brian (Senior Stylist)', 'Faith (Braider)', 'James (Barber)']
        : venueType === 'cafe'
        ? ['Kevin (Server)', 'Sarah (Waitress)', 'Daniel (Waiter)', 'Lucy (Host)', 'Peter (Barista)']
        : venueType === 'service_center'
        ? ['Alex (Technician)', 'Eric (Diagnostics)', 'John (Lead Mechanic)', 'Michael (Tech)', 'Samuel (Inspection)']
        : ['Staff Member', 'Cashier #01', 'Floor Manager', 'Store Assistant'];

    const stationSuggestions = venueType === 'salon'
        ? ['Chair 1', 'Chair 2', 'Chair 3', 'Chair 4', 'VIP Lounge', 'Washing Station']
        : venueType === 'cafe'
        ? ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Patio 1', 'Bar 1']
        : venueType === 'service_center'
        ? ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4', 'Diagnostics Bay', 'Lift 1']
        : ['Counter 1', 'Counter 2', 'Front Desk', 'Express Till'];

    const handleScanProduct = (code: string) => {
        // Find product with matching SKU, code, barcode, or ID (case-insensitive)
        const matched = posProducts.find(p => 
            (p.sku && typeof p.sku === 'string' && p.sku.toLowerCase() === code.toLowerCase()) ||
            (p.barcode && typeof p.barcode === 'string' && p.barcode.toLowerCase() === code.toLowerCase()) ||
            (p.code && typeof p.code === 'string' && p.code.toLowerCase() === code.toLowerCase()) ||
            String(p.id) === code
        );

        if (matched) {
            if (selectedTrader && matched.quantity !== undefined && matched.quantity <= 0) {
                showToast(`Warning: "${matched.name}" is out of stock!`, 'error');
                return { success: false, error: `"${matched.name}" is out of stock` };
            }
            
            let isLimitReached = false;
            setCart(prev => {
                const existing = prev.find(item => item.id === matched.id);
                if (existing) {
                    if (selectedTrader && matched.quantity !== undefined && existing.qty >= matched.quantity) {
                        isLimitReached = true;
                        return prev;
                    }
                    return prev.map(item => item.id === matched.id ? { ...item, qty: item.qty + 1 } : item);
                }
                return [...prev, { ...matched, qty: 1 }];
            });

            if (isLimitReached) {
                showToast(`Cannot add more: only ${matched.quantity} items are in stock.`, 'info');
                return { success: false, error: `Only ${matched.quantity} items in stock` };
            }
            
            showToast(`Added to cart: ${matched.name}`, 'success');
            return { success: true, productName: matched.name };
        } else {
            showToast(`SKU/Barcode "${code}" not found`, 'error');
            return { success: false, error: "Not found in active catalog" };
        }
    };

    const safeTraders = Array.isArray(traders) ? traders : [];
    const safeInventory = Array.isArray(inventory) ? inventory : [];
    const activeTraders = safeTraders.filter(t => t.status === 'active');
    const selectedTrader = selectedTraderId ? safeTraders.find(t => t.id === Number(selectedTraderId)) : null;

    // Load either trader personalized stock or general products catalog
    const posProducts: Product[] = selectedTrader 
        ? safeInventory.filter(item => item.traderId === selectedTrader.id).map(item => ({
            id: item.id,
            name: item.name,
            price: item.unitPrice,
            costPrice: item.costPrice,
            sku: item.sku,
            barcode: item.barcode,
            category: item.category,
            brand: item.brand,
            model: item.model,
            uom: item.uom,
            quantity: item.quantity,
            icon: 'Package', // Default icon for inventory items
            code: item.barcode || item.sku
        }))
        : products;

    const filteredPosProducts = posProducts.filter(product => {
        const query = searchQuery.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesSku = 'sku' in product && typeof product.sku === 'string' && product.sku.toLowerCase().includes(query);
        const matchesCode = 'code' in product && typeof product.code === 'string' && product.code.toLowerCase().includes(query);
        return matchesName || matchesSku || matchesCode;
    });

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountRate = selectedTrader?.discountRate || 0;
    const discountAmount = (subtotal * discountRate) / 100;
    const discountedSubtotal = subtotal - discountAmount;
    
    // Automatic tax addition is removed from sales & checkout in POS module.
    // The trader indicates the percentage tax rate to be applied in Trader Settings (POS Document Architect).
    // If configured and enabled by the trader, that tax percentage is applied; otherwise tax is 0 (exempt).
    const isTaxConfigured = !!(selectedTrader?.applyTax && selectedTrader?.taxRate !== undefined && Number(selectedTrader.taxRate) > 0);
    const traderTaxRate = isTaxConfigured ? Number(selectedTrader!.taxRate) : 0;
    const traderTaxLabel = selectedTrader?.taxLabel || 'VAT';
    const tax = traderTaxRate > 0 ? (discountedSubtotal * traderTaxRate) / 100 : 0;
    const total = discountedSubtotal + tax;

    const addToCart = (product: Product) => {
        if (selectedTrader && product.quantity !== undefined && product.quantity <= 0) {
            showToast(`Warning: "${product.name}" is out of stock!`, 'error');
            return;
        }
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (selectedTrader && product.quantity !== undefined && existing.qty >= product.quantity) {
                    showToast(`Cannot add more: only ${product.quantity} items are in stock.`, 'info');
                    return prev;
                }
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.qty + delta;
                if (selectedTrader && delta > 0) {
                    const originalProduct = posProducts.find(p => p.id === id);
                    if (originalProduct && originalProduct.quantity !== undefined && newQty > originalProduct.quantity) {
                        showToast(`Only ${originalProduct.quantity} items available in stock.`, 'info');
                        return item;
                    }
                }
                return newQty > 0 ? { ...item, qty: newQty } : item;
            }
            return item;
        }).filter(item => item.qty > 0));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const handlePrintPreview = (type: 'Receipt' | 'Bill' | 'Invoice') => {
        if (cart.length === 0) {
            showToast('Cart is empty', 'info');
            return;
        }

        const mockTransaction: Transaction = {
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            invoiceNo: `DRAFT-${Math.floor(Math.random() * 10000)}`,
            traderId: selectedTrader?.id || null,
            traderName: selectedTrader?.fullName || 'Walk-in',
            businessName: selectedTrader?.businessName || '—',
            customerName,
            subtotal,
            discountRate,
            discountAmount,
            tax,
            taxRate: traderTaxRate,
            taxLabel: traderTaxLabel,
            total,
            paymentMethod,
            cashierName: user?.username || 'System',
            serviceProvider: serviceProvider.trim() || undefined,
            serviceStation: serviceStation.trim() || undefined,
            items: [...cart],
            itemCount: cart.reduce((s, c) => s + c.qty, 0)
        };
        
        setPrintDoc({ type, data: mockTransaction });
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            showToast('Cart is empty');
            return;
        }

        try {
            const saleData = {
                subtotal,
                discountRate,
                discountAmount,
                tax,
                taxRate: traderTaxRate,
                taxLabel: traderTaxLabel,
                total,
                traderId: selectedTrader?.id || null,
                traderName: selectedTrader?.fullName || 'Walk-in',
                businessName: selectedTrader?.businessName || '—',
                customerName,
                paymentMethod,
                cashierName: user?.username || 'System',
                serviceProvider: serviceProvider.trim() || undefined,
                serviceStation: serviceStation.trim() || undefined,
                items: cart
            };
            const result: any = await processSale(saleData);

            if (result.success) {
                if (result.queued) {
                    showToast(result.message || 'Sale saved locally (Offline Mode)', 'info');
                } else {
                    showToast(`Sale completed! Invoice: ${result.invoice}`, 'success');
                }
                
                const transactionToDisplay = result.transaction || {
                    ...saleData,
                    id: Date.now(),
                    invoiceNo: result.invoice,
                    date: new Date().toLocaleDateString(),
                    time: new Date().toLocaleTimeString(),
                    itemCount: cart.reduce((s, c) => s + c.qty, 0),
                    tax: tax,
                    taxRate: traderTaxRate,
                    taxLabel: traderTaxLabel,
                    total: total,
                    discountAmount: discountAmount,
                    serviceProvider: serviceProvider.trim() || undefined,
                    serviceStation: serviceStation.trim() || undefined
                };
 
                setPrintDoc({ type: 'Receipt', data: transactionToDisplay as Transaction });

                if (!('queued' in result && (result as any).queued)) {
                    refreshData();
                }

                // If multiple tickets were open, remove the checked out ticket and switch to next
                if (tickets.length > 1) {
                    const remaining = tickets.filter(t => t.id !== activeTicketId);
                    setTickets(remaining);
                    const next = remaining[0];
                    setActiveTicketId(next.id);
                    setCart(next.cart || []);
                    setCustomerName(next.customerName || 'Walk-in Customer');
                    setPaymentMethod(next.paymentMethod || 'Cash');
                    setServiceProvider(next.serviceProvider || '');
                    setServiceStation(next.serviceStation || '');
                    if (next.venueType) setVenueType(next.venueType);
                } else {
                    setCart([]);
                    setCustomerName('Walk-in Customer');
                    setServiceProvider('');
                    setServiceStation('Counter 1');
                    setTickets([{
                        id: 'tab-1',
                        label: 'Tab #1',
                        venueType: 'general',
                        serviceProvider: '',
                        serviceStation: 'Counter 1',
                        customerName: 'Walk-in Customer',
                        cart: [],
                        paymentMethod: 'Cash',
                        createdAt: Date.now()
                    }]);
                    setActiveTicketId('tab-1');
                }
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to process sale', 'error');
        }
    };

    const isGuest = user?.username === 'Guest Client';

    if (!isTraderUser && !isGuest) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                    <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Access Restricted</h3>
                <p className="text-slate-500 max-w-md mb-8">
                    Your account does not have the required permissions to access the Point of Sale terminal. 
                    Please contact your system administrator to authorize "POS" module access.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    Security Protocol Active
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-2 md:space-y-3">
            {/* Instructional Zoom / Terminal Header - Compact & Collapsible */}
            <div className="bg-slate-900 border-l-4 border-blue-500 rounded-2xl p-3 md:px-5 md:py-3 text-white shadow-xl relative overflow-hidden animate-fade-in shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 md:gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30 shrink-0">
                            <Scan size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Primeaxis POS Terminal</span>
                                <span className="text-[9px] font-black bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-widest hidden sm:inline-block">
                                    <CheckCircle size={9} className="inline mr-1" /> Stock Sync Active
                                </span>
                            </div>
                            <h2 className="text-sm md:text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                                {isGuest ? 'Interactive POS Simulation' : 'High-Speed Transaction Engine'}
                                <span className="text-[9px] font-normal text-slate-400 hidden lg:inline">
                                    • {posProducts.length} items in catalog • {cart.reduce((s, c) => s + c.qty, 0)} items in active cart
                                </span>
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                        <div className="text-[9px] font-black bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 uppercase tracking-wider hidden md:flex items-center gap-1.5">
                            <ShieldCheck size={12} /> Tax Secure v4
                        </div>

                        {/* Mobile Tab Switcher */}
                        <div className="flex md:hidden bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                            <button
                                onClick={() => setMobileTab('products')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${mobileTab === 'products' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                            >
                                📦 Catalog
                            </button>
                            <button
                                onClick={() => setMobileTab('cart')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${mobileTab === 'cart' ? 'bg-[#6366f1] text-white' : 'text-slate-400'}`}
                            >
                                🛒 Cart ({cart.reduce((s, c) => s + c.qty, 0)})
                            </button>
                        </div>

                        <button
                            onClick={() => setIsBannerCollapsed(prev => !prev)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                            title={isBannerCollapsed ? "Show terminal details" : "Hide terminal details"}
                        >
                            {isBannerCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                    </div>
                </div>

                {!isBannerCollapsed && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-300 flex flex-col md:flex-row gap-2 justify-between animate-fade-in">
                        <p className="leading-relaxed">
                            {isGuest 
                                ? 'Interactive test mode: Click products to add items to your cart. Observe real-time stock limits, multi-currency conversion, and cloud tax synchronization.'
                                : 'Advanced multi-currency POS with offline-first synchronization. Every transaction is cryptographically signed and routed through the secure Primeaxis network.'}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">Terminal ID: PA-POS-EDGE-01 • Offline Ready</span>
                    </div>
                )}
            </div>

            {/* Multi-Customer Concurrent Service Bar (Service Center Bays, Cafe Tables, Barber Chairs, Retail Tabs) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-sm shrink-0 flex flex-col gap-2 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Layers size={14} className="text-[#6366f1]" />
                            Multi-Customer Serving:
                        </span>
                        
                        {/* Venue Type Quick Presets */}
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                            <button
                                onClick={() => { setVenueType('general'); setServiceStation('Counter 1'); }}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${venueType === 'general' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                title="General Retail Tabs"
                            >
                                <Store size={11} /> Retail
                            </button>
                            <button
                                onClick={() => { setVenueType('cafe'); setServiceStation('Table 1'); }}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${venueType === 'cafe' ? 'bg-white text-amber-800 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                title="Cafe & Restaurant Tables"
                            >
                                <Coffee size={11} /> Cafe / Tables
                            </button>
                            <button
                                onClick={() => { setVenueType('salon'); setServiceStation('Chair 1'); }}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${venueType === 'salon' ? 'bg-white text-purple-800 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                title="Salon & Barbershop Stylists"
                            >
                                <Scissors size={11} /> Salon / Chairs
                            </button>
                            <button
                                onClick={() => { setVenueType('service_center'); setServiceStation('Bay 1'); }}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${venueType === 'service_center' ? 'bg-white text-blue-800 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                title="Auto & Tech Service Center Bays"
                            >
                                <Wrench size={11} /> Service Bays
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => addNewTicket(venueType)}
                            className="bg-[#6366f1] hover:bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                            <Plus size={13} strokeWidth={3} />
                            <span>
                                {venueType === 'cafe' ? '+ Add Table' : venueType === 'salon' ? '+ Add Chair / Stylist' : venueType === 'service_center' ? '+ Add Bay / Tech' : '+ New Customer Tab'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Open Tabs Carousel */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {tickets.map((t) => {
                        const isActive = t.id === activeTicketId;
                        const ticketItemCount = t.cart?.reduce((sum: number, item: any) => sum + (item.qty || 1), 0) || 0;
                        const ticketTotal = t.cart?.reduce((sum: number, item: any) => sum + (item.price * (item.qty || 1)), 0) || 0;

                        return (
                            <div
                                key={t.id}
                                onClick={() => switchTicket(t.id)}
                                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 shrink-0 ${
                                    isActive
                                        ? 'bg-indigo-50/80 border-[#6366f1] text-slate-900 shadow-sm ring-1 ring-[#6366f1]/30'
                                        : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                                }`}
                            >
                                <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#6366f1] animate-pulse' : 'bg-slate-300'}`} />
                                        <span className="text-xs font-black">{t.label}</span>
                                        {ticketItemCount > 0 && (
                                            <span className="bg-[#6366f1] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                                                {ticketItemCount}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                        {t.serviceProvider ? (
                                            <span className="text-indigo-600 font-bold truncate max-w-[120px]">{t.serviceProvider}</span>
                                        ) : (
                                            <span className="italic text-slate-400">No attendant</span>
                                        )}
                                        {ticketTotal > 0 && (
                                            <span className="font-bold text-slate-700">&bull; {formatCurrency(ticketTotal, selectedTrader?.location)}</span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => closeTicket(t.id, e)}
                                    className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                                    title={tickets.length > 1 ? "Close tab" : "Reset tab"}
                                >
                                    <X size={12} strokeWidth={2.5} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={`flex-1 min-h-0 grid grid-cols-1 ${isCartExpanded ? 'md:grid-cols-[1.1fr_1.4fr] lg:grid-cols-[1fr_1.3fr]' : 'md:grid-cols-[2fr_1fr]'} overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white`}>
            <ReceiptModal 
                isOpen={!!printDoc} 
                onClose={() => setPrintDoc(null)} 
                transaction={printDoc?.data || null} 
                documentType={printDoc?.type}
                initialPrinterModel={printerModel}
            />
            <PrinterSettingsModal 
                isOpen={isPrinterSettingsOpen}
                onClose={() => {
                    setIsPrinterSettingsOpen(false);
                    setPrinterModel(getStoredPrinterSettings().model || 'premax_pos80c');
                }}
                onRunTestPrint={(model) => {
                    setPrinterModel(model);
                    const testTx = generateTestReceipt(model, selectedTrader?.businessName || selectedTrader?.fullName);
                    setPrintDoc({ type: 'Receipt', data: testTx });
                }}
            />
            <BarcodeScanner 
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanProduct}
                products={posProducts}
            />

            {/* Products Catalog Area */}
            <div className={`p-3 md:p-5 overflow-y-auto custom-scrollbar flex flex-col gap-3 bg-slate-50/40 h-full min-h-0 border-r border-slate-200 ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg md:text-xl tracking-tight font-black text-slate-900 flex items-center gap-2">
                            <span>📦</span> Products Catalog
                        </h3>
                        <span className="bg-slate-200/80 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {filteredPosProducts.length}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsScannerOpen(true)}
                            className="tech-button !px-2.5 !py-1.5 !text-xs whitespace-nowrap"
                            title="Scan Barcode with Camera"
                        >
                            <Scan size={14} />
                            <span className="hidden sm:inline">SCAN</span>
                        </button>
                        <div className="relative flex-1 sm:w-56 md:w-60">
                            <input 
                                type="text"
                                placeholder="Search SKU or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="tech-input !text-xs !py-1.5 !pl-8 !pr-8 w-full"
                            />
                            <svg className="absolute left-2.5 top-2.5 text-slate-400 w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                    {posProducts.length === 0 ? (
                        <div className="tech-card border-dashed border-slate-300 shadow-none flex flex-col items-center justify-center py-12 text-slate-400">
                            <Box size={40} className="mb-2 opacity-20" />
                            <p className="font-bold">No personalized stock items.</p>
                        </div>
                    ) : filteredPosProducts.length === 0 ? (
                        <div className="tech-card border-dashed border-slate-300 shadow-none flex flex-col items-center justify-center py-12 text-slate-400">
                            <Search size={40} className="mb-2 opacity-20" />
                            <p className="font-bold">No matches found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {filteredPosProducts.map(product => (
                                <div 
                                    key={product.id} 
                                    onClick={() => addToCart(product)}
                                    className="tech-card !p-3 flex justify-between items-center cursor-pointer hover:border-[#6366f1] hover:bg-indigo-50/20 group transition-all"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-[#6366f1]/10 group-hover:text-[#6366f1] transition-colors shrink-0">
                                            <Package size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-slate-900 truncate">{product.name}</div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {product.sku && (
                                                    <span className="text-[9px] text-[#6366f1] font-mono font-bold bg-indigo-50 px-1 rounded">
                                                        {product.sku}
                                                    </span>
                                                )}
                                                {product.quantity !== undefined && (
                                                    <span className={`text-[9px] font-bold ${product.quantity <= 3 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                        Stock: {product.quantity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-[#6366f1] font-black text-xs md:text-sm text-right">
                                            {formatCurrency(product.price, selectedTrader?.location)}
                                        </div>
                                        <div className="bg-slate-100 text-slate-500 w-7 h-7 rounded-lg flex items-center justify-center group-hover:bg-[#6366f1] group-hover:text-white transition-all shadow-sm">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Ordering Section (Current Cart) - Dedicated Full-Height Vertical Scrollbar spanning from top to bottom */}
            <aside 
                ref={cartScrollRef}
                className={`bg-white flex flex-col h-full min-h-0 overflow-y-scroll pos-cart-scrollbar relative ${mobileTab === 'products' ? 'hidden md:flex' : 'flex'}`}
                style={{ scrollbarGutter: 'stable' }}
            >
                {/* Cart Top Header - Sticky so current total/count stays visible */}
                <div className="sticky top-0 z-20 px-3.5 py-2.5 border-b border-slate-200 flex justify-between items-center shrink-0 bg-slate-50/95 backdrop-blur-sm shadow-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-base">🛒</span>
                        <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-900">
                            Current Cart
                        </h3>
                        <span className="bg-[#6366f1] text-white px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider shadow-sm shadow-[#6366f1]/20">
                            {cart.reduce((s, c) => s + c.qty, 0)} {cart.reduce((s, c) => s + c.qty, 0) === 1 ? 'item' : 'items'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Thermal Printer Quick Badge */}
                        <button
                            type="button"
                            onClick={() => setIsPrinterSettingsOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                            title="Active Thermal Printer • Click to configure Premax POS-80C or POS-58"
                        >
                            <Printer size={11} className="text-emerald-600" />
                            <span>{printerModel === 'pos_58' ? 'POS-58' : 'Premax 80C'}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </button>

                        {cart.length > 0 && (
                            <button 
                                onClick={() => setCart([])}
                                className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors cursor-pointer"
                                title="Clear all items in cart"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            onClick={() => setIsCartExpanded(prev => !prev)}
                            className="hidden lg:flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                            title={isCartExpanded ? "Standard width" : "Expand cart horizontally"}
                        >
                            {isCartExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                            <span>{isCartExpanded ? "Default" : "Expand"}</span>
                        </button>
                    </div>
                </div>

                {/* Customer / Merchant Switcher (Compact Bar) */}
                <div className="px-3.5 py-1.5 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between gap-2">
                    {!isTraderUser ? (
                        <div className="flex items-center gap-2 w-full">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0">Merchant:</span>
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6366f1]"
                                value={selectedTraderId}
                                onChange={(e) => setSelectedTraderId(e.target.value ? Number(e.target.value) : '')}
                            >
                                <option value="">Walk-in Customer (General Catalog)</option>
                                {activeTraders.map(t => (
                                    <option key={t.id} value={t.id}>{t.fullName} ({t.discountRate}% discount)</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-black text-slate-800 truncate flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-[#6366f1] px-1.5 py-0.5 rounded">Store</span>
                                {loggedInTrader?.businessName || loggedInTrader?.fullName}
                            </span>
                            {loggedInTrader && loggedInTrader.discountRate > 0 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black shrink-0">
                                    -{loggedInTrader.discountRate}%
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ORDERED ITEMS LIST - Seamlessly scrolls within full cart panel */}
                <div className="p-2.5 sm:p-3 space-y-2 bg-slate-50/20 shrink-0">
                    {cart.length === 0 ? (
                        <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-slate-400 gap-2.5 p-6 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                                <ShoppingBag size={28} strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 text-sm">Your order cart is empty</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Click any product in the catalog to add it to this order.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {cart.map((item, idx) => (
                                <div 
                                    key={item.id} 
                                    className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm hover:border-[#6366f1]/40 transition-all group"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 font-mono">#{idx + 1}</span>
                                                <span className="font-black text-slate-900 text-xs truncate block" title={item.name}>
                                                    {item.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-[#6366f1]">
                                                    {formatCurrency(item.price, selectedTrader?.location)}
                                                </span>
                                                {item.sku && (
                                                    <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-100 px-1 rounded">
                                                        {item.sku}
                                                    </span>
                                                )}
                                                {selectedTrader && item.quantity !== undefined && (
                                                    <span className="text-[8px] font-bold text-slate-400">
                                                        avail: {item.quantity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Total for this line item */}
                                        <div className="text-right shrink-0">
                                            <div className="font-black text-slate-900 text-xs sm:text-sm">
                                                {formatCurrency(item.price * item.qty, selectedTrader?.location)}
                                            </div>
                                            <button 
                                                onClick={() => removeFromCart(item.id)} 
                                                className="text-slate-300 hover:text-rose-500 transition-colors p-0.5 mt-0.5 cursor-pointer"
                                                title="Remove item"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stepper controls */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                                            <button 
                                                onClick={() => updateQty(item.id, -1)} 
                                                className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-all active:scale-90 cursor-pointer"
                                                title="Decrease quantity"
                                            >
                                                <Minus size={11} strokeWidth={3} />
                                            </button>
                                            <span className="w-8 text-center font-black text-xs text-slate-900">{item.qty}</span>
                                            <button 
                                                onClick={() => updateQty(item.id, 1)} 
                                                className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-slate-600 transition-all active:scale-90 cursor-pointer"
                                                title="Increase quantity"
                                            >
                                                <Plus size={11} strokeWidth={3} />
                                            </button>
                                        </div>

                                        <div className="text-[10px] text-slate-400 font-medium">
                                            {item.qty} × {formatCurrency(item.price, selectedTrader?.location)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* COMPACT, HIGH-EFFICIENCY CHECKOUT & ORDERING FOOTER - Fully scrollable with bottom padding */}
                <div className="mt-auto p-3 sm:px-4 sm:py-3 bg-slate-50 border-t border-slate-200 shrink-0 shadow-sm space-y-3 pb-12">
                    {/* Price Summary Breakdown */}
                    <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500 font-bold uppercase tracking-wider">Subtotal ({cart.reduce((s, c) => s + c.qty, 0)} items)</span>
                            <span className="font-bold text-slate-800">{formatCurrency(subtotal, selectedTrader?.location)}</span>
                        </div>
                        {discountRate > 0 && (
                            <div className="flex justify-between text-[11px] text-emerald-600 font-bold">
                                <span className="uppercase tracking-wider">Trader Discount ({discountRate}%)</span>
                                <span>-{formatCurrency(discountAmount, selectedTrader?.location)}</span>
                            </div>
                        )}
                        {traderTaxRate > 0 && tax > 0 ? (
                            <div className="flex justify-between text-[11px] text-slate-700 font-bold">
                                <span className="uppercase tracking-wider">{traderTaxLabel} ({traderTaxRate}%)</span>
                                <span>+{formatCurrency(tax, selectedTrader?.location)}</span>
                            </div>
                        ) : (
                            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                <span className="uppercase tracking-wider">Sales Tax</span>
                                <span>0% (Tax Exempt / Configured in Trader Settings)</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                            <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                                Total Due
                            </span>
                            <span className="text-base sm:text-lg font-black text-[#6366f1]">
                                {formatCurrency(total, selectedTrader?.location)}
                            </span>
                        </div>
                    </div>

                    {/* Thermal Printer Hardware Status Banner */}
                    <div className="bg-slate-900 text-white rounded-xl p-2.5 flex items-center justify-between border border-slate-800 shadow-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <Printer size={14} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-white truncate">
                                        {printerModel === 'pos_58' ? 'POS-58 Mini (58mm)' : 'Premax POS-80C (80mm)'}
                                    </span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                </div>
                                <p className="text-[8.5px] text-slate-400 truncate">
                                    {printerModel === 'pos_58' 
                                        ? '32-Col Continuous Roll • Tear-Bar Mode' 
                                        : '48-Col Continuous Roll • Auto Guillotine Cutter'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    const testTx = generateTestReceipt(printerModel, selectedTrader?.businessName || selectedTrader?.fullName);
                                    setPrintDoc({ type: 'Receipt', data: testTx });
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[9px] font-bold uppercase transition border border-slate-700 cursor-pointer"
                                title="Instant Test Print on active thermal printer"
                            >
                                Test
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrinterSettingsOpen(true)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-black uppercase transition shadow-sm cursor-pointer flex items-center gap-1"
                                title="Configure Thermal Printer"
                            >
                                <Sliders size={10} />
                                <span>Config</span>
                            </button>
                        </div>
                    </div>

                    {/* Service Provider & Station / Table (Appears on Customer's Bill) */}
                    <div className="space-y-2 pt-1 border-t border-slate-200/80 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/60">
                        {/* Service Provider Input with Quick Chips */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[9px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    <UserCheck size={11} className="text-[#6366f1]" />
                                    Service Provider / Stylist / Server:
                                </label>
                                <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                                    Prints on bill & receipt
                                </span>
                            </div>
                            <input 
                                type="text" 
                                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#6366f1]" 
                                placeholder={venueType === 'salon' ? 'e.g. Grace (Stylist)' : venueType === 'cafe' ? 'e.g. Kevin (Server)' : venueType === 'service_center' ? 'e.g. Alex (Technician)' : 'Attendant / Provider Name'} 
                                value={serviceProvider} 
                                onChange={e => {
                                    setServiceProvider(e.target.value);
                                    setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, serviceProvider: e.target.value } : t));
                                }} 
                            />
                            {/* Quick Suggestion Chips */}
                            <div className="flex flex-wrap gap-1 mt-1">
                                {providerSuggestions.slice(0, 4).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => {
                                            setServiceProvider(p);
                                            setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, serviceProvider: p } : t));
                                        }}
                                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                            serviceProvider === p 
                                                ? 'bg-[#6366f1] text-white border-[#6366f1] font-bold' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Station / Table & Tab Label */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">
                                    {venueType === 'cafe' ? 'Table / Seating' : venueType === 'salon' ? 'Chair / Station' : venueType === 'service_center' ? 'Service Bay' : 'Station / Counter'}
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6366f1]" 
                                    placeholder={venueType === 'cafe' ? 'Table 1' : venueType === 'salon' ? 'Chair 1' : 'Station'} 
                                    value={serviceStation} 
                                    onChange={e => {
                                        setServiceStation(e.target.value);
                                        setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, serviceStation: e.target.value } : t));
                                    }} 
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Tab Label</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6366f1]" 
                                    value={tickets.find(t => t.id === activeTicketId)?.label || 'Tab #1'} 
                                    onChange={e => updateCurrentTicketLabel(e.target.value)} 
                                />
                            </div>
                        </div>

                        {/* Customer & Method Selectors */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Customer Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6366f1]" 
                                    placeholder="Walk-in Customer" 
                                    value={customerName} 
                                    onChange={e => {
                                        setCustomerName(e.target.value);
                                        setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, customerName: e.target.value } : t));
                                    }} 
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Payment Method</label>
                                <select 
                                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#6366f1]" 
                                    value={paymentMethod} 
                                    onChange={e => {
                                        setPaymentMethod(e.target.value);
                                        setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, paymentMethod: e.target.value as any } : t));
                                    }}
                                >
                                    <option>Cash</option>
                                    <option>M-Pesa</option>
                                    <option>Card</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons & Finalize Sales Payment */}
                    <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-4 gap-1.5">
                            <button 
                                onClick={() => handlePrintPreview('Bill')} 
                                className="py-2 px-1 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-amber-800 hover:bg-amber-100 transition text-center cursor-pointer shadow-xs"
                                title="Print Proforma Bill & Statement on Thermal Printer"
                            >
                                🧾 Bill
                            </button>
                            <button 
                                onClick={() => handlePrintPreview('Invoice')} 
                                className="py-2 px-1 bg-indigo-50 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-indigo-800 hover:bg-indigo-100 transition text-center cursor-pointer shadow-xs"
                                title="Print Fiscal Tax Invoice"
                            >
                                📄 Invoice
                            </button>
                            <button 
                                onClick={() => handlePrintPreview('Receipt')} 
                                className="py-2 px-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100 transition text-center cursor-pointer shadow-xs"
                                title="Print Official Sales Receipt"
                            >
                                🖨️ Receipt
                            </button>
                            <button 
                                onClick={() => setCart([])} 
                                className="py-2 px-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition text-center cursor-pointer shadow-xs"
                                title="Clear Cart"
                            >
                                ✕ Clear
                            </button>
                        </div>

                        <button 
                            onClick={handleCheckout} 
                            disabled={cart.length === 0}
                            className="tech-button w-full !py-3 !text-xs sm:!text-sm shadow-md shadow-[#6366f1]/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <span>FINALIZE SALE & PAYMENT</span>
                            <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
                                {formatCurrency(total, selectedTrader?.location)}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Floating Quick Scroll Navigation Buttons */}
                {canScrollDown && (
                    <button
                        type="button"
                        onClick={scrollToCartBottom}
                        className="sticky bottom-3 self-end mr-3 px-3 py-1.5 bg-[#6366f1] hover:bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-xl flex items-center gap-1.5 z-30 transition animate-bounce cursor-pointer border border-white/20"
                        title="Scroll down to Payment & Bill buttons"
                    >
                        <ArrowDown size={12} strokeWidth={3} />
                        <span>Scroll to Pay & Bill</span>
                    </button>
                )}

                {isScrolledDown && (
                    <button
                        type="button"
                        onClick={scrollToCartTop}
                        className="sticky bottom-3 self-start ml-3 px-2.5 py-1 bg-slate-900/90 hover:bg-slate-950 text-white rounded-full text-[9px] font-bold tracking-wider shadow-lg flex items-center gap-1 z-30 transition cursor-pointer border border-slate-700"
                        title="Scroll back to top of Cart"
                    >
                        <ArrowUp size={11} />
                        <span>Top of Cart</span>
                    </button>
                )}
            </aside>
        </div>
    </div>
    );
};

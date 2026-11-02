export interface Product {
    id: number;
    name: string;
    price: number;
    costPrice?: number;
    icon: string;
    code: string;
    sku?: string;
    barcode?: string;
    category?: string;
    brand?: string;
    model?: string;
    uom?: string;
    wholesalePrice?: number;
    retailPrice?: number;
    taxCategory?: string;
    taxRate?: number;
    supplier?: string;
    manufacturer?: string;
    countryOfOrigin?: string;
    images?: string[];
    description?: string;
    quantity?: number;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: string;
    monthlyFee?: number;
    icon: string;
    features: string;
    popular?: boolean;
    memberLimit: number;
    productLimit: number;
    userLimit?: number;
    stockLimit?: number;
    vendorLimit?: number;
    allowVendors?: boolean;
    vendorSalesRoleDelegation?: boolean;
    stockLimitDesc?: string;
    userLimitDesc?: string;
    setupFee?: number;
    crmFee?: number;
    totalInitial?: number;
    // Premium Modules (50% of base subscription fee each)
    financeModulePrice?: number;
    taxModulePrice?: number;
    productionModulePrice?: number;
    hrModulePrice?: number;
    moduleSubscriptionSurcharge?: number;
}

// ============================================================
// FINANCE MODULE
// ============================================================

export interface Account {
    id: number;
    traderId: number;
    code: string;
    name: string;
    type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
    category: string;
    description?: string;
    balance: number;
    isSystem?: boolean;
    createdAt?: string;
}

export interface JournalEntry {
    id: number;
    traderId: number;
    date: string;
    reference: string;
    description: string;
    lines: JournalLine[];
    status?: 'draft' | 'posted';
    createdAt?: string;
}

export interface JournalLine {
    id?: number;
    entryId?: number;
    accountId: number;
    accountName: string;
    debit: number;
    credit: number;
}

export interface FinancialDocument {
    id: number;
    traderId: number;
    type: 'Invoice' | 'Bill' | 'Receipt' | 'Payment';
    documentNo: string;
    partnerName: string; // Customer or Supplier
    partnerId?: number;
    date: string;
    dueDate?: string;
    items: any[];
    subtotal: number;
    tax: number;
    total: number;
    balance: number;
    status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'void';
    notes?: string;
    createdAt: string;
}

// ============================================================
// TAX COMPLIANCE MODULE
// ============================================================

export type TaxAgency = 'KRA' | 'URA' | 'RRA' | 'OBR' | 'ERCA' | 'TRA' | 'DGI' | 'DJI' | 'ZRA' | 'NamRA' | 'BURS' | 'EIRA' | 'SSNRA';

export interface TaxRegime {
    id: number;
    country: string;
    agency: TaxAgency;
    currency: string;
    vatRates: { label: string; rate: number }[];
    withholdingRates?: { label: string; rate: number }[];
    isEFRISRequired?: boolean; // Uganda
    isTIMSRequired?: boolean; // Kenya
    isVSDURequired?: boolean; // Rwanda
}

export interface TaxTransaction {
    id: number;
    traderId: number;
    date: string;
    type: 'Sales' | 'Purchase';
    referenceNo: string;
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
    taxRate: number;
    taxCategory: string;
    agencyResponse?: string; // Electronic seal/QR data
    status: 'pending' | 'filed' | 'error';
}

export interface Trader {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    location: string;
    businessName: string;
    taxId: string;
    plan: string;
    status: string;
    discountRate: number;
    pendingDiscountRate?: number;
    discountStatus?: string;
    customerSince: string;
    joined: string;
    // Printer output settings
    receiptHeader?: string;
    receiptFooter?: string;
    showLogo?: boolean;
    showBusinessName?: boolean;
    showLocation?: boolean;
    showPhone?: boolean;
    showTaxId?: boolean;
    showDiscount?: boolean;
    logoUrl?: string;
    // POS Document Architect tax configuration applied to sales
    taxRate?: number; // Configured percentage tax applied on sales (e.g. 16 for 16% VAT)
    applyTax?: boolean; // Whether sales tax is calculated and applied on sales
    taxLabel?: string; // Tax name/label e.g. 'VAT', 'Sales Tax', 'GST'
    serverIp?: string;
    serverPort?: number;
    backupPath?: string;
    lastBackupAt?: string;
    distributorId?: number | null;
    passwordHash?: string;
    isCashier?: boolean;
    financeActive?: boolean;
    taxActive?: boolean;
    productionActive?: boolean;
    hrActive?: boolean;
    taxRegimeCountry?: string;
    filingPeriod?: 'Monthly' | 'Quarterly' | 'Bi-Annual' | 'Annual';
    subscriptionExpiresAt?: string; // ISO date string e.g. '2026-09-06'
    subscriptionMonths?: number; // Chosen duration in months (e.g. 1, 6, 12)
    subscriptionDiscountRate?: number; // Duration discount rate (e.g. 2.5% for 6 mo, 5% for 1 yr)
    autoRenew?: boolean;
    // Data Localization & Dual Backup
    clientIp?: string;
    localizationIp?: string;
    lastBackupIp?: string;
    lastCloudBackupAt?: string;
    dualBackupActive?: boolean;
    // App Admin Two-Axis Tenant Isolation & Provisioning Engine
    tenantId?: string;
    tenantCode?: string;
    schemaName?: string;
    subscriptionTier?: string;
    maxUsers?: number;
    locationLimit?: number;
    billingStatus?: string;
    isolationTier?: string;
    dbPartitionPath?: string;
    initialPassword?: string;
    passwordResetRequired?: boolean;
    teamMembers?: OnboardingTeamMemberInput[];
}

export interface TenantRecord {
    tenant_id: string;
    tenant_name: string;
    schema_name: string;
    created_at: string;
    owner_user_id?: string;
    owner_email?: string;
    owner_name?: string;
    member_count?: number;
    views_active?: boolean;
    rls_active?: boolean;
}

export interface TenantMembership {
    membership_id: string;
    tenant_id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: 'owner' | 'manager' | 'cashier' | 'inventory' | 'accountant' | string;
    status: 'active' | 'invited' | 'suspended' | 'removed';
    invited_by?: string | null;
    created_at: string;
    updated_at: string;
}

export interface TenantAuditLogEntry {
    id: number;
    tenant_id: string;
    actor_id: string;
    actor_email?: string;
    action: string;
    target?: string;
    detail?: string;
    created_at: string;
}

export interface TenantRoleMatrix {
    roles: Record<string, { label: string; desc: string }>;
    roleOrder: string[];
    permissions: Record<string, string[]>;
    allPermissions: string[];
}

export interface TenantBackupRecord {
    id: number;
    traderId: number;
    backupType: 'dual' | 'local' | 'cloud';
    localPath?: string;
    cloudUrl?: string;
    fileSizeBytes?: number;
    status: 'success' | 'failed' | 'partial';
    tenantIp: string;
    serverIp?: string;
    checksum?: string;
    createdAt: string;
    details?: string;
    recordCounts?: Record<string, number>;
}

export interface RenewalNotificationInfo {
    traderId: number;
    traderName: string;
    businessName: string;
    location: string;
    planName: string;
    monthlyFeeUSD: number;
    monthlyFeeLocal: number;
    currencySymbol: string;
    currencyCode: string;
    expiryDate: Date;
    expiryDateFormatted: string;
    daysRemaining: number;
    isDueSoon: boolean; // within 7 days
    isUrgent: boolean;  // within 3 days
    isOverdue: boolean; // <= 0 days
    statusLabel: string;
    statusSeverity: 'urgent' | 'warning' | 'normal' | 'overdue';
    financeActive?: boolean;
    taxActive?: boolean;
    productionActive?: boolean;
    hrActive?: boolean;
}

export interface InventoryItem {
    id: number;
    traderId?: number | null;
    
    // Product Information
    name: string;
    sku: string;
    barcode?: string;
    category?: string;
    brand?: string;
    model?: string;
    uom?: string; // Unit of Measure
    
    // Pricing
    costPrice: number;
    unitPrice: number; // Selling Price
    wholesalePrice?: number;
    retailPrice?: number;
    taxCategory?: string;
    taxRate?: number;
    
    // Stock & Sourcing
    quantity: number;
    stock?: number;
    reorderLevel: number;
    supplier: string;
    manufacturer?: string;
    countryOfOrigin?: string;
    
    // Media & Details
    images?: string[];
    description?: string;
    distributorId?: number | null;
    location?: string;
    tenantId?: string;
}

export interface CartItem extends Product {
    qty: number;
}

export interface TransactionItem {
    id: number;
    name: string;
    price: number;
    costPrice?: number;
    icon?: string;
    qty: number;
    code?: string;
    sku?: string;
}

export interface Transaction {
    id: number;
    date: string;
    time: string;
    traderId: number | null;
    traderName: string;
    businessName: string;
    customerName: string;
    customerPhone?: string;
    paymentMethod: string;
    items: TransactionItem[];
    itemCount: number;
    subtotal: number;
    discountRate: number;
    discountAmount: number;
    tax: number;
    taxRate?: number; // Applied percentage tax rate
    taxLabel?: string; // Tax label e.g. 'VAT'
    total: number;
    invoiceNo: string;
    cashierName?: string;
    serviceProvider?: string; // Stylist, Barber, Waiter/Server, Technician
    serviceStation?: string;  // Table number, Chair number, Station name, or Ticket label
    status?: 'completed' | 'voided' | 'refunded' | 'returned';
    statusReason?: string;
    statusUpdatedAt?: string;
    statusUpdatedBy?: string;
    refundAmount?: number;
    notes?: string;
}

export type ServiceVenueType = 'general' | 'cafe' | 'salon' | 'service_center';

export interface PosTicket {
    id: string;
    label: string;             // e.g. "Table 1", "Chair 3", "Ticket #1"
    venueType: ServiceVenueType;
    serviceProvider: string;   // e.g. "Grace (Stylist)", "David (Barber)", "Kevin (Server)"
    serviceStation: string;    // e.g. "Table #4", "Chair #2", "Bay 1"
    customerName: string;
    customerPhone?: string;
    notes?: string;
    cart: any[];
    paymentMethod: 'Cash' | 'M-Pesa' | 'Card' | 'Credit';
    createdAt: number;
}

export interface Stats {
    totalSales: number;
    totalDiscounts: number;
    transactionCount: number;
    uniqueTraders: number;
}

export interface MemberPermissions {
    pos: boolean;
    inventory: boolean;
    production: boolean;
    finance: boolean;
    tax: boolean;
    reports: boolean;
    hr: boolean;
    regime: boolean;
    traders: boolean;
    manage_team?: boolean;
    approve_commissions?: boolean;
    onboard?: boolean;
    system?: boolean;
}

export interface User {
    id?: string | number;
    username: string;
    fullName?: string;
    role: string;
    traderId?: number | null;
    location?: string;
    financeActive?: boolean;
    taxActive?: boolean;
    productionActive?: boolean;
    hrActive?: boolean;
    permissions?: MemberPermissions;
    tenantId?: string;
    slug?: string;
    passwordResetRequired?: boolean;
}

export interface InteropRequest {
    id: number;
    traderId?: number;
    requesterId: number;
    providerId: number;
    itemName: string;
    sku: string;
    quantity: number;
    price: number;
    status: 'pending' | 'approved' | 'rejected' | 'shipped' | 'received';
    notes?: string;
    poNumber?: string;
    grnNumber?: string;
    createdAt: string;
    updatedAt: string;
    // Expanded for UI
    requesterBusiness?: string;
    providerBusiness?: string;
}

export interface PurchaseOrder {
    id: number;
    poNumber: string;
    requestId: number;
    requesterId: number;
    providerId: number;
    items: {
        name: string;
        sku: string;
        quantity: number;
        price: number;
    }[];
    total: number;
    status: 'draft' | 'issued' | 'fulfilled';
    createdAt: string;
}

export interface GoodsReceiptNote {
    id: number;
    grnNumber: string;
    requestId: number;
    requesterId: number;
    providerId: number;
    items: {
        name: string;
        sku: string;
        quantityReceived: number;
        price: number;
    }[];
    receivedBy: string;
    receivedDate: string;
    status: 'pending' | 'completed';
}

export interface BillingInvoice {
    id: number;
    traderId: number;
    invoiceNo: string;
    amount: number;
    planName: string;
    status: 'paid' | 'pending' | 'failed';
    billingDate: string;
    dueDate: string;
    paymentMethod?: string;
    createdAt: string;
}

export type TenantRole = 
    | 'tenant_admin'
    | 'owner' 
    | 'manager' 
    | 'cashier' 
    | 'standard_user'
    | 'sales_agent' 
    | 'stock_controller' 
    | 'accountant' 
    | 'production_supervisor' 
    | 'hr'
    | 'service_provider' 
    | 'supervisor' 
    | 'custom'
    | 'staff';

export interface TraderMember {
    id: number;
    traderId: number;
    tenantId?: string;
    userId?: number;
    username: string;
    email?: string;
    fullName?: string;
    phone?: string;
    role: TenantRole | string;
    permissions?: MemberPermissions;
    passwordResetRequired?: boolean;
    initialPassword?: string;
    sellingPointId?: string;
    commissionRate?: number;
    commissionType?: 'percentage' | 'fixed';
    status?: 'active' | 'inactive' | 'suspended';
    createdAt: string;
    lastLogin?: string;
    createdBy?: string;
}

export interface OnboardingTeamMemberInput {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    role: TenantRole | string;
    permissions: MemberPermissions;
    initialPassword?: string;
    passwordResetRequired?: boolean;
}

export interface RoleDefinition {
    id: string;
    title: string;
    badge: string;
    color: string;
    description: string;
    responsibilities: string[];
    defaultPermissions: MemberPermissions;
}

export const TENANT_ROLE_DEFINITIONS: RoleDefinition[] = [
    {
        id: 'owner',
        title: 'Business Owner / Admin',
        badge: 'Owner',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        description: 'Complete administrative authority over the entire merchant business, team members, billing, and modules.',
        responsibilities: ['Full module access', 'Team & role management', 'Commission approvals', 'System audit trail'],
        defaultPermissions: {
            pos: true, inventory: true, production: true, finance: true, tax: true, 
            reports: true, hr: true, regime: true, traders: true, manage_team: true, approve_commissions: true
        }
    },
    {
        id: 'manager',
        title: 'Branch / Store Manager',
        badge: 'Manager',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: 'Oversees day-to-day storefront operations, inventory adjustments, sales floor, production, and staff supervision.',
        responsibilities: ['Store operations', 'Staff supervision', 'Stock receiving & reorders', 'Sales reports & commission approval'],
        defaultPermissions: {
            pos: true, inventory: true, production: true, finance: false, tax: false, 
            reports: true, hr: true, regime: true, traders: true, manage_team: true, approve_commissions: true
        }
    },
    {
        id: 'cashier',
        title: 'Cashier & POS Terminal Operator',
        badge: 'Cashier',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Handles customer checkout, registers, receipt generation, payment collection, and daily till cash flow.',
        responsibilities: ['Fast POS checkout', 'Receipt printing', 'Cash & M-Pesa processing', 'Shift sales review'],
        defaultPermissions: {
            pos: true, inventory: false, production: false, finance: false, tax: false, 
            reports: false, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
        }
    },
    {
        id: 'sales_agent',
        title: 'Sales Representative / Floor Associate',
        badge: 'Sales Rep',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: 'Assists customers, processes sales on the floor, consults stock availability, and earns direct sales attribution.',
        responsibilities: ['Customer sales', 'Product catalog lookup', 'Order creation', 'Personal sales tracking'],
        defaultPermissions: {
            pos: true, inventory: true, production: false, finance: false, tax: false, 
            reports: false, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
        }
    },
    {
        id: 'stock_controller',
        title: 'Inventory & Stock Controller',
        badge: 'Stock Clerk',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        description: 'Dedicated to stock intaking, counts, SKU verification, reorder thresholds, supplier deliveries, and barcode maintenance.',
        responsibilities: ['Catalog management', 'Stock adjustments & audits', 'Supplier PO/GRN receiving', 'Low-stock monitoring'],
        defaultPermissions: {
            pos: false, inventory: true, production: true, finance: false, tax: false, 
            reports: true, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
        }
    },
    {
        id: 'accountant',
        title: 'Accountant / Finance Officer',
        badge: 'Accountant',
        color: 'bg-teal-100 text-teal-800 border-teal-200',
        description: 'Manages bookkeeping, general ledger, payment settlements, expenses, tax filings, and monthly financial statements.',
        responsibilities: ['General ledger & journals', 'Receivables & payables', 'Tax compliance & returns', 'Financial reporting'],
        defaultPermissions: {
            pos: false, inventory: false, production: false, finance: true, tax: true, 
            reports: true, hr: true, regime: false, traders: false, manage_team: false, approve_commissions: true
        }
    },
    {
        id: 'production_supervisor',
        title: 'Production Floor Supervisor / Master Artisan',
        badge: 'Production',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        description: 'Manages raw material ingredients, production batches, labour logs, recipe formulation, and unit costing.',
        responsibilities: ['Batch execution', 'Ingredient tracking', 'Labour cost allocation', 'Finished goods output'],
        defaultPermissions: {
            pos: false, inventory: true, production: true, finance: false, tax: false, 
            reports: true, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
        }
    },
    {
        id: 'service_provider',
        title: 'Service Specialist / Technician / Stylist',
        badge: 'Specialist',
        color: 'bg-rose-100 text-rose-800 border-rose-200',
        description: 'Delivers client services in salons, barber shops, repair centers, or dining, associating tasks with commissions.',
        responsibilities: ['Service delivery', 'Assigned service station', 'Client consultation', 'Earned commission tracking'],
        defaultPermissions: {
            pos: true, inventory: false, production: false, finance: false, tax: false, 
            reports: false, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
        }
    },
    {
        id: 'supervisor',
        title: 'Floor Supervisor',
        badge: 'Supervisor',
        color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        description: 'Floor supervision across cashiers and stock, authorizing cashier discounts, and reviewing day-end sales.',
        responsibilities: ['Floor monitoring', 'Discount authorizations', 'Daily shift review', 'Stock overview'],
        defaultPermissions: {
            pos: true, inventory: true, production: false, finance: false, tax: false, 
            reports: true, hr: false, regime: true, traders: false, manage_team: false, approve_commissions: false
        }
    },
    {
        id: 'custom',
        title: 'Custom Role',
        badge: 'Custom',
        color: 'bg-slate-100 text-slate-800 border-slate-200',
        description: 'Fully customized role where permissions are uniquely tailored for this specific individual.',
        responsibilities: ['Custom defined responsibilities'],
        defaultPermissions: {
            pos: true, inventory: false, production: false, finance: false, tax: false, 
            reports: false, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
        }
    }
];

export interface VendorRequest {
    id: number;
    traderId: number;
    businessName: string;
    category: string;
    status: 'pending' | 'approved' | 'rejected';
    adminNotes?: string;
    createdAt: string;
}

export interface VendorCommission {
    id: number;
    vendorId: number;
    distributorId: number;
    type: 'transaction_value' | 'sales_target';
    rate: number; // percentage or fixed amount
    targetValue?: number; // for sales_target
    currentProgress?: number;
    status: 'active' | 'completed' | 'cancelled';
    awardedAmount: number;
    createdAt: string;
    updatedAt: string;
}

export interface DiscountProposal {
    id: number;
    vendorId: number;
    distributorId: number;
    productId?: number;
    category?: string;
    discountRate: number;
    type: 'bulk' | 'wholesale';
    quantityThreshold: number;
    status: 'pending' | 'approved' | 'rejected';
    adminNotes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLog {
    id: number;
    timestamp: string;
    traderId?: number | null;
    traderName?: string;
    username: string;
    userRole?: string;
    role?: string;
    action: string;
    details: any;
    severity?: 'info' | 'warning' | 'critical';
}

export interface CurrencyInfo {
    code: string;
    symbol: string;
}

export function getCurrencyByLocation(location: string | undefined): CurrencyInfo {
    if (!location) return { code: 'KES', symbol: 'KSh' };
    const loc = location.toLowerCase().trim();
    if (loc.includes('uganda') || loc.includes('kampala') || loc.includes('entebbe') || loc.includes('jinja')) {
        return { code: 'UGX', symbol: 'USh' };
    }
    if (loc.includes('tanzania') || loc.includes('dar es salaam') || loc.includes('arusha') || loc.includes('dodoma')) {
        return { code: 'TZS', symbol: 'TSh' };
    }
    if (loc.includes('rwanda') || loc.includes('kigali') || loc.includes('gisenyi')) {
        return { code: 'RWF', symbol: 'RFr' };
    }
    if (loc.includes('burundi') || loc.includes('bujumbura') || loc.includes('gitega') || loc.includes('muramvya') || loc.includes('muramvia')) {
        return { code: 'BIF', symbol: 'FBu' };
    }
    if (loc.includes('usa') || loc.includes('united states') || loc.includes('america') || loc.includes('new york') || loc.includes('washington')) {
        return { code: 'USD', symbol: '$' };
    }
    if (loc.includes('uk') || loc.includes('united kingdom') || loc.includes('london') || loc.includes('england') || loc.includes('great britain')) {
        return { code: 'GBP', symbol: '£' };
    }
    if (loc.includes('europe') || loc.includes('france') || loc.includes('germany') || loc.includes('berlin') || loc.includes('paris')) {
        return { code: 'EUR', symbol: '€' };
    }
    if (loc.includes('zambia') || loc.includes('lusaka')) {
        return { code: 'ZMW', symbol: 'ZK' };
    }
    if (loc.includes('namibia') || loc.includes('windhoek')) {
        return { code: 'NAD', symbol: 'N$' };
    }
    if (loc.includes('botswana') || loc.includes('gaborone')) {
        return { code: 'BWP', symbol: 'P' };
    }
    if (loc.includes('eritrea') || loc.includes('asmara')) {
        return { code: 'ERN', symbol: 'Nfk' };
    }
    if (loc.includes('south sudan') || loc.includes('juba')) {
        return { code: 'SSP', symbol: 'SSP' };
    }
    return { code: 'KES', symbol: 'KSh' };
}

export function formatCurrency(amount: number, location?: string): string {
    const currency = getCurrencyByLocation(location);
    return `${currency.symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyNoDecimals(amount: number, location?: string): string {
    const currency = getCurrencyByLocation(location);
    return `${currency.symbol} ${Math.round(amount).toLocaleString()}`;
}

// ============================================================
// PRODUCTION MODULE (SME Production Management)
// ============================================================

export type ProductionStatus = 'draft' | 'in_progress' | 'completed' | 'approved' | 'cancelled';

export interface Ingredient {
    id: number;
    trader_id?: number;
    name: string;
    cost_per_unit: number;
    unit: string;
    current_stock: number;
    reorder_level: number;
    created_at?: string;
}

export interface RawMaterialUsage {
    id?: number;
    batch_id?: number;
    ingredient_id: number;
    ingredient_name: string;
    quantity_used: number;
    cost: number;
    unit?: string;
}

export interface LabourCost {
    id?: number;
    batch_id?: number;
    employee_name: string;
    hours_worked: number;
    hourly_rate: number;
    total_cost: number;
    role: string;
}

export interface OverheadCost {
    id?: number;
    batch_id?: number;
    category: string;
    amount: number;
    description: string;
    cost_type?: 'utility' | 'facility' | 'maintenance' | 'packaging' | 'logistics' | 'compliance' | 'other';
    bill_reference?: string;
    units_consumed?: number;
    unit_rate?: number;
    unit_measure?: string;
    billing_period?: string;
}

export interface ProductionOverheadPreset {
    category: string;
    label: string;
    cost_type: 'utility' | 'facility' | 'maintenance' | 'packaging' | 'logistics' | 'compliance' | 'other';
    default_unit?: string;
    icon: string;
    suggested_description: string;
}

export const PRODUCTION_OVERHEAD_CATEGORIES: ProductionOverheadPreset[] = [
    { category: 'Electricity Bill', label: 'Electricity / Power Bill', cost_type: 'utility', default_unit: 'kWh', icon: 'zap', suggested_description: 'Grid power & 3-phase machinery consumption' },
    { category: 'Water Bill', label: 'Water / Process Utility', cost_type: 'utility', default_unit: 'm³', icon: 'droplet', suggested_description: 'Municipal water & industrial wash/boiler feed' },
    { category: 'Fuel / Gas / Generator', label: 'Fuel / Gas / Generator', cost_type: 'utility', default_unit: 'Litres', icon: 'fuel', suggested_description: 'Generator diesel / LPG gas cylinders / furnace fuel' },
    { category: 'Packaging Materials', label: 'Packaging & Finishing', cost_type: 'packaging', default_unit: 'units', icon: 'package', suggested_description: 'Outer cartons, sealing tape, shrink wrap & barcodes' },
    { category: 'Machinery Maintenance', label: 'Equipment Maintenance & Tooling', cost_type: 'maintenance', default_unit: 'hours', icon: 'wrench', suggested_description: 'Machine lubricants, blade sharpening & routine upkeep' },
    { category: 'Facility Rent Allocation', label: 'Facility Rent / Lease Share', cost_type: 'facility', default_unit: 'days', icon: 'building', suggested_description: 'Factory workshop & storage floor lease allocation' },
    { category: 'Transport & Logistics', label: 'Transport, Freight & Hauling', cost_type: 'logistics', default_unit: 'trips', icon: 'truck', suggested_description: 'Raw material haulage & distribution logistics' },
    { category: 'Quality Control & Lab Testing', label: 'QA / Lab Testing & Compliance', cost_type: 'compliance', default_unit: 'assays', icon: 'flask', suggested_description: 'Microbial assay, moisture testing & certification stamps' },
    { category: 'Waste & Environmental Disposal', label: 'Waste Disposal & Effluent Levy', cost_type: 'compliance', default_unit: 'loads', icon: 'trash', suggested_description: 'Industrial waste collection & environmental compliance fees' },
    { category: 'PPE & Consumables', label: 'Safety, PPE & Cleaning Consumables', cost_type: 'other', default_unit: 'sets', icon: 'shield', suggested_description: 'Gloves, masks, hairnets & sanitizing detergents' },
    { category: 'Other Associated Cost', label: 'Other Operational Associated Cost', cost_type: 'other', default_unit: 'units', icon: 'more', suggested_description: 'Miscellaneous operational batch expense' }
];

export interface ProductionBatch {
    id: number;
    trader_id?: number;
    batch_number: string;
    product_id: number;
    product_name: string;
    quantity_produced: number;
    total_cost: number;
    cost_per_unit: number;
    production_date: string;
    responsible_user: string;
    status: ProductionStatus;
    notes?: string;
    approved_by?: string;
    approved_at?: string;
    materials_count?: number;
    workers_count?: number;
    raw_materials?: RawMaterialUsage[];
    labour_costs?: LabourCost[];
    overhead_costs?: OverheadCost[];
}

export interface ProductionSummary {
    total_batches: number;
    total_cost: number;
    total_quantity: number;
    avg_cost_per_unit: number;
    draft_batches: number;
}

export interface ProductionRecipe {
    id: number;
    trader_id?: number;
    name: string;
    product_id?: number;
    product_name?: string;
    target_quantity: number;
    description?: string;
    created_at?: string;
    ingredients?: {
        ingredient_id: number;
        ingredient_name?: string;
        quantity: number;
        unit?: string;
        cost_per_unit?: number;
    }[];
    overheads?: OverheadCost[];
}

// ============================================================
// HUMAN RESOURCES (HR) & PAYROLL MODULE
// ============================================================

export type EmployeeDepartment = 
    | 'Sales & POS' 
    | 'Inventory & Logistics' 
    | 'Accounts & Finance' 
    | 'Production & Workshop' 
    | 'Administration' 
    | 'Customer Support';

export type EmployeeRole = 
    | 'cashier' 
    | 'manager' 
    | 'supervisor' 
    | 'clerk' 
    | 'technician' 
    | 'staff';

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Casual';
export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';

export interface Employee {
    id: number;
    traderId?: number;
    employeeNo: string;
    fullName: string;
    email: string;
    phone: string;
    nationalId: string;
    gender?: 'Male' | 'Female' | 'Other';
    dateOfBirth?: string;
    residence?: string;
    kraPin?: string;
    nssfNo?: string;
    nhifNo?: string;
    department: EmployeeDepartment;
    jobTitle: string;
    role: EmployeeRole;
    status: EmployeeStatus;
    hireDate: string;
    employmentType: EmploymentType;
    workStation?: string;
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    commissionRate?: number; // % on sales
    paymentMethod: 'Bank Transfer' | 'M-Pesa' | 'Cash';
    bankName?: string;
    bankAccountNo?: string;
    mpesaPhone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    avatarUrl?: string;
    annualLeaveEntitlement?: number;
    annualLeaveTaken?: number;
}

export interface AttendanceRecord {
    id: number;
    employeeId: number;
    employeeName: string;
    traderId?: number;
    date: string;
    clockInTime: string;
    clockOutTime?: string;
    shift: 'Morning (07:00-15:00)' | 'Evening (13:00-21:00)' | 'Full Day (08:00-17:00)' | 'Night (20:00-06:00)';
    workstation?: string;
    hoursWorked?: number;
    overtimeHours?: number;
    status: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave';
    notes?: string;
}

export interface PayrollSlip {
    id: number;
    slipNo: string;
    employeeId: number;
    employeeName: string;
    employeeNo?: string;
    department?: string;
    jobTitle?: string;
    kraPin?: string;
    nssfNo?: string;
    nhifNo?: string;
    traderId?: number;
    periodMonth: string;
    periodYear: number;
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    overtimePay: number;
    commissionPay: number;
    grossPay: number;
    payeTax: number;
    nssfDeduction: number;
    nhifDeduction: number;
    housingLevy: number; // 1.5%
    otherDeductions: number;
    totalDeductions: number;
    netPay: number;
    paymentStatus: 'draft' | 'approved' | 'paid';
    paymentDate?: string;
    paymentReference?: string;
    paymentMethod: string;
    currency?: string;
}

export interface LeaveRequest {
    id: number;
    employeeId: number;
    employeeName: string;
    department?: string;
    traderId?: number;
    leaveType: 'Annual Leave' | 'Sick Leave' | 'Maternity / Paternity' | 'Compassionate' | 'Study Leave' | 'Unpaid Leave';
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    handoverTo?: string;
    status: 'pending' | 'approved' | 'rejected';
    appliedOn: string;
    approvedBy?: string;
    approvedOn?: string;
    managerNotes?: string;
}

export interface PerformanceReview {
    id: number;
    employeeId: number;
    employeeName: string;
    jobTitle?: string;
    traderId?: number;
    reviewPeriod: string;
    salesVolume?: number;
    transactionsHandled?: number;
    punctualityScore: number; // 1-5
    customerServiceScore: number; // 1-5
    accuracyScore: number; // 1-5
    teamworkScore: number; // 1-5
    overallRating: number; // 1-5
    strengths: string;
    areasForImprovement: string;
    goals: string;
    reviewer: string;
    date: string;
}

export interface HRDocument {
    id: number;
    title: string;
    category: 'Contract' | 'Policy' | 'ID & Compliance' | 'Warning / Letter' | 'Training';
    employeeId?: number;
    employeeName?: string;
    traderId?: number;
    fileSize: string;
    uploadDate: string;
    expiryDate?: string;
    status: 'valid' | 'expiring_soon' | 'expired';
    downloadUrl?: string;
}

// ============================================================
// THERMAL PRINTER SETTINGS (Premax POS-80C & POS-58)
// ============================================================

export type ThermalPrinterModel = 'premax_pos80c' | 'pos_58' | 'a4';

export interface PrinterSettings {
    model: ThermalPrinterModel;
    printerName?: string;
    paperWidth: '80mm' | '58mm' | 'a4';
    autoCutter: boolean; // Supported on Premax POS-80C
    cashDrawerKick: boolean; // Pin 2 or Pin 5 pulse
    printCopies: number;
    fontSize: 'compact' | 'normal' | 'large';
    openDrawerOnSale?: boolean;
    headerText?: string;
    footerText?: string;
    autoPrintOnSale?: boolean;
    interfaceType?: 'browser' | 'web_serial' | 'web_bluetooth';
}

// ============================================================
// TENANT MULTI-USER & SUBSCRIPTION SYNCHRONIZATION TYPES
// ============================================================

export type TenantUserRole = 
    | 'tenant_admin'
    | 'manager'
    | 'accountant'
    | 'storekeeper'
    | 'production_officer'
    | 'salesperson'
    | 'cashier'
    | 'service_provider'
    | 'owner'
    | 'sales_agent'
    | 'stock_controller'
    | 'production_supervisor'
    | 'supervisor'
    | 'staff';




export interface TenantSeatStats {
    maxUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalRegistered: number;
    remainingSeats: number;
    isAtLimit: boolean;
    isOverLimit: boolean;
    locationLimit: number;
    plan: string;
    subscriptionTier: string;
    billingStatus: string;
    subscriptionExpiresAt?: string;
    tenantCode?: string;
}

export interface TenantUserDetails {
    id: number;
    traderId: number;
    tenantId?: string;
    username: string;
    email: string;
    fullName: string;
    phone?: string;
    role: TenantUserRole;
    permissions?: MemberPermissions | null;
    sellingPointId?: string;
    commissionRate?: number;
    commissionType?: string;
    status: 'active' | 'suspended';
    createdAt: string;
    lastLogin?: string;
    createdBy?: string;
    seatStats?: TenantSeatStats;
}

export interface OnboardingTenantSummary {
    id: number;
    tenantCode: string;
    businessName: string;
    ownerName: string;
    ownerEmail: string;
    phone: string;
    location: string;
    taxId: string;
    plan: string;
    subscriptionTier: string;
    billingStatus: string;
    status: 'active' | 'expired' | 'suspended';
    subscriptionStartDate: string;
    subscriptionExpiresAt: string;
    daysRemaining: number;
    isExpired: boolean;
    isDueSoon: boolean;
    seatAllowance: {
        maxUsers: number;
        activeUsers: number;
        suspendedUsers: number;
        totalRegistered: number;
        remainingSeats: number;
        isAtLimit: boolean;
        isOverLimit: boolean;
    };
    locationLimit: number;
    modules: {
        finance: boolean;
        tax: boolean;
        production: boolean;
        hr: boolean;
    };
    users: TenantUserDetails[];
}

export interface PlatformOnboardingDashboard {
    success: boolean;
    summary: {
        totalTenants: number;
        activeTenantsCount: number;
        expiredTenantsCount: number;
        platformTotalPermittedSeats: number;
        platformTotalActiveUsers: number;
        platformCapacityUtilizationRate: number;
        tenantsOverLimitCount: number;
    };
    tenants: OnboardingTenantSummary[];
    timestamp: string;
}

// Client Onboarding & Isolated DB Types (Python reference implementation)
export interface ClientWorkspace {
    id: string; // tenant_id
    business_name: string;
    slug: string;
    owner_email: string;
    db_path: string;
    workspace_token_hash: string;
    workspace_token?: string;
    your_private_workspace_link: string;
    created_at: string;
    user_count?: number;
    db_size_bytes?: number;
    status?: string;
}

export interface ClientInvitePayload {
    email: string;
    fullName?: string;
    phone?: string;
    password: string;
    role?: 'Owner' | 'Manager' | 'Cashier' | 'Staff' | 'Accountant' | 'Stock Controller' | 'Supervisor';
    sellingPointId?: string;
    permissions?: MemberPermissions | Record<string, boolean>;
    passwordResetRequired?: boolean;
}

export interface ClientRegisterPayload {
    business_name: string;
    owner_email: string;
    password: string;
    location?: string;
    phone?: string;
    team_members?: ClientInvitePayload[];
}

export interface ClientTenantUser {
    id: string;
    email: string;
    fullName?: string;
    phone?: string;
    role: string;
    tenant_id: string;
    sellingPointId?: string;
    permissions?: MemberPermissions | Record<string, boolean>;
    passwordResetRequired?: boolean;
    initialPassword?: string;
    createdAt?: string;
    status?: 'active' | 'suspended';
}

export interface ClientRegisterResponse {
    message: string;
    tenant_id: string;
    slug: string;
    business_name: string;
    db_path: string;
    your_private_workspace_link: string;
    workspace_token: string;
    instruction: string;
    domiciled_accounts?: ClientTenantUser[];
}

export interface Step1LoginResponse {
    message: string;
    next: string;
    pending_token: string;
    user: {
        id: string;
        email: string;
        role: string;
        tenant_id: string;
        slug: string;
        fullName?: string;
        full_name?: string;
        password_reset_required?: boolean;
        passwordResetRequired?: boolean;
        permissions?: MemberPermissions | Record<string, boolean>;
    };
}

export interface Step2LoginResponse {
    message: string;
    dashboard: string;
    tenant_id: string;
    slug: string;
    session_token?: string;
    user: {
        id: string;
        email: string;
        role: string;
        tenant_id: string;
        slug: string;
        fullName?: string;
        full_name?: string;
        password_reset_required?: boolean;
        passwordResetRequired?: boolean;
        permissions?: MemberPermissions | Record<string, boolean>;
    };
}


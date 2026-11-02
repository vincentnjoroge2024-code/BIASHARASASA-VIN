import { 
    MemberPermissions, TenantUserRole, TENANT_ROLE_DEFINITIONS 
} from './types';

export const TENANT_AVAILABLE_MODULES = [
    { id: 'pos', label: 'Point of Sale (POS)', icon: 'Receipt', badge: 'Core', description: 'Retail checkout & receipting' },
    { id: 'inventory', label: 'Inventory Control', icon: 'Box', badge: 'Core', description: 'Stock levels & SKU management' },
    { id: 'production', label: 'Production / SME', icon: 'Zap', badge: 'Add-on', isAddon: 'production', description: 'Raw materials & batch costing' },
    { id: 'finance', label: 'Finance & Accounts', icon: 'DollarSign', badge: 'Add-on', isAddon: 'finance', description: 'General ledger & journal entries' },
    { id: 'tax', label: 'Tax Compliance', icon: 'ShieldCheck', badge: 'Add-on', isAddon: 'tax', description: 'Tax reports & regime settings' },
    { id: 'hr', label: 'HR & Payroll', icon: 'Users', badge: 'Add-on', isAddon: 'hr', description: 'Employee records & attendance' },
    { id: 'reports', label: 'Advanced Analytics', icon: 'BarChart', badge: 'Core', description: 'Deep scannable business insights' },
    { id: 'regime', label: 'Tax Regime Setup', icon: 'Globe', badge: 'Core', description: 'Country-specific tax rules' },
    { id: 'traders', label: 'Merchant Network', icon: 'Building', badge: 'Core', description: 'B2B interop & supply chain' },
    { id: 'manage_team', label: 'Team Management', icon: 'Users', badge: 'Admin', description: 'Create & manage staff accounts' },
    { id: 'approve_commissions', label: 'Commission Approval', icon: 'CheckCircle', badge: 'Admin', description: 'Approve sales team commissions' }
];

export function normalizeTenantRole(role: string): TenantUserRole {
    const r = (role || '').toLowerCase().replace(/\s+/g, '_');
    const valid: TenantUserRole[] = [
        'tenant_admin', 'manager', 'accountant', 'storekeeper', 
        'production_officer', 'salesperson', 'cashier', 'service_provider',
        'owner', 'sales_agent', 'stock_controller', 'production_supervisor', 'supervisor', 'staff'
    ];
    if (valid.includes(r as TenantUserRole)) return r as TenantUserRole;
    if (r.includes('admin') || r.includes('owner')) return 'owner';
    if (r.includes('manager')) return 'manager';
    if (r.includes('cashier')) return 'cashier';
    return 'staff' as TenantUserRole;
}

export function getDefaultPermissionsForRole(role: string): MemberPermissions {
    const r = normalizeTenantRole(role);
    const def = TENANT_ROLE_DEFINITIONS.find(d => d.id === r);
    if (def) return { ...def.defaultPermissions };
    
    // Hardcoded fallback for roles not in ROLE_DEFINITIONS but in TenantUserRole
    if (r === 'tenant_admin' || r === 'owner') {
        return {
            pos: true, inventory: true, production: true, finance: true, tax: true,
            reports: true, hr: true, regime: true, traders: true, manage_team: true, approve_commissions: true
        };
    }
    
    return {
        pos: true, inventory: false, production: false, finance: false, tax: false,
        reports: false, hr: false, regime: false, traders: false, manage_team: false, approve_commissions: false
    };
}

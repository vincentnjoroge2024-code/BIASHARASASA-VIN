import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Building2, Database, KeyRound, ShieldCheck, UserPlus, Users, Copy, Check, 
    ExternalLink, RefreshCw, Lock, Mail, Globe, ArrowRight, Sparkles, AlertCircle,
    Eye, EyeOff, FileText, CheckCircle2, ChevronRight, Terminal, QrCode, X, Search,
    Download, ShieldAlert, Cpu, Share2, Printer, Trash2, Plus, Sliders, Shield,
    FileSpreadsheet, Layers, CheckSquare, Phone, BadgeCheck, UserCheck, Key, ChevronDown,
    ChevronUp, Store, Briefcase, UserX
} from 'lucide-react';
import { useAppContext } from '../../context';
import * as api from '../../api';
import { ClientWorkspace, ClientTenantUser, Step1LoginResponse } from '../../types';
import { LoginSlipModal, LoginSlipContent } from '../LoginSlipModal';
import { transferPreviewToPrinter } from '../../utils/printEngine';

interface PreProvisionMember {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: 'Manager' | 'Cashier' | 'Staff' | 'Accountant' | 'Supervisor' | 'Stock Controller';
    sellingPointId: string;
    password: string;
    permissions: Record<string, boolean>;
}

// 8 Granular Module Permissions
const RBAC_MODULES = [
    { key: 'pos', name: 'POS & Cash Till', desc: 'Process customer checkouts, print thermal receipts, scan barcodes' },
    { key: 'inventory', name: 'Inventory & Receiving', desc: 'Manage stock catalog, log GRNs, adjust reorder thresholds' },
    { key: 'production', name: 'Production & Batches', desc: 'Track raw ingredients, batch recipes, compute unit cost' },
    { key: 'finance', name: 'General Ledger & Accounts', desc: 'Post journal entries, chart of accounts, bank reconciliations' },
    { key: 'tax', name: 'Tax & Compliance', desc: 'KRA/VAT rate configurations and export fiscal reports' },
    { key: 'reports', name: 'Analytics & Reports', desc: 'View revenue charts, margin analysis, and sales summaries' },
    { key: 'hr', name: 'Staff & Shift Logs', desc: 'Record attendance, clock-in/out, and shift assignments' },
    { key: 'system', name: 'System & Local Sync', desc: 'Configure dual offline backup, thermal printers, and network IP' }
];

const DEFAULT_ROLE_PERMS: Record<string, Record<string, boolean>> = {
    Owner: { pos: true, inventory: true, production: true, finance: true, tax: true, reports: true, hr: true, system: true },
    Manager: { pos: true, inventory: true, production: true, finance: false, tax: false, reports: true, hr: true, system: false },
    Cashier: { pos: true, inventory: false, production: false, finance: false, tax: false, reports: false, hr: false, system: false },
    Accountant: { pos: false, inventory: false, production: false, finance: true, tax: true, reports: true, hr: false, system: false },
    Supervisor: { pos: true, inventory: true, production: false, finance: false, tax: false, reports: true, hr: true, system: false },
    'Stock Controller': { pos: false, inventory: true, production: true, finance: false, tax: false, reports: false, hr: false, system: false },
    Staff: { pos: true, inventory: false, production: false, finance: false, tax: false, reports: false, hr: false, system: false }
};

export const ClientOnboardingTab: React.FC = () => {
    const { showToast, logAuditAction } = useAppContext();

    // Module Sub-Tabs
    const [subTab, setSubTab] = useState<'onboard' | 'workspaces' | 'team' | 'verify'>('onboard');

    // Onboarding Form State
    const [businessName, setBusinessName] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [location, setLocation] = useState('Nairobi');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const batchPrintRef = useRef<HTMLDivElement>(null);
    const [isPrintingAll, setIsPrintingAll] = useState(false);

    const handlePrintAllSlips = async () => {
        if (!createdWorkspace?.domiciled_accounts || !batchPrintRef.current) return;
        setIsPrintingAll(true);
        showToast('Preparing batch welcome vouchers for all team members...', 'info');
        
        try {
            await transferPreviewToPrinter(batchPrintRef.current, {
                format: '80mm',
                model: 'premax_pos80c',
                documentTitle: `Welcome_Vouchers_${createdWorkspace.slug}`
            });
            showToast('All welcome vouchers sent to printer!', 'success');
        } catch (e) {
            window.print();
        } finally {
            setIsPrintingAll(false);
        }
    };

    // Pre-provisioning Team Roster (Step 1)
    const [teamPreset, setTeamPreset] = useState<'retail' | 'wholesale' | 'solo' | 'custom'>('retail');
    const [preProvisionMembers, setPreProvisionMembers] = useState<PreProvisionMember[]>([
        {
            id: 'pre-1',
            fullName: 'Branch Operations Lead',
            email: 'manager@store.com',
            phone: '+254 711 000 001',
            role: 'Manager',
            sellingPointId: 'STATION-MGR',
            password: 'Staff@2026',
            permissions: DEFAULT_ROLE_PERMS.Manager
        },
        {
            id: 'pre-2',
            fullName: 'Front Desk Cashier 1',
            email: 'cashier1@store.com',
            phone: '+254 711 000 002',
            role: 'Cashier',
            sellingPointId: 'POS-TILL-01',
            password: 'Staff@2026',
            permissions: DEFAULT_ROLE_PERMS.Cashier
        },
        {
            id: 'pre-3',
            fullName: 'Front Desk Cashier 2',
            email: 'cashier2@store.com',
            phone: '+254 711 000 003',
            role: 'Cashier',
            sellingPointId: 'POS-TILL-02',
            password: 'Staff@2026',
            permissions: DEFAULT_ROLE_PERMS.Cashier
        },
        {
            id: 'pre-4',
            fullName: 'Inventory Storekeeper',
            email: 'inventory@store.com',
            phone: '+254 711 000 004',
            role: 'Stock Controller',
            sellingPointId: 'STOO-RECEIVING',
            password: 'Staff@2026',
            permissions: DEFAULT_ROLE_PERMS['Stock Controller']
        }
    ]);

    // Latest Provisioned Workspace Result
    const [createdWorkspace, setCreatedWorkspace] = useState<{
        tenant_id: string;
        slug: string;
        business_name: string;
        db_path: string;
        your_private_workspace_link: string;
        workspace_token: string;
        instruction: string;
        domiciled_accounts?: ClientTenantUser[];
    } | null>(null);

    // Workspaces List
    const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
    const [workspaceSearch, setWorkspaceSearch] = useState('');

    // Team Invite & Management State (Tab 3)
    const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState<string>('');
    const [teamInjectionMode, setTeamInjectionMode] = useState<'single' | 'batch'>('single');
    
    // Single Invite Inputs
    const [teamFullName, setTeamFullName] = useState('');
    const [teamEmail, setTeamEmail] = useState('');
    const [teamPhone, setTeamPhone] = useState('');
    const [teamPassword, setTeamPassword] = useState('');
    const [teamRole, setTeamRole] = useState<'Cashier' | 'Manager' | 'Staff' | 'Accountant' | 'Supervisor' | 'Stock Controller'>('Cashier');
    const [teamSellingPoint, setTeamSellingPoint] = useState('POS-TILL-01');
    const [teamPermissions, setTeamPermissions] = useState<Record<string, boolean>>(DEFAULT_ROLE_PERMS.Cashier);
    const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false);
    const [isInviting, setIsInviting] = useState(false);

    // Batch CSV Inputs
    const [batchCsvText, setBatchCsvText] = useState(
        'Amina Mwangi, amina@biashara.co.ke, Cashier, POS-TILL-03, +254722000111\nDaniel Mutua, daniel@biashara.co.ke, Accountant, FIN-DESK-01, +254722000222'
    );
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    // Active Team in Database
    const [teamUsers, setTeamUsers] = useState<ClientTenantUser[]>([]);
    const [isLoadingTeam, setIsLoadingTeam] = useState(false);
    const [teamSearch, setTeamSearch] = useState('');

    // Printable Welcome Slip Modal
    const [selectedSlipUser, setSelectedSlipUser] = useState<ClientTenantUser | null>(null);

    // 2-Step Login Validator State
    const [testSlug, setTestSlug] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [testPassword, setTestPassword] = useState('');
    const [step1Result, setStep1Result] = useState<Step1LoginResponse | null>(null);
    const [testWorkspaceLink, setTestWorkspaceLink] = useState('');
    const [isTestingStep1, setIsTestingStep1] = useState(false);
    const [isTestingStep2, setIsTestingStep2] = useState(false);
    const [step2Success, setStep2Success] = useState<any | null>(null);

    // Copy Feedback
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Live Slug Sanitizer Calculation (matching Python sanitize_slug)
    const sanitizedSlugPreview = useMemo(() => {
        const base = (businessName || '').toLowerCase().trim();
        const clean = base.replace(/[^a-z0-9\s-]/g, '').replace(/[-\s]+/g, '-');
        return clean ? `${clean}-xxxx` : 'your-biashara-xxxx';
    }, [businessName]);

    // Copy to clipboard helper
    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        showToast('Copied to clipboard!', 'info');
        setTimeout(() => setCopiedKey(null), 2500);
    };

    // Password generator helper
    const generateSecurePass = (prefix: string = 'Staff') => {
        const num = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}@${num}`;
    };

    const generatePassword = () => {
        const nouns = ['Biashara', 'Mauzo', 'Duka', 'Soko', 'Stoo', 'Fedha'];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const gen = generateSecurePass(noun);
        setPassword(gen);
        showToast('Generated secure owner password', 'info');
    };

    const generateTeamPassword = () => {
        setTeamPassword(generateSecurePass('Staff'));
        showToast('Generated team member password', 'info');
    };

    // Preset selector handler for Step 1
    const applyTeamPreset = (preset: 'retail' | 'wholesale' | 'solo' | 'custom') => {
        setTeamPreset(preset);
        const domain = sanitizedSlugPreview.replace('-xxxx', '') || 'biashara';
        if (preset === 'retail') {
            setPreProvisionMembers([
                { id: 'pre-1', fullName: 'Store Operations Manager', email: `manager@${domain}.com`, phone: '+254 711 000 001', role: 'Manager', sellingPointId: 'STATION-MGR', password: generateSecurePass('Mgr'), permissions: DEFAULT_ROLE_PERMS.Manager },
                { id: 'pre-2', fullName: 'Front Desk Cashier 1', email: `cashier1@${domain}.com`, phone: '+254 711 000 002', role: 'Cashier', sellingPointId: 'POS-TILL-01', password: generateSecurePass('Cashier'), permissions: DEFAULT_ROLE_PERMS.Cashier },
                { id: 'pre-3', fullName: 'Front Desk Cashier 2', email: `cashier2@${domain}.com`, phone: '+254 711 000 003', role: 'Cashier', sellingPointId: 'POS-TILL-02', password: generateSecurePass('Cashier'), permissions: DEFAULT_ROLE_PERMS.Cashier },
                { id: 'pre-4', fullName: 'Inventory Stock Controller', email: `inventory@${domain}.com`, phone: '+254 711 000 004', role: 'Stock Controller', sellingPointId: 'STOO-RECEIVING', password: generateSecurePass('Stock'), permissions: DEFAULT_ROLE_PERMS['Stock Controller'] }
            ]);
        } else if (preset === 'wholesale') {
            setPreProvisionMembers([
                { id: 'pre-1', fullName: 'Wholesale Dispatch Lead', email: `dispatch@${domain}.com`, phone: '+254 722 000 001', role: 'Supervisor', sellingPointId: 'DISPATCH-DOCK', password: generateSecurePass('Lead'), permissions: DEFAULT_ROLE_PERMS.Supervisor },
                { id: 'pre-2', fullName: 'Accounts & Tax Accountant', email: `finance@${domain}.com`, phone: '+254 722 000 002', role: 'Accountant', sellingPointId: 'FIN-DESK', password: generateSecurePass('Fin'), permissions: DEFAULT_ROLE_PERMS.Accountant },
                { id: 'pre-3', fullName: 'Commercial Sales Rep', email: `sales@${domain}.com`, phone: '+254 722 000 003', role: 'Cashier', sellingPointId: 'WHOLESALE-COUNTER', password: generateSecurePass('Sales'), permissions: DEFAULT_ROLE_PERMS.Cashier }
            ]);
        } else if (preset === 'solo') {
            setPreProvisionMembers([]);
        } else if (preset === 'custom') {
            if (preProvisionMembers.length === 0) {
                setPreProvisionMembers([
                    { id: 'pre-custom-1', fullName: 'First Associate', email: `team1@${domain}.com`, phone: '', role: 'Cashier', sellingPointId: 'POS-TILL-01', password: generateSecurePass('Staff'), permissions: DEFAULT_ROLE_PERMS.Cashier }
                ]);
            }
        }
    };

    // Add row to pre-provisioning roster
    const handleAddPreProvisionRow = () => {
        const domain = sanitizedSlugPreview.replace('-xxxx', '') || 'biashara';
        const num = preProvisionMembers.length + 1;
        setPreProvisionMembers(prev => [
            ...prev,
            {
                id: `pre-custom-${Date.now()}`,
                fullName: `Staff Associate ${num}`,
                email: `staff${num}@${domain}.com`,
                phone: '',
                role: 'Cashier',
                sellingPointId: `POS-TILL-${num.toString().padStart(2, '0')}`,
                password: generateSecurePass('Staff'),
                permissions: DEFAULT_ROLE_PERMS.Cashier
            }
        ]);
        setTeamPreset('custom');
    };

    const handleRemovePreProvisionRow = (id: string) => {
        setPreProvisionMembers(prev => prev.filter(m => m.id !== id));
        setTeamPreset('custom');
    };

    const handleUpdatePreProvisionRow = (id: string, field: keyof PreProvisionMember, value: any) => {
        setPreProvisionMembers(prev => prev.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, [field]: value };
            if (field === 'role' && DEFAULT_ROLE_PERMS[value]) {
                updated.permissions = DEFAULT_ROLE_PERMS[value];
            }
            return updated;
        }));
    };

    // Fetch workspaces list
    const loadWorkspaces = async () => {
        setIsLoadingWorkspaces(true);
        try {
            const res = await api.getClientWorkspaces();
            setWorkspaces(res.workspaces || []);
            if (res.workspaces?.length > 0 && !selectedWorkspaceSlug) {
                setSelectedWorkspaceSlug(res.workspaces[0].slug);
            }
        } catch (e: any) {
            console.error('Failed to load workspaces:', e);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    };

    // Load team for selected slug
    const loadTeam = async (slug: string) => {
        if (!slug) return;
        setIsLoadingTeam(true);
        try {
            const res = await api.getClientWorkspaceTeam(slug);
            setTeamUsers(res.users || []);
        } catch (e: any) {
            console.error('Failed to load team:', e);
            setTeamUsers([]);
        } finally {
            setIsLoadingTeam(false);
        }
    };

    useEffect(() => {
        loadWorkspaces();
    }, []);

    useEffect(() => {
        if (selectedWorkspaceSlug) {
            loadTeam(selectedWorkspaceSlug);
        }
    }, [selectedWorkspaceSlug]);

    // Handle Role change in Single Member form
    const handleRoleSelect = (role: 'Cashier' | 'Manager' | 'Staff' | 'Accountant' | 'Supervisor' | 'Stock Controller') => {
        setTeamRole(role);
        setTeamPermissions(DEFAULT_ROLE_PERMS[role] || DEFAULT_ROLE_PERMS.Staff);
    };

    // Handle Client Onboard Submit
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!businessName.trim() || !ownerEmail.trim() || !password.trim()) {
            showToast('Please fill all required fields: Business Name, Email, Password', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const teamPayload = preProvisionMembers.map(m => ({
                email: m.email.trim().toLowerCase(),
                fullName: m.fullName.trim(),
                phone: m.phone.trim(),
                password: m.password.trim(),
                role: m.role,
                sellingPointId: m.sellingPointId.trim(),
                permissions: m.permissions,
                passwordResetRequired: true
            }));

            const response = await api.registerClientBiashara({
                business_name: businessName.trim(),
                owner_email: ownerEmail.trim().toLowerCase(),
                password: password.trim(),
                location: location.trim(),
                phone: phone.trim(),
                team_members: teamPayload
            });

            setCreatedWorkspace(response);
            showToast(`🎉 Isolated Biashara "${response.business_name}" provisioned with ${response.domiciled_accounts?.length || 1} team accounts!`, 'success');
            
            if (logAuditAction) {
                await logAuditAction(
                    'Client Biashara Onboarded',
                    `Provisioned client "${response.business_name}" (${response.slug}) with dedicated SQLite DB at ${response.db_path} and ${response.domiciled_accounts?.length || 1} domiciled accounts`
                ).catch(() => {});
            }

            // Refresh workspaces list
            await loadWorkspaces();
            setSelectedWorkspaceSlug(response.slug);

            // Pre-fill validator fields for quick testing
            setTestSlug(response.slug);
            setTestEmail(ownerEmail.trim().toLowerCase());
            setTestPassword(password.trim());
            setTestWorkspaceLink(response.your_private_workspace_link);
        } catch (e: any) {
            showToast(e.message || 'Failed to onboard client biashara', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Invite Single Team Member
    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWorkspaceSlug) {
            showToast('Please select a biashara workspace', 'error');
            return;
        }
        if (!teamEmail.trim() || !teamPassword.trim()) {
            showToast('Please provide team member email and temporary password', 'error');
            return;
        }

        setIsInviting(true);
        try {
            const res = await api.inviteClientTeamMember(selectedWorkspaceSlug, {
                fullName: teamFullName.trim() || teamEmail.split('@')[0],
                email: teamEmail.trim().toLowerCase(),
                phone: teamPhone.trim(),
                password: teamPassword.trim(),
                role: teamRole,
                sellingPointId: teamSellingPoint.trim(),
                permissions: teamPermissions,
                passwordResetRequired: true
            });
            showToast(res.message, 'success');
            setTeamFullName('');
            setTeamEmail('');
            setTeamPhone('');
            setTeamPassword('');
            await loadTeam(selectedWorkspaceSlug);
            await loadWorkspaces();
        } catch (e: any) {
            showToast(e.message || 'Failed to invite team member', 'error');
        } finally {
            setIsInviting(false);
        }
    };

    // Handle Batch CSV Provisioning
    const handleBatchCsvSubmit = async () => {
        if (!selectedWorkspaceSlug) {
            showToast('Please select a biashara workspace', 'error');
            return;
        }
        const lines = batchCsvText.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
        if (lines.length === 0) {
            showToast('Please provide at least one member CSV line', 'error');
            return;
        }

        setIsBatchProcessing(true);
        let successCount = 0;
        let errors: string[] = [];

        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length < 2) continue;
            const [name, email, role = 'Cashier', station = 'POS-01', phone = ''] = parts;
            const validRole = (['Manager', 'Cashier', 'Staff', 'Accountant', 'Supervisor', 'Stock Controller'].includes(role) ? role : 'Cashier') as any;
            const autoPass = generateSecurePass('Staff');

            try {
                await api.inviteClientTeamMember(selectedWorkspaceSlug, {
                    fullName: name,
                    email: email.toLowerCase(),
                    phone: phone,
                    password: autoPass,
                    role: validRole,
                    sellingPointId: station,
                    permissions: DEFAULT_ROLE_PERMS[validRole] || DEFAULT_ROLE_PERMS.Staff,
                    passwordResetRequired: true
                });
                successCount++;
            } catch (err: any) {
                errors.push(`${email}: ${err.message}`);
            }
        }

        setIsBatchProcessing(false);
        if (successCount > 0) {
            showToast(`Provisioned ${successCount} team member accounts into isolated DB!`, 'success');
            await loadTeam(selectedWorkspaceSlug);
            await loadWorkspaces();
        }
        if (errors.length > 0) {
            showToast(`Some accounts failed: ${errors.join(', ')}`, 'warning');
        }
    };

    // Revoke / Delete Team Member from Tenant DB
    const handleRevokeMember = async (targetUser: ClientTenantUser) => {
        if (targetUser.role === 'Owner') {
            showToast('The Primary Tenant Administrator (Owner) cannot be revoked.', 'error');
            return;
        }
        const confirmMsg = `Are you sure you want to revoke and delete ${targetUser.fullName || targetUser.email} from the isolated database for ${selectedWorkspaceSlug}? All session access will terminate immediately.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            await api.removeClientTeamMember(selectedWorkspaceSlug, targetUser.id);
            showToast(`Revoked ${targetUser.email} from tenant boundary.`, 'success');
            await loadTeam(selectedWorkspaceSlug);
            await loadWorkspaces();
        } catch (e: any) {
            showToast(e.message || 'Failed to revoke team member', 'error');
        }
    };

    // Regenerate link
    const handleRegenerateLink = async (slug: string) => {
        try {
            const res = await api.regenerateClientWorkspaceLink(slug);
            showToast(res.message, 'success');
            await loadWorkspaces();
            if (createdWorkspace && createdWorkspace.slug === slug) {
                setCreatedWorkspace(prev => prev ? {
                    ...prev,
                    your_private_workspace_link: res.your_private_workspace_link,
                    workspace_token: res.workspace_token
                } : null);
            }
        } catch (e: any) {
            showToast(e.message || 'Failed to regenerate link', 'error');
        }
    };

    // Copy Complete Credentials Manifest (CSV / Text)
    const handleCopyAllCredentials = () => {
        if (!createdWorkspace) return;
        const ws = createdWorkspace;
        let text = `==========================================================\n`;
        text += `BIASHARA TENANT CREDENTIALS & DOMICILE MANIFEST\n`;
        text += `==========================================================\n`;
        text += `Business Name: ${ws.business_name}\n`;
        text += `Tenant ID:     ${ws.tenant_id}\n`;
        text += `Slug:          ${ws.slug}\n`;
        text += `Database Path: ${ws.db_path}\n`;
        text += `Workspace Link:${ws.your_private_workspace_link}\n`;
        text += `----------------------------------------------------------\n`;
        text += `DOMICILED ACCOUNTS ROSTER (password_reset_required: true)\n`;
        text += `----------------------------------------------------------\n`;
        
        if (ws.domiciled_accounts && ws.domiciled_accounts.length > 0) {
            ws.domiciled_accounts.forEach((acc, i) => {
                text += `[${i + 1}] Role: ${acc.role.toUpperCase()} | Station: ${acc.sellingPointId || 'HQ'}\n`;
                text += `    Name:     ${acc.fullName || '—'}\n`;
                text += `    Email:    ${acc.email}\n`;
                text += `    Password: ${acc.initialPassword || '[Master Password Entered]'}\n`;
                text += `    Reset Required on 1st Login: ${acc.passwordResetRequired ? 'YES' : 'NO'}\n\n`;
            });
        }
        text += `==========================================================\n`;
        text += `Notice: Accounts are bound by foreign key tenant_id to db_${ws.slug}.db\n`;

        handleCopy(text, 'full_manifest');
    };

    // Step 1 Login Test
    const handleStep1Test = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testEmail || !testPassword || !testSlug) {
            showToast('Email, password, and slug required for Step 1', 'error');
            return;
        }
        setIsTestingStep1(true);
        setStep1Result(null);
        setStep2Success(null);
        try {
            const res = await api.clientLoginStep1({
                email: testEmail.trim().toLowerCase(),
                password: testPassword.trim(),
                slug: testSlug.trim()
            });
            setStep1Result(res);
            showToast('Step 1 Validated! Now paste your Private Workspace Link', 'success');
        } catch (e: any) {
            showToast(e.message || 'Step 1 login failed', 'error');
        } finally {
            setIsTestingStep1(false);
        }
    };

    // Step 2 Login Test
    const handleStep2Test = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!step1Result?.pending_token) {
            showToast('Please complete Step 1 first', 'error');
            return;
        }
        if (!testWorkspaceLink.trim()) {
            showToast('Workspace link required', 'error');
            return;
        }
        setIsTestingStep2(true);
        try {
            const res = await api.clientLoginStep2({
                workspace_link: testWorkspaceLink.trim(),
                pending_token: step1Result.pending_token
            });
            setStep2Success(res);
            showToast(`🎉 Access Granted to ${res.slug}!`, 'success');
        } catch (e: any) {
            showToast(e.message || 'Step 2 link validation failed', 'error');
        } finally {
            setIsTestingStep2(false);
        }
    };

    const filteredWorkspaces = workspaces.filter(w => 
        w.business_name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
        w.slug.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
        w.owner_email.toLowerCase().includes(workspaceSearch.toLowerCase())
    );

    const filteredTeamUsers = teamUsers.filter(u => 
        u.email.toLowerCase().includes(teamSearch.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase().includes(teamSearch.toLowerCase())) ||
        u.role.toLowerCase().includes(teamSearch.toLowerCase()) ||
        (u.sellingPointId && u.sellingPointId.toLowerCase().includes(teamSearch.toLowerCase()))
    );

    const selectedWorkspace = workspaces.find(w => w.slug === selectedWorkspaceSlug);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Top Architecture Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-800/40">
                <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="max-w-3xl space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                            <Cpu size={14} className="animate-pulse" />
                            Multi-Tenant Isolated DB & Team Domicile Engine
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                            Client Onboarding & Tenant Account Provisioning
                        </h1>
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                            Complete tenant provisioning pipeline: dedicated SQLite database file (<code className="text-emerald-400 font-mono">db_&lt;slug&gt;.db</code>), root administrator initialization, pre-provisioned team rosters with foreign key <code className="text-blue-300 font-mono">tenant_id</code> isolation, granular RBAC matrices, and first-login password update enforcement.
                        </p>
                    </div>

                    {/* Architecture Badges */}
                    <div className="flex flex-wrap lg:flex-col gap-2.5 w-full sm:w-auto shrink-0">
                        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-200">
                            <Database size={15} className="text-emerald-400" />
                            <span>1 Tenant = 1 Isolated SQLite File</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-200">
                            <ShieldCheck size={15} className="text-blue-400" />
                            <span>Immutable tenant_id Foreign Keys</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-200">
                            <KeyRound size={15} className="text-amber-400" />
                            <span>First-Login Password Reset Enforced</span>
                        </div>
                    </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSubTab('onboard')}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                            subTab === 'onboard' 
                                ? 'bg-white text-slate-900 shadow-md' 
                                : 'bg-white/10 hover:bg-white/15 text-white'
                        }`}
                    >
                        <Building2 size={16} />
                        1. Tenant Provisioning & Team Roster
                    </button>
                    <button
                        onClick={() => {
                            setSubTab('workspaces');
                            loadWorkspaces();
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                            subTab === 'workspaces' 
                                ? 'bg-white text-slate-900 shadow-md' 
                                : 'bg-white/10 hover:bg-white/15 text-white'
                        }`}
                    >
                        <Database size={16} />
                        2. Isolated Workspaces ({workspaces.length})
                    </button>
                    <button
                        onClick={() => {
                            setSubTab('team');
                            if (selectedWorkspaceSlug) loadTeam(selectedWorkspaceSlug);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                            subTab === 'team' 
                                ? 'bg-white text-slate-900 shadow-md' 
                                : 'bg-white/10 hover:bg-white/15 text-white'
                        }`}
                    >
                        <UserPlus size={16} />
                        3. Team Domicile & RBAC Engine ({teamUsers.length})
                    </button>
                    <button
                        onClick={() => setSubTab('verify')}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                            subTab === 'verify' 
                                ? 'bg-white text-slate-900 shadow-md' 
                                : 'bg-white/10 hover:bg-white/15 text-white'
                        }`}
                    >
                        <Lock size={16} />
                        4. 2-Step Login Sandbox
                    </button>
                </div>
            </div>

            {/* TAB 1: ONBOARD NEW CLIENT WITH ATOMIC TEAM ROSTER */}
            {subTab === 'onboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Form (7 cols) */}
                    <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">
                                <Sparkles size={14} />
                                Step 1: Tenant & Team Member Provisioning
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                Provision Biashara & Domiciled Accounts
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Spins up a physically isolated database file (<code className="text-blue-700 font-bold">db_&lt;slug&gt;.db</code>), creates the Primary Owner account, and pre-provisions all team member accounts with temporary passwords.
                            </p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-5">
                            {/* Organization Metadata */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                                <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                    <Building2 size={15} className="text-blue-600" />
                                    <span>Core Tenant Metadata</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                        Business / Organization Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        placeholder="e.g. Mama Mboga Fresh Grocers"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium transition bg-white"
                                    />
                                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                                        <span>Target Isolated DB Slug:</span>
                                        <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                            {sanitizedSlugPreview}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Primary Region / City
                                        </label>
                                        <select
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white cursor-pointer"
                                        >
                                            <option value="Nairobi">Nairobi Central</option>
                                            <option value="Mombasa">Mombasa Coastal</option>
                                            <option value="Kisumu">Kisumu Western</option>
                                            <option value="Nakuru">Nakuru Rift</option>
                                            <option value="Eldoret">Eldoret North</option>
                                            <option value="Thika">Thika / Kiambu</option>
                                            <option value="Bujumbura">Bujumbura (Burundi)</option>
                                            <option value="Kigali">Kigali (Rwanda)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Contact Phone (Optional)
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+254 700 000 000"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Root Admin Initialization */}
                            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                                        <ShieldCheck size={15} className="text-indigo-600" />
                                        <span>Root Admin Initialization (Tenant Administrator)</span>
                                    </div>
                                    <span className="text-[10px] font-bold bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-full">
                                        Exclusive Scope
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Tenant Admin Email *
                                        </label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                            <input
                                                type="email"
                                                value={ownerEmail}
                                                onChange={(e) => setOwnerEmail(e.target.value)}
                                                placeholder="owner@biashara.co.ke"
                                                required
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                                Master Credentials *
                                            </label>
                                            <button
                                                type="button"
                                                onClick={generatePassword}
                                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                            >
                                                Generate
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                required
                                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-mono transition bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Tenant-Scoped Team Domicile (Pre-Provision Roster) */}
                            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                                            <Users size={15} className="text-emerald-600" />
                                            <span>Initial Team Member Domicile (Isolated DB)</span>
                                        </div>
                                        <p className="text-[11px] text-emerald-700 mt-0.5">
                                            Pre-provision team accounts directly into <code className="font-mono font-bold">db_{sanitizedSlugPreview}.db</code> with mandatory foreign key <code className="font-mono">tenant_id</code> binding.
                                        </p>
                                    </div>
                                    
                                    {/* Presets */}
                                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={() => applyTeamPreset('retail')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                                                teamPreset === 'retail' 
                                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                                    : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                                            }`}
                                        >
                                            <Store size={12} /> Retail
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyTeamPreset('wholesale')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                                                teamPreset === 'wholesale' 
                                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                                    : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                                            }`}
                                        >
                                            <Briefcase size={12} /> Wholesale
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyTeamPreset('solo')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                                                teamPreset === 'solo' 
                                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                                    : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                                            }`}
                                        >
                                            Solo Owner
                                        </button>
                                    </div>
                                </div>

                                {/* Pre-provision Member Rows */}
                                {preProvisionMembers.length === 0 ? (
                                    <div className="text-center py-6 bg-white rounded-xl border border-dashed border-emerald-200 text-emerald-700 text-xs">
                                        Solo setup selected. Only the Primary Tenant Administrator will be provisioned initially.
                                        <button
                                            type="button"
                                            onClick={handleAddPreProvisionRow}
                                            className="block mx-auto mt-2 text-emerald-600 hover:text-emerald-800 font-bold underline cursor-pointer"
                                        >
                                            + Add a team member
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {preProvisionMembers.map((member, idx) => (
                                            <div 
                                                key={member.id} 
                                                className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs space-y-2.5"
                                            >
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                                                            {idx + 1}
                                                        </span>
                                                        <span>Account #{idx + 1}</span>
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                                            foreign_key: tenant_id
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePreProvisionRow(member.id)}
                                                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                                            title="Remove member from onboarding"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                                                    <div className="sm:col-span-4">
                                                        <input
                                                            type="text"
                                                            value={member.fullName}
                                                            onChange={(e) => handleUpdatePreProvisionRow(member.id, 'fullName', e.target.value)}
                                                            placeholder="Full Name"
                                                            required
                                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-5">
                                                        <input
                                                            type="email"
                                                            value={member.email}
                                                            onChange={(e) => handleUpdatePreProvisionRow(member.id, 'email', e.target.value)}
                                                            placeholder="email@store.com"
                                                            required
                                                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <select
                                                            value={member.role}
                                                            onChange={(e) => handleUpdatePreProvisionRow(member.id, 'role', e.target.value)}
                                                            className="w-full px-2 py-2 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs bg-white font-medium cursor-pointer"
                                                        >
                                                            <option value="Cashier">Cashier</option>
                                                            <option value="Manager">Manager</option>
                                                            <option value="Staff">Staff</option>
                                                            <option value="Accountant">Accountant</option>
                                                            <option value="Supervisor">Supervisor</option>
                                                            <option value="Stock Controller">Stock Clerk</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                                                    <div className="sm:col-span-6">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] text-slate-500 font-medium shrink-0">Station:</span>
                                                            <input
                                                                type="text"
                                                                value={member.sellingPointId}
                                                                onChange={(e) => handleUpdatePreProvisionRow(member.id, 'sellingPointId', e.target.value)}
                                                                placeholder="e.g. POS-TILL-01"
                                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="sm:col-span-6">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] text-slate-500 font-medium shrink-0">Temp Pass:</span>
                                                            <input
                                                                type="text"
                                                                value={member.password}
                                                                onChange={(e) => handleUpdatePreProvisionRow(member.id, 'password', e.target.value)}
                                                                placeholder="Staff@123"
                                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-emerald-500 text-xs font-mono"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdatePreProvisionRow(member.id, 'password', generateSecurePass('Staff'))}
                                                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                                                                title="Generate fresh password"
                                                            >
                                                                <RefreshCw size={11} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={handleAddPreProvisionRow}
                                            className="w-full py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-dashed border-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                        >
                                            <Plus size={14} /> Add Another Team Member Account
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Provision Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-black text-sm shadow-xl shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            <span>Executing Provisioning Pipeline & Injecting Domicile Accounts...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck size={18} />
                                            <span>
                                                Trigger Tenant Provisioning Pipeline ({preProvisionMembers.length + 1} Accounts)
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Credentials / Preview Panel (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        {createdWorkspace ? (
                            <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 border border-emerald-500/40 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                                    PIPELINE EXECUTED
                                </div>

                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-white">
                                            {createdWorkspace.business_name}
                                        </h3>
                                        <p className="text-xs text-emerald-400 font-mono">
                                            Isolated Slug: {createdWorkspace.slug}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3.5 text-xs">
                                    {/* Tenant ID */}
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                                            Tenant ID (Global Registry)
                                        </div>
                                        <div className="font-mono text-slate-200 font-bold flex items-center justify-between">
                                            <span>{createdWorkspace.tenant_id}</span>
                                            <button
                                                onClick={() => handleCopy(createdWorkspace.tenant_id, 'tenant_id')}
                                                className="text-slate-400 hover:text-white cursor-pointer"
                                                title="Copy Tenant ID"
                                            >
                                                {copiedKey === 'tenant_id' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Physical DB Path */}
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                                            Dedicated Database Container
                                        </div>
                                        <div className="font-mono text-emerald-300 font-bold flex items-center gap-1.5 break-all">
                                            <Database size={13} className="shrink-0" />
                                            <span>{createdWorkspace.db_path}</span>
                                        </div>
                                    </div>

                                    {/* Private Workspace Link */}
                                    <div className="bg-blue-950/60 p-3.5 rounded-xl border border-blue-500/40">
                                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-blue-300 font-bold mb-1.5">
                                            <span>Cryptographic Workspace Link</span>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">730d JWT</span>
                                        </div>
                                        <div className="font-mono text-[11px] text-blue-200 break-all bg-black/40 p-2.5 rounded-lg border border-white/10 select-all">
                                            {createdWorkspace.your_private_workspace_link}
                                        </div>
                                        <div className="mt-2.5 flex items-center gap-2">
                                            <button
                                                onClick={() => handleCopy(createdWorkspace.your_private_workspace_link, 'priv_link')}
                                                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                            >
                                                {copiedKey === 'priv_link' ? <Check size={14} /> : <Copy size={14} />}
                                                <span>Copy Link</span>
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateLink(createdWorkspace.slug)}
                                                className="py-1.5 px-3 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg font-medium text-xs flex items-center gap-1 transition cursor-pointer"
                                                title="Regenerate link if compromised"
                                            >
                                                <RefreshCw size={13} />
                                                <span>Rotate</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Post-Provisioning Domicile Manifest & Credentials Matrix */}
                                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-2.5">
                                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
                                            <div className="flex items-center gap-1.5">
                                                <BadgeCheck size={15} />
                                                <span>Domiciled Accounts Manifest ({createdWorkspace.domiciled_accounts?.length || 1})</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handlePrintAllSlips}
                                                    disabled={isPrintingAll}
                                                    className="text-[10px] text-emerald-400 hover:text-white underline cursor-pointer flex items-center gap-1"
                                                >
                                                    <Printer size={12} />
                                                    <span>{isPrintingAll ? 'Printing...' : 'Print All Vouchers'}</span>
                                                </button>
                                                <button
                                                    onClick={handleCopyAllCredentials}
                                                    className="text-[10px] text-blue-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                                                >
                                                    {copiedKey === 'full_manifest' ? <Check size={12} /> : <Copy size={12} />}
                                                    <span>Copy All Credentials</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                            {createdWorkspace.domiciled_accounts?.map((acc, i) => (
                                                <div 
                                                    key={acc.id || i} 
                                                    className="bg-black/30 p-2.5 rounded-lg border border-white/5 flex items-start justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-slate-200">{acc.fullName || acc.email}</span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                                acc.role === 'Owner' 
                                                                    ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50' 
                                                                    : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                                                            }`}>
                                                                {acc.role}
                                                            </span>
                                                            {acc.sellingPointId && (
                                                                <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1 rounded">
                                                                    {acc.sellingPointId}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{acc.email}</div>
                                                        <div className="text-[10px] font-mono text-amber-300 mt-1 flex items-center gap-1">
                                                            <Key size={10} />
                                                            <span>Pass: {acc.initialPassword || '[Supplied at creation]'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => handleCopy(`User: ${acc.email}\nPassword: ${acc.initialPassword || ''}\nWorkspace: ${createdWorkspace.your_private_workspace_link}`, `acc_${i}`)}
                                                            className="p-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                                            title="Copy login slip"
                                                        >
                                                            {copiedKey === `acc_${i}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedSlipUser(acc)}
                                                            className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded cursor-pointer"
                                                            title="Print Welcome Voucher"
                                                        >
                                                            <Printer size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            setSelectedWorkspaceSlug(createdWorkspace.slug);
                                            setSubTab('team');
                                        }}
                                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                                    >
                                        <UserPlus size={14} />
                                        Manage Domiciled Roster
                                    </button>
                                    <button
                                        onClick={() => {
                                            setTestSlug(createdWorkspace.slug);
                                            setTestWorkspaceLink(createdWorkspace.your_private_workspace_link);
                                            setSubTab('verify');
                                        }}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                                    >
                                        Test 2-Step Login <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-8 text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                                    <Database size={28} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-black text-slate-800 text-base">
                                        Dedicated Tenant & Team Container
                                    </h3>
                                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                        Once submitted, the tenant pipeline will spin up <code className="font-mono text-blue-600">db_&lt;slug&gt;.db</code>, inject all selected team accounts with hashed passwords, and generate your printable Welcome Manifest.
                                    </p>
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 bg-white p-3 rounded-xl border border-slate-200 text-left space-y-1">
                                    <div>📁 Dedicated SQLite DB: tenants_dbs/db_&lt;slug&gt;.db</div>
                                    <div>🔗 Encrypted Workspace Token (730d expiry)</div>
                                    <div>👥 Pre-provisioned Team Accounts with RBAC</div>
                                    <div>🔒 First-login password_reset_required flag</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* HIDDEN BATCH PRINT CONTAINER */}
                    <div className="hidden">
                        <div ref={batchPrintRef}>
                            {createdWorkspace?.domiciled_accounts?.map((acc, i) => (
                                <LoginSlipContent
                                    key={acc.id || i}
                                    user={acc}
                                    workspaceName={createdWorkspace.business_name}
                                    workspaceSlug={createdWorkspace.slug}
                                    workspaceLink={createdWorkspace.your_private_workspace_link}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: WORKSPACES ROSTER */}
            {subTab === 'workspaces' && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                Provisioned Client Biasharas ({workspaces.length})
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Every client has their own physical SQLite database file and dedicated control token.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    value={workspaceSearch}
                                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                                    placeholder="Search biasharas..."
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <button
                                onClick={loadWorkspaces}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                                title="Refresh Workspaces"
                            >
                                <RefreshCw size={16} className={isLoadingWorkspaces ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {filteredWorkspaces.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 space-y-3">
                            <Database size={36} className="mx-auto text-slate-300" />
                            <p className="text-sm">No client workspaces match your search or none onboarded yet.</p>
                            <button
                                onClick={() => setSubTab('onboard')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                            >
                                Onboard First Biashara
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                                        <th className="p-3">Biashara / Tenant</th>
                                        <th className="p-3">Slug Identifier</th>
                                        <th className="p-3">Owner Email</th>
                                        <th className="p-3">Isolated DB File</th>
                                        <th className="p-3 text-center">Team Users</th>
                                        <th className="p-3 text-center">Created At</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredWorkspaces.map((w) => (
                                        <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3">
                                                <div className="font-black text-slate-900 text-sm">{w.business_name}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">ID: {w.id}</div>
                                            </td>
                                            <td className="p-3 font-mono font-bold text-blue-600">
                                                <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                    {w.slug}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-700">
                                                {w.owner_email}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                                    <Database size={11} />
                                                    <span>db_{w.slug}.db</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="bg-slate-100 font-bold px-2 py-1 rounded text-slate-700">
                                                    {w.user_count || 1} members
                                                </span>
                                            </td>
                                            <td className="p-3 text-center text-slate-500">
                                                {new Date(w.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleCopy(w.your_private_workspace_link, `list_${w.slug}`)}
                                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                                        title="Copy Private Workspace Link"
                                                    >
                                                        {copiedKey === `list_${w.slug}` ? <Check size={13} /> : <Copy size={13} />}
                                                        <span>Link</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedWorkspaceSlug(w.slug);
                                                            setSubTab('team');
                                                        }}
                                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                                        title="Manage Team in isolated DB"
                                                    >
                                                        <Users size={13} />
                                                        <span>Team</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setTestSlug(w.slug);
                                                            setTestWorkspaceLink(w.your_private_workspace_link);
                                                            setSubTab('verify');
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                                        title="Test 2-step login"
                                                    >
                                                        <Lock size={13} />
                                                        <span>Test</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: TEAM DOMICILE & GRANULAR RBAC ENGINE */}
            {subTab === 'team' && (
                <div className="space-y-6">
                    {/* Header Workspace Bar */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                                <Users size={15} />
                                Tenant-Scoped Team Domicile & Data Layer
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                Isolated Team Member Management
                            </h2>
                            <p className="text-xs text-slate-500">
                                Every account is strictly bound by foreign key <code className="font-mono text-emerald-700 font-bold">tenant_id</code> inside <span className="font-mono font-bold text-slate-700">tenants_dbs/db_{selectedWorkspaceSlug || 'slug'}.db</span>. No user record can exist independently of a tenant.
                            </p>
                        </div>

                        {/* Workspace Picker */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex-1 md:w-72">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Active Biashara Tenant:
                                </label>
                                <select
                                    value={selectedWorkspaceSlug}
                                    onChange={(e) => setSelectedWorkspaceSlug(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs bg-white font-bold text-slate-800 cursor-pointer"
                                >
                                    {workspaces.map((w) => (
                                        <option key={w.slug} value={w.slug}>
                                            {w.business_name} ({w.slug})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => loadTeam(selectedWorkspaceSlug)}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer self-end"
                                title="Reload Database Roster"
                            >
                                <RefreshCw size={15} className={isLoadingTeam ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left Account Injection Controls (5 cols) */}
                        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                            {/* Mode Switcher */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="font-black text-slate-900 text-base">
                                        Account Creation & Injection
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Direct SQLite insertion with salted bcrypt hashing
                                    </p>
                                </div>
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setTeamInjectionMode('single')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                            teamInjectionMode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Single
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTeamInjectionMode('batch')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                            teamInjectionMode === 'batch' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Bulk CSV
                                    </button>
                                </div>
                            </div>

                            {/* MODE 1: SINGLE ACCOUNT INJECTION */}
                            {teamInjectionMode === 'single' ? (
                                <form onSubmit={handleInvite} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                            Member Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={teamFullName}
                                            onChange={(e) => setTeamFullName(e.target.value)}
                                            placeholder="e.g. Grace Wambui"
                                            required
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-xs transition"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                                Email Address *
                                            </label>
                                            <input
                                                type="email"
                                                value={teamEmail}
                                                onChange={(e) => setTeamEmail(e.target.value)}
                                                placeholder="grace@biashara.co.ke"
                                                required
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-xs font-mono transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                                Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                value={teamPhone}
                                                onChange={(e) => setTeamPhone(e.target.value)}
                                                placeholder="+254 712 000 000"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-xs transition"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                                Role Baseline *
                                            </label>
                                            <select
                                                value={teamRole}
                                                onChange={(e) => handleRoleSelect(e.target.value as any)}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs bg-white font-medium cursor-pointer"
                                            >
                                                <option value="Cashier">Cashier (Till & POS)</option>
                                                <option value="Manager">Manager (Operations)</option>
                                                <option value="Staff">Staff (General Operations)</option>
                                                <option value="Accountant">Accountant (Ledger & Tax)</option>
                                                <option value="Supervisor">Floor Supervisor</option>
                                                <option value="Stock Controller">Stock Controller</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                                Selling Point / Station
                                            </label>
                                            <input
                                                type="text"
                                                value={teamSellingPoint}
                                                onChange={(e) => setTeamSellingPoint(e.target.value)}
                                                placeholder="e.g. POS-TILL-01"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                                Temporary Password *
                                            </label>
                                            <button
                                                type="button"
                                                onClick={generateTeamPassword}
                                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                            >
                                                Auto-Generate
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock size={15} className="absolute left-3 top-2.5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={teamPassword}
                                                onChange={(e) => setTeamPassword(e.target.value)}
                                                placeholder="Staff@9281"
                                                required
                                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-mono transition"
                                            />
                                        </div>
                                        <div className="mt-1 text-[10px] text-amber-700 flex items-center gap-1">
                                            <KeyRound size={11} />
                                            <span>System flag <code className="font-mono font-bold">password_reset_required: true</code> will be set.</span>
                                        </div>
                                    </div>

                                    {/* Granular RBAC Permissions Matrix Accordion */}
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setShowPermissionsMatrix(!showPermissionsMatrix)}
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sliders size={14} className="text-emerald-600" />
                                                <span>Granular RBAC Permissions Matrix ({Object.values(teamPermissions).filter(Boolean).length}/8 active)</span>
                                            </div>
                                            {showPermissionsMatrix ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                        </button>

                                        {showPermissionsMatrix && (
                                            <div className="p-3.5 space-y-2.5 bg-white border-t border-slate-100">
                                                <div className="text-[10px] text-slate-500 mb-2">
                                                    Check specific operational modules granted to this team member:
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {RBAC_MODULES.map(mod => {
                                                        const isChecked = !!teamPermissions[mod.key];
                                                        return (
                                                            <label 
                                                                key={mod.key} 
                                                                className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                                                                    isChecked ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-100 opacity-70'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        setTeamPermissions(prev => ({
                                                                            ...prev,
                                                                            [mod.key]: e.target.checked
                                                                        }));
                                                                    }}
                                                                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                                />
                                                                <div className="text-xs">
                                                                    <div className="font-bold text-slate-800">{mod.name}</div>
                                                                    <div className="text-[10px] text-slate-500">{mod.desc}</div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isInviting}
                                        className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {isInviting ? (
                                            <>
                                                <RefreshCw size={16} className="animate-spin" />
                                                <span>Injecting into {selectedWorkspaceSlug}'s DB...</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus size={16} />
                                                <span>Inject Account into Isolated DB</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                /* MODE 2: BATCH CSV INJECTION */
                                <div className="space-y-4">
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <p className="font-bold">Paste CSV Lines (One member per line):</p>
                                        <p className="text-[11px] text-slate-500 font-mono">
                                            Format: Full Name, Email, Role, StationID, Phone
                                        </p>
                                    </div>

                                    <textarea
                                        rows={6}
                                        value={batchCsvText}
                                        onChange={(e) => setBatchCsvText(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-mono transition"
                                        placeholder="Full Name, Email, Role, Station, Phone"
                                    />

                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                                        <div className="font-bold text-slate-800">Batch Ingestion Guarantees:</div>
                                        <div>• Auto-generates unique salted bcrypt passwords for each member</div>
                                        <div>• Enforces <code className="font-mono">password_reset_required: true</code></div>
                                        <div>• Atomically commits all accounts to <code className="font-mono">db_{selectedWorkspaceSlug}.db</code></div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleBatchCsvSubmit}
                                        disabled={isBatchProcessing}
                                        className="w-full py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {isBatchProcessing ? (
                                            <>
                                                <RefreshCw size={15} className="animate-spin" />
                                                <span>Injecting Bulk Accounts...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FileSpreadsheet size={15} />
                                                <span>Process CSV & Inject All Members</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right Live Isolated DB Users Table (7 cols) */}
                        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black text-slate-900">
                                            Isolated DB User Roster
                                        </h3>
                                        <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                            {teamUsers.length} Domiciled
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Querying table <code className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded">users</code> in <span className="font-mono text-slate-700 font-bold">tenants_dbs/db_{selectedWorkspaceSlug}.db</span>
                                    </p>
                                </div>

                                <div className="relative w-full sm:w-48">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={teamSearch}
                                        onChange={(e) => setTeamSearch(e.target.value)}
                                        placeholder="Filter team..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            {filteredTeamUsers.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 space-y-3">
                                    <Users size={36} className="mx-auto text-slate-300" />
                                    <p className="text-sm">No team member accounts found in this tenant boundary.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                                                <th className="p-3">Member Details</th>
                                                <th className="p-3">Role</th>
                                                <th className="p-3">Workstation</th>
                                                <th className="p-3">Security & Status</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredTeamUsers.map((u) => {
                                                const isOwner = u.role === 'Owner';
                                                return (
                                                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="p-3">
                                                            <div className="font-bold text-slate-900">
                                                                {u.fullName || u.email.split('@')[0]}
                                                            </div>
                                                            <div className="font-mono text-[11px] text-slate-500">
                                                                {u.email}
                                                            </div>
                                                            {u.phone && (
                                                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                                    <Phone size={10} /> {u.phone}
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="p-3">
                                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                                                isOwner 
                                                                    ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                                                    : u.role === 'Manager' 
                                                                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                                                    : u.role === 'Accountant'
                                                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            }`}>
                                                                {u.role}
                                                            </span>
                                                        </td>

                                                        <td className="p-3 font-mono text-[11px] text-slate-700">
                                                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                                {u.sellingPointId || 'HQ-DEFAULT'}
                                                            </span>
                                                        </td>

                                                        <td className="p-3">
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                                                    <ShieldCheck size={12} />
                                                                    <span>tenant_id: {u.tenant_id ? u.tenant_id.slice(0, 8) : selectedWorkspaceSlug}</span>
                                                                </div>
                                                                {u.passwordResetRequired !== false && !isOwner ? (
                                                                    <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block font-mono">
                                                                        Must update pass on 1st login
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block">
                                                                        Active Established
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    onClick={() => setSelectedSlipUser(u)}
                                                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition"
                                                                    title="Print Welcome Slip"
                                                                >
                                                                    <Printer size={13} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCopy(`User: ${u.email}\nTenant: ${selectedWorkspaceSlug}\nStation: ${u.sellingPointId || 'POS-01'}`, `usr_${u.id}`)}
                                                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer transition"
                                                                    title="Copy Details"
                                                                >
                                                                    {copiedKey === `usr_${u.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                                </button>
                                                                {!isOwner ? (
                                                                    <button
                                                                        onClick={() => handleRevokeMember(u)}
                                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition"
                                                                        title="Revoke & Delete Account from Isolated DB"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                ) : (
                                                                    <span 
                                                                        className="p-1.5 text-slate-300 cursor-not-allowed" 
                                                                        title="Root Administrator account is protected"
                                                                    >
                                                                        <Lock size={13} />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: 2-STEP LOGIN SANDBOX / VALIDATOR */}
            {subTab === 'verify' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Sandbox Controls (6 cols) */}
                    <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
                                <Lock size={14} />
                                Two-Step Login Verification
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                                Test 2-Step Authentication
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Simulates the Python script's 2-step process: verify credentials against the tenant DB first, then validate the private workspace link second.
                            </p>
                        </div>

                        {/* STEP 1 FORM */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                            step1Result ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                        }`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                                    Step 1: Email + Password + Slug
                                </span>
                                {step1Result && (
                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                        <Check size={14} /> Step 1 Passed
                                    </span>
                                )}
                            </div>

                            <form onSubmit={handleStep1Test} className="space-y-3">
                                <div>
                                    <input
                                        type="text"
                                        value={testSlug}
                                        onChange={(e) => setTestSlug(e.target.value)}
                                        placeholder="Biashara Slug (e.g. green-grocers-4a2f)"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        placeholder="User Email"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-blue-500"
                                    />
                                    <input
                                        type="password"
                                        value={testPassword}
                                        onChange={(e) => setTestPassword(e.target.value)}
                                        placeholder="Password"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isTestingStep1}
                                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {isTestingStep1 ? 'Verifying with Isolated DB...' : 'Execute Step 1 (Verify User in DB)'}
                                </button>
                            </form>
                        </div>

                        {/* STEP 2 FORM */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                            step2Success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : (!step1Result ? 'opacity-50 pointer-events-none bg-slate-50 border-slate-200' : 'bg-blue-50/40 border-blue-200')
                        }`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                                    Step 2: Paste Private Workspace Link
                                </span>
                                {step2Success && (
                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                        <Check size={14} /> Full Access Granted
                                    </span>
                                )}
                            </div>

                            <form onSubmit={handleStep2Test} className="space-y-3">
                                <div>
                                    <input
                                        type="text"
                                        value={testWorkspaceLink}
                                        onChange={(e) => setTestWorkspaceLink(e.target.value)}
                                        placeholder="https://biasharasasa.nerlify.app/access/eyJhbG..."
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-white outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isTestingStep2 || !step1Result}
                                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {isTestingStep2 ? 'Verifying Workspace Link & Token Hash...' : 'Execute Step 2 (Validate Link & Enter)'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Simulation Console Log (6 cols) */}
                    <div className="lg:col-span-6 bg-slate-900 text-white rounded-3xl p-6 sm:p-7 border border-slate-800 shadow-xl space-y-4 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2 text-slate-300 font-bold">
                                <Terminal size={15} className="text-blue-400" />
                                <span>Security Handshake Log</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-emerald-400 uppercase font-bold">Active</span>
                            </div>
                        </div>

                        <div className="space-y-2.5 text-slate-300 leading-relaxed max-h-96 overflow-y-auto">
                            <div className="text-slate-500">// Ready to simulate client onboarding security flow...</div>
                            {testSlug && (
                                <div>
                                    <span className="text-blue-400">&gt; Target biashara slug:</span> {testSlug}
                                </div>
                            )}
                            {step1Result && (
                                <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-emerald-300 space-y-1">
                                    <div className="text-emerald-400 font-bold">[STEP 1 COMPLETE]</div>
                                    <div>User ID: {step1Result.user.id}</div>
                                    <div>Email: {step1Result.user.email}</div>
                                    <div>Role: {step1Result.user.role}</div>
                                    <div>Tenant ID: {step1Result.user.tenant_id}</div>
                                    <div className="text-slate-400 text-[10px] truncate">
                                        Pending Handshake JWT: {step1Result.pending_token.slice(0, 40)}...
                                    </div>
                                </div>
                            )}

                            {step2Success && (
                                <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-500/40 text-emerald-200 space-y-2">
                                    <div className="text-emerald-300 font-black text-sm flex items-center gap-1.5">
                                        <CheckCircle2 size={16} />
                                        {step2Success.message}
                                    </div>
                                    <div className="text-xs text-slate-300">
                                        Session granted for Biashara: <span className="text-white font-bold">{step2Success.slug}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        Dashboard route: <span className="text-blue-300">{step2Success.dashboard}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ENHANCED THERMAL WELCOME SLIP MODAL */}
            {selectedSlipUser && (
                <LoginSlipModal
                    user={selectedSlipUser}
                    workspaceName={selectedWorkspace?.business_name || createdWorkspace?.business_name || 'Biashara Sasa'}
                    workspaceSlug={(selectedSlipUser as any).slug || selectedWorkspace?.slug || createdWorkspace?.slug || ''}
                    workspaceLink={selectedWorkspace?.your_private_workspace_link || createdWorkspace?.your_private_workspace_link || ''}
                    onClose={() => setSelectedSlipUser(null)}
                    showToast={showToast}
                />
            )}
        </div>
    );
};

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, UserPlus, Shield, ShieldCheck, Key, Lock, Mail, Phone, 
    MapPin, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, X, 
    ArrowUpRight, Trash2, Edit3, UserCheck, Eye, EyeOff, Sparkles, 
    Building2, Calendar, Crown, Store, CreditCard, Check,
    Sliders, CheckSquare, Square, ChevronRight, HelpCircle
} from 'lucide-react';
import { 
    TenantUserDetails, TenantSeatStats, TenantUserRole, Trader,
    MemberPermissions,
    TENANT_ROLE_DEFINITIONS
} from '../../types';
import { TENANT_AVAILABLE_MODULES, getDefaultPermissionsForRole } from '../../permissions';
import { useAppContext } from '../../context';
import * as api from '../../api';

interface TenantUsersModalProps {
    traderId: number;
    slug?: string; // Optional slug for isolated tenants
    tenantName?: string;
    onClose: () => void;
    onSuccess?: () => void;
    showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    isSuperAdmin?: boolean;
    flat?: boolean; // If true, render as a regular div instead of a modal
}

export const TenantUsersModal: React.FC<TenantUsersModalProps> = ({
    traderId,
    slug,
    tenantName,
    onClose,
    onSuccess,
    showToast,
    isSuperAdmin = false,
    flat = false
}) => {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<TenantUserDetails[]>([]);
    const [tenantInfo, setTenantInfo] = useState<any>(null);
    const [seatStats, setSeatStats] = useState<TenantSeatStats | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    
    // Modal state for adding a user
    const [showAddModal, setShowAddModal] = useState(false);
    const [creatingUser, setCreatingUser] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // Form state for creating a user
    const [newUserFullName, setNewUserFullName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPhone, setNewUserPhone] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<TenantUserRole>('cashier');
    const [newUserPermissions, setNewUserPermissions] = useState<MemberPermissions>(getDefaultPermissionsForRole('cashier'));
    const [newUserSellingPoint, setNewUserSellingPoint] = useState('Main Branch');
    const [newUserCommission, setNewUserCommission] = useState('0');

    // Upgrade Tier state
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedTier, setSelectedTier] = useState<string>('pro');
    const [selectedMonths, setSelectedMonths] = useState<number>(1);
    const [isUpdatingTier, setIsUpdatingTier] = useState(false);

    // Edit user state
    const [editingUser, setEditingUser] = useState<TenantUserDetails | null>(null);
    const [editRole, setEditRole] = useState<TenantUserRole>('cashier');
    const [editPermissions, setEditPermissions] = useState<MemberPermissions>(getDefaultPermissionsForRole('cashier'));
    const [editFullName, setEditFullName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);

    const { user: contextUser } = useAppContext();
    const activeSlug = slug || (contextUser as any)?.slug;

    // Fetch tenant users and seat metrics
    const fetchUsers = async () => {
        setLoading(true);
        try {
            if (activeSlug) {
                const res = await api.getClientWorkspaceTeam(activeSlug);
                // Map ClientTenantUser to TenantUserDetails for UI compatibility
                const mappedUsers: TenantUserDetails[] = res.users.map((u: any) => ({
                    id: u.id,
                    traderId: traderId,
                    username: u.email,
                    email: u.email,
                    fullName: u.email.split('@')[0],
                    role: u.role.toLowerCase() as any,
                    status: 'active',
                    createdAt: new Date().toISOString()
                }));
                setUsers(mappedUsers);
                setSeatStats({
                    maxUsers: 10,
                    activeUsers: res.count,
                    suspendedUsers: 0,
                    totalRegistered: res.count,
                    remainingSeats: 10 - res.count,
                    isAtLimit: res.count >= 10,
                    isOverLimit: false,
                    locationLimit: 1,
                    plan: 'Isolated DB',
                    subscriptionTier: 'isolated',
                    billingStatus: 'paid'
                });
                setTenantInfo({ businessName: res.business_name, email: '', id: traderId });
            } else {
                const res = await api.getTenantUsersWithDetails(traderId);
                if (res?.success) {
                    setUsers(res.users || []);
                    setSeatStats(res.seatStats || null);
                    setTenantInfo(res.tenant || null);
                    if (res.seatStats?.subscriptionTier) {
                        setSelectedTier(res.seatStats.subscriptionTier);
                    }
                } else {
                    const rawUsers = await api.getTenantUsers(traderId);
                    setUsers(rawUsers || []);
                }
            }
        } catch (err: any) {
            console.error('Fetch tenant users error:', err);
            showToast(err.message || 'Failed to load tenant users', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [traderId, activeSlug]);

    // Password generator
    const generateTemporaryPassword = () => {
        const words = ['Biashara', 'Kazi', 'Mali', 'Soko', 'Mauzo'];
        const word = words[Math.floor(Math.random() * words.length)];
        const num = Math.floor(1000 + Math.random() * 9000);
        const pass = `${word}@${num}`;
        setNewUserPassword(pass);
        showToast('Generated secure temporary password', 'info');
    };

    const handleOpenAddModal = () => {
        if (seatStats && seatStats.isAtLimit) {
            showToast('Subscription seat limit reached. Please upgrade subscription tier to add more users.', 'warning');
            if (!activeSlug) setShowUpgradeModal(true);
            return;
        }
        setNewUserFullName('');
        setNewUserEmail('');
        setNewUserPhone('');
        setNewUserRole('cashier');
        setNewUserPermissions(getDefaultPermissionsForRole('cashier'));
        setNewUserSellingPoint('Main Counter');
        setNewUserCommission('0');
        generateTemporaryPassword();
        setShowAddModal(true);
    };

    const handleCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail.trim() || !newUserFullName.trim()) {
            showToast('Please provide user full name and email/username', 'error');
            return;
        }
        if (!newUserPassword.trim()) {
            showToast('Password is required', 'error');
            return;
        }

        setCreatingUser(true);
        try {
            if (activeSlug) {
                // Use Invite Team Member endpoint for isolated DBs
                const res = await api.inviteClientTeamMember(activeSlug, {
                    email: newUserEmail.trim().toLowerCase(),
                    password: newUserPassword.trim(),
                    role: (newUserRole.charAt(0).toUpperCase() + newUserRole.slice(1)) as any
                });
                showToast(res.message, 'success');
                setShowAddModal(false);
                await fetchUsers();
                if (onSuccess) onSuccess();
            } else {
                const res = await api.createTenantUser(traderId, {
                    username: newUserEmail.trim().toLowerCase(),
                    email: newUserEmail.trim().toLowerCase(),
                    fullName: newUserFullName.trim(),
                    phone: newUserPhone.trim() || undefined,
                    password: newUserPassword.trim(),
                    role: newUserRole,
                    permissions: newUserPermissions,
                    sellingPointId: newUserSellingPoint.trim() || undefined,
                    commissionRate: Number(newUserCommission) || 0,
                    status: 'active'
                });

                if (res.success) {
                    showToast(`User account "${newUserFullName}" successfully created under role: ${newUserRole}!`, 'success');
                    setShowAddModal(false);
                    await fetchUsers();
                    if (onSuccess) onSuccess();
                } else {
                    showToast(res.message || 'Failed to create user account', 'error');
                }
            }
        } catch (err: any) {
            if (err.upgradeRequired) {
                showToast(err.message || 'Seat limit reached for this subscription tier', 'warning');
                setShowUpgradeModal(true);
            } else {
                showToast(err.message || 'Failed to create user account', 'error');
            }
        } finally {
            setCreatingUser(false);
        }
    };

    const handleToggleStatus = async (userItem: TenantUserDetails) => {
        const nextStatus = userItem.status === 'active' ? 'suspended' : 'active';
        
        if (userItem.role === 'tenant_admin' && nextStatus === 'suspended') {
            showToast('Cannot suspend the primary Tenant Administrator account', 'error');
            return;
        }

        try {
            const res = await api.updateTenantUserStatus(traderId, userItem.id, nextStatus);
            if (res.success) {
                showToast(`User account "${userItem.fullName}" is now ${nextStatus}!`, 'success');
                await fetchUsers();
                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to update user status', 'error');
            if (err.upgradeRequired) {
                setShowUpgradeModal(true);
            }
        }
    };

    const handleDeleteUser = async (userItem: TenantUserDetails) => {
        if (userItem.role === 'tenant_admin') {
            showToast('The primary Tenant Administrator cannot be deleted.', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to remove user "${userItem.fullName}" (${userItem.username})?`)) {
            return;
        }

        try {
            if (activeSlug) {
                const res = await api.removeClientTeamMember(activeSlug, String(userItem.id));
                if (res.success) {
                    showToast(res.message, 'success');
                    await fetchUsers();
                    if (onSuccess) onSuccess();
                }
            } else {
                const res = await api.deleteTenantUser(traderId, userItem.id);
                if (res.success) {
                    showToast(`User "${userItem.fullName}" removed successfully`, 'success');
                    await fetchUsers();
                    if (onSuccess) onSuccess();
                }
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to remove user', 'error');
        }
    };

    const handleOpenEdit = (userItem: TenantUserDetails) => {
        setEditingUser(userItem);
        setEditFullName(userItem.fullName);
        setEditPhone(userItem.phone || '');
        setEditRole(userItem.role);
        setEditPermissions(userItem.permissions || getDefaultPermissionsForRole(userItem.role));
        setEditPassword('');
    };

    const handleSaveEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setIsUpdatingUser(true);
        try {
            const res = await api.updateTenantUser(traderId, editingUser.id, {
                fullName: editFullName.trim(),
                phone: editPhone.trim() || undefined,
                role: editRole,
                permissions: editPermissions,
                password: editPassword.trim() ? editPassword.trim() : undefined
            });

            if (res.success) {
                showToast('User details updated successfully!', 'success');
                setEditingUser(null);
                await fetchUsers();
                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to update user', 'error');
        } finally {
            setIsUpdatingUser(false);
        }
    };

    const handleUpgradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingTier(true);
        try {
            let maxSeats = 5;
            let locationLimit = 2;
            let planName = 'Standard / Pro';

            if (selectedTier === 'starter') {
                maxSeats = 2;
                locationLimit = 1;
                planName = 'Starter';
            } else if (selectedTier === 'pro') {
                maxSeats = 5;
                locationLimit = 2;
                planName = 'Standard / Pro';
            } else if (selectedTier === 'enterprise') {
                maxSeats = 15;
                locationLimit = 5;
                planName = 'Professional / Enterprise';
            } else if (selectedTier === 'distributor') {
                maxSeats = 50;
                locationLimit = 20;
                planName = 'Custom / Wholesale Distributor';
            }

            const res = await api.changeTenantSubscription(traderId, {
                tier: selectedTier,
                plan: planName,
                months: selectedMonths,
                maxUsers: maxSeats,
                locationLimit
            });

            if (res.success) {
                showToast(`Subscription tier synchronized to ${planName} (${maxSeats} seats)!`, 'success');
                setShowUpgradeModal(false);
                await fetchUsers();
                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to change subscription', 'error');
        } finally {
            setIsUpdatingTier(false);
        }
    };

    // Filtered users
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesQuery = 
                u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.role?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesRole = roleFilter === 'all' || u.role === roleFilter;
            return matchesQuery && matchesRole;
        });
    }, [users, searchQuery, roleFilter]);

    const renderPermissionsMatrix = (
        currentPerms: MemberPermissions,
        onToggle: (key: keyof MemberPermissions, val: boolean) => void,
        onReset: () => void,
        roleId: string
    ) => {
        const defaultPerms = getDefaultPermissionsForRole(roleId);
        const isCustomized = TENANT_AVAILABLE_MODULES.some(
            m => Boolean(currentPerms[m.id]) !== Boolean(defaultPerms[m.id])
        );

        return (
            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 uppercase tracking-wider">
                            <ShieldCheck size={15} className="text-emerald-600" />
                            <span>Role-Based Access Control (RBAC) Modules</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Authorizes operational features for this member in your tenant workspace.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isCustomized ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Sliders size={11} />
                                Custom Overrides
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 size={11} />
                                Synced with Role
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                            Reset Defaults
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {TENANT_AVAILABLE_MODULES.map(m => {
                        const isChecked = Boolean(currentPerms[m.id]);
                        const isAddon = m.isAddon;
                        const hasAddonSubscribed = !isAddon || Boolean(
                            tenantInfo?.modules?.[isAddon] ||
                            (contextUser as any)?.[`${isAddon}Active`]
                        );

                        return (
                            <label
                                key={m.id}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer select-none ${
                                    isChecked
                                        ? 'bg-white border-emerald-300 shadow-xs ring-1 ring-emerald-50'
                                        : 'bg-slate-100/60 border-slate-200 opacity-70 hover:opacity-100'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => onToggle(m.id as keyof MemberPermissions, e.target.checked)}
                                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-slate-800 truncate">
                                            {m.label}
                                        </span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                            isChecked 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                : 'bg-slate-200 text-slate-600 border-slate-300'
                                        }`}>
                                            {m.badge}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                        {m.description}
                                    </p>
                                    {isAddon && !hasAddonSubscribed && (
                                        <span className="inline-block text-[9px] text-amber-700 font-semibold mt-0.5">
                                            *Requires {m.badge} add-on active
                                        </span>
                                    )}
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>
        );
    };

    const content = (
        <div className={`bg-white border border-slate-200 rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col ${flat ? 'h-full shadow-none' : 'shadow-2xl max-h-[92vh]'}`}>
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 size={18} className="text-emerald-400" />
                        <h3 className="font-bold text-lg text-white">
                            {tenantInfo?.businessName || tenantName || 'Tenant Business Management'}
                        </h3>
                        <span className="font-mono text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                            {seatStats?.tenantCode || tenantInfo?.tenantCode || `TNT-${traderId}`}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400">
                        Multi-user accounts, subscription-based seat allocations, and department role synchronization.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchUsers}
                        title="Refresh data"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {!flat && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Seat Capacity & Subscription Banner */}
            {seatStats && (
                <div className="bg-slate-50 border-b border-slate-200 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700">
                                <Crown size={22} className="text-amber-500" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Plan Tier</span>
                                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                                        {seatStats.plan || seatStats.subscriptionTier}
                                    </span>
                                    {seatStats.isOverLimit && (
                                        <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                                            <AlertTriangle size={12} /> Excess Accounts
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                    Permitted locations: <span className="font-semibold">{seatStats.locationLimit}</span> · 
                                    Status: <span className="font-semibold text-emerald-600 uppercase">{seatStats.billingStatus}</span>
                                    {seatStats.subscriptionExpiresAt && (
                                        <span> · Expires: <span className="font-mono">{seatStats.subscriptionExpiresAt}</span></span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Seats Meter & Action */}
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-800">
                                    <span className="text-emerald-600">{seatStats.activeUsers}</span> / {seatStats.maxUsers} Seats Used
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {seatStats.remainingSeats > 0 ? (
                                        <span className="text-slate-600 font-medium">{seatStats.remainingSeats} seat(s) remaining</span>
                                    ) : (
                                        <span className="text-amber-600 font-bold">Capacity reached (100%)</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                            >
                                <ArrowUpRight size={14} className="text-emerald-400" />
                                Change Tier
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
                        <div 
                            className={`h-full transition-all duration-500 ${
                                seatStats.isOverLimit 
                                    ? 'bg-red-500' 
                                    : seatStats.isAtLimit 
                                    ? 'bg-amber-500' 
                                    : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((seatStats.activeUsers / seatStats.maxUsers) * 100))}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Over Limit Warning */}
            {seatStats?.isOverLimit && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 px-5 flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-600 shrink-0" />
                        <span>
                            <strong>Seat limit exceeded:</strong> This tenant currently has {seatStats.activeUsers} active accounts for a {seatStats.maxUsers}-seat plan. Please upgrade the subscription or suspend excess accounts to restore compliance.
                        </span>
                    </div>
                    <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-[11px] font-bold shrink-0 ml-3"
                    >
                        Upgrade Plan
                    </button>
                </div>
            )}

            {/* Action Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="Search by name, email, phone or role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
                        />
                        <Users size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium focus:outline-none"
                    >
                        <option value="all">All Roles ({users.length})</option>
                        {TENANT_ROLE_DEFINITIONS.map(r => (
                            <option key={r.id} value={r.id}>{r.badge}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleOpenAddModal}
                    disabled={seatStats?.isAtLimit}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
                >
                    <UserPlus size={15} />
                    Add User Account
                </button>
            </div>

            {/* Users List Table */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <RefreshCw size={28} className="animate-spin text-slate-400 mb-2" />
                        <span className="text-xs font-medium">Synchronizing tenant user registry...</span>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Users size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-600">No user accounts found matching your query</p>
                        <p className="text-[11px] text-slate-400 mt-1">Create accounts within your subscription seat limits.</p>
                    </div>
                ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="p-3">User & Identity</th>
                                    <th className="p-3">Role & Permissions</th>
                                    <th className="p-3">Service Station / Location</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map((u) => {
                                    const roleDef = TENANT_ROLE_DEFINITIONS.find(r => r.id === u.role) || {
                                        id: u.role,
                                        title: u.role,
                                        badge: u.role,
                                        color: 'bg-slate-100 text-slate-800 border-slate-200',
                                        description: 'Assigned platform role',
                                        responsibilities: []
                                    };

                                    const isPrimaryAdmin = u.role === 'tenant_admin' || (tenantInfo?.email && u.username.toLowerCase() === tenantInfo.email.toLowerCase());

                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                                                        {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                            {u.fullName || u.username}
                                                            {isPrimaryAdmin && (
                                                                <span className="text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded">
                                                                    Primary Admin
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                                                            {u.email || u.username}
                                                        </div>
                                                        {u.phone && (
                                                            <div className="text-[10px] text-slate-400">
                                                                {u.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${roleDef.color}`}>
                                                        {roleDef.title}
                                                    </span>
                                                </div>
                                                {/* RBAC Modules Synchronized Badges */}
                                                <div className="flex flex-wrap gap-1 mt-1.5 max-w-[320px]">
                                                    {TENANT_AVAILABLE_MODULES.filter(m => {
                                                        const userPerms = u.permissions || getDefaultPermissionsForRole(u.role);
                                                        return Boolean(userPerms[m.id]);
                                                    }).map(m => (
                                                        <span
                                                            key={m.id}
                                                            title={`${m.label}: ${m.description}`}
                                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                                        >
                                                            {m.badge}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1 line-clamp-1" title={roleDef.description}>
                                                    {roleDef.description}
                                                </p>
                                            </td>

                                            <td className="p-3 text-slate-600">
                                                <span className="font-medium">{u.sellingPointId || 'Main Store'}</span>
                                                {u.commissionRate && u.commissionRate > 0 ? (
                                                    <span className="block text-[10px] text-emerald-600 font-semibold">
                                                        {u.commissionRate}% {u.commissionType || 'sales'} commission
                                                    </span>
                                                ) : null}
                                            </td>

                                            <td className="p-3 text-center">
                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    u.status === 'active' 
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                                                }`}>
                                                    {u.status}
                                                </span>
                                            </td>

                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleToggleStatus(u)}
                                                        disabled={isPrimaryAdmin && u.status === 'active'}
                                                        className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                                                            u.status === 'active'
                                                                ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                                                : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                    >
                                                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenEdit(u)}
                                                        title="Edit role & credentials"
                                                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>

                                                    {!isPrimaryAdmin && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u)}
                                                            title="Delete account"
                                                            className="p-1 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
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

            {/* Footer Info */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 px-5 text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
                <div>
                    Multi-tenant security active · All accounts synchronized with central business ledger in real time.
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Real-time Socket.IO Sync Active</span>
                </div>
            </div>

            {/* ADD USER MODAL (Inside Content) */}
            {showAddModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <UserPlus size={18} className="text-emerald-400" />
                                <h4 className="font-bold text-sm text-white">Create Tenant User Account</h4>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUserSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Grace Wambui"
                                    value={newUserFullName}
                                    onChange={(e) => setNewUserFullName(e.target.value)}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Email / Username <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="e.g. grace@business.co.ke"
                                        value={newUserEmail}
                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="0712 345 678"
                                        value={newUserPhone}
                                        onChange={(e) => setNewUserPhone(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                                    />
                                </div>
                            </div>

                            {/* Role Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Departmental Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={newUserRole}
                                    onChange={(e) => {
                                        const role = e.target.value as TenantUserRole;
                                        setNewUserRole(role);
                                        setNewUserPermissions(getDefaultPermissionsForRole(role));
                                    }}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
                                >
                                    {TENANT_ROLE_DEFINITIONS.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.title} ({r.badge})
                                        </option>
                                    ))}
                                </select>
                                <div className="mt-2 space-y-1.5">
                                    <p className="text-[11px] text-slate-500 italic">
                                        {TENANT_ROLE_DEFINITIONS.find(r => r.id === newUserRole)?.description}
                                    </p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                        {TENANT_ROLE_DEFINITIONS.find(r => r.id === newUserRole)?.responsibilities.map((resp, i) => (
                                            <div key={i} className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                                <CheckCircle2 size={11} className="text-emerald-500" />
                                                <span>{resp}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RBAC Permission Customization */}
                            {renderPermissionsMatrix(
                                newUserPermissions,
                                (key, val) => setNewUserPermissions(prev => ({ ...prev, [key]: val })),
                                () => setNewUserPermissions(getDefaultPermissionsForRole(newUserRole)),
                                newUserRole
                            )}

                            {/* Station and Commission */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Assigned Station / Location
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Main Counter 1"
                                        value={newUserSellingPoint}
                                        onChange={(e) => setNewUserSellingPoint(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Sales Commission (%)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={newUserCommission}
                                        onChange={(e) => setNewUserCommission(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Access Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        placeholder="Strong secure password"
                                        value={newUserPassword}
                                        onChange={(e) => setNewUserPassword(e.target.value)}
                                        className="w-full text-xs pl-3 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-[10px] text-slate-400 italic">Passwords are SHA-256 hashed before transmission.</p>
                                    <button
                                        type="button"
                                        onClick={generateTemporaryPassword}
                                        className="text-[10px] font-bold text-blue-600 hover:underline"
                                    >
                                        Generate Temporary
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingUser}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                                >
                                    {creatingUser ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                    {creatingUser ? 'Provisioning...' : 'Provision Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER MODAL */}
            {editingUser && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Edit3 size={18} className="text-blue-400" />
                                <h4 className="font-bold text-sm text-white">Edit User: {editingUser.fullName}</h4>
                            </div>
                            <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditUser} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role & Authority</label>
                                <select
                                    value={editRole}
                                    onChange={(e) => {
                                        const role = e.target.value as TenantUserRole;
                                        setEditRole(role);
                                        setEditPermissions(getDefaultPermissionsForRole(role));
                                    }}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                >
                                    {TENANT_ROLE_DEFINITIONS.map(r => (
                                        <option key={r.id} value={r.id}>{r.title}</option>
                                    ))}
                                </select>
                                <div className="mt-2 space-y-1">
                                    <p className="text-[10px] text-slate-500">
                                        {TENANT_ROLE_DEFINITIONS.find(r => r.id === editRole)?.description}
                                    </p>
                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                        {TENANT_ROLE_DEFINITIONS.find(r => r.id === editRole)?.responsibilities.map((resp, i) => (
                                            <div key={i} className="flex items-center gap-1 text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                <Check size={10} className="text-emerald-600" />
                                                <span>{resp}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RBAC Permission Customization */}
                            {renderPermissionsMatrix(
                                editPermissions,
                                (key, val) => setEditPermissions(prev => ({ ...prev, [key]: val })),
                                () => setEditPermissions(getDefaultPermissionsForRole(editRole)),
                                editRole
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reset Password (Optional)</label>
                                <input
                                    type="password"
                                    placeholder="Leave blank to keep current password"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingUser}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                                >
                                    {isUpdatingUser ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                    {isUpdatingUser ? 'Saving...' : 'Update Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* UPGRADE MODAL */}
            {showUpgradeModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className="text-amber-400" />
                                <h4 className="font-bold text-sm text-white">Scale Your Business Infrastructure</h4>
                            </div>
                            <button onClick={() => setShowUpgradeModal(false)} className="text-white/60 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleUpgradeSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { id: 'starter', name: 'Starter', seats: 2, locations: 1, price: '$50/mo', desc: 'Up to 2 Users · Standard POS & Stock' },
                                    { id: 'pro', name: 'Standard / Pro', seats: 5, locations: 2, price: '$100/mo', desc: 'Up to 5 Users · Advanced POS, Reports & Accounting' },
                                    { id: 'enterprise', name: 'Professional / Enterprise', seats: 15, locations: 5, price: '$250/mo', desc: 'Up to 15 Users · Full ERP (Production, HR, Multi-Store)' },
                                    { id: 'distributor', name: 'Custom / Distributor', seats: 50, locations: 20, price: '$500/mo', desc: 'Up to 50 Users · Wholesale & Vendor Network' },
                                ].map(tier => (
                                    <div
                                        key={tier.id}
                                        onClick={() => setSelectedTier(tier.id)}
                                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                                            selectedTier === tier.id 
                                                ? 'border-emerald-600 bg-emerald-50/50' 
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-900 text-xs">{tier.name}</span>
                                                <span className="font-mono text-xs font-bold text-emerald-700">{tier.price}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 mb-2">{tier.desc}</div>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider bg-white/70 py-1 px-2 rounded border border-slate-100 flex items-center justify-between">
                                            <span>{tier.seats} User Seats</span>
                                            <span>{tier.locations} Location(s)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Extension / Validity Period</label>
                                <select
                                    value={selectedMonths}
                                    onChange={(e) => setSelectedMonths(parseInt(e.target.value, 10))}
                                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                >
                                    <option value={1}>1 Month (Standard Renewal)</option>
                                    <option value={3}>3 Months (Quarterly)</option>
                                    <option value={6}>6 Months (2.5% Duration Discount)</option>
                                    <option value={12}>12 Months / 1 Year (5% Duration Discount)</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingTier}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                >
                                    {isUpdatingTier ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    {isUpdatingTier ? 'Synchronizing...' : 'Apply Subscription Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    if (flat) {
        return content;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto font-sans animate-fade-in">
            {content}
        </div>
    );
};

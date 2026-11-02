import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, Search, RefreshCw, Filter, Calendar, User, Building2, 
    Tag, Clock, Shield, AlertTriangle, AlertCircle, Info, X, 
    Download, Eye, Copy, Check, Briefcase, ShoppingBag, Award, 
    UserCheck, Cpu, Layers, Activity, FileSpreadsheet
} from 'lucide-react';
import { useAppContext } from '../../context';
import * as api from '../../api';
import { AuditLog } from '../../types';

export const AuditLogTab: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Filters state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('all');
    const [selectedAction, setSelectedAction] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedSeverity, setSelectedSeverity] = useState('all');
    const [selectedTimeframe, setSelectedTimeframe] = useState('all');
    
    // Modal state for viewing log details
    const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);
    const [copiedJson, setCopiedJson] = useState(false);

    const { showToast, users = [] } = useAppContext();

    // Mapping from username to role
    const userRoleMap = useMemo(() => {
        const map: Record<string, string> = {};
        users.forEach(u => {
            if (u.username) {
                map[u.username.toLowerCase()] = u.role;
            }
        });
        return map;
    }, [users]);

    // Role resolution helper
    const resolveLogRole = (log: AuditLog): string => {
        if (log.userRole) return log.userRole.toLowerCase();
        if (log.role) return log.role.toLowerCase();
        const uname = (log.username || '').toLowerCase();
        if (userRoleMap[uname]) return userRoleMap[uname].toLowerCase();
        if (uname.includes('admin')) return 'admin';
        if (uname.includes('system') || uname.includes('daemon')) return 'system';
        if (log.details && typeof log.details === 'object') {
            if (log.details.role) return String(log.details.role).toLowerCase();
            if (log.details.userRole) return String(log.details.userRole).toLowerCase();
        }
        return 'staff';
    };

    // Category resolution helper
    const getActionCategory = (action: string): string => {
        const act = (action || '').toUpperCase();
        if (act.includes('USER') || act.includes('RBAC') || act.includes('LOGIN') || act.includes('AUTH') || act.includes('PASSWORD') || act.includes('PERMISSION')) {
            return 'Security & Access';
        }
        if (act.includes('INVENTORY') || act.includes('STOCK') || act.includes('PRODUCTION') || act.includes('BATCH') || act.includes('GRN') || act.includes('PO') || act.includes('WAREHOUSE')) {
            return 'Inventory & Production';
        }
        if (act.includes('SALE') || act.includes('POS') || act.includes('DISCOUNT') || act.includes('TRADER') || act.includes('MERCHANT') || act.includes('VENDOR')) {
            return 'Commercial & POS';
        }
        if (act.includes('FINANCE') || act.includes('JOURNAL') || act.includes('TAX') || act.includes('BILLING') || act.includes('SUBSCRIPTION') || act.includes('PAYMENT')) {
            return 'Finance & Billing';
        }
        return 'System & Maintenance';
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.getAuditLogs();
            setLogs(res || []);
        } catch (e) {
            console.error(e);
            showToast("Failed to fetch audit logs", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Unique action types in currently loaded logs
    const uniqueActions = useMemo(() => {
        const actions = new Set<string>();
        logs.forEach(l => {
            if (l.action) actions.add(l.action);
        });
        return Array.from(actions).sort();
    }, [logs]);

    // Unique roles found in logs
    const availableRoles = useMemo(() => {
        const roles = new Set<string>(['admin', 'manager', 'cashier', 'promoter', 'staff', 'system']);
        logs.forEach(l => {
            const role = resolveLogRole(l);
            if (role) roles.add(role);
        });
        return Array.from(roles);
    }, [logs, userRoleMap]);

    // Unique categories
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        logs.forEach(l => {
            cats.add(getActionCategory(l.action));
        });
        return Array.from(cats).sort();
    }, [logs]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        const now = Date.now();
        const lowerSearch = searchTerm.trim().toLowerCase();

        return logs.filter(log => {
            const logRole = resolveLogRole(log);
            const logCategory = getActionCategory(log.action);
            const logSeverity = (log.severity || 'info').toLowerCase();
            const logTime = new Date(log.timestamp).getTime();

            // 1. Role Filter
            if (selectedRole !== 'all' && logRole !== selectedRole.toLowerCase()) {
                return false;
            }

            // 2. Action Filter
            if (selectedAction !== 'all' && log.action !== selectedAction) {
                return false;
            }

            // 3. Category Filter
            if (selectedCategory !== 'all' && logCategory !== selectedCategory) {
                return false;
            }

            // 4. Severity Filter
            if (selectedSeverity !== 'all' && logSeverity !== selectedSeverity.toLowerCase()) {
                return false;
            }

            // 5. Timeframe Filter
            if (selectedTimeframe === 'today') {
                const oneDayMs = 24 * 60 * 60 * 1000;
                if (now - logTime > oneDayMs) return false;
            } else if (selectedTimeframe === '7days') {
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                if (now - logTime > sevenDaysMs) return false;
            } else if (selectedTimeframe === '30days') {
                const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                if (now - logTime > thirtyDaysMs) return false;
            }

            // 6. Free text search across role, username, action, category, traderName, details, severity
            if (lowerSearch) {
                const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details).toLowerCase() : String(log.details || '').toLowerCase();
                const matches = 
                    (log.username && log.username.toLowerCase().includes(lowerSearch)) ||
                    logRole.includes(lowerSearch) ||
                    (log.action && log.action.toLowerCase().includes(lowerSearch)) ||
                    logCategory.toLowerCase().includes(lowerSearch) ||
                    (log.traderName && log.traderName.toLowerCase().includes(lowerSearch)) ||
                    logSeverity.includes(lowerSearch) ||
                    detailsStr.includes(lowerSearch);

                if (!matches) return false;
            }

            return true;
        });
    }, [logs, searchTerm, selectedRole, selectedAction, selectedCategory, selectedSeverity, selectedTimeframe, userRoleMap]);

    // Metrics for system usage visibility
    const metrics = useMemo(() => {
        const totalEvents = logs.length;
        const uniqueUsers = new Set(logs.map(l => (l.username || 'System').toLowerCase())).size;
        const highRiskOps = logs.filter(l => {
            const act = (l.action || '').toUpperCase();
            const sev = (l.severity || '').toLowerCase();
            return sev === 'critical' || sev === 'warning' || act.includes('DELETE') || act.includes('RBAC') || act.includes('DROP');
        }).length;

        // Count categories
        const catCounts: Record<string, number> = {};
        logs.forEach(l => {
            const cat = getActionCategory(l.action);
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        let topCategory = 'None';
        let topCount = 0;
        Object.entries(catCounts).forEach(([cat, count]) => {
            if (count > topCount) {
                topCount = count;
                topCategory = cat;
            }
        });

        return { totalEvents, uniqueUsers, highRiskOps, topCategory, topCount };
    }, [logs]);

    // Role style helper
    const getRoleBadge = (role: string) => {
        switch (role.toLowerCase()) {
            case 'admin':
                return {
                    label: 'Admin',
                    icon: Shield,
                    classes: 'bg-purple-50 text-purple-700 border-purple-200'
                };
            case 'manager':
                return {
                    label: 'Manager',
                    icon: Briefcase,
                    classes: 'bg-blue-50 text-blue-700 border-blue-200'
                };
            case 'cashier':
                return {
                    label: 'Cashier',
                    icon: ShoppingBag,
                    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
                };
            case 'promoter':
                return {
                    label: 'Promoter',
                    icon: Award,
                    classes: 'bg-amber-50 text-amber-700 border-amber-200'
                };
            case 'staff':
                return {
                    label: 'Staff',
                    icon: UserCheck,
                    classes: 'bg-sky-50 text-sky-700 border-sky-200'
                };
            case 'system':
            default:
                return {
                    label: role ? role.toUpperCase() : 'System',
                    icon: Cpu,
                    classes: 'bg-slate-100 text-slate-700 border-slate-200'
                };
        }
    };

    // Severity style helper
    const getSeverityBadge = (severity: string = 'info') => {
        switch (severity.toLowerCase()) {
            case 'critical':
                return {
                    label: 'Critical',
                    icon: AlertCircle,
                    classes: 'bg-rose-50 text-rose-700 border-rose-200'
                };
            case 'warning':
                return {
                    label: 'Warning',
                    icon: AlertTriangle,
                    classes: 'bg-amber-50 text-amber-700 border-amber-200'
                };
            case 'info':
            default:
                return {
                    label: 'Info',
                    icon: Info,
                    classes: 'bg-slate-50 text-slate-600 border-slate-200'
                };
        }
    };

    // Reset all filters
    const resetFilters = () => {
        setSearchTerm('');
        setSelectedRole('all');
        setSelectedAction('all');
        setSelectedCategory('all');
        setSelectedSeverity('all');
        setSelectedTimeframe('all');
    };

    const hasActiveFilters = searchTerm !== '' || selectedRole !== 'all' || selectedAction !== 'all' || selectedCategory !== 'all' || selectedSeverity !== 'all' || selectedTimeframe !== 'all';

    // Export logs to CSV
    const exportLogsToCsv = () => {
        if (filteredLogs.length === 0) {
            showToast("No logs to export", "warning");
            return;
        }

        const headers = ["ID", "Timestamp", "Operator", "Role", "Trader / Merchant", "Action", "Category", "Severity", "Details"];
        const rows = filteredLogs.map(l => [
            l.id,
            l.timestamp,
            `"${(l.username || 'System').replace(/"/g, '""')}"`,
            `"${resolveLogRole(l).replace(/"/g, '""')}"`,
            `"${(l.traderName || 'Platform').replace(/"/g, '""')}"`,
            `"${(l.action || '').replace(/"/g, '""')}"`,
            `"${getActionCategory(l.action).replace(/"/g, '""')}"`,
            `"${(l.severity || 'info').replace(/"/g, '""')}"`,
            `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `system_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${filteredLogs.length} audit logs to CSV`, "success");
    };

    const handleCopyJson = () => {
        if (!inspectLog) return;
        navigator.clipboard.writeText(JSON.stringify(inspectLog, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    return (
        <div className="p-6 overflow-y-auto w-full h-full bg-slate-50">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Audit Trail</h2>
                            <p className="text-slate-500 text-xs">Administrative event oversight, user role tracking, and compliance telemetry.</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        id="audit-export-csv-btn"
                        onClick={exportLogsToCsv}
                        className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition shadow-sm text-slate-700 flex items-center gap-2 text-xs font-semibold"
                        title="Export filtered logs to CSV"
                    >
                        <Download size={15} className="text-slate-500" />
                        Export CSV
                    </button>
                    <button 
                        id="audit-refresh-logs-btn"
                        onClick={fetchLogs}
                        className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center gap-2 text-xs font-semibold"
                    >
                        <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
                        Refresh Feed
                    </button>
                </div>
            </div>

            {/* System Usage Overview Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Events</span>
                        <Activity size={16} className="text-blue-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{metrics.totalEvents}</span>
                        <span className="text-xs text-slate-400">logged</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Operators</span>
                        <User size={16} className="text-purple-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{metrics.uniqueUsers}</span>
                        <span className="text-xs text-slate-400">unique actors</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">High-Risk Actions</span>
                        <AlertTriangle size={16} className="text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-amber-600">{metrics.highRiskOps}</span>
                        <span className="text-xs text-slate-400">warning / critical</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Primary Activity</span>
                        <Layers size={16} className="text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate" title={metrics.topCategory}>{metrics.topCategory}</span>
                        <span className="text-xs text-slate-400">({metrics.topCount})</span>
                    </div>
                </div>
            </div>

            {/* Filter Controls Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Free Search Input */}
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            id="audit-search-input"
                            type="text"
                            placeholder="Search by username, role, action, merchant, or JSON payload..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 text-xs font-medium text-slate-800 transition"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter by User Role */}
                    <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Shield size={16} />
                        </div>
                        <select 
                            id="audit-role-filter"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full pl-10 pr-8 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl outline-none appearance-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 text-xs font-semibold text-slate-700 transition cursor-pointer"
                        >
                            <option value="all">All User Roles</option>
                            {availableRoles.map(role => (
                                <option key={role} value={role}>
                                    Role: {role.charAt(0).toUpperCase() + role.slice(1)}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Filter size={12} />
                        </div>
                    </div>

                    {/* Filter by Action Type */}
                    <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Tag size={16} />
                        </div>
                        <select 
                            id="audit-action-filter"
                            value={selectedAction}
                            onChange={(e) => setSelectedAction(e.target.value)}
                            className="w-full pl-10 pr-8 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl outline-none appearance-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 text-xs font-semibold text-slate-700 transition cursor-pointer"
                        >
                            <option value="all">All Action Types</option>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>
                                    {action.replace(/_/g, ' ').toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Filter size={12} />
                        </div>
                    </div>
                </div>

                {/* Secondary row for Category, Severity, and Timeframe */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 items-center">
                    {/* Action Category Filter */}
                    <div className="relative">
                        <select 
                            id="audit-category-filter"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl outline-none text-xs font-medium text-slate-700 cursor-pointer"
                        >
                            <option value="all">All Activity Categories</option>
                            {availableCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Severity Filter */}
                    <div className="relative">
                        <select 
                            id="audit-severity-filter"
                            value={selectedSeverity}
                            onChange={(e) => setSelectedSeverity(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl outline-none text-xs font-medium text-slate-700 cursor-pointer"
                        >
                            <option value="all">All Severities</option>
                            <option value="info">Info Level</option>
                            <option value="warning">Warning Level</option>
                            <option value="critical">Critical Level</option>
                        </select>
                    </div>

                    {/* Timeframe Filter */}
                    <div className="relative">
                        <select 
                            id="audit-timeframe-filter"
                            value={selectedTimeframe}
                            onChange={(e) => setSelectedTimeframe(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl outline-none text-xs font-medium text-slate-700 cursor-pointer"
                        >
                            <option value="all">Timeline: All Time</option>
                            <option value="today">Today (Last 24 Hours)</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 30 Days</option>
                        </select>
                    </div>

                    {/* Filter Status & Reset Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                            Showing <strong className="text-slate-900">{filteredLogs.length}</strong> of {logs.length}
                        </span>
                        {hasActiveFilters && (
                            <button
                                id="audit-reset-filters-btn"
                                onClick={resetFilters}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline flex items-center gap-1"
                            >
                                <X size={13} /> Reset Filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Active Filter Chips */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-700 border border-slate-200">
                                Search: "{searchTerm}"
                                <X size={12} className="cursor-pointer hover:text-slate-900" onClick={() => setSearchTerm('')} />
                            </span>
                        )}
                        {selectedRole !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-purple-50 text-purple-700 border border-purple-200">
                                Role: {selectedRole}
                                <X size={12} className="cursor-pointer hover:text-purple-900" onClick={() => setSelectedRole('all')} />
                            </span>
                        )}
                        {selectedAction !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-blue-50 text-blue-700 border border-blue-200">
                                Action: {selectedAction}
                                <X size={12} className="cursor-pointer hover:text-blue-900" onClick={() => setSelectedAction('all')} />
                            </span>
                        )}
                        {selectedCategory !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Category: {selectedCategory}
                                <X size={12} className="cursor-pointer hover:text-emerald-900" onClick={() => setSelectedCategory('all')} />
                            </span>
                        )}
                        {selectedSeverity !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-amber-50 text-amber-700 border border-amber-200">
                                Severity: {selectedSeverity}
                                <X size={12} className="cursor-pointer hover:text-amber-900" onClick={() => setSelectedSeverity('all')} />
                            </span>
                        )}
                        {selectedTimeframe !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-sky-50 text-sky-700 border border-sky-200">
                                Timeframe: {selectedTimeframe}
                                <X size={12} className="cursor-pointer hover:text-sky-900" onClick={() => setSelectedTimeframe('all')} />
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Audit Log Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Operator & Role</th>
                                <th className="px-6 py-4">Operation Type</th>
                                <th className="px-6 py-4">Severity</th>
                                <th className="px-6 py-4">Activity Payload</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-6 h-16 bg-slate-50/30"></td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <ClipboardList size={32} className="mx-auto text-slate-300" />
                                            <p className="font-medium text-slate-700">No audit entries found</p>
                                            <p className="text-xs text-slate-400">Try adjusting your search query, role filter, or action selection.</p>
                                            {hasActiveFilters && (
                                                <button
                                                    onClick={resetFilters}
                                                    className="mt-3 px-3 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                                                >
                                                    Clear All Filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => {
                                    const role = resolveLogRole(log);
                                    const roleInfo = getRoleBadge(role);
                                    const RoleIcon = roleInfo.icon;
                                    const severityInfo = getSeverityBadge(log.severity);
                                    const SeverityIcon = severityInfo.icon;
                                    const category = getActionCategory(log.action);

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/70 transition duration-150">
                                            {/* Timestamp */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-slate-700 font-mono font-medium">
                                                    <Clock size={13} className="text-slate-400" />
                                                    <span>
                                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5 font-mono">
                                                    <Calendar size={12} />
                                                    <span>
                                                        {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Operator and User Role */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-slate-800">{log.username || 'System Daemon'}</span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${roleInfo.classes}`}>
                                                        <RoleIcon size={11} />
                                                        {roleInfo.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                    <Building2 size={12} className="text-slate-400" />
                                                    <span>{log.traderName || 'Root Platform'}</span>
                                                </div>
                                            </td>

                                            {/* Operation Type & Category */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className={`font-semibold uppercase tracking-wider text-[11px] px-2 py-1 rounded-md border ${
                                                        log.action.includes('DELETE') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        log.action.includes('LOGIN') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        log.action.includes('CREATE') ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                        log.action.includes('RBAC') ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                        'bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {log.action.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {category}
                                                </span>
                                            </td>

                                            {/* Severity */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${severityInfo.classes}`}>
                                                    <SeverityIcon size={11} />
                                                    {severityInfo.label}
                                                </span>
                                            </td>

                                            {/* Payload */}
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                                                    {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '-')}
                                                </div>
                                            </td>

                                            {/* Action / Inspect */}
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => setInspectLog(log)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition border border-blue-100"
                                                    title="Inspect Event Payload"
                                                >
                                                    <Eye size={13} />
                                                    Inspect
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit Log Detail Inspector Modal */}
            {inspectLog && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                    <ClipboardList size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">Audit Event Inspector</h3>
                                    <p className="text-slate-400 text-xs font-mono">ID: #{inspectLog.id} • {new Date(inspectLog.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setInspectLog(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {/* Actor & Action Card */}
                            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operator</span>
                                    <p className="font-semibold text-slate-800 mt-0.5">{inspectLog.username || 'System Daemon'}</p>
                                    <span className="text-[11px] text-slate-500">{inspectLog.traderName || 'Root Platform'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Role</span>
                                    <div className="mt-1">
                                        {(() => {
                                            const role = resolveLogRole(inspectLog);
                                            const badge = getRoleBadge(role);
                                            const RoleIcon = badge.icon;
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${badge.classes}`}>
                                                    <RoleIcon size={12} />
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Action Type</span>
                                    <p className="font-bold text-slate-800 uppercase mt-0.5">{inspectLog.action.replace(/_/g, ' ')}</p>
                                    <span className="text-[11px] text-slate-500">{getActionCategory(inspectLog.action)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Severity Level</span>
                                    <div className="mt-1">
                                        {(() => {
                                            const sev = getSeverityBadge(inspectLog.severity);
                                            const SevIcon = sev.icon;
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${sev.classes}`}>
                                                    <SevIcon size={12} />
                                                    {sev.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Structured Key-Value Breakdown */}
                            {typeof inspectLog.details === 'object' && inspectLog.details !== null && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Structured Event Payload</h4>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                                        {Object.entries(inspectLog.details).map(([key, val]) => (
                                            <div key={key} className="flex items-start justify-between p-2.5 hover:bg-slate-50/50">
                                                <span className="font-semibold text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                                                <span className="font-mono text-slate-800 text-right max-w-xs break-all">
                                                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Raw JSON viewer */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Raw JSON Data</h4>
                                    <button
                                        onClick={handleCopyJson}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition"
                                    >
                                        {copiedJson ? (
                                            <>
                                                <Check size={13} className="text-emerald-600" />
                                                <span className="text-emerald-600">Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={13} />
                                                <span>Copy JSON</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto max-h-48 leading-relaxed">
                                    {JSON.stringify(inspectLog, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/30">
                            <button
                                onClick={() => setInspectLog(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-xs"
                            >
                                Close Inspector
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

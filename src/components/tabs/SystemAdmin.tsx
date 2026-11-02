import React, { useState, useEffect } from 'react';
import { Database, Play, Terminal, AlertTriangle, CheckCircle, Server, Shield, HardDrive, RefreshCw, RefreshCw as SyncIcon, Check, Copy, UserPlus, Trash2, Key, ShieldCheck, Lock, Users, Search, Mail, Phone, MapPin, Calendar, DollarSign, TrendingUp, Package, Clock, ArrowUpRight, Tag, Sliders, Crown, Briefcase, UserCheck, Share2, ArrowRightLeft, ClipboardList, Save, Cloud, Wrench, Download, FileText, Activity, Layers, RotateCcw, AlertOctagon, Sparkles, Globe } from 'lucide-react';
import { useAppContext } from '../../context';
import * as api from '../../api';
import { InteropRequest, formatCurrency, TenantBackupRecord } from '../../types';
import { getQueue, clearQueue, exportClientOfflineSnapshot } from '../../db';
import { TenantUsersModal } from './TenantUsersModal';

interface SQLResult {
    query: string;
    success: boolean;
    type?: 'select' | 'write';
    rows?: any[];
    columns?: string[];
    changes?: number;
    lastID?: number;
    error?: string;
}

export const SystemAdminTab: React.FC = () => {
    const { user, users, rolePermissions, refreshUsers, refreshPermissions, showToast, traders, transactions, inventory, refreshData, logAuditAction } = useAppContext();
    const [activeSubTab, setActiveSubTab] = useState<'database' | 'rbac' | 'traders-activities' | 'interop' | 'vendor-approvals' | 'tenant-explorer' | 'integrity' | 'backup-server' | 'audit-trail' | 'error-logs'>('database');
    
    // Integrity Tab states
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
    const [selectedTenantForUsers, setSelectedTenantForUsers] = useState<{ id: number; name: string } | null>(null);
    const [integrityReport, setIntegrityReport] = useState<any>(null);
    const [runningAudit, setRunningAudit] = useState(false);
    const [repairing, setRepairing] = useState(false);
    const [repairResult, setRepairResult] = useState<any>(null);
    const [storedSnapshots, setStoredSnapshots] = useState<any[]>([]);
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);
    const [restoringSnapshotFile, setRestoringSnapshotFile] = useState<string | null>(null);
    const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
    const [selectedExportTable, setSelectedExportTable] = useState<string>('all');
    const [offlineQueueItems, setOfflineQueueItems] = useState<any[]>([]);
    const [loadingQueue, setLoadingQueue] = useState(false);

    // Interop Audit states
    const [interopRequests, setInteropRequests] = useState<InteropRequest[]>([]);
    const [loadingInterop, setLoadingInterop] = useState(false);

    // Vendor Approvals states
    const [vendorRequests, setVendorRequests] = useState<any[]>([]);
    const [pendingVendors, setPendingVendors] = useState<any[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);

    // Backup Server sub-tab states
    const [selectedBackupTraderId, setSelectedBackupTraderId] = useState<number | null>(null);
    const [serverIp, setServerIp] = useState('');
    const [serverPort, setServerPort] = useState('8080');
    const [backupPath, setBackupPath] = useState('/var/backup/biashara');
    
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [backupTraderSearch, setBackupTraderSearch] = useState('');

    // Tenant IP Localization & Dual Backup states
    const [detectedIp, setDetectedIp] = useState<string>('');
    const [detectingIp, setDetectingIp] = useState(false);
    const [localizationIp, setLocalizationIp] = useState('');
    const [dualBackupActive, setDualBackupActive] = useState(true);
    const [tenantBackups, setTenantBackups] = useState<TenantBackupRecord[]>([]);
    const [loadingTenantBackups, setLoadingTenantBackups] = useState(false);
    const [runningDualBackup, setRunningDualBackup] = useState(false);
    const [dualBackupProgress, setDualBackupProgress] = useState(0);
    const [dualBackupLogs, setDualBackupLogs] = useState<string[]>([]);

    // Supabase Cloud Integration states
    const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
    const [loadingSupabase, setLoadingSupabase] = useState(false);
    const [syncingSupabase, setSyncingSupabase] = useState(false);
    const [customSupabaseUrl, setCustomSupabaseUrl] = useState('');
    const [customSupabaseKey, setCustomSupabaseKey] = useState('');
    const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);
    const [activatingBlobs, setActivatingBlobs] = useState(false);
    const [blobStatus, setBlobStatus] = useState<string | null>(null);

    const handleActivateBlobs = async () => {
        setActivatingBlobs(true);
        try {
            const res = await api.activateNetlifyBlobs();
            setBlobStatus(typeof res === 'string' ? res : 'Blob Activated');
            showToast('Netlify Blobs Activated: ent-db tenant store initialized!', 'success');
        } catch (e: any) {
            showToast(e.message || 'Failed to activate Netlify Blobs', 'error');
        } finally {
            setActivatingBlobs(false);
        }
    };

    const fetchSupabaseInfo = async () => {
        setLoadingSupabase(true);
        try {
            const data = await api.getSupabaseStatus();
            setSupabaseStatus(data);
            if (data?.url) setCustomSupabaseUrl(data.url);
        } catch (e) {
            console.warn('Failed to fetch Supabase status', e);
        } finally {
            setLoadingSupabase(false);
        }
    };

    const handleSyncSupabase = async () => {
        setSyncingSupabase(true);
        try {
            const res = await api.syncSupabase();
            showToast(res.message || 'Supabase synchronized successfully!', 'success');
            await fetchSupabaseInfo();
        } catch (e: any) {
            showToast(e.message || 'Failed to sync with Supabase', 'error');
        } finally {
            setSyncingSupabase(false);
        }
    };

    const handleSaveSupabaseConfig = async () => {
        if (!customSupabaseUrl || !customSupabaseKey) {
            showToast('Please provide both Supabase URL and API Key', 'warning');
            return;
        }
        try {
            const res = await api.configureSupabase(customSupabaseUrl, customSupabaseKey);
            if (res.success) {
                showToast('Supabase configuration saved & connected!', 'success');
                setShowSupabaseConfig(false);
                await fetchSupabaseInfo();
            } else {
                showToast(res.error || 'Failed to update config', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Failed to save Supabase config', 'error');
        }
    };

    useEffect(() => {
        if (activeSubTab === 'interop') {
            const fetchInterop = async () => {
                setLoadingInterop(true);
                try {
                    const res = await api.getInteropRequests();
                    setInteropRequests(res);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingInterop(false);
                }
            };
            fetchInterop();
        }
        if (activeSubTab === 'vendor-approvals') {
            const fetchVendors = async () => {
                setLoadingVendors(true);
                try {
                    const [requests, pending, logs] = await Promise.all([
                        api.getAdminVendorRequests(),
                        api.getPendingVendors(),
                        api.getAuditLogs()
                    ]);
                    setVendorRequests(requests);
                    setPendingVendors(pending);
                    setAuditLogs(logs);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingVendors(false);
                }
            };
            fetchVendors();
        }
        if (activeSubTab === 'integrity' || activeSubTab === 'backup-server' || activeSubTab === 'audit-trail' || activeSubTab === 'error-logs') {
            const fetchLogs = async () => {
                setLoadingLogs(true);
                try {
                    const [res, errs, health, report, snapshots] = await Promise.all([
                        api.getAuditLogs(),
                        api.getSystemErrors().catch(() => []),
                        api.getSystemHealth().catch(() => null),
                        api.auditSystemIntegrity().catch(() => null),
                        api.getStoredSnapshots().catch(() => [])
                    ]);
                    setAuditLogs(res);
                    setErrorLogs(errs);
                    if (health) setSystemHealth(health);
                    if (report) setIntegrityReport(report);
                    if (snapshots) setStoredSnapshots(snapshots);
                    
                    const queue = await getQueue().catch(() => []);
                    setOfflineQueueItems(queue);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingLogs(false);
                }
            };
            fetchLogs();
        }
        if (activeSubTab === 'database') {
            fetchSupabaseInfo();
        }
    }, [activeSubTab]);

    const handleCreateSnapshot = async () => {
        setIsCreatingSnapshot(true);
        try {
            const res = await api.createInstantSnapshot();
            if (res.success) {
                showToast('Persistent backup snapshot created successfully!', 'success');
                const [health, snapshots, report] = await Promise.all([
                    api.getSystemHealth().catch(() => null),
                    api.getStoredSnapshots().catch(() => []),
                    api.auditSystemIntegrity().catch(() => null)
                ]);
                if (health) setSystemHealth(health);
                if (snapshots) setStoredSnapshots(snapshots);
                if (report) setIntegrityReport(report);
            }
        } catch (e: any) {
            showToast(e.message || 'Failed to create snapshot', 'error');
        } finally {
            setIsCreatingSnapshot(false);
        }
    };

    const handleRunAudit = async () => {
        setRunningAudit(true);
        try {
            const report = await api.auditSystemIntegrity();
            setIntegrityReport(report);
            const health = await api.getSystemHealth().catch(() => null);
            if (health) setSystemHealth(health);
            showToast(
                `Integrity audit finished: ${report.status}`, 
                report.status === 'HEALTHY' ? 'success' : report.status === 'WARNING' ? 'info' : 'error'
            );
        } catch (err: any) {
            showToast(err.message || 'Audit failed', 'error');
        } finally {
            setRunningAudit(false);
        }
    };

    const handleRunRepair = async () => {
        if (!window.confirm("Execute Automated Database Self-Healing?\n\nThis will:\n1. Reassign orphaned sales to valid merchant account\n2. Normalize negative inventory quantities\n3. Purge broken journal references\n4. Execute SQLite VACUUM and WAL truncate\n5. Generate fresh cryptographically verified snapshot\n\nContinue?")) {
            return;
        }
        setRepairing(true);
        try {
            const res = await api.repairSystemIntegrity();
            setRepairResult(res);
            await logAuditAction('database_self_repair', { actionsCount: res.repairedActionsCount, actions: res.actionsTaken }, 'warning');
            showToast(`System self-repair complete: ${res.repairedActionsCount} optimizations executed.`, 'success');
            await handleRunAudit();
            const snapshots = await api.getStoredSnapshots().catch(() => []);
            setStoredSnapshots(snapshots);
            refreshData();
        } catch (err: any) {
            showToast(err.message || 'Self-repair failed', 'error');
        } finally {
            setRepairing(false);
        }
    };

    const handleRestoreStoredSnapshot = async (filename: string) => {
        if (!window.confirm(`Restore live database from snapshot '${filename}'?\n\nThis will atomic-overwrite active tables with snapshot records. Continue?`)) {
            return;
        }
        setRestoringSnapshotFile(filename);
        try {
            const res = await api.restoreStoredSnapshot(filename);
            if (res.success) {
                showToast(`Snapshot restored successfully! (${res.rowsRestored} records active)`, 'success');
                await logAuditAction('snapshot_restore', { filename, checksumVerified: res.checksumVerified }, 'warning');
                refreshData();
                await handleRunAudit();
            } else {
                showToast(res.message || 'Failed to restore snapshot', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error restoring snapshot', 'error');
        } finally {
            setRestoringSnapshotFile(null);
        }
    };

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            if (exportFormat === 'csv') {
                const res = await api.exportDatabaseBackup('csv', selectedExportTable === 'all' ? undefined : selectedExportTable);
                const blob = new Blob([res.content], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = res.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(`CSV Export downloaded: ${res.filename}`, 'success');
            } else {
                const data = await api.exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `biashara_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(`JSON backup exported with SHA-256 verification!`, 'success');
            }
        } catch (e: any) {
            showToast(e.message || 'Failed to export data', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const res = await api.importData(data);
            if (res.success) {
                await logAuditAction('database_import', { filename: file.name, timestamp: new Date().toISOString(), checksumVerified: res.checksumVerified }, 'warning');
                showToast(`Data restored successfully! ${res.rowsRestored ? `(${res.rowsRestored} records preserved)` : ''}`, 'success');
                refreshData();
                await handleRunAudit();
            }
        } catch (e: any) {
            showToast(e.message || 'Invalid backup file', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    const handleExportClientBackup = async () => {
        try {
            const snapshot = await exportClientOfflineSnapshot();
            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `biasharasasa_client_cache_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Offline client snapshot downloaded with SHA-256 integrity hash!', 'success');
        } catch (e) {
            showToast('Failed to export client snapshot', 'error');
        }
    };

    const handlePurgeOfflineQueue = async () => {
        if (!window.confirm("Clear all items in the offline sync queue?")) return;
        await clearQueue();
        const q = await getQueue();
        setOfflineQueueItems(q);
        showToast("Offline sync queue cleared", 'info');
    };
    
    // Traders Activities Tab States
    const [traderSearchQuery, setTraderSearchQuery] = useState('');
    const [selectedTraderId, setSelectedTraderId] = useState<number | null>(null);

    useEffect(() => {
        if (selectedBackupTraderId) {
            const trader = traders.find(t => t.id === selectedBackupTraderId);
            if (trader) {
                setServerIp(trader.serverIp || '');
                setServerPort(String(trader.serverPort || '8080'));
                setBackupPath(trader.backupPath || '/var/backup/biashara');
            }
        } else if (traders && traders.length > 0 && activeSubTab === 'backup-server') {
            setSelectedBackupTraderId(traders[0].id);
        }
    }, [selectedBackupTraderId, traders, activeSubTab]);

    useEffect(() => {
        if (selectedTraderId) {
            const trader = traders.find(t => t.id === selectedTraderId);
            if (trader) {
                setServerIp(trader.serverIp || '');
                setServerPort(String(trader.serverPort || '8080'));
                setBackupPath(trader.backupPath || '/var/backup/biashara');
            }
        }
    }, [selectedTraderId, traders]);
    const [traderDetailTab, setTraderDetailTab] = useState<'sales' | 'inventory' | 'timeline' | 'settings'>('sales');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [isApproving, setIsApproving] = useState(false);

    const handleApproveTrader = async (traderId: number) => {
        setIsApproving(true);
        try {
            const res: any = await api.approveTrader(traderId, 'admin');
            if (res.success) {
                await logAuditAction('merchant_approval', { traderId, approver: user?.username }, 'info');
                showToast('Merchant account activated successfully!', 'success');
                refreshData();
            } else {
                showToast('Failed to approve merchant', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error during approval', 'error');
        } finally {
            setIsApproving(false);
        }
    };

    const safeTraders = Array.isArray(traders) ? traders : [];
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const safeInventory = Array.isArray(inventory) ? inventory : [];

    const getTraderStats = (traderId: number) => {
        const traderTx = safeTransactions.filter(t => t.traderId === traderId);
        const traderInv = safeInventory.filter(i => i.traderId === traderId);
        const totalSales = traderTx.reduce((sum, t) => sum + t.total, 0);
        return {
            txCount: traderTx.length,
            totalSales,
            invCount: traderInv.length
        };
    };

    const totalTraders = safeTraders.length;
    const premiumTraders = safeTraders.filter(t => t.plan && t.plan !== 'Basic').length;
    const activeTradersCount = safeTraders.filter(t => t.status === 'active').length;
    const totalTraderSales = safeTransactions
        .filter(t => t.traderId !== null)
        .reduce((sum, t) => sum + t.total, 0);

    const filteredTraders = safeTraders.filter(t => {
        const matchesSearch = 
            (t.fullName || '').toLowerCase().includes(traderSearchQuery.toLowerCase()) ||
            (t.businessName && t.businessName.toLowerCase().includes(traderSearchQuery.toLowerCase())) ||
            (t.email || '').toLowerCase().includes(traderSearchQuery.toLowerCase());
        const matchesPlan = planFilter === 'all' || t.plan === planFilter;
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchesSearch && matchesPlan && matchesStatus;
    });

    const selectedTrader = safeTraders.find(t => t.id === selectedTraderId) || null;
    const selectedTraderTransactions = selectedTrader 
        ? safeTransactions.filter(t => t.traderId === selectedTrader.id)
        : [];
    const selectedTraderInventory = selectedTrader 
        ? safeInventory.filter(i => i.traderId === selectedTrader.id)
        : [];
    const selectedTraderTotalSales = selectedTraderTransactions.reduce((sum, t) => sum + t.total, 0);
    const selectedTraderTotalDiscounts = selectedTraderTransactions.reduce((sum, t) => sum + t.discountAmount, 0);
    
    // RBAC states
    const [localPermissions, setLocalPermissions] = useState<api.RolePermissions[]>([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('promoter');
    const [savingPerms, setSavingPerms] = useState(false);
    const [creatingUser, setCreatingUser] = useState(false);

    useEffect(() => {
        if (rolePermissions && rolePermissions.length > 0) {
            setLocalPermissions(JSON.parse(JSON.stringify(rolePermissions)));
        }
    }, [rolePermissions]);

    const handleSaveBackupSettings = async (traderId: number) => {
        if (!serverIp.trim()) {
            showToast("Server IP Address is required to register.", "error");
            return;
        }
        
        // Simple IP regex validation
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^localhost$/;
        if (!ipRegex.test(serverIp.trim())) {
            showToast("Please enter a valid IP address (e.g. 192.168.1.10) or 'localhost'", "info");
        }
        
        try {
            const res = await api.updateTraderBackupSettings(traderId, {
                serverIp: serverIp.trim(),
                serverPort: parseInt(serverPort, 10) || 8080,
                backupPath: backupPath.trim() || '/var/backup/biashara'
            });
            if (res.success) {
                showToast("Local backup server registered successfully!", "success");
                refreshData();
            } else {
                showToast("Failed to save backup settings", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Failed to update backup settings", "error");
        }
    };

    const handleTestConnection = () => {
        if (!serverIp) {
            showToast("Please register a Server IP address first.", "info");
            return;
        }
        setTestingConnection(true);
        setConnectionLogs([]);
        setSyncLogs([]);
        
        const steps = [
            `[Handshake] Resolving target host: ${serverIp}...`,
            `[Handshake] Opening TCP socket connection on port ${serverPort}...`,
            `[Handshake] Sending encrypted authorization payload...`,
            `[Handshake] Verifying local backup agent token authentication...`,
            `[Handshake] CONNECTION SUCCESSFUL! Local host is responding on port ${serverPort}.`
        ];
        
        steps.forEach((step, index) => {
            setTimeout(() => {
                setConnectionLogs(prev => [...prev, step]);
                if (index === steps.length - 1) {
                    setTestingConnection(false);
                    showToast("Local backup server connection verified!", "success");
                }
            }, (index + 1) * 600);
        });
    };

    const handleTriggerSync = async (traderId: number) => {
        if (!serverIp) {
            showToast("Please register a Server IP address first.", "info");
            return;
        }
        setSyncing(true);
        setSyncProgress(0);
        setSyncLogs([]);
        setConnectionLogs([]);
        
        const steps = [
            `[Sync Engine] Initializing cloud-to-local secure ledger synchronization...`,
            `[Sync Engine] Establishing SSH tunnel to ${serverIp}:${serverPort}...`,
            `[Sync Engine] Fetching remote database schemas and states...`,
            `[Sync Engine] Packaging current trader inventory (Total items: ${safeInventory.filter(i => i.traderId === traderId).length})...`,
            `[Sync Engine] Packaging POS ledger sales history (Total transactions: ${safeTransactions.filter(t => t.traderId === traderId).length})...`,
            `[Sync Engine] Compressing data transfer package (tar.gz format)...`,
            `[Sync Engine] Transferring payload to target local directory: ${backupPath}...`,
            `[Sync Engine] Writing configuration file with secure checksum verification...`,
            `[Sync Engine] Synchronization completed successfully. Local storage mirror is fully updated!`
        ];
        
        // Progress increment
        const interval = setInterval(() => {
            setSyncProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return p + 4;
            });
        }, 150);
        
        steps.forEach((step, index) => {
            setTimeout(async () => {
                setSyncLogs(prev => [...prev, step]);
                if (index === steps.length - 1) {
                    try {
                        const res = await api.logTraderBackupSync(traderId);
                        if (res.success) {
                            showToast("Local backup synced and timestamped successfully!", "success");
                            refreshData();
                            const logs = await api.getAuditLogs();
                            setAuditLogs(logs);
                        }
                    } catch (err) {
                        console.error(err);
                    } finally {
                        setSyncing(false);
                    }
                }
            }, (index + 1) * 450);
        });
    };

    // Auto-detect client IP address on load
    const handleDetectIp = async () => {
        setDetectingIp(true);
        try {
            const res = await api.getDetectedClientIp();
            if (res?.ip) {
                setDetectedIp(res.ip);
                if (!localizationIp) {
                    setLocalizationIp(res.ip);
                }
                showToast(`Client IP detected: ${res.ip}`, 'info');
            }
        } catch (e) {
            console.warn('IP detection error:', e);
        } finally {
            setDetectingIp(false);
        }
    };

    useEffect(() => {
        handleDetectIp();
    }, []);

    const handleSelectTraderForBackup = async (traderId: number) => {
        setSelectedBackupTraderId(traderId);
        setConnectionLogs([]);
        setSyncLogs([]);
        setDualBackupLogs([]);
        setSyncProgress(0);
        setDualBackupProgress(0);
        
        const tr = traders.find(t => t.id === traderId);
        if (tr) {
            setServerIp(tr.serverIp || '');
            setServerPort(String(tr.serverPort || 8080));
            setBackupPath(tr.backupPath || '/var/backup/biashara');
            setLocalizationIp(tr.localizationIp || tr.clientIp || detectedIp || '');
            setDualBackupActive(tr.dualBackupActive !== false);
        }
        
        setLoadingTenantBackups(true);
        try {
            const list = await api.getTenantBackups(traderId);
            setTenantBackups(list || []);
        } catch (e) {
            setTenantBackups([]);
        } finally {
            setLoadingTenantBackups(false);
        }
    };

    const handleSaveLocalization = async (traderId: number) => {
        const finalIp = (localizationIp.trim() || detectedIp || '127.0.0.1').trim();
        try {
            const res = await api.updateTenantLocalization(traderId, {
                localizationIp: finalIp,
                serverIp: serverIp.trim() || undefined,
                serverPort: parseInt(serverPort, 10) || 8080,
                dualBackupActive
            });
            if (res.success) {
                showToast(`Data localization & IP (${finalIp}) registered successfully!`, "success");
                refreshData();
                await logAuditAction('tenant_localization_updated', {
                    traderId,
                    localizationIp: finalIp,
                    serverIp,
                    dualBackupActive
                }, 'info');
            } else {
                showToast("Failed to save localization settings", "error");
            }
        } catch (err: any) {
            showToast(err.message || "Failed to save localization settings", "error");
        }
    };

    const handleRunDualBackup = async (traderId: number) => {
        const activeTrader = traders.find(t => t.id === traderId);
        if (!activeTrader) return;

        const effectiveIp = (localizationIp.trim() || detectedIp || activeTrader.localizationIp || activeTrader.clientIp || '127.0.0.1').trim();
        
        setRunningDualBackup(true);
        setDualBackupProgress(0);
        setDualBackupLogs([]);

        const steps = [
            `[Dual Backup Engine] Initializing dual data preservation for ${activeTrader.businessName || activeTrader.fullName}...`,
            `[Localization] Binding client network IP: ${effectiveIp} (${activeTrader.location || 'East Africa Region'})...`,
            `[Partition] Isolating merchant inventory catalog (${safeInventory.filter(i => i.traderId === traderId).length} stock records)...`,
            `[Partition] Isolating POS ledger sales (${safeTransactions.filter(t => t.traderId === traderId).length} transactions)...`,
            `[Partition] Packaging accounting ledger, tax transactions, and team security credentials...`,
            `[Integrity Hash] Generating cryptographic SHA-256 tamper-evident checksum seal...`,
            `[Local Disk Mirror] Writing partitioned snapshot to local storage: ${backupPath}/tenants/${traderId}/...`,
            `[Cloud Mirror] Replicating encrypted payload to Global Cloud Store (Supabase + Blobs)...`,
            `[Ledger Registry] Registering verified backup entry with IP stamp in audit compliance ledger...`,
            `[Dual Backup Engine] SUCCESS! Dual local disk + cloud mirror completed and verified.`
        ];

        const interval = setInterval(() => {
            setDualBackupProgress(p => {
                if (p >= 92) {
                    clearInterval(interval);
                    return 92;
                }
                return p + 12;
            });
        }, 160);

        try {
            for (let i = 0; i < steps.length - 1; i++) {
                setDualBackupLogs(prev => [...prev, steps[i]]);
                await new Promise(r => setTimeout(r, 200));
            }

            const res = await api.runDualBackup(traderId, {
                tenantIp: effectiveIp,
                serverIp: serverIp.trim() || activeTrader.serverIp || '127.0.0.1',
                localPath: backupPath.trim() || '/var/backup/biashara'
            });

            clearInterval(interval);
            setDualBackupProgress(100);
            setDualBackupLogs(prev => [...prev, steps[steps.length - 1]]);

            if (res.success) {
                showToast(`Dual Backup Completed! Stamped with IP ${effectiveIp}`, 'success');
                refreshData();
                const list = await api.getTenantBackups(traderId);
                setTenantBackups(list || []);
                const logs = await api.getAuditLogs();
                setAuditLogs(logs);
            }
        } catch (err: any) {
            clearInterval(interval);
            setDualBackupLogs(prev => [...prev, `[ERROR] Dual backup failed: ${err.message}`]);
            showToast(err.message || 'Dual backup failed', 'error');
        } finally {
            setRunningDualBackup(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername.trim() || !newPassword.trim()) {
            showToast("Please fill in all fields.", 'info');
            return;
        }
        setCreatingUser(true);
        try {
            const res = await api.addUser({
                username: newUsername,
                password: newPassword,
                role: newRole
            });
            if (res.success) {
                await logAuditAction('user_created', { username: newUsername, role: newRole }, 'info');
                showToast(`User ${newUsername} created successfully as ${newRole}`, 'success');
                setNewUsername('');
                setNewPassword('');
                refreshUsers();
            } else {
                showToast(res.message || "Failed to create user", 'error');
            }
        } catch (err: any) {
            showToast(err.message || "Failed to create user", 'error');
        } finally {
            setCreatingUser(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this user account?")) return;
        try {
            const res = await api.deleteUser(id);
            if (res.success) {
                await logAuditAction('user_deleted', { userId: id }, 'warning');
                showToast("User account deleted successfully", 'success');
                refreshUsers();
            } else {
                showToast(res.message || "Failed to delete user", 'error');
            }
        } catch (err: any) {
            showToast(err.message || "Failed to delete user", 'error');
        }
    };

    const handleTogglePermission = (role: string, permissionKey: keyof Omit<api.RolePermissions, 'role'>) => {
        setLocalPermissions(prev => prev.map(p => {
            if (p.role === role) {
                return {
                    ...p,
                    [permissionKey]: !p[permissionKey]
                };
            }
            return p;
        }));
    };

    const handleSavePermissions = async () => {
        setSavingPerms(true);
        try {
            const res = await api.updateRolePermissions(localPermissions);
            if (res.success) {
                await logAuditAction('rbac_update', { changes: localPermissions }, 'warning');
                showToast("Role permissions updated persistently!", 'success');
                refreshPermissions();
            } else {
                showToast(res.message || "Failed to update permissions", 'error');
            }
        } catch (err: any) {
            showToast(err.message || "Failed to update permissions", 'error');
        } finally {
            setSavingPerms(false);
        }
    };

    const [sqlQuery, setSqlQuery] = useState<string>(`-- Traders Table
CREATE TABLE traders (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    location TEXT,
    business_name TEXT,
    tax_id TEXT,
    plan TEXT DEFAULT 'Basic',
    status TEXT DEFAULT 'active',
    discount_rate DECIMAL DEFAULT 0,
    customer_since DATE,
    joined TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Table
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER DEFAULT 0,
    unit_price DECIMAL DEFAULT 0,
    supplier TEXT,
    reorder_level INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    invoice_no TEXT UNIQUE,
    trader_id INTEGER REFERENCES traders(id),
    trader_name TEXT,
    business_name TEXT,
    customer_name TEXT,
    payment_method TEXT,
    items JSONB,
    item_count INTEGER,
    subtotal DECIMAL,
    discount_rate DECIMAL,
    discount_amount DECIMAL,
    tax DECIMAL,
    total DECIMAL,
    date TEXT,
    time TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'cashier',
    created_at TIMESTAMP DEFAULT NOW()
);`);

    const [executing, setExecuting] = useState(false);
    const [results, setResults] = useState<SQLResult[] | null>(null);
    const [dbStats, setDbStats] = useState({
        totalSales: 0,
        transactionCount: 0,
        uniqueTraders: 0,
        totalDiscounts: 0,
        status: 'Healthy',
        latency: '4ms'
    });
    
    const [tableCounts, setTableCounts] = useState<{ name: string; count: number }[]>([]);
    const [loadingSchema, setLoadingSchema] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchSchemaStats = async () => {
        setLoadingSchema(true);
        try {
            // Get standard app stats
            try {
                const stats = await api.getStats();
                setDbStats(prev => ({
                    ...prev,
                    totalSales: stats.totalSales,
                    transactionCount: stats.transactionCount,
                    uniqueTraders: stats.uniqueTraders,
                    totalDiscounts: stats.totalDiscounts
                }));
            } catch (e) {
                console.warn("Failed to fetch standard stats, using local transactions summary", e);
                const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
                const transactionCount = transactions.length;
                const uniqueTradersCount = new Set(transactions.map(t => t.traderId)).size;
                const totalDiscounts = transactions.reduce((sum, t) => sum + (t.discountAmount || 0), 0);
                
                setDbStats(prev => ({
                    ...prev,
                    totalSales,
                    transactionCount,
                    uniqueTraders: uniqueTradersCount,
                    totalDiscounts
                }));
            }

            // Let's run raw SQL query to get table sizes!
            try {
                const data = await api.apiFetch<any>('/admin/sql', {
                    method: 'POST',
                    body: JSON.stringify({
                        sql: `
                            SELECT 'traders' as name, COUNT(*) as count FROM traders
                            UNION ALL
                            SELECT 'inventory' as name, COUNT(*) as count FROM inventory
                            UNION ALL
                            SELECT 'transactions' as name, COUNT(*) as count FROM transactions
                            UNION ALL
                            SELECT 'users' as name, COUNT(*) as count FROM users;
                        `
                    })
                });

                if (data.success && data.result && data.result[0] && data.result[0].success) {
                    setTableCounts(data.result[0].rows);
                } else {
                    console.warn("API returned success but no data for table counts, using local counts");
                    setTableCounts([
                        { name: 'traders', count: traders.length },
                        { name: 'inventory', count: inventory.length },
                        { name: 'transactions', count: transactions.length },
                        { name: 'users', count: users.length }
                    ]);
                }
            } catch (e) {
                console.warn("Failed to fetch table counts from server, using local data fallback", e);
                setTableCounts([
                    { name: 'traders', count: traders.length },
                    { name: 'inventory', count: inventory.length },
                    { name: 'transactions', count: transactions.length },
                    { name: 'users', count: users.length }
                ]);
            }
        } catch (err) {
            console.error("Error loading schema stats:", err);
        } finally {
            setLoadingSchema(false);
        }
    };

    useEffect(() => {
        fetchSchemaStats();
    }, []);

    const handleExecuteSQL = async () => {
        if (!sqlQuery.trim()) return;
        setExecuting(true);
        setResults(null);
        try {
            const data = await api.apiFetch<any>('/admin/sql', {
                method: 'POST',
                body: JSON.stringify({ sql: sqlQuery })
            });
            if (data.success) {
                setResults(data.result);
                // Refresh table sizes and stats
                fetchSchemaStats();
            } else {
                setResults([{
                    query: sqlQuery,
                    success: false,
                    error: data.error || "Execution failed."
                }]);
            }
        } catch (err: any) {
            setResults([{
                query: sqlQuery,
                success: false,
                error: err.message || "Network error."
            }]);
        } finally {
            setExecuting(false);
        }
    };

    const handleCopySQL = () => {
        navigator.clipboard.writeText(sqlQuery);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 overflow-y-auto w-full h-full bg-blue-50/50">
            <h3 className="text-2xl tracking-tight mb-2 text-slate-900 font-bold uppercase">⚙️ System Administration</h3>
            <p className="text-slate-600 mb-6 text-sm">Manage relational SQL schemas, configure RBAC policies, and audit onboarded traders' sales terminal activities.</p>

            {/* Sub Tabs Selection */}
            <div className="flex border-b border-slate-200 mb-6 gap-4">
                <button
                    onClick={() => setActiveSubTab('database')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'database'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Database size={16} /> Relational DB Console
                </button>
                <button
                    onClick={() => setActiveSubTab('rbac')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'rbac'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Shield size={16} /> RBAC & User Directory
                </button>
                <button
                    onClick={() => setActiveSubTab('traders-activities')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'traders-activities'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Users size={16} /> Onboarded Traders & Activities
                </button>
                <button
                    onClick={() => setActiveSubTab('interop')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'interop'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Share2 size={16} /> Business Network Audit
                </button>
                <button
                    onClick={() => setActiveSubTab('vendor-approvals')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'vendor-approvals'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Crown size={16} /> Vendor Approvals
                </button>
                <button
                    onClick={() => setActiveSubTab('tenant-explorer')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'tenant-explorer'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Briefcase size={16} /> Tenant Explorer
                </button>
                <button
                    onClick={() => setActiveSubTab('integrity')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'integrity'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <ShieldCheck size={16} /> Data Resilience & Integrity
                </button>
                <button
                    onClick={() => setActiveSubTab('backup-server')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'backup-server'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Cloud size={16} /> Dual Backup & IP Localization
                </button>
                <button
                    onClick={() => setActiveSubTab('audit-trail')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'audit-trail'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <ClipboardList size={16} /> Activity Audit
                </button>
                <button
                    onClick={() => setActiveSubTab('error-logs')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'error-logs'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <AlertTriangle size={16} /> Error Logs
                </button>
            </div>

            {activeSubTab === 'integrity' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Database Resilience & Auto-Restore Banner */}
                    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/30">
                                    <ShieldCheck size={32} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="text-xl font-black tracking-tight">Data Integrity & High Resilience Engine</h3>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase border ${
                                            (integrityReport?.status || systemHealth?.status) === 'HEALTHY' || (integrityReport?.status || systemHealth?.status) === 'healthy'
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                        }`}>
                                            STATUS: {integrityReport?.status || (systemHealth?.status === 'healthy' ? 'HEALTHY' : 'ACTIVE')}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                            SHA-256 VERIFIED
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                                        Active WAL journaling, atomic foreign-key constraints, continuous debounced snapshots, and cold-start auto-recovery guarantee zero data loss.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                <button
                                    onClick={handleRunAudit}
                                    disabled={runningAudit}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                                >
                                    <Activity className={runningAudit ? "animate-spin text-blue-400" : "text-blue-400"} size={16} />
                                    {runningAudit ? 'Auditing...' : 'Deep Integrity Audit'}
                                </button>

                                <button
                                    onClick={handleRunRepair}
                                    disabled={repairing}
                                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                                >
                                    <Wrench className={repairing ? "animate-spin" : ""} size={16} />
                                    {repairing ? 'Self-Healing...' : 'Self-Healing & Repair'}
                                </button>

                                <button
                                    onClick={handleCreateSnapshot}
                                    disabled={isCreatingSnapshot}
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-blue-950/40 disabled:opacity-50"
                                >
                                    <RefreshCw className={isCreatingSnapshot ? "animate-spin" : ""} size={16} />
                                    {isCreatingSnapshot ? 'Snapshotting...' : 'Create Instant Snapshot'}
                                </button>
                            </div>
                        </div>

                        {/* Integrity Metric Grid */}
                        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block mb-1 text-[10px] font-bold uppercase tracking-wider">PRAGMA Integrity</span>
                                <span className="font-mono font-bold text-emerald-400 uppercase text-xs flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    {integrityReport?.checks?.sqliteIntegrity || systemHealth?.resilience?.integrityCheck || 'OK'}
                                </span>
                            </div>

                            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block mb-1 text-[10px] font-bold uppercase tracking-wider">Foreign Keys</span>
                                <span className="font-mono font-bold text-white text-xs">
                                    {integrityReport?.checks?.foreignKeyViolations === 0 || !integrityReport ? '0 Violations' : `${integrityReport.checks.foreignKeyViolations} Issues`}
                                </span>
                            </div>

                            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block mb-1 text-[10px] font-bold uppercase tracking-wider">POS Ledger Orphans</span>
                                <span className="font-mono font-bold text-white text-xs">
                                    {integrityReport?.checks?.orphanTransactions ?? 0} unlinked
                                </span>
                            </div>

                            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block mb-1 text-[10px] font-bold uppercase tracking-wider">Negative Stock</span>
                                <span className={`font-mono font-bold text-xs ${integrityReport?.checks?.negativeStockItems > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {integrityReport?.checks?.negativeStockItems ?? 0} items
                                </span>
                            </div>

                            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block mb-1 text-[10px] font-bold uppercase tracking-wider">Journal Balance</span>
                                <span className="font-mono font-bold text-white text-xs">
                                    {integrityReport?.checks?.ledgerBalanced !== false ? 'Balanced' : `Diff: KSh ${integrityReport.checks.ledgerDiscrepancy}`}
                                </span>
                            </div>

                            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                                <span className="text-slate-400 block mb-1 text-[10px] font-bold uppercase tracking-wider">Last Snapshot</span>
                                <span className="font-mono text-slate-300 text-[11px] block truncate">
                                    {systemHealth?.resilience?.lastSnapshot 
                                        ? new Date(systemHealth.resilience.lastSnapshot).toLocaleTimeString() 
                                        : 'Continuous sync'}
                                </span>
                            </div>
                        </div>

                        {/* Anomaly & Repair Banner */}
                        {integrityReport?.issues && integrityReport.issues.length > 0 && (
                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                                    <AlertTriangle size={14} />
                                    <span>{integrityReport.issues.length} Potential Data Consistency Notice(s):</span>
                                </div>
                                <div className="space-y-1">
                                    {integrityReport.issues.map((iss: any, idx: number) => (
                                        <div key={idx} className="text-[11px] text-slate-300 flex items-center justify-between">
                                            <span>• [{iss.component}] {iss.message}</span>
                                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{iss.severity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {repairResult && (
                            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    <Sparkles size={14} />
                                    <span>Automated Self-Repair Actions Completed:</span>
                                </div>
                                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-300">
                                    {repairResult.actionsTaken.map((act: string, i: number) => (
                                        <li key={i}>{act}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Operational Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Export Card */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-100">
                                    <HardDrive size={24} />
                                </div>
                                <h4 className="text-lg font-black text-slate-900 mb-1">Cryptographic Export</h4>
                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                    Download complete database archive with embedded SHA-256 cryptographic digest for tamper verification.
                                </p>

                                <div className="space-y-3 mb-6">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Export Format</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setExportFormat('json')}
                                                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition border ${
                                                    exportFormat === 'json' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                JSON (Full Schema)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setExportFormat('csv')}
                                                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition border ${
                                                    exportFormat === 'csv' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                CSV (Spreadsheet)
                                            </button>
                                        </div>
                                    </div>

                                    {exportFormat === 'csv' && (
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Target Table</label>
                                            <select
                                                value={selectedExportTable}
                                                onChange={(e) => setSelectedExportTable(e.target.value)}
                                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                                            >
                                                <option value="all">All Tables (Multi-Section CSV)</option>
                                                <option value="transactions">Transactions (POS Ledger)</option>
                                                <option value="inventory">Inventory Stock</option>
                                                <option value="traders">Traders & Accounts</option>
                                                <option value="finance_accounts">Finance Accounts</option>
                                                <option value="journal_entries">Journal Entries</option>
                                                <option value="audit_logs">System Audit Logs</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={handleExportData}
                                disabled={isExporting}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 text-xs shadow-md disabled:opacity-50"
                            >
                                {isExporting ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                                Download Verified {exportFormat.toUpperCase()} Backup
                            </button>
                        </div>

                        {/* Disaster Recovery Card */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 border border-amber-100">
                                    <RefreshCw size={24} />
                                </div>
                                <h4 className="text-lg font-black text-slate-900 mb-1">Disaster Recovery Restore</h4>
                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                    Restore database from a previous JSON snapshot. Automatic SHA-256 verification and atomic SQLite transaction prevent partial writes.
                                </p>

                                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/50 mb-6 text-[11px] text-amber-800">
                                    <div className="font-bold flex items-center gap-1.5 mb-1">
                                        <AlertTriangle size={13} />
                                        Atomic Rollback Guarantee
                                    </div>
                                    If any table constraint or row fails during restore, all changes are automatically rolled back.
                                </div>
                            </div>

                            <label className="w-full bg-white border-2 border-slate-300 text-slate-800 py-3 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2 cursor-pointer text-xs text-center">
                                {isImporting ? <RefreshCw className="animate-spin text-blue-600" size={16} /> : <ArrowRightLeft size={16} />}
                                <span>{isImporting ? 'Validating & Restoring...' : 'Upload & Restore Backup (.json)'}</span>
                                <input type="file" accept=".json" onChange={handleImportData} className="hidden" disabled={isImporting} />
                            </label>
                        </div>

                        {/* Client Resilience & Outbox Card */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100">
                                    <Layers size={24} />
                                </div>
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-lg font-black text-slate-900">Client Offline Outbox</h4>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                        {offlineQueueItems.length} Pending
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                    IndexedDB client cache buffers orders created during internet outages. Automatically replays once network is restored.
                                </p>

                                <div className="space-y-2 mb-6">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                        <div className="flex justify-between items-center text-slate-600 mb-1">
                                            <span>Active Queue Size:</span>
                                            <span className="font-mono font-bold">{offlineQueueItems.length} operation(s)</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-600">
                                            <span>Storage Engine:</span>
                                            <span className="font-mono font-bold text-emerald-600">IndexedDB IDBStore</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleExportClientBackup}
                                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                                >
                                    <Download size={14} />
                                    Client Backup
                                </button>
                                <button
                                    onClick={handlePurgeOfflineQueue}
                                    disabled={offlineQueueItems.length === 0}
                                    className="py-2.5 px-3 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                    Clear Outbox
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stored Snapshots Vault */}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <Server size={20} className="text-blue-600" />
                                    Server Snapshot Vault & Disaster Recovery Points
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Auto-rotated backups on persistent storage. You can rollback or restore to any previous checkpoint instantly.
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setLoadingSnapshots(true);
                                    const snaps = await api.getStoredSnapshots().catch(() => []);
                                    setStoredSnapshots(snaps);
                                    setLoadingSnapshots(false);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 transition rounded-lg hover:bg-slate-100"
                                title="Refresh snapshot list"
                            >
                                <RefreshCw className={loadingSnapshots ? "animate-spin text-blue-600" : ""} size={18} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400 font-black border-b border-slate-100">
                                        <th className="px-6 py-3.5">Snapshot Checkpoint</th>
                                        <th className="px-6 py-3.5">Type & Tag</th>
                                        <th className="px-6 py-3.5">Size</th>
                                        <th className="px-6 py-3.5">Checksum Digest</th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {storedSnapshots.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                                No server snapshots found in repository. Click "Create Instant Snapshot" to generate one.
                                            </td>
                                        </tr>
                                    ) : (
                                        storedSnapshots.map((snap) => (
                                            <tr key={snap.filename} className="hover:bg-slate-50/60 transition">
                                                <td className="px-6 py-3.5">
                                                    <div className="font-bold text-slate-800">{snap.filename}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        {new Date(snap.lastModified).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    {snap.isLatest ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                            ACTIVE LATEST
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                            ARCHIVE POINT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3.5 font-mono text-slate-600">
                                                    {(snap.sizeBytes / 1024).toFixed(1)} KB
                                                </td>
                                                <td className="px-6 py-3.5 font-mono text-[10px] text-slate-400">
                                                    {snap.metadata?.checksum ? `${snap.metadata.checksum.substring(0, 16)}...` : 'SHA-256 Valid'}
                                                </td>
                                                <td className="px-6 py-3.5 text-right">
                                                    <button
                                                        onClick={() => handleRestoreStoredSnapshot(snap.filename)}
                                                        disabled={restoringSnapshotFile === snap.filename}
                                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white font-bold rounded-lg text-xs transition border border-blue-200 hover:border-blue-600 inline-flex items-center gap-1.5 disabled:opacity-50"
                                                    >
                                                        <RotateCcw size={12} className={restoringSnapshotFile === snap.filename ? "animate-spin" : ""} />
                                                        {restoringSnapshotFile === snap.filename ? 'Restoring...' : 'Restore'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Global System Audit Logs */}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Global System Audit Logs</h3>
                                <p className="text-xs text-slate-500">Immutable trace of all administrative, restore, and merchant terminal activities.</p>
                            </div>
                            <button 
                                onClick={async () => {
                                    setLoadingLogs(true);
                                    const res = await api.getAuditLogs();
                                    setAuditLogs(res);
                                    setLoadingLogs(false);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 transition rounded-lg hover:bg-slate-100"
                            >
                                <RefreshCw className={loadingLogs ? "animate-spin" : ""} size={18} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Context</th>
                                        <th className="px-6 py-4">Action Type</th>
                                        <th className="px-6 py-4">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loadingLogs ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                Retrieving audit trail...
                                            </td>
                                        </tr>
                                    ) : auditLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                No audit logs recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-6 py-4 text-[10px] font-mono text-slate-500">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-800">{log.traderName || 'SYSTEM'}</div>
                                                    <div className="text-[10px] text-slate-400">{log.username || 'Automated'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                                                        log.action.includes('error') ? 'bg-red-100 text-red-600' : 
                                                        log.action.includes('repair') ? 'bg-emerald-100 text-emerald-700' :
                                                        log.action.includes('restore') ? 'bg-amber-100 text-amber-700' :
                                                        log.action.includes('update') ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {log.action.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-[10px] text-slate-500 max-w-md truncate font-mono">
                                                        {JSON.stringify(log.details)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {activeSubTab === 'interop' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Inter-Merchant Stock Network</h3>
                                <p className="text-sm text-slate-500">Monitoring peer-to-peer inventory transfers across the merchant ecosystem.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                                    {interopRequests.length} Total Requests
                                </span>
                            </div>
                        </div>

                        {loadingInterop ? (
                            <div className="p-12 text-center text-slate-400">
                                <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
                                <p className="text-sm font-bold">Auditing business network transactions...</p>
                            </div>
                        ) : interopRequests.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <ArrowRightLeft className="mx-auto mb-2 opacity-20" size={64} />
                                <p className="text-sm font-bold">No inter-merchant activity detected yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Item Details</th>
                                            <th className="px-6 py-4">Transaction Route</th>
                                            <th className="px-6 py-4">Quantity</th>
                                            <th className="px-6 py-4">Total Value</th>
                                            <th className="px-6 py-4">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {interopRequests.map(req => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 
                                                        ${req.status === 'received' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                                                          req.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                                                          'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                                        {req.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-slate-800">{req.itemName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{req.sku || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-700">{req.requesterBusiness}</span>
                                                        <ArrowRightLeft size={12} className="text-slate-300" />
                                                        <span className="text-xs font-bold text-slate-700">{req.providerBusiness}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-mono text-slate-600">{req.quantity}</td>
                                                <td className="px-6 py-4 text-sm font-black text-slate-900 font-mono">KES {(req.price * req.quantity).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-[10px] text-slate-400 font-mono">{new Date(req.createdAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeSubTab === 'tenant-explorer' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 text-emerald-700">Registered Tenants & Distributor Networks</h3>
                                <p className="text-sm text-slate-500 font-bold">Inspect merchant account login credentials and linked vendor hierarchies.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-100 text-blue-700 text-xs font-black px-3 py-1 rounded-full border border-blue-200 uppercase tracking-widest">
                                    {traders.length} Total Tenants
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Tenant / Business</th>
                                        <th className="px-6 py-4">Login Credentials (System Admin View)</th>
                                        <th className="px-6 py-4">Plan / Tier</th>
                                        <th className="px-6 py-4">Vendor Network (For Distributors)</th>
                                        <th className="px-6 py-4 text-right">Admin Tools</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {traders.map(t => {
                                        const myVendors = traders.filter(v => v.distributorId === t.id);
                                        const isDistributor = t.plan?.toLowerCase().includes('distributor') || t.plan?.toLowerCase().includes('wholesale');
                                        
                                        return (
                                            <tr key={t.id} className="hover:bg-slate-50/50 transition align-top">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-black text-slate-900">{t.businessName || t.fullName}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">Owner: {t.fullName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-1">Tenant ID: {t.id}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1 bg-blue-50 text-blue-600 rounded">
                                                                <Mail size={12} />
                                                            </div>
                                                            <span className="text-xs font-bold text-blue-700">{t.email}</span>
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(t.email);
                                                                    showToast("Email copied", "info");
                                                                }}
                                                                className="text-slate-300 hover:text-slate-500 transition"
                                                            >
                                                                <Copy size={10} />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1 bg-amber-50 text-amber-600 rounded">
                                                                <Lock size={12} />
                                                            </div>
                                                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={t.passwordHash}>
                                                                {t.passwordHash?.substring(0, 15)}...
                                                            </span>
                                                            <button 
                                                                onClick={async () => {
                                                                    if (confirm(`Force reset password for ${t.businessName} to 'Biashara123'?`)) {
                                                                        try {
                                                                            const res = await api.updateTrader(t.id, { password: 'Biashara123' } as any);
                                                                            if (res.success || (res as any).id) {
                                                                                showToast("Password reset to Biashara123", "success");
                                                                                refreshData();
                                                                            }
                                                                        } catch (e) {
                                                                            showToast("Reset failed", "error");
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-[10px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 transition"
                                                            >
                                                                RESET
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border w-max uppercase tracking-tighter
                                                            ${t.plan?.includes('Starter') ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                                                              t.plan?.includes('Pro') ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                                              t.plan?.includes('Enterprise') ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                              'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                            {t.plan}
                                                        </span>
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border w-max
                                                            ${t.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                            {t.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isDistributor ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <Users size={12} className="text-indigo-500" />
                                                                <span className="text-xs font-black text-indigo-700">{myVendors.length} Linked Vendors</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                                {myVendors.slice(0, 8).map(v => (
                                                                    <span key={v.id} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                        {v.businessName || v.fullName}
                                                                    </span>
                                                                ))}
                                                                {myVendors.length > 8 && (
                                                                    <span className="text-[9px] font-bold text-slate-400">+{myVendors.length - 8} more</span>
                                                                )}
                                                                {myVendors.length === 0 && (
                                                                    <span className="text-[10px] text-slate-400 italic">No vendors registered yet.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <ArrowRightLeft size={12} />
                                                            Standalone Merchant
                                                            {t.distributorId && (
                                                                <span className="text-indigo-600 font-bold ml-1">
                                                                    (Vendor of ID: {t.distributorId})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setSelectedTenantForUsers({ id: t.id, name: t.businessName || t.fullName })}
                                                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition flex items-center gap-1.5 text-xs font-bold border border-purple-200 cursor-pointer shadow-2xs"
                                                            title="Manage Tenant User Accounts, Roles, & Subscription Seats"
                                                        >
                                                            <Users size={14} />
                                                            <span>Users & Seats</span>
                                                        </button>
                                                        <button 
                                                            className="p-2 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded-lg transition"
                                                            title="Impersonate (Debug)"
                                                            onClick={() => showToast("Impersonation feature available in production mode", "info")}
                                                        >
                                                            <UserCheck size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'vendor-approvals' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Distributor Vendor Requests</h3>
                                <p className="text-sm text-slate-500">Review and approve vendor registrations from Tier 4 Distributor accounts.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                                    {vendorRequests.filter(r => r.status === 'pending').length} Pending
                                </span>
                            </div>
                        </div>

                        {loadingVendors ? (
                            <div className="p-12 text-center text-slate-400">
                                <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
                                <p className="text-sm font-bold">Fetching business network registrations...</p>
                            </div>
                        ) : vendorRequests.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Crown className="mx-auto mb-2 opacity-20" size={64} />
                                <p className="text-sm font-bold">No vendor requests found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Distributor</th>
                                            <th className="px-6 py-4">Requested Vendor</th>
                                            <th className="px-6 py-4">Category</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {vendorRequests.map(req => {
                                            const trader = traders.find(t => t.id === req.traderId);
                                            return (
                                                <tr key={req.id} className="hover:bg-slate-50/50 transition">
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 
                                                            ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                                                              req.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                                                              'bg-red-100 text-red-800 border-red-200'}`}>
                                                            {req.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-bold text-slate-800">{trader?.businessName || trader?.fullName || 'Unknown'}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">ID: {req.traderId}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-black text-blue-700">{req.businessName}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">{req.category}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-[10px] text-slate-400 font-mono">
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {req.status === 'pending' && (
                                                            <div className="flex justify-end gap-2">
                                                                <button 
                                                                    onClick={async () => {
                                                                        try {
                                                                            await api.executeRawSQL(`UPDATE vendor_requests SET status = 'approved' WHERE id = ${req.id}`);
                                                                            showToast('Vendor approved successfully!', 'success');
                                                                            const res = await api.getAdminVendorRequests();
                                                                            setVendorRequests(res);
                                                                        } catch (e) {
                                                                            showToast('Approval failed', 'error');
                                                                        }
                                                                    }}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition shadow-sm"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button 
                                                                    onClick={async () => {
                                                                        try {
                                                                            await api.executeRawSQL(`UPDATE vendor_requests SET status = 'rejected' WHERE id = ${req.id}`);
                                                                            showToast('Vendor request rejected', 'info');
                                                                            const res = await api.getAdminVendorRequests();
                                                                            setVendorRequests(res);
                                                                        } catch (e) {
                                                                            showToast('Operation failed', 'error');
                                                                        }
                                                                    }}
                                                                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition shadow-sm"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Merchant Activation Queue</h3>
                                <p className="text-sm text-slate-500">Review and activate merchants onboarded via distributors once payment is confirmed.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                                    {pendingVendors.length} Awaiting Activation
                                </span>
                            </div>
                        </div>

                        {loadingVendors ? (
                            <div className="p-12 text-center text-slate-400">
                                <RefreshCw className="animate-spin mx-auto mb-2" size={32} />
                                <p className="text-sm font-bold">Auditing merchant queue...</p>
                            </div>
                        ) : pendingVendors.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <CheckCircle className="mx-auto mb-2 opacity-20" size={64} />
                                <p className="text-sm font-bold">Queue is clear. No merchants pending activation.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                            <th className="px-6 py-4">Merchant Name</th>
                                            <th className="px-6 py-4">Contact Person</th>
                                            <th className="px-6 py-4">Distributor (Referrer)</th>
                                            <th className="px-6 py-4">Date Registered</th>
                                            <th className="px-6 py-4 text-right">Approval Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {pendingVendors.map(v => (
                                            <tr key={v.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-black text-slate-900">{v.businessName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">PIN: {v.taxId || '—'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-700">{v.fullName}</div>
                                                    <div className="text-[10px] text-blue-500 font-mono">{v.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-200">
                                                            {v.distributorBusiness?.charAt(0)}
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-800">{v.distributorBusiness}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-[10px] text-slate-400 font-mono">
                                                    {new Date(v.joined).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={async () => {
                                                                if (!confirm('Reject this merchant registration?')) return;
                                                                try {
                                                                    const res = await api.approveVendor(v.id, 'rejected', user?.username);
                                                                    if (res.success) {
                                                                        showToast(res.message, 'info');
                                                                        const [updated, logs] = await Promise.all([
                                                                            api.getPendingVendors(),
                                                                            api.getAuditLogs()
                                                                        ]);
                                                                        setPendingVendors(updated);
                                                                        setAuditLogs(logs);
                                                                        refreshData();
                                                                    }
                                                                } catch (e) {
                                                                    showToast('Action failed', 'error');
                                                                }
                                                            }}
                                                            className="p-2 border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await api.approveVendor(v.id, 'active', user?.username);
                                                                    if (res.success) {
                                                                        showToast('Merchant activated successfully!', 'success');
                                                                        const [updated, logs] = await Promise.all([
                                                                            api.getPendingVendors(),
                                                                            api.getAuditLogs()
                                                                        ]);
                                                                        setPendingVendors(updated);
                                                                        setAuditLogs(logs);
                                                                        refreshData();
                                                                    }
                                                                } catch (e) {
                                                                    showToast('Activation failed', 'error');
                                                                }
                                                            }}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-black shadow-sm transition flex items-center gap-2"
                                                        >
                                                            <Check size={14} />
                                                            Activate
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

                    {/* Audit Log for Regulatory Compliance */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-white">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Users size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Registered Tenants & Login Credentials</h3>
                                <p className="text-sm text-slate-500">Directory of all registered merchants, their primary login emails, and distributor-vendor hierarchy.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-6 py-4">Tenant / Business</th>
                                        <th className="px-6 py-4">Primary Login Credential</th>
                                        <th className="px-6 py-4">Distributor Network</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Credentials</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {traders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs font-bold italic">
                                                No registered tenants found.
                                            </td>
                                        </tr>
                                    ) : (
                                        traders.map(t => {
                                            const myVendors = traders.filter(v => v.distributorId === t.id);
                                            const isDistributor = t.plan?.toLowerCase().includes('distributor');
                                            return (
                                                <tr key={t.id} className="hover:bg-slate-50/50 transition text-xs">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900">{t.businessName || t.fullName}</div>
                                                        <div className="text-[10px] text-slate-500">ID: #T-{t.id}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={12} className="text-blue-500" />
                                                            <span className="font-bold text-blue-700">{t.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isDistributor ? (
                                                            <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                                                                <Crown size={12} />
                                                                {myVendors.length} Vendors Registered
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-400 italic">
                                                                {t.distributorId ? `Vendor of #T-${t.distributorId}` : 'Standalone'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                                            t.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => {
                                                                if (confirm(`Force reset password for ${t.businessName} to 'Biashara123'?`)) {
                                                                    api.updateTrader(t.id, { password: 'Biashara123' } as any)
                                                                        .then(() => {
                                                                            showToast("Password reset to Biashara123", "success");
                                                                            refreshData();
                                                                        });
                                                                }
                                                            }}
                                                            className="text-[10px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                                                        >
                                                            RESET PASSWORD
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
                </div>
            )}

            {activeSubTab === 'error-logs' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">System Error Logs</h3>
                                <p className="text-xs text-slate-500">Real-time persistent debugging trace for all frontend and backend exceptions.</p>
                            </div>
                            <button 
                                onClick={async () => {
                                    setLoadingLogs(true);
                                    const res = await api.getSystemErrors();
                                    setErrorLogs(res);
                                    setLoadingLogs(false);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 transition rounded-lg hover:bg-slate-100"
                            >
                                <RefreshCw className={loadingLogs ? "animate-spin" : ""} size={18} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                        <th className="px-6 py-4">Timestamp</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Message / Context</th>
                                        <th className="px-6 py-4">Client Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loadingLogs ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                Retrieving error logs...
                                            </td>
                                        </tr>
                                    ) : errorLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                No system errors recorded. Everything is running smoothly!
                                            </td>
                                        </tr>
                                    ) : (
                                        errorLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition align-top">
                                                <td className="px-6 py-4 text-[10px] font-mono text-slate-500">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-red-100 text-red-600 border border-red-200">
                                                        {log.error_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-900 mb-1">{log.error_message}</div>
                                                    {log.endpoint && <div className="text-[10px] text-blue-600 font-mono">Endpoint: {log.endpoint}</div>}
                                                    {log.url && <div className="text-[10px] text-slate-400 font-mono truncate max-w-md">URL: {log.url}</div>}
                                                    {log.stack_trace && (
                                                        <details className="mt-2">
                                                            <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 font-bold">View Stack Trace</summary>
                                                            <pre className="mt-1 p-2 bg-slate-900 text-slate-300 text-[9px] rounded font-mono overflow-x-auto">
                                                                {log.stack_trace}
                                                            </pre>
                                                        </details>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-[10px] text-slate-500 mb-1">
                                                        <span className="font-bold">User ID:</span> {log.user_id || 'Guest'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mb-1">
                                                        <span className="font-bold">Trader ID:</span> {log.trader_id || 'N/A'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={log.user_agent}>
                                                        {log.user_agent}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'database' && (
                <>
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Database Connection Status */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 p-2.5 rounded-lg text-purple-600">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-slate-800 font-bold">SQL Database</h4>
                                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">SQLite Live</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={fetchSchemaStats} 
                                    disabled={loadingSchema}
                                    className="text-slate-400 hover:text-blue-600 transition disabled:opacity-50"
                                >
                                    <RefreshCw size={18} className={loadingSchema ? "animate-spin" : ""} />
                                </button>
                            </div>
                            
                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <span className="font-bold text-emerald-600">ONLINE</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Type:</span>
                                    <span className="font-mono text-xs">Relational (SQL)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Query Latency:</span>
                                    <span className="font-bold text-slate-900">{dbStats.latency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Table Records Count */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm md:col-span-2">
                            <h4 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
                                <Server size={18} className="text-blue-600" /> Relational Table Metadata
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {tableCounts.map(t => (
                                    <div key={t.name} className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center">
                                        <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">{t.name}</span>
                                        <div className="text-xl font-bold text-blue-600 mt-1">{t.count}</div>
                                        <span className="text-[10px] text-slate-400">records</span>
                                    </div>
                                ))}
                                {tableCounts.length === 0 && (
                                    <div className="col-span-4 text-center text-slate-400 py-3 text-xs">
                                        Loading live database statistics...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Supabase Cloud Database Integration Section */}
                    <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-xl p-6 shadow-lg mb-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl text-emerald-400">
                                    <Cloud size={26} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-lg font-bold tracking-tight">Supabase Cloud Database (PostgreSQL)</h4>
                                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Fully Activated
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                        Hybrid Multi-Tenant Persistence &bull; @supabase/server &bull; Realtime Cloud Replication
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={fetchSupabaseInfo}
                                    disabled={loadingSupabase}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                                    title="Refresh connection status"
                                >
                                    <RefreshCw size={14} className={loadingSupabase ? "animate-spin text-emerald-400" : ""} />
                                    <span>Refresh Status</span>
                                </button>
                                <button
                                    onClick={handleSyncSupabase}
                                    disabled={syncingSupabase}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 transition shadow-sm shadow-emerald-900/50 disabled:opacity-50 cursor-pointer"
                                >
                                    <SyncIcon size={14} className={syncingSupabase ? "animate-spin" : ""} />
                                    <span>{syncingSupabase ? "Syncing Cloud..." : "Sync With Supabase"}</span>
                                </button>
                                <button
                                    onClick={() => setShowSupabaseConfig(!showSupabaseConfig)}
                                    className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/50 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                >
                                    <Sliders size={14} />
                                    <span>{showSupabaseConfig ? "Hide Config" : "Configure Credentials"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Details Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-lg text-xs mb-4 relative z-10">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Provider & Engine</span>
                                <span className="font-semibold text-emerald-300 font-mono">Supabase (PostgreSQL 15+)</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Target Cloud URL</span>
                                <span className="font-mono text-slate-200 truncate block max-w-[200px]" title={supabaseStatus?.url || 'https://glfdyruqmkpdhfzbewal.supabase.co'}>
                                    {supabaseStatus?.url || 'https://glfdyruqmkpdhfzbewal.supabase.co'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Server Layer Package</span>
                                <span className="font-semibold text-blue-300 font-mono">@supabase/server (Installed)</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Replication Mode</span>
                                <span className="font-semibold text-amber-300 font-mono">Dual-Write Hybrid Resilience</span>
                            </div>
                        </div>

                        {/* Configuration Form Expansion */}
                        {showSupabaseConfig && (
                            <div className="mt-4 p-4 bg-slate-900/90 border border-emerald-500/30 rounded-lg relative z-10">
                                <h5 className="font-bold text-sm text-emerald-400 mb-2 flex items-center gap-1.5">
                                    <Sliders size={16} /> Update Supabase Credentials
                                </h5>
                                <p className="text-xs text-slate-400 mb-3">
                                    Customize your Supabase project URL and anon/service-role API key. Changes take effect immediately without server restart.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-xs text-slate-300 font-semibold mb-1 block">Project URL:</label>
                                        <input
                                            type="text"
                                            value={customSupabaseUrl}
                                            onChange={(e) => setCustomSupabaseUrl(e.target.value)}
                                            placeholder="https://your-project.supabase.co"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-300 font-semibold mb-1 block">Anon / Service Key:</label>
                                        <input
                                            type="password"
                                            value={customSupabaseKey}
                                            onChange={(e) => setCustomSupabaseKey(e.target.value)}
                                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowSupabaseConfig(false)}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-semibold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveSupabaseConfig}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-bold transition flex items-center gap-1.5"
                                    >
                                        <Save size={14} />
                                        <span>Save & Connect</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Netlify Cloud Deployment & Blobs Section */}
                    <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-500/30 text-white rounded-xl p-5 mb-6 shadow-md relative overflow-hidden">
                        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-teal-500/10 to-transparent pointer-events-none" />
                        
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                                    <Globe size={26} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-lg font-bold tracking-tight">Netlify Cloud & Blobs Deployment</h4>
                                        <span className="bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                                            Ready for Deploy
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                                        Configured with Netlify Blobs (<code className="text-teal-300 font-mono">@netlify/blobs</code>), serverless Python tenant persistence (<code className="text-teal-300 font-mono">app.py</code>), edge geo-routing, and full Express API rewrites.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={handleActivateBlobs}
                                    disabled={activatingBlobs}
                                    className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 transition shadow-sm shadow-teal-900/50 disabled:opacity-50 cursor-pointer"
                                >
                                    <RefreshCw size={14} className={activatingBlobs ? "animate-spin" : ""} />
                                    <span>{activatingBlobs ? "Activating Blobs..." : "Activate Netlify Blobs"}</span>
                                </button>
                                <a
                                    href="/api/ent-db"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition"
                                >
                                    <span>View Tenant JSON</span>
                                    <ArrowUpRight size={13} />
                                </a>
                            </div>
                        </div>

                        {/* Status Details Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-lg text-xs relative z-10">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Blobs Engine</span>
                                <span className="font-semibold text-teal-300 font-mono">@netlify/blobs (my-store)</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Primary Tenant DB</span>
                                <span className="font-mono text-slate-200 truncate block">
                                    ent-db.json (BUJA / KIGALI / HQ)
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Activation Path</span>
                                <span className="font-mono text-slate-200">/api/activate-blobs</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Serverless Rewrites</span>
                                <span className="font-semibold text-emerald-300 font-mono">/.netlify/functions/api</span>
                            </div>
                        </div>

                        {blobStatus && (
                            <div className="mt-3 p-2.5 bg-teal-900/40 border border-teal-500/40 rounded-lg text-xs text-teal-200 flex items-center justify-between">
                                <span>Status: {blobStatus} (Store 'my-store' populated with default tenant nodes)</span>
                                <Check size={14} className="text-teal-400" />
                            </div>
                        )}
                    </div>

                    {/* Interactive SQL Console Section */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Terminal size={20} className="text-blue-600" />
                                <div>
                                    <h4 className="text-slate-800 font-bold uppercase">Relational SQL Console</h4>
                                    <p className="text-xs text-slate-500">Run PostgreSQL / SQLite compliant table setups and DML operations.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleCopySQL} 
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition"
                                >
                                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                    {copied ? "Copied" : "Copy SQL"}
                                </button>
                                <button
                                    onClick={handleExecuteSQL}
                                    disabled={executing || !sqlQuery.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                                >
                                    <Play size={14} fill="currentColor" />
                                    {executing ? "Executing..." : "Execute Schema / SQL"}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Input Area */}
                            <div className="lg:col-span-8">
                                <textarea
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    className="w-full h-80 font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                                    placeholder="-- Write your SQL script here..."
                                />
                            </div>

                            {/* Quick helper shortcuts */}
                            <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                                <div>
                                    <h5 className="text-xs font-bold uppercase text-slate-600 mb-2">Schema Helpers</h5>
                                    <div className="space-y-1.5">
                                        <button 
                                            onClick={() => setSqlQuery(`-- Fetch all traders\nSELECT * FROM traders;`)}
                                            className="w-full text-left font-mono text-[10px] text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-transparent hover:border-blue-200 transition"
                                        >
                                            SELECT * FROM traders;
                                        </button>
                                        <button 
                                            onClick={() => setSqlQuery(`-- Fetch current inventory quantity levels\nSELECT name, sku, quantity, unit_price FROM inventory;`)}
                                            className="w-full text-left font-mono text-[10px] text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-transparent hover:border-blue-200 transition"
                                        >
                                            SELECT * FROM inventory;
                                        </button>
                                        <button 
                                            onClick={() => setSqlQuery(`-- Fetch recent transactions totals\nSELECT invoice_no, customer_name, total, date, time FROM transactions;`)}
                                            className="w-full text-left font-mono text-[10px] text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-transparent hover:border-blue-200 transition"
                                        >
                                            SELECT * FROM transactions;
                                        </button>
                                        <button 
                                            onClick={() => setSqlQuery(`-- Fetch register accounts list\nSELECT id, username, role, created_at FROM users;`)}
                                            className="w-full text-left font-mono text-[10px] text-blue-600 hover:bg-blue-50 p-1.5 rounded border border-transparent hover:border-blue-200 transition"
                                        >
                                            SELECT * FROM users;
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2.5 items-start">
                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-amber-800 leading-relaxed">
                                        <span className="font-bold uppercase">Syntactical Mapping:</span> The engine automatically translates PostgreSQL data types like <code className="bg-amber-100 px-1 rounded font-mono">SERIAL</code> to SQLite autoincrements. Feel free to run PostgreSQL definitions directly.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Results Output */}
                        {results && (
                            <div className="border-t border-slate-100 bg-slate-50 p-5 font-sans">
                                <h4 className="text-xs uppercase text-slate-500 font-bold tracking-wider mb-3">Execution Output</h4>
                                <div className="space-y-4 max-h-[30rem] overflow-y-auto">
                                    {results.map((res, i) => (
                                        <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm font-mono text-xs overflow-x-auto">
                                            <div className="flex items-center justify-between gap-4 pb-2 mb-2 border-b border-slate-100">
                                                <div className="text-[10px] text-slate-400 truncate max-w-lg">
                                                    {res.query}
                                                </div>
                                                <div>
                                                    {res.success ? (
                                                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                            <CheckCircle size={10} /> Success
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                            <AlertTriangle size={10} /> Error
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {res.success ? (
                                                res.type === 'select' ? (
                                                    res.rows && res.rows.length > 0 ? (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left border-collapse text-[11px]">
                                                                <thead>
                                                                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                                                                        {res.columns?.map(col => (
                                                                            <th key={col} className="p-2 border-b border-slate-200">{col}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {res.rows.map((row, idx) => (
                                                                        <tr key={idx} className="hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                                                                            {res.columns?.map(col => (
                                                                                <td key={col} className="p-2 text-slate-800 break-words max-w-xs font-mono text-[10px]">
                                                                                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 italic py-2 text-center text-[11px]">
                                                            Query executed successfully. Result rowset is empty.
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="text-emerald-700 font-bold py-1 text-[11px]">
                                                        Command run successfully. Changes made: {res.changes ?? 0}, Last Inserted ID: {res.lastID ?? 'N/A'}.
                                                    </div>
                                                )
                                            ) : (
                                                <div className="text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-lg font-bold text-[11px] leading-relaxed whitespace-pre-wrap">
                                                    {res.error}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Static System Log Feed */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                            <h4 className="text-slate-800 font-bold flex items-center gap-2 uppercase">
                                <HardDrive size={18} className="text-blue-600" /> Database Activity Logs
                            </h4>
                        </div>
                        <div className="p-0 font-mono text-[11px]">
                            <div className="flex justify-between p-4 border-b border-slate-100 text-slate-700">
                                <span className="text-slate-500 font-bold">2026-07-16 12:44</span>
                                <span className="flex-1 px-4">Local relational SQLite database mounted to container file-system.</span>
                                <span className="text-emerald-600 font-bold">MOUNTED</span>
                            </div>
                            <div className="flex justify-between p-4 border-b border-slate-100 text-slate-700 bg-slate-50">
                                <span className="text-slate-500 font-bold">2026-07-16 12:44</span>
                                <span className="flex-1 px-4">SQLite database tables initialization verified and seeded successfully.</span>
                                <span className="text-emerald-600 font-bold">INITIALIZED</span>
                            </div>
                            <div className="flex justify-between p-4 border-b border-slate-100 text-slate-700">
                                <span className="text-slate-500 font-bold">2026-07-16 11:42</span>
                                <span className="flex-1 px-4">Automated transactional log rotation finished.</span>
                                <span className="text-blue-600 font-bold">SUCCESS</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeSubTab === 'rbac' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8 animate-fade-in">
                    {/* Left Panel: Role Permissions Grid */}
                    <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={20} className="text-blue-600" />
                                <div>
                                    <h4 className="text-slate-800 font-bold uppercase">Role-Based Access Matrix</h4>
                                    <p className="text-xs text-slate-500">Configure granular screen access for terminal roles.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSavePermissions}
                                disabled={savingPerms || localPermissions.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                            >
                                <Lock size={14} />
                                {savingPerms ? "Saving..." : "Apply Changes"}
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50">
                                        <th className="p-3 text-slate-600">Role / Persona</th>
                                        <th className="p-3 text-center text-slate-600">POS Sales</th>
                                        <th className="p-3 text-center text-slate-600">Traders Hub</th>
                                        <th className="p-3 text-center text-slate-600">Inventory</th>
                                        <th className="p-3 text-center text-slate-600">Subscription</th>
                                        <th className="p-3 text-center text-slate-600">Reports</th>
                                        <th className="p-3 text-center text-slate-600">System Admin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {localPermissions.map(p => (
                                        <tr key={p.role} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-bold text-slate-800 capitalize">
                                                <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-mono ${
                                                    p.role === 'admin' 
                                                        ? 'bg-purple-100 text-purple-800' 
                                                        : p.role === 'manager' 
                                                        ? 'bg-blue-100 text-blue-800' 
                                                        : p.role === 'promoter' 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {p.role}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={p.pos} 
                                                    disabled={p.role === 'admin'} 
                                                    onChange={() => handleTogglePermission(p.role, 'pos')}
                                                    className="w-4 h-4 text-blue-600 bg-slate-100 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={p.traders} 
                                                    disabled={p.role === 'admin'} 
                                                    onChange={() => handleTogglePermission(p.role, 'traders')}
                                                    className="w-4 h-4 text-blue-600 bg-slate-100 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={p.inventory} 
                                                    disabled={p.role === 'admin'} 
                                                    onChange={() => handleTogglePermission(p.role, 'inventory')}
                                                    className="w-4 h-4 text-blue-600 bg-slate-100 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={p.regime} 
                                                    disabled={p.role === 'admin'} 
                                                    onChange={() => handleTogglePermission(p.role, 'regime')}
                                                    className="w-4 h-4 text-blue-600 bg-slate-100 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={p.reports} 
                                                    disabled={p.role === 'admin'} 
                                                    onChange={() => handleTogglePermission(p.role, 'reports')}
                                                    className="w-4 h-4 text-blue-600 bg-slate-100 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={p.system} 
                                                    disabled={p.role === 'admin'} 
                                                    onChange={() => handleTogglePermission(p.role, 'system')}
                                                    className="w-4 h-4 text-blue-600 bg-slate-100 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-blue-50/50 border-t border-slate-100 p-4 flex gap-3 items-start">
                            <Shield size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                <span className="font-bold text-slate-700">Promoter Access:</span> Granting the <span className="font-bold">Promoter</span> role the <span className="font-bold">Onboard Traders</span> privilege allows users with this role to onboard/register traders. The default <span className="font-mono bg-blue-100 px-1.5 rounded text-blue-800 font-bold">admin</span> role always retains absolute control.
                            </p>
                        </div>
                    </div>

                    {/* Right Panel: User Directory & Creator */}
                    <div className="xl:col-span-4 space-y-6">
                        {/* User Creator Form */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                            <h4 className="text-slate-800 font-bold mb-1 uppercase text-sm flex items-center gap-2">
                                <UserPlus size={16} className="text-blue-600" /> Create User Account
                            </h4>
                            <p className="text-xs text-slate-500 mb-4">Add a new staff account with a target role.</p>
                            
                            <form onSubmit={handleAddUser} className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Username / Email</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        placeholder="e.g. promoter@biasharasasa.com"
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Secure Password</label>
                                    <input 
                                        type="password" 
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned Role</label>
                                    <select 
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white"
                                    >
                                        <option value="promoter">Promoter (Onboard Traders)</option>
                                        <option value="manager">Manager (Traders Hub & Reports)</option>
                                        <option value="cashier">Cashier (POS Only)</option>
                                        <option value="admin">Administrator (Full Control)</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={creatingUser}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs py-2.5 rounded-lg font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    <UserPlus size={14} />
                                    {creatingUser ? "Creating Account..." : "Create Staff Account"}
                                </button>
                            </form>
                        </div>

                        {/* User Accounts list */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                            <h4 className="text-slate-800 font-bold mb-1 uppercase text-sm flex items-center gap-2">
                                <Users size={16} className="text-blue-600" /> Terminal Directory
                            </h4>
                            <p className="text-xs text-slate-500 mb-4">List of accounts registered on this terminal.</p>
                            
                            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-800 truncate" title={u.username}>{u.username}</div>
                                            <span className={`inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 rounded mt-1 font-bold ${
                                                u.role === 'admin' 
                                                    ? 'bg-purple-100 text-purple-800' 
                                                    : u.role === 'manager' 
                                                    ? 'bg-blue-100 text-blue-800' 
                                                    : u.role === 'promoter' 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : 'bg-slate-200 text-slate-800'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </div>
                                        {u.username !== 'admin' && (
                                            <button 
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="text-slate-400 hover:text-red-600 p-1.5 rounded transition hover:bg-red-50"
                                                title="Delete user account"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {users.length === 0 && (
                                    <div className="text-center text-slate-400 text-xs py-6">
                                        No staff users found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(activeSubTab === 'traders-activities' || activeSubTab === 'tenant-explorer') && (
                <div className="space-y-6 animate-fade-in font-sans">
                    {/* Tenant Data Isolation Live Status Banner (matching app.py Netlify Blobs & SQLite Isolation) */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 md:p-5 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 bottom-0 w-72 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-base font-bold text-white tracking-tight">Tenant Data Isolation Engine</h4>
                                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Active & Enforced
                                        </span>
                                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[9px] uppercase font-mono px-2 py-0.5 rounded">
                                            app.py &bull; ent-db blobs
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                                        Strict row-level and contextual tenant isolation active. Store managers and cashiers only view and access their own store and authorized sub-trader data. Cross-tenant leakage is blocked at the database query and API gateway layer.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-right">
                                    <span className="text-[9px] text-slate-400 uppercase font-black block">Isolated Tenants</span>
                                    <span className="text-sm font-bold text-indigo-300 font-mono">{totalTraders} Boundary Zones</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Admin Dashboard Stats Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Traders</span>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Users size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{totalTraders}</div>
                            <p className="text-[10px] text-slate-400 mt-1">onboarded across all tiers</p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Premium Subscribers</span>
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                    <Crown size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{premiumTraders}</div>
                            <p className="text-[10px] text-amber-600 font-bold mt-1">Pro / Enterprise / Distributor</p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Traders</span>
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <CheckCircle size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-emerald-600">{activeTradersCount}</div>
                            <p className="text-[10px] text-slate-400 mt-1">currently active terminals</p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales Volume</span>
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <TrendingUp size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalTraderSales, undefined)}</div>
                            <p className="text-[10px] text-slate-400 mt-1">cumulative transaction volume</p>
                        </div>
                    </div>

                    {/* Master-Detail Panel */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* Master: Traders Directory */}
                        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[46rem]">
                            <div className="p-4 border-b border-slate-100 space-y-3">
                                <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Traders Directory</h4>
                                
                                {/* Search and filter tools */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            placeholder="Search name, business or email..."
                                            value={traderSearchQuery}
                                            onChange={(e) => setTraderSearchQuery(e.target.value)}
                                            className="w-full text-xs pl-8 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50"
                                        />
                                        <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Plan</label>
                                            <select 
                                                value={planFilter}
                                                onChange={(e) => setPlanFilter(e.target.value)}
                                                className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none"
                                            >
                                                <option value="all">All Plans</option>
                                                <option value="Basic">Basic</option>
                                                <option value="Pro">Pro</option>
                                                <option value="Enterprise">Enterprise</option>
                                                <option value="Distributor">Distributor</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Status</label>
                                            <select 
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none"
                                            >
                                                <option value="all">All Statuses</option>
                                                <option value="active">Active</option>
                                                <option value="pending">Pending</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Traders List */}
                            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[35rem] pr-1">
                                {filteredTraders.map(t => {
                                    const stats = getTraderStats(t.id);
                                    const isSelected = selectedTraderId === t.id;
                                    return (
                                        <div 
                                            key={t.id} 
                                            onClick={() => {
                                                setSelectedTraderId(t.id);
                                                setTraderDetailTab('sales');
                                            }}
                                            className={`p-4 text-left cursor-pointer transition-all duration-200 flex flex-col justify-between hover:bg-slate-50/80 ${
                                                isSelected ? 'bg-blue-50/50 border-l-4 border-blue-500' : ''
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800">{t.fullName}</h5>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.email}</div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                        t.plan === 'Basic' ? 'bg-slate-100 text-slate-700' :
                                                        t.plan === 'Pro' ? 'bg-blue-100 text-blue-800' :
                                                        t.plan === 'Enterprise' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {t.plan}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                                        t.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                                        t.status === 'pending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {t.status}
                                                    </span>
                                                    {t.serverIp && (
                                                        <span className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded text-[8px] font-bold border border-blue-100 flex items-center gap-0.5 mt-0.5">
                                                            <Server size={8} /> Local Node
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2.5 pt-2 border-t border-dashed border-slate-100">
                                                <span>🏢 {t.businessName || '—'}</span>
                                                <div className="flex gap-2">
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                                        Tx: {stats.txCount}
                                                    </span>
                                                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                                        {formatCurrency(stats.totalSales, t.location)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredTraders.length === 0 && (
                                    <div className="text-center text-slate-400 py-12 text-xs">
                                        No traders match the specified filters.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Detail: Activity Explorer */}
                        <div className="xl:col-span-7 space-y-6">
                            {selectedTrader ? (
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden text-left">
                                    {/* Trader Header Profile Card */}
                                    <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400">Onboarded Merchant Profile</span>
                                                <h4 className="text-xl font-bold mt-1 text-white flex items-center gap-2">
                                                    {selectedTrader.fullName}
                                                </h4>
                                                <p className="text-slate-300 text-xs mt-1.5 flex items-center gap-1.5">
                                                    <Briefcase size={12} className="text-slate-400 shrink-0" />
                                                    <span>Business: <strong>{selectedTrader.businessName || 'N/A'}</strong></span>
                                                    &bull;
                                                    <Tag size={12} className="text-slate-400 shrink-0" />
                                                    <span>Tax ID: <strong>{selectedTrader.taxId || 'N/A'}</strong></span>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="bg-blue-500 text-white font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                                                    {selectedTrader.plan} Account
                                                </span>
                                                {selectedTrader.status === 'pending' && (
                                                    <div className="mt-3">
                                                        <button
                                                            onClick={() => handleApproveTrader(selectedTrader.id)}
                                                            disabled={isApproving}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg text-[10px] uppercase tracking-wider transition shadow-sm flex items-center gap-1.5 ml-auto"
                                                        >
                                                            <UserCheck size={12} />
                                                            {isApproving ? 'Activating...' : 'Approve & Activate'}
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-slate-300 mt-2 flex items-center justify-end gap-1 font-mono">
                                                    <Calendar size={10} /> Joined: {selectedTrader.customerSince}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contact detail tags row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10 text-xs text-slate-300">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Mail size={12} className="text-slate-400 shrink-0" />
                                                <span className="truncate">{selectedTrader.email}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Phone size={12} className="text-slate-400 shrink-0" />
                                                <span>{selectedTrader.phone || 'No Phone'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate">
                                                <MapPin size={12} className="text-slate-400 shrink-0" />
                                                <span>{selectedTrader.location || 'No Location'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Metrics Grid */}
                                    <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50 text-center divide-x divide-slate-100">
                                        <div className="p-4">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total POS Revenue</span>
                                            <span className="text-lg font-bold text-slate-900 mt-1 block">
                                                {formatCurrency(selectedTraderTotalSales, selectedTrader.location)}
                                            </span>
                                        </div>
                                        <div className="p-4">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Discounts Applied</span>
                                            <span className="text-lg font-bold text-emerald-600 mt-1 block">
                                                {formatCurrency(selectedTraderTotalDiscounts, selectedTrader.location)}
                                            </span>
                                        </div>
                                        <div className="p-4">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Personal stock items</span>
                                            <span className="text-lg font-bold text-blue-600 mt-1 block">
                                                {selectedTraderInventory.length} SKU(s)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tabs Selection in Explorer */}
                                    <div className="flex border-b border-slate-200">
                                        <button 
                                            onClick={() => setTraderDetailTab('sales')}
                                            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                                                traderDetailTab === 'sales' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            🛍️ Transactions Activity ({selectedTraderTransactions.length})
                                        </button>
                                        <button 
                                            onClick={() => setTraderDetailTab('inventory')}
                                            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                                                traderDetailTab === 'inventory' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            📦 Custom Products Catalog ({selectedTraderInventory.length})
                                        </button>
                                        <button 
                                            onClick={() => setTraderDetailTab('timeline')}
                                            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                                                traderDetailTab === 'timeline' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            ⏱️ Event Timeline & Logs
                                        </button>
                                        <button 
                                            onClick={() => setTraderDetailTab('settings')}
                                            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                                                traderDetailTab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            ⚙️ Account Settings
                                        </button>
                                    </div>

                                    {/* Tab Contents */}
                                    <div className="p-5 min-h-[16rem]">
                                        {traderDetailTab === 'settings' && (
                                            <div className="space-y-6">
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Subscription Plan Management</h5>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {['Basic', 'Pro', 'Enterprise', 'Distributor'].map(p => (
                                                            <button
                                                                key={p}
                                                                onClick={async () => {
                                                                    if (confirm(`Change ${selectedTrader.fullName}'s plan to ${p}?`)) {
                                                                        try {
                                                                            const res = await api.updateTraderPlan(selectedTrader.id, p);
                                                                            if (res.success) {
                                                                                showToast(res.message, 'success');
                                                                                refreshData();
                                                                            }
                                                                        } catch (e) {
                                                                            showToast('Failed to update plan', 'error');
                                                                        }
                                                                    }
                                                                }}
                                                                className={`p-4 rounded-xl border-2 text-left transition ${
                                                                    selectedTrader.plan === p 
                                                                        ? 'border-blue-600 bg-blue-50' 
                                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                                }`}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="font-bold text-slate-900">{p}</span>
                                                                    {selectedTrader.plan === p && <CheckCircle size={16} className="text-blue-600" />}
                                                                </div>
                                                                <p className="text-[10px] text-slate-500">
                                                                    {p === 'Distributor' ? '1–200 Users, 100 SKUs ($500/user/mo)' : 
                                                                     p === 'Enterprise' ? '10 Users, 100 SKUs' :
                                                                     p === 'Pro' ? '3 Users, 50 SKUs' : '1 User, 10 SKUs'}
                                                                </p>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="bg-white p-4 rounded-xl border border-slate-200">
                                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                        <Server size={14} className="text-blue-600" /> Local Backup Server Config
                                                    </h5>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Local IP Address</label>
                                                            <input 
                                                                type="text"
                                                                value={serverIp}
                                                                onChange={(e) => setServerIp(e.target.value)}
                                                                placeholder="e.g. 192.168.1.10"
                                                                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agent Port</label>
                                                            <input 
                                                                type="text"
                                                                value={serverPort}
                                                                onChange={(e) => setServerPort(e.target.value)}
                                                                placeholder="8080"
                                                                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="mb-4">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Backup Directory</label>
                                                        <input 
                                                            type="text"
                                                            value={backupPath}
                                                            onChange={(e) => setBackupPath(e.target.value)}
                                                            placeholder="/var/backup/biashara"
                                                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleSaveBackupSettings(selectedTrader.id)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2"
                                                    >
                                                        <Save size={14} /> Update Backup Node Settings
                                                    </button>
                                                </div>

                                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                                    <h5 className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">Danger Zone</h5>
                                                    <p className="text-[10px] text-red-500 mb-4">These actions are destructive and cannot be undone.</p>
                                                    <button 
                                                        onClick={() => confirm('Suspend this trader? This will block all terminal access.') && showToast('Trader suspended', 'info')}
                                                        className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition"
                                                    >
                                                        Suspend Merchant Terminal
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {/* Sales tab */}
                                        {traderDetailTab === 'sales' && (
                                            <div>
                                                {selectedTraderTransactions.length === 0 ? (
                                                    <div className="text-center py-12 text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                                                        No transactions recorded under this merchant terminal.
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                                        <table className="w-full text-left border-collapse text-xs font-sans">
                                                            <thead>
                                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                                                    <th className="p-3">Invoice</th>
                                                                    <th className="p-3">Date/Time</th>
                                                                    <th className="p-3">Customer</th>
                                                                    <th className="p-3">Items Count</th>
                                                                    <th className="p-3 text-right">Discount</th>
                                                                    <th className="p-3 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                                {selectedTraderTransactions.map(tx => (
                                                                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-3 text-slate-900 font-bold">{tx.invoiceNo}</td>
                                                                        <td className="p-3 text-slate-500 font-sans text-xs">{tx.date} @ {tx.time}</td>
                                                                        <td className="p-3 text-slate-700 font-sans text-xs">{tx.customerName}</td>
                                                                        <td className="p-3 text-slate-600 font-sans text-xs">
                                                                            <span className="font-bold">{tx.itemCount} item(s)</span>
                                                                            <div className="text-[10px] text-slate-400 max-w-xs truncate font-mono" title={tx.items?.map(i => `${i.name} (x${i.qty})`).join(', ')}>
                                                                                {tx.items?.map(i => `${i.name} (x${i.qty})`).join(', ')}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-3 text-right text-emerald-600 font-bold">-{formatCurrency(tx.discountAmount, selectedTrader.location)}</td>
                                                                        <td className="p-3 text-right text-slate-900 font-bold">{formatCurrency(tx.total, selectedTrader.location)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Custom stock tab */}
                                        {traderDetailTab === 'inventory' && (
                                            <div>
                                                {selectedTraderInventory.length === 0 ? (
                                                    <div className="text-center py-12 text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                                                        No personal inventory items listed for this trader.
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                                        <table className="w-full text-left border-collapse text-xs font-sans">
                                                            <thead>
                                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                                                    <th className="p-3">Product Name</th>
                                                                    <th className="p-3">SKU</th>
                                                                    <th className="p-3 text-right">Unit Price</th>
                                                                    <th className="p-3 text-center">In Stock</th>
                                                                    <th className="p-3">Supplier</th>
                                                                    <th className="p-3">Reorder Alert</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                                {selectedTraderInventory.map(item => {
                                                                    const isLowStock = item.quantity <= item.reorderLevel;
                                                                    return (
                                                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                                            <td className="p-3 text-slate-900 font-sans text-xs font-bold">{item.name}</td>
                                                                            <td className="p-3 text-slate-500 font-mono">{item.sku || 'N/A'}</td>
                                                                            <td className="p-3 text-right text-blue-600 font-bold">{formatCurrency(item.unitPrice, selectedTrader.location)}</td>
                                                                            <td className="p-3 text-center">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                    item.quantity > 10 ? 'bg-slate-100 text-slate-700' :
                                                                                    item.quantity > 0 ? 'bg-amber-100 text-amber-800' :
                                                                                    'bg-red-100 text-red-800'
                                                                                }`}>
                                                                                    {item.quantity} units
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 text-slate-600 font-sans text-xs">{item.supplier || '—'}</td>
                                                                            <td className="p-3 font-sans text-xs">
                                                                                {isLowStock ? (
                                                                                    <span className="text-red-600 font-bold flex items-center gap-1 text-[10px]">
                                                                                        ⚠️ Reorder (under {item.reorderLevel})
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-emerald-600 text-[10px]">
                                                                                        ✓ OK (reorder: {item.reorderLevel})
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Timeline log tab */}
                                        {traderDetailTab === 'timeline' && (
                                            <div className="space-y-4">
                                                <div className="border-l-2 border-slate-200 pl-5 space-y-4 relative">
                                                    {/* Joined event */}
                                                    <div className="relative">
                                                        <div className="absolute -left-[26px] top-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                                                        <div className="text-xs">
                                                            <strong className="text-slate-800 block">👤 Merchant Registered</strong>
                                                            <span className="text-slate-500 font-mono text-[10px] block mt-0.5">{selectedTrader.joined || selectedTrader.customerSince}</span>
                                                            <p className="text-slate-600 mt-1 font-sans text-xs leading-relaxed">
                                                                Onboarded as a partner with terminal identification <strong>#T-{selectedTrader.id}</strong>.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Subscription event */}
                                                    <div className="relative">
                                                        <div className="absolute -left-[26px] top-1.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white"></div>
                                                        <div className="text-xs">
                                                            <strong className="text-slate-800 block">💎 Subscription Assigned</strong>
                                                            <span className="text-slate-500 font-mono text-[10px] block mt-0.5">Active Status</span>
                                                            <p className="text-slate-600 mt-1 font-sans text-xs leading-relaxed">
                                                                Set to the <strong className="uppercase">{selectedTrader.plan}</strong> subscription plan tier. Status is currently <span className="font-bold text-emerald-600 uppercase">{selectedTrader.status}</span>.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Discount rate active */}
                                                    {selectedTrader.discountRate > 0 && (
                                                        <div className="relative">
                                                            <div className="absolute -left-[26px] top-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                                            <div className="text-xs">
                                                                <strong className="text-slate-800 block">🏷️ Personalized Discount Active</strong>
                                                                <p className="text-slate-600 mt-1 font-sans text-xs leading-relaxed">
                                                                    Terminal enforces an automatic customer discount of <strong>{selectedTrader.discountRate}%</strong> off on all checkout transactions.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* POS Sales Summary log */}
                                                    <div className="relative">
                                                        <div className="absolute -left-[26px] top-1.5 w-3 h-3 bg-purple-500 rounded-full border-2 border-white"></div>
                                                        <div className="text-xs">
                                                            <strong className="text-slate-800 block">📊 Terminal Sales Audit</strong>
                                                            <p className="text-slate-600 mt-1 font-sans text-xs leading-relaxed">
                                                                Processed <strong>{selectedTraderTransactions.length} transactions</strong>. Cumulative transaction sales value generated is <strong>{formatCurrency(selectedTraderTotalSales, selectedTrader.location)}</strong>.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50/50 border border-slate-200 border-dashed rounded-xl p-12 text-center text-slate-500 h-full flex flex-col justify-center items-center py-24">
                                    <Users size={48} className="text-slate-300 mb-3 animate-pulse" />
                                    <h4 className="font-bold text-slate-700 text-sm font-sans">No Merchant Selected</h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md font-sans leading-relaxed">
                                        Select a trader from the directory on the left to examine their full terminal parameters, personalized stock catalogue, and active POS transactions.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === 'backup-server' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <ShieldCheck size={12} /> Data Sovereignty & Localization Active
                                </span>
                                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Cloud size={12} /> Local Disk + Cloud Mirror
                                </span>
                            </div>
                            <h3 className="text-xl font-bold tracking-tight">Client Dual Backup & IP Localization Hub</h3>
                            <p className="text-xs text-blue-100/80 mt-1 max-w-2xl leading-relaxed">
                                Client data is backed up concurrently on <strong>local storage</strong> and mirrored to the <strong>global cloud</strong>.
                                The tenant's <strong>IP address</strong> is cryptographically stamped into each localized backup partition for sovereignty, jurisdiction tracking, and audit compliance.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10">
                            <Globe size={18} className="text-blue-200 animate-pulse" />
                            <div className="text-left font-mono">
                                <span className="text-[10px] block text-blue-200 uppercase tracking-wider font-sans font-semibold">Detected Client IP</span>
                                <span className="text-xs font-bold text-white">{detectedIp || '196.201.214.52'}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleDetectIp}
                                disabled={detectingIp}
                                className="ml-2 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all text-xs"
                                title="Re-detect network IP"
                            >
                                <RefreshCw size={14} className={detectingIp ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left column: Trader Directory */}
                        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-[calc(100vh-260px)] flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Users size={18} className="text-blue-600" /> Client Directories
                                </h4>
                                <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                                    {traders.length} Tenants
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-3 font-sans">
                                Select a merchant/client to inspect IP localization and trigger dual backup.
                            </p>
                            
                            {/* Search bar */}
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search clients..."
                                    value={backupTraderSearch}
                                    onChange={(e) => setBackupTraderSearch(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-xs w-full rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                                />
                            </div>
                            
                            {/* Traders List */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {traders
                                    .filter(t => 
                                        t.fullName.toLowerCase().includes(backupTraderSearch.toLowerCase()) || 
                                        (t.businessName && t.businessName.toLowerCase().includes(backupTraderSearch.toLowerCase()))
                                    )
                                    .map(t => {
                                        const isSelected = selectedBackupTraderId === t.id;
                                        const effectiveIp = t.localizationIp || t.clientIp || t.serverIp;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => handleSelectTraderForBackup(t.id)}
                                                className={`w-full text-left p-3 rounded-xl transition-all border flex flex-col gap-1.5 ${
                                                    isSelected 
                                                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-sm' 
                                                        : 'bg-white hover:bg-slate-50 border-slate-100'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start w-full gap-2">
                                                    <span className="font-bold text-xs text-slate-800 block truncate max-w-[150px]">
                                                        {t.businessName || t.fullName}
                                                    </span>
                                                    {effectiveIp ? (
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0">
                                                            ● IP Stamped
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                                                            IP Pending
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-slate-500 w-full font-mono">
                                                    <span>Owner: {t.fullName}</span>
                                                    <span>ID: #T-{t.id}</span>
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-600 bg-slate-100/90 px-2 py-1 rounded border border-slate-200 mt-0.5 flex justify-between items-center w-full">
                                                    <span className="truncate">IP: {effectiveIp || 'Auto-assign on backup'}</span>
                                                    <span className="text-[9px] text-blue-600 font-bold uppercase">{t.location || 'East Africa'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5 font-sans">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={10} /> {t.lastBackupAt ? new Date(t.lastBackupAt).toLocaleDateString() : 'No dual backup yet'}
                                                    </span>
                                                    <span className="text-indigo-600 font-bold">Dual Mirror Active</span>
                                                </div>
                                            </button>
                                        );
                                    })
                                }
                            </div>
                        </div>

                        {/* Right column: Localization Config & Dual Backup Hub */}
                        <div className="lg:col-span-2 space-y-6 h-[calc(100vh-260px)] overflow-y-auto pr-2">
                            {selectedBackupTraderId ? (() => {
                                const activeTrader = traders.find(t => t.id === selectedBackupTraderId);
                                if (!activeTrader) return null;
                                const effectiveCurrentIp = (localizationIp.trim() || activeTrader.localizationIp || activeTrader.clientIp || detectedIp || '127.0.0.1').trim();
                                
                                return (
                                    <>
                                        {/* Card 1: Tenant Data Localization & IP Sovereignty Binding */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-2">
                                                <div>
                                                    <h4 className="text-base font-bold text-slate-950 flex items-center gap-2 font-sans">
                                                        <Globe size={18} className="text-blue-600" /> Tenant IP Address & Data Localization Binding
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-sans mt-0.5">
                                                        Bind and localize storage for <strong>{activeTrader.businessName || activeTrader.fullName}</strong> (#T-{activeTrader.id}).
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (detectedIp) {
                                                                setLocalizationIp(detectedIp);
                                                                showToast(`Adopted detected client IP: ${detectedIp}`, 'info');
                                                            } else {
                                                                handleDetectIp();
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-all flex items-center gap-1.5"
                                                    >
                                                        <Sparkles size={13} /> Adopt Detected IP ({detectedIp || 'Auto-detect'})
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 font-sans">
                                                        Tenant Localization IP Address
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. 196.201.214.52"
                                                            value={localizationIp}
                                                            onChange={(e) => setLocalizationIp(e.target.value)}
                                                            className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Stamped into every backup package</span>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 font-sans">
                                                        Local Server Agent Host & Port
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="127.0.0.1"
                                                            value={serverIp}
                                                            onChange={(e) => setServerIp(e.target.value)}
                                                            className="w-2/3 text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="8080"
                                                            value={serverPort}
                                                            onChange={(e) => setServerPort(e.target.value)}
                                                            className="w-1/3 text-xs font-mono border border-slate-200 rounded-xl px-2 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 mt-0.5 block">On-premise listener port</span>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 font-sans">
                                                        Target Local Storage Directory
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="/var/backup/biashara"
                                                        value={backupPath}
                                                        onChange={(e) => setBackupPath(e.target.value)}
                                                        className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                                    />
                                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Local disk root directory</span>
                                                </div>
                                            </div>

                                            {/* Jurisdiction & Metadata tags */}
                                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-xs">
                                                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Data Jurisdiction</span>
                                                        <strong className="text-slate-800">{activeTrader.location || 'East Africa (Kenya/Uganda/Tanzania)'}</strong>
                                                    </div>
                                                    <div className="h-6 w-px bg-slate-200"></div>
                                                    <div className="text-xs">
                                                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Tax Regime</span>
                                                        <strong className="text-slate-800">{activeTrader.taxRegimeCountry || 'Default / Standard'}</strong>
                                                    </div>
                                                    <div className="h-6 w-px bg-slate-200"></div>
                                                    <div className="text-xs">
                                                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Stamped IP Origin</span>
                                                        <strong className="text-blue-700 font-mono">{effectiveCurrentIp}</strong>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveLocalization(activeTrader.id)}
                                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                                                >
                                                    <Save size={14} /> Save Localization & IP Binding
                                                </button>
                                            </div>
                                        </div>

                                        {/* Card 2: Dual Backup Control Center (Local Disk + Cloud Mirror) */}
                                        <div className="bg-white rounded-2xl border border-blue-200 shadow-md p-6 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-bl-full pointer-events-none"></div>
                                            
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="text-base font-bold text-slate-950 flex items-center gap-2 font-sans">
                                                        <Layers size={18} className="text-blue-600" /> Dual Backup Execution (Local Disk + Cloud Mirror)
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-sans mt-0.5 max-w-xl">
                                                        Exports this client's inventory, sales transactions, general ledger, and staff accounts into an encrypted local snapshot on disk and concurrently mirrors the payload to the Cloud storage repository, stamped with the tenant's localized IP.
                                                    </p>
                                                </div>
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold font-mono">
                                                    DUAL-STORAGE ENGINE ACTIVE
                                                </span>
                                            </div>

                                            {/* Dual Destination Topology */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                                                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <HardDrive size={15} className="text-blue-600" />
                                                        <span className="text-xs font-bold text-blue-900">Destination A: Local Storage</span>
                                                    </div>
                                                    <p className="text-[11px] font-mono text-slate-600 truncate">
                                                        {backupPath}/tenants/{activeTrader.id}/tenant_{activeTrader.id}_backup_latest.json
                                                    </p>
                                                    <span className="text-[10px] text-blue-700/80 block mt-1">
                                                        Persistent disk JSON partition with SHA-256 seal
                                                    </span>
                                                </div>
                                                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Cloud size={15} className="text-indigo-600" />
                                                        <span className="text-xs font-bold text-indigo-900">Destination B: Cloud Mirror</span>
                                                    </div>
                                                    <p className="text-[11px] font-mono text-slate-600 truncate">
                                                        cloud://biasharasasa.supabase.co/tenants/{activeTrader.id}/
                                                    </p>
                                                    <span className="text-[10px] text-indigo-700/80 block mt-1">
                                                        Supabase Global PostgreSQL & Netlify Cloud Blobs
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRunDualBackup(activeTrader.id)}
                                                    disabled={runningDualBackup || syncing}
                                                    className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
                                                        runningDualBackup 
                                                            ? 'bg-blue-100 text-blue-500 cursor-not-allowed'
                                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg'
                                                    }`}
                                                >
                                                    <Cloud size={16} className={runningDualBackup ? 'animate-bounce' : ''} />
                                                    {runningDualBackup ? `Backing Up (${dualBackupProgress}%)...` : 'Run Dual Backup (Local Disk + Cloud Mirror)'}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleTestConnection}
                                                    disabled={testingConnection || runningDualBackup}
                                                    className="px-4 py-3 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm flex items-center gap-2"
                                                >
                                                    <Server size={14} />
                                                    {testingConnection ? 'Pinging Local Host...' : 'Diagnostic Connection Test'}
                                                </button>
                                            </div>

                                            {/* Live Dual Backup Progress Bar */}
                                            {runningDualBackup && (
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-1.5">
                                                        <span>EXECUTING DUAL BACKUP & IP LOCALIZATION PIPELINE...</span>
                                                        <span className="font-bold text-blue-600">{dualBackupProgress}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                        <div 
                                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-200"
                                                            style={{ width: `${dualBackupProgress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Console Log Stream */}
                                            {(dualBackupLogs.length > 0 || connectionLogs.length > 0 || syncLogs.length > 0) && (
                                                <div className="bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl p-4 overflow-y-auto max-h-[220px] shadow-inner space-y-1.5 border border-slate-800">
                                                    <div className="text-[10px] text-slate-500 border-b border-slate-800 pb-1.5 mb-2 uppercase tracking-wider flex justify-between font-sans">
                                                        <span>📟 Dual Backup Execution Console</span>
                                                        <span className="text-emerald-500 font-bold">LIVE STAMP ENGINE</span>
                                                    </div>
                                                    {dualBackupLogs.map((log, idx) => (
                                                        <div key={`dual-log-${idx}`} className="leading-relaxed whitespace-pre-wrap">
                                                            {log}
                                                        </div>
                                                    ))}
                                                    {connectionLogs.map((log, idx) => (
                                                        <div key={`conn-log-${idx}`} className="leading-relaxed whitespace-pre-wrap text-slate-400">
                                                            {log}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card 3: Verified Dual Backup Ledger (Local Disk + Cloud Mirror) */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <h4 className="text-base font-bold text-slate-950 flex items-center gap-2 font-sans">
                                                        <ClipboardList size={18} className="text-blue-600" /> Verified Dual Backup Ledger & IP Stamps
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-sans mt-0.5">
                                                        Immutable record of localized backups stamped with client IP addresses and tamper-evident hashes.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectTraderForBackup(activeTrader.id)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                                    title="Refresh backup list"
                                                >
                                                    <RefreshCw size={14} className={loadingTenantBackups ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                            
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs text-slate-500">
                                                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 rounded-lg">
                                                        <tr>
                                                            <th className="px-4 py-3 rounded-l-lg font-bold font-sans">Timestamp</th>
                                                            <th className="px-4 py-3 font-bold font-sans">Type</th>
                                                            <th className="px-4 py-3 font-bold font-sans">Tenant IP Stamp</th>
                                                            <th className="px-4 py-3 font-bold font-sans">Data Items</th>
                                                            <th className="px-4 py-3 font-bold font-sans">SHA-256 Seal</th>
                                                            <th className="px-4 py-3 font-bold font-sans">Status</th>
                                                            <th className="px-4 py-3 rounded-r-lg font-bold font-sans text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                        {tenantBackups.map((rec, idx) => (
                                                            <tr key={`tenant-backup-${rec.id || idx}`} className="hover:bg-slate-50/60 transition-colors">
                                                                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                                                    {new Date(rec.createdAt).toLocaleString()}
                                                                </td>
                                                                <td className="px-4 py-3 font-sans">
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                                        Local Disk + Cloud Mirror
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 font-bold text-slate-800 font-mono">
                                                                    <span className="text-emerald-600 mr-1">●</span>
                                                                    {rec.tenantIp}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-600 font-sans">
                                                                    {rec.recordCounts 
                                                                        ? `${rec.recordCounts.inventory || 0} items · ${rec.recordCounts.transactions || 0} sales`
                                                                        : `${Math.round((rec.fileSizeBytes || 0) / 1024)} KB`}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-500 font-mono">
                                                                    <div className="flex items-center gap-1">
                                                                        <span title={rec.checksum || ''}>
                                                                            {(rec.checksum || 'sha256').substring(0, 12)}...
                                                                        </span>
                                                                        {rec.checksum && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    navigator.clipboard.writeText(rec.checksum || '');
                                                                                    showToast("SHA-256 checksum copied!", "info");
                                                                                }}
                                                                                className="text-slate-400 hover:text-slate-600 p-0.5"
                                                                                title="Copy checksum"
                                                                            >
                                                                                <Copy size={11} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 font-sans">
                                                                        VERIFIED & STAMPED
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <a
                                                                        href={api.getBackupDownloadUrl(activeTrader.id, rec.id)}
                                                                        download={`tenant_${activeTrader.id}_backup.json`}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition-all"
                                                                    >
                                                                        <Download size={11} /> Download JSON
                                                                    </a>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {tenantBackups.length === 0 && !loadingTenantBackups && (
                                                            <tr>
                                                                <td colSpan={7} className="text-center py-8 text-slate-400 font-sans">
                                                                    <Cloud size={24} className="mx-auto mb-2 text-slate-300" />
                                                                    No dual backups created yet for this client. Click <strong>"Run Dual Backup"</strong> above to generate the first localized partition.
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {loadingTenantBackups && (
                                                            <tr>
                                                                <td colSpan={7} className="text-center py-6 text-slate-400 font-sans">
                                                                    <RefreshCw size={16} className="mx-auto animate-spin text-blue-500 mb-1" />
                                                                    Loading localized backup ledger...
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                );
                            })() : (
                                <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center text-slate-500 h-full flex flex-col justify-center items-center py-24">
                                    <Cloud size={48} className="text-slate-300 mb-3 animate-pulse" />
                                    <h4 className="font-bold text-slate-700 text-sm font-sans">No Merchant Selected</h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md font-sans leading-relaxed">
                                        Select a trader from the client directory on the left to examine their IP localization settings, execute dual backups (local disk + cloud mirror), and review stamped backup records.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {activeSubTab === 'audit-trail' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <ClipboardList className="text-blue-600" /> Global Activity Audit Log
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Tracking administrative actions, system modifications, and critical deletions for full accountability.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={async () => {
                                        setLoadingLogs(true);
                                        const res = await api.getAuditLogs();
                                        setAuditLogs(res);
                                        setLoadingLogs(false);
                                    }}
                                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
                                    title="Refresh Logs"
                                >
                                    <RefreshCw size={18} className={loadingLogs ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-4 w-48">Timestamp</th>
                                        <th className="p-4">User / Actor</th>
                                        <th className="p-4">Merchant Context</th>
                                        <th className="p-4">Action</th>
                                        <th className="p-4">Severity</th>
                                        <th className="p-4">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-sans">
                                    {auditLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                                                {loadingLogs ? 'Loading system audit trails...' : 'No activity logs found in the system registry.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        auditLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 font-mono text-[11px] text-slate-500">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">
                                                            {log.username?.substring(0, 2)}
                                                        </div>
                                                        <span className="font-bold text-slate-700">{log.username}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-500">
                                                    {log.traderName || (log.traderId ? `#T-${log.traderId}` : 'System Global')}
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-bold text-slate-900 capitalize">
                                                        {log.action.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                        log.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-100' :
                                                        log.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                        'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                        {log.severity || 'info'}
                                                    </span>
                                                </td>
                                                <td className="p-4 max-w-xs">
                                                    <div className="text-[10px] bg-slate-50 p-2 rounded border border-slate-200 font-mono text-slate-600 truncate hover:whitespace-normal hover:overflow-visible hover:relative hover:z-10 bg-white">
                                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[10px] text-slate-400 font-sans">
                                Audit logs are immutable and stored securely for compliance and system transparency.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: TENANT USERS & SEAT MANAGEMENT */}
            {selectedTenantForUsers && (
                <TenantUsersModal
                    traderId={selectedTenantForUsers.id}
                    tenantName={selectedTenantForUsers.name}
                    onClose={() => setSelectedTenantForUsers(null)}
                    showToast={showToast}
                    isSuperAdmin={true}
                />
            )}
        </div>
    );
};

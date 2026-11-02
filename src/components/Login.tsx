import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import * as api from '../api';
import { Lock, UserCheck, CheckCircle2, ChevronLeft, Eye, EyeOff, ShieldCheck, Mail, Key, User, Phone, MapPin, Building, Percent, FileText, WifiOff, Crown, HelpCircle, Globe, Database, Zap, ArrowRight, AlertCircle, Check, ArrowLeft, Settings, CreditCard, LayoutDashboard } from 'lucide-react';
import { LogoSVG } from './Logo';
import { SubscriptionPlan } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const Login: React.FC = () => {
    const { setUser, showToast } = useAppContext();
    const [activeTab, setActiveTab] = useState<'login' | 'register' | 'workspace' | 'tour' | 'forgot'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [tenantSlug, setTenantSlug] = useState('');
    const [workspaceLink, setWorkspaceLink] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [showRegConfirm, setShowRegConfirm] = useState(false);
    
    const [error, setError] = useState('');
    const [regError, setRegError] = useState('');
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Workspace 2-Step Login States
    const [workspaceStep, setWorkspaceStep] = useState<1 | 2>(1);
    const [pendingToken, setPendingToken] = useState('');
    const [workspaceUser, setWorkspaceUser] = useState<any>(null);

    // First-Login Enforcement States
    const [isFirstLoginPrompt, setIsFirstLoginPrompt] = useState(false);
    const [firstLoginPendingUser, setFirstLoginPendingUser] = useState<any>(null);
    const [firstLoginNewPass, setFirstLoginNewPass] = useState('');
    const [firstLoginConfirmPass, setFirstLoginConfirmPass] = useState('');
    const [showFirstLoginPass, setShowFirstLoginPass] = useState(false);
    const [showFirstLoginConfirm, setShowFirstLoginConfirm] = useState(false);
    const [firstLoginError, setFirstLoginError] = useState('');
    const [firstLoginLoading, setFirstLoginLoading] = useState(false);

    // Password Recovery States
    const [forgotEmail, setForgotEmail] = useState('');
    const [recoveryToken, setRecoveryToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
    const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset' | 'success'>('request');
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveryError, setRecoveryError] = useState('');
    const [recoverySuccessMsg, setRecoverySuccessMsg] = useState('');
    
    // Trader Self-Onboarding Form State
    const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
    const [regForm, setRegForm] = useState({
        fullName: '',
        email: '',
        phone: '',
        location: '',
        businessName: '',
        taxId: '',
        plan: 'Starter',
        includeFinance: false,
        includeTax: false,
        includeProduction: false,
        includeHr: false,
        discountRate: 0,
        customerSince: new Date().toISOString().split('T')[0],
        password: '',
        confirmPassword: ''
    });
    const [isRegistered, setIsRegistered] = useState(false);
    const [registeredData, setRegisteredData] = useState<any>(null);

    const handleFreeTour = () => {
        // Enable local emulation mode to ensure all actions are immediate and don't require a backend
        api.enableLocalFallbackMode();
        
        // Pre-populate some historical sales for the guest to see in Reports and Finance modules
        const txsKey = 'biashara_transactions';
        try {
            const existingTxsStr = localStorage.getItem(txsKey);
            const existingTxs = existingTxsStr ? JSON.parse(existingTxsStr) : [];
            
            if (existingTxs.length === 0) {
                const now = new Date();
                const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
                const twoDaysAgo = new Date(now); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                
                const demoTxs = [
                    {
                        id: 9991,
                        invoiceNo: 'TOUR-001',
                        traderId: 1,
                        traderName: 'James Ochieng',
                        businessName: 'Green Grocers',
                        customerName: 'Demo Customer A',
                        paymentMethod: 'MPESA',
                        items: [{ id: 1, name: 'Tomatoes', price: 80, qty: 5 }],
                        itemCount: 5,
                        subtotal: 400,
                        discountRate: 0,
                        discountAmount: 0,
                        tax: 64,
                        total: 464,
                        date: twoDaysAgo.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                        time: '10:30'
                    },
                    {
                        id: 9992,
                        invoiceNo: 'TOUR-002',
                        traderId: 1,
                        traderName: 'James Ochieng',
                        businessName: 'Green Grocers',
                        customerName: 'Demo Customer B',
                        paymentMethod: 'Cash',
                        items: [{ id: 2, name: 'Onions', price: 60, qty: 10 }],
                        itemCount: 10,
                        subtotal: 600,
                        discountRate: 10,
                        discountAmount: 60,
                        tax: 86.4,
                        total: 626.4,
                        date: yesterday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                        time: '14:45'
                    }
                ];
                localStorage.setItem(txsKey, JSON.stringify(demoTxs));
            }
        } catch (e) {
            console.warn("Failed to seed tour transactions:", e);
        }

        setUser({
            id: 9999,
            username: 'Guest Client',
            role: 'manager',
            traderId: 1,
            financeActive: true,
            taxActive: true,
            productionActive: true,
            hrActive: true
        });
        showToast("Free Tour started! You are now managing 'Green Grocers' with simulated data.", "success");
    };

    useEffect(() => {
        // Fetch subscription plans for the registration select list
        api.getSubscriptionPlans()
            .then(data => setPlans(data))
            .catch(err => console.error("Could not fetch subscription plans for onboarding form:", err));

        // Restore remembered username
        try {
            const savedUsername = localStorage.getItem('biashara_remembered_username');
            if (savedUsername) {
                setUsername(savedUsername);
                setRememberMe(true);
            }
        } catch (err) {
            console.error("Failed to restore remembered username:", err);
        }
    }, []);

    const getDeviceId = () => {
        let id = localStorage.getItem('biashara_device_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('biashara_device_id', id);
        }
        return id;
    };

    const handleQuickAdminLogin = async () => {
        setUsername('admin@busnesspro.com');
        setPassword('Budinesspro9900');
        setError('');
        setIsSubmitting(true);
        try {
            const deviceId = getDeviceId();
            const deviceName = navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown Browser';
            const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
            const res = await api.loginUser({ 
                email: 'admin@busnesspro.com', 
                username: 'admin@busnesspro.com',
                password: 'Budinesspro9900',
                device_id: deviceId,
                device_name: deviceName
            });
            if (res.success || res.status === 'success') {
                try {
                    if (res.token) localStorage.setItem('biashara_auth_token', res.token);
                    localStorage.setItem('biashara_remembered_username', 'admin@busnesspro.com');
                    if (res.offlineToken) localStorage.setItem('biashara_offline_token', res.offlineToken);
                } catch (saveErr) {
                    console.error("Failed to save login persistence:", saveErr);
                }
                setUser({ 
                    id: res.userId || res.user_id,
                    username: res.username || 'admin@busnesspro.com', 
                    role: 'admin', 
                    traderId: res.traderId || res.trader_id || 6 
                });
                showToast(`Welcome back, System Admin!`, 'success');
            } else {
                setError('Login failed. Please check credentials.');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWorkspaceStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username || !password || !tenantSlug) {
            setError('Please fill all fields: Email, Password, and Biashara Slug.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.clientLoginStep1({
                email: username.trim().toLowerCase(),
                password: password.trim(),
                slug: tenantSlug.trim().toLowerCase()
            });
            
            setPendingToken(res.pending_token);
            setWorkspaceUser(res.user);
            setWorkspaceStep(2);
            showToast('Step 1 Validated! Now paste your Private Workspace Link.', 'success');
        } catch (err: any) {
            setError(err.message || 'Verification failed for this isolated biashara.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWorkspaceStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!workspaceLink) {
            setError('Please paste your Private Workspace Link.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.clientLoginStep2({
                workspace_link: workspaceLink.trim(),
                pending_token: pendingToken
            });

            if (res.session_token) {
                localStorage.setItem('biashara_auth_token', res.session_token);
            }

            // Handle First-Login Enforcement for Workspace users
            if (res.user?.password_reset_required || res.user?.passwordResetRequired) {
                setFirstLoginPendingUser({
                    res,
                    effectiveEmail: res.user.email,
                    cleanPass: password // Current temp pass
                });
                setFirstLoginNewPass('');
                setFirstLoginConfirmPass('');
                setIsFirstLoginPrompt(true);
                showToast('Welcome to your isolated biashara! Please establish a permanent password.', 'info');
                return;
            }

            setUser({
                id: res.user.id,
                username: res.user.email,
                fullName: res.user.fullName || res.user.full_name,
                role: res.user.role,
                tenantId: res.tenant_id,
                slug: res.slug,
                permissions: res.user.permissions as any
            });

            showToast(`🎉 Access Granted to ${res.slug}!`, 'success');
        } catch (err: any) {
            setError(err.message || 'Workspace link validation failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        const cleanUser = username.trim();
        const cleanPass = password.trim();
        
        if (!cleanUser || !cleanPass) {
            setError('Please enter both your email/username and password.');
            return;
        }

        setIsSubmitting(true);
        try {
            const deviceId = getDeviceId();
            const deviceName = navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown Browser';
            const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';

            const effectiveEmail = cleanUser.toLowerCase() === 'admin' ? 'admin@busnesspro.com' : cleanUser;

            const res = await api.loginUser({ 
                email: effectiveEmail, 
                username: effectiveEmail,
                password: cleanPass,
                device_id: deviceId,
                device_name: deviceName
            });
            if (res.success || res.status === 'success') {
                try {
                    if (res.token) {
                        localStorage.setItem('biashara_auth_token', res.token);
                    }
                    if (rememberMe) {
                        localStorage.setItem('biashara_remembered_username', effectiveEmail);
                    } else {
                        localStorage.removeItem('biashara_remembered_username');
                    }
                    
                    if (res.offlineToken) {
                        localStorage.setItem('biashara_offline_token', res.offlineToken);
                    }
                } catch (saveErr) {
                    console.error("Failed to save login persistence:", saveErr);
                }
                // First-Login Enforcement: Block entry until temporary password is replaced with permanent personal password
                if (res.passwordResetRequired || res.password_reset_required) {
                    setFirstLoginPendingUser({
                        res,
                        effectiveEmail,
                        cleanPass
                    });
                    setFirstLoginNewPass('');
                    setFirstLoginConfirmPass('');
                    setFirstLoginError('');
                    setIsFirstLoginPrompt(true);
                    showToast('First-time login: please establish your personal permanent password to proceed.', 'info');
                    return;
                }

                setUser({ 
                    id: res.userId || res.user_id,
                    username: res.username || res.email || effectiveEmail, 
                    fullName: res.fullName || res.full_name,
                    role: res.role || (effectiveEmail.includes('admin') ? 'admin' : 'manager'), 
                    traderId: res.traderId || res.trader_id || null,
                    permissions: res.permissions || undefined
                });
                
                // Store hybrid sync settings for apiFetch
                localStorage.setItem('biashara_current_trader', JSON.stringify({
                    id: res.traderId || res.trader_id,
                    serverIp: res.serverIp || '',
                    serverPort: res.serverPort || 8080
                }));

                showToast(`Welcome ${res.full_name || res.username || effectiveEmail}`, 'success');
            } else {
                setError('Invalid email or password. Please try again.');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFirstLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstLoginNewPass || firstLoginNewPass.length < 6) {
            setFirstLoginError('Permanent password must be at least 6 characters long.');
            return;
        }
        if (firstLoginNewPass !== firstLoginConfirmPass) {
            setFirstLoginError('Passwords do not match. Please verify your entry.');
            return;
        }
        setFirstLoginLoading(true);
        setFirstLoginError('');
        try {
            const res = await api.resetFirstLoginPassword({
                email: firstLoginPendingUser?.effectiveEmail || firstLoginPendingUser?.res?.user?.email || username,
                oldPassword: firstLoginPendingUser?.cleanPass,
                newPassword: firstLoginNewPass,
                slug: firstLoginPendingUser?.slug || firstLoginPendingUser?.res?.slug,
                user_id: firstLoginPendingUser?.res?.user?.id || firstLoginPendingUser?.res?.userId || firstLoginPendingUser?.res?.user_id
            });
            if (res.success || (res as any).status === 'success') {
                showToast('Permanent password established! Welcome to your isolated workspace.', 'success');
                const loginRes = firstLoginPendingUser.res;
                setUser({
                    id: loginRes.userId || loginRes.user_id,
                    username: loginRes.username || loginRes.email || firstLoginPendingUser.effectiveEmail,
                    fullName: loginRes.fullName || loginRes.full_name,
                    role: loginRes.role || (firstLoginPendingUser.effectiveEmail.includes('admin') ? 'admin' : 'manager'),
                    traderId: loginRes.traderId || loginRes.trader_id || null,
                    permissions: loginRes.permissions || undefined
                });
                localStorage.setItem('biashara_current_trader', JSON.stringify({
                    id: loginRes.traderId || loginRes.trader_id,
                    serverIp: loginRes.serverIp || '',
                    serverPort: loginRes.serverPort || 8080
                }));
                setIsFirstLoginPrompt(false);
                setFirstLoginPendingUser(null);
            } else {
                setFirstLoginError(res.message || 'Failed to update password. Please try again.');
            }
        } catch (err: any) {
            setFirstLoginError(err.message || 'Password update failed.');
        } finally {
            setFirstLoginLoading(false);
        }
    };

    const handleOfflineLogin = async () => {
        const token = localStorage.getItem('biashara_offline_token');
        if (token) {
            try {
                const deviceId = getDeviceId();
                const deviceName = navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown Browser';
                const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';

                const res = await api.offlineLogin(token, deviceId, deviceName, deviceType);
                if (res.success) {
                    setUser({ username: res.username, role: res.role, traderId: res.traderId });
                    
                    // Store hybrid sync settings for apiFetch
                    localStorage.setItem('biashara_current_trader', JSON.stringify({
                        id: res.traderId,
                        serverIp: res.serverIp || '',
                        serverPort: res.serverPort || 8080
                    }));

                    showToast("Offline session restored successfully!", 'success');
                    return true;
                }
            } catch (err) {
                console.warn("Offline token login failed", err);
            }
        }
        return false;
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegError('');
        
        if (!regForm.fullName || !regForm.email) {
            setRegError('Full Name and Email are required.');
            return;
        }

        if (!regForm.password || regForm.password.length < 8) {
            setRegError('Password must be at least 8 characters long.');
            return;
        }

        if (regForm.password !== regForm.confirmPassword) {
            setRegError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                email: regForm.email,
                password: regForm.password,
                full_name: regForm.fullName,
                business_name: regForm.businessName,
                phone: regForm.phone,
                country: regForm.location || 'Unknown',
                plan: regForm.plan,
                includeFinance: regForm.includeFinance,
                includeTax: regForm.includeTax,
                includeProduction: regForm.includeProduction,
                includeHr: regForm.includeHr
            };
            const res = await api.registerUser(payload);
            if (res.status === 'success' || res.success) {
                if (res.token) {
                    localStorage.setItem('biashara_auth_token', res.token);
                }
                setRegisteredData(res);
                setIsRegistered(true);
                showToast(`Trader ${regForm.fullName} registered successfully!`, 'success');
            }
        } catch (err: any) {
            setRegError(err.message || 'Registration failed. Email may already be registered.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLoginAsNewTrader = () => {
        if (registeredData) {
            setUser({
                id: registeredData.userId || registeredData.user_id,
                username: registeredData.username || registeredData.email || regForm.email,
                role: registeredData.role || 'manager',
                traderId: registeredData.traderId || registeredData.trader_id || null,
                financeActive: regForm.includeFinance,
                taxActive: regForm.includeTax,
                productionActive: regForm.includeProduction,
                hrActive: regForm.includeHr
            });
            showToast("Welcome to Biasharasasa!", "success");
        }
    };

    const handleRegChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setRegForm({ ...regForm, [e.target.name]: e.target.value });
    };

    const handleRequestRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetEmail = forgotEmail.trim();
        if (!targetEmail) {
            setRecoveryError('Please enter your email address or username.');
            return;
        }
        setRecoveryLoading(true);
        setRecoveryError('');
        try {
            const res = await api.requestPasswordReset(targetEmail);
            if (res.success) {
                setRecoverySuccessMsg(res.message || 'Recovery email dispatched with your secure token.');
                if (res.token) {
                    setRecoveryToken(res.token);
                }
                setRecoveryStep('reset');
                showToast('Recovery token generated & email sent!', 'success');
            } else {
                setRecoveryError(res.message || 'Failed to process recovery request.');
            }
        } catch (err: any) {
            setRecoveryError(err.message || 'Failed to connect to recovery service.');
        } finally {
            setRecoveryLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetEmail = forgotEmail.trim();
        const token = recoveryToken.trim();
        if (!token) {
            setRecoveryError('Please enter your secure recovery token.');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setRecoveryError('Password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setRecoveryError('Passwords do not match.');
            return;
        }

        setRecoveryLoading(true);
        setRecoveryError('');
        try {
            const res = await api.resetPassword({
                email: targetEmail,
                token,
                newPassword
            });
            if (res.success) {
                setRecoveryStep('success');
                showToast('Password updated! You can now log in.', 'success');
            } else {
                setRecoveryError(res.message || 'Failed to update password.');
            }
        } catch (err: any) {
            setRecoveryError(err.message || 'Failed to update password.');
        } finally {
            setRecoveryLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto px-4 py-8 bg-[#0a0f1d]">
            {/* Technical Background Layer with Regenerated Currency Moving Background */}
            <div 
                className="absolute inset-0 z-0 opacity-70 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url("/currency_bg.jpg")' }}
            ></div>
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`bg-white/95 backdrop-blur-md rounded-3xl w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/40 transition-all duration-300 overflow-hidden relative z-10 ${activeTab === 'register' && !isRegistered ? 'max-w-2xl' : 'max-w-[480px]'}`}
            >
                {/* Header branding */}
                <div className="p-10 pb-8 text-center relative">
                    <div className="flex justify-center mb-6">
                        <LogoSVG className="w-20 h-20 shadow-md" />
                    </div>
                    <h2 className="text-5xl font-extrabold text-[#0073CF] tracking-tight mb-2">
                        Biasharasasa
                    </h2>
                    <p className="text-slate-500 text-lg font-medium opacity-80">
                        Point of Sale & Inventory Management
                    </p>
                </div>

                {/* Tab Switcher */}
                {activeTab === 'forgot' ? (
                    <div className="flex items-center justify-between px-10 py-2">
                        <button 
                            type="button"
                            onClick={() => { setActiveTab('login'); setRecoveryError(''); }}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#6366f1] hover:underline transition cursor-pointer"
                        >
                            <ChevronLeft size={18} />
                            SIGN IN
                        </button>
                    </div>
                ) : !isRegistered && !isFirstLoginPrompt && (
                    <div className="flex px-10 border-b border-slate-100">
                        <button 
                            onClick={() => { setActiveTab('login'); setError(''); }}
                            className={`flex-1 py-4 text-[10px] sm:text-xs uppercase tracking-widest font-black border-b-4 transition-all relative ${activeTab === 'login' ? 'border-[#0073CF] text-[#0073CF]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            SIGN IN
                        </button>
                        <button 
                            onClick={() => { setActiveTab('workspace'); setError(''); setWorkspaceStep(1); }}
                            className={`flex-1 py-4 text-[10px] sm:text-xs uppercase tracking-widest font-black border-b-4 transition-all relative ${activeTab === 'workspace' ? 'border-[#0073CF] text-[#0073CF]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            WORKSPACE
                        </button>
                        <button 
                            onClick={() => { setActiveTab('register'); setRegError(''); }}
                            className={`flex-1 py-4 text-[10px] sm:text-xs uppercase tracking-widest font-black border-b-4 transition-all relative ${activeTab === 'register' ? 'border-[#0073CF] text-[#0073CF]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            REGISTER
                        </button>
                        <button 
                            onClick={() => { setActiveTab('tour'); }}
                            className={`flex-1 py-4 text-[10px] sm:text-xs uppercase tracking-widest font-black border-b-4 transition-all relative ${activeTab === 'tour' ? 'border-[#0073CF] text-[#0073CF]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            TOUR
                        </button>
                    </div>
                )}

                <div className="p-10 pt-8">
                    {isFirstLoginPrompt ? (
                        <form onSubmit={handleFirstLoginSubmit} className="text-left space-y-5">
                            <div className="text-center mb-6">
                                <div className="inline-flex p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl mb-3 shadow-xs">
                                    <ShieldCheck size={28} />
                                </div>
                                <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 mb-2">
                                    Security Compliance Requirement
                                </div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                                    Establish Permanent Password
                                </h3>
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                    Your account was initialized with a temporary password. Under tenant domicile and RBAC security standards, you must establish a personal permanent password before accessing the workspace.
                                </p>
                            </div>

                            {firstLoginError && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                                    <span>{firstLoginError}</span>
                                </div>
                            )}

                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Account Identity</div>
                                    <div className="text-xs font-bold text-slate-800 font-mono">
                                        {firstLoginPendingUser?.effectiveEmail || firstLoginPendingUser?.res?.email || username}
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                    Tenant Domiciled
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    New Permanent Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showFirstLoginPass ? "text" : "password"}
                                        required
                                        minLength={6}
                                        value={firstLoginNewPass}
                                        onChange={(e) => setFirstLoginNewPass(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#0073CF] outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowFirstLoginPass(!showFirstLoginPass)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showFirstLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Confirm Permanent Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showFirstLoginConfirm ? "text" : "password"}
                                        required
                                        minLength={6}
                                        value={firstLoginConfirmPass}
                                        onChange={(e) => setFirstLoginConfirmPass(e.target.value)}
                                        placeholder="Re-type new password"
                                        className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#0073CF] outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowFirstLoginConfirm(!showFirstLoginConfirm)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showFirstLoginConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={firstLoginLoading}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                                {firstLoginLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Saving Password...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={15} />
                                        <span>Establish Password & Enter Workspace</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsFirstLoginPrompt(false);
                                    setFirstLoginPendingUser(null);
                                }}
                                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition text-center cursor-pointer"
                            >
                                Cancel & Return to Sign In
                            </button>
                        </form>
                    ) : activeTab === 'login' ? (
                        /* LOGIN FORM */
                        <form onSubmit={handleLogin} className="text-left space-y-5">
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-xl text-xs space-y-3 shadow-md ${
                                        error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('password')
                                            ? 'bg-rose-50 border border-rose-200 text-rose-950'
                                            : 'bg-amber-50 border border-amber-200 text-amber-950'
                                    }`}
                                >
                                    <div className="flex gap-2 items-start">
                                        <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                                            error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('password')
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('password') ? (
                                                <Key size={14} />
                                            ) : (
                                                <WifiOff size={14} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <strong className={`block font-black text-sm ${
                                                error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('password')
                                                    ? 'text-rose-900'
                                                    : 'text-amber-900'
                                            }`}>
                                                {error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('password')
                                                    ? 'Authentication Failed'
                                                    : 'Connection Issue / Server Offline'}
                                            </strong>
                                            <p className={`mt-1 leading-relaxed break-words ${
                                                error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('password')
                                                    ? 'text-rose-700'
                                                    : 'text-amber-700'
                                            }`}>
                                                {error}
                                            </p>
                                        </div>
                                    </div>
                                    {!(error.toLowerCase().includes('credential') || error.toLowerCase().includes('invalid')) && (
                                        <div className="pt-2.5 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <span className="text-[10px] text-slate-600 leading-normal font-medium">
                                                Server connection issue detected.
                                            </span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const success = await handleOfflineLogin();
                                                    if (success) return;
                                                    api.enableLocalFallbackMode();
                                                    showToast("Offline local database fallback mode activated!", 'info');
                                                    setError("");
                                                }}
                                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap shadow-sm"
                                            >
                                                Offline Fallback
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-black uppercase tracking-wider text-slate-600">EMAIL ADDRESS</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                        <Mail size={20} />
                                    </span>
                                    <input 
                                        type="text" 
                                        className="w-full pl-12 pr-4 py-4 text-base border-2 border-slate-900 rounded-xl focus:outline-none focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 transition-all bg-[#eff6ff] font-medium shadow-sm placeholder:text-slate-400"
                                        placeholder="admin@businesspro.com" 
                                        value={username} 
                                        onChange={(e) => setUsername(e.target.value)}
                                        autoComplete="username"
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-black uppercase tracking-wider text-slate-600">PASSWORD</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                        <Key size={20} />
                                    </span>
                                    <input 
                                        type={showPassword ? 'text' : 'password'} 
                                        className="w-full pl-12 pr-14 py-4 text-base border-2 border-slate-900 rounded-xl focus:outline-none focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 transition-all bg-[#eff6ff] font-medium shadow-sm placeholder:text-slate-400"
                                        placeholder="••••••••••••" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        required 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 text-sm">
                                <label className="flex items-center gap-3 text-slate-500 cursor-pointer select-none font-medium">
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 accent-[#6366f1] cursor-pointer" 
                                    />
                                    Remember me
                                </label>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setForgotEmail(username.trim());
                                        setRecoveryStep('request');
                                        setRecoveryError('');
                                        setRecoverySuccessMsg('');
                                        setActiveTab('forgot');
                                    }}
                                    className="text-[#6366f1] hover:underline font-black transition cursor-pointer"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full py-5 bg-[#0073CF] hover:bg-[#005fa9] shadow-xl text-white rounded-xl text-xl font-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 mt-4"
                            >
                                {isSubmitting ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            <div className="text-center text-slate-500 text-sm mt-8">
                                Don't have an account?{' '}
                                <button 
                                    type="button" 
                                    onClick={() => setActiveTab('register')}
                                    className="text-[#6366f1] font-black hover:underline"
                                >
                                    Register Account
                                </button>
                            </div>

                            <div className="text-center pt-6 border-t border-slate-100 mt-6">
                                <p className="text-sm font-black text-[#6366f1]/60 uppercase tracking-widest">
                                    Powered by PrimeAxis Systems
                                </p>
                            </div>
                        </form>
                    ) : activeTab === 'workspace' ? (
                        /* ISOLATED WORKSPACE 2-STEP LOGIN FLOW */
                        <div className="space-y-6">
                            {workspaceStep === 1 ? (
                                <form onSubmit={handleWorkspaceStep1} className="text-left space-y-5">
                                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                            <Database size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">Step 1: Identity & Tenant</h3>
                                            <p className="text-xs text-slate-500">Verify credentials against isolated DB</p>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                                            <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600">BIASHARA SLUG</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <Globe size={20} />
                                            </span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-slate-900 rounded-xl focus:outline-none focus:border-[#6366f1] transition-all bg-[#eff6ff] font-bold shadow-sm"
                                                placeholder="e.g. green-grocers-4a2f" 
                                                value={tenantSlug} 
                                                onChange={(e) => setTenantSlug(e.target.value)}
                                                required 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600">EMAIL ADDRESS</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <Mail size={20} />
                                            </span>
                                            <input 
                                                type="email" 
                                                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-slate-900 rounded-xl focus:outline-none focus:border-[#6366f1] transition-all bg-[#eff6ff] font-medium shadow-sm"
                                                placeholder="user@biashara.co.ke" 
                                                value={username} 
                                                onChange={(e) => setUsername(e.target.value)}
                                                required 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600">PASSWORD</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <Key size={20} />
                                            </span>
                                            <input 
                                                type={showPassword ? 'text' : 'password'} 
                                                className="w-full pl-12 pr-14 py-3 text-sm border-2 border-slate-900 rounded-xl focus:outline-none focus:border-[#6366f1] transition-all bg-[#eff6ff] font-medium shadow-sm"
                                                placeholder="••••••••••••" 
                                                value={password} 
                                                onChange={(e) => setPassword(e.target.value)}
                                                required 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="w-full py-4 bg-slate-900 hover:bg-black shadow-xl text-white rounded-xl text-sm font-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <span>Next: Handshake Step</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleWorkspaceStep2} className="text-left space-y-5 animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                        <button 
                                            type="button" 
                                            onClick={() => setWorkspaceStep(1)}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">Step 2: Workspace Access</h3>
                                            <p className="text-xs text-slate-500">Paste your private workspace link</p>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1">
                                        <div className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Verified Account</div>
                                        <div className="text-sm font-bold text-emerald-900">{username}</div>
                                        <div className="text-xs text-emerald-700 font-mono">Biashara: {tenantSlug}</div>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                                            <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600">WORKSPACE LINK</label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <Globe size={20} />
                                            </span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-slate-900 rounded-xl focus:outline-none focus:border-[#6366f1] transition-all bg-[#eff6ff] font-mono shadow-sm"
                                                placeholder="https://biasharasasa.netlify.app/access/..." 
                                                value={workspaceLink} 
                                                onChange={(e) => setWorkspaceLink(e.target.value)}
                                                required 
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 italic">
                                            * Obtain this link from your Workspace Administrator.
                                        </p>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="w-full py-4 bg-[#0073CF] hover:bg-[#005fa9] shadow-xl text-white rounded-xl text-sm font-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Zap size={18} />
                                                <span>Validate & Enter Biashara</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            <div className="text-center pt-4 border-t border-slate-100 mt-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                    <ShieldCheck size={12} /> Isolated Tenant Security Boundary
                                </p>
                            </div>
                        </div>
                    ) : activeTab === 'forgot' ? (
                        /* FORGOT PASSWORD / SECURE TOKEN RECOVERY FLOW */
                        <div className="space-y-5">
                            {recoveryStep === 'request' && (
                                <form onSubmit={handleRequestRecovery} className="text-left space-y-4">
                                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                            <Key size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
                                            <p className="text-xs text-slate-500">Secure backend token recovery</p>
                                        </div>
                                    </div>

                                    {recoveryError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5"
                                        >
                                            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                            <div className="flex-1 leading-relaxed">{recoveryError}</div>
                                        </motion.div>
                                    )}

                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Enter your registered email address or username. The backend service will verify your account and generate a cryptographically signed recovery token.
                                    </p>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Email Address or Username
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                                                <Mail size={16} />
                                            </span>
                                            <input
                                                type="text"
                                                required
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                placeholder="e.g. admin@busnesspro.com"
                                                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={recoveryLoading}
                                        className="w-full py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:shadow-lg hover:shadow-indigo-500/20 text-white rounded-lg text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                    >
                                        {recoveryLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <span>Send Recovery Email</span>
                                                <ArrowRight size={15} />
                                            </>
                                        )}
                                    </button>

                                    <div className="pt-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => { setActiveTab('login'); setRecoveryError(''); }}
                                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-bold transition cursor-pointer"
                                        >
                                            <ChevronLeft size={14} />
                                            Back to Sign In
                                        </button>
                                    </div>
                                </form>
                            )}

                            {recoveryStep === 'reset' && (
                                <form onSubmit={handleResetPasswordSubmit} className="text-left space-y-4">
                                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">Set New Password</h3>
                                            <p className="text-xs text-slate-500">Account: <span className="font-semibold text-slate-700">{forgotEmail}</span></p>
                                        </div>
                                    </div>

                                    {recoverySuccessMsg && (
                                        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
                                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                            <div className="flex-1 leading-relaxed">{recoverySuccessMsg}</div>
                                        </div>
                                    )}

                                    {recoveryError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5"
                                        >
                                            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                            <div className="flex-1 leading-relaxed">{recoveryError}</div>
                                        </motion.div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                                Secure Recovery Token
                                            </label>
                                            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-150">
                                                Backend Generated
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                                                <Key size={16} />
                                            </span>
                                            <input
                                                type="text"
                                                required
                                                value={recoveryToken}
                                                onChange={(e) => setRecoveryToken(e.target.value)}
                                                placeholder="Paste or enter recovery token"
                                                className="w-full pl-10 pr-4 py-2.5 text-xs font-mono border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                                                <Lock size={16} />
                                            </span>
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                required
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Minimum 6 characters"
                                                className="w-full pl-10 pr-10 py-2.5 text-sm border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                            Confirm New Password
                                        </label>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                                                <Lock size={16} />
                                            </span>
                                            <input
                                                type={showConfirmNewPassword ? 'text' : 'password'}
                                                required
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                placeholder="Re-enter new password"
                                                className="w-full pl-10 pr-10 py-2.5 text-sm border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showConfirmNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={recoveryLoading}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-lg hover:shadow-emerald-600/20 text-white rounded-lg text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                    >
                                        {recoveryLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <ShieldCheck size={16} />
                                                <span>Reset Password</span>
                                            </>
                                        )}
                                    </button>

                                    <div className="flex items-center justify-between pt-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => { setRecoveryStep('request'); setRecoveryError(''); }}
                                            className="text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                                        >
                                            Request new token
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveTab('login'); setRecoveryError(''); }}
                                            className="text-indigo-600 font-bold hover:underline cursor-pointer"
                                        >
                                            Back to Sign In
                                        </button>
                                    </div>
                                </form>
                            )}

                            {recoveryStep === 'success' && (
                                <div className="text-center py-4 space-y-4">
                                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Password Reset!</h3>
                                        <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
                                            Your password has been successfully updated. You can now sign in using your new credentials.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUsername(forgotEmail);
                                            setPassword('');
                                            setActiveTab('login');
                                            setRecoveryStep('request');
                                            setRecoveryError('');
                                        }}
                                        className="w-full py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg text-sm font-bold transition shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
                                    >
                                        Proceed to Sign In
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'register' ? (
                        /* REGISTRATION FLOW */
                        isRegistered ? (
                            /* SUCCESS SCREEN */
                            <div className="text-center py-6 space-y-6">
                                <motion.div 
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex justify-center"
                                >
                                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-lg border border-green-100 ring-8 ring-green-50/50">
                                        <CheckCircle2 size={42} />
                                    </div>
                                </motion.div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold text-slate-900">Welcome to the Platform! 🎉</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                                        Your trader account has been successfully created. 
                                        {regForm.plan.includes('Distributor') 
                                            ? " Since you chose the Distributor / Wholesale tier, your subscription is pending admin fee validation." 
                                            : " You can now dive right into your dashboard and start managing your business."
                                        }
                                    </p>
                                </div>

                                <div className="bg-white border border-slate-200 p-5 rounded-2xl text-left text-xs font-medium max-w-sm mx-auto space-y-3 shadow-sm">
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-slate-400 font-bold uppercase tracking-tight">Trader Profile</span>
                                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">{regForm.plan}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between"><span className="text-slate-500">Full Name</span> <span className="text-slate-800 font-bold">{regForm.fullName}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Business</span> <span className="text-slate-800 font-bold">{regForm.businessName || '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Email</span> <span className="text-slate-800">{regForm.email}</span></div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Status</span> 
                                            <span className={`font-bold flex items-center gap-1 ${regForm.plan.includes('Distributor') ? 'text-amber-600' : 'text-green-600'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${regForm.plan.includes('Distributor') ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></div>
                                                {regForm.plan.includes('Distributor') ? 'Pending Approval' : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 max-w-sm mx-auto">
                                    <button 
                                        onClick={handleLoginAsNewTrader}
                                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer group"
                                    >
                                        Launch Dashboard <LayoutDashboard size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    
                                    <button 
                                        onClick={() => {
                                            setIsRegistered(false);
                                            setActiveTab('login');
                                            setRegStep(1);
                                            setRegForm({
                                                fullName: '',
                                                email: '',
                                                phone: '',
                                                location: '',
                                                businessName: '',
                                                taxId: '',
                                                plan: 'Starter',
                                                includeFinance: false,
                                                includeTax: false,
                                                includeProduction: false,
                                                includeHr: false,
                                                discountRate: 0,
                                                customerSince: new Date().toISOString().split('T')[0],
                                                password: '',
                                                confirmPassword: ''
                                            });
                                        }}
                                        className="w-full py-3 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <ChevronLeft size={14} /> Back to Sign In
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* THE ACTUAL SELF-REGISTRATION FORM - MULTI-STEP WIZARD */
                            <div className="text-left space-y-6">
                                {/* Wizard Progress Header */}
                                <div className="flex items-center justify-between px-2 mb-2">
                                    {[1, 2, 3].map((step) => (
                                        <div key={step} className="flex items-center">
                                            <div className={`
                                                flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300
                                                ${regStep === step ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 
                                                  regStep > step ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}
                                            `}>
                                                {regStep > step ? <Check size={16} /> : step}
                                            </div>
                                            {step < 3 && (
                                                <div className={`w-12 h-1 mx-2 rounded-full ${regStep > step ? 'bg-green-500' : 'bg-slate-100'}`} />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-1">
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {regStep === 1 ? 'Create Your Account' : 
                                         regStep === 2 ? 'Business Profile' : 'Plan & Add-ons'}
                                    </h2>
                                    <p className="text-slate-500 text-xs leading-relaxed">
                                        {regStep === 1 ? 'Start by setting up your login credentials.' : 
                                         regStep === 2 ? 'Tell us about your trade outlet and shop details.' : 'Select a subscription level and optional modules.'}
                                    </p>
                                </div>

                                {regError && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3.5 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100 font-medium flex items-center gap-2"
                                    >
                                        <AlertCircle size={16} />
                                        {regError}
                                    </motion.div>
                                )}

                                <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                                    <AnimatePresence mode="wait">
                                        {regStep === 1 && (
                                            <motion.div 
                                                key="step1"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                                                    <div className="space-y-1.5">
                                                        <label className="block text-xs font-bold text-slate-500 ml-1">Full Name *</label>
                                                        <div className="relative group">
                                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                <User size={16} />
                                                            </span>
                                                            <input 
                                                                type="text" 
                                                                name="fullName"
                                                                required 
                                                                className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                placeholder="e.g. John Kamau" 
                                                                value={regForm.fullName} 
                                                                onChange={handleRegChange}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="block text-xs font-bold text-slate-500 ml-1">Email Address *</label>
                                                        <div className="relative group">
                                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                <Mail size={16} />
                                                            </span>
                                                            <input 
                                                                type="email" 
                                                                name="email"
                                                                required 
                                                                className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                placeholder="email@example.com" 
                                                                value={regForm.email} 
                                                                onChange={handleRegChange}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-bold text-slate-500 ml-1">Password *</label>
                                                            <div className="relative group">
                                                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                    <Key size={16} />
                                                                </span>
                                                                <input 
                                                                    type={showRegPassword ? 'text' : 'password'} 
                                                                    name="password"
                                                                    required 
                                                                    minLength={8}
                                                                    className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                    placeholder="8+ characters" 
                                                                    value={regForm.password} 
                                                                    onChange={handleRegChange}
                                                                />
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setShowRegPassword(!showRegPassword)}
                                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-bold text-slate-500 ml-1">Confirm Password *</label>
                                                            <div className="relative group">
                                                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                    <Key size={16} />
                                                                </span>
                                                                <input 
                                                                    type={showRegConfirm ? 'text' : 'password'} 
                                                                    name="confirmPassword"
                                                                    required 
                                                                    className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                    placeholder="Confirm" 
                                                                    value={regForm.confirmPassword} 
                                                                    onChange={handleRegChange}
                                                                />
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setShowRegConfirm(!showRegConfirm)}
                                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {showRegConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    disabled={!regForm.email || !regForm.password || regForm.password !== regForm.confirmPassword}
                                                    onClick={() => setRegStep(2)}
                                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 group cursor-pointer"
                                                >
                                                    Continue to Profile <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            </motion.div>
                                        )}

                                        {regStep === 2 && (
                                            <motion.div 
                                                key="step2"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                                                    <div className="space-y-1.5">
                                                        <label className="block text-xs font-bold text-slate-500 ml-1">Business / Shop Name *</label>
                                                        <div className="relative group">
                                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                <Building size={16} />
                                                            </span>
                                                            <input 
                                                                type="text" 
                                                                name="businessName"
                                                                required
                                                                className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                placeholder="e.g. Skyline Retailers" 
                                                                value={regForm.businessName} 
                                                                onChange={handleRegChange}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-bold text-slate-500 ml-1">Phone Number *</label>
                                                            <div className="relative group">
                                                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                    <Phone size={16} />
                                                                </span>
                                                                <input 
                                                                    type="text" 
                                                                    name="phone"
                                                                    required
                                                                    className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                    placeholder="+254..." 
                                                                    value={regForm.phone} 
                                                                    onChange={handleRegChange}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-bold text-slate-500 ml-1">Location / City *</label>
                                                            <div className="relative group">
                                                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                    <MapPin size={16} />
                                                                </span>
                                                                <input 
                                                                    type="text" 
                                                                    name="location"
                                                                    required
                                                                    className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                    placeholder="City, Country" 
                                                                    value={regForm.location} 
                                                                    onChange={handleRegChange}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="block text-xs font-bold text-slate-500 ml-1">Tax ID / PIN (Optional)</label>
                                                        <div className="relative group">
                                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                                <FileText size={16} />
                                                            </span>
                                                            <input 
                                                                type="text" 
                                                                name="taxId"
                                                                className="w-full pl-10 pr-3 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm transition-all"
                                                                placeholder="e.g. K123456789X" 
                                                                value={regForm.taxId} 
                                                                onChange={handleRegChange}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setRegStep(1)}
                                                        className="w-24 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer"
                                                    >
                                                        Back
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        disabled={!regForm.businessName || !regForm.phone || !regForm.location}
                                                        onClick={() => setRegStep(3)}
                                                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 group cursor-pointer"
                                                    >
                                                        Review Plan <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}

                                        {regStep === 3 && (
                                            <motion.div 
                                                key="step3"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="block text-xs font-bold text-slate-500 ml-1">Subscription Plan</label>
                                                        <div className="grid grid-cols-1 gap-2.5">
                                                            {(plans.length > 0 ? plans : [
                                                                { id: 1, name: 'Starter', price: '$50', stockLimitDesc: 'Up to 50 items' },
                                                                { id: 2, name: 'Pro', price: '$100', stockLimitDesc: 'Up to 100 items' },
                                                                { id: 3, name: 'Enterprise', price: '$250', stockLimitDesc: 'Unlimited' }
                                                            ]).map((p: any) => (
                                                                <label key={p.id} className={`
                                                                    flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer
                                                                    ${regForm.plan === p.name ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200'}
                                                                `}>
                                                                    <div className="flex items-center gap-3">
                                                                        <input 
                                                                            type="radio" 
                                                                            name="plan" 
                                                                            value={p.name} 
                                                                            checked={regForm.plan === p.name}
                                                                            onChange={(e) => setRegForm({...regForm, plan: e.target.value})}
                                                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                                                        />
                                                                        <div>
                                                                            <p className="text-sm font-bold text-slate-900">{p.name}</p>
                                                                            <p className="text-[10px] text-slate-500 font-medium uppercase">{p.stockLimitDesc}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm font-black text-indigo-600">{p.price}</p>
                                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Per Month</p>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        <label className="block text-xs font-bold text-slate-500 ml-1">Optional Modules (+50% fee each)</label>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                                            {[
                                                                { id: 'finance', name: 'Finance', icon: <Database size={14} />, desc: 'Ledgers (+50%)', formKey: 'includeFinance' as const },
                                                                { id: 'tax', name: 'Tax Compliance', icon: <Globe size={14} />, desc: 'KRA/ETR (+50%)', formKey: 'includeTax' as const },
                                                                { id: 'production', name: 'SME Production', icon: <Zap size={14} />, desc: 'BOM/Batches (+50%)', formKey: 'includeProduction' as const },
                                                                { id: 'hr', name: 'HR & Payroll', icon: <UserCheck size={14} />, desc: 'Staff/Pay (+50%)', formKey: 'includeHr' as const }
                                                            ].map(mod => (
                                                                <button
                                                                    key={mod.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setRegForm({ ...regForm, [mod.formKey]: !regForm[mod.formKey] });
                                                                    }}
                                                                    className={`
                                                                        p-3 rounded-xl border-2 transition-all text-left flex flex-col gap-1 cursor-pointer
                                                                        ${regForm[mod.formKey] 
                                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                                                                            : 'border-slate-100 bg-white text-slate-500 grayscale opacity-70'}
                                                                    `}
                                                                >
                                                                    <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-tight">
                                                                        {mod.icon} {mod.name}
                                                                    </div>
                                                                    <p className="text-[9px] font-medium opacity-80">{mod.desc}</p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setRegStep(2)}
                                                        className="w-24 py-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer"
                                                    >
                                                        Back
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={handleRegister}
                                                        disabled={isSubmitting}
                                                        className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-sm font-black transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                Onboarding...
                                                            </>
                                                        ) : (
                                                            <>Finalize Registration <ShieldCheck size={18} /></>
                                                        )}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </form>
                                
                                <div className="text-center pt-6 border-t border-slate-100 mt-6">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                        Powered by PrimeAxis Systems
                                    </p>
                                </div>
                            </div>
                        )
                    ) : (
                        /* TOUR TAB CONTENT */
                        <div className="space-y-6 text-center animate-fade-in py-4">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Explore Biasharasasa</h3>
                                <p className="text-lg text-slate-500 leading-relaxed max-w-sm mx-auto">The ultimate hybrid POS system for modern traders in East Africa.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 text-left">
                                {[
                                    { icon: <Globe size={22} />, title: "Cloud Intelligence", desc: "Access sales & inventory from anywhere.", color: "text-blue-600 bg-blue-50" },
                                    { icon: <Database size={22} />, title: "Hybrid Syncing", desc: "Dual-storage ensures 100% data safety.", color: "text-indigo-600 bg-indigo-50" },
                                    { icon: <Zap size={22} />, title: "Lightning Fast POS", desc: "Quick entry with barcode support.", color: "text-amber-600 bg-amber-50" }
                                ].map((feature, i) => (
                                    <div key={i} className="flex gap-4 p-5 rounded-2xl border-2 border-slate-900 hover:shadow-md transition-all bg-white">
                                        <div className={`p-3 rounded-xl shrink-0 ${feature.color}`}>
                                            {feature.icon}
                                        </div>
                                        <div>
                                            <h4 className="text-base font-black text-slate-800">{feature.title}</h4>
                                            <p className="text-sm text-slate-500 leading-normal">{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 space-y-4">
                                <button 
                                    onClick={handleFreeTour}
                                    className="w-full py-5 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-2xl text-lg font-black shadow-xl shadow-[#6366f1]/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 group cursor-pointer border-none"
                                >
                                    LAUNCH INTERACTIVE TOUR <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                                <p className="text-xs text-slate-400 font-bold">No installation or registration required.</p>
                            </div>

                            <div className="text-center pt-6 border-t border-slate-100 mt-6">
                                <p className="text-sm font-black text-[#6366f1]/60 uppercase tracking-widest">
                                    Powered by PrimeAxis Systems
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

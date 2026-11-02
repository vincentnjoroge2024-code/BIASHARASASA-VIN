import React, { useRef } from 'react';
import { X, Printer, Download, Key, Globe, ShieldCheck, Mail, User, Building2, Terminal } from 'lucide-react';
import { ClientTenantUser } from '../types';
import { LogoSVG } from './Logo';
import { transferPreviewToPrinter, exportElementToPdf } from '../utils/printEngine';

interface LoginSlipModalProps {
    user: ClientTenantUser | null;
    workspaceName: string;
    workspaceSlug: string;
    workspaceLink: string;
    onClose: () => void;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LoginSlipContent: React.FC<{
    user: ClientTenantUser;
    workspaceName: string;
    workspaceSlug: string;
    workspaceLink: string;
}> = ({ user, workspaceName, workspaceSlug, workspaceLink }) => {
    return (
        <div className="print-container printable-item bg-white w-[80mm] p-6 shadow-lg border border-slate-200 text-slate-900 font-mono text-[11px] leading-tight mx-auto">
            <div className="text-center space-y-2 border-b-2 border-black border-dashed pb-4 mb-4">
                <LogoSVG className="w-12 h-12 mx-auto grayscale" />
                <h2 className="text-base font-black uppercase tracking-tighter">BIASHARA SASA</h2>
                <p className="text-[9px] font-bold">Isolated Enterprise Workspace</p>
                <div className="mt-2 inline-block bg-black text-white px-2 py-1 text-[10px] font-black uppercase">
                    Welcome to the Team
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <div className="text-[9px] uppercase font-bold text-slate-500">Business Environment</div>
                    <div className="font-black text-[12px] uppercase">{workspaceName}</div>
                    <div className="text-[10px] font-bold text-indigo-600 italic">Slug: {workspaceSlug}</div>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-200 border-dashed">
                    <div className="flex justify-between">
                        <span className="font-bold">MEMBER:</span>
                        <span className="font-black truncate max-w-[120px]">{user.fullName || 'User'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">ROLE:</span>
                        <span className="font-black uppercase">{user.role}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">STATION:</span>
                        <span className="font-black">{user.sellingPointId || 'Main Store'}</span>
                    </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                    <div className="space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                                <Mail size={10} /> Account ID (Username)
                            </div>
                        </div>
                        <div className="font-black text-[11px] break-all">{user.email}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                                <Key size={10} /> Temporary Secret
                            </div>
                        </div>
                        <div className="font-black text-[14px] bg-black text-white px-2 py-1 rounded inline-block">
                            {user.initialPassword || '********'}
                        </div>
                        <p className="text-[8px] text-slate-500 italic mt-1">* Change password after first login.</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="text-[9px] uppercase font-bold text-slate-500 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                            <Globe size={10} /> Private Workspace Gateway
                        </div>
                    </div>
                    <div className="font-mono text-[8px] break-all bg-white p-2 border border-slate-900">
                        {workspaceLink}
                    </div>
                </div>

                <div className="pt-4 text-center border-t border-black border-dashed">
                    <div className="flex justify-center mb-2">
                        <ShieldCheck size={24} className="text-slate-400" />
                    </div>
                    <p className="text-[8px] font-bold uppercase tracking-widest">
                        SECURE TENANT SESSION BOUNDARY
                    </p>
                    <p className="text-[7px] text-slate-400 mt-1">
                        Generated: {new Date().toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export const LoginSlipModal: React.FC<LoginSlipModalProps> = ({
    user,
    workspaceName,
    workspaceSlug,
    workspaceLink,
    onClose,
    showToast
}) => {
    const slipRef = useRef<HTMLDivElement>(null);

    if (!user) return null;

    const handlePrint = async () => {
        if (!slipRef.current) return;
        showToast('Transferring welcome slip to printer...', 'info');
        try {
            await transferPreviewToPrinter(slipRef.current, {
                format: '80mm',
                model: 'premax_pos80c',
                documentTitle: `Login_Slip_${user.email}`
            });
            showToast('Welcome slip sent to printer!', 'success');
        } catch (e) {
            window.print();
        }
    };

    const handleDownloadPdf = async () => {
        if (!slipRef.current) return;
        try {
            await exportElementToPdf(slipRef.current, '80mm', `Welcome_Slip_${user.email}.pdf`);
            showToast('Welcome slip PDF saved!', 'success');
        } catch (e) {
            showToast('Failed to generate PDF', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-md overflow-hidden border border-white/20 flex flex-col">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                            <Key size={18} />
                        </div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Tenant Welcome Voucher</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition text-slate-400 cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 bg-slate-100 flex justify-center overflow-y-auto">
                    <div ref={slipRef} className="w-full">
                        <LoginSlipContent 
                            user={user}
                            workspaceName={workspaceName}
                            workspaceSlug={workspaceSlug}
                            workspaceLink={workspaceLink}
                        />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50">
                    <button 
                        onClick={handleDownloadPdf}
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                        <Download size={16} /> Save PDF
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                        <Printer size={16} /> Print Slip
                    </button>
                </div>
            </div>
        </div>
    );
};

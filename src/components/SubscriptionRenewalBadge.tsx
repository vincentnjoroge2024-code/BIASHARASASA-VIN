import React, { useState } from 'react';
import { Clock, AlertTriangle, ShieldCheck, Calendar, Bell } from 'lucide-react';
import { RenewalNotificationInfo } from '../types';

interface SubscriptionRenewalBadgeProps {
    currentRenewal: RenewalNotificationInfo | null;
    allExpiringTraders: RenewalNotificationInfo[];
    isAdmin: boolean;
    onClick: () => void;
}

export const SubscriptionRenewalBadge: React.FC<SubscriptionRenewalBadgeProps> = ({
    currentRenewal,
    allExpiringTraders,
    isAdmin,
    onClick
}) => {
    // Determine if there is an active alert (renewal within 7 days or overdue)
    const expiringCount = allExpiringTraders.length;
    const isDueSoon = currentRenewal?.isDueSoon || (isAdmin && expiringCount > 0);
    const isUrgent = currentRenewal?.isUrgent || allExpiringTraders.some(t => t.isUrgent);
    const isOverdue = currentRenewal?.isOverdue || allExpiringTraders.some(t => t.isOverdue);

    // If no renewal due soon and not admin checking, render a calm normal status badge
    if (!isDueSoon) {
        if (!currentRenewal) return null;
        return (
            <button
                type="button"
                onClick={onClick}
                title={`Subscription Active (${currentRenewal.planName} Plan). Expires on ${currentRenewal.expiryDateFormatted}. Click to view or renew.`}
                className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold tracking-tight transition-all cursor-pointer shadow-sm"
            >
                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                <span className="truncate max-w-[110px]">{currentRenewal.planName} Plan</span>
                <span className="text-[10px] text-slate-400 font-mono">({currentRenewal.daysRemaining}d)</span>
            </button>
        );
    }

    // High-visibility Alert / Visual Badge for ≤ 7 days
    let badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
    let ringColor = 'ring-amber-500/30';
    let dotColor = 'bg-amber-400';
    let label = '';

    if (isAdmin && expiringCount > 1) {
        label = `${expiringCount} Renewals Due`;
    } else if (isOverdue) {
        badgeBg = 'bg-rose-500/25 text-rose-300 border-rose-500/50 hover:bg-rose-500/35';
        ringColor = 'ring-rose-500/40';
        dotColor = 'bg-rose-500';
        label = 'Subscription Expired';
    } else if (isUrgent) {
        badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30';
        ringColor = 'ring-rose-500/30';
        dotColor = 'bg-rose-400';
        const days = currentRenewal?.daysRemaining ?? allExpiringTraders[0]?.daysRemaining ?? 1;
        label = days === 0 ? 'Renews Today!' : `Renews in ${days}d`;
    } else {
        badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30';
        ringColor = 'ring-amber-500/30';
        dotColor = 'bg-amber-400';
        const days = currentRenewal?.daysRemaining ?? allExpiringTraders[0]?.daysRemaining ?? 7;
        label = `Renewal in ${days}d`;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            title={
                isAdmin && expiringCount > 1 
                    ? `${expiringCount} merchant subscriptions are due for renewal within the next 7 days. Click to review.`
                    : `⚠️ Subscription renewal due in ${currentRenewal?.daysRemaining ?? 7} days (${currentRenewal?.expiryDateFormatted}). Click to review or renew.`
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-tight shadow-md transition-all cursor-pointer animate-pulse hover:scale-105 active:scale-95 ${badgeBg} ${ringColor}`}
        >
            <span className="relative flex h-2 w-2 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
            </span>

            {isOverdue ? (
                <AlertTriangle size={13} className="text-rose-400 shrink-0" />
            ) : (
                <Clock size={13} className={isUrgent ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />
            )}

            <span className="hidden sm:inline whitespace-nowrap">{label}</span>
            <span className="sm:hidden font-mono font-black">
                {currentRenewal?.daysRemaining !== undefined ? `${currentRenewal.daysRemaining}d` : 'Renew'}
            </span>

            {/* Visual count badge */}
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5 shrink-0 ${
                isOverdue ? 'bg-rose-500 text-white' : isUrgent ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
            }`}>
                {isAdmin && expiringCount > 1 ? expiringCount : '7d'}
            </span>
        </button>
    );
};

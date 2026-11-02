import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ArrowRight, X, ShieldAlert } from 'lucide-react';
import { RenewalNotificationInfo } from '../types';

interface SubscriptionAlertBannerProps {
    renewalInfo: RenewalNotificationInfo | null;
    onOpenModal: () => void;
}

export const SubscriptionAlertBanner: React.FC<SubscriptionAlertBannerProps> = ({
    renewalInfo,
    onOpenModal
}) => {
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        if (renewalInfo) {
            const dismissedKey = `dismissed_sub_banner_${renewalInfo.traderId}_${renewalInfo.expiryDateFormatted}`;
            setIsDismissed(sessionStorage.getItem(dismissedKey) === 'true');
        }
    }, [renewalInfo]);

    if (!renewalInfo || !renewalInfo.isDueSoon || isDismissed) {
        return null;
    }

    const handleDismiss = () => {
        setIsDismissed(true);
        const dismissedKey = `dismissed_sub_banner_${renewalInfo.traderId}_${renewalInfo.expiryDateFormatted}`;
        sessionStorage.setItem(dismissedKey, 'true');
    };

    const isUrgent = renewalInfo.isUrgent;
    const isOverdue = renewalInfo.isOverdue;

    return (
        <div className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-semibold shrink-0 border-b shadow-sm transition-all duration-200 ${
            isOverdue 
                ? 'bg-rose-600 text-white border-rose-700' 
                : isUrgent 
                    ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white border-rose-700' 
                    : 'bg-amber-500 text-slate-950 border-amber-600'
        }`}>
            <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                <span className="p-1 rounded-md bg-black/10 shrink-0">
                    {isOverdue ? <AlertTriangle size={15} /> : <Clock size={15} />}
                </span>
                <div className="truncate">
                    <span className="font-black uppercase tracking-wider text-[10px] mr-2 px-1.5 py-0.5 rounded bg-black/15">
                        {isOverdue ? 'Overdue' : isUrgent ? 'Urgent Renewal' : 'Renewal Due Soon'}
                    </span>
                    <span className="hidden sm:inline font-bold">
                        {renewalInfo.businessName} ({renewalInfo.planName} Plan):{' '}
                    </span>
                    <span>
                        Subscription renewal of <strong>{renewalInfo.currencySymbol} {renewalInfo.monthlyFeeLocal.toLocaleString()}</strong> is due on <strong>{renewalInfo.expiryDateFormatted}</strong> ({
                            renewalInfo.daysRemaining < 0 
                                ? `${Math.abs(renewalInfo.daysRemaining)} days ago` 
                                : renewalInfo.daysRemaining === 0 
                                    ? 'today' 
                                    : `in ${renewalInfo.daysRemaining} days`
                        }).
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onOpenModal}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1 shadow-sm cursor-pointer ${
                        isOverdue || isUrgent 
                            ? 'bg-white text-slate-900 hover:bg-slate-100' 
                            : 'bg-slate-950 text-white hover:bg-slate-800'
                    }`}
                >
                    <span>Renew Plan</span>
                    <ArrowRight size={12} />
                </button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="p-1 rounded hover:bg-black/10 transition text-current opacity-70 hover:opacity-100 cursor-pointer"
                    title="Dismiss alert for this session"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

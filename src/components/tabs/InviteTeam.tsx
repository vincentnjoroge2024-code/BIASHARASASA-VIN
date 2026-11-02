import React from 'react';
import { useAppContext } from '../../context';
import { TenantUsersModal } from './TenantUsersModal';

export const InviteTeamTab: React.FC = () => {
    const { user, traders, showToast } = useAppContext();
    
    // Find the current trader for this user
    const loggedInTrader = user?.traderId 
        ? traders.find(t => t.id === user.traderId) 
        : (traders.find(t => t.email.toLowerCase() === user?.username.toLowerCase()) || traders[0]);

    if (!user || !loggedInTrader) {
        return (
            <div className="p-12 text-center text-slate-500">
                <p>Please login to manage your team.</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <TenantUsersModal 
                traderId={loggedInTrader.id}
                tenantName={loggedInTrader.businessName || loggedInTrader.fullName}
                onClose={() => {}} // No-op since it's a tab
                showToast={showToast}
                isSuperAdmin={user.role === 'admin'}
                flat={true}
            />
        </div>
    );
};

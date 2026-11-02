import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    message?: string;
    className?: string;
    size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
    message = 'Loading data...', 
    className = '',
    size = 28
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-slate-500 space-y-3 ${className}`}>
            <Loader2 size={size} className="animate-spin text-blue-600" />
            {message && <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{message}</p>}
        </div>
    );
};

export default LoadingSpinner;

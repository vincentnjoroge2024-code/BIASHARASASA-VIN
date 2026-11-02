import React from 'react';

export const LogoSVG: React.FC<{ className?: string; showBackground?: boolean }> = ({ 
    className = "", 
    showBackground = false 
}) => (
    <div className={`relative ${className} flex items-center justify-center shrink-0 ${showBackground ? 'bg-white rounded-xl shadow-sm border border-slate-200/60 p-1' : ''}`}>
        <svg 
            viewBox="0 0 100 100" 
            xmlns="http://www.w3.org/2000/svg" 
            className="w-full h-full"
        >
            {/* 4 Ascending Growth Bars */}
            {/* Bar 1: Royal Blue */}
            <rect x="14" y="60" width="13" height="28" rx="3.5" fill="#0073CF" />
            
            {/* Bar 2: Medium Emerald Green */}
            <rect x="32" y="48" width="13" height="40" rx="3.5" fill="#00A352" />
            
            {/* Bar 3: Royal Blue */}
            <rect x="50" y="38" width="13" height="50" rx="3.5" fill="#0073CF" />
            
            {/* Bar 4: Vibrant Red */}
            <rect x="68" y="26" width="13" height="62" rx="3.5" fill="#E52329" />
            
            {/* Curved Upward Green Growth Arrow */}
            <path 
                d="M 18 54 C 36 47, 56 32, 74 16 L 68 11 L 89 5 L 84 26 L 79 21 C 61 36, 42 49, 24 57 Z" 
                fill="#058038" 
            />
        </svg>
    </div>
);


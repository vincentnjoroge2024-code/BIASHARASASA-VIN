import React, { useState, useEffect } from 'react';

interface ScrollProgressBarProps {
    /** 
     * Optional target element to track scroll for. 
     * If not provided, it tracks the window scroll.
     */
    target?: React.RefObject<HTMLElement | null>;
}

export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({ target }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            if (target && target.current) {
                const el = target.current;
                const total = el.scrollHeight - el.clientHeight;
                const current = el.scrollTop;
                setProgress(total > 0 ? (current / total) * 100 : 0);
            } else {
                const total = document.documentElement.scrollHeight - window.innerHeight;
                const current = window.scrollY;
                setProgress(total > 0 ? (current / total) * 100 : 0);
            }
        };

        const targetEl = target?.current || window;
        targetEl.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => {
            targetEl.removeEventListener('scroll', handleScroll);
        };
    }, [target]);

    return (
        <div className="fixed top-0 left-0 right-0 h-1 z-[100] pointer-events-none">
            <div
                className="h-full bg-blue-500 origin-left shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-75"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
};

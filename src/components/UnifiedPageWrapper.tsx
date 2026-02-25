import React, { useEffect, useState } from 'react';
import BackgroundElements from './BackgroundElements';
import { cn } from '@/lib/utils';

interface UnifiedPageWrapperProps {
    children?: React.ReactNode;
    className?: string; // Added className prop
}

export default function UnifiedPageWrapper({ children, className }: UnifiedPageWrapperProps) {
    const [isDark, setIsDark] = useState(true); // Default to dark

    // Listen for theme changes on the html element (Tailwind dark mode strategy)
    useEffect(() => {
        // Initial check
        const checkTheme = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };

        checkTheme();

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    checkTheme();
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <BackgroundElements isDark={isDark} />
            <div className={cn("relative z-10 w-full min-h-screen", className)}>
                {children}
            </div>
        </>
    );
}

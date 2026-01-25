import React, { useEffect, useState } from 'react';
import BackgroundElements from './BackgroundElements';

interface UnifiedPageWrapperProps {
    children?: React.ReactNode;
}

export default function UnifiedPageWrapper({ children }: UnifiedPageWrapperProps) {
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
            <div className="relative z-10 w-full min-h-screen">
                {children}
            </div>
        </>
    );
}

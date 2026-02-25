import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface BackgroundElementsProps {
    isDark?: boolean;
}

export default function BackgroundElements({ isDark = true }: BackgroundElementsProps) {
    const location = useLocation();
    const isLandingPage = location.pathname === '/';

    // A more subtle, premium "dark grid" aesthetic for the SaaS rebrand.
    // Instead of loud stars and dunes, we use an ambient radial gradient
    // that slowly pulses, keeping the user focused on the content.

    // Abstract Ambient Glow
    const glows = useMemo(() => [
        { id: 1, color: isDark ? 'rgba(108, 71, 255, 0.08)' : 'rgba(108, 71, 255, 0.03)', size: '60vw', top: '-10%', left: '-10%', delay: 0 },
        { id: 2, color: isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.03)', size: '50vw', bottom: '-20%', right: '-10%', delay: 2 },
    ], [isDark]);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Base Grid Pattern */}
            <div className="absolute inset-0 bg-background text-transparent pointer-events-none" style={{
                backgroundImage: `
                    linear-gradient(to right, ${isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'} 1px, transparent 1px),
                    linear-gradient(to bottom, ${isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'} 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
            }} />

            {/* Ambient Animated Glows */}
            {isLandingPage && glows.map((glow) => (
                <motion.div
                    key={glow.id}
                    className="absolute rounded-full blur-3xl"
                    style={{
                        background: `radial-gradient(circle, ${glow.color} 0%, transparent 70%)`,
                        width: glow.size,
                        height: glow.size,
                        top: glow.top,
                        left: glow.left,
                        bottom: glow.bottom,
                        right: glow.right,
                    }}
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        delay: glow.delay,
                        ease: "easeInOut"
                    }}
                />
            ))}

            {/* Vignette effect to keep focus on center */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.5)] dark:shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
        </div>
    );
}

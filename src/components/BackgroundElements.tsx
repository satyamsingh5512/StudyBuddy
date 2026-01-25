import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface BackgroundElementsProps {
    isDark?: boolean;
}

export default function BackgroundElements({ isDark = true }: BackgroundElementsProps) {
    // Memoized stars
    const stars = useMemo(() =>
        Array.from({ length: 80 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 100,
            size: Math.random() * 2 + 0.5,
            duration: Math.random() * 3 + 2,
            delay: Math.random() * 2,
        })), []);

    // Falling stars (small, gentle fall)
    const fallingStars = useMemo(() =>
        Array.from({ length: 15 }, (_, i) => ({
            id: i,
            startX: Math.random() * 100,
            duration: Math.random() * 8 + 6,
            delay: Math.random() * 10,
            size: Math.random() * 1.5 + 0.5,
        })), []);

    // Theme colors (derived from Auth.tsx logic but intended to be used with the global theme too)
    const theme = useMemo(() => ({
        duneColor1: isDark ? '#1a1a3a' : '#E6D5E6', // Much lighter pastel pink/purple
        duneColor2: isDark ? '#2a2a4a' : '#F0E0F0',
        duneColor3: isDark ? '#3a3a5a' : '#FAF0FA',
        moonColor: isDark ? '#E8E0F0' : '#FFD4D4',
        moonGlow: isDark ? 'rgba(200, 200, 255, 0.3)' : 'rgba(255, 200, 200, 0.4)',
    }), [isDark]);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Stars Background */}
            <div className="absolute inset-0">
                {stars.map((star) => (
                    <motion.div
                        key={star.id}
                        className="absolute rounded-full bg-white"
                        style={{
                            width: star.size,
                            height: star.size,
                            left: `${star.left}%`,
                            top: `${star.top}%`,
                        }}
                        animate={{
                            opacity: [0.2, 0.8, 0.2],
                            scale: [1, 1.3, 1],
                        }}
                        transition={{
                            duration: star.duration,
                            repeat: Infinity,
                            delay: star.delay,
                        }}
                    />
                ))}

                {/* Falling Stars */}
                {fallingStars.map((star) => (
                    <motion.div
                        key={`falling-${star.id}`}
                        className="absolute rounded-full bg-white"
                        style={{
                            width: star.size,
                            height: star.size,
                            left: `${star.startX}%`,
                        }}
                        animate={{
                            y: [-20, window.innerHeight + 50],
                            opacity: [0, 0.8, 0.8, 0],
                        }}
                        transition={{
                            duration: star.duration,
                            repeat: Infinity,
                            delay: star.delay,
                            ease: 'linear',
                        }}
                    />
                ))}

                {/* Satellite */}
                <motion.div
                    className="absolute"
                    animate={{
                        x: [-100, window.innerWidth + 100],
                        y: [100, 60, 100],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: 'linear',
                    }}
                >
                    <div className="relative">
                        {/* Satellite body */}
                        <div className="w-3 h-3 bg-gray-300 rounded-sm" style={{ transform: 'rotate(45deg)' }} />
                        {/* Solar panels */}
                        <div className="absolute top-1 -left-4 w-4 h-1 bg-blue-400/80" />
                        <div className="absolute top-1 left-3 w-4 h-1 bg-blue-400/80" />
                        {/* Blinking light */}
                        <motion.div
                            className="absolute -top-1 left-1 w-1 h-1 rounded-full bg-red-400"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        />
                    </div>
                </motion.div>
            </div>

            {/* Desert Dunes */}
            <div className="absolute inset-0 overflow-hidden">
                <svg className="absolute bottom-0 left-0 w-full h-2/5" viewBox="0 0 1440 400" preserveAspectRatio="none">
                    <path
                        d="M0 400 L0 280 Q200 220 400 260 Q600 300 800 240 Q1000 180 1200 220 Q1400 260 1440 230 L1440 400 Z"
                        fill={theme.duneColor1}
                        opacity="0.5"
                    />
                </svg>
                <svg className="absolute bottom-0 left-0 w-full h-1/3" viewBox="0 0 1440 300" preserveAspectRatio="none">
                    <path
                        d="M0 300 L0 200 Q150 140 300 180 Q500 220 700 160 Q900 100 1100 140 Q1300 180 1440 150 L1440 300 Z"
                        fill={theme.duneColor2}
                        opacity="0.6"
                    />
                </svg>
                <svg className="absolute bottom-0 left-0 w-full h-1/5" viewBox="0 0 1440 200" preserveAspectRatio="none">
                    <path
                        d="M0 200 L0 140 Q200 80 400 120 Q600 160 800 100 Q1000 40 1200 80 Q1350 110 1440 70 L1440 200 Z"
                        fill={theme.duneColor3}
                        opacity="0.7"
                    />
                </svg>
            </div>

            {/* Moon */}
            <motion.div
                className="absolute top-16 right-1/4 pointer-events-none"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 8, repeat: Infinity }}
            >
                <div
                    className="w-20 h-20 rounded-full"
                    style={{
                        background: `radial-gradient(circle at 30% 30%, ${theme.moonColor}, ${isDark ? '#A0A0C0' : '#FFB0B0'})`,
                        boxShadow: `0 0 60px ${theme.moonGlow}`
                    }}
                />
            </motion.div>
        </div>
    );
}

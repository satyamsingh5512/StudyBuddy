import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shader, ChromaFlow, Swirl } from "shaders/react";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { GrainOverlay } from "@/components/ui/grain-overlay";
import { PremiumNavbar } from "@/components/landing/PremiumNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import UnifiedPageWrapper from "@/components/UnifiedPageWrapper";
import { useAtomValue } from "jotai";
import { performanceModeAtom } from "@/store/atoms";

export default function Landing() {
    const performanceMode = useAtomValue(performanceModeAtom);
    const [isLoaded, setIsLoaded] = useState(false);
    const shaderContainerRef = useRef<HTMLDivElement>(null);

    // ── Shader ready detection ────────────────────────────────────────────────
    useEffect(() => {
        const checkShaderReady = () => {
            if (shaderContainerRef.current) {
                const canvas = shaderContainerRef.current.querySelector("canvas");
                if (canvas && (canvas.width || 0) > 0 && (canvas.height || 0) > 0) {
                    setIsLoaded(true);
                    return true;
                }
            }
            return false;
        };

        if (checkShaderReady()) return;

        const intervalId = setInterval(() => {
            if (checkShaderReady()) clearInterval(intervalId);
        }, 100);

        const fallbackTimer = setTimeout(() => setIsLoaded(true), 1500);

        return () => {
            clearInterval(intervalId);
            clearTimeout(fallbackTimer);
        };
    }, []);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <UnifiedPageWrapper>
            <main className="relative w-full min-h-screen overflow-x-hidden selection:bg-primary/30">
                <CustomCursor />
                <GrainOverlay />

                {/* Fixed shader or fallback background */}
                {performanceMode ? (
                    <div className={`fixed inset-0 z-0 bg-gradient-to-br from-[#6C47FF]/10 via-[#F59E0B]/10 to-[#10B981]/10 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`} />
                ) : (
                    <div
                        ref={shaderContainerRef}
                        className={`fixed inset-0 z-0 transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
                        style={{ contain: "strict" }}
                    >
                        <Shader className="h-full w-full">
                            <Swirl
                                colorA="#6C47FF"
                                colorB="#F59E0B"
                                speed={0.8}
                                detail={0.8}
                                blend={50}
                                coarseX={40}
                                coarseY={40}
                                mediumX={40}
                                mediumY={40}
                                fineX={40}
                                fineY={40}
                            />
                            <ChromaFlow
                                baseColor="#09090B"
                                upColor="#6C47FF"
                                downColor="#F59E0B"
                                leftColor="#10B981"
                                rightColor="#6C47FF"
                                intensity={0.9}
                                radius={1.8}
                                momentum={25}
                                maskType="alpha"
                                opacity={0.97}
                            />
                        </Shader>
                        <div className="absolute inset-0 bg-white/35 dark:bg-[#101319]/45 backdrop-blur-[2px]" />
                    </div>
                )}

                {/* Fixed navbar */}
                <PremiumNavbar scrollToId={scrollToSection} isLoaded={isLoaded} />

                {/* Scrollable Content */}
                <div className={`relative z-10 w-full transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
                    <div id="home">
                        <HeroSection />
                    </div>
                    
                    <div id="features" className="w-full max-w-7xl mx-auto px-4 py-24">
                        <FeaturesSection />
                    </div>

                    <div id="join" className="flex flex-col w-full mt-10">
                        <div className="flex items-center justify-center p-6 mb-24">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                viewport={{ once: true, margin: "-10%" }}
                                transition={{ type: "spring", stiffness: 100, damping: 20, mass: 1 }}
                                className="text-center space-y-6 max-w-3xl mx-auto glass-card p-12 md:p-16 rounded-[2rem] will-change-transform"
                            >
                                <h2 className="text-4xl md:text-6xl font-bold text-black dark:text-white leading-tight">
                                    Ready to level up<br />your study game?
                                </h2>
                                <p className="text-xl text-zinc-700 dark:text-zinc-300 max-w-xl mx-auto font-medium">
                                    Join thousands of students optimizing their study workflow today.
                                </p>
                                <button
                                    onClick={() => window.location.href = "/auth"}
                                    className="neo-button-primary mt-8 px-10 py-5 text-xl font-bold rounded-full"
                                >
                                    Get Started
                                </button>
                            </motion.div>
                        </div>
                        <footer className="glass-panel border-x-0 border-b-0 py-8 text-sm text-zinc-600 dark:text-zinc-400">
                            <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="font-bold text-black dark:text-white">© 2026 StudyBuddy. All rights reserved.</div>
                                <div className="flex gap-6 font-bold">
                                    <a href="/terms" className="hover:text-black dark:hover:text-white hover:underline transition-all">Terms</a>
                                    <a href="/privacy" className="hover:text-black dark:hover:text-white hover:underline transition-all">Privacy</a>
                                    <a href="#" className="hover:text-black dark:hover:text-white hover:underline transition-all">Support</a>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </main>
        </UnifiedPageWrapper>
    );
}

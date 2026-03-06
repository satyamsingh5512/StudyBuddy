import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shader, ChromaFlow, Swirl } from "shaders/react";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { GrainOverlay } from "@/components/ui/grain-overlay";
import { PremiumNavbar } from "@/components/landing/PremiumNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import UnifiedPageWrapper from "@/components/UnifiedPageWrapper";

export default function Landing() {
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
            <main className="relative w-full min-h-screen bg-background overflow-x-hidden selection:bg-primary/30">
                <CustomCursor />
                <GrainOverlay />

                {/* Fixed shader background */}
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
                    <div className="absolute inset-0 bg-white/70 dark:bg-black/60 backdrop-blur-[2px]" />
                </div>

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
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="text-center space-y-6 max-w-3xl mx-auto glass-card border-2 border-black/10 dark:border-white/10 p-12 md:p-16 rounded-[2.5rem] shadow-2xl bg-white/40 dark:bg-black/40 backdrop-blur-xl"
                            >
                                <h2 className="text-4xl md:text-6xl font-bold text-black dark:text-white leading-tight">
                                    Ready to level up<br />your study game?
                                </h2>
                                <p className="text-xl text-zinc-700 dark:text-zinc-300 max-w-xl mx-auto font-medium">
                                    Join thousands of students optimizing their study workflow today.
                                </p>
                                <button
                                    onClick={() => window.location.href = "/auth"}
                                    className="neo-button-primary mt-8 px-10 py-5 text-xl font-bold rounded-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#757373] hover:translate-y-1 hover:translate-x-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_#757373] transition-all"
                                >
                                    Get Started
                                </button>
                            </motion.div>
                        </div>
                        <footer className="border-t border-black/10 dark:border-white/10 py-8 text-sm text-zinc-600 dark:text-zinc-400 bg-white/30 dark:bg-black/30 backdrop-blur-md">
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

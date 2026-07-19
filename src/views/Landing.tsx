'use client';

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shader, ChromaFlow, Swirl } from "shaders/react";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { GrainOverlay } from "@/components/ui/grain-overlay";
import { PremiumNavbar } from "@/components/landing/PremiumNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import UnifiedPageWrapper from "@/components/UnifiedPageWrapper";
import { Link } from "@/lib/router";
import { useAtomValue } from "jotai";
import { performanceModeAtom, userAtom } from "@/store/atoms";
import { BarChart3, CalendarClock, Clock3, Sparkles } from "lucide-react";

export default function Landing() {
    const performanceMode = useAtomValue(performanceModeAtom);
    const user = useAtomValue(userAtom);
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

                    <StatsSection />

                    <section id="workflow" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                        <div className="glass-card overflow-hidden rounded-2xl p-6 sm:p-10">
                            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                                <div>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                                        <Sparkles size={15} aria-hidden="true" />
                                        Built for repeatable study days
                                    </span>
                                    <h2 className="mt-5 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
                                        Make the next study decision obvious.
                                    </h2>
                                    <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                                        StudyBuddy keeps the full loop in view, from availability and time blocks to focused sessions and a report of what actually happened.
                                    </p>
                                    <Link
                                        to={user ? "/schedule" : "/auth"}
                                        className="neo-button-primary mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm"
                                    >
                                        {user ? "Plan today" : "Set up my plan"}
                                        <CalendarClock size={17} aria-hidden="true" />
                                    </Link>
                                </div>

                                <ol className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        { icon: CalendarClock, step: "01", title: "Plan", text: "Share your available time and priorities." },
                                        { icon: Clock3, step: "02", title: "Focus", text: "Move through clear, timed study blocks." },
                                        { icon: BarChart3, step: "03", title: "Review", text: "Use progress signals to adjust tomorrow." },
                                    ].map((item) => (
                                        <li key={item.step} className="glass-control min-h-44 rounded-xl p-4">
                                            <div className="flex items-center justify-between">
                                                <item.icon size={19} className="text-primary" aria-hidden="true" />
                                                <span className="text-xs font-semibold text-muted-foreground">{item.step}</span>
                                            </div>
                                            <h3 className="mt-8 font-heading text-xl font-semibold text-foreground">{item.title}</h3>
                                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    </section>

                    <div id="features" className="w-full">
                        <FeaturesSection />
                    </div>

                    <div id="testimonials" className="w-full">
                        <TestimonialsSection />
                    </div>

                    <div id="faq" className="w-full">
                        <FAQSection />
                    </div>

                    <div id="join" className="flex flex-col w-full py-16 sm:py-24">
                        <div className="flex items-center justify-center px-4 sm:px-6">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                viewport={{ once: true, margin: "-10%" }}
                                transition={{ type: "spring", stiffness: 100, damping: 20, mass: 1 }}
                                className="text-center space-y-6 max-w-3xl mx-auto glass-card p-6 sm:p-10 md:p-16 rounded-[2rem] will-change-transform"
                            >
                                <h2 className="font-heading text-4xl font-semibold text-black dark:text-white md:text-6xl">
                                    Give tomorrow&apos;s study time a plan.
                                </h2>
                                <p className="max-w-xl mx-auto text-lg text-zinc-700 dark:text-zinc-300 sm:text-xl">
                                    Start with your exam goal and availability. StudyBuddy handles the next practical step.
                                </p>
                                <Link
                                    to={user ? "/schedule" : "/auth"}
                                    className="neo-button-primary mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base"
                                >
                                    {user ? "Open my schedule" : "Create my study plan"}
                                    <CalendarClock size={18} aria-hidden="true" />
                                </Link>
                            </motion.div>
                        </div>
                        <footer className="glass-panel border-x-0 border-b-0 py-8 text-sm text-zinc-600 dark:text-zinc-400">
                            <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-center sm:px-6 md:flex-row md:text-left">
                                <div className="font-bold text-black dark:text-white">© 2026 StudyBuddy. All rights reserved.</div>
                                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-bold sm:gap-6">
                                    <a href="/terms" className="hover:text-black dark:hover:text-white hover:underline transition-all">Terms</a>
                                    <a href="/privacy" className="hover:text-black dark:hover:text-white hover:underline transition-all">Privacy</a>
                                    <a href="/support" className="hover:text-black dark:hover:text-white hover:underline transition-all">Support</a>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
            </main>
        </UnifiedPageWrapper>
    );
}

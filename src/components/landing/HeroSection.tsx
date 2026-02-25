import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { RotatingText } from "@/components/ui/rotating-text";

export function HeroSection() {
    const navigate = useNavigate();

    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-transparent">

            {/* Container - centered text */}
            <div className="container mx-auto px-6 relative z-10 text-center">

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="max-w-4xl mx-auto space-y-10"
                >
                    {/* Top Badge */}
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border-2 border-black dark:border-white/20 shadow-neo-sm dark:shadow-none transform hover:-translate-y-1 transition-transform cursor-pointer group"
                    >
                        <span className="font-bold text-sm text-black dark:text-white">Now it is time to build</span>
                        <ArrowRight size={14} className="stroke-[3px] text-black dark:text-white group-hover:translate-x-1 transition-transform" />
                    </motion.div>

                    {/* Main Heading */}
                    <div className="space-y-4">
                        <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-black dark:text-white leading-[1.1]">
                            Your all-in-one <br />
                            <span className="italic font-serif font-black">study buddy</span> platform
                        </h1>
                        <div className="text-6xl md:text-7xl font-serif italic text-black/80 dark:text-zinc-400 rotate-1 flex items-center justify-center gap-4">
                            <RotatingText
                                words={["effective", "simple", "powerful", "clean"]}
                                className="text-black/90 dark:text-white min-w-[200px]"
                            />
                        </div>
                    </div>

                    {/* Subheading */}
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto font-medium leading-relaxed">
                        Acing exams is already challenging enough.
                        Avoid further complications by ditching outdated tools.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
                        <Link to="#features">
                            <button className="neo-button flex items-center gap-2 rounded-lg">
                                View Features
                            </button>
                        </Link>
                        <button onClick={() => navigate("/auth")} className="neo-button-primary flex items-center gap-2 rounded-lg">
                            Start Studying <Star size={16} fill="currentColor" />
                        </button>
                    </div>

                </motion.div>
            </div>

            {/* Decorative Scribbles (SVG) - Positioned Absolutely */}
            <div className="absolute top-1/4 right-10 w-24 h-24 opacity-20 md:opacity-100 pointer-events-none -rotate-12 hidden lg:block">
                <svg viewBox="0 0 100 100" fill="none" className="stroke-black dark:stroke-white stroke-2">
                    <path d="M10 10 Q 50 50 90 10" />
                    <path d="M10 90 Q 50 50 90 90" />
                </svg>
            </div>
        </section>
    );
}

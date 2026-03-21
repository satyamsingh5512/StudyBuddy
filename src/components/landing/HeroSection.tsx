import { motion } from "framer-motion";
import { Link, useNavigate } from "@/lib/router";
import { ArrowRight, Star } from "lucide-react";
import { RotatingText } from "@/components/ui/rotating-text";

const containerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
};

export function HeroSection() {
    const navigate = useNavigate();

    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20 sm:pt-24 pb-12 sm:pb-16 overflow-hidden bg-transparent">
            {/* RESPONSIVE FIX: Fluid padding using clamp() */}
            <div className="container mx-auto relative z-10 text-center" style={{ paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-4xl mx-auto space-y-8"
                >
                    {/* Top Badge */}
                    <motion.div variants={itemVariants} className="flex justify-center">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border-2 border-black dark:border-white/20 shadow-neo-sm dark:shadow-none transform hover:-translate-y-1 transition-transform cursor-pointer group">
                            <span className="font-bold text-sm text-black dark:text-white">Now it is time to build</span>
                            <ArrowRight size={14} className="stroke-[3px] text-black dark:text-white group-hover:translate-x-1 transition-transform" />
                        </span>
                    </motion.div>

                    {/* Main Heading - RESPONSIVE FIX: clamp() for fluid typography */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <h1 className="font-bold tracking-tight text-black dark:text-white leading-[1.05]" style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}>
                            Your all-in-one <br />
                            <span className="italic font-serif font-black">study buddy</span> platform
                        </h1>
                    </motion.div>

                    {/* Rotating Subline - RESPONSIVE FIX: clamp() for fluid typography */}
                    <motion.div
                        variants={itemVariants}
                        className="font-serif italic text-black/80 dark:text-zinc-400 rotate-1 flex items-center justify-center gap-4"
                        style={{ fontSize: 'clamp(1.75rem, 6vw, 4rem)' }}
                    >
                        <RotatingText
                            words={["effective", "simple", "powerful", "clean"]}
                            className="text-black/90 dark:text-white"
                            style={{ minWidth: 'clamp(150px, 30vw, 250px)' }}
                        />
                    </motion.div>

                    {/* Subheading - RESPONSIVE FIX: clamp() for fluid typography */}
                    <motion.p
                        variants={itemVariants}
                        className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto font-medium leading-relaxed"
                        style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}
                    >
                        Acing exams is already challenging enough.
                        Avoid further complications by ditching outdated tools.
                    </motion.p>

                    {/* CTA Buttons - RESPONSIVE FIX: Touch targets min 44x44px, fluid spacing */}
                    <motion.div
                        variants={itemVariants}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4"
                    >
                        <Link to="#features">
                            <button className="neo-button flex items-center gap-2 rounded-lg min-h-[44px] px-6 py-3 w-full sm:w-auto">
                                View Features
                            </button>
                        </Link>
                        <button onClick={() => navigate("/auth")} className="neo-button-primary flex items-center gap-2 rounded-lg min-h-[44px] px-6 py-3 w-full sm:w-auto">
                            Start Studying <Star size={16} fill="currentColor" />
                        </button>
                    </motion.div>
                </motion.div>
            </div>

            {/* Decorative Scribbles */}
            <motion.div
                initial={{ opacity: 0, rotate: -20 }}
                animate={{ opacity: 1, rotate: -12 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="absolute top-1/4 right-10 w-24 h-24 pointer-events-none hidden lg:block"
            >
                <svg viewBox="0 0 100 100" fill="none" className="stroke-black dark:stroke-white stroke-2 opacity-20 md:opacity-100">
                    <path d="M10 10 Q 50 50 90 10" />
                    <path d="M10 90 Q 50 50 90 90" />
                </svg>
            </motion.div>
        </section>
    );
}

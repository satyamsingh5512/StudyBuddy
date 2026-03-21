import { motion } from "framer-motion";
import {
    BarChart3,
    Palette,
    GitBranch,
    Smartphone,
    ArrowUpRight,
} from "lucide-react";

const features = [
    {
        icon: BarChart3,
        title: "Learning Analytics",
        description: "Track completion rates and study sessions with detailed, privacy-first analytics.",
        badge: "Insightful",
        color: "bg-green-200",
        darkColor: "dark:bg-green-500",
    },
    {
        icon: Palette,
        title: "Beautiful Interface",
        description: "Start studying instantly with a professionally designed interface you can customize.",
        badge: "Creative",
        color: "bg-pink-200",
        darkColor: "dark:bg-pink-500",
    },
    {
        icon: GitBranch,
        title: "Study Logic",
        description: "Create complex study plans without worrying about missing key topics.",
        badge: "Smart",
        color: "bg-orange-200",
        darkColor: "dark:bg-orange-500",
    },
    {
        icon: Smartphone,
        title: "Mobile First",
        description: "Flawless studying experience on any device, ensuring you never miss a study streak.",
        badge: "Responsive",
        color: "bg-purple-200",
        darkColor: "dark:bg-purple-500",
    },
];

export function FeaturesSection() {
    return (
        <section className="py-12 bg-transparent">
            {/* RESPONSIVE FIX: Fluid container padding */}
            <div className="container mx-auto" style={{ paddingLeft: 'clamp(1rem, 4vw, 1.5rem)', paddingRight: 'clamp(1rem, 4vw, 1.5rem)' }}>
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="mb-12 sm:mb-20 text-center space-y-4 sm:space-y-6"
                >
                    <div className="inline-block px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black font-bold text-sm transform -rotate-2 shadow-neo-sm dark:shadow-[2px_2px_0px_0px_#757373]">
                        FEATURES
                    </div>
                    {/* RESPONSIVE FIX: clamp() for fluid heading */}
                    <h2 className="font-bold text-black dark:text-white tracking-tight" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}>
                        Everything you need. <br />
                        <span className="italic font-serif font-black">Nothing you don&apos;t.</span>
                    </h2>
                    {/* RESPONSIVE FIX: clamp() for fluid paragraph */}
                    <p className="text-zinc-700 dark:text-zinc-300 max-w-2xl mx-auto font-medium" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>
                        We focused on the features that actually help you study better, not just feature bloat.
                    </p>
                </motion.div>

                {/* RESPONSIVE FIX: CSS Grid with auto-fit for fluid columns */}
                <div className="grid gap-6 sm:gap-8 lg:gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ delay: index * 0.1, duration: 0.6, ease: "easeOut" }}
                            className="group relative bg-white/40 dark:bg-black/40 backdrop-blur-xl border-2 border-black/10 dark:border-white/10 shadow-xl rounded-3xl p-6 sm:p-8 hover:-translate-y-2 hover:shadow-2xl transition-all duration-300"
                        >
                            {/* Badge "Sticker" - RESPONSIVE FIX: Adjusted positioning for mobile */}
                            <div className={`absolute -top-3 sm:-top-4 right-4 sm:right-6 px-3 sm:px-4 py-1 sm:py-1.5 border-2 border-black dark:border-black ${feature.color} ${feature.darkColor} text-black text-xs font-bold shadow-neo-sm transform rotate-3 group-hover:rotate-6 transition-transform`}>
                                {feature.badge}
                            </div>

                            {/* RESPONSIVE FIX: Touch target min 44x44px */}
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/60 dark:bg-white/10 border-2 border-black/10 dark:border-white/10 flex items-center justify-center mb-4 sm:mb-6 shadow-sm group-hover:bg-primary group-hover:border-primary transition-colors">
                                <feature.icon size={24} strokeWidth={2.5} className="text-black dark:text-white group-hover:text-primary-foreground sm:w-7 sm:h-7" />
                            </div>

                            {/* RESPONSIVE FIX: clamp() for fluid heading */}
                            <h3 className="font-bold text-black dark:text-white mb-3 sm:mb-4 tracking-tight" style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
                                {feature.title}
                            </h3>

                            {/* RESPONSIVE FIX: clamp() for fluid paragraph */}
                            <p className="text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed mb-6 sm:mb-8" style={{ fontSize: 'clamp(0.9375rem, 2vw, 1.125rem)' }}>
                                {feature.description}
                            </p>

                            <div className="flex items-center text-sm font-bold text-primary dark:text-primary group-hover:translate-x-2 transition-transform cursor-pointer">
                                Explore <ArrowUpRight size={18} className="ml-1" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

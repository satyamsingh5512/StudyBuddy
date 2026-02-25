import { motion } from "framer-motion";
import {
    MessageSquare,
    BarChart3,
    Palette,
    Zap,
    GitBranch,
    Smartphone,
    ArrowUpRight,
} from "lucide-react";

const features = [
    {
        icon: MessageSquare,
        title: "Conversational Chat",
        description: "Intelligent AI chat system that adapts to your learning style, creating a natural conversation flow.",
        badge: "AI Powered",
        color: "bg-yellow-200",
        darkColor: "dark:bg-yellow-500",
    },
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
        icon: Zap,
        title: "Instant Quiz Generation",
        description: "Turn your notes and documents into interactive quizzes in seconds with AI.",
        badge: "Fast",
        color: "bg-blue-200",
        darkColor: "dark:bg-blue-500",
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
        <section id="features" className="py-24 bg-transparent border-t-2 border-black dark:border-white/20">
            <div className="container mx-auto px-6">
                <div className="mb-20 text-center space-y-4">
                    <div className="inline-block px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black font-bold text-sm transform -rotate-2 shadow-neo-sm dark:shadow-[2px_2px_0px_0px_#757373]">
                        FEATURES
                    </div>
                    <h2 className="text-4xl md:text-6xl font-bold text-black dark:text-white tracking-tight">
                        Everything you need. <br />
                        <span className="italic font-serif">Nothing you don&apos;t.</span>
                    </h2>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        We focused on the features that actually help you study better, not just feature bloat.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className="group relative bg-white dark:bg-zinc-900 border-2 border-black dark:border-white/20 shadow-neo-lg dark:shadow-neo-lg-dark rounded-xl p-8 hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[12px_12px_0px_0px_#757373] transition-all duration-300"
                        >
                            {/* Badge "Sticker" */}
                            <div className={`absolute -top-4 right-4 px-3 py-1 border-2 border-black dark:border-black ${feature.color} ${feature.darkColor} text-black text-xs font-bold shadow-neo-sm transform rotate-3 group-hover:rotate-6 transition-transform`}>
                                {feature.badge}
                            </div>

                            <div className="w-12 h-12 rounded-lg bg-white dark:bg-zinc-800 border-2 border-black dark:border-white/20 flex items-center justify-center mb-6 shadow-neo-sm dark:shadow-none group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                                <feature.icon size={24} strokeWidth={2.5} className="text-black dark:text-white group-hover:text-white dark:group-hover:text-black" />
                            </div>

                            <h3 className="text-2xl font-bold text-black dark:text-white mb-3">
                                {feature.title}
                            </h3>

                            <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed mb-6">
                                {feature.description}
                            </p>

                            <div className="flex items-center text-sm font-bold text-black dark:text-white group-hover:translate-x-1 transition-transform cursor-pointer">
                                Learn more <ArrowUpRight size={16} className="ml-1" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

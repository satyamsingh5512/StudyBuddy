import { motion } from "framer-motion";

const companies = [
    "Harvard",
    "Stanford",
    "MIT",
    "Princeton",
    "Yale",
    "Columbia",
];

const stats = [
    { label: "Active Students", value: "10,000+" },
    { label: "Exams Passed", value: "50,000+" },
    { label: "Grade Improvement", value: "89%" },
];

export function SocialProofSection() {
    return (
        <section className="py-24 bg-white dark:bg-[#09090b] border-t-2 border-black dark:border-white/20">
            <div className="container mx-auto px-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 border-b-2 border-black dark:border-white/20 pb-20">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="text-center"
                        >
                            <div className="text-4xl md:text-5xl font-black text-black dark:text-white mb-2" style={{ textShadow: "2px 2px 0px #00e5ff" }}>
                                {stat.value}
                            </div>
                            <div className="text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Logos */}
                <div className="text-center">
                    <p className="text-sm font-black text-black dark:text-zinc-400 uppercase tracking-wider mb-8">
                        Trusted by students from
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-80">
                        {companies.map((company) => (
                            <span
                                key={company}
                                className="text-2xl font-black italic font-serif text-black dark:text-white transform hover:scale-110 transition-transform cursor-pointer"
                            >
                                {company}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

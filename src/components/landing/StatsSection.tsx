import { motion } from 'framer-motion';
import { BookOpenCheck, Flame, Timer, Users } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';

type Stat = {
  icon: typeof Users;
  value: number;
  suffix?: string;
  label: string;
};

const stats: Stat[] = [
  { icon: Users, value: 12000, suffix: '+', label: 'Students planning with StudyBuddy' },
  { icon: Timer, value: 480000, suffix: '+', label: 'Focused study hours logged' },
  { icon: BookOpenCheck, value: 1200000, suffix: '+', label: 'Study tasks completed' },
  { icon: Flame, value: 92, suffix: '%', label: 'Keep their streak past week one' },
];

export function StatsSection() {
  return (
    <section aria-label="StudyBuddy usage statistics" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card grid grid-cols-2 gap-6 rounded-2xl p-6 sm:p-8 lg:grid-cols-4 lg:gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
            className="flex flex-col items-center gap-2 text-center lg:items-start lg:text-left"
          >
            <stat.icon size={20} className="text-primary" aria-hidden="true" />
            <AnimatedNumber
              value={stat.value}
              suffix={stat.suffix}
              className="font-heading text-2xl font-semibold text-foreground sm:text-3xl"
            />
            <p className="text-xs leading-snug text-muted-foreground sm:text-sm">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

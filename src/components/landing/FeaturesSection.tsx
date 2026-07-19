import { motion } from 'framer-motion';
import { BarChart3, CalendarDays, Clock3, Users, ArrowUpRight } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { useNavigate } from '@/lib/router';
import { userAtom } from '@/store/atoms';

type Feature = {
  icon: typeof CalendarDays;
  title: string;
  description: string;
  action: string;
  path: string;
  image: string;
  accent: string;
};

const features: Feature[] = [
  {
    icon: CalendarDays,
    title: 'Plan around your real day',
    description: 'Set your available hours and let the AI turn your syllabus into practical time blocks and reminders.',
    action: 'Create a schedule',
    path: '/schedule',
    image: '/assets/landing/feature-timeline.jpg',
    accent: 'bg-primary/15 text-primary',
  },
  {
    icon: Clock3,
    title: 'Protect focused study time',
    description: 'Use structured focus sessions, breaks, and session history to make the next hour count.',
    action: 'Start a focus session',
    path: '/dashboard',
    image: '/assets/landing/feature-timer.jpg',
    accent: 'bg-amber-400/15 text-amber-600 dark:text-amber-300',
  },
  {
    icon: BarChart3,
    title: 'Know what is improving',
    description: 'Review study hours, task completion, streaks, and subject coverage without digging through spreadsheets.',
    action: 'View my progress',
    path: '/reports',
    image: '/assets/landing/feature-growth.jpg',
    accent: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
  {
    icon: Users,
    title: 'Study with accountability',
    description: 'Connect with peers, compare momentum on the leaderboard, and make consistent progress visible.',
    action: 'Find study partners',
    path: '/friends',
    image: '/assets/landing/feature-mobile.jpg',
    accent: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const user = useAtomValue(userAtom);
  const navigate = useNavigate();
  const actionPath = user ? feature.path : '/auth';

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: 0.42, delay: index * 0.06, ease: 'easeOut' }}
      className="glass-card group grid overflow-hidden rounded-2xl sm:grid-cols-[0.9fr_1.1fr]"
    >
      <div className="relative min-h-48 overflow-hidden bg-black/5 dark:bg-white/5">
        <img
          src={feature.image}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className={`absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl ${feature.accent} backdrop-blur-md`}>
          <feature.icon size={21} aria-hidden="true" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-start p-6 sm:p-7">
        <h3 className="font-heading text-2xl font-semibold text-foreground">{feature.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{feature.description}</p>
        <button
          type="button"
          onClick={() => navigate(actionPath)}
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg px-0 text-sm font-semibold text-primary transition-transform hover:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {feature.action}
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </div>
    </motion.article>
  );
}

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mx-auto mb-10 max-w-2xl text-center sm:mb-14"
        >
          <span className="glass-control inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-foreground">The complete study loop</span>
          <h2 className="mt-5 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
            One place to decide what matters next.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Planning, focus, evidence, and accountability stay connected, so your effort does not disappear into separate tools.
          </p>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-2">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, CalendarClock, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { Link } from '@/lib/router';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/store/atoms';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 22 },
  },
};

export function HeroSection() {
  const user = useAtomValue(userAtom);
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 72]);
  const previewY = useTransform(scrollYProgress, [0, 1], [0, 132]);
  const actionPath = user ? '/schedule' : '/auth';
  const actionLabel = user ? 'Open today\'s plan' : 'Build my study plan';

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[calc(100svh-1rem)] flex-col items-center overflow-hidden px-4 pb-8 pt-28 sm:px-6 sm:pt-32"
    >
      <motion.div
        style={{ y: heroY }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <motion.div variants={itemVariants} className="mb-5 flex justify-center">
          <span className="glass-control inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black dark:text-white">
            <Sparkles size={15} className="text-primary" aria-hidden="true" />
            AI-guided study planning for competitive exams
          </span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="font-heading text-black dark:text-white"
          style={{ fontSize: 'clamp(3.4rem, 8vw, 6.8rem)', lineHeight: 0.98 }}
        >
          StudyBuddy
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mx-auto mt-5 max-w-2xl text-pretty font-medium leading-relaxed text-zinc-700 dark:text-zinc-300"
          style={{ fontSize: 'clamp(1.125rem, 2.2vw, 1.4rem)' }}
        >
          Turn your exam goal into a clear daily plan, focused study sessions, and progress you can act on.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to={actionPath}
            className="neo-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-base"
          >
            <CalendarClock size={18} aria-hidden="true" />
            {actionLabel}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link
            to="#workflow"
            className="neo-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-base"
          >
            <Play size={17} aria-hidden="true" />
            See the workflow
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ y: previewY }}
        initial={{ opacity: 0, y: 38 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 mt-10 w-full max-w-6xl"
      >
        <div className="glass-card grid overflow-hidden rounded-2xl p-3 sm:p-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="relative min-h-[210px] overflow-hidden rounded-xl bg-white/30 dark:bg-black/20 sm:min-h-[270px]">
            <img
              src="/assets/3d/hero-portal.png"
              alt="Study planning dashboard preview"
              className="absolute inset-0 h-full w-full object-cover object-center mix-blend-multiply dark:mix-blend-screen"
            />
            <div className="absolute left-4 top-4 glass-control rounded-lg px-3 py-2 text-left text-xs text-foreground sm:left-5 sm:top-5">
              <p className="font-semibold">Today&apos;s study plan</p>
              <p className="mt-0.5 text-muted-foreground">Built around your available time</p>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Tuesday plan</p>
                <p className="mt-1 text-lg font-semibold text-foreground">Three focused blocks</p>
              </div>
              <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Ready</span>
            </div>
            {[
              ['09:00', 'Physics: Electrostatics', '50 min'],
              ['11:00', 'Biology: Cell division', '45 min'],
              ['16:30', 'Math: Practice set', '60 min'],
            ].map(([time, title, duration]) => (
              <div key={time} className="glass-control flex items-center gap-3 rounded-lg px-3 py-2.5">
                <span className="w-10 text-xs font-semibold text-primary">{time}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
                <span className="text-xs text-muted-foreground">{duration}</span>
                <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

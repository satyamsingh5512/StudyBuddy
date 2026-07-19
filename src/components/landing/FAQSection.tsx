'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: 'Is StudyBuddy free to use?',
    answer:
      'You can create an account, build a study plan, and track sessions at no cost. We may introduce optional paid tiers for advanced AI features in the future, but core planning and tracking stay accessible.',
  },
  {
    question: 'Which exams does StudyBuddy support?',
    answer:
      'StudyBuddy works for any competitive exam preparation, including NEET, JEE, UPSC, and state-level exams. You set your exam goal and syllabus, and the planner adapts to it rather than assuming a fixed curriculum.',
  },
  {
    question: 'How does the AI study assistant work?',
    answer:
      'It uses your exam goal, available time, and recent progress to suggest what to study next and how to pace it. Recommendations update as you complete tasks and log sessions, so the plan stays realistic instead of static.',
  },
  {
    question: 'Is my study data private?',
    answer:
      'Yes. Your tasks, sessions, and progress are tied to your account and are not shared with other users. Anything you choose to share on the leaderboard or with friends is opt-in and limited to what you post.',
  },
  {
    question: 'Can I use StudyBuddy on my phone?',
    answer:
      'Yes, the web app is fully responsive and works on mobile browsers. A dedicated mobile app build is also in progress for a more native experience.',
  },
  {
    question: 'What happens if I miss a day?',
    answer:
      'Nothing punitive. Your streak resets, but your schedule and history stay intact, and the planner adjusts your remaining time blocks so you can pick back up without losing track of your goal.',
  },
];

function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="glass-control overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground sm:text-base">{item.question}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section aria-label="Frequently asked questions" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        className="mb-10 text-center sm:mb-14"
      >
        <span className="glass-control inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-foreground">
          Good to know
        </span>
        <h2 className="mt-5 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
          Frequently asked questions.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Everything you need to know before you start planning your first study day.
        </p>
      </motion.div>

      <div className="space-y-3">
        {faqs.map((item, index) => (
          <FaqRow
            key={item.question}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
          />
        ))}
      </div>
    </section>
  );
}

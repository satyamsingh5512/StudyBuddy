import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "I stopped guessing what to study next. StudyBuddy turned my syllabus into daily blocks, and the streak tracker kept me honest on the days I wanted to skip.",
    name: 'Ananya Rao',
    role: 'NEET aspirant, 2nd attempt',
    initials: 'AR',
  },
  {
    quote:
      'The focus timer plus session history changed how I study. I can finally see which subjects actually get my hours versus which ones I only think about.',
    name: 'Rohit Verma',
    role: 'JEE Advanced aspirant',
    initials: 'RV',
  },
  {
    quote:
      'Studying with friends on the leaderboard made consistency feel less lonely. The daily report keeps our whole group accountable.',
    name: 'Priya Nair',
    role: 'UPSC CSE aspirant',
    initials: 'PN',
  },
];

export function TestimonialsSection() {
  return (
    <section aria-label="Testimonials from StudyBuddy users" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        className="mx-auto mb-10 max-w-2xl text-center sm:mb-14"
      >
        <span className="glass-control inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-foreground">
          Trusted by focused students
        </span>
        <h2 className="mt-5 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
          Real progress, not just planning.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Students preparing for competitive exams use StudyBuddy every day to stay consistent when motivation runs low.
        </p>
      </motion.div>

      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <motion.figure
            key={testimonial.name}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12%' }}
            transition={{ duration: 0.42, delay: index * 0.08, ease: 'easeOut' }}
            className="glass-card flex h-full flex-col rounded-2xl p-6 sm:p-7"
          >
            <Quote size={22} className="text-primary/60" aria-hidden="true" />
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground sm:text-base">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <div className="mt-5 flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <Star key={starIndex} size={14} className="fill-accent text-accent" />
              ))}
            </div>
            <figcaption className="mt-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {testimonial.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{testimonial.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{testimonial.role}</span>
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

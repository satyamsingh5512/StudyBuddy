import { BookOpenCheck, BarChart3, Timer, Users } from 'lucide-react';

const capabilities = [
  {
    icon: BookOpenCheck,
    title: 'Plan clearly',
    label: 'Turn exam goals into practical tasks and schedules.',
  },
  {
    icon: Timer,
    title: 'Focus deliberately',
    label: 'Run timed sessions and keep a reliable study history.',
  },
  {
    icon: BarChart3,
    title: 'Review honestly',
    label: 'Use progress trends to decide what needs attention next.',
  },
  {
    icon: Users,
    title: 'Stay accountable',
    label: 'Connect with friends while controlling profile visibility.',
  },
];

export function StatsSection() {
  return (
    <section
      aria-labelledby="study-loop-title"
      className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <h2 id="study-loop-title" className="sr-only">
        A complete study loop
      </h2>
      <div className="glass-card grid grid-cols-1 gap-6 rounded-2xl p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4 lg:gap-4">
        {capabilities.map((item) => (
          <div key={item.title} className="flex flex-col gap-2">
            <item.icon size={20} className="text-primary" aria-hidden="true" />
            <h3 className="font-heading text-lg font-semibold text-foreground">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

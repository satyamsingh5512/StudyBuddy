import { useMemo } from 'react';
import { Award, Check, Flame, LockKeyhole, RefreshCw, Target, Trophy } from 'lucide-react';
import { useAchievements } from '@/lib/contentQueries';
import { achievementProgress, deriveAchievements } from '@/lib/contentUtils';

export default function Achievements() {
  const query = useAchievements();
  const achievements = useMemo(
    () =>
      query.data
        ? deriveAchievements(query.data.bestStreak, query.data.completedGoals)
        : [],
    [query.data]
  );
  const unlocked = achievements.filter((item) => item.earned).length;

  if (query.isLoading) {
    return (
      <section className="mx-auto w-full max-w-5xl pb-12" aria-label="Loading achievements">
        <div className="mb-8 h-24 animate-pulse rounded-2xl bg-ink/[0.04]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-ink/[0.04]" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="mx-auto grid min-h-[50vh] w-full max-w-lg place-items-center text-center">
        <div>
          <Trophy className="mx-auto h-10 w-10 text-muted-ink" />
          <h1 className="mt-4 text-xl font-semibold text-ink">Achievements unavailable</h1>
          <p className="mt-2 text-sm text-muted-ink">Your progress could not be loaded safely.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="press mx-auto mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm text-on-accent"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl pb-12">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-ink">
            <Award className="h-3.5 w-3.5" /> Progress milestones
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink sm:text-[34px]">Achievements</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-ink">
            Badges are derived from your best study streak and goals marked completed.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="text-xl font-semibold text-ink">{query.data.bestStreak}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-ink">Best streak</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="text-xl font-semibold text-ink">{query.data.completedGoals}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-ink">Goals done</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="text-xl font-semibold text-ink">{unlocked}/{achievements.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-ink">Unlocked</p>
          </div>
        </div>
      </header>

      {(['streak', 'goals'] as const).map((category) => {
        const items = achievements.filter((item) => item.category === category);
        const Icon = category === 'streak' ? Flame : Target;
        return (
          <div key={category} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
              <Icon className="h-4 w-4 text-brand" />
              {category === 'streak' ? 'Study streaks' : 'Completed goals'}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((achievement) => {
                const percent = achievementProgress(achievement.progress, achievement.target);
                return (
                  <article
                    key={achievement.id}
                    className={`relative overflow-hidden rounded-2xl border p-4 ${
                      achievement.earned
                        ? 'border-border-accent bg-accent-subtle'
                        : 'border-hairline bg-surface'
                    }`}
                  >
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-xl ${
                          achievement.earned
                            ? 'bg-brand text-on-accent'
                            : 'bg-surface-muted text-muted-ink'
                        }`}
                      >
                        {achievement.earned ? <Check className="h-5 w-5" /> : <LockKeyhole className="h-4 w-4" />}
                      </div>
                      <span className={`text-[10px] uppercase tracking-wide ${achievement.earned ? 'text-brand' : 'text-muted-ink'}`}>
                        {achievement.earned ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-ink">{achievement.title}</h3>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-ink">
                      {achievement.progress} of {achievement.target} · {percent}%
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

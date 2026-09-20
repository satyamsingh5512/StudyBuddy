'use client';

/**
 * Study Rooms — discovery.
 *
 * Mobile-first: one column by default, two at sm, three at xl. Every card is a
 * grid child with min-w-0 and the text truncates/wraps, so a long room name can
 * never introduce horizontal scrolling. Filters are real form controls so they
 * are keyboard and screen-reader operable.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Compass, Flame, Plus, Search, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { QueryErrorState } from '@/components/QueryErrorState';
import { SkeletonList } from '@/components/Skeleton';
import CreateRoomDialog from '@/components/rooms/CreateRoomDialog';
import {
  ROOM_CATEGORY_OPTIONS,
  VISIBILITY_LABELS,
  categoryLabel,
  flattenRoomPages,
  formatFocusMinutes,
  useMyRooms,
  useRoomDiscovery,
  useRoomRankings,
  type RoomDiscoveryFilters,
  type StudyRoom,
} from '@/lib/roomQueries';

const SORT_OPTIONS: { value: NonNullable<RoomDiscoveryFilters['sort']>; label: string }[] = [
  { value: 'active', label: 'Most recent activity' },
  { value: 'members', label: 'Most members' },
  { value: 'hours', label: 'Most study hours' },
  { value: 'new', label: 'Newest' },
];

function RoomCard({ room }: { room: StudyRoom }) {
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{room.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{categoryLabel(room.category)}</p>
        </div>
        <Badge variant="outline" className="shrink-0 whitespace-nowrap">
          {VISIBILITY_LABELS[room.visibility]}
        </Badge>
      </div>

      {room.description ? (
        <p className="line-clamp-2 break-words text-sm text-muted-foreground">{room.description}</p>
      ) : null}

      {room.tags?.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Room tags">
          {room.tags.slice(0, 4).map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-auto grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Members</dt>
          <dd className="truncate">{room.memberCount}</dd>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Collective study time</dt>
          <dd className="truncate">{formatFocusMinutes(room.totalStudyMinutes)}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-2">
        <Button asChild variant={room.isMember ? 'outline' : 'default'} size="sm" className="flex-1">
          <Link href={`/rooms/${room.id}`}>{room.isMember ? 'Open room' : 'View room'}</Link>
        </Button>
      </div>

      {!room.isMember && room.eligible === false ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Entry requirements not met: {room.ineligibleReasons?.join(', ')}
        </p>
      ) : null}
    </Card>
  );
}

export default function StudyRooms() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<NonNullable<RoomDiscoveryFilters['sort']>>('active');
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo<RoomDiscoveryFilters>(
    () => ({ q: search.trim() || undefined, category: category || undefined, sort }),
    [search, category, sort]
  );

  const discovery = useRoomDiscovery(filters);
  const myRooms = useMyRooms();
  const rankings = useRoomRankings();

  const rooms = useMemo(() => flattenRoomPages(discovery.data?.pages), [discovery.data]);
  const joined = myRooms.data?.rooms ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <header className="space-y-2 pt-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Compass className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          Study Rooms
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Study alongside others, run shared focus sessions, and stay accountable to a group working
          toward the same goal.
        </p>
      </header>

      {joined.length > 0 ? (
        <section aria-labelledby="my-rooms-heading" className="space-y-3">
          <h2 id="my-rooms-heading" className="text-lg font-semibold">
            Your rooms
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {joined.map((room) => (
              <li key={room.id} className="min-w-0">
                <RoomCard room={room} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="discover-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="discover-heading" className="text-lg font-semibold">
            Discover rooms
          </h2>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create room
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative min-w-0">
            <label htmlFor="room-search" className="sr-only">
              Search rooms by name
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="room-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rooms"
              className="pl-9"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="room-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="room-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-2xl border border-hairline bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <option value="">All categories</option>
              {ROOM_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="room-sort" className="sr-only">
              Sort rooms
            </label>
            <select
              id="room-sort"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as NonNullable<RoomDiscoveryFilters['sort']>)
              }
              className="h-11 w-full rounded-2xl border border-hairline bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {discovery.isError ? (
          <QueryErrorState
            title="Could not load study rooms"
            onRetry={discovery.refetch}
            retrying={discovery.isRefetching}
          />
        ) : discovery.isLoading ? (
          <SkeletonList count={6} />
        ) : rooms.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm font-semibold">No rooms match those filters</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Try a different category, or create the room you were looking for.
            </p>
            <Button type="button" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create room
            </Button>
          </Card>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => (
                <li key={room.id} className="min-w-0">
                  <RoomCard room={room} />
                </li>
              ))}
            </ul>
            {discovery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void discovery.fetchNextPage()}
                  loading={discovery.isFetchingNextPage}
                  loadingLabel="Loading…"
                >
                  Load more rooms
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="rankings-heading" className="space-y-3">
        <h2 id="rankings-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          Top rooms
        </h2>
        {rankings.isError ? (
          <QueryErrorState
            title="Could not load room rankings"
            onRetry={rankings.refetch}
            retrying={rankings.isRefetching}
          />
        ) : rankings.isLoading ? (
          <SkeletonList count={5} />
        ) : (
          <Card className="divide-y divide-hairline p-0">
            {(rankings.data?.rooms ?? []).slice(0, 10).map((entry) => (
              <Link
                key={entry.id}
                href={`/rooms/${entry.id}`}
                className="flex min-w-0 items-center gap-3 p-3 transition-colors hover:bg-ink/[0.03] sm:p-4"
              >
                <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                  {entry.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{entry.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.memberCount} members · {formatFocusMinutes(entry.totalStudyMinutes)} total
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFocusMinutes(entry.minutesPerMember)}/member
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

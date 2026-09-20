'use client';

/**
 * Create-room dialog.
 *
 * The visibility choice conditionally reveals the fields that visibility makes
 * mandatory (goal description + target date for goal rooms, at least one
 * threshold for elite rooms), which mirrors the server's validation exactly so a
 * user never submits a payload the API is guaranteed to reject.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  ROOM_CATEGORY_OPTIONS,
  useCreateRoom,
  type RoomVisibility,
} from '@/lib/roomQueries';

const VISIBILITY_CHOICES: { value: RoomVisibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone can find and join' },
  { value: 'private', label: 'Private', hint: 'Joinable only with the invite code' },
  { value: 'goal', label: 'Goal-based', hint: 'Has a shared objective and deadline' },
  { value: 'elite', label: 'Elite', hint: 'Requires study time, XP or a streak' },
];

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateRoomDialog({ open, onOpenChange }: CreateRoomDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const createRoom = useCreateRoom();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(ROOM_CATEGORY_OPTIONS[0].value);
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [tags, setTags] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [minStudyMinutes, setMinStudyMinutes] = useState('');
  const [minPoints, setMinPoints] = useState('');
  const [minStreak, setMinStreak] = useState('');

  const reset = () => {
    setName('');
    setDescription('');
    setCategory(ROOM_CATEGORY_OPTIONS[0].value);
    setVisibility('public');
    setTags('');
    setGoalDescription('');
    setGoalTargetDate('');
    setMinStudyMinutes('');
    setMinPoints('');
    setMinStreak('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category,
      visibility,
      tags: parsedTags,
      goal:
        visibility === 'goal'
          ? {
              description: goalDescription.trim(),
              // The API requires a future instant; a date input yields midnight
              // local, so send it as an ISO timestamp.
              targetDate: goalTargetDate ? new Date(`${goalTargetDate}T23:59:59`).toISOString() : '',
              targetHours: 0,
            }
          : null,
      requirements:
        visibility === 'elite'
          ? {
              minStudyMinutes: Number(minStudyMinutes) || 0,
              minPoints: Number(minPoints) || 0,
              minStreak: Number(minStreak) || 0,
            }
          : null,
    };

    try {
      const room = await createRoom.mutateAsync(payload);
      toast({ title: 'Room created', description: `${room.name} is ready.` });
      reset();
      onOpenChange(false);
      router.push(`/rooms/${room.id}`);
    } catch (error) {
      toast({
        title: 'Could not create the room',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a study room</DialogTitle>
          <DialogDescription>
            Rooms are where members study together, run shared sessions and hold each other
            accountable.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-room-name">Room name</Label>
            <Input
              id="new-room-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="GATE 2027 Grind"
              required
              minLength={3}
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-room-description">Description</Label>
            <Textarea
              id="new-room-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this room is for"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-room-category">Category</Label>
              <select
                id="new-room-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 w-full rounded-2xl border border-hairline bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                {ROOM_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-room-tags">Tags</Label>
              <Input
                id="new-room-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="dsa, arrays"
              />
              <p className="text-[11px] text-muted-foreground">Comma separated, up to 8.</p>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Visibility</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {VISIBILITY_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className="flex min-h-11 cursor-pointer items-start gap-2 rounded-2xl border border-hairline p-3 text-sm transition-colors hover:bg-ink/[0.03] has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
                >
                  <input
                    type="radio"
                    name="room-visibility"
                    value={choice.value}
                    checked={visibility === choice.value}
                    onChange={() => setVisibility(choice.value)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{choice.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{choice.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {visibility === 'goal' ? (
            <div className="space-y-3 rounded-2xl border border-hairline p-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-room-goal">Goal</Label>
                <Input
                  id="new-room-goal"
                  value={goalDescription}
                  onChange={(event) => setGoalDescription(event.target.value)}
                  placeholder="Complete DBMS in 14 days"
                  required
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-room-goal-date">Target date</Label>
                <Input
                  id="new-room-goal-date"
                  type="date"
                  value={goalTargetDate}
                  onChange={(event) => setGoalTargetDate(event.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}

          {visibility === 'elite' ? (
            <div className="space-y-3 rounded-2xl border border-hairline p-3">
              <p className="text-xs text-muted-foreground">
                Set at least one requirement. Members below the bar cannot join.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-room-min-minutes">Min study minutes</Label>
                  <Input
                    id="new-room-min-minutes"
                    type="number"
                    min={0}
                    value={minStudyMinutes}
                    onChange={(event) => setMinStudyMinutes(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-room-min-points">Min XP</Label>
                  <Input
                    id="new-room-min-points"
                    type="number"
                    min={0}
                    value={minPoints}
                    onChange={(event) => setMinPoints(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-room-min-streak">Min streak</Label>
                  <Input
                    id="new-room-min-streak"
                    type="number"
                    min={0}
                    value={minStreak}
                    onChange={(event) => setMinStreak(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRoom.isPending} loadingLabel="Creating…">
              Create room
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Music, Pause, Play, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  pauseFocusSound,
  resumeFocusSound,
  setFocusSoundVolume,
  startFocusSound,
  stopFocusSound,
  type FocusSoundStatus,
  type Soundscape,
} from '@/lib/studyToolkit';
import { SECTION_MIN_BODY, SwitchRow, ToolSection, type SectionProps } from './shared';
import { useDebouncedCommit } from './useDebouncedCommit';

interface SoundsSectionProps extends SectionProps {
  sounds: FocusSoundStatus;
  soundscapes: Soundscape[];
  onSounds: (next: FocusSoundStatus | null) => void;
  open: boolean;
  onToggle: (id: string) => void;
}

export const SoundsSection = memo(function SoundsSection({
  sounds,
  soundscapes,
  disabled,
  onRun,
  onSounds,
  open,
  onToggle,
}: SoundsSectionProps) {
  const [soundscapeId, setSoundscapeId] = useState('');
  const [volume, setVolume] = useState(Math.round(sounds.volume * 100));
  const [soundTimer, setSoundTimer] = useState('25');
  const [followFocus, setFollowFocus] = useState(sounds.followFocus);

  // The device is the source of truth for what is actually playing, so the local
  // editor state follows it whenever a read comes back.
  useEffect(() => {
    setVolume(Math.round(sounds.volume * 100));
    setFollowFocus(sounds.followFocus);
    if (sounds.soundscapeId) setSoundscapeId((current) => current || sounds.soundscapeId || '');
  }, [sounds.volume, sounds.followFocus, sounds.soundscapeId]);

  useEffect(() => {
    if (soundscapes.length > 0) setSoundscapeId((current) => current || soundscapes[0].id);
  }, [soundscapes]);

  const writeVolume = useCallback(
    (next: number) => {
      onRun('sound-volume', async () => onSounds(await setFocusSoundVolume(next / 100)));
    },
    [onRun, onSounds]
  );
  const { schedule, commit } = useDebouncedCommit(writeVolume);

  return (
    <ToolSection
      id="sounds"
      title="Focus sounds"
      icon={<Music className="h-5 w-5" />}
      minBodyHeight={SECTION_MIN_BODY.sounds}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-sm text-muted-foreground">
        Generated on the device rather than streamed, so nothing is downloaded and it works offline.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="focus-sound-choice">Sound</Label>
          <Select value={soundscapeId} onValueChange={setSoundscapeId} disabled={disabled}>
            <SelectTrigger id="focus-sound-choice" aria-label="Choose a focus sound">
              <SelectValue placeholder="Choose a sound" />
            </SelectTrigger>
            <SelectContent>
              {soundscapes.map((sound) => (
                <SelectItem key={sound.id} value={sound.id}>
                  {sound.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus-sound-timer">Stop after (minutes, blank for no limit)</Label>
          <Input
            id="focus-sound-timer"
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            value={soundTimer}
            disabled={disabled}
            onChange={(event) => setSoundTimer(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="focus-sound-volume">Volume: {volume}%</Label>
        <Slider
          id="focus-sound-volume"
          aria-label="Focus sound volume"
          min={0}
          max={100}
          step={1}
          value={volume}
          disabled={disabled}
          onChange={(next) => {
            setVolume(next);
            schedule(next);
          }}
          onChangeEnd={commit}
        />
      </div>

      <SwitchRow id="focus-sound-follow" label="Stop when the focus session ends">
        <Switch
          id="focus-sound-follow"
          aria-label="Stop the sound when the focus session ends"
          checked={followFocus}
          disabled={disabled}
          onCheckedChange={setFollowFocus}
        />
      </SwitchRow>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={disabled || !soundscapeId}
          onClick={() =>
            onRun(
              'sound-start',
              async () => {
                const minutes = Number(soundTimer);
                onSounds(
                  await startFocusSound({
                    soundscapeId,
                    volume: volume / 100,
                    stopAfterMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
                    followFocus,
                  })
                );
              },
              'Sound started'
            )
          }
        >
          <Play aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Play
        </Button>
        {sounds.playing && !sounds.paused ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => onRun('sound-pause', async () => onSounds(await pauseFocusSound()))}
          >
            <Pause aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Pause
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            disabled={disabled || !sounds.playing}
            onClick={() => onRun('sound-resume', async () => onSounds(await resumeFocusSound()))}
          >
            <Play aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Resume
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={disabled || !sounds.playing}
          onClick={() => onRun('sound-stop', async () => onSounds(await stopFocusSound()))}
        >
          <Square aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Stop
        </Button>
        {sounds.playing && <Badge variant="secondary">{sounds.paused ? 'Paused' : 'Playing'}</Badge>}
      </div>
    </ToolSection>
  );
});

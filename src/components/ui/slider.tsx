'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { soundManager } from '@/lib/sounds';

/**
 * Slider — draggable-thumb range input with spring/rubbery physics.
 *
 * Deliberately NOT a native <input type="range"> wrapped in CSS: browsers
 * give zero control over thumb physics, so dragging always feels dead/
 * linear. Instead the thumb is a framer-motion draggable positioned by
 * percentage, and the fill track's width is a spring-interpolated motion
 * value — both animate with the same squash-and-stretch spring language
 * as GlassButton's jelly-tap (stiffness ~500 / damping ~14), so grabbing
 * and flinging the thumb has the same premium, rubbery feel as the rest
 * of the app's interactive surfaces.
 *
 * Semantics: renders a hidden native <input type="range"> in sync so this
 * still participates in forms/labels/keyboard the same way a real slider
 * would (arrow keys, Home/End), while the visual thumb/track are the
 * custom motion elements on top.
 */

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onChangeEnd,
  className,
  disabled,
  id,
  'aria-label': ariaLabel,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const reduce = useReducedMotion();

  const pctFromValue = useCallback(
    (v: number) => clamp(((v - min) / (max - min)) * 100, 0, 100),
    [min, max]
  );

  // Raw percentage (0-100) driving thumb position; spring-smoothed so drags
  // and programmatic changes alike settle with a bouncy overshoot instead
  // of snapping instantly.
  const rawPct = useMotionValue(pctFromValue(value));
  const springPct = useSpring(rawPct, { stiffness: 500, damping: 30, mass: 0.6 });

  // Extra squash/stretch on the thumb only while actively dragging —
  // mirrors GlassButton's jellyTap variant.
  const thumbScaleX = useMotionValue(1);
  const thumbScaleY = useMotionValue(1);
  const springScaleX = useSpring(thumbScaleX, { stiffness: 500, damping: 12, mass: 0.6 });
  const springScaleY = useSpring(thumbScaleY, { stiffness: 500, damping: 12, mass: 0.6 });
  const springPctPercent = useTransform(springPct, (v) => `${v}%`);

  useEffect(() => {
    if (!isDragging) {
      rawPct.set(pctFromValue(value));
    }
  }, [value, isDragging, pctFromValue, rawPct]);

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + pct * (max - min);
      const stepped = Math.round(raw / step) * step;
      return clamp(stepped, min, max);
    },
    [min, max, step, value]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    if (!reduce) {
      thumbScaleX.set(1.15);
      thumbScaleY.set(0.85);
    }
    soundManager.playClick();
    const next = valueFromClientX(e.clientX);
    rawPct.set(pctFromValue(next));
    onChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    const next = valueFromClientX(e.clientX);
    rawPct.set(pctFromValue(next));
    onChange(next);
  };

  const endDrag = (finalValue?: number) => {
    if (!isDragging) return;
    setIsDragging(false);
    thumbScaleX.set(1);
    thumbScaleY.set(1);
    onChangeEnd?.(finalValue ?? value);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const next = valueFromClientX(e.clientX);
    endDrag(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp(value + step, min, max);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp(value - step, min, max);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'PageUp') next = clamp(value + step * 10, min, max);
    else if (e.key === 'PageDown') next = clamp(value - step * 10, min, max);
    else return;

    e.preventDefault();
    rawPct.set(pctFromValue(next));
    onChange(next);
    onChangeEnd?.(next);
  };

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-2 w-full rounded-full bg-muted cursor-pointer touch-none select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => endDrag()}
    >
      {/* Fill — spring-interpolated width, same motion value as thumb position */}
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: reduce ? `${pctFromValue(value)}%` : springPctPercent }}
      />
      {/* Draggable thumb */}
      <motion.div
        role="slider"
        id={id}
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary shadow-md ring-2 ring-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing"
        style={{
          left: reduce ? `${pctFromValue(value)}%` : springPctPercent,
          scaleX: reduce ? 1 : springScaleX,
          scaleY: reduce ? 1 : springScaleY,
        }}
      />
      {/* Hidden native input keeps form semantics / a11y fallback in sync */}
      <input
        type="range"
        className="sr-only"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

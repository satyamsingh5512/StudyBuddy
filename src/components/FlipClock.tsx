import { motion, AnimatePresence } from 'framer-motion';

interface FlipClockProps {
    timeInSeconds: number; // total time elapsed, or time remaining
    isCountingDown?: boolean; // if true, it's a countdown
}

const FlipDigit = ({ value }: { value: string }) => {
    return (
        <div
            className="relative bg-zinc-900 rounded-lg sm:rounded-xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center m-0.5 sm:m-1 perspective-1000 fullscreen-timer-clock-digit"
            style={{
                width: 'clamp(2.4rem, 13vw, 8rem)',
                height: 'clamp(3.4rem, 20vw + 2rem, 12rem)',
                maxHeight: '38dvh',
            }}
        >
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={value}
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <span
                className="font-bold text-white tabular-nums drop-shadow-md tracking-tighter fullscreen-timer-clock-digit-value"
                        style={{ fontSize: 'clamp(1.75rem, 10vw, 8rem)' }}
                    >
                        {value}
                    </span>
                </motion.div>
            </AnimatePresence>
            <div className="absolute top-1/2 left-0 right-0 h-px bg-black/40 z-10 box-shadow-xl" />
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-xl h-1/2" />
        </div>
    );
};

export default function FlipClock({ timeInSeconds, isCountingDown = false }: FlipClockProps) {
    void isCountingDown;
    const safeSeconds = Math.max(0, Math.floor(timeInSeconds || 0));
    // Support hours for long unlimited sessions: H:MM:SS, otherwise MM:SS.
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    const minTens = Math.floor(minutes / 10).toString();
    const minUnits = (minutes % 10).toString();
    const secTens = Math.floor(seconds / 10).toString();
    const secUnits = (seconds % 10).toString();

    return (
        <div className="flex items-center justify-center gap-1.5 sm:gap-3 md:gap-6 drop-shadow-2xl max-w-full flex-wrap">
            {hours > 0 && (
                <>
                    <div className="flex items-center gap-0.5 sm:gap-1">
                        <FlipDigit value={Math.floor(hours / 10).toString()} />
                        <FlipDigit value={(hours % 10).toString()} />
                    </div>
                    <Colon />
                </>
            )}
            <div className="flex items-center gap-0.5 sm:gap-1">
                <FlipDigit value={minTens} />
                <FlipDigit value={minUnits} />
            </div>

            {/* Colon */}
            <Colon />

            <div className="flex items-center gap-0.5 sm:gap-1">
                <FlipDigit value={secTens} />
                <FlipDigit value={secUnits} />
            </div>
        </div>
    );
}

function Colon() {
    return (
        <div
            className="flex flex-col gap-2 sm:gap-3 md:gap-6 opacity-80 animate-pulse shrink-0"
            aria-hidden
        >
            <div
                className="rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                style={{ width: 'clamp(0.5rem, 2vw, 1.5rem)', height: 'clamp(0.5rem, 2vw, 1.5rem)' }}
            />
            <div
                className="rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                style={{ width: 'clamp(0.5rem, 2vw, 1.5rem)', height: 'clamp(0.5rem, 2vw, 1.5rem)' }}
            />
        </div>
    );
}

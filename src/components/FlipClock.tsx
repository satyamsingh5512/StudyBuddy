import { motion, AnimatePresence } from 'framer-motion';

interface FlipClockProps {
    timeInSeconds: number; // total time elapsed, or time remaining
    isCountingDown?: boolean; // if true, it's a countdown
}

const FlipDigit = ({ value }: { value: string }) => {
    return (
        <div className="relative w-24 h-36 md:w-32 md:h-48 bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center m-1 perspective-1000">
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={value}
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <span className="text-[5rem] md:text-[8rem] font-bold text-white tabular-nums drop-shadow-md tracking-tighter">
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
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;

    const minTens = Math.floor(minutes / 10).toString();
    const minUnits = (minutes % 10).toString();
    const secTens = Math.floor(seconds / 10).toString();
    const secUnits = (seconds % 10).toString();

    return (
        <div className="flex items-center justify-center gap-4 md:gap-8 drop-shadow-2xl">
            <div className="flex items-center gap-1">
                <FlipDigit value={minTens} />
                <FlipDigit value={minUnits} />
            </div>

            {/* Colon */}
            <div className="flex flex-col gap-4 md:gap-8 opacity-80 animate-pulse">
                <div className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                <div className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            </div>

            <div className="flex items-center gap-1">
                <FlipDigit value={secTens} />
                <FlipDigit value={secUnits} />
            </div>
        </div>
    );
}

import { useAtom } from "jotai";
import { performanceModeAtom } from "@/store/atoms";
import { Sparkles, Zap } from "lucide-react";

export default function PerformanceToggle() {
    // If performanceMode is true, we optimize for 60fps by disabling heavy effects
    const [performanceMode, setPerformanceMode] = useAtom(performanceModeAtom);

    return (
        <button
            onClick={() => setPerformanceMode(!performanceMode)}
            className="text-black dark:text-white p-2 border-2 border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-xl bg-transparent transition-all group flex items-center justify-center relative"
            title={performanceMode ? "Performance Mode (High FPS)" : "Visual Quality Mode (Heavy Effects)"}
        >
            {performanceMode ? (
                <Zap size={20} className="text-yellow-500 fill-yellow-500/20 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
            ) : (
                <Sparkles size={20} className="text-primary group-hover:scale-110 transition-transform" />
            )}
        </button>
    );
}

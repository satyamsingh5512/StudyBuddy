import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Flame } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface HeatmapData {
    date: string;
    level: 0 | 1 | 2 | 3 | 4; // 0 = none, 1 = low, 2 = medium, 3 = high, 4 = max (glowing)
    count: number;
}

interface StudyHeatmapProps {
    data?: HeatmapData[];
}

// Generate realistic dummy data for the last 90 days to show off the UI if no real data
const generateMockHeatmapData = (): HeatmapData[] => {
    const data: HeatmapData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 89; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Randomly generate activity with a bias towards recent days
        const isRecent = i < 30;
        const rand = Math.random();

        let level: 0 | 1 | 2 | 3 | 4 = 0;
        let count = 0;

        if (rand > 0.8) {
            level = 4;
            count = Math.floor(Math.random() * 5) + 8;
        } else if (rand > 0.6) {
            level = 3;
            count = Math.floor(Math.random() * 4) + 4;
        } else if (rand > 0.4 || (isRecent && rand > 0.2)) {
            level = 2;
            count = Math.floor(Math.random() * 3) + 2;
        } else if (rand > 0.2 || isRecent) {
            level = 1;
            count = 1;
        }

        data.push({
            date: date.toISOString().split('T')[0],
            level,
            count
        });
    }
    return data;
};

export default function StudyHeatmap({ data = generateMockHeatmapData() }: StudyHeatmapProps) {

    // Group into weeks (7 days per column)
    const weeks = useMemo(() => {
        const chunks: HeatmapData[][] = [];
        for (let i = 0; i < data.length; i += 7) {
            chunks.push(data.slice(i, i + 7));
        }
        return chunks;
    }, [data]);

    const getColorClass = (level: number) => {
        switch (level) {
            case 4: return 'bg-primary shadow-[0_0_10px_rgba(108,71,255,0.8)] border border-primary/50 z-10'; // Max activity glows!
            case 3: return 'bg-primary/80 border border-primary/20';
            case 2: return 'bg-primary/50 border border-primary/10';
            case 1: return 'bg-primary/30';
            default: return 'bg-secondary/50 block';
        }
    };

    return (
        <Card className="border-border/50 bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden group">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <span className="flex items-center gap-2 text-foreground">
                        <Flame className="h-4 w-4 text-orange-500" /> Consistency Activity
                    </span>
                </CardTitle>
                <div className="text-xs text-muted-foreground font-mono">Last 90 Days</div>
            </CardHeader>
            <CardContent className="pt-4 pb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <TooltipProvider delayDuration={50}>
                    <div className="flex gap-1 min-w-max">
                        {weeks.map((week, weekIndex) => (
                            <div key={`week-${weekIndex}`} className="flex flex-col gap-1">
                                {week.map((day, dayIndex) => (
                                    <Tooltip key={day.date}>
                                        <TooltipTrigger asChild>
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{
                                                    delay: (weekIndex * 0.05) + (dayIndex * 0.02),
                                                    type: "spring", stiffness: 400, damping: 20
                                                }}
                                                className={`w-3 h-3 rounded-[3px] transition-all duration-300 hover:scale-125 hover:z-20 cursor-crosshair ${getColorClass(day.level)}`}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs font-mono bg-background/90 backdrop-blur-xl border border-border/50 text-foreground px-3 py-2 shadow-xl z-50">
                                            <p>{day.count} {day.count === 1 ? 'task' : 'tasks'} on {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        ))}
                    </div>
                </TooltipProvider>

                <div className="flex items-center justify-end gap-2 mt-4 text-xs font-mono text-muted-foreground">
                    <span>Less</span>
                    <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((level) => (
                            <div key={`legend-${level}`} className={`w-3 h-3 rounded-[2px] ${getColorClass(level)}`} />
                        ))}
                    </div>
                    <span>More</span>
                </div>
            </CardContent>
        </Card>
    );
}

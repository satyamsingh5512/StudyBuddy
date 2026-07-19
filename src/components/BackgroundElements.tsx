interface BackgroundElementsProps {
    isDark?: boolean;
}

export default function BackgroundElements({ isDark = true }: BackgroundElementsProps) {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
            {/* Subtle architectural grid gives translucent surfaces something to refract. */}
            <div className="absolute inset-0 hidden text-transparent md:block" style={{
                backgroundImage: `
                    linear-gradient(to right, ${isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(37, 63, 96, 0.045)'} 1px, transparent 1px),
                    linear-gradient(to bottom, ${isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(37, 63, 96, 0.045)'} 1px, transparent 1px)
                `,
                backgroundSize: '52px 52px',
                maskImage: 'linear-gradient(to bottom, black, transparent 72%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 72%)'
            }} />

            <div
                className="absolute -inset-[24%] hidden opacity-80 dark:opacity-70 md:block"
                style={{
                    background: isDark
                        ? 'linear-gradient(118deg, transparent 18%, rgba(78, 101, 157, 0.22) 41%, transparent 58%), linear-gradient(298deg, transparent 24%, rgba(43, 129, 122, 0.16) 48%, transparent 68%)'
                        : 'linear-gradient(118deg, transparent 18%, rgba(161, 201, 255, 0.58) 41%, transparent 58%), linear-gradient(298deg, transparent 24%, rgba(164, 233, 215, 0.38) 48%, transparent 68%)',
                    filter: 'blur(44px)',
                    transform: 'rotate(-7deg)'
                }}
            />

            <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(27,46,71,0.08)] dark:shadow-[inset_0_0_140px_rgba(0,0,0,0.38)]" />
        </div>
    );
}

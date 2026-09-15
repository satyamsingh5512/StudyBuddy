import { motion, useReducedMotion } from 'framer-motion';
import Logo from './Logo';

export default function LoadingScreen() {
  const reduce = useReducedMotion();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="Loading StudyBuddy"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={reduce ? undefined : { opacity: 1, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [1, 0.8, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Logo className="w-16 h-16 text-foreground" animated />
        </motion.div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 h-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-primary"
                animate={{
                  y: [-4, 4, -4],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

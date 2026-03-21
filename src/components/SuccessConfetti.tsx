import { useEffect, useRef } from "react";
import { Confetti, ConfettiRef } from "./ui/confetti";
import { motion } from "framer-motion";

export function SuccessConfetti({ message = "StudyBuddy" }: { message?: string }) {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    confettiRef.current?.fire({});
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <span className="pointer-events-none z-10 whitespace-pre-wrap bg-gradient-to-br from-primary via-primary/80 to-primary/30 bg-clip-text text-center text-7xl md:text-8xl font-black tracking-widest leading-none text-transparent drop-shadow-lg">
        {message}
      </span>
      <Confetti
        ref={confettiRef}
        className="absolute left-0 top-0 z-0 size-full"
        options={{
          particleCount: 150,
          spread: 80,
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        }}
      />
    </motion.div>
  );
}

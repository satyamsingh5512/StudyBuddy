"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface RotatingTextProps {
    words: string[];
    className?: string;
}

export const RotatingText = ({ words, className }: RotatingTextProps) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prevIndex) => (prevIndex + 1) % words.length);
        }, 2000); // Change word every 2 seconds

        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <div className={`inline-block relative overflow-hidden h-[1.2em] md:h-[1.1em] align-top text-left px-2 ${className}`}>
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={index}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "-120%" }}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        mass: 1
                    }}
                    className="block absolute top-0 left-2 whitespace-nowrap"
                >
                    {words[index]}
                </motion.span>
            </AnimatePresence>
            {/* Invisible spacer to maintain width if needed, or just let absolute positioning handle it. 
          Actually, for a smooth width transition, we might need more logic, 
          but for now let's assume words are similar length or container is wide enough.
          To keep it simple and robust, we'll just let the container be defined by the longest word 
          if we wanted, but absolute positioning removes it from flow. 
          Let's use a spacer. 
      */}
            <span className="invisible">{words.reduce((a, b) => a.length > b.length ? a : b)}</span>
        </div>
    );
};

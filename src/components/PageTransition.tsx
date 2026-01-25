import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

interface PageTransitionProps {
    children: ReactNode;
}

const variants = {
    initial: {
        opacity: 0,
        y: 8,
        scale: 0.98,
        filter: 'blur(4px)'
    },
    enter: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            duration: 0.4,
            ease: [0.25, 1, 0.5, 1], // Cubic bezier for smooth entry
        }
    },
    exit: {
        opacity: 0,
        y: -8,
        scale: 0.98,
        filter: 'blur(4px)',
        transition: {
            duration: 0.2, // Faster exit
            ease: 'easeIn'
        }
    }
};

export default function PageTransition({ children }: PageTransitionProps) {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                variants={variants}
                initial="initial"
                animate="enter"
                exit="exit"
                className="w-full h-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

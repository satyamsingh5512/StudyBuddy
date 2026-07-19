import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@/lib/router";
import { Menu, X, LayoutDashboard } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/atoms";
import { MagneticButton } from "@/components/ui/magnetic-button";
import PerformanceToggle from "@/components/PerformanceToggle";
import { AnimatePresence } from "framer-motion";

interface PremiumNavbarProps {
    scrollToId?: (id: string) => void;
    isLoaded?: boolean;
}

export function PremiumNavbar({ scrollToId, isLoaded = true }: PremiumNavbarProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const user = useAtomValue(userAtom);
    const navigate = useNavigate();

    const navLinks = [
        { id: "home", label: "Home" },
        { id: "workflow", label: "How it works" },
        { id: "features", label: "Toolkit" },
        { id: "faq", label: "FAQ" },
    ];

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isLoaded ? "opacity-100" : "opacity-0"} ${isScrolled
                ? "glass-panel border-x-0 border-t-0 py-2"
                : "bg-transparent border-b border-transparent py-4"
                }`}
        >
            <div className="container mx-auto flex items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <button onClick={() => scrollToId?.("home")} className="flex min-w-0 items-center gap-2 sm:gap-3 group bg-transparent border-none outline-none">
                    <Logo className="w-8 h-8 text-black dark:text-white group-hover:scale-105 transition-transform" />
                    <span className="truncate font-[800] text-lg sm:text-xl tracking-tight text-black dark:text-white">
                        StudyBuddy
                    </span>
                </button>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <button
                            key={link.label}
                            onClick={() => scrollToId?.(link.id)}
                            className="group relative text-sm font-bold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors py-2"
                        >
                            {link.label}
                            <span
                                className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 w-0 group-hover:w-full"
                            />
                        </button>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    <PerformanceToggle />
                    <ThemeToggle />
                    {user ? (
                        <Link to="/dashboard">
                            <MagneticButton variant="secondary" className="glass-control flex items-center gap-2 font-bold !rounded-xl">
                                <LayoutDashboard size={18} />
                                Dashboard
                            </MagneticButton>
                        </Link>
                    ) : (
                        <>
                            <Link to="/auth">
                                <button className="glass-control px-5 py-2 font-bold text-black dark:text-white transition-all hover:-translate-y-0.5 rounded-xl">
                                    Sign In
                                </button>
                            </Link>
                            <MagneticButton onClick={() => navigate("/auth")} variant="primary" className="!rounded-xl border border-white/30 shadow-glass-sm hover:-translate-y-0.5">
                                Build a plan
                            </MagneticButton>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex shrink-0 items-center gap-1 md:hidden">
                    <PerformanceToggle />
                    <ThemeToggle />
                    <button
                        className="glass-control text-black dark:text-white p-2 rounded-xl"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="glass-strong md:hidden absolute top-full left-0 right-0 max-h-[calc(100dvh-4rem)] overflow-y-auto border-x-0 border-t-0 p-4 sm:p-6 space-y-6 origin-top"
                    >
                        {navLinks.map((link) => (
                            <button
                                key={link.label}
                                onClick={() => {
                                    scrollToId?.(link.id);
                                    setIsMobileMenuOpen(false);
                                }}
                                className="block w-full text-left text-xl font-bold text-black dark:text-white hover:text-primary transition-colors"
                            >
                                {link.label}
                            </button>
                        ))}
                        <div className="pt-6 flex flex-col gap-4 border-t border-black/10 dark:border-white/10">
                            {user ? (
                                <Link to="/dashboard" className="w-full">
                                    <button className="w-full py-3 neo-button-primary rounded-xl flex items-center justify-center gap-2">
                                        <LayoutDashboard size={20} />
                                        Dashboard
                                    </button>
                                </Link>
                            ) : (
                                <>
                                    <Link to="/auth" className="w-full">
                                        <button className="w-full py-3 neo-button rounded-xl">
                                            Sign In
                                        </button>
                                    </Link>
                                    <button onClick={() => navigate("/auth")} className="w-full py-3 neo-button-primary rounded-xl">
                                        Build a plan
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}

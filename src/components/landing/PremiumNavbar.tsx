import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@/lib/router";
import { Menu, X, LayoutDashboard } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/atoms";
import { MagneticButton } from "@/components/ui/magnetic-button";

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
        { id: "features", label: "Features" },
        { id: "app", label: "App" },
        { id: "join", label: "Join" },
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
                ? "bg-white/70 dark:bg-black/70 border-b border-black/10 dark:border-white/10 backdrop-blur-xl shadow-sm py-2"
                : "bg-transparent border-b border-transparent py-4"
                }`}
        >
            <div className="container mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <button onClick={() => scrollToId?.("home")} className="flex items-center gap-3 group bg-transparent border-none outline-none">
                    <Logo className="w-8 h-8 text-black dark:text-white group-hover:scale-105 transition-transform" />
                    <span className="font-[800] text-xl tracking-tight text-black dark:text-white">
                        StudyBuddy
                    </span>
                </button>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <button
                            key={link.label}
                            onClick={() => scrollToId?.(link.id)}
                            className="group relative text-sm font-bold text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors"
                        >
                            {link.label}
                            <span
                                className="absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300 w-0 group-hover:w-full"
                            />
                        </button>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    <ThemeToggle />
                    {user ? (
                        <Link to="/dashboard">
                            <MagneticButton variant="secondary" className="flex items-center gap-2 font-bold !rounded-xl !border-2 !border-black/10 dark:!border-white/20 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                                <LayoutDashboard size={18} />
                                Dashboard
                            </MagneticButton>
                        </Link>
                    ) : (
                        <>
                            <Link to="/auth">
                                <button className="px-5 py-2 font-bold text-black dark:text-white transition-colors hover:text-black/70 dark:hover:text-white/80 border-2 border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-xl">
                                    Sign In
                                </button>
                            </Link>
                            <MagneticButton onClick={() => navigate("/auth")} variant="primary" className="!rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#757373] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                                Get Started
                            </MagneticButton>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex items-center gap-4 md:hidden">
                    <ThemeToggle />
                    <button
                        className="text-black dark:text-white p-2 border-2 border-black/10 dark:border-white/20 rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:hidden absolute top-full left-0 right-0 backdrop-blur-xl bg-white/90 dark:bg-black/90 border-b border-black/10 dark:border-white/10 p-6 space-y-6 shadow-2xl"
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
                                    Get Started
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </nav>
    );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/atoms";

export function PremiumNavbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const user = useAtomValue(userAtom);
    const navigate = useNavigate();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { href: "#features", label: "Features" },
        { href: "/pricing", label: "Pricing" },
        { href: "/about", label: "About" },
    ];

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
                ? "bg-white/95 dark:bg-zinc-950/95 border-b-2 border-black dark:border-white/20 backdrop-blur-md"
                : "bg-transparent"
                }`}
        >
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 group">
                    <Logo className="w-8 h-8 text-black dark:text-white group-hover:scale-105 transition-transform" />
                    <span className="font-[800] text-xl tracking-[-1px] text-black dark:text-white">
                        StudyBuddy
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="text-base font-bold text-black/70 dark:text-white/80 hover:text-black dark:hover:text-white hover:underline decoration-2 underline-offset-4 transition-all"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    <ThemeToggle />
                    {user ? (
                        <Link to="/dashboard">
                            <button className="flex items-center gap-2 px-5 py-2 font-bold text-black dark:text-white transition-colors hover:text-black/70 dark:hover:text-white/80 border-2 border-black dark:border-white rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black">
                                <LayoutDashboard size={18} />
                                Dashboard
                            </button>
                        </Link>
                    ) : (
                        <>
                            <Link to="/auth">
                                <button className="px-5 py-2 font-bold text-black dark:text-white transition-colors hover:text-black/70 dark:hover:text-white/80 border-2 border-transparent hover:border-black dark:hover:border-white/20 rounded-lg">
                                    Sign In
                                </button>
                            </Link>
                            <button onClick={() => navigate("/auth")} className="neo-button-primary rounded-lg transition-transform active:scale-95">
                                Get Started
                            </button>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex items-center gap-4 md:hidden">
                    <ThemeToggle />
                    <button
                        className="text-black dark:text-white p-2 border-2 border-black dark:border-white/20 rounded shadow-neo-sm dark:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
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
                    className="md:hidden absolute top-20 left-0 right-0 bg-white dark:bg-zinc-950 border-b-2 border-black dark:border-white/20 p-6 space-y-6 shadow-xl"
                >
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="block text-xl font-bold text-black dark:text-white hover:underline"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {link.label}
                        </a>
                    ))}
                    <div className="pt-6 flex flex-col gap-4">
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

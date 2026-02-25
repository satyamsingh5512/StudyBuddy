import { PremiumNavbar } from "@/components/landing/PremiumNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { AndroidWaitlistSection } from "@/components/landing/AndroidWaitlistSection";
import UnifiedPageWrapper from "@/components/UnifiedPageWrapper";

export default function Landing() {
    return (
        <UnifiedPageWrapper>
            <main className="relative bg-background min-h-screen font-sans selection:bg-[#00e5ff] selection:text-[#0a0a0a] overflow-x-hidden">
                {/* The PremiumNavbar contains the ThemeToggle and navigation */}
                <PremiumNavbar />

                {/* Core Sections */}
                <HeroSection />
                <SocialProofSection />
                <FeaturesSection />
                <AndroidWaitlistSection />

                {/* Footer */}
                <footer className="border-t-2 border-black dark:border-white/20 py-12 text-sm text-zinc-600 dark:text-zinc-400 relative z-10 bg-white dark:bg-[#09090b]">
                    <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="font-bold text-black dark:text-white">© 2026 StudyBuddy. All rights reserved.</div>
                        <div className="flex gap-6 font-bold">
                            <a href="/terms" className="hover:text-black dark:hover:text-white hover:underline transition-all">Terms</a>
                            <a href="/privacy" className="hover:text-black dark:hover:text-white hover:underline transition-all">Privacy</a>
                            <a href="#" className="hover:text-black dark:hover:text-white hover:underline transition-all">System Status</a>
                        </div>
                    </div>
                </footer>
            </main>
        </UnifiedPageWrapper>
    );
}

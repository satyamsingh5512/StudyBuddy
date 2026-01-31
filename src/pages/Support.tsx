import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, HelpCircle, Mail, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import Logo from '@/components/Logo';
import { Input } from '@/components/ui/input';

export default function Support() {
    const navigate = useNavigate();

    return (
        <UnifiedPageWrapper>
            <div className="min-h-screen flex flex-col">
                {/* Header */}
                <header className="border-b bg-background/60 backdrop-blur-md sticky top-0 z-10">
                    <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-4xl">
                        <div className="flex items-center gap-2">
                            <Logo className="w-5 h-5" />
                            <span className="font-medium">StudyBuddy Help Center</span>
                        </div>
                        <Button onClick={() => navigate('/')} size="sm" variant="ghost">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Home
                        </Button>
                    </div>
                </header>

                {/* Hero */}
                <div className="bg-primary/5 py-12 border-b">
                    <div className="container mx-auto px-6 max-w-2xl text-center">
                        <h1 className="text-3xl font-bold mb-4">How can we help you?</h1>
                        <div className="relative max-w-md mx-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9 bg-background/80 backdrop-blur-sm" placeholder="Search for answers..." />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
                    <div className="grid gap-10">
                        {/* FAQs */}
                        <section>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <HelpCircle className="h-6 w-6 text-primary" />
                                Frequently Asked Questions
                            </h2>
                            <div className="w-full space-y-4">
                                <details className="group border rounded-lg bg-card px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 py-2 font-medium text-foreground outline-none transition-colors hover:text-primary">
                                        How does the AI study planner work?
                                        <ChevronDown className="h-4 w-4 transition-transform group-open:-rotate-180" />
                                    </summary>
                                    <p className="mt-2 text-sm text-muted-foreground border-t pt-3 leading-relaxed">
                                        Our AI analyzes your exam date, syllabus, and study preferences to create a personalized schedule. It adapts daily based on your progress and performance in practice tests.
                                    </p>
                                </details>

                                <details className="group border rounded-lg bg-card px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 py-2 font-medium text-foreground outline-none transition-colors hover:text-primary">
                                        Is StudyBuddy free to use?
                                        <ChevronDown className="h-4 w-4 transition-transform group-open:-rotate-180" />
                                    </summary>
                                    <p className="mt-2 text-sm text-muted-foreground border-t pt-3 leading-relaxed">
                                        Yes! StudyBuddy is currently free for all students. We are committed to democratizing education access.
                                    </p>
                                </details>

                                <details className="group border rounded-lg bg-card px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 py-2 font-medium text-foreground outline-none transition-colors hover:text-primary">
                                        How do I delete my account?
                                        <ChevronDown className="h-4 w-4 transition-transform group-open:-rotate-180" />
                                    </summary>
                                    <p className="mt-2 text-sm text-muted-foreground border-t pt-3 leading-relaxed">
                                        You can delete your account from the Settings page. This action is permanent and will remove all your study data.
                                    </p>
                                </details>

                                <details className="group border rounded-lg bg-card px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="flex cursor-pointer items-center justify-between gap-1.5 py-2 font-medium text-foreground outline-none transition-colors hover:text-primary">
                                        Can I study offline?
                                        <ChevronDown className="h-4 w-4 transition-transform group-open:-rotate-180" />
                                    </summary>
                                    <p className="mt-2 text-sm text-muted-foreground border-t pt-3 leading-relaxed">
                                        StudyBuddy works best with an internet connection to sync your progress and provide AI insights. However, your current schedule is cached for offline viewing.
                                    </p>
                                </details>
                            </div>
                        </section>

                        {/* Contact */}
                        <section className="bg-muted/30 border rounded-xl p-8 text-center">
                            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Still need support?</h2>
                            <p className="text-muted-foreground mb-6">
                                Our team is here to help you with any technical issues or questions.
                            </p>
                            <a
                                href="mailto:studybuddy5512@gmail.com"
                                className="inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-2"
                            >
                                Email Support
                            </a>
                            <p className="mt-4 text-sm text-muted-foreground">
                                or write to us at <strong className="text-foreground">studybuddy5512@gmail.com</strong>
                            </p>
                        </section>
                    </div>
                </main>
            </div>
        </UnifiedPageWrapper>
    );
}

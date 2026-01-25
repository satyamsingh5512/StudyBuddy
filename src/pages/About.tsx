import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Zap, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import Logo from '@/components/Logo';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
    const navigate = useNavigate();

    return (
        <UnifiedPageWrapper>
            <div className="min-h-screen flex flex-col">
                {/* Header */}
                <header className="border-b bg-background/60 backdrop-blur-md sticky top-0 z-10">
                    <div className="container mx-auto px-6 h-16 flex items-center justify-between max-w-4xl">
                        <div className="flex items-center gap-2">
                            <Logo className="w-5 h-5" />
                            <span className="font-medium">StudyBuddy</span>
                        </div>
                        <Button onClick={() => navigate('/')} size="sm" variant="ghost">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Home
                        </Button>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">About StudyBuddy</h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Empowering students to achieve their academic goals through smart, social, and gamified learning.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <Card className="hover:shadow-lg transition-shadow duration-300 border-border/50">
                            <CardContent className="pt-6 text-center">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Smart Planning</h3>
                                <p className="text-sm text-muted-foreground">
                                    Our algorithm helps you optimize your study schedule for maximum efficiency.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow duration-300 border-border/50">
                            <CardContent className="pt-6 text-center">
                                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-400">
                                    <Users className="w-6 h-6" />
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Community First</h3>
                                <p className="text-sm text-muted-foreground">
                                    Connect with peers, compete in leaderboards, and grow together.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow duration-300 border-border/50">
                            <CardContent className="pt-6 text-center">
                                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-pink-600 dark:text-pink-400">
                                    <Heart className="w-6 h-6" />
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Made with Love</h3>
                                <p className="text-sm text-muted-foreground">
                                    Built by students, for students. We understand your journey.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 text-center">
                        <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
                        <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            We believe that education should be accessible, engaging, and collaborative. StudyBuddy was created to break the isolation of studying alone and provide a platform where motivation meets productivity. Whether you're preparing for JEE, NEET, or college exams, we're here to be your companion in success.
                        </p>
                    </div>
                </main>
            </div>
        </UnifiedPageWrapper>
    );
}

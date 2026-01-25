import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Send, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UnifiedPageWrapper from '@/components/UnifiedPageWrapper';
import Logo from '@/components/Logo';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function Contact() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

    const CONTACT_EMAIL = 'studybuddy5512@gmail.com';

    const handleCopyEmail = () => {
        navigator.clipboard.writeText(CONTACT_EMAIL);
        setCopied(true);
        toast({ title: 'Email copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.location.href = mailtoLink;
    };

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
                <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
                        <p className="text-muted-foreground">
                            Have questions or feedback? We'd love to hear from you.
                        </p>
                    </div>

                    <div className="grid gap-8">
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-4">
                                <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center shadow-sm text-primary">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-medium mb-1">Email Us Directly</h3>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Click to copy our support email address
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="gap-2 font-mono text-sm h-auto py-2"
                                        onClick={handleCopyEmail}
                                    >
                                        {CONTACT_EMAIL}
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Send a Message</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Subject</label>
                                        <Input
                                            placeholder="How can we help?"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Message</label>
                                        <textarea
                                            className="w-full min-h-[150px] rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            placeholder="Tell us what's on your mind..."
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full gap-2">
                                        <Send className="w-4 h-4" />
                                        Open Email Client
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </UnifiedPageWrapper>
    );
}

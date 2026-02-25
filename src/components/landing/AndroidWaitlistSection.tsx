import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Bell, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/config/api';

const perks = [
    { icon: '🔔', text: 'Native timer notifications' },
    { icon: '⚡', text: 'Offline study mode' },
    { icon: '📊', text: 'Widget on home screen' },
    { icon: '🔒', text: 'Background tracking' },
];

export function AndroidWaitlistSection() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setStatus('loading');
        setErrorMsg('');

        try {
            const res = await apiFetch('/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to join waitlist');
            }

            setStatus('success');
            setEmail('');
        } catch (err: any) {
            setErrorMsg(err.message || 'Something went wrong');
            setStatus('error');
        }
    };

    return (
        <section
            id="android-waitlist"
            className="relative z-10 py-24 overflow-hidden bg-gradient-to-b from-background to-emerald-950/10"
        >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[100px]" />
            </div>

            <div className="container mx-auto px-6 max-w-4xl relative">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex justify-center mb-6"
                >
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                        <Smartphone className="h-3.5 w-3.5" />
                        Android App — Coming Soon
                    </span>
                </motion.div>

                {/* Headline */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="text-center mb-4"
                >
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
                        Study Buddy in your pocket
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                        The native Android app is almost ready. Be first in line — get early access and exclusive features before public launch.
                    </p>
                </motion.div>

                {/* Perks */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-wrap justify-center gap-3 mb-10"
                >
                    {perks.map((p, i) => (
                        <motion.span
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-muted/60 border border-border text-foreground"
                        >
                            <span>{p.icon}</span>
                            {p.text}
                        </motion.span>
                    ))}
                </motion.div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                    className="max-w-md mx-auto"
                >
                    <AnimatePresence mode="wait">
                        {status === 'success' ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-3 py-8 text-center"
                            >
                                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                                </div>
                                <p className="font-bold text-lg text-foreground">You're on the list! 🎉</p>
                                <p className="text-sm text-muted-foreground">
                                    We'll send you the APK download link the moment it's ready.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.form
                                key="form"
                                onSubmit={handleSubmit}
                                className="flex flex-col sm:flex-row gap-2"
                            >
                                <div className="flex-1 relative">
                                    <Bell className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        disabled={status === 'loading'}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 transition"
                                    />
                                </div>
                                <motion.button
                                    type="submit"
                                    disabled={status === 'loading'}
                                    whileTap={{ scale: 0.96 }}
                                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-60 whitespace-nowrap"
                                >
                                    {status === 'loading' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            Notify me
                                            <ChevronRight className="h-4 w-4" />
                                        </>
                                    )}
                                </motion.button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {status === 'error' && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-sm text-destructive mt-2"
                        >
                            {errorMsg}
                        </motion.p>
                    )}

                    {status !== 'success' && (
                        <p className="text-center text-xs text-muted-foreground mt-3">
                            No spam, ever. Just one email when the app drops.
                        </p>
                    )}
                </motion.div>
            </div>
        </section>
    );
}

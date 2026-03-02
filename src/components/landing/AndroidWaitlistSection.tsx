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
        <section className="relative z-10 py-12 bg-transparent">
            <div className="container mx-auto">
                <motion.div 
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    className="max-w-4xl mx-auto bg-white/40 dark:bg-black/40 backdrop-blur-xl border-2 border-black/10 dark:border-white/10 shadow-xl rounded-[2.5rem] p-8 md:p-16 relative overflow-hidden"
                >
                    {/* Background glow inside card */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-[80px]" />
                    </div>

                    <div className="relative z-10">
                        {/* Badge */}
                        <div className="flex justify-center mb-8">
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <Smartphone className="h-4 w-4" />
                                Android App — Coming Soon
                            </span>
                        </div>

                        {/* Headline */}
                        <div className="text-center mb-10">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-black dark:text-white leading-tight">
                                Study Buddy in your pocket
                            </h2>
                            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl mx-auto font-medium">
                                The native Android app is almost ready. Be first in line — get early access and exclusive features before public launch.
                            </p>
                        </div>

                        {/* Perks */}
                        <div className="flex flex-wrap justify-center gap-3 mb-12">
                            {perks.map((p, i) => (
                                <span
                                    key={i}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-white/60 dark:bg-white/10 border border-black/10 dark:border-white/10 text-black dark:text-white shadow-sm"
                                >
                                    <span>{p.icon}</span>
                                    {p.text}
                                </span>
                            ))}
                        </div>

                        {/* Form */}
                        <div className="max-w-md mx-auto">
                            <AnimatePresence mode="wait">
                                {status === 'success' ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center gap-4 py-8 text-center bg-white/50 dark:bg-black/50 rounded-3xl border border-emerald-500/20"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-xl text-black dark:text-white">You're on the list! 🎉</p>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                                We'll send you the APK download link the moment it's ready.
                                            </p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.form
                                        key="form"
                                        onSubmit={handleSubmit}
                                        className="flex flex-col sm:flex-row gap-3"
                                    >
                                        <div className="flex-1 relative">
                                            <Bell className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Enter your email"
                                                disabled={status === 'loading'}
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/50 text-base font-medium text-black dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 transition-all shadow-sm"
                                            />
                                        </div>
                                        <motion.button
                                            type="submit"
                                            disabled={status === 'loading'}
                                            whileTap={{ scale: 0.96 }}
                                            className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] transition-all disabled:opacity-60 whitespace-nowrap"
                                        >
                                            {status === 'loading' ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Notify me
                                                    <ChevronRight className="h-5 w-5" />
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
                                    className="text-center text-sm text-red-500 font-bold mt-4"
                                >
                                    {errorMsg}
                                </motion.p>
                            )}

                            {status !== 'success' && (
                                <p className="text-center text-sm text-zinc-500 font-medium mt-4">
                                    No spam, ever. Just one email when the app drops.
                                </p>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

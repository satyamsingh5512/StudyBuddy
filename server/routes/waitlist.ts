import { Router } from 'express';
import { db } from '../lib/db.js';
import { sendWaitlistConfirmationEmail } from '../lib/email.js';
import { isTempEmail, getTempEmailError } from '../lib/emailValidator.js';

const router = Router();

// Join the waitlist for the Android app
router.post('/', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Block disposable emails
        if (isTempEmail(email)) {
            return res.status(400).json({ error: getTempEmailError() });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if already on waitlist
        const existing = await db.waitlist.findFirst({ where: { email: normalizedEmail } });
        if (existing) {
            return res.status(409).json({ error: 'You\'re already on the waitlist! We\'ll notify you when the app is ready.' });
        }

        // Add to waitlist
        await db.waitlist.create({
            data: { email: normalizedEmail },
        });

        console.log('✅ Waitlist signup:', normalizedEmail);

        // Send confirmation email (don't block on it)
        sendWaitlistConfirmationEmail(normalizedEmail).catch(err => {
            console.error('❌ Failed to send waitlist confirmation email:', err.message);
        });

        res.json({
            message: 'You\'re on the waitlist! Check your email for confirmation.',
        });
    } catch (error) {
        console.error('Waitlist signup error:', error);
        res.status(500).json({ error: 'Failed to join waitlist. Please try again.' });
    }
});

export default router;

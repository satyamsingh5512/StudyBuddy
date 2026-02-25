import { Router } from 'express';
import { collections } from '../db/collections.js';
import { sendWaitlistConfirmationEmail } from '../lib/email.js';
import { isTempEmail, getTempEmailError } from '../lib/emailValidator.js';

const router = Router();

router.post('/', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (isTempEmail(email)) {
            return res.status(400).json({ error: getTempEmailError() });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existing = await (await collections.waitlist).findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({ error: "You're already on the waitlist! We'll notify you when the app is ready." });
        }

        await (await collections.waitlist).insertOne({
            email: normalizedEmail,
            createdAt: new Date()
        });

        console.log('✅ Waitlist signup:', normalizedEmail);

        sendWaitlistConfirmationEmail(normalizedEmail).catch(err => {
            console.error('❌ Failed to send waitlist confirmation email:', err.message);
        });

        res.json({
            message: "You're on the waitlist! Check your email for confirmation.",
        });
    } catch (error) {
        console.error('Waitlist signup error:', error);
        res.status(500).json({ error: 'Failed to join waitlist. Please try again.' });
    }
});

export default router;

/**
 * Vercel Serverless Function: Signup
 * POST /api/auth/signup
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { getMongoDb } from '../../server/lib/mongodb';
import { db } from '../../server/lib/db';
import { sendOTPEmail } from '../../server/lib/email';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Connect to MongoDB
    await getMongoDb();

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        emailVerified: false,
        onboarded: false,
        otp,
        otpExpiry,
        role: 'USER',
        tier: 'FREE',
        streak: 0,
        totalPoints: 0,
        weeklyGoal: 0,
        showProfile: true,
      },
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, name);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Continue anyway - user can resend OTP
    }

    return res.status(201).json({
      message: 'Account created! Please check your email for OTP.',
      userId: user.id,
      email: user.email,
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

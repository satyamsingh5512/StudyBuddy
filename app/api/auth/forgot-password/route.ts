import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail } = await request.json();

    if (!rawEmail) {
      return NextResponse.json({ message: 'Email is required', error: 'Email is required' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const users = db.collection('users');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const result = await users.updateOne(
      { email },
      { $set: { resetToken: otp, resetTokenExpiry: otpExpiry } }
    );

    if (result.matchedCount > 0) {
      console.log(`Reset OTP for ${email}: ${otp}`);
      return NextResponse.json({ message: 'Password reset code sent' });
    } else {
      return NextResponse.json({ message: 'User not found', error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: 'Internal server error', error: 'Internal server error' }, { status: 500 });
  }
}

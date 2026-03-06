import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import { createJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, otp } = await request.json();

    if (!rawEmail || !otp) {
      return NextResponse.json({ message: 'Email and OTP are required', error: 'Email and OTP are required' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const users = db.collection('users');

    const user = await users.findOne({ email });

    if (!user) {
      return NextResponse.json({ message: 'User not found', error: 'User not found' }, { status: 404 });
    }

    if (user.verificationOtp !== otp) {
      return NextResponse.json({ message: 'Invalid OTP', error: 'Invalid OTP' }, { status: 400 });
    }

    if (user.otpExpiry && new Date() > new Date(user.otpExpiry)) {
      return NextResponse.json({ message: 'OTP expired', error: 'OTP expired' }, { status: 400 });
    }

    await users.updateOne(
      { email },
      { $set: { emailVerified: true, verificationOtp: null, otpExpiry: null } }
    );

    const userId = user._id.toString();
    const token = await createJWT(userId, user.email, user.role);

    const isProd = process.env.NODE_ENV === 'production';
    cookies().set({
      name: 'connect.sid',
      value: token,
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const updatedUser: any = { ...user, emailVerified: true, _id: userId, id: userId };
    delete updatedUser.password;
    delete updatedUser.verificationOtp;
    delete updatedUser.resetToken;

    return NextResponse.json({
      message: 'Email verified successfully',
      user: updatedUser,
      token,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ message: 'Internal server error', error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, otp, password } = await request.json();

    if (!rawEmail || !otp || !password) {
      return NextResponse.json({ message: 'Missing fields', error: 'Missing fields' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const users = db.collection('users');

    const user = await users.findOne({ email });

    if (!user) {
      return NextResponse.json({ message: 'User not found', error: 'User not found' }, { status: 404 });
    }

    if (user.resetToken !== otp) {
      return NextResponse.json({ message: 'Invalid reset code', error: 'Invalid reset code' }, { status: 400 });
    }

    if (user.resetTokenExpiry && new Date() > new Date(user.resetTokenExpiry)) {
      return NextResponse.json({ message: 'Reset code expired', error: 'Reset code expired' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await users.updateOne(
      { email },
      { $set: { password: hashedPassword, resetToken: null, resetTokenExpiry: null } }
    );

    return NextResponse.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Internal server error', error: 'Internal server error' }, { status: 500 });
  }
}

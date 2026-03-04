import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, password } = await request.json();

    if (!rawEmail || !password) {
      return NextResponse.json(
        { message: 'Email and password are required', error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password', error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return NextResponse.json(
          { message: 'Invalid email or password', error: 'Invalid email or password' },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { message: 'Invalid email or password', error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { message: 'Please verify your email first', error: 'Please verify your email first' },
        { status: 403 }
      );
    }

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

    const safeUser = { ...user, _id: userId, id: userId };
    delete safeUser.password;
    delete safeUser.verificationOtp;
    delete safeUser.resetToken;

    return NextResponse.json({ message: 'Login successful', user: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error', error: 'Internal server error' }, { status: 500 });
  }
}

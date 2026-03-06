import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);

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
    const user = await db.collection('users').findOne({
      email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password', error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const storedPassword = typeof user.password === 'string'
      ? user.password
      : (typeof user.passwordHash === 'string' ? user.passwordHash : null);

    if (!storedPassword) {
      return NextResponse.json(
        { message: 'Invalid email or password', error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    let isValid = false;

    if (isBcryptHash(storedPassword)) {
      isValid = await bcrypt.compare(password, storedPassword);
    } else {
      isValid = password === storedPassword;
      if (isValid) {
        const upgradedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').updateOne(
          { _id: user._id },
          {
            $set: {
              password: upgradedPassword,
              updatedAt: new Date(),
            },
            $unset: {
              passwordHash: '',
            },
          }
        );
        user.password = upgradedPassword;
      }
    }

    if (!isValid) {
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

    const {
      password: _password,
      verificationOtp: _verificationOtp,
      resetToken: _resetToken,
      ...safeUserBase
    } = user as Record<string, unknown>;
    const safeUser = { ...safeUserBase, _id: userId, id: userId };

    return NextResponse.json({ message: 'Login successful', user: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error', error: 'Internal server error' }, { status: 500 });
  }
}

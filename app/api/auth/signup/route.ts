import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, password, name } = await request.json();
    
    if (!rawEmail || !password || !name) {
      return NextResponse.json({ error: 'Missing fields', message: 'Missing fields' }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const users = db.collection('users');

    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists', message: 'Email already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `${baseUsername}_${uuidv4().substring(0, 8)}`;

    const newUser = {
      email,
      password: hashedPassword,
      name,
      username,
      role: 'user',
      emailVerified: false,
      verificationOtp: otp,
      otpExpiry,
      onboardingDone: false,
      totalPoints: 0,
      totalStudyMinutes: 0,
      streak: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActive: new Date(),
      showProfile: true,
    };

    const result = await users.insertOne(newUser);
    const user = { ...newUser, _id: result.insertedId.toString(), id: result.insertedId.toString() };

    console.log(`Verification OTP for ${email}: ${otp}`);

    return NextResponse.json(
      { message: 'Signup successful. Please verify your email.', user },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Database error', message: 'Database error' }, { status: 500 });
  }
}

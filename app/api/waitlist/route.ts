import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (!payload.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const email = payload.email.toLowerCase();
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('waitlist');

    const existing = await coll.findOne({ email });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Already on waitlist' });
    }

    await coll.insertOne({
      email,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

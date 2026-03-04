import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    const username = payload.username;

    if (!username || username.length < 3) {
      return NextResponse.json({ available: false, message: 'Username too short' });
    }

    if (username === user.username) {
      return NextResponse.json({ available: true });
    }

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');

    const existing = await usersColl.findOne({ username });

    if (existing) {
      return NextResponse.json({ available: false, message: 'Username taken' });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

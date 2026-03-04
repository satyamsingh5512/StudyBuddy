import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    if (typeof payload.duration !== 'number') {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const userId = new ObjectId(user._id);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const timerColl = db.collection('timer_sessions');
    const usersColl = db.collection('users');

    const newSession = {
      userId,
      duration: payload.duration,
      subject: payload.subject || null,
      createdAt: new Date(),
    };

    const result = await timerColl.insertOne(newSession);

    await usersColl.updateOne(
      { _id: userId },
      { 
        $inc: { 
          totalStudyMinutes: payload.duration,
          totalPoints: Math.floor(payload.duration / 10)
        },
        $set: { lastActive: new Date() }
      }
    );

    return NextResponse.json({
      ...newSession,
      userId: undefined,
      id: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Save session error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('schedules');

    const schedules = await coll.find({ userId: new ObjectId(user._id) }).toArray();

    const response = schedules.map(s => ({
      ...s,
      _id: undefined,
      userId: undefined,
      id: s._id.toString()
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get schedules error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    const userId = new ObjectId(user._id);

    const now = new Date();
    const newSchedule = {
      userId,
      date: new Date(payload.date),
      startTime: payload.startTime,
      endTime: payload.endTime,
      title: payload.title,
      subject: payload.subject,
      notes: payload.notes,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('schedules');

    const result = await coll.insertOne(newSchedule);

    return NextResponse.json({
      ...newSchedule,
      userId: undefined,
      id: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

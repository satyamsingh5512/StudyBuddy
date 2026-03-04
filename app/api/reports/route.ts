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
    const reportsColl = db.collection('daily_reports');

    const reports = await reportsColl
      .find({ userId: new ObjectId(user._id) })
      .sort({ date: -1 })
      .limit(30)
      .toArray();

    const response = reports.map(r => ({
      ...r,
      _id: undefined,
      userId: undefined,
      id: r._id.toString()
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    const userId = new ObjectId(user._id);

    const newReport = {
      userId,
      date: new Date(payload.date),
      studyHours: payload.studyHours,
      hoursLogged: payload.hoursLogged,
      pointsEarned: payload.pointsEarned,
      completionPct: payload.completionPct,
      notes: payload.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const reportsColl = db.collection('daily_reports');

    const result = await reportsColl.insertOne(newReport);

    return NextResponse.json({
      ...newReport,
      userId: undefined,
      id: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

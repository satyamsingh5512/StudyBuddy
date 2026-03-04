import { NextResponse } from 'next/server';
import clientPromise from '@/lib/db';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('notices');

    const notices = await coll.find({}).sort({ createdAt: -1 }).toArray();

    const response = notices.map(n => ({
      ...n,
      _id: undefined,
      id: n._id.toString()
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get notices error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

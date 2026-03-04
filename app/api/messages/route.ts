import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    if (!payload.receiverId) {
      return NextResponse.json({ error: 'Receiver ID is required' }, { status: 400 });
    }

    const senderId = new ObjectId(user._id);
    const receiverId = new ObjectId(payload.receiverId);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('direct_messages');

    const now = new Date();
    const newMsg = {
      senderId,
      receiverId,
      content: payload.content || null,
      message: payload.content || null,
      fileUrl: payload.fileUrl || null,
      read: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await coll.insertOne(newMsg);

    return NextResponse.json({
      ...newMsg,
      id: result.insertedId.toString(),
      senderId: senderId.toString(),
      receiverId: receiverId.toString(),
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

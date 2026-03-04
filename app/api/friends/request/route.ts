import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    if (!payload.username) {
      return NextResponse.json({ error: 'Username is required', message: 'Username is required' }, { status: 400 });
    }

    const userId = new ObjectId(user._id);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');
    const friendsColl = db.collection('friendships');

    const recipient = await usersColl.findOne({ username: payload.username });
    if (!recipient) {
      return NextResponse.json({ error: 'User not found', message: 'User not found' }, { status: 404 });
    }

    if (userId.toString() === recipient._id.toString()) {
      return NextResponse.json({ error: 'Cannot add yourself', message: 'Cannot add yourself' }, { status: 400 });
    }

    const existing = await friendsColl.findOne({
      $or: [
        { requesterId: userId, recipientId: recipient._id },
        { requesterId: recipient._id, recipientId: userId }
      ]
    });

    if (existing) {
      return NextResponse.json({ error: 'Friendship or request already exists', message: 'Friendship or request already exists' }, { status: 400 });
    }

    const now = new Date();
    await friendsColl.insertOne({
      requesterId: userId,
      recipientId: recipient._id,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

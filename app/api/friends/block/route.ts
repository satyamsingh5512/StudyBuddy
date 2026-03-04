import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    if (!payload.userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const blockerId = new ObjectId(user._id);
    const blockedId = new ObjectId(payload.userId);

    if (blockerId.toString() === blockedId.toString()) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const blocksColl = db.collection('blocks');
    const friendsColl = db.collection('friendships');

    await blocksColl.updateOne(
      { blockerId, blockedId },
      { $set: { blockerId, blockedId, createdAt: new Date() } },
      { upsert: true }
    );

    await friendsColl.deleteMany({
      $or: [
        { requesterId: blockerId, recipientId: blockedId },
        { requesterId: blockedId, recipientId: blockerId }
      ]
    });

    return NextResponse.json({ success: true, message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

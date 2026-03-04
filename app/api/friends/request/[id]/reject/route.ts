import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const friendshipId = new ObjectId(params.id);
    const userId = new ObjectId(user._id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const friendsColl = db.collection('friendships');

    const result = await friendsColl.updateOne(
      { _id: friendshipId, recipientId: userId, status: 'PENDING' },
      { $set: { status: 'REJECTED', updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Friend request not found or not pending' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject friend request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

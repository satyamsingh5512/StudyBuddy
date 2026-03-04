import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const friendshipId = new ObjectId(params.id);
    const userId = new ObjectId(user._id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const friendsColl = db.collection('friendships');

    await friendsColl.deleteOne({
      _id: friendshipId,
      $or: [
        { requesterId: userId },
        { recipientId: userId }
      ]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete friendship error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

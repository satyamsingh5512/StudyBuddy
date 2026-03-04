import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = new ObjectId(user._id);
    const otherUserId = new ObjectId(params.userId);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('direct_messages');

    const filter = {
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    };

    const messages = await coll.find(filter).sort({ createdAt: 1 }).toArray();

    // Mark messages as read
    await coll.updateMany(
      { senderId: otherUserId, receiverId: currentUserId, read: false },
      { $set: { read: true } }
    );

    const response = messages.map(m => ({
      ...m,
      _id: undefined,
      id: m._id.toString(),
      senderId: m.senderId.toString(),
      receiverId: m.receiverId.toString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

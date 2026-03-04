import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = new ObjectId(user._id);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const friendsColl = db.collection('friendships');
    const usersColl = db.collection('users');

    const requests = await friendsColl.find({
      recipientId: userId,
      status: 'PENDING'
    }).toArray();

    const requesterIds = requests.map(r => r.requesterId);
    const requesters = await usersColl.find({ _id: { $in: requesterIds } }).toArray();

    const response = requests.map(r => {
      const requester = requesters.find(u => u._id.toString() === r.requesterId.toString());
      return {
        ...r,
        _id: undefined,
        id: r._id.toString(),
        requesterId: r.requesterId.toString(),
        recipientId: r.recipientId.toString(),
        requester: requester ? {
          id: requester._id.toString(),
          name: requester.name,
          username: requester.username,
          avatar: requester.avatar,
        } : null
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get friend requests error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

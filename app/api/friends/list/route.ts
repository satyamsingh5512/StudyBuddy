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

    const friendships = await friendsColl.find({
      $or: [
        { requesterId: userId },
        { recipientId: userId }
      ],
      status: 'ACCEPTED'
    }).toArray();

    // Fetch user details for each friend
    const friendIds = friendships.map(f => 
      f.requesterId.toString() === userId.toString() ? f.recipientId : f.requesterId
    );

    const friendsData = await usersColl.find({ _id: { $in: friendIds } }).toArray();

    const response = friendships.map(f => {
      const friendIdStr = f.requesterId.toString() === userId.toString() ? f.recipientId.toString() : f.requesterId.toString();
      const friendData = friendsData.find(u => u._id.toString() === friendIdStr);
      
      return {
        ...f,
        _id: undefined,
        id: f._id.toString(),
        requesterId: f.requesterId.toString(),
        recipientId: f.recipientId.toString(),
        friend: friendData ? {
          id: friendData._id.toString(),
          name: friendData.name,
          username: friendData.username,
          avatar: friendData.avatar,
          totalPoints: friendData.totalPoints,
        } : null
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get friends list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

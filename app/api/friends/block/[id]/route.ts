import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const blockerId = new ObjectId(user._id);
    const blockedId = new ObjectId(params.id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const blocksColl = db.collection('blocks');

    await blocksColl.deleteOne({ blockerId, blockedId });

    return NextResponse.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

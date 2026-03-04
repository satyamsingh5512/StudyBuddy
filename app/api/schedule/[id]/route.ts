import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const itemId = new ObjectId(params.id);
    const userId = new ObjectId(user._id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('schedules');

    const payload = await request.json();
    const updateDoc: any = {};

    if (payload.title !== undefined) updateDoc.title = payload.title;
    if (payload.startTime !== undefined) updateDoc.startTime = payload.startTime;
    if (payload.endTime !== undefined) updateDoc.endTime = payload.endTime;
    if (payload.completed !== undefined) updateDoc.completed = payload.completed;

    updateDoc.updatedAt = new Date();

    if (Object.keys(updateDoc).length === 1) { // only updatedAt
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    await coll.updateOne({ _id: itemId, userId }, { $set: updateDoc });

    const updated = await coll.findOne({ _id: itemId, userId });
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      _id: undefined,
      userId: undefined,
      id: updated._id.toString()
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const itemId = new ObjectId(params.id);
    const userId = new ObjectId(user._id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('schedules');

    await coll.deleteOne({ _id: itemId, userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

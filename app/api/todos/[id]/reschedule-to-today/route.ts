import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

function getStartOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const todoId = new ObjectId(params.id);
    const userId = new ObjectId(user._id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const todosColl = db.collection('todos');

    const existingTodo = await todosColl.findOne({ _id: todoId, userId });
    if (!existingTodo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    if (existingTodo.completed) {
      return NextResponse.json({ error: 'Cannot reschedule a completed task' }, { status: 400 });
    }

    const today = getStartOfDay(new Date());

    const updateDoc: any = {
      scheduledDate: today,
      rescheduledCount: (existingTodo.rescheduledCount || 0) + 1,
      updatedAt: new Date(),
    };

    if (!existingTodo.rescheduledCount || existingTodo.rescheduledCount === 0) {
      updateDoc.originalScheduledDate = existingTodo.scheduledDate;
    }

    await todosColl.updateOne({ _id: todoId, userId }, { $set: updateDoc });
    const updatedTodo = await todosColl.findOne({ _id: todoId, userId });

    const pointsToCredit = Math.floor(2.0 / 2.0); // 1 point

    const usersColl = db.collection('users');
    await usersColl.updateOne(
      { _id: userId },
      { 
        $inc: { totalPoints: pointsToCredit },
        $set: { lastActive: new Date() }
      }
    );

    return NextResponse.json({
      ...updatedTodo,
      _id: undefined,
      userId: undefined,
      id: updatedTodo!._id.toString(),
      isOverdue: false,
      pointsCredited: pointsToCredit,
    });
  } catch (error) {
    console.error('Reschedule to today error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

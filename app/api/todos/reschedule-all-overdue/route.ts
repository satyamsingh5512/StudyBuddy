import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

function getStartOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isOverdue(scheduledDate: Date) {
  const today = getStartOfDay(new Date());
  const scheduled = getStartOfDay(new Date(scheduledDate));
  return scheduled < today;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json().catch(() => ({}));
    const scheduleTo = payload.targetDate ? getStartOfDay(new Date(payload.targetDate)) : getStartOfDay(new Date());
    const today = getStartOfDay(new Date());

    if (scheduleTo.getTime() < today.getTime()) {
      return NextResponse.json({ error: 'Cannot schedule tasks in the past' }, { status: 400 });
    }

    const userId = new ObjectId(user._id);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const todosColl = db.collection('todos');

    const incompleteTodos = await todosColl.find({ userId, completed: false }).toArray();
    
    const overdueIds = incompleteTodos
      .filter((todo) => isOverdue(todo.scheduledDate))
      .map((todo) => todo._id);

    if (overdueIds.length === 0) {
      return NextResponse.json({ message: 'No overdue tasks to reschedule', count: 0 });
    }

    const result = await todosColl.updateMany(
      { _id: { $in: overdueIds } },
      { 
        $set: { scheduledDate: scheduleTo, updatedAt: new Date() },
        $inc: { rescheduledCount: 1 }
      }
    );

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount} task(s) rescheduled`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error('Reschedule all overdue error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

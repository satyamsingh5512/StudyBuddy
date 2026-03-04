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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const payload = await request.json();
    const updateDoc: any = {};

    if (payload.completed !== undefined) updateDoc.completed = payload.completed;
    if (payload.title !== undefined) updateDoc.title = payload.title;
    if (payload.subject !== undefined) updateDoc.subject = payload.subject;
    if (payload.difficulty !== undefined) updateDoc.difficulty = payload.difficulty;
    if (payload.questionsTarget !== undefined) updateDoc.questionsTarget = payload.questionsTarget;
    if (payload.questionsCompleted !== undefined) updateDoc.questionsCompleted = payload.questionsCompleted;

    updateDoc.updatedAt = new Date();

    if (Object.keys(updateDoc).length === 0) {
      return NextResponse.json({ error: 'No valid update fields' }, { status: 400 });
    }

    await todosColl.updateOne({ _id: todoId, userId }, { $set: updateDoc });
    const updatedTodo = await todosColl.findOne({ _id: todoId, userId });

    let pointsToAward = 0;

    if (payload.completed === true && !existingTodo.completed) {
      pointsToAward = 0.5;
      const today = getStartOfDay(new Date());
      const scheduledDate = getStartOfDay(new Date(existingTodo.scheduledDate));
      const originalScheduledDate = existingTodo.originalScheduledDate ? getStartOfDay(new Date(existingTodo.originalScheduledDate)) : null;

      if (scheduledDate.getTime() === today.getTime()) {
        if (!originalScheduledDate || originalScheduledDate.getTime() === today.getTime()) {
          pointsToAward = 1.0;
        } else {
          pointsToAward = 0.5;
        }
      } else if (scheduledDate.getTime() < today.getTime()) {
        pointsToAward = 0.5;
      }

      const pointsToIncrement = pointsToAward === 0.5 ? 1 : Math.round(pointsToAward);

      if (pointsToIncrement > 0) {
        const usersColl = db.collection('users');
        await usersColl.updateOne(
          { _id: userId },
          { 
            $inc: { totalPoints: pointsToIncrement },
            $set: { lastActive: new Date() }
          }
        );
      }
    }

    const isOverdueFlag = !updatedTodo!.completed && isOverdue(updatedTodo!.scheduledDate);

    return NextResponse.json({
      ...updatedTodo,
      _id: undefined,
      userId: undefined,
      id: updatedTodo!._id.toString(),
      isOverdue: isOverdueFlag,
      pointsAwarded: payload.completed === true && !existingTodo.completed ? pointsToAward : undefined,
    });
  } catch (error) {
    console.error('Update todo error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const todoId = new ObjectId(params.id);
    const userId = new ObjectId(user._id);

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const todosColl = db.collection('todos');

    await todosColl.deleteOne({ _id: todoId, userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete todo error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

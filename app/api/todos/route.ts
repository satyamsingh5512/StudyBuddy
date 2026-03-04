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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const todosColl = db.collection('todos');

    const todos = await todosColl.find({ userId: new ObjectId(user._id) }).toArray();

    const response = todos.map((todo) => {
      const isOverdueFlag = !todo.completed && isOverdue(todo.scheduledDate);
      return {
        ...todo,
        _id: undefined,
        userId: undefined,
        id: todo._id.toString(),
        isOverdue: isOverdueFlag,
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get todos error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    const scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : getStartOfDay(new Date());

    const newTodo = {
      userId: new ObjectId(user._id),
      title: payload.title,
      subject: payload.subject,
      difficulty: payload.difficulty,
      questionsTarget: payload.questionsTarget,
      questionsCompleted: 0,
      completed: false,
      scheduledDate,
      rescheduledCount: 0,
      originalScheduledDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const todosColl = db.collection('todos');

    const result = await todosColl.insertOne(newTodo);

    return NextResponse.json({
      ...newTodo,
      userId: undefined,
      id: result.insertedId.toString(),
      isOverdue: false,
    }, { status: 201 });
  } catch (error) {
    console.error('Create todo error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

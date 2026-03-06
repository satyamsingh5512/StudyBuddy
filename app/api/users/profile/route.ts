import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const safeUser: any = { ...user };
    delete safeUser.password;
    delete safeUser.verificationOtp;
    delete safeUser.resetToken;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    const updateDoc: any = {};

    if (payload.name !== undefined) updateDoc.name = payload.name;
    if (payload.examGoal !== undefined) updateDoc.examGoal = payload.examGoal;
    if (payload.studentClass !== undefined) updateDoc.studentClass = payload.studentClass;
    if (payload.batch !== undefined) updateDoc.batch = payload.batch;
    if (payload.syllabus !== undefined) updateDoc.syllabus = payload.syllabus;
    if (payload.subjects !== undefined) updateDoc.subjects = payload.subjects;

    if (Object.keys(updateDoc).length === 0) {
      const safeUser: any = { ...user };
      delete safeUser.password;
      return NextResponse.json(safeUser);
    }

    updateDoc.updatedAt = new Date();

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');

    await usersColl.updateOne(
      { _id: new ObjectId(user._id) },
      { $set: updateDoc }
    );

    const updatedUser = await usersColl.findOne({ _id: new ObjectId(user._id) });
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const safeUser: any = { ...updatedUser, _id: updatedUser._id.toString(), id: updatedUser._id.toString() };
    delete safeUser.password;
    delete safeUser.verificationOtp;
    delete safeUser.resetToken;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

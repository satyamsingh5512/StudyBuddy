import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await request.json();
    const updateDoc: any = {
      onboardingDone: true,
      updatedAt: new Date()
    };

    if (payload.username !== undefined) updateDoc.username = payload.username;
    if (payload.avatarType !== undefined) updateDoc.avatarType = payload.avatarType;
    if (payload.avatar !== undefined) updateDoc.avatar = payload.avatar;
    if (payload.examGoal !== undefined) updateDoc.examGoal = payload.examGoal;
    if (payload.studentClass !== undefined) updateDoc.studentClass = payload.studentClass;
    if (payload.batch !== undefined) updateDoc.batch = payload.batch;
    if (payload.examAttempt !== undefined) updateDoc.examAttempt = payload.examAttempt;
    if (payload.examDate !== undefined) updateDoc.examDate = payload.examDate;

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

    const safeUser = { ...updatedUser, _id: updatedUser._id.toString(), id: updatedUser._id.toString() };
    delete safeUser.password;
    delete safeUser.verificationOtp;
    delete safeUser.resetToken;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Onboarding update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

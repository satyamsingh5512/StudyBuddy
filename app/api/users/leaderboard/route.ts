import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');

    const topUsers = await usersColl
      .find({})
      .sort({ totalPoints: -1 })
      .limit(50)
      .toArray();

    const response = topUsers.map(u => {
      const safeUser = { ...u, _id: undefined, id: u._id.toString() };
      delete safeUser.password;
      delete safeUser.verificationOtp;
      delete safeUser.resetToken;
      return safeUser;
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');

    const totalUsers = await usersColl.countDocuments({});
    const verifiedUsers = await usersColl.countDocuments({ emailVerified: true });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const activeToday = await usersColl.countDocuments({
      lastActive: { $gte: today }
    });

    const tempDomains = ['tempmail', '10minutemail', 'guerrillamail'];
    const users = await usersColl.find({}).toArray();
    
    let tempEmailUsers = 0;
    users.forEach(u => {
      const domain = u.email.split('@')[1] || '';
      if (tempDomains.some(d => domain.includes(d))) {
        tempEmailUsers++;
      }
    });

    return NextResponse.json({
      totalUsers,
      verifiedUsers,
      activeToday,
      tempEmailUsers,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

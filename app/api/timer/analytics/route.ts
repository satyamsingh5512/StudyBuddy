import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const userId = new ObjectId(user._id);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const timerColl = db.collection('timer_sessions');
    const reportsColl = db.collection('daily_reports');

    const sessions = await timerColl.find({
      userId,
      createdAt: { $gte: startDate }
    }).toArray();

    const reports = await reportsColl.find({
      userId,
      date: { $gte: startDate }
    }).toArray();

    const analytics: any[] = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0];

      const daySessions = sessions.filter(s => {
        const sDate = new Date(s.createdAt);
        return sDate.toISOString().split('T')[0] === dateStr;
      });

      const studyHours = daySessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 60.0;

      const report = reports.find(r => {
        const rDate = new Date(r.date);
        return rDate.toISOString().split('T')[0] === dateStr;
      });

      const sessionTypes: Record<string, number> = {};
      daySessions.forEach(s => {
        const type = s.subject || 'General';
        sessionTypes[type] = (sessionTypes[type] || 0) + 1;
      });

      const tasksCompleted = report?.pointsEarned || 0;
      const understanding = 0;

      analytics.push({
        date: currentDate.toISOString(),
        studyHours,
        tasksCompleted,
        understanding,
        sessions: daySessions.length,
        sessionTypes,
      });
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

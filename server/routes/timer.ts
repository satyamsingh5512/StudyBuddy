import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.post('/session', isAuthenticated, async (req, res) => {
  try {
    const { minutes, sessionType = 'pomodoro' } = req.body;

    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Invalid session duration' });
    }

    const userId = req.user!._id;

    const currentUser = await (await collections.users).findOne({ _id: userId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await (await collections.timerSessions).insertOne({
      userId,
      duration: minutes,
      sessionType,
      startedAt: new Date(Date.now() - minutes * 60 * 1000),
      completedAt: new Date(),
      createdAt: new Date()
    } as any);

    await (await collections.users).updateOne(
      { _id: userId },
      {
        $inc: {
          totalStudyMinutes: minutes,
          totalPoints: minutes
        },
        $set: {
          lastActive: new Date()
        }
      }
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const existingReport = await (await collections.dailyReports).findOne({
      userId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (existingReport) {
      await (await collections.dailyReports).updateOne(
        { _id: existingReport._id },
        {
          $inc: { studyHours: minutes / 60 },
          $set: { updatedAt: new Date() }
        }
      );
    } else {
      await (await collections.dailyReports).insertOne({
        userId,
        date: today,
        tasksPlanned: 0,
        tasksCompleted: 0,
        studyHours: minutes / 60,
        understanding: 5,
        completionPct: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);
    }

    res.json({
      success: true,
      points: minutes,
      message: `+${minutes} points earned!`
    });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ error: 'Failed to save study session' });
  }
});

router.get('/analytics', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!._id;
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    startDate.setHours(0, 0, 0, 0);

    const sessions = await (await collections.timerSessions).find(
      { userId, completedAt: { $gte: startDate } },
      { sort: { completedAt: 1 } }
    ).toArray();

    const reports = await (await collections.dailyReports).find(
      { userId, date: { $gte: startDate } },
      { sort: { date: 1 } }
    ).toArray();

    const analytics = [];
    for (let i = 0; i < parseInt(days as string); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const daySessions = sessions.filter(s =>
        new Date((s as any).completedAt).toDateString() === date.toDateString()
      );
      const studyHours = daySessions.reduce((sum, s) => sum + s.duration, 0) / 60;

      const report = reports.find(r =>
        new Date(r.date).toDateString() === date.toDateString()
      );

      analytics.push({
        date: dateStr,
        studyHours: studyHours,
        tasksCompleted: (report as any)?.tasksCompleted || 0,
        understanding: (report as any)?.understanding || 0,
        sessions: daySessions.length,
        sessionTypes: daySessions.reduce((acc, s) => {
          const type = (s as any).sessionType || 'pomodoro';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
    }

    res.json(analytics);
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;

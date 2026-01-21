import { Router } from 'express';

import { isAuthenticated } from '../middleware/auth';

import { prisma } from '../lib/prisma';
const router = Router();

// Save study session
router.post('/session', isAuthenticated, async (req: any, res: any) => {
  try {
    const { minutes, sessionType = 'pomodoro' } = req.body;
    
    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Invalid session duration' });
    }

    // Immediate response with optimistic update
    res.json({ 
      success: true, 
      points: minutes,
      message: `+${minutes} points earned!`
    });

    // Background processing
    setImmediate(async () => {
      try {
        // Create timer session record
        await prisma.timerSession.create({
          data: {
            userId: req.user.id,
            duration: minutes,
            sessionType,
            startedAt: new Date(Date.now() - minutes * 60 * 1000),
            completedAt: new Date(),
          },
        });

        // Update user stats
        await prisma.user.update({
          where: { id: req.user.id },
          data: {
            totalStudyMinutes: { increment: minutes },
            totalPoints: { increment: minutes },
            lastActive: new Date(),
          },
        });

        // Create daily report entry or update existing
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingReport = await prisma.dailyReport.findFirst({
          where: {
            userId: req.user.id,
            date: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (existingReport) {
          await prisma.dailyReport.update({
            where: { id: existingReport.id },
            data: {
              studyHours: { increment: minutes / 60 },
            },
          });
        } else {
          await prisma.dailyReport.create({
            data: {
              userId: req.user.id,
              date: today,
              tasksPlanned: 0,
              tasksCompleted: 0,
              studyHours: minutes / 60,
              understanding: 5,
              completionPct: 0,
            },
          });
        }
      } catch (error) {
        console.error('Background session save failed:', error);
      }
    });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ error: 'Failed to save study session' });
  }
});

// Get analytics data
router.get('/analytics', isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    // Get timer sessions for more accurate analytics
    const sessions = await prisma.timerSession.findMany({
      where: {
        userId,
        completedAt: { gte: startDate },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Get daily reports for task completion data
    const reports = await prisma.dailyReport.findMany({
      where: {
        userId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Fill in missing days with zero data
    const analytics = [];
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Calculate study hours from timer sessions
      const daySessions = sessions.filter(s => 
        s.completedAt.toDateString() === date.toDateString()
      );
      const studyHours = daySessions.reduce((sum, s) => sum + s.duration, 0) / 60;
      
      // Get tasks completed from reports
      const report = reports.find(r => 
        r.date.toDateString() === date.toDateString()
      );
      
      analytics.push({
        date: dateStr,
        studyHours: studyHours,
        tasksCompleted: report?.tasksCompleted || 0,
        understanding: report?.understanding || 0,
        sessions: daySessions.length,
        sessionTypes: daySessions.reduce((acc, s) => {
          acc[s.sessionType] = (acc[s.sessionType] || 0) + 1;
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

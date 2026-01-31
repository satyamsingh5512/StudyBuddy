import express from 'express';
import { isAuthenticated } from '../middleware/auth';
import { isAdmin } from '../middleware/admin';
import { db } from '../lib/db';
import { sendDailyStatsEmail } from '../lib/email';
import { isTempEmail } from '../lib/emailValidator';

const router = express.Router();

// Get admin dashboard stats
router.get('/stats', isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const totalUsers = await db.user.count();
    const verifiedUsers = await db.user.count({ where: { emailVerified: true } });
    const activeToday = await db.user.count({
      where: {
        lastActive: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    // Count users with temp emails
    const allUsers = await db.user.findMany({ select: { email: true } });
    const tempEmailCount = allUsers.filter((u: any) => isTempEmail(u.email)).length;

    res.json({
      totalUsers,
      verifiedUsers,
      activeToday,
      tempEmailUsers: tempEmailCount,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Send daily stats email to all users
router.post('/send-daily-stats', isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const users = await db.user.findMany({
      where: { emailVerified: true }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let successCount = 0;
    let failCount = 0;
    let skippedTempEmails = 0;

    for (const user of users) {
      try {
        // Skip temporary/disposable emails
        if (isTempEmail(user.email)) {
          console.log(`⚠️  Skipping temp email: ${user.email}`);
          skippedTempEmails++;
          continue;
        }

        // Get today's todos
        const todos = await db.todo.findMany({
          where: {
            userId: user.id,
            createdAt: { $gte: today }
          }
        });

        // Get today's schedules
        const schedules = await db.schedule.findMany({
          where: {
            userId: user.id,
            date: { $gte: today }
          }
        });

        // Get today's timer sessions
        const timerSessions = await db.timerSession.findMany({
          where: {
            userId: user.id,
            createdAt: { $gte: today }
          }
        });

        // Calculate stats
        const completedTodos = todos.filter(t => t.completed).length;
        const totalTodos = todos.length;
        const completedSchedules = schedules.filter(s => s.completed).length;
        const totalSchedules = schedules.length;

        const totalStudyMinutes = timerSessions.reduce((sum: number, session: any) => {
          return sum + (session.duration || 0);
        }, 0);

        const stats = {
          completedTodos,
          totalTodos,
          completedSchedules,
          totalSchedules,
          studyMinutes: totalStudyMinutes,
          streak: user.streak || 0,
          totalPoints: user.totalPoints || 0
        };

        await sendDailyStatsEmail(user.email, user.name, stats);
        successCount++;
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Daily stats emails sent`,
      successCount,
      failCount,
      skippedTempEmails,
      totalUsers: users.length
    });
  } catch (error: any) {
    console.error('Error sending daily stats emails:', error);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});

export default router;

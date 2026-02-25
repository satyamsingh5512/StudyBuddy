import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { adminGuard } from '../middleware/adminGuard.js';
import { collections } from '../db/collections.js';
import { sendDailyStatsEmail } from '../lib/email.js';
import { isTempEmail } from '../lib/emailValidator.js';

const router = express.Router();

// Get admin dashboard stats
router.get('/stats', isAuthenticated, adminGuard, async (_req, res) => {
  try {
    const totalUsers = await (await collections.users).countDocuments();
    const verifiedUsers = await (await collections.users).countDocuments({ emailVerified: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = await (await collections.users).countDocuments({
      lastActive: { $gte: today }
    });

    // Count users with temp emails (fetching only email field using projection)
    const allUsers = await (await collections.users).find({}, { projection: { email: 1 } }).toArray();
    const tempEmailCount = allUsers.filter(u => isTempEmail(u.email)).length;

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
router.post('/send-daily-stats', isAuthenticated, adminGuard, async (_req, res) => {
  try {
    const users = await (await collections.users).find({ emailVerified: true }).toArray();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let successCount = 0;
    let failCount = 0;
    let skippedTempEmails = 0;

    for (const user of users) {
      try {
        if (isTempEmail(user.email)) {
          console.log(`⚠️  Skipping temp email: ${user.email}`);
          skippedTempEmails++;
          continue;
        }

        const todosDb = await collections.todos;
        const schedulesDb = await collections.schedules;
        const timersDb = await collections.timerSessions;

        const todos = await todosDb.find({
          userId: user._id,
          createdAt: { $gte: today }
        }).toArray();

        const schedules = await schedulesDb.find({
          userId: user._id,
          date: { $gte: today }
        }).toArray();

        const timerSessions = await timersDb.find({
          userId: user._id,
          createdAt: { $gte: today }
        }).toArray();

        const completedTodos = todos.filter(t => t.completed).length;
        const totalTodos = todos.length;
        const completedSchedules = schedules.filter(s => s.completed).length;
        const totalSchedules = schedules.length;

        const totalStudyMinutes = timerSessions.reduce((sum: number, session) => {
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

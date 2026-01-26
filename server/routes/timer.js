"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const mongodb_1 = require("../lib/mongodb");
const router = (0, express_1.Router)();
// Save study session
router.post('/session', auth_1.isAuthenticated, async (req, res) => {
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
                const mongoDb = await (0, mongodb_1.getMongoDb)();
                if (!mongoDb)
                    return;
                const userId = req.user.id;
                // Create timer session record
                await db_1.db.timerSession.create({
                    data: {
                        userId,
                        duration: minutes,
                        sessionType,
                        startedAt: new Date(Date.now() - minutes * 60 * 1000),
                        completedAt: new Date(),
                    }
                });
                // Update user stats (using atomic increment)
                await mongoDb.collection('users').updateOne({ _id: (0, mongodb_1.toObjectId)(userId) }, {
                    $inc: {
                        totalStudyMinutes: minutes,
                        totalPoints: minutes
                    },
                    $set: { lastActive: new Date() }
                });
                // Create daily report entry or update existing
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                const existingReport = await db_1.db.dailyReport.findFirst({
                    where: {
                        userId: userId,
                        date: {
                            $gte: today,
                            $lt: tomorrow,
                        },
                    },
                });
                if (existingReport) {
                    await mongoDb.collection('daily_reports').updateOne({ _id: (0, mongodb_1.toObjectId)(existingReport.id) }, { $inc: { studyHours: minutes / 60 } });
                }
                else {
                    await db_1.db.dailyReport.create({
                        data: {
                            userId: userId,
                            date: today,
                            tasksPlanned: 0,
                            tasksCompleted: 0,
                            studyHours: minutes / 60,
                            understanding: 5,
                            completionPct: 0,
                        },
                    });
                }
            }
            catch (error) {
                console.error('Background session save failed:', error);
            }
        });
    }
    catch (error) {
        console.error('Save session error:', error);
        res.status(500).json({ error: 'Failed to save study session' });
    }
});
// Get analytics data
router.get('/analytics', auth_1.isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        startDate.setHours(0, 0, 0, 0);
        // Get timer sessions for more accurate analytics
        const sessions = await db_1.db.timerSession.findMany({
            where: {
                userId,
                completedAt: { $gte: startDate },
            },
            orderBy: { completedAt: 'asc' },
        });
        // Get daily reports for task completion data
        // Note: TypeScript might complain about explicit cast if not inferred, but findMany returns type T[]
        const reports = await db_1.db.dailyReport.findMany({
            where: {
                userId,
                date: { $gte: startDate },
            },
            orderBy: { date: 'asc' },
        });
        // Fill in missing days with zero data
        const analytics = [];
        for (let i = 0; i < parseInt(days); i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            // Calculate study hours from timer sessions (any type to handle logic)
            const daySessions = sessions.filter(s => new Date(s.completedAt).toDateString() === date.toDateString());
            const studyHours = daySessions.reduce((sum, s) => sum + s.duration, 0) / 60;
            // Get tasks completed from reports
            const report = reports.find(r => new Date(r.date).toDateString() === date.toDateString());
            analytics.push({
                date: dateStr,
                studyHours: studyHours,
                tasksCompleted: report?.tasksCompleted || 0,
                understanding: report?.understanding || 0,
                sessions: daySessions.length,
                sessionTypes: daySessions.reduce((acc, s) => {
                    acc[s.sessionType] = (acc[s.sessionType] || 0) + 1;
                    return acc;
                }, {}),
            });
        }
        res.json(analytics);
    }
    catch (error) {
        console.error('Analytics fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});
exports.default = router;

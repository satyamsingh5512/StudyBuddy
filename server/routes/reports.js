"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.use(auth_1.isAuthenticated);
// Apply report rate limiter to report creation
router.post('/', rateLimiting_1.reportRateLimiter, async (req, res) => {
    try {
        const report = await db_1.db.dailyReport.create({
            data: {
                ...req.body,
                userId: req.user.id,
            },
        });
        res.json(report);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create report' });
    }
});
router.get('/', async (req, res) => {
    try {
        const reports = await db_1.db.dailyReport.findMany({
            where: { userId: req.user.id },
            orderBy: { date: 'desc' },
            take: 30,
        });
        res.json(reports);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});
router.post('/', async (req, res) => {
    try {
        const report = await db_1.db.dailyReport.create({
            data: {
                ...req.body,
                userId: req.user.id,
            },
        });
        res.json(report);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create report' });
    }
});
exports.default = router;

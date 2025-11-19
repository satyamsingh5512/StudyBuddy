"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(auth_1.isAuthenticated);
router.get('/', async (req, res) => {
    try {
        const reports = await prisma.dailyReport.findMany({
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
        const report = await prisma.dailyReport.create({
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

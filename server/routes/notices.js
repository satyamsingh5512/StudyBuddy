"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.use(auth_1.isAuthenticated);
router.get('/', async (req, res) => {
    try {
        const notices = await db_1.db.notice.findMany({
            where: { published: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json(notices);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch notices' });
    }
});
router.post('/', async (req, res) => {
    try {
        const notice = await db_1.db.notice.create({
            data: req.body,
        });
        res.json(notice);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create notice' });
    }
});
exports.default = router;

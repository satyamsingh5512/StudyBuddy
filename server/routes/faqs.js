"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const db_1 = require("../lib/db");
router.use(auth_1.isAuthenticated);
// Get FAQs for a specific exam type
router.get('/:examType', async (req, res) => {
    try {
        const { examType } = req.params;
        const faqs = await db_1.db.fAQ.findMany({
            where: {
                examType,
                published: true,
            },
            orderBy: { order: 'asc' },
        });
        res.json(faqs);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch FAQs' });
    }
});
// Create FAQ (admin only - you can add admin check middleware)
router.post('/', async (req, res) => {
    try {
        const faq = await db_1.db.fAQ.create({
            data: req.body,
        });
        res.json(faq);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create FAQ' });
    }
});
// Update FAQ
router.patch('/:id', async (req, res) => {
    try {
        const faq = await db_1.db.fAQ.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(faq);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update FAQ' });
    }
});
// Delete FAQ
router.delete('/:id', async (req, res) => {
    try {
        await db_1.db.fAQ.delete({
            where: { id: req.params.id },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete FAQ' });
    }
});
exports.default = router;

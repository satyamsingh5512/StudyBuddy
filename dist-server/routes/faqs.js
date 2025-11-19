"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(auth_1.isAuthenticated);
// Get FAQs for a specific exam type
router.get('/:examType', async (req, res) => {
    try {
        const { examType } = req.params;
        const faqs = await prisma.fAQ.findMany({
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
        const faq = await prisma.fAQ.create({
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
        const faq = await prisma.fAQ.update({
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
        await prisma.fAQ.delete({
            where: { id: req.params.id },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete FAQ' });
    }
});
exports.default = router;

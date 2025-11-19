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
        const todos = await prisma.todo.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(todos);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});
router.post('/', async (req, res) => {
    try {
        const todo = await prisma.todo.create({
            data: {
                ...req.body,
                userId: req.user.id,
            },
        });
        res.json(todo);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create todo' });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const todo = await prisma.todo.update({
            where: { id: req.params.id },
            data: req.body,
        });
        // Award points if completed
        if (req.body.completed && !todo.completed) {
            const points = { easy: 10, medium: 25, hard: 50 }[todo.difficulty] || 10;
            await prisma.user.update({
                where: { id: req.user.id },
                data: { totalPoints: { increment: points } },
            });
        }
        res.json(todo);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update todo' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await prisma.todo.delete({
            where: { id: req.params.id },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});
exports.default = router;

"use strict";
/**
 * Chat Routes (REST API - Vercel compatible)
 * Replaces Socket.IO with simple polling
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const mongodb_1 = require("../lib/mongodb");
const router = (0, express_1.Router)();
// Rate limiting map
const userLastMessage = new Map();
const RATE_LIMIT_MS = 2000; // 2 seconds between messages
const MAX_MESSAGE_LENGTH = 1000;
/**
 * GET /api/chat/messages
 * Get recent chat messages
 */
router.get('/messages', auth_1.isAuthenticated, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const before = req.query.before ? parseInt(req.query.before) : Date.now();
        const messages = await db_1.db.chatMessage.findMany({
            where: {
                roomId: 'global-chat',
                createdAt: { $lt: new Date(before) },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                userId: true,
                message: true,
                createdAt: true,
            },
        });
        // Get user info
        const userIds = Array.from(new Set(messages.map((m) => m.userId))).filter(Boolean);
        const users = [];
        for (const userId of userIds) {
            try {
                const user = await db_1.db.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar: true,
                        avatarType: true,
                    },
                });
                if (user)
                    users.push(user);
            }
            catch (error) {
                console.error('Failed to fetch user:', userId);
            }
        }
        const userMap = new Map(users.map((u) => [u.id, u]));
        const formattedMessages = messages.map((msg) => ({
            id: msg.id,
            userId: msg.userId,
            message: msg.message,
            timestamp: msg.createdAt.getTime(),
            userName: userMap.get(msg.userId)?.name,
            userAvatar: userMap.get(msg.userId)?.avatar,
        }));
        res.json({ messages: formattedMessages.reverse() });
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
/**
 * POST /api/chat/messages
 * Send a new message
 */
router.post('/messages', auth_1.isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { message } = req.body;
        // Validate message
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }
        const trimmed = message.trim();
        if (trimmed.length === 0) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }
        if (trimmed.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
        }
        // Check rate limit
        const lastMessageTime = userLastMessage.get(userId) || 0;
        const now = Date.now();
        const timeSinceLastMessage = now - lastMessageTime;
        if (timeSinceLastMessage < RATE_LIMIT_MS) {
            const remainingMs = RATE_LIMIT_MS - timeSinceLastMessage;
            return res.status(429).json({
                error: 'Please wait before sending another message',
                remainingMs,
            });
        }
        userLastMessage.set(userId, now);
        // Create message
        const messageId = (0, mongodb_1.generateId)();
        const createdAt = new Date();
        await db_1.db.chatMessage.create({
            data: {
                id: messageId,
                userId,
                message: trimmed,
                roomId: 'global-chat',
                createdAt,
            },
        });
        // Get user info
        const user = await db_1.db.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                avatar: true,
            },
        });
        res.status(201).json({
            message: {
                id: messageId,
                userId,
                message: trimmed,
                timestamp: createdAt.getTime(),
                userName: user?.name,
                userAvatar: user?.avatar,
            },
        });
    }
    catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
/**
 * DELETE /api/chat/messages/:id
 * Delete own message
 */
router.delete('/messages/:id', auth_1.isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = req.params.id;
        // Verify ownership
        const message = await db_1.db.chatMessage.findUnique({
            where: { id: messageId },
        });
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (message.userId !== userId) {
            return res.status(403).json({ error: 'Cannot delete this message' });
        }
        // Delete message
        await db_1.db.chatMessage.delete({
            where: { id: messageId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});
exports.default = router;

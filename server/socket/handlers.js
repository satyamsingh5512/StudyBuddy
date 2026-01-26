"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = void 0;
const db_1 = require("../lib/db");
const userLastMessage = new Map();
const onlineUsers = new Set();
const RATE_LIMIT_MS = 30000; // 30 seconds
const setupSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('join-chat', async (userId) => {
            socket.data.userId = userId;
            socket.join('global-chat');
            // Add user to online list
            onlineUsers.add(userId);
            // Broadcast online users
            io.to('global-chat').emit('online-users', Array.from(onlineUsers));
            io.to('global-chat').emit('user-online', userId);
            // Send recent messages - optimized query
            const messages = await db_1.db.chatMessage.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    message: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            avatar: true,
                            showProfile: true,
                        },
                    },
                },
            });
            socket.emit('chat-history', messages.reverse());
        });
        socket.on('send-message', async (data) => {
            const userId = socket.data.userId;
            if (!userId)
                return;
            // Rate limiting
            const lastMessageTime = userLastMessage.get(userId) || 0;
            const now = Date.now();
            if (now - lastMessageTime < RATE_LIMIT_MS) {
                socket.emit('rate-limit', {
                    message: 'Please wait before sending another message',
                    remainingSeconds: Math.ceil((RATE_LIMIT_MS - (now - lastMessageTime)) / 1000),
                });
                return;
            }
            userLastMessage.set(userId, now);
            const message = await db_1.db.chatMessage.create({
                data: {
                    userId,
                    message: data.message,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            avatar: true,
                            showProfile: true,
                            examGoal: true,
                            streak: true,
                        },
                    },
                },
            });
            io.to('global-chat').emit('new-message', message);
        });
        socket.on('delete-message', async (messageId) => {
            const userId = socket.data.userId;
            if (!userId)
                return;
            // Verify the message belongs to the user
            const message = await db_1.db.chatMessage.findUnique({
                where: { id: messageId },
            });
            if (message && message.userId === userId) {
                await db_1.db.chatMessage.delete({
                    where: { id: messageId },
                });
                io.to('global-chat').emit('message-deleted', messageId);
            }
        });
        socket.on('mark-read', async (messageIds) => {
            const userId = socket.data.userId;
            if (!userId || messageIds.length === 0)
                return;
            // Mark messages as read (you can add this to database if needed)
            socket.to('global-chat').emit('messages-read', { userId, messageIds });
        });
        socket.on('typing', () => {
            socket.to('global-chat').emit('user-typing', {
                userId: socket.data.userId,
            });
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            // Remove user from online list
            const userId = socket.data.userId;
            if (userId) {
                onlineUsers.delete(userId);
                io.to('global-chat').emit('user-offline', userId);
                io.to('global-chat').emit('online-users', Array.from(onlineUsers));
            }
        });
    });
};
exports.setupSocketHandlers = setupSocketHandlers;

/**
 * StudyBuddy API - Vercel Serverless Function
 * All API routes consolidated into a single function
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './lib/prisma';
import { requireAuth, getCurrentUser, setCorsHeaders, createToken, setAuthCookie, clearAuthCookie, AuthUser } from './lib/auth';
import cache from './lib/cache';

// Google OAuth types
interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname.replace('/api', '');
  const method = req.method || 'GET';

  try {
    // Health check
    if (path === '/health') {
      return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Auth routes (no auth required)
    if (path === '/auth/me' && method === 'GET') {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      return res.status(200).json(user);
    }

    if (path === '/auth/logout' && method === 'POST') {
      clearAuthCookie(res);
      return res.status(200).json({ success: true });
    }

    if (path === '/auth/google' && method === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/auth/google/callback`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline`;
      return res.redirect(authUrl);
    }

    if (path === '/auth/google/callback' && method === 'GET') {
      return handleGoogleCallback(req, res);
    }

    // Protected routes - require auth
    const user = await requireAuth(req, res);
    if (!user) return;

    // Todos
    if (path === '/todos') {
      if (method === 'GET') return getTodos(user, res);
      if (method === 'POST') return createTodo(user, req, res);
    }
    if (path.match(/^\/todos\/[\w-]+$/) && method === 'PATCH') {
      const id = path.split('/')[2];
      return updateTodo(user, id, req, res);
    }
    if (path.match(/^\/todos\/[\w-]+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      return deleteTodo(user, id, res);
    }

    // Friends
    if (path === '/friends' || path === '/friends/list') {
      if (method === 'GET') return getFriends(user, res);
    }
    if (path === '/friends/search' && method === 'GET') {
      return searchUsers(user, req, res);
    }
    if (path === '/friends/request' && method === 'POST') {
      return sendFriendRequest(user, req, res);
    }
    if (path === '/friends/requests' && method === 'GET') {
      return getFriendRequests(user, res);
    }
    if (path.match(/^\/friends\/request\/[\w-]+\/accept$/) && method === 'POST') {
      const id = path.split('/')[3];
      return acceptFriendRequest(user, id, res);
    }
    if (path.match(/^\/friends\/request\/[\w-]+\/reject$/) && method === 'POST') {
      const id = path.split('/')[3];
      return rejectFriendRequest(user, id, res);
    }
    if (path.match(/^\/friends\/[\w-]+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      return removeFriend(user, id, res);
    }
    if (path === '/friends/blocked' && method === 'GET') {
      return getBlockedUsers(user, res);
    }
    if (path === '/friends/block' && method === 'POST') {
      return blockUser(user, req, res);
    }
    if (path.match(/^\/friends\/block\/[\w-]+$/) && method === 'DELETE') {
      const userId = path.split('/')[3];
      return unblockUser(user, userId, res);
    }

    // Messages
    if (path === '/messages' && method === 'GET') {
      return getConversations(user, res);
    }
    if (path.match(/^\/messages\/[\w-]+$/)) {
      const recipientId = path.split('/')[2];
      if (method === 'GET') return getMessages(user, recipientId, res);
      if (method === 'POST') return sendMessage(user, recipientId, req, res);
    }

    // Schedule
    if (path === '/schedule') {
      if (method === 'GET') return getSchedule(user, res);
      if (method === 'POST') return createScheduleItem(user, req, res);
    }
    if (path.match(/^\/schedule\/[\w-]+$/)) {
      const id = path.split('/')[2];
      if (method === 'PATCH') return updateScheduleItem(user, id, req, res);
      if (method === 'DELETE') return deleteScheduleItem(user, id, res);
    }

    // Timer
    if (path === '/timer/session' && method === 'POST') {
      return saveTimerSession(user, req, res);
    }

    // Users
    if (path === '/users/me') {
      if (method === 'GET') return res.status(200).json(user);
      if (method === 'PATCH') return updateUser(user, req, res);
    }
    if (path === '/users/leaderboard' && method === 'GET') {
      return getLeaderboard(res);
    }

    // Username
    if (path === '/username/check' && method === 'GET') {
      return checkUsername(req, res);
    }
    if (path === '/username/set' && method === 'POST') {
      return setUsername(user, req, res);
    }

    // Reports
    if (path === '/reports' && method === 'POST') {
      return createReport(user, req, res);
    }

    // Notices
    if (path === '/notices' && method === 'GET') {
      return getNotices(res);
    }

    // AI Chat
    if (path === '/ai/buddy-chat' && method === 'POST') {
      return handleBuddyChat(user, req, res);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


// ============ Handler Functions ============

async function handleGoogleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (error || !code || typeof code !== 'string') {
    return res.redirect(`${clientUrl}?error=auth_failed`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/auth/google/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });

    if (!tokenResponse.ok) return res.redirect(`${clientUrl}?error=token_exchange_failed`);
    const tokens = await tokenResponse.json() as GoogleTokenResponse;

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) return res.redirect(`${clientUrl}?error=user_info_failed`);
    const googleUser = await userInfoResponse.json() as GoogleUserInfo;

    let user = await prisma.user.findUnique({ where: { googleId: googleUser.id } });
    if (!user) {
      user = await prisma.user.create({
        data: { googleId: googleUser.id, email: googleUser.email, name: googleUser.name, avatar: googleUser.picture, examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
      });
    }

    const token = await createToken(user.id);
    setAuthCookie(res, token);
    return res.redirect(clientUrl);
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${clientUrl}?error=auth_error`);
  }
}

// Todos
async function getTodos(user: AuthUser, res: VercelResponse) {
  const cacheKey = `todos:${user.id}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.status(200).json(cached);

  const todos = await prisma.todo.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, subject: true, difficulty: true, questionsTarget: true, completed: true, scheduledTime: true, createdAt: true },
  });
  cache.set(cacheKey, todos, 120);
  return res.status(200).json(todos);
}

async function createTodo(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { title, subject, difficulty, questionsTarget } = req.body;
  const todo = await prisma.todo.create({
    data: { title, subject: subject || 'General', difficulty: difficulty || 'medium', questionsTarget: questionsTarget || 10, userId: user.id },
  });
  cache.del(`todos:${user.id}`);
  return res.status(201).json(todo);
}

async function updateTodo(user: AuthUser, id: string, req: VercelRequest, res: VercelResponse) {
  const todo = await prisma.todo.updateMany({ where: { id, userId: user.id }, data: req.body });
  cache.del(`todos:${user.id}`);
  return res.status(200).json(todo);
}

async function deleteTodo(user: AuthUser, id: string, res: VercelResponse) {
  await prisma.todo.deleteMany({ where: { id, userId: user.id } });
  cache.del(`todos:${user.id}`);
  return res.status(200).json({ success: true });
}

// Friends
async function getFriends(user: AuthUser, res: VercelResponse) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ senderId: user.id, status: 'ACCEPTED' }, { receiverId: user.id, status: 'ACCEPTED' }] },
    include: {
      sender: { select: { id: true, username: true, name: true, avatar: true, avatarType: true, examGoal: true, totalPoints: true } },
      receiver: { select: { id: true, username: true, name: true, avatar: true, avatarType: true, examGoal: true, totalPoints: true } },
    },
  });
  const friends = friendships.map((f) => {
    const friend = f.senderId === user.id ? f.receiver : f.sender;
    return { ...friend, friendshipId: f.id };
  });
  return res.status(200).json(friends);
}

async function searchUsers(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { query } = req.query;
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Search query required' });

  const [users, friendships] = await Promise.all([
    prisma.user.findMany({
      where: { AND: [{ id: { not: user.id } }, { OR: [{ username: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] }] },
      select: { id: true, username: true, name: true, avatar: true, avatarType: true, examGoal: true, totalPoints: true },
      take: 20,
    }),
    prisma.friendship.findMany({ where: { OR: [{ senderId: user.id }, { receiverId: user.id }] }, select: { senderId: true, receiverId: true, status: true } }),
  ]);

  const friendshipMap = new Map<string, { status: string; isSender: boolean }>();
  friendships.forEach((f) => {
    const otherId = f.senderId === user.id ? f.receiverId : f.senderId;
    friendshipMap.set(otherId, { status: f.status, isSender: f.senderId === user.id });
  });

  const results = users.map((u) => ({ ...u, friendshipStatus: friendshipMap.get(u.id)?.status || null, isSender: friendshipMap.get(u.id)?.isSender || false }));
  return res.status(200).json(results);
}

async function sendFriendRequest(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ error: 'Receiver ID required' });

  const existing = await prisma.friendship.findFirst({ where: { OR: [{ senderId: user.id, receiverId }, { senderId: receiverId, receiverId: user.id }] } });
  if (existing) return res.status(400).json({ error: 'Friendship already exists' });

  const friendship = await prisma.friendship.create({ data: { senderId: user.id, receiverId, status: 'PENDING' } });
  return res.status(201).json(friendship);
}

async function getFriendRequests(user: AuthUser, res: VercelResponse) {
  const requests = await prisma.friendship.findMany({
    where: { receiverId: user.id, status: 'PENDING' },
    include: { sender: { select: { id: true, username: true, name: true, avatar: true, avatarType: true, examGoal: true, totalPoints: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json(requests);
}

async function acceptFriendRequest(user: AuthUser, id: string, res: VercelResponse) {
  await prisma.friendship.updateMany({ where: { id, receiverId: user.id, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
  return res.status(200).json({ success: true });
}

async function rejectFriendRequest(user: AuthUser, id: string, res: VercelResponse) {
  await prisma.friendship.deleteMany({ where: { id, receiverId: user.id, status: 'PENDING' } });
  return res.status(200).json({ success: true });
}

async function removeFriend(user: AuthUser, id: string, res: VercelResponse) {
  await prisma.friendship.deleteMany({ where: { id, OR: [{ senderId: user.id }, { receiverId: user.id }] } });
  return res.status(200).json({ success: true });
}

async function getBlockedUsers(user: AuthUser, res: VercelResponse) {
  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    include: { blocked: { select: { id: true, username: true, name: true, avatar: true } } },
  });
  return res.status(200).json(blocks.map((b) => b.blocked));
}

async function blockUser(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { blockedId } = req.body;
  if (!blockedId) return res.status(400).json({ error: 'User ID required' });

  await prisma.$transaction([
    prisma.block.create({ data: { blockerId: user.id, blockedId } }),
    prisma.friendship.deleteMany({ where: { OR: [{ senderId: user.id, receiverId: blockedId }, { senderId: blockedId, receiverId: user.id }] } }),
  ]);
  return res.status(201).json({ success: true });
}

async function unblockUser(user: AuthUser, blockedId: string, res: VercelResponse) {
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId } });
  return res.status(200).json({ success: true });
}


// Messages
async function getConversations(user: AuthUser, res: VercelResponse) {
  const messages = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: user.id }, { receiverId: user.id }] },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, username: true, name: true, avatar: true } },
      receiver: { select: { id: true, username: true, name: true, avatar: true } },
    },
  });

  const conversationMap = new Map<string, { user: any; lastMessage: any; unreadCount: number }>();
  messages.forEach((m) => {
    const otherId = m.senderId === user.id ? m.receiverId : m.senderId;
    if (!conversationMap.has(otherId)) {
      const other = m.senderId === user.id ? m.receiver : m.sender;
      conversationMap.set(otherId, { user: other, lastMessage: m, unreadCount: 0 });
    }
    if (m.receiverId === user.id && !m.read) {
      const conv = conversationMap.get(otherId);
      if (conv) conv.unreadCount++;
    }
  });
  return res.status(200).json(Array.from(conversationMap.values()));
}

async function getMessages(user: AuthUser, recipientId: string, res: VercelResponse) {
  const messages = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: user.id, receiverId: recipientId }, { senderId: recipientId, receiverId: user.id }] },
    orderBy: { createdAt: 'asc' },
  });
  await prisma.directMessage.updateMany({ where: { senderId: recipientId, receiverId: user.id, read: false }, data: { read: true } });
  return res.status(200).json(messages);
}

async function sendMessage(user: AuthUser, recipientId: string, req: VercelRequest, res: VercelResponse) {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const message = await prisma.directMessage.create({ data: { senderId: user.id, receiverId: recipientId, message: content } });
  return res.status(201).json(message);
}

// Schedule
async function getSchedule(user: AuthUser, res: VercelResponse) {
  const items = await prisma.schedule.findMany({ where: { userId: user.id }, orderBy: { date: 'asc' } });
  return res.status(200).json(items);
}

async function createScheduleItem(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { title, subject, date, startTime, endTime, notes } = req.body;
  const item = await prisma.schedule.create({ data: { title, subject, date: new Date(date), startTime, endTime, notes, userId: user.id } });
  return res.status(201).json(item);
}

async function updateScheduleItem(user: AuthUser, id: string, req: VercelRequest, res: VercelResponse) {
  const data = { ...req.body };
  if (data.date) data.date = new Date(data.date);
  await prisma.schedule.updateMany({ where: { id, userId: user.id }, data });
  return res.status(200).json({ success: true });
}

async function deleteScheduleItem(user: AuthUser, id: string, res: VercelResponse) {
  await prisma.schedule.deleteMany({ where: { id, userId: user.id } });
  return res.status(200).json({ success: true });
}

// Timer
async function saveTimerSession(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { duration, sessionType, completedAt } = req.body;
  const session = await prisma.timerSession.create({ data: { duration, sessionType: sessionType || 'pomodoro', completedAt: completedAt ? new Date(completedAt) : new Date(), userId: user.id } });
  
  const points = Math.floor(duration / 60);
  await prisma.user.update({ where: { id: user.id }, data: { totalPoints: { increment: points } } });
  
  return res.status(201).json(session);
}

// Users
async function updateUser(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { name, examGoal, examDate, avatar, avatarType, onboardingDone } = req.body;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name, examGoal, examDate: examDate ? new Date(examDate) : undefined, avatar, avatarType, onboardingDone },
  });
  return res.status(200).json(updated);
}

async function getLeaderboard(res: VercelResponse) {
  const users = await prisma.user.findMany({
    where: { totalPoints: { gt: 0 } },
    orderBy: { totalPoints: 'desc' },
    take: 50,
    select: { id: true, username: true, name: true, avatar: true, avatarType: true, totalPoints: true, streak: true },
  });
  return res.status(200).json(users);
}

// Username
async function checkUsername(req: VercelRequest, res: VercelResponse) {
  const { username } = req.query;
  if (!username || typeof username !== 'string') return res.status(400).json({ error: 'Username required' });

  const existing = await prisma.user.findUnique({ where: { username } });
  return res.status(200).json({ available: !existing });
}

async function setUsername(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== user.id) return res.status(400).json({ error: 'Username taken' });

  const updated = await prisma.user.update({ where: { id: user.id }, data: { username } });
  return res.status(200).json(updated);
}

// Reports - using DailyReport model
async function createReport(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { tasksPlanned, tasksCompleted, questionsEasy, questionsMedium, questionsHard, studyHours, understanding, completionPct } = req.body;
  
  const report = await prisma.dailyReport.create({ 
    data: { 
      userId: user.id, 
      tasksPlanned: tasksPlanned || 0,
      tasksCompleted: tasksCompleted || 0,
      questionsEasy: questionsEasy || 0,
      questionsMedium: questionsMedium || 0,
      questionsHard: questionsHard || 0,
      studyHours: studyHours || 0,
      understanding: understanding || 0,
      completionPct: completionPct || 0
    } 
  });
  return res.status(201).json(report);
}

// Notices
async function getNotices(res: VercelResponse) {
  const notices = await prisma.notice.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 10 });
  return res.status(200).json(notices);
}

// AI Chat
async function handleBuddyChat(user: AuthUser, req: VercelRequest, res: VercelResponse) {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const Groq = (await import('groq-sdk')).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are StudyBuddy AI, a helpful study companion. Be encouraging, concise, and helpful with study-related questions.' },
        { role: 'user', content: message },
      ],
      model: 'llama-3.1-70b-versatile',
      max_tokens: 500,
    });

    return res.status(200).json({ response: completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.' });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ error: 'AI service unavailable' });
  }
}

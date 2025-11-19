import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

router.use(isAuthenticated);

router.post('/study-plan', async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const recentReports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const todos = await prisma.todo.findMany({
      where: { userId, completed: false },
    });

    const daysLeft = Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const avgStudyHours = recentReports.reduce((sum, r) => sum + r.studyHours, 0) / (recentReports.length || 1);
    const avgCompletion = recentReports.reduce((sum, r) => sum + r.completionPct, 0) / (recentReports.length || 1);

    const prompt = `You are a mentor for ${user.examGoal} aspirants. The student has ${daysLeft} days until exam.
They've been studying ${avgStudyHours.toFixed(1)} hours daily on average with ${avgCompletion.toFixed(0)}% task completion.
They have ${todos.length} pending tasks. Generate a personalized study plan for tomorrow with:
1. Specific topics to focus on
2. Question targets by difficulty
3. Time allocation
4. Motivational message

Keep it concise and actionable.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ plan: text });
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate study plan' });
  }
});

export default router;

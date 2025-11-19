import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(isAuthenticated);

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { totalPoints: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        avatar: true,
        totalPoints: true,
        streak: true,
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: (req.user as any).id },
      data: req.body,
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/onboarding', async (req, res) => {
  try {
    const { username, avatarType, avatar, examGoal, studentClass, batch, examAttempt } = req.body;
    const userId = (req.user as any).id;

    // Check if username is already taken
    if (username) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });

      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Fetch exam date and syllabus from AI
    let examDate = null;
    let syllabus = null;

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

      const prompt = `Provide information about ${examGoal} exam for batch ${batch} in JSON format:
{
  "examDate": "Expected exam date in YYYY-MM-DD format",
  "syllabus": {
    "subjects": [
      {"name": "Subject", "topics": ["Topic1", "Topic2"], "weightage": "X%"}
    ]
  }
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        examDate = data.examDate ? new Date(data.examDate) : null;
        syllabus = JSON.stringify(data.syllabus);
      }
    } catch (aiError) {
      console.error('AI fetch error:', aiError);
      // Continue without AI data
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        username,
        avatarType,
        avatar,
        examGoal,
        studentClass,
        batch,
        examAttempt,
        examDate,
        syllabus,
        onboardingDone: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;

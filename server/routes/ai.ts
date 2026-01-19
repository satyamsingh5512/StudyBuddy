import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';
import { generateTasksWithGroq, generateStudyPlan } from '../lib/groqClient';
import { aiRateLimiter } from '../middleware/rateLimiting';

const router = Router();
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

router.use(isAuthenticated);

// Apply AI rate limiter to all AI routes
router.use(aiRateLimiter);

router.post('/study-plan', async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Use Groq if available, fallback to Gemini
    const useGroq = !!process.env.GROQ_API_KEY;

    const recentReports = await prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const todos = await prisma.todo.findMany({
      where: { userId, completed: false },
    });

    const daysLeft = user.examDate
      ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;
    const avgStudyHours =
      recentReports.reduce((sum, r) => sum + r.studyHours, 0) / (recentReports.length || 1);
    const avgCompletion =
      recentReports.reduce((sum, r) => sum + r.completionPct, 0) / (recentReports.length || 1);

    // Get recent topics from todos
    const recentTopics = Array.from(new Set(todos.slice(0, 5).map(t => t.subject)));

    let plan: string;

    if (useGroq) {
      plan = await generateStudyPlan(user.examGoal, {
        daysLeft,
        avgStudyHours,
        avgCompletion,
        pendingTasks: todos.length,
        recentTopics,
      });
    } else {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service not configured' });
      }

      const prompt = `You are a mentor for ${user.examGoal} aspirants. The student has ${daysLeft} days until exam.
They've been studying ${avgStudyHours.toFixed(1)} hours daily on average with ${avgCompletion.toFixed(0)}% task completion.
They have ${todos.length} pending tasks. Generate a personalized study plan for tomorrow with:
1. Specific topics to focus on
2. Question targets by difficulty
3. Time allocation
4. Motivational message

Keep it concise and actionable.`;

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      plan = response.text();
    }

    res.json({ plan, provider: useGroq ? 'groq' : 'gemini' });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate study plan', details: error.message });
  }
});

// Generate tasks with AI (using Groq)
router.post('/generate-tasks', async (req: any, res: any) => {
  try {
    const { prompt, examGoal } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Use Groq if available, fallback to Gemini
    const useGroq = !!process.env.GROQ_API_KEY;
    let tasks: any[];

    if (useGroq) {
      // Get user context for better task generation
      const recentTodos = await prisma.todo.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const daysUntilExam = user?.examDate
        ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined;

      const recentTopics = Array.from(new Set(recentTodos.map(t => t.subject)));

      tasks = await generateTasksWithGroq(prompt, examGoal || user?.examGoal || 'exam', {
        recentTopics,
        daysUntilExam,
      });
    } else {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service not configured' });
      }

      const fullPrompt = `You are a study planner for ${examGoal || 'exam'} preparation. 
Based on this request: "${prompt}"

Generate 3-5 specific study tasks in JSON format. Each task should have:
- title: Clear, actionable task description (max 100 chars)
- subject: The subject/topic (e.g., Physics, Chemistry, Math, Biology, etc.)
- difficulty: easy, medium, or hard
- questionsTarget: Number of questions/problems to solve (5-50)

Return ONLY a valid JSON array, no other text. Example:
[
  {"title": "Solve kinematics problems from chapter 3", "subject": "Physics", "difficulty": "medium", "questionsTarget": 20},
  {"title": "Practice organic reactions mechanisms", "subject": "Chemistry", "difficulty": "hard", "questionsTarget": 15}
]`;

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('AI response:', text);
        return res.status(500).json({ error: 'Failed to parse AI response', details: text });
      }

      tasks = JSON.parse(jsonMatch[0]);
    }

    // Create todos in database
    const createdTodos = await Promise.all(
      tasks.map((task: any) =>
        prisma.todo.create({
          data: {
            userId,
            title: task.title,
            subject: task.subject || 'General',
            difficulty: task.difficulty || 'medium',
            questionsTarget: task.questionsTarget || 10,
          },
        })
      )
    );

    res.json({ success: true, tasks: createdTodos, provider: useGroq ? 'groq' : 'gemini' });
  } catch (error: any) {
    console.error('AI task generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate tasks',
      details: error.message || 'Unknown error'
    });
  }
});

router.post('/exam-info', async (req, res) => {
  try {
    const { examType } = req.body;

    const prompt = `Provide comprehensive information about ${examType} exam in JSON format:
{
  "examDate": "Expected exam date in YYYY-MM-DD format for next session",
  "syllabus": {
    "subjects": [
      {
        "name": "Subject name",
        "topics": ["Topic 1", "Topic 2", "..."],
        "weightage": "Percentage or marks"
      }
    ]
  },
  "importantDates": [
    {"event": "Event name", "date": "YYYY-MM-DD"}
  ]
}

Provide accurate, up-to-date information for ${examType}.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      res.json(data);
    } else {
      res.json({ raw: text });
    }
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to fetch exam information', details: error.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

interface GeneratedTask {
  title: string;
  subject: string;
  difficulty: string;
  questionsTarget: number;
}

const router = Router();
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

router.use(isAuthenticated);

router.post('/study-plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: 'AI service not configured' });
      return;
    }

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
    const text = response.text();

    res.json({ plan: text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate study plan', details: errorMessage });
  }
});

// Generate tasks with AI
router.post('/generate-tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { prompt, examGoal } = req.body;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: 'AI service not configured' });
      return;
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
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('AI response:', text);
      res.status(500).json({ error: 'Failed to parse AI response', details: text });
      return;
    }

    const tasks = JSON.parse(jsonMatch[0]);

    // Create todos in database
    const createdTodos = await Promise.all(
      tasks.map((task: GeneratedTask) =>
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

    res.json({ success: true, tasks: createdTodos });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI task generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate tasks',
      details: errorMessage
    });
  }
});

router.post('/exam-info', async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to fetch exam information', details: errorMessage });
  }
});

export default router;

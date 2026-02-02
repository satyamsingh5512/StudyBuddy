import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { generateTasksWithGroq, generateStudyPlan, getGroqClient } from '../lib/groqClient.js';
import { aiRateLimiter } from '../middleware/rateLimiting.js';
import { db } from '../lib/db.js';

const router = Router();

router.use(isAuthenticated);

// Apply AI rate limiter to all AI routes
router.use(aiRateLimiter);

router.post('/study-plan', async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const recentReports = await db.dailyReport.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const todos = await db.todo.findMany({
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
    const recentTopics = Array.from(new Set(todos.slice(0, 5).map((t) => t.subject)));

    const plan = await generateStudyPlan(user.examGoal, {
      daysLeft,
      avgStudyHours,
      avgCompletion,
      pendingTasks: todos.length,
      recentTopics,
    });

    res.json({ plan, provider: 'groq' });
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

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Get user context for better task generation
    const recentTodos = await db.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const user = await db.user.findUnique({ where: { id: userId } });
    const daysUntilExam = user?.examDate
      ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : undefined;

    const recentTopics = Array.from(new Set(recentTodos.map((t) => t.subject)));

    const tasks = await generateTasksWithGroq(prompt, examGoal || user?.examGoal || 'exam', {
      recentTopics,
      daysUntilExam,
    });

    // Create todos in database
    const createdTodos = await Promise.all(
      tasks.map((task: any) =>
        db.todo.create({
          data: {
            userId,
            title: task.title,
            subject: task.subject || 'General',
            difficulty: task.difficulty || 'medium',
            questionsTarget: task.questionsTarget || 10,
            completed: false,
            questionsCompleted: 0,
          },
        })
      )
    );

    res.json({ success: true, tasks: createdTodos, provider: 'groq' });
  } catch (error: any) {
    console.error('AI task generation error:', error);
    res.status(500).json({
      error: 'Failed to generate tasks',
      details: error.message || 'Unknown error',
    });
  }
});

// Get exam date from trusted sources
router.post('/exam-date', async (req, res) => {
  try {
    const { examType, batch } = req.body;

    if (!examType) {
      return res.status(400).json({ error: 'Exam type is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      // Fallback: Use default dates based on exam type and historical patterns
      const fallbackDates: Record<string, string> = {
        'NEET': '2025-05-05', // NEET is typically first Sunday of May
        'JEE': '2025-04-08', // JEE Main Session 1 is typically in January/April
        'GATE': '2025-02-01', // GATE is typically in February
        'UPSC': '2025-06-15', // UPSC Prelims typically in June
        'CAT': '2025-11-24', // CAT is typically last Sunday of November
        'NDA': '2025-04-20', // NDA is typically in April
        'CLAT': '2025-05-18', // CLAT is typically in May
      };

      const examDate = fallbackDates[examType] || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      return res.json({
        examDate,
        source: 'Estimated based on previous years',
        session: `${examType} ${batch || '2025'}`,
      });
    }

    // Use Groq to fetch latest exam date information
    const { getGroqClient } = await import('../lib/groqClient');

    const prompt = `You are an expert on Indian competitive exams. Provide the EXACT official exam date for ${examType} ${batch || '2025'}.

IMPORTANT: Return ONLY a JSON object with the exam date. Use the most recent official announcement.

Format:
{
  "examDate": "YYYY-MM-DD",
  "source": "Official source name",
  "session": "Session name (e.g., JEE Main January 2025)"
}

For ${examType}:
- If multiple sessions exist, provide the NEXT upcoming session
- Use ONLY official dates from NTA, CBSE, or respective exam authorities
- If exact date not announced, provide expected date based on previous years
- Current date for reference: ${new Date().toISOString().split('T')[0]}

Example for NEET 2025: {"examDate": "2025-05-05", "source": "NTA", "session": "NEET UG 2025"}`;

    const groq = getGroqClient();

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert on Indian competitive exam schedules. Provide accurate, up-to-date exam dates from official sources.',
        },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3, // Low temperature for factual accuracy
      max_tokens: 256,
    });

    const response = completion.choices[0]?.message?.content || '';
    const jsonMatch = response.match(/\{[\s\S]*?\}/);

    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      console.log(`📅 Exam date fetched for ${examType}:`, data.examDate);
      return res.json(data);
    }

    // Fallback if parsing fails
    const fallbackDates: Record<string, string> = {
      'NEET': '2025-05-05',
      'JEE': '2025-04-08',
      'GATE': '2025-02-01',
      'UPSC': '2025-06-15',
      'CAT': '2025-11-24',
      'NDA': '2025-04-20',
      'CLAT': '2025-05-18',
    };

    const examDate = fallbackDates[examType] || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    res.json({
      examDate,
      source: 'Estimated based on previous years',
      session: `${examType} ${batch || '2025'}`,
    });
  } catch (error: any) {
    console.error('Exam date fetch error:', error);
    // Return a safe default (6 months from now)
    const defaultDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    res.json({
      examDate: defaultDate,
      source: 'Default estimate',
      session: `${req.body.examType} ${req.body.batch || '2025'}`,
    });
  }
});

// Buddy Chat - Conversational AI assistant
router.post('/buddy-chat', async (req: any, res: any) => {
  try {
    const { message, examGoal } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if selected model is configured
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Groq AI service not configured' });
    }



    // Get user context
    const user = await db.user.findUnique({ where: { id: userId } });
    const recentTodos = await db.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentTopics = Array.from(new Set(recentTodos.map((t) => t.subject)));
    const daysUntilExam = user?.examDate
      ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : undefined;

    let response: string;
    let tasks: any[] = [];

    // Unified System Prompt
    const systemPrompt = `You are Buddy, a smart and friendly AI study assistant for ${examGoal || 'exam'} preparation.
The user has ${daysUntilExam || 'many'} days until their exam.
Recent topics: ${recentTopics.join(', ') || 'None yet'}

Your Goal: Provide a helpful, conversational response.
- IF the user asks for a study plan, tasks, or specific practice, GENERATE TASKS.
- IF the user just wants to chat, explain a concept, or needs motivation, JUST CHAT.

Response Format:
1. Start with a friendly, markdown-formatted conversational response.
2. IF generating tasks, append a JSON block at the very end labeled "TASKS_JSON:".

Example with tasks:
"Here is a plan for you..."
TASKS_JSON:
[{"title": "...", "subject": "...", "difficulty": "medium", "questionsTarget": 10}]`;

    // Use Groq (default)
    const { getGroqClient } = await import('../lib/groqClient.js');

      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
      });

      const fullResponse = completion.choices[0]?.message?.content || '';

      // Parse output for optional tasks
      const parts = fullResponse.split('TASKS_JSON:');
      if (parts.length > 1) {
        response = parts[0].trim();
        const jsonPart = parts[1].trim();
        try {
          const jsonMatch = jsonPart.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsedTasks = JSON.parse(jsonMatch[0]);
            // Ensure tasks are properly formatted objects with required fields
            tasks = parsedTasks.filter((task: any) => 
              task && 
              typeof task === 'object' && 
              typeof task.title === 'string' && 
              typeof task.subject === 'string' && 
              typeof task.difficulty === 'string' &&
              typeof task.questionsTarget === 'number'
            ).map((task: any) => ({
              title: task.title,
              subject: task.subject,
              difficulty: task.difficulty,
              questionsTarget: task.questionsTarget,
            }));
          }
        } catch (e) {
          console.error('Failed to parse tasks JSON:', e);
        }
      } else {
        response = fullResponse;
      }

    res.json({
      response,
      tasks: tasks.length > 0 ? tasks : undefined,
      provider: 'groq',
    });
  } catch (error: any) {
    console.error('Buddy chat error:', error);
    res.status(500).json({
      error: 'Failed to get response from Buddy',
      details: error.message || 'Unknown error',
    });
  }
});

export default router;

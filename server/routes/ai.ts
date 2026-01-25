import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isAuthenticated } from '../middleware/auth';
import { generateTasksWithGroq, generateStudyPlan } from '../lib/groqClient';
import { aiRateLimiter } from '../middleware/rateLimiting';
import { db } from '../lib/db';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    // Use Groq if available, fallback to Gemini
    const useGroq = !!process.env.GROQ_API_KEY;

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

    res.json({ success: true, tasks: createdTodos, provider: useGroq ? 'groq' : 'gemini' });
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

    // Use Groq to fetch latest exam date information
    const useGroq = !!process.env.GROQ_API_KEY;

    if (useGroq) {
      const { groq } = await import('../lib/groqClient');

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
    }

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

// Buddy Chat - Conversational AI assistant
router.post('/buddy-chat', async (req: any, res: any) => {
  try {
    const { message, examGoal } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Use Groq if available, fallback to Gemini
    const useGroq = !!process.env.GROQ_API_KEY;

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

    if (useGroq) {
      const { groq } = await import('../lib/groqClient');

      // Determine if user is asking for task creation
      const isTaskRequest = /create|generate|make|add|suggest|give me|plan/i.test(message);

      if (isTaskRequest) {
        // Generate tasks
        const systemPrompt = `You are Buddy, a friendly AI study assistant for ${examGoal || 'exam'} preparation.
The user has ${daysUntilExam || 'many'} days until their exam.
Recent topics: ${recentTopics.join(', ') || 'None yet'}

When the user asks for tasks, respond with:
1. A friendly message acknowledging their request
2. A JSON array of 3-5 tasks

Format your response as:
[Friendly message]

TASKS:
[JSON array here]

Each task should have: title, subject, difficulty (easy/medium/hard), questionsTarget (5-50)`;

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

        // Extract tasks if present
        const tasksMatch = fullResponse.match(/TASKS:\s*(\[[\s\S]*\])/);
        if (tasksMatch) {
          try {
            tasks = JSON.parse(tasksMatch[1]);
            response = fullResponse.split('TASKS:')[0].trim();
          } catch {
            response = fullResponse;
          }
        } else {
          response = fullResponse;
        }
      } else {
        // General conversation
        const systemPrompt = `You are Buddy, a friendly and encouraging AI study assistant for ${examGoal || 'exam'} preparation.
Be conversational, supportive, and helpful. Keep responses concise (2-3 sentences).
The user has ${daysUntilExam || 'many'} days until their exam.
Recent topics they studied: ${recentTopics.join(', ') || 'None yet'}`;

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.8,
          max_tokens: 512,
        });

        response =
          completion.choices[0]?.message?.content ||
          'I can help you create study tasks! Just ask me.';
      }
    } else {
      // Fallback to Gemini
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service not configured' });
      }

      const isTaskRequest = /create|generate|make|add|suggest|give me|plan/i.test(message);

      const prompt = isTaskRequest
        ? `You are Buddy, a study assistant. User asked: "${message}"
        
Generate 3-5 study tasks for ${examGoal || 'exam'} preparation.
Respond with a friendly message, then "TASKS:" followed by a JSON array.

Example:
Great! I'll create some tasks for you.

TASKS:
[{"title":"...","subject":"...","difficulty":"medium","questionsTarget":20}]`
        : `You are Buddy, a friendly study assistant for ${examGoal || 'exam'} prep.
User said: "${message}"
Respond in 2-3 friendly sentences.`;

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const fullResponse = await result.response.text();

      const tasksMatch = fullResponse.match(/TASKS:\s*(\[[\s\S]*\])/);
      if (tasksMatch) {
        try {
          tasks = JSON.parse(tasksMatch[1]);
          response = fullResponse.split('TASKS:')[0].trim();
        } catch {
          response = fullResponse;
        }
      } else {
        response = fullResponse;
      }
    }

    res.json({
      response,
      tasks: tasks.length > 0 ? tasks : undefined,
      provider: useGroq ? 'groq' : 'gemini',
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

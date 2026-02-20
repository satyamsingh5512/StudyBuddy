import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { generateAIResponse, AIChatMessage } from '../services/aiOrchestrator.js';
import { aiRateLimiter } from '../middleware/rateLimiting.js';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(isAuthenticated);
router.use(aiRateLimiter);

router.post('/study-plan', async (req, res) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = new ObjectId(req.session.userId);

    const user = await (await collections.users).findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const recentReports = await (await collections.dailyReports).find(
      { userId },
      { sort: { date: -1 }, limit: 7 }
    ).toArray();

    const todos = await (await collections.todos).find({ userId, completed: false }).toArray();

    const daysLeft = user.examDate
      ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const avgStudyHours = recentReports.length > 0
      ? recentReports.reduce((sum, r) => sum + (r.studyHours || 0), 0) / recentReports.length
      : 0;

    const avgCompletion = recentReports.length > 0
      ? recentReports.reduce((sum, r) => sum + (r.completionPct || 0), 0) / recentReports.length
      : 0;

    const recentTopics = Array.from(new Set(todos.slice(0, 5).map((t) => t.subject)));

    const prompt = `Generate a personalized study plan for tomorrow for a ${user.examGoal} aspirant.
    
Student stats:
- Days until exam: ${daysLeft}
- Average study hours: ${avgStudyHours.toFixed(1)} hours/day
- Task completion rate: ${avgCompletion.toFixed(0)}%
- Pending tasks: ${todos.length}
${recentTopics.length > 0 ? `- Recent topics: ${recentTopics.join(', ')}` : ''}

Provide:
1. 3-4 specific topics to focus on
2. Question targets by difficulty (easy/medium/hard)
3. Time allocation for each topic
4. One motivational message

Keep it concise and actionable (max 300 words).`;

    const messages: AIChatMessage[] = [
      { role: 'system', content: 'You are an expert study mentor and motivational coach.' },
      { role: 'user', content: prompt }
    ];

    const { response, provider } = await generateAIResponse(messages, 0.8, 800);
    res.json({ plan: response, provider });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate study plan', details: error.message });
  }
});

router.post('/generate-tasks', async (req, res) => {
  try {
    const { prompt, examGoal } = req.body;
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = new ObjectId(req.session.userId);

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const recentTodos = await (await collections.todos).find(
      { userId },
      { sort: { createdAt: -1 }, limit: 10 }
    ).toArray();

    const user = await (await collections.users).findOne({ _id: userId });
    const daysUntilExam = user?.examDate
      ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const recentTopics = Array.from(new Set(recentTodos.map((t) => t.subject)));

    const contextInfo = `
User context:
- Days until exam: ${daysUntilExam || 'Not set'}
- Recent topics: ${recentTopics.join(', ') || 'None'}
`;

    const systemPrompt = `You are an expert study planner for ${examGoal || user?.examGoal || 'exam'} preparation.
Generate specific, actionable study tasks based on the user's request.
${contextInfo}

Return ONLY a valid JSON array with 3-5 tasks. Each task must have:
- title: Clear, specific task (max 100 chars)
- subject: Subject name (Physics, Chemistry, Math, Biology, etc.)
- difficulty: "easy", "medium", or "hard"
- questionsTarget: Number between 5-50`;

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const { response, provider } = await generateAIResponse(messages, 0.7, 1024);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const parsedTasks = JSON.parse(jsonMatch[0]);
    const validTasks = parsedTasks.map((t: any) => ({
      userId,
      title: t.title?.substring(0, 100) || 'Study task',
      subject: t.subject || 'General',
      difficulty: ['easy', 'medium', 'hard'].includes(t.difficulty) ? t.difficulty : 'medium',
      questionsTarget: Math.min(Math.max(t.questionsTarget || 10, 5), 50),
      completed: false,
      questionsCompleted: 0,
      rescheduledCount: 0,
      scheduledDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    if (validTasks.length > 0) {
      await (await collections.todos).insertMany(validTasks);
    }

    res.json({ success: true, tasks: validTasks, provider });
  } catch (error: any) {
    console.error('AI task generation error:', error);
    res.status(500).json({
      error: 'Failed to generate tasks',
      details: error.message || 'Unknown error',
    });
  }
});

router.post('/exam-date', async (req, res) => {
  try {
    const { examType, batch } = req.body;

    if (!examType) {
      return res.status(400).json({ error: 'Exam type is required' });
    }

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

    const messages: AIChatMessage[] = [
      { role: 'system', content: 'You are an expert on Indian competitive exam schedules. Provide accurate, up-to-date exam dates from official sources.' },
      { role: 'user', content: prompt }
    ];

    try {
      const { response } = await generateAIResponse(messages, 0.3, 256);
      const jsonMatch = response.match(/\{[\s\S]*?\}/);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        console.log(`📅 Exam date fetched for ${examType}:`, data.examDate);
        return res.json(data);
      }
    } catch (e) {
      console.error('AI fetch failed, using fallback dates.');
    }

    // Fallback if parsing fails or AI throws
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
    res.status(500).json({ error: 'Failed to fetch exam dates' });
  }
});

router.post('/buddy-chat', async (req, res) => {
  try {
    const { message, examGoal } = req.body;
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = new ObjectId(req.session.userId);

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const user = await (await collections.users).findOne({ _id: userId });
    const recentTodos = await (await collections.todos).find(
      { userId },
      { sort: { createdAt: -1 }, limit: 5 }
    ).toArray();

    const recentTopics = Array.from(new Set(recentTodos.map((t) => t.subject)));
    const daysUntilExam = user?.examDate
      ? Math.ceil((user.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : undefined;

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

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    const { response: fullResponse, provider } = await generateAIResponse(messages, 0.7, 1024);

    let response = fullResponse;
    let tasks: any[] = [];

    const parts = fullResponse.split('TASKS_JSON:');
    if (parts.length > 1) {
      response = parts[0].trim();
      const jsonPart = parts[1].trim();
      try {
        const jsonMatch = jsonPart.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedTasks = JSON.parse(jsonMatch[0]);
          tasks = parsedTasks.filter((t: any) =>
            t && typeof t === 'object' && typeof t.title === 'string'
          ).map((t: any) => ({
            title: t.title,
            subject: t.subject || 'General',
            difficulty: t.difficulty || 'medium',
            questionsTarget: t.questionsTarget || 10,
          }));
        }
      } catch (e) {
        console.error('Failed to parse tasks JSON:', e);
      }
    }

    res.json({
      response,
      tasks: tasks.length > 0 ? tasks : undefined,
      provider,
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

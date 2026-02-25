import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { generateAIResponse, AIChatMessage } from '../services/aiOrchestrator.js';
import { aiRateLimiter } from '../middleware/rateLimiting.js';
import { collections } from '../db/collections.js';
import { ObjectId } from 'mongodb';

const router = Router();

router.use(isAuthenticated);
router.use(aiRateLimiter);


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
    const isConfigError = error.message?.includes('GEMINI_API_KEY') || error.message?.includes('No AI providers');
    res.status(isConfigError ? 503 : 500).json({
      error: isConfigError
        ? 'AI service is not configured on the server. Please add GEMINI_API_KEY to Render environment variables.'
        : 'Failed to get response from Buddy',
      details: error.message || 'Unknown error',
    });
  }
});

export default router;

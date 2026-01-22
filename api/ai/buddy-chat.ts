import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, setCorsHeaders } from '../_lib/auth';
import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { message, examGoal } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!groq) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const systemPrompt = `You are Buddy, a friendly AI study assistant for ${examGoal || 'exam'} preparation. 
You help students create study tasks, suggest topics, and plan their study schedule.
When asked to create tasks, respond with a JSON array of tasks in this format:
{ "response": "your message", "tasks": [{ "title": "task title", "subject": "subject", "difficulty": "easy|medium|hard", "questionsTarget": 10 }] }
Keep responses concise and encouraging.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Try to parse as JSON for task suggestions
    try {
      const parsed = JSON.parse(responseText);
      return res.status(200).json(parsed);
    } catch {
      // Return as plain text response
      return res.status(200).json({ response: responseText, tasks: [] });
    }
  } catch (error) {
    console.error('Buddy chat error:', error);
    return res.status(500).json({ error: 'Failed to get AI response' });
  }
}

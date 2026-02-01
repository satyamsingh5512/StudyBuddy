import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GeneratedTask {
  title: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionsTarget: number;
}

export async function generateTasksWithGemini(
  prompt: string,
  examGoal: string,
  userContext?: {
    recentTopics?: string[];
    weakAreas?: string[];
    daysUntilExam?: number;
  }
): Promise<GeneratedTask[]> {
  const contextInfo = userContext
    ? `
User context:
- Days until exam: ${userContext.daysUntilExam || 'Not set'}
- Recent topics: ${userContext.recentTopics?.join(', ') || 'None'}
- Weak areas: ${userContext.weakAreas?.join(', ') || 'None'}
`
    : '';

  const systemPrompt = `You are an expert study planner for ${examGoal} exam preparation.
Generate specific, actionable study tasks based on the user's request.
${contextInfo}

Return ONLY a valid JSON array with 3-5 tasks. Each task must have:
- title: Clear, specific task (max 100 chars)
- subject: Subject name (Physics, Chemistry, Math, Biology, etc.)
- difficulty: "easy", "medium", or "hard"
- questionsTarget: Number between 5-50

Example format:
[
  {"title": "Solve projectile motion problems", "subject": "Physics", "difficulty": "medium", "questionsTarget": 20},
  {"title": "Practice redox reactions", "subject": "Chemistry", "difficulty": "hard", "questionsTarget": 15}
]`;

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const result = await model.generateContent(`${systemPrompt}\n\nUser request: ${prompt}`);
  const response = result.response.text();

  // Extract JSON from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const tasks = JSON.parse(jsonMatch[0]);

  // Validate tasks
  return tasks.map((task: any) => ({
    title: task.title?.substring(0, 100) || 'Study task',
    subject: task.subject || 'General',
    difficulty: ['easy', 'medium', 'hard'].includes(task.difficulty)
      ? task.difficulty
      : 'medium',
    questionsTarget: Math.min(Math.max(task.questionsTarget || 10, 5), 50),
  }));
}

export async function generateStudyPlanWithGemini(
  examGoal: string,
  userStats: {
    daysLeft: number;
    avgStudyHours: number;
    avgCompletion: number;
    pendingTasks: number;
    recentTopics?: string[];
  }
): Promise<string> {
  const prompt = `Generate a personalized study plan for tomorrow for a ${examGoal} aspirant.

Student stats:
- Days until exam: ${userStats.daysLeft}
- Average study hours: ${userStats.avgStudyHours.toFixed(1)} hours/day
- Task completion rate: ${userStats.avgCompletion.toFixed(0)}%
- Pending tasks: ${userStats.pendingTasks}
${userStats.recentTopics ? `- Recent topics: ${userStats.recentTopics.join(', ')}` : ''}

Provide:
1. 3-4 specific topics to focus on
2. Question targets by difficulty (easy/medium/hard)
3. Time allocation for each topic
4. One motivational message

Keep it concise and actionable (max 300 words).`;

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);

  return result.response.text() || 'Unable to generate study plan.';
}

export async function chatWithGemini(
  message: string,
  systemPrompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const result = await model.generateContent(`${systemPrompt}\n\nUser: ${message}`);
  return result.response.text();
}

export { genAI };

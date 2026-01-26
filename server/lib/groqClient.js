"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groq = void 0;
exports.generateTasksWithGroq = generateTasksWithGroq;
exports.generateStudyPlan = generateStudyPlan;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const groq = new groq_sdk_1.default({
    apiKey: process.env.GROQ_API_KEY || '',
});
exports.groq = groq;
async function generateTasksWithGroq(prompt, examGoal, userContext) {
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
    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
    });
    const response = completion.choices[0]?.message?.content || '';
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
    }
    const tasks = JSON.parse(jsonMatch[0]);
    // Validate tasks
    return tasks.map((task) => ({
        title: task.title?.substring(0, 100) || 'Study task',
        subject: task.subject || 'General',
        difficulty: ['easy', 'medium', 'hard'].includes(task.difficulty)
            ? task.difficulty
            : 'medium',
        questionsTarget: Math.min(Math.max(task.questionsTarget || 10, 5), 50),
    }));
}
async function generateStudyPlan(examGoal, userStats) {
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
    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: 'You are an expert study mentor and motivational coach.' },
            { role: 'user', content: prompt },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8,
        max_tokens: 800,
    });
    return completion.choices[0]?.message?.content || 'Unable to generate study plan.';
}

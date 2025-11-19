"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const generative_ai_1 = require("@google/generative-ai");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
router.use(auth_1.isAuthenticated);
router.post('/study-plan', async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
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
        const avgStudyHours = recentReports.reduce((sum, r) => sum + r.studyHours, 0) / (recentReports.length || 1);
        const avgCompletion = recentReports.reduce((sum, r) => sum + r.completionPct, 0) / (recentReports.length || 1);
        const prompt = `You are a mentor for ${user.examGoal} aspirants. The student has ${daysLeft} days until exam.
They've been studying ${avgStudyHours.toFixed(1)} hours daily on average with ${avgCompletion.toFixed(0)}% task completion.
They have ${todos.length} pending tasks. Generate a personalized study plan for tomorrow with:
1. Specific topics to focus on
2. Question targets by difficulty
3. Time allocation
4. Motivational message

Keep it concise and actionable.`;
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({ plan: text });
    }
    catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ error: 'Failed to generate study plan' });
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
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Try to parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            res.json(data);
        }
        else {
            res.json({ raw: text });
        }
    }
    catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ error: 'Failed to fetch exam information' });
    }
});
exports.default = router;

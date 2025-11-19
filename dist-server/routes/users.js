"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(auth_1.isAuthenticated);
router.get('/leaderboard', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { totalPoints: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                avatar: true,
                totalPoints: true,
                streak: true,
            },
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
router.patch('/profile', async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: req.body,
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
router.post('/onboarding', async (req, res) => {
    try {
        const { username, avatarType, avatar, examGoal, studentClass, batch, examAttempt } = req.body;
        const userId = req.user.id;
        // Check if username is already taken
        if (username) {
            const existing = await prisma.user.findUnique({
                where: { username },
            });
            if (existing && existing.id !== userId) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }
        // Fetch exam date and syllabus from AI
        let examDate = null;
        let syllabus = null;
        try {
            const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
            const prompt = `Provide information about ${examGoal} exam for batch ${batch} in JSON format:
{
  "examDate": "Expected exam date in YYYY-MM-DD format",
  "syllabus": {
    "subjects": [
      {"name": "Subject", "topics": ["Topic1", "Topic2"], "weightage": "X%"}
    ]
  }
}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                examDate = data.examDate ? new Date(data.examDate) : null;
                syllabus = JSON.stringify(data.syllabus);
            }
        }
        catch (aiError) {
            console.error('AI fetch error:', aiError);
            // Continue without AI data
        }
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                username,
                avatarType,
                avatar,
                examGoal,
                studentClass,
                batch,
                examAttempt,
                examDate,
                syllabus,
                onboardingDone: true,
            },
        });
        res.json(user);
    }
    catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});
exports.default = router;

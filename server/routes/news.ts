import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { newsRateLimiter } from '../middleware/rateLimiting.js';

const router = Router();

router.use(isAuthenticated);

// Apply news rate limiter to all news routes
router.use(newsRateLimiter);

// Cache for news to avoid excessive API calls
const newsCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_DURATION = 3600000; // 1 hour

const getGeminiModel = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

router.get('/:examType', async (req, res) => {
  try {
    const { examType } = req.params;
    const validExams = ['JEE', 'NEET', 'GATE', 'UPSC', 'CAT', 'NDA', 'CLAT'];

    if (!validExams.includes(examType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid exam type' });
    }

    // Check cache
    const cached = newsCache.get(examType.toUpperCase());
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json({ news: cached.data, cached: true });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'News service not configured' });
    }

    const prompt = `System Instructions: You are an educational news curator specializing in competitive exams in India.

User Request: Generate 5 recent and relevant news updates for ${examType.toUpperCase()} exam aspirants.
Include:
- Exam date announcements
- Syllabus changes
- Important notifications
- Study tips
- Success stories or motivational updates

Return EXACTLY as a JSON array with no markdown formatting:
[
  {
    "title": "News headline",
    "content": "Brief description (2-3 sentences)",
    "category": "announcement",
    "date": "YYYY-MM-DD",
    "source": "Official source or general"
  }
]

Make it realistic and helpful for current ${examType.toUpperCase()} aspirants.`;

    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    });

    const response = result.response.text();
    const jsonMatch = response.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse news response' });
    }

    const news = JSON.parse(jsonMatch[0]);

    // Cache the result
    newsCache.set(examType.toUpperCase(), {
      data: news,
      timestamp: Date.now(),
    });

    res.json({ news, cached: false });
  } catch (error: any) {
    console.error('News generation error:', error);
    res.status(500).json({
      error: 'Failed to fetch news',
      details: error.message
    });
  }
});

// Get exam-specific important dates
router.get('/:examType/dates', async (req, res) => {
  try {
    const { examType } = req.params;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Service not configured' });
    }

    const prompt = `System Instructions: You are an expert on Indian competitive exam schedules and timelines.

User Request: Provide important dates for ${examType.toUpperCase()} exam for the current academic year.

Return EXACTLY as a JSON object with no markdown formatting:
{
  "examName": "${examType.toUpperCase()}",
  "dates": [
    {
      "event": "Event name",
      "date": "YYYY-MM-DD",
      "description": "Brief description"
    }
  ]
}

Include: Registration dates, exam dates, result dates, counseling dates.`;

    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1000,
      }
    });

    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse dates response' });
    }

    const dates = JSON.parse(jsonMatch[0]);
    res.json(dates);
  } catch (error: any) {
    console.error('Dates fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch important dates',
      details: error.message
    });
  }
});

// Clear cache endpoint (admin only - you can add admin middleware)
router.post('/cache/clear', async (_req, res) => {
  newsCache.clear();
  res.json({ success: true, message: 'News cache cleared' });
});

export default router;

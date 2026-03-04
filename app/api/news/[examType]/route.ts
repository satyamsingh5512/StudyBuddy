import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

const newsCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 3600000; // 1 hour

export async function GET(request: NextRequest, { params }: { params: { examType: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const examTypeUpper = params.examType.toUpperCase();
    const validExams = ['JEE', 'NEET', 'GATE', 'UPSC', 'CAT', 'NDA', 'CLAT'];

    if (!validExams.includes(examTypeUpper)) {
      return NextResponse.json({ error: 'Invalid exam type' }, { status: 400 });
    }

    const currentTime = Date.now();
    const cachedEntry = newsCache.get(examTypeUpper);

    if (cachedEntry && currentTime - cachedEntry.timestamp < CACHE_DURATION) {
      return NextResponse.json({ news: cachedEntry.data, cached: true });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'News service not configured' }, { status: 503 });
    }

    const prompt = `System Instructions: You are an educational news curator specializing in competitive exams in India.
User Request: Generate 5 recent and relevant news updates for ${examTypeUpper} exam aspirants.
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

Make it realistic and helpful for current ${examTypeUpper} aspirants.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Gemini API Error: ${errText}` }, { status: 500 });
    }

    const geminiRes = await res.json();
    const responseText = geminiRes.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';

    const startIdx = responseText.indexOf('[');
    const endIdx = responseText.lastIndexOf(']');

    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = responseText.substring(startIdx, endIdx + 1);
      try {
        const parsedNews = JSON.parse(jsonStr);
        newsCache.set(examTypeUpper, { data: parsedNews, timestamp: currentTime });
        return NextResponse.json({ news: parsedNews, cached: false });
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse news response' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Failed to extract JSON from response' }, { status: 500 });
    }
  } catch (error) {
    console.error('News error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

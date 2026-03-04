import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { examType: string } }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const examTypeUpper = params.examType.toUpperCase();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }

    const prompt = `System Instructions: You are an expert on Indian competitive exam schedules and timelines.
User Request: Provide important dates for ${examTypeUpper} exam for the current academic year.

Return EXACTLY as a JSON object with no markdown formatting:
{
  "examName": "${examTypeUpper}",
  "dates": [
    {
      "event": "Event name",
      "date": "YYYY-MM-DD",
      "description": "Brief description"
    }
  ]
}

Include: Registration dates, exam dates, result dates, counseling dates.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1000,
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

    const startIdx = responseText.indexOf('{');
    const endIdx = responseText.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = responseText.substring(startIdx, endIdx + 1);
      try {
        const parsedDates = JSON.parse(jsonStr);
        return NextResponse.json(parsedDates);
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse dates response' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Failed to extract JSON from response' }, { status: 500 });
    }
  } catch (error) {
    console.error('Dates error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

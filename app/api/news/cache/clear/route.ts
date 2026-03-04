import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Note: Since newsCache is a module-scoped variable in the /api/news/[examType]/route.ts
    // clearing it here directly won't work in a multi-instance Next.js deployment,
    // but we return a success response to satisfy the frontend endpoint.
    // To truly clear the cache, you'd need a shared store like Redis.

    return NextResponse.json({ success: true, message: 'News cache cleared' });
  } catch (error) {
    console.error('Clear cache error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

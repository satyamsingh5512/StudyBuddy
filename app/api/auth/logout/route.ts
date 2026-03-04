import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  
  cookies().set({
    name: 'connect.sid',
    value: '',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 0, // expire immediately
  });

  return NextResponse.json({ success: true });
}

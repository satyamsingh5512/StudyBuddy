import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Unauthorized' }, { status: 401 });
    }

    const safeUser = { ...user };
    delete safeUser.password;
    delete safeUser.verificationOtp;
    delete safeUser.resetToken;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

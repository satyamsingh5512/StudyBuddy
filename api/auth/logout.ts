import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie, setCorsHeaders } from '../_lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  clearAuthCookie(res);
  return res.status(200).json({ success: true });
}

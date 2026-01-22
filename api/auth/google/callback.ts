import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { createToken, setAuthCookie } from '../../_lib/auth';

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${clientUrl}?error=auth_failed`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${clientUrl}?error=no_code`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 
      `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${clientUrl}?error=oauth_not_configured`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return res.redirect(`${clientUrl}?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json() as GoogleTokenResponse;

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return res.redirect(`${clientUrl}?error=user_info_failed`);
    }

    const googleUser = await userInfoResponse.json() as GoogleUserInfo;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          examDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Create JWT token
    const token = await createToken(user.id);
    
    // Set cookie and redirect
    setAuthCookie(res, token);
    
    return res.redirect(clientUrl);
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${clientUrl}?error=auth_error`);
  }
}

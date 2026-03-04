import { SignJWT, jwtVerify } from 'jose';

const getSecret = () => {
  const secret = process.env.SESSION_SECRET || 'supersecret_studybuddy_dev_key';
  return new TextEncoder().encode(secret);
};

export interface Claims {
  sub: string;
  email: string;
  role: string;
  exp?: number;
}

export async function createJWT(userId: string, email: string, role: string): Promise<string> {
  const jwt = await new SignJWT({ sub: userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
  return jwt;
}

export async function verifyJWT(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as Claims;
}

import { NextRequest } from 'next/server';
import { verifyJWT } from './jwt';
import clientPromise from './db';
import { ObjectId } from 'mongodb';

export async function getUserFromRequest(request: NextRequest) {
  let token = request.cookies.get('connect.sid')?.value;

  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return null;
  }

  try {
    const claims = await verifyJWT(token);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const user = await db.collection('users').findOne({ _id: new ObjectId(claims.sub) });

    if (!user) {
      return null;
    }

    // Convert _id to string for Next.js serialization
    return { ...user, _id: user._id.toString(), id: user._id.toString() };
  } catch (error) {
    console.error('Auth Error:', error);
    return null;
  }
}

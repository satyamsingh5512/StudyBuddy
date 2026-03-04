import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import clientPromise from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const avatar = formData.get('avatar') as File;

    if (!avatar) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const userId = new ObjectId(user._id);

    // Placeholder: Mock upload behavior just like the Rust version
    // If you add real Cloudinary, implement the signed upload here
    const secureUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=\${userId.toString()}_mock`;

    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');

    await usersColl.updateOne(
      { _id: userId },
      { $set: { avatar: secureUrl, avatarType: 'upload', updatedAt: new Date() } }
    );

    return NextResponse.json({ avatar: secureUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = new ObjectId(user._id);
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const usersColl = db.collection('users');

    await usersColl.updateOne(
      { _id: userId },
      { 
        $set: { avatarType: 'generated', updatedAt: new Date() },
        $unset: { avatar: '' }
      }
    );

    return NextResponse.json({ avatar: null });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

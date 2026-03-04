import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { examType: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db('studybuddy');
    const coll = db.collection('faqs');

    const filter: any = { published: true };
    if (params.examType && params.examType !== 'all') {
      filter.examType = params.examType;
    }

    const faqs = await coll.find(filter).toArray();

    const response = faqs.map(f => ({
      ...f,
      _id: undefined,
      id: f._id.toString()
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get FAQs error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

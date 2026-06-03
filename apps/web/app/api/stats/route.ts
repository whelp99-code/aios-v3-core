import { NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  return NextResponse.json(getAIOS().getStats());
}

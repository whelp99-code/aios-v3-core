import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') as
    | 'skill'
    | 'adapter'
    | 'plugin'
    | 'model-config'
    | null;

  const contributions = getAIOS().community.list(type ?? undefined);
  return NextResponse.json({ contributions });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, author, description, version } = body;

    if (!type || !name || !author) {
      return NextResponse.json({ error: 'type, name, author required' }, { status: 400 });
    }

    const contribution = getAIOS().community.publish({
      type,
      name,
      author,
      description: description ?? '',
      version: version ?? '1.0',
    });

    return NextResponse.json({ contribution });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 }
    );
  }
}

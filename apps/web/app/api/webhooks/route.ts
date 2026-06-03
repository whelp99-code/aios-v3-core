import { NextRequest, NextResponse } from 'next/server';
import { getAIOS } from '@/lib/aios';

export async function GET() {
  return NextResponse.json({ subscriptions: getAIOS().webhooks.getSubscriptions() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, events, secret } = body;

    if (!url || !events?.length) {
      return NextResponse.json({ error: 'url and events required' }, { status: 400 });
    }

    const sub = getAIOS().webhooks.subscribe(url, events, secret);
    return NextResponse.json({ subscription: sub });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook subscription failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const removed = getAIOS().webhooks.unsubscribe(id);
  return NextResponse.json({ removed });
}

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const LM_STUDIO_URL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
const MODEL = process.env.LM_STUDIO_MODEL || 'qwen/qwen3.5-9b';

export async function POST(request: NextRequest) {
  try {
    const { messages, tools } = await request.json();

    const response = await axios.post(`${LM_STUDIO_URL}/chat/completions`, {
      model: MODEL,
      messages,
      tools: tools || undefined,
      tool_choice: tools ? 'auto' : undefined,
      stream: false,
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const message = axios.isAxiosError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Failed to process chat request';
    console.error('Chat API error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

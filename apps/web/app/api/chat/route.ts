import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const RAPID_MLX_URL = process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1';
const MODEL = process.env.RAPID_MLX_MODEL || 'qwen3.5-9b-4bit';

export async function POST(request: NextRequest) {
  try {
    const { messages, tools } = await request.json();

    const response = await axios.post(`${RAPID_MLX_URL}/chat/completions`, {
      model: MODEL,
      messages,
      tools: tools || undefined,
      tool_choice: tools ? 'auto' : undefined,
      stream: false,
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Chat API error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

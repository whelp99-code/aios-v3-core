import { NextResponse } from 'next/server';
import axios from 'axios';

const RAPID_MLX_URL = process.env.RAPID_MLX_BASE_URL || 'http://localhost:8000/v1';

export async function GET() {
  try {
    const response = await axios.get(`${RAPID_MLX_URL}/models`, {
      timeout: 5000,
    });

    return NextResponse.json({
      status: 'healthy',
      engine: 'rapid-mlx',
      models: response.data.data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check error:', error.message);
    return NextResponse.json(
      {
        status: 'unhealthy',
        engine: 'rapid-mlx',
        error: error.message || 'Rapid-MLX server not responding',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

import { NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${GATEWAY}/api/media/live-briefing`, {
      next: { revalidate: 300 },
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
      },
    });
  } catch (err) {
    console.error('Media briefing proxy error:', err);
    return NextResponse.json(
      { generated_at: new Date().toISOString(), sources: [] },
      { status: 503 }
    );
  }
}

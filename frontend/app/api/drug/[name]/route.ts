import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  try {
    const res = await fetch(`${GATEWAY}/api/drug/${encodeURIComponent(name)}`, {
      headers: { 'Accept-Encoding': 'gzip' },
      next: { revalidate: 3600 },
    });

    const data = await res.json();

    return NextResponse.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    console.error('Drug proxy error:', err);
    return NextResponse.json(
      { error: 'Gateway unavailable' },
      { status: 503 }
    );
  }
}

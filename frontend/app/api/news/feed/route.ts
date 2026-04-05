import { NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${GATEWAY}/api/v1/news-feed?limit=40`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json([], { status: 503 });
  }
}

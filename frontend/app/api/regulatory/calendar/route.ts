import { NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${GATEWAY}/api/v1/regulatory-calendar?limit=20`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json([], { status: 503 });
  }
}

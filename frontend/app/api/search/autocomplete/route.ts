import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix') || '';

  if (!prefix || prefix.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const res = await fetch(
      `${GATEWAY}/api/search/autocomplete?prefix=${encodeURIComponent(prefix)}`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('Autocomplete proxy error:', err);
    return NextResponse.json([], { status: 200 });
  }
}

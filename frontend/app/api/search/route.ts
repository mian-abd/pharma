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
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Search proxy error:', err);
    return NextResponse.json([], { status: 200 });
  }
}

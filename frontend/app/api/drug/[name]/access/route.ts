import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const rxcui = request.nextUrl.searchParams.get('rxcui') || name;
  const drugName = request.nextUrl.searchParams.get('drug_name') || name;

  try {
    const res = await fetch(
      `${GATEWAY}/api/drug/${encodeURIComponent(rxcui)}/access?drug_name=${encodeURIComponent(drugName)}`,
      { next: { revalidate: 7776000 } }
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch (err) {
    console.error('Access panel proxy error:', err);
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 503 });
  }
}

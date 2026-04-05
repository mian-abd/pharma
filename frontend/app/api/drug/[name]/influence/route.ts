import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const rxcui = request.nextUrl.searchParams.get('rxcui') || name;
  const drugName = request.nextUrl.searchParams.get('drug_name') || name;
  const drugClass = request.nextUrl.searchParams.get('drug_class') || '';

  try {
    const res = await fetch(
      `${GATEWAY}/api/drug/${encodeURIComponent(rxcui)}/influence?drug_name=${encodeURIComponent(drugName)}&drug_class=${encodeURIComponent(drugClass)}`,
      { next: { revalidate: 604800 } }
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=1209600' },
    });
  } catch (err) {
    console.error('Influence panel proxy error:', err);
    return NextResponse.json({ error: 'Gateway unavailable' }, { status: 503 });
  }
}

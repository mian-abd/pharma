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
      `${GATEWAY}/api/drug/${encodeURIComponent(rxcui)}/ml?drug_name=${encodeURIComponent(drugName)}&drug_class=${encodeURIComponent(drugClass)}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (err) {
    console.error('ML panel proxy error:', err);
    return NextResponse.json({ feature_flag_enabled: false, trial_predictions: [], similar_drugs: [] }, { status: 200 });
  }
}

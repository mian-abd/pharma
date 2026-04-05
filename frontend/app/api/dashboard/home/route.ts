import { NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${GATEWAY}/api/dashboard/home`, {
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('Dashboard home proxy error:', err);
    return NextResponse.json(
      { error: 'Gateway unavailable', trending_drugs: [], global_alerts: [], source_health: [], featured_watchlist: [], market_movers: [], ticker_items: [] },
      { status: 503 }
    );
  }
}

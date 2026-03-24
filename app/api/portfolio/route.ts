import { NextRequest, NextResponse } from "next/server";
import { loadPortfolioSnapshot } from "@/lib/polygon";
import { WatchlistEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseHoldings(body: unknown): WatchlistEntry[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const candidate = body as { holdings?: unknown };
  if (!Array.isArray(candidate.holdings)) {
    return [];
  }

  const holdings: WatchlistEntry[] = [];

  for (const item of candidate.holdings) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const entry = item as Partial<WatchlistEntry>;
    const symbol = entry.symbol?.trim().toUpperCase();
    const shares = Number(entry.shares);
    const avgPriceUsd = Number(entry.avgPriceUsd);

    if (!symbol || !Number.isFinite(shares) || shares <= 0) {
      continue;
    }

    holdings.push({
      symbol,
      name: entry.name?.trim() || symbol,
      exchange: entry.exchange?.trim() || "",
      shares,
      avgPriceUsd: Number.isFinite(avgPriceUsd) && avgPriceUsd > 0 ? avgPriceUsd : 0,
      note: entry.note?.trim() || ""
    });
  }

  return holdings;
}

export async function POST(request: NextRequest) {
  if (!process.env.POLYGON_API_KEY) {
    return NextResponse.json(
      {
        message: "POLYGON_API_KEY 환경 변수가 필요합니다. .env.local에 키를 넣은 뒤 다시 시도해 주세요."
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const holdings = parseHoldings(body);

  if (!holdings.length) {
    return NextResponse.json(
      { message: "최소 1개 이상의 보유 종목과 수량을 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const snapshot = await loadPortfolioSnapshot(holdings);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "포트폴리오 데이터를 가져오지 못했습니다."
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { loadStockChart } from "@/lib/polygon";
import { StockChartResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";

  if (!symbol) {
    return NextResponse.json({ message: "차트를 조회할 종목 코드를 전달해 주세요." }, { status: 400 });
  }

  try {
    const series = await loadStockChart(symbol);
    const payload: StockChartResponse = {
      symbol,
      series,
      asOf: new Date().toISOString()
    };

    if (!series.length) {
      payload.message = "차트: 값이 없습니다";
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({
      symbol,
      series: [],
      asOf: new Date().toISOString(),
      message: error instanceof Error ? `차트: ${error.message}` : "차트: 값이 없습니다"
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { loadStockChart } from "@/lib/twelve-data";
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

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "차트 데이터를 가져오지 못했습니다."
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { loadExchangeRateToKrw, loadStockQuote } from "@/lib/twelve-data";
import { BaseStockSnapshot, StocksApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_SYMBOLS = 12;

export async function GET(request: NextRequest) {
  const symbolText = request.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      symbolText
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_SYMBOLS);

  if (!symbols.length) {
    return NextResponse.json(
      { message: "최소 1개 이상의 종목 코드를 입력해 주세요." },
      { status: 400 }
    );
  }

  if (!process.env.TWELVE_DATA_API_KEY) {
    return NextResponse.json(
      {
        message:
          "TWELVE_DATA_API_KEY 환경 변수가 필요합니다. .env.local에 키를 넣은 뒤 다시 시도해 주세요."
      },
      { status: 500 }
    );
  }

  const settled = await Promise.allSettled(symbols.map((symbol) => loadStockQuote(symbol)));

  const baseItems: BaseStockSnapshot[] = [];
  const payload: StocksApiResponse = {
    items: [],
    errors: [],
    asOf: new Date().toISOString()
  };

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      baseItems.push(result.value);
      return;
    }

    payload.errors.push({
      symbol: symbols[index],
      message: result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"
    });
  });

  const uniqueCurrencies = Array.from(
    new Set(baseItems.map((item) => item.currency.toUpperCase()).filter(Boolean))
  );
  const exchangeRateResults = await Promise.allSettled(
    uniqueCurrencies.map(async (currency) => [currency, await loadExchangeRateToKrw(currency)] as const)
  );
  const exchangeRateMap = new Map<string, number>();

  exchangeRateResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      exchangeRateMap.set(result.value[0], result.value[1]);
      return;
    }

    payload.errors.push({
      symbol: uniqueCurrencies[index],
      message: result.reason instanceof Error ? result.reason.message : "환율 조회 실패"
    });
  });

  payload.items = baseItems.map((item) => {
    const fxRateToKrw = exchangeRateMap.get(item.currency.toUpperCase()) ?? 1;

    return {
      ...item,
      fxRateToKrw,
      priceKrw: item.price * fxRateToKrw
    };
  });

  return NextResponse.json(payload);
}

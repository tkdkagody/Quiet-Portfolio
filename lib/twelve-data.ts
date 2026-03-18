import { BaseStockSnapshot, StockSeriesPoint, SymbolSearchResult } from "@/lib/types";

const API_BASE = "https://api.twelvedata.com";

type TwelveDataQuote = {
  symbol?: string;
  name?: string;
  currency?: string;
  exchange?: string;
  close?: string;
  change?: string;
  percent_change?: string;
  open?: string;
  high?: string;
  low?: string;
  previous_close?: string;
  volume?: string;
  datetime?: string;
  code?: number;
  message?: string;
  status?: string;
};

type TwelveDataSeries = {
  meta?: {
    symbol?: string;
    currency?: string;
    exchange?: string;
  };
  values?: Array<{
    datetime?: string;
    close?: string;
  }>;
  code?: number;
  message?: string;
  status?: string;
};

type TwelveDataCurrencyConversion = {
  symbol?: string;
  rate?: number | string;
  amount?: number | string;
  timestamp?: number;
  code?: number;
  message?: string;
  status?: string;
};

type TwelveDataSymbolSearch = {
  data?: Array<{
    symbol?: string;
    instrument_name?: string;
    exchange?: string;
    country?: string;
  }>;
  code?: number;
  message?: string;
  status?: string;
};

function toNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchTwelveData<T>(
  endpoint: string,
  searchParams: Record<string, string>
): Promise<T> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("TWELVE_DATA_API_KEY가 없습니다.");
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: {
      revalidate: 60
    }
  });

  if (!response.ok) {
    throw new Error(`Twelve Data 요청 실패: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeSeries(values: TwelveDataSeries["values"]): StockSeriesPoint[] {
  if (!values?.length) {
    return [];
  }

  return values
    .map((item) => ({
      datetime: item.datetime ?? "",
      close: toNumber(item.close)
    }))
    .filter((item) => item.datetime && Number.isFinite(item.close) && item.close > 0)
    .reverse();
}

export async function loadExchangeRateToKrw(currency: string): Promise<number> {
  if (currency === "KRW") {
    return 1;
  }

  const conversion = await fetchTwelveData<TwelveDataCurrencyConversion>("/currency_conversion", {
    symbol: `${currency}/KRW`,
    amount: "1"
  });

  if (conversion.status === "error" || conversion.code) {
    throw new Error(conversion.message ?? `${currency}/KRW 환율을 가져오지 못했습니다.`);
  }

  return toNumber(conversion.rate || conversion.amount, 0);
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const response = await fetchTwelveData<TwelveDataSymbolSearch>("/symbol_search", {
    symbol: query,
    outputsize: "8"
  });

  if (response.status === "error" || response.code) {
    throw new Error(response.message ?? "종목 검색에 실패했습니다.");
  }

  return (response.data ?? [])
    .map((item) => ({
      symbol: item.symbol ?? "",
      instrumentName: item.instrument_name ?? item.symbol ?? "",
      exchange: item.exchange ?? "",
      country: item.country ?? ""
    }))
    .filter((item) => item.symbol && item.instrumentName);
}

export async function loadStockQuote(symbol: string): Promise<BaseStockSnapshot> {
  const quote = await fetchTwelveData<TwelveDataQuote>("/quote", {
    symbol
  });

  if (quote.status === "error" || quote.code) {
    throw new Error(quote.message ?? `${symbol} 현재가를 가져오지 못했습니다.`);
  }

  return {
    symbol: quote.symbol ?? symbol,
    name: quote.name ?? quote.symbol ?? symbol,
    currency: quote.currency ?? "USD",
    exchange: quote.exchange ?? "",
    price: toNumber(quote.close),
    change: toNumber(quote.change),
    percentChange: toNumber(quote.percent_change),
    open: toNumber(quote.open),
    high: toNumber(quote.high),
    low: toNumber(quote.low),
    previousClose: toNumber(quote.previous_close),
    volume: toNumber(quote.volume),
    lastUpdated: quote.datetime ?? new Date().toISOString()
  };
}

export async function loadStockChart(symbol: string): Promise<StockSeriesPoint[]> {
  const series = await fetchTwelveData<TwelveDataSeries>("/time_series", {
    symbol,
    interval: "1day",
    outputsize: "30",
    timezone: "Asia/Seoul",
    dp: "2"
  });

  if (series.status === "error" || series.code) {
    throw new Error(series.message ?? `${symbol} 차트 데이터를 가져오지 못했습니다.`);
  }

  return normalizeSeries(series.values);
}

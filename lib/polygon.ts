import {
  DividendEvent,
  HoldingSnapshot,
  PortfolioSnapshot,
  StockSeriesPoint,
  StockSnapshot,
  SymbolSearchResult,
  WatchlistEntry
} from "@/lib/types";

const API_BASE = "https://api.polygon.io";

type PolygonTickerSearchResult = {
  ticker?: string;
  name?: string;
  primary_exchange?: string;
  currency_name?: string;
  type?: string;
};

type PolygonAgg = {
  t?: number;
  c?: number | string;
  v?: number | string;
};

type PolygonAggResponse = {
  results?: PolygonAgg[];
  status?: string;
  request_id?: string;
};

type PolygonDividend = {
  ticker?: string;
  cash_amount?: number | string;
  ex_dividend_date?: string;
  record_date?: string;
  declaration_date?: string;
  pay_date?: string;
  frequency?: number;
  dividend_type?: string;
  currency?: string;
};

type PolygonDividendResponse = {
  results?: PolygonDividend[];
  status?: string;
  request_id?: string;
};

function getApiKey() {
  return process.env.POLYGON_API_KEY;
}

function toNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(
    typeof value === "string" ? value.replace(/[^\d.-]/g, "") : value
  );
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDate(value: number | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

function createFallbackQuote(symbol: string): StockSnapshot {
  return {
    symbol,
    name: symbol,
    exchange: "",
    currency: "USD",
    priceUsd: 0,
    changeUsd: 0,
    changePercent: 0,
    volume: 0,
    lastUpdated: new Date().toISOString()
  };
}

async function fetchPolygon<T>(path: string, revalidate = 300): Promise<T> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("POLYGON_API_KEY가 없습니다.");
  }

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: {
      revalidate
    }
  });

  if (!response.ok) {
    throw new Error(`Polygon 요청 실패: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const payload = await fetchPolygon<{ results?: PolygonTickerSearchResult[] }>(
    `/v3/reference/tickers?search=${encodeURIComponent(query)}&market=stocks&active=true&limit=10&order=asc&sort=ticker`,
    3600
  );

  return (payload.results ?? [])
    .map((item) => ({
      symbol: item.ticker ?? "",
      name: item.name ?? item.ticker ?? "",
      exchange: item.primary_exchange ?? "",
      currency: item.currency_name,
      type: item.type
    }))
    .filter((item) => item.symbol && item.name);
}

export async function loadStockChart(symbol: string): Promise<StockSeriesPoint[]> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 90);

  const payload = await fetchPolygon<PolygonAggResponse>(
    `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from.toISOString().slice(0, 10)}/${to.toISOString().slice(0, 10)}?adjusted=true&sort=asc&limit=120`,
    300
  );

  return (payload.results ?? [])
    .map((item) => ({
      date: toIsoDate(item.t),
      price: toNumber(item.c),
      volume: toNumber(item.v)
    }))
    .filter((item) => item.price > 0)
    .slice(-60);
}

async function loadStockQuoteWithWarning(symbol: string): Promise<{ quote: StockSnapshot; warning?: string }> {
  try {
    const series = await loadStockChart(symbol);
    const latest = series.at(-1);
    const previous = series.at(-2);

    if (!latest) {
      return {
        quote: createFallbackQuote(symbol),
        warning: `${symbol} 최근 종가 값이 없습니다`
      };
    }

    const priceUsd = latest.price;
    const previousPrice = previous?.price ?? priceUsd;
    const changeUsd = priceUsd - previousPrice;
    const changePercent = previousPrice > 0 ? (changeUsd / previousPrice) * 100 : 0;

    return {
      quote: {
        symbol,
        name: symbol,
        exchange: "",
        currency: "USD",
        priceUsd,
        changeUsd,
        changePercent,
        volume: latest.volume ?? 0,
        lastUpdated: latest.date
      }
    };
  } catch {
    return {
      quote: createFallbackQuote(symbol),
      warning: `${symbol} 최근 종가 값이 없습니다`
    };
  }
}

async function loadDividendsWithWarning(symbol: string): Promise<{ dividends: DividendEvent[]; warning?: string }> {
  try {
    const payload = await fetchPolygon<PolygonDividendResponse>(
      `/v3/reference/dividends?ticker=${encodeURIComponent(symbol)}&limit=20&order=desc&sort=ex_dividend_date`,
      86400
    );

    return {
      dividends: (payload.results ?? [])
        .map((item) => ({
          symbol: item.ticker ?? symbol,
          date: item.ex_dividend_date ?? "",
          paymentDate: item.pay_date ?? "",
          recordDate: item.record_date ?? "",
          declarationDate: item.declaration_date ?? "",
          dividendPerShare: toNumber(item.cash_amount),
          adjustedDividend: undefined,
          currency: item.currency ?? "USD"
        }))
        .filter((item) => item.date && item.dividendPerShare > 0)
    };
  } catch {
    return {
      dividends: [],
      warning: `${symbol} 배당 정보 값이 없습니다`
    };
  }
}

function estimateAnnualDividendPerShare(dividends: DividendEvent[]) {
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

  const recent = dividends
    .filter((item) => {
      const timestamp = new Date(item.date).getTime();
      return Number.isFinite(timestamp) && timestamp >= oneYearAgo && timestamp <= now;
    })
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  const annual = recent.reduce((sum, item) => sum + item.dividendPerShare, 0);
  return annual > 0 ? annual : dividends[0]?.dividendPerShare ?? 0;
}

function estimateForwardAnnualDividendPerShare(dividends: DividendEvent[]) {
  if (!dividends.length) {
    return 0;
  }

  const latest = dividends[0];
  const frequency = Math.max(1, Math.floor(latest.frequency ?? 0));
  const base = latest.adjustedDividend ?? latest.dividendPerShare;

  if (base > 0) {
    return base * frequency;
  }

  return estimateAnnualDividendPerShare(dividends);
}

export async function loadStockQuote(symbol: string): Promise<StockSnapshot> {
  return (await loadStockQuoteWithWarning(symbol)).quote;
}

export async function loadDividends(symbol: string): Promise<DividendEvent[]> {
  return (await loadDividendsWithWarning(symbol)).dividends;
}

export async function loadHoldingSnapshot(holding: WatchlistEntry): Promise<HoldingSnapshot> {
  const warnings: string[] = [];
  const [quoteResult, dividendResult] = await Promise.all([
    loadStockQuoteWithWarning(holding.symbol),
    loadDividendsWithWarning(holding.symbol)
  ]);

  const quote = {
    ...quoteResult.quote,
    name: holding.name || quoteResult.quote.name,
    exchange: holding.exchange || quoteResult.quote.exchange
  };
  const dividends = dividendResult.dividends;

  if (quoteResult.warning) {
    warnings.push(quoteResult.warning);
  }
  if (dividendResult.warning) {
    warnings.push(dividendResult.warning);
  }

  const annualDividendPerShare = estimateAnnualDividendPerShare(dividends);
  const expectedAnnualDividendPerShare = estimateForwardAnnualDividendPerShare(dividends) || annualDividendPerShare;
  const currentAnnualDividend = annualDividendPerShare * holding.shares;
  const currentMonthlyDividend = currentAnnualDividend / 12;
  const expectedAnnualDividend = expectedAnnualDividendPerShare * holding.shares;
  const expectedMonthlyDividend = expectedAnnualDividend / 12;
  const currentYieldPercent = quote.priceUsd > 0 ? (annualDividendPerShare / quote.priceUsd) * 100 : 0;
  const expectedYieldPercent = quote.priceUsd > 0 ? (expectedAnnualDividendPerShare / quote.priceUsd) * 100 : 0;
  const futureDividend =
    dividends.find((item) => new Date(item.date).getTime() > Date.now()) ??
    dividends[0] ??
    null;

  return {
    holding,
    quote,
    dividends,
    annualDividendPerShare,
    annualDividend: expectedAnnualDividend,
    monthlyDividend: expectedMonthlyDividend,
    yieldPercent: expectedYieldPercent,
    currentAnnualDividendPerShare: annualDividendPerShare,
    currentAnnualDividend,
    currentMonthlyDividend,
    currentYieldPercent,
    expectedAnnualDividendPerShare,
    expectedAnnualDividend,
    expectedMonthlyDividend,
    expectedYieldPercent,
    nextExDate: futureDividend?.date ?? null,
    nextPaymentDate: futureDividend?.paymentDate ?? null,
    warnings: [
      ...warnings,
      ...(quote.priceUsd === 0 ? [`${holding.symbol} 최근 종가 값이 없습니다`] : []),
      ...(dividends.length === 0 ? [`${holding.symbol} 배당 정보 값이 없습니다`] : [])
    ],
    dataStatus: {
      price: quote.priceUsd > 0 ? "ok" : "missing",
      dividends: dividends.length > 0 ? "ok" : "missing"
    }
  };
}

export async function loadPortfolioSnapshot(holdings: WatchlistEntry[]): Promise<PortfolioSnapshot> {
  const settled = await Promise.allSettled(holdings.map((holding) => loadHoldingSnapshot(holding)));
  const items: HoldingSnapshot[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(result.value);
      return;
    }

    const holding = holdings[index];
    if (!holding) {
      return;
    }

    items.push({
      holding,
      quote: createFallbackQuote(holding.symbol),
      dividends: [],
      annualDividendPerShare: 0,
      annualDividend: 0,
      monthlyDividend: 0,
      yieldPercent: 0,
      currentAnnualDividendPerShare: 0,
      currentAnnualDividend: 0,
      currentMonthlyDividend: 0,
      currentYieldPercent: 0,
      expectedAnnualDividendPerShare: 0,
      expectedAnnualDividend: 0,
      expectedMonthlyDividend: 0,
      expectedYieldPercent: 0,
      nextExDate: null,
      nextPaymentDate: null,
      warnings: ["값이 없습니다"],
      dataStatus: {
        price: "missing",
        dividends: "missing"
      }
    });
  });

  const totalCost = items.reduce((sum, item) => sum + item.holding.shares * item.holding.avgPriceUsd, 0);
  const totalValue = items.reduce((sum, item) => sum + item.holding.shares * item.quote.priceUsd, 0);
  const currentAnnualDividend = items.reduce((sum, item) => sum + item.currentAnnualDividend, 0);
  const currentMonthlyDividend = items.reduce((sum, item) => sum + item.currentMonthlyDividend, 0);
  const expectedAnnualDividend = items.reduce((sum, item) => sum + item.expectedAnnualDividend, 0);
  const expectedMonthlyDividend = items.reduce((sum, item) => sum + item.expectedMonthlyDividend, 0);

  return {
    items,
    asOf: new Date().toISOString(),
    totalCost,
    totalValue,
    totalGain: totalValue - totalCost,
    totalAnnualDividend: expectedAnnualDividend,
    totalMonthlyDividend: expectedMonthlyDividend,
    currentAnnualDividend,
    currentMonthlyDividend,
    expectedAnnualDividend,
    expectedMonthlyDividend,
    warnings: items.flatMap((item) => item.warnings ?? [])
  };
}

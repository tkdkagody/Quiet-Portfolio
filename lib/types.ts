export type WatchlistEntry = {
  symbol: string;
  name: string;
  exchange?: string;
  shares: number;
  avgPriceUsd: number;
  note?: string;
};

export type DraftRow = {
  id: string;
  query: string;
  symbol: string;
  name: string;
  exchange: string;
  shares: string;
  avgPriceUsd: string;
  note: string;
};

export type StockSeriesPoint = {
  date: string;
  price: number;
  volume?: number;
};

export type StockSnapshot = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  priceUsd: number;
  changeUsd: number;
  changePercent: number;
  volume: number;
  lastUpdated: string;
};

export type DividendEvent = {
  symbol: string;
  date: string;
  paymentDate: string;
  recordDate: string;
  declarationDate: string;
  dividendPerShare: number;
  adjustedDividend?: number;
  frequency?: number;
  currency: string;
};

export type HoldingSnapshot = {
  holding: WatchlistEntry;
  quote: StockSnapshot;
  dividends: DividendEvent[];
  annualDividendPerShare: number;
  annualDividend: number;
  monthlyDividend: number;
  yieldPercent: number;
  currentAnnualDividendPerShare: number;
  currentAnnualDividend: number;
  currentMonthlyDividend: number;
  currentYieldPercent: number;
  expectedAnnualDividendPerShare: number;
  expectedAnnualDividend: number;
  expectedMonthlyDividend: number;
  expectedYieldPercent: number;
  nextExDate: string | null;
  nextPaymentDate: string | null;
  warnings?: string[];
  dataStatus?: {
    price: "ok" | "missing";
    dividends: "ok" | "missing";
  };
};

export type PortfolioSnapshot = {
  items: HoldingSnapshot[];
  asOf: string;
  totalCost: number;
  totalValue: number;
  totalGain: number;
  totalMonthlyDividend: number;
  totalAnnualDividend: number;
  currentMonthlyDividend: number;
  currentAnnualDividend: number;
  expectedMonthlyDividend: number;
  expectedAnnualDividend: number;
  warnings?: string[];
};

export type SymbolSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  currency?: string;
  type?: string;
};

export type StockChartResponse = {
  symbol: string;
  series: StockSeriesPoint[];
  asOf: string;
  message?: string;
};

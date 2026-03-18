export type WatchlistEntry = {
  symbol: string;
  name: string;
  exchange?: string;
  amountKrw: number;
};

export type DraftRow = {
  id: string;
  query: string;
  symbol: string;
  name: string;
  exchange: string;
  amountKrw: string;
};

export type StockSeriesPoint = {
  datetime: string;
  close: number;
};

export type BaseStockSnapshot = {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number;
  change: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  lastUpdated: string;
};

export type StockSnapshot = BaseStockSnapshot & {
  fxRateToKrw: number;
  priceKrw: number;
};

export type StocksApiResponse = {
  items: StockSnapshot[];
  errors: { symbol: string; message: string }[];
  asOf: string;
};

export type SymbolSearchResult = {
  symbol: string;
  instrumentName: string;
  exchange: string;
  country: string;
};

export type StockChartResponse = {
  symbol: string;
  series: StockSeriesPoint[];
  asOf: string;
};

import { DraftRow, WatchlistEntry } from "@/lib/types";

export const STORAGE_KEY = "deskfolio-watchlist-v5";
export const THEME_STORAGE_KEY = "deskfolio-theme";
const LEGACY_STORAGE_KEYS = [
  "stock-board-budget-watchlist-v4",
  "stock-board-budget-watchlist-v3",
  "stock-board-budget-watchlist-v2"
];

export const DEFAULT_WATCHLIST: WatchlistEntry[] = [
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", exchange: "NYSE", shares: 10, avgPriceUsd: 75 },
  { symbol: "KO", name: "Coca-Cola Co", exchange: "NYSE", shares: 8, avgPriceUsd: 58 }
];

export function createDraftRow(entry?: Partial<WatchlistEntry>): DraftRow {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    query: entry?.name ?? entry?.symbol ?? "",
    symbol: entry?.symbol ?? "",
    name: entry?.name ?? "",
    exchange: entry?.exchange ?? "",
    shares: entry?.shares ? String(entry.shares) : "",
    avgPriceUsd: entry?.avgPriceUsd ? String(entry.avgPriceUsd) : "",
    note: entry?.note ?? ""
  };
}

export function normalizeNumericInput(input: string) {
  return input.replace(/[^\d.]/g, "");
}

function parseLegacyHolding(entry: Record<string, unknown>): WatchlistEntry | null {
  const symbol = typeof entry.symbol === "string" ? entry.symbol.trim().toUpperCase() : "";
  if (!symbol) {
    return null;
  }

  return {
    symbol,
    name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : symbol,
    exchange: typeof entry.exchange === "string" ? entry.exchange.trim() : "",
    shares: typeof entry.shares === "number" ? entry.shares : 0,
    avgPriceUsd: typeof entry.avgPriceUsd === "number" ? entry.avgPriceUsd : 0,
    note: typeof entry.note === "string" ? entry.note : ""
  };
}

export function parseWatchlist(input: unknown): WatchlistEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Record<string, unknown>;
      const legacy = parseLegacyHolding(row);
      if (!legacy) {
        return null;
      }

      return legacy;
    })
    .filter((entry): entry is WatchlistEntry => Boolean(entry));
}

export function parseDraftRows(rows: DraftRow[]): WatchlistEntry[] {
  const grouped = rows
    .map((row) => ({
      symbol: row.symbol.trim().toUpperCase(),
      name: row.name.trim() || row.symbol.trim().toUpperCase(),
      exchange: row.exchange.trim(),
      shares: Number(normalizeNumericInput(row.shares)),
      avgPriceUsd: Number(normalizeNumericInput(row.avgPriceUsd)),
      note: row.note.trim()
    }))
    .filter((row) => row.symbol && Number.isFinite(row.shares) && row.shares > 0)
    .reduce<Map<string, WatchlistEntry>>((map, row) => {
      map.set(row.symbol, {
        symbol: row.symbol,
        name: row.name,
        exchange: row.exchange,
        shares: row.shares,
        avgPriceUsd: Number.isFinite(row.avgPriceUsd) && row.avgPriceUsd > 0 ? row.avgPriceUsd : 0,
        note: row.note
      });
      return map;
    }, new Map());

  return Array.from(grouped.values());
}

export function buildDraftRows(entries: WatchlistEntry[]) {
  return entries.length ? entries.map((entry) => createDraftRow(entry)) : [createDraftRow()];
}

export function loadPersistedWatchlist() {
  const nextStored =
    window.localStorage.getItem(STORAGE_KEY) ??
    LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
    null;

  if (!nextStored) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    return DEFAULT_WATCHLIST;
  }

  try {
    const parsed = parseWatchlist(JSON.parse(nextStored));
    if (!parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
      return DEFAULT_WATCHLIST;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    return DEFAULT_WATCHLIST;
  }
}

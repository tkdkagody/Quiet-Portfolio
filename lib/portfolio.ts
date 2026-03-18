import { DraftRow, WatchlistEntry } from "@/lib/types";

export const STORAGE_KEY = "stock-board-budget-watchlist-v4";
export const THEME_STORAGE_KEY = "stock-board-theme";
export const LEGACY_STORAGE_KEYS = [
  "stock-board-budget-watchlist-v3",
  "stock-board-budget-watchlist-v2"
];

export const DEFAULT_WATCHLIST: WatchlistEntry[] = [
  { symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ", amountKrw: 1_000_000 },
  { symbol: "016360", name: "Samsung Securities Co Ltd", exchange: "KRX", amountKrw: 100_000 }
];

export function createDraftRow(entry?: Partial<WatchlistEntry>): DraftRow {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    query: entry?.name ?? entry?.symbol ?? "",
    symbol: entry?.symbol ?? "",
    name: entry?.name ?? "",
    exchange: entry?.exchange ?? "",
    amountKrw: entry?.amountKrw ? String(entry.amountKrw) : ""
  };
}

export function normalizeAmount(input: string) {
  return input.replace(/[^\d.]/g, "");
}

export function parseWatchlist(input: unknown): WatchlistEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const parsed: WatchlistEntry[] = [];

  input.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const row = entry as Partial<WatchlistEntry>;
    const symbol = row.symbol?.trim().toUpperCase();
    const amountKrw = Number(row.amountKrw);

    if (!symbol || !Number.isFinite(amountKrw) || amountKrw <= 0) {
      return;
    }

    parsed.push({
      symbol,
      name: row.name?.trim() || symbol,
      exchange: row.exchange?.trim() || "",
      amountKrw
    });
  });

  return parsed;
}

export function parseDraftRows(rows: DraftRow[]): WatchlistEntry[] {
  const grouped = rows
    .map((row) => ({
      symbol: row.symbol.trim().toUpperCase(),
      name: row.name.trim() || row.symbol.trim().toUpperCase(),
      exchange: row.exchange.trim(),
      amountKrw: Number(normalizeAmount(row.amountKrw))
    }))
    .filter((row) => row.symbol && Number.isFinite(row.amountKrw) && row.amountKrw > 0)
    .reduce<Map<string, WatchlistEntry>>((map, row) => {
      const existing = map.get(row.symbol);
      map.set(row.symbol, {
        symbol: row.symbol,
        name: row.name,
        exchange: row.exchange || existing?.exchange || "",
        amountKrw: (existing?.amountKrw ?? 0) + row.amountKrw
      });
      return map;
    }, new Map());

  return Array.from(grouped.values());
}

export function buildDraftRows(entries: WatchlistEntry[]) {
  return entries.length ? entries.map((entry) => createDraftRow(entry)) : [createDraftRow()];
}

export function sameWatchlistBySymbolAndAmount(left: WatchlistEntry[], right: WatchlistEntry[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (entry, index) =>
      entry.symbol === right[index]?.symbol && entry.amountKrw === right[index]?.amountKrw
  );
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

    const nextWatchlist = sameWatchlistBySymbolAndAmount(parsed, [
      { symbol: "AAPL", name: "AAPL", amountKrw: 1_000_000 }
    ])
      ? DEFAULT_WATCHLIST
      : parsed.map((entry) => ({
          ...entry,
          name: entry.name || entry.symbol
        }));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWatchlist));
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    return nextWatchlist;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    return DEFAULT_WATCHLIST;
  }
}

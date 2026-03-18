"use client";

import { useEffect, useMemo, useState } from "react";
import { StockChart } from "@/components/stock-chart";
import { DraftRow, StockSearchRow } from "@/components/stock-search-row";
import {
  StockChartResponse,
  StocksApiResponse,
  StockSeriesPoint,
  StockSnapshot,
  WatchlistEntry
} from "@/lib/types";

const STORAGE_KEY = "stock-board-budget-watchlist-v4";
const THEME_STORAGE_KEY = "stock-board-theme";
const LEGACY_STORAGE_KEYS = [
  "stock-board-budget-watchlist-v3",
  "stock-board-budget-watchlist-v2"
];
const DEFAULT_WATCHLIST: WatchlistEntry[] = [
  { symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ", amountKrw: 1_000_000 },
  { symbol: "016360", name: "Samsung Securities Co Ltd", exchange: "KRX", amountKrw: 100_000 }
];

function createDraftRow(entry?: Partial<WatchlistEntry>): DraftRow {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    query: entry?.name ?? entry?.symbol ?? "",
    symbol: entry?.symbol ?? "",
    name: entry?.name ?? "",
    exchange: entry?.exchange ?? "",
    amountKrw: entry?.amountKrw ? String(entry.amountKrw) : ""
  };
}

function normalizeAmount(input: string) {
  return input.replace(/[^\d.]/g, "");
}

function parseWatchlist(input: unknown): WatchlistEntry[] {
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

function parseDraftRows(rows: DraftRow[]): WatchlistEntry[] {
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

function buildDraftRows(entries: WatchlistEntry[]) {
  return entries.length ? entries.map((entry) => createDraftRow(entry)) : [createDraftRow()];
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" || value >= 1000 ? 0 : 2
  }).format(value);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function joinSymbols(entries: WatchlistEntry[]) {
  return entries.map((entry) => entry.symbol).join(",");
}

function estimateUnits(amountKrw: number, priceKrw: number) {
  if (amountKrw <= 0 || priceKrw <= 0) {
    return 0;
  }

  return amountKrw / priceKrw;
}

function sameWatchlistBySymbolAndAmount(left: WatchlistEntry[], right: WatchlistEntry[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (entry, index) =>
      entry.symbol === right[index]?.symbol && entry.amountKrw === right[index]?.amountKrw
  );
}

export function PortfolioDashboard() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [draftRows, setDraftRows] = useState<DraftRow[]>(buildDraftRows(DEFAULT_WATCHLIST));
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(DEFAULT_WATCHLIST);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_WATCHLIST[0].symbol);
  const [items, setItems] = useState<StockSnapshot[]>([]);
  const [chartCache, setChartCache] = useState<Record<string, StockSeriesPoint[]>>({});
  const [errors, setErrors] = useState<StocksApiResponse["errors"]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [chartMessage, setChartMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [chartUpdatedAt, setChartUpdatedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const nextStored =
      window.localStorage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
      null;

    if (!nextStored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
      return;
    }

    try {
      const parsed = parseWatchlist(JSON.parse(nextStored));
      if (!parsed.length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
        return;
      }

      const nextWatchlist = sameWatchlistBySymbolAndAmount(parsed, [
        { symbol: "AAPL", name: "AAPL", amountKrw: 1_000_000 }
      ])
        ? DEFAULT_WATCHLIST
        : parsed.map((entry) => ({
            ...entry,
            name: entry.name || entry.symbol
          }));

      setWatchlist(nextWatchlist);
      setDraftRows(buildDraftRows(nextWatchlist));
      setSelectedSymbol(nextWatchlist[0].symbol);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWatchlist));
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!watchlist.length) {
      setItems([]);
      setChartCache({});
      setErrors([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchStocks() {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/stocks?symbols=${joinSymbols(watchlist)}`, {
          signal: controller.signal,
          cache: "no-store"
        });

        const payload = (await response.json()) as StocksApiResponse | { message: string };

        if (!response.ok) {
          throw new Error("message" in payload ? payload.message : "시세를 불러오지 못했습니다.");
        }

        const nextPayload = payload as StocksApiResponse;
        setItems(nextPayload.items);
        setErrors(nextPayload.errors);
        setUpdatedAt(nextPayload.asOf);
        setChartCache({});
        setChartUpdatedAt(null);

        if (nextPayload.items.length) {
          setSelectedSymbol((current) =>
            nextPayload.items.some((item) => item.symbol === current)
              ? current
              : nextPayload.items[0].symbol
          );
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setItems([]);
        setChartCache({});
        setErrors([]);
        setMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchStocks();

    return () => {
      controller.abort();
    };
  }, [refreshNonce, watchlist]);

  useEffect(() => {
    if (!selectedSymbol) {
      setChartMessage(null);
      return;
    }

    if (chartCache[selectedSymbol]?.length) {
      return;
    }

    const controller = new AbortController();

    async function fetchChart() {
      setChartLoading(true);
      setChartMessage(null);

      try {
        const response = await fetch(`/api/stocks/chart?symbol=${encodeURIComponent(selectedSymbol)}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const payload = (await response.json()) as StockChartResponse | { message: string };

        if (!response.ok) {
          throw new Error("message" in payload ? payload.message : "차트 데이터를 불러오지 못했습니다.");
        }

        const nextPayload = payload as StockChartResponse;
        setChartCache((current) => ({
          ...current,
          [nextPayload.symbol]: nextPayload.series
        }));
        setChartUpdatedAt(nextPayload.asOf);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setChartMessage(error instanceof Error ? error.message : "차트 데이터를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setChartLoading(false);
        }
      }
    }

    fetchChart();

    return () => {
      controller.abort();
    };
  }, [chartCache, selectedSymbol]);

  const stockMap = useMemo(() => new Map(items.map((item) => [item.symbol, item])), [items]);
  const selectedStock = stockMap.get(selectedSymbol) ?? items[0];
  const selectedEntry =
    watchlist.find((entry) => entry.symbol === selectedStock?.symbol) ?? watchlist[0];
  const selectedSeries = selectedStock ? chartCache[selectedStock.symbol] ?? [] : [];

  const holdingsSummary = useMemo(() => {
    return watchlist
      .map((entry) => {
        const stock = stockMap.get(entry.symbol);
        if (!stock) {
          return null;
        }

        return {
          ...entry,
          stock,
          estimatedUnits: estimateUnits(entry.amountKrw, stock.priceKrw)
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [stockMap, watchlist]);

  const totalBudget = holdingsSummary.reduce((sum, item) => sum + item.amountKrw, 0);
  const selectedEstimatedUnits =
    selectedEntry && selectedStock ? estimateUnits(selectedEntry.amountKrw, selectedStock.priceKrw) : 0;

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setDraftRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setDraftRows((current) => [...current, createDraftRow()]);
  }

  function removeRow(id: string) {
    setDraftRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function handleApply() {
    const unresolvedRows = draftRows.filter((row) => row.query.trim() && !row.symbol);
    if (unresolvedRows.length) {
      setMessage("검색 결과에서 종목을 선택하지 않은 행이 있습니다. 이름 입력 후 목록에서 눌러 주세요.");
      return;
    }

    const parsed = parseDraftRows(draftRows);
    setMessage(null);
    setWatchlist(parsed);
    setSelectedSymbol(parsed[0]?.symbol ?? "");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  }

  function handleReset() {
    setDraftRows(buildDraftRows(DEFAULT_WATCHLIST));
    setWatchlist(DEFAULT_WATCHLIST);
    setSelectedSymbol(DEFAULT_WATCHLIST[0].symbol);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
  }

  function handleRefresh() {
    setRefreshNonce((current) => current + 1);
  }

  return (
    <main className="shell">
      <section className="shell-topbar">
        <div className="shell-topbar-copy">
          <strong>Focus Board</strong>
          <span>야간모드와 조용한 대비로 오래 켜두기 쉬운 화면</span>
        </div>
        <button
          className="ghost-btn"
          type="button"
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "주간모드" : "야간모드"}
        </button>
      </section>

      <section className="dashboard">
        <aside className="panel sidebar">
          <div className="panel-title">
            <h2>종목 / 금액 입력</h2>
            <span className="subtle">{watchlist.length}개 추적 중</span>
          </div>
          <p className="hint">
            종목명으로 검색해서 선택한 뒤 금액을 넣는 방식으로 바꿨습니다. 티커를 외울 필요 없이
            이름으로 찾고, 실제 저장은 선택된 심볼로 처리합니다.
          </p>

          <div className="editor-list">
            {draftRows.map((row, index) => (
              <StockSearchRow
                key={row.id}
                index={index}
                row={row}
                canRemove={draftRows.length > 1}
                onChange={updateRow}
                onRemove={removeRow}
              />
            ))}
          </div>

          <div className="toolbar">
            <button className="primary-btn" type="button" onClick={handleApply}>
              종목 적용
            </button>
            <button className="ghost-btn" type="button" onClick={handleRefresh}>
              시세 새로고침
            </button>
            <button className="ghost-btn" type="button" onClick={addRow}>
              행 추가
            </button>
            <button className="ghost-btn" type="button" onClick={handleReset}>
              예시 종목 복원
            </button>
          </div>

          <div className="snapshot-list">
            {holdingsSummary.map((item) => {
              const isActive = item.symbol === selectedStock?.symbol;
              const direction = item.stock.change >= 0 ? "up" : "down";

              return (
                <button
                  key={item.symbol}
                  type="button"
                  className={`stock-row${isActive ? " active" : ""}`}
                  onClick={() => setSelectedSymbol(item.symbol)}
                >
                  <div className="stock-row-head">
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.stock.priceKrw, "KRW")}</span>
                  </div>
                  <div className="stock-row-tail">
                    <span>{formatMoney(item.amountKrw, "KRW")}</span>
                    <span className={direction}>{item.stock.percentChange.toFixed(2)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="main">
          {message ? <div className="error-box">{message}</div> : null}
          <div className="subtle" style={{ marginTop: -8 }}>
            목록은 적용/새로고침 때만 다시 조회하고, 차트는 선택한 종목만 별도로 불러옵니다.
          </div>
          {errors.length > 0 ? (
            <div className="error-box">
              {errors.map((error) => `${error.symbol}: ${error.message}`).join(" / ")}
            </div>
          ) : null}
          {loading ? <div className="loading-box">현재 시세와 환율을 불러오는 중입니다...</div> : null}
          {!loading && !selectedStock ? (
            <div className="empty">왼쪽에서 종목명을 검색해서 선택한 뒤 `종목 적용`을 눌러 주세요.</div>
          ) : null}

          {holdingsSummary.length > 0 ? (
            <section className="overview-grid">
              {holdingsSummary.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className={`panel overview-card${item.symbol === selectedStock?.symbol ? " active" : ""}`}
                  onClick={() => setSelectedSymbol(item.symbol)}
                >
                  <div className="overview-card-head">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.symbol}</span>
                    </div>
                    <span className={item.stock.change >= 0 ? "change-pill up" : "change-pill down"}>
                      {item.stock.percentChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="overview-price">{formatMoney(item.stock.priceKrw, "KRW")}</div>
                  <div className="overview-metrics">
                    <span>입력 금액 {formatMoney(item.amountKrw, "KRW")}</span>
                    <span>현재가 {formatMoney(item.stock.price, item.stock.currency)}</span>
                    <span>추정 수량 {formatNumber(item.estimatedUnits, 4)}주</span>
                  </div>
                </button>
              ))}
            </section>
          ) : null}

          {selectedStock && selectedEntry ? (
            <>
              <section className="panel hero-card">
                <div>
                  <div className="ticker-line">
                    <span className="ticker-pill">{selectedStock.exchange || selectedEntry.exchange || "Market"}</span>
                    <span className="subtle">최근 갱신 {formatDateTime(selectedStock.lastUpdated)}</span>
                  </div>
                  <h2 className="hero-title">
                    {selectedStock.name}
                  </h2>
                  <p className="hero-meta">
                    <span>{selectedStock.symbol}</span>
                    <span>{formatMoney(selectedStock.price, selectedStock.currency)}</span>
                    <span>환산 {formatMoney(selectedStock.priceKrw, "KRW")}</span>
                  </p>
                </div>
                <div className="price-stack">
                  <strong>{formatMoney(selectedStock.priceKrw, "KRW")}</strong>
                  <span className={`change-pill ${selectedStock.change >= 0 ? "up" : "down"}`}>
                    {selectedStock.change >= 0 ? "+" : ""}
                    {selectedStock.change.toFixed(2)} {selectedStock.currency} (
                    {selectedStock.percentChange.toFixed(2)}%)
                  </span>
                </div>
              </section>

              <section className="stats-grid">
                <div className="panel stat-card">
                  <span>입력한 총 투자금액</span>
                  <strong>{formatMoney(totalBudget, "KRW")}</strong>
                </div>
                <div className="panel stat-card">
                  <span>{selectedStock.name} 투자금액</span>
                  <strong>{formatMoney(selectedEntry.amountKrw, "KRW")}</strong>
                </div>
                <div className="panel stat-card">
                  <span>현재가 기준 추정 수량</span>
                  <strong>{formatNumber(selectedEstimatedUnits, 4)}주</strong>
                </div>
                <div className="panel stat-card">
                  <span>적용 환율</span>
                  <strong>
                    1 {selectedStock.currency} = {formatMoney(selectedStock.fxRateToKrw, "KRW")}
                  </strong>
                </div>
              </section>

              <section className="panel chart-card">
                <div className="chart-header">
                  <div>
                    <h3>30일 종가 흐름</h3>
                    <p className="hint" style={{ margin: "6px 0 0" }}>
                      차트는 선택한 종목만 불러옵니다. 원통화 기준 종가 흐름이며 환율은 현재 환율
                      기준으로 별도 환산해 보여줍니다.
                    </p>
                  </div>
                  <span className="subtle">
                    {chartUpdatedAt
                      ? `차트 갱신 ${formatDateTime(chartUpdatedAt)}`
                      : updatedAt
                        ? `시세 갱신 ${formatDateTime(updatedAt)}`
                        : ""}
                  </span>
                </div>
                {chartMessage ? <div className="error-box">{chartMessage}</div> : null}
                {chartLoading && !selectedSeries.length ? (
                  <div className="loading-box">선택한 종목의 차트를 불러오는 중입니다...</div>
                ) : null}
                {!chartLoading && !chartMessage ? (
                  <StockChart data={selectedSeries} positive={selectedStock.change >= 0} />
                ) : null}
              </section>

              <section className="panel summary-card">
                <div className="panel-title">
                  <h3>입력 금액 기준 요약</h3>
                  <span className="subtle">이름 검색 기반 선택</span>
                </div>
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>종목</th>
                      <th>투자금액</th>
                      <th>현재가</th>
                      <th>원화 환산가</th>
                      <th>현재가 기준 추정 수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsSummary.map((item) => (
                      <tr key={item.symbol}>
                        <td>{item.name}</td>
                        <td>{formatMoney(item.amountKrw, "KRW")}</td>
                        <td>{formatMoney(item.stock.price, item.stock.currency)}</td>
                        <td>{formatMoney(item.stock.priceKrw, "KRW")}</td>
                        <td>{formatNumber(item.estimatedUnits, 4)}주</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StockChart } from "@/components/stock-chart";
import { useTheme } from "@/components/theme-provider";
import {
  StockChartResponse,
  StocksApiResponse,
  StockSeriesPoint,
  StockSnapshot,
  WatchlistEntry
} from "@/lib/types";
import {
  DEFAULT_WATCHLIST,
  loadPersistedWatchlist
} from "@/lib/portfolio";

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

function formatPreciseTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatRelativeTime(value: string | null, nowMs: number) {
  if (!value) {
    return "-";
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - new Date(value).getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}초 전`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  return `${Math.floor(diffMinutes / 60)}시간 전`;
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

export function PortfolioDashboard() {
  const { theme, toggleTheme } = useTheme();
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
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const nextWatchlist = loadPersistedWatchlist();
    setWatchlist(nextWatchlist);
    setSelectedSymbol(nextWatchlist[0].symbol);
  }, []);

  useEffect(() => {
    function syncNow() {
      setNowMs(Date.now());
    }

    syncNow();
    const timer = window.setInterval(syncNow, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function syncWatchlist() {
      const nextWatchlist = loadPersistedWatchlist();
      setWatchlist(nextWatchlist);
      setSelectedSymbol((current) =>
        nextWatchlist.some((entry) => entry.symbol === current) ? current : nextWatchlist[0]?.symbol ?? ""
      );
    }

    window.addEventListener("focus", syncWatchlist);
    window.addEventListener("storage", syncWatchlist);

    return () => {
      window.removeEventListener("focus", syncWatchlist);
      window.removeEventListener("storage", syncWatchlist);
    };
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

  function handleRefresh() {
    setRefreshNonce((current) => current + 1);
  }

  return (
    <main className="shell">
      <section className="shell-topbar">
        <div className="shell-topbar-copy">
          <strong>Deskfolio</strong>
          <span>야간모드와 조용한 대비로 오래 켜두기 쉬운 화면</span>
        </div>
        <button
          className="ghost-btn"
          type="button"
          onClick={toggleTheme}
        >
          {theme === "dark" ? "주간모드" : "야간모드"}
        </button>
      </section>

      <section className="dashboard">
        <aside className="panel sidebar">
          <div className="panel-title">
            <h2>보유 종목</h2>
            <span className="subtle">{watchlist.length}개 추적 중</span>
          </div>
          <p className="hint">
            메인 화면은 확인 전용입니다. 보유 종목과 금액 입력은 별도 페이지에서 정리한 뒤 여기서
            전체 현황과 상세 차트를 확인합니다.
          </p>

          <div className="toolbar">
            <Link className="primary-btn sidebar-link-btn" href="/portfolio">
              종목 입력 페이지
            </Link>
            <button className="ghost-btn" type="button" onClick={handleRefresh}>
              시세 새로고침
            </button>
          </div>

          <div className="timestamp-box">
            <span>시세 마지막 갱신</span>
            <strong>{formatPreciseTime(updatedAt)}</strong>
            <small>{formatRelativeTime(updatedAt, nowMs)}</small>
          </div>
          <div className="timestamp-box">
            <span>차트 마지막 갱신</span>
            <strong>{formatPreciseTime(chartUpdatedAt)}</strong>
            <small>{formatRelativeTime(chartUpdatedAt, nowMs)}</small>
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
            목록은 수동 새로고침 또는 저장 후 반영되고, 차트는 선택한 종목만 별도로 불러옵니다.
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
                    <span className="subtle">
                      최근 갱신 {formatPreciseTime(selectedStock.lastUpdated)} · {formatRelativeTime(selectedStock.lastUpdated, nowMs)}
                    </span>
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
                      ? `차트 갱신 ${formatPreciseTime(chartUpdatedAt)} · ${formatRelativeTime(chartUpdatedAt, nowMs)}`
                      : updatedAt
                        ? `시세 갱신 ${formatPreciseTime(updatedAt)} · ${formatRelativeTime(updatedAt, nowMs)}`
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StockChart } from "@/components/stock-chart";
import { useTheme } from "@/components/theme-provider";
import { loadPersistedWatchlist } from "@/lib/portfolio";
import { PortfolioSnapshot, StockSeriesPoint, WatchlistEntry } from "@/lib/types";

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function formatUSDOrEmpty(value: number, missing = false) {
  if (missing) {
    return "값이 없습니다";
  }

  return formatUSD(value);
}

function formatPercentOrEmpty(value: number, missing = false) {
  if (missing) {
    return "값이 없습니다";
  }

  return `${value.toFixed(2)}%`;
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

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatChange(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatUSD(value)}`;
}

export function PortfolioDashboard() {
  const { theme, toggleTheme } = useTheme();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [chartCache, setChartCache] = useState<Record<string, StockSeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [chartMessage, setChartMessage] = useState<string | null>(null);
  const [portfolioUpdatedAt, setPortfolioUpdatedAt] = useState<string | null>(null);
  const [chartUpdatedAt, setChartUpdatedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const nextWatchlist = loadPersistedWatchlist();
    setWatchlist(nextWatchlist);
    setSelectedSymbol(nextWatchlist[0]?.symbol ?? "");
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
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!watchlist.length) {
      setPortfolio(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchPortfolio() {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch("/api/portfolio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ holdings: watchlist }),
          signal: controller.signal,
          cache: "no-store"
        });

        const payload = (await response.json()) as PortfolioSnapshot | { message: string };

        if (!response.ok) {
          throw new Error("message" in payload ? payload.message : "포트폴리오를 불러오지 못했습니다.");
        }

        const nextPayload = payload as PortfolioSnapshot;
        setPortfolio(nextPayload);
        setPortfolioUpdatedAt(nextPayload.asOf);
        setChartCache({});
        setChartUpdatedAt(null);
        setSelectedSymbol((current) =>
          nextPayload.items.some((item) => item.quote.symbol === current)
            ? current
            : nextPayload.items[0]?.quote.symbol ?? ""
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setPortfolio(null);
          setMessage(error instanceof Error ? error.message : "포트폴리오를 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchPortfolio();

    return () => {
      controller.abort();
    };
  }, [refreshNonce, watchlist]);

  useEffect(() => {
    if (!selectedSymbol || chartCache[selectedSymbol]?.length) {
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
        const payload = (await response.json()) as { series: StockSeriesPoint[]; asOf: string; message?: string };

        if (!response.ok || payload.message) {
          throw new Error(payload.message ?? "차트 데이터를 불러오지 못했습니다.");
        }

        setChartCache((current) => ({
          ...current,
          [selectedSymbol]: payload.series
        }));
        setChartUpdatedAt(payload.asOf);
      } catch (error) {
        if (!controller.signal.aborted) {
          setChartMessage(error instanceof Error ? error.message : "차트 데이터를 불러오지 못했습니다.");
        }
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

  const holdingMap = useMemo(
    () => new Map(portfolio?.items.map((item) => [item.quote.symbol, item])),
    [portfolio]
  );

  const selectedHolding = selectedSymbol ? holdingMap.get(selectedSymbol) : undefined;
  const selectedSeries = selectedSymbol ? chartCache[selectedSymbol] ?? [] : [];
  const totalPositions = portfolio?.items.length ?? 0;
  const selectedGain = selectedHolding
    ? selectedHolding.quote.priceUsd * selectedHolding.holding.shares -
      selectedHolding.holding.avgPriceUsd * selectedHolding.holding.shares
    : 0;

  const upcomingDividends = (portfolio?.items ?? [])
    .map((item) => ({
      symbol: item.quote.symbol,
      name: item.quote.name,
      nextExDate: item.nextExDate,
      nextPaymentDate: item.nextPaymentDate,
      monthlyDividend: item.monthlyDividend,
      annualDividend: item.annualDividend,
      yieldPercent: item.yieldPercent
    }))
    .sort((left, right) => {
      const leftTime = left.nextPaymentDate ? new Date(left.nextPaymentDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.nextPaymentDate ? new Date(right.nextPaymentDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });

  function handleRefresh() {
    setRefreshNonce((current) => current + 1);
  }

  return (
    <main className="note-shell">
      <section className="note-topbar">
        <div className="note-topbar-copy">
          <span className="note-kicker">Deskfolio</span>
          <h1>노트</h1>
          <p>보유 종목, 평단, 배당락일, 지급일, 예상 배당금을 메모처럼 정리합니다. 최근 종가를 기준으로 보여줍니다.</p>
        </div>
        <div className="note-actions">
          <Link className="ghost-btn" href="/dividends">
            예상 배당금
          </Link>
          <Link className="ghost-btn" href="/portfolio">
            종목 입력
          </Link>
          <button className="ghost-btn" type="button" onClick={handleRefresh}>
            새로고침
          </button>
          <button className="ghost-btn" type="button" onClick={toggleTheme}>
            {theme === "dark" ? "주간모드" : "야간모드"}
          </button>
        </div>
      </section>

      <section className="note-summary-grid">
        <div className="note-card note-stat">
          <span>총 매수원가</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.totalCost, false) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>현재 평가금액</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.totalValue, portfolio.totalValue === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>총 평가손익</span>
          <strong className={portfolio && portfolio.totalGain >= 0 ? "up" : "down"}>
            {portfolio ? formatChange(portfolio.totalGain) : "-"}
          </strong>
        </div>
        <div className="note-card note-stat">
          <span>예상 월 배당</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.totalMonthlyDividend, portfolio.totalMonthlyDividend === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>예상 연 배당</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.totalAnnualDividend, portfolio.totalAnnualDividend === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>보유 종목 수</span>
          <strong>{totalPositions}개</strong>
        </div>
      </section>

      <section className="note-grid">
        <article className="note-card note-table-card">
          <div className="section-head">
            <div>
              <h2>보유 종목</h2>
              <p>최근 종가와 예상 배당을 같이 적어두는 목록입니다.</p>
            </div>
            <span className="subtle">{totalPositions}개</span>
          </div>

          <div className="timestamp-strip">
            <span>
              포트폴리오 갱신 {formatDateTime(portfolioUpdatedAt)} · {formatRelativeTime(portfolioUpdatedAt, nowMs)}
            </span>
            <span>
              차트 갱신 {formatDateTime(chartUpdatedAt)} · {formatRelativeTime(chartUpdatedAt, nowMs)}
            </span>
          </div>

          {message ? <div className="error-box">{message}</div> : null}
          {portfolio?.warnings?.length ? (
            <div className="loading-box">
              {portfolio.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
          {loading ? <div className="loading-box">포트폴리오를 불러오는 중입니다...</div> : null}
          {!loading && !portfolio ? (
            <div className="empty note-empty">입력 페이지에서 종목을 저장하면 여기로 불러옵니다.</div>
          ) : null}

          {portfolio ? (
            <div className="table-wrap">
              <table className="note-table">
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>보유</th>
                    <th>평단</th>
                    <th>최근 종가</th>
                    <th>손익</th>
                    <th>월 배당</th>
                    <th>배당락일</th>
                    <th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.items.map((item) => {
                    const isActive = item.quote.symbol === selectedSymbol;
                    const gain = item.quote.priceUsd * item.holding.shares - item.holding.avgPriceUsd * item.holding.shares;

                    return (
                      <tr
                        key={item.quote.symbol}
                        className={isActive ? "active-row" : ""}
                        onClick={() => setSelectedSymbol(item.quote.symbol)}
                      >
                        <td>
                          <strong>{item.quote.name}</strong>
                          <span>{item.quote.symbol}</span>
                        </td>
                        <td>{item.holding.shares}주</td>
                        <td>{formatUSDOrEmpty(item.holding.avgPriceUsd, item.holding.avgPriceUsd === 0)}</td>
                        <td>{formatUSDOrEmpty(item.quote.priceUsd, item.dataStatus?.price === "missing")}</td>
                        <td className={gain >= 0 ? "up" : "down"}>
                          {formatUSDOrEmpty(gain, item.dataStatus?.price === "missing")}
                        </td>
                        <td>{formatUSDOrEmpty(item.monthlyDividend, item.dataStatus?.dividends === "missing")}</td>
                        <td>{formatDate(item.nextExDate)}</td>
                        <td>{item.holding.note || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <aside className="note-card note-detail">
          <div className="section-head">
            <div>
              <h2>선택 종목</h2>
              <p>세부 수치와 차트, 최근 배당 내역을 표시합니다.</p>
            </div>
            <span className="subtle">{selectedHolding ? selectedHolding.quote.symbol : "-"}</span>
          </div>

          {selectedHolding ? (
            <>
              <div className="detail-hero">
                <div>
                  <strong>{selectedHolding.quote.name}</strong>
                  <span>
                    {selectedHolding.quote.exchange || "US Market"} · 최근 갱신 {formatDateTime(selectedHolding.quote.lastUpdated)}
                  </span>
                </div>
                <div className="detail-price">
                  <strong>{formatUSDOrEmpty(selectedHolding.quote.priceUsd, selectedHolding.dataStatus?.price === "missing")}</strong>
                  <span className={selectedGain >= 0 ? "up" : "down"}>
                    {formatUSDOrEmpty(selectedGain, selectedHolding.dataStatus?.price === "missing")} · {formatPercentOrEmpty(selectedHolding.quote.changePercent, selectedHolding.dataStatus?.price === "missing")}
                  </span>
                </div>
              </div>

              <div className="detail-metrics">
                <div>
                  <span>보유수량</span>
                  <strong>{selectedHolding.holding.shares}주</strong>
                </div>
                <div>
                  <span>평균 매수가</span>
                  <strong>{formatUSDOrEmpty(selectedHolding.holding.avgPriceUsd, selectedHolding.holding.avgPriceUsd === 0)}</strong>
                </div>
                <div>
                  <span>예상 월 배당</span>
                  <strong>{formatUSDOrEmpty(selectedHolding.monthlyDividend, selectedHolding.dataStatus?.dividends === "missing")}</strong>
                </div>
                <div>
                  <span>예상 연 배당</span>
                  <strong>{formatUSDOrEmpty(selectedHolding.annualDividend, selectedHolding.dataStatus?.dividends === "missing")}</strong>
                </div>
                <div>
                  <span>배당수익률</span>
                  <strong>{formatPercentOrEmpty(selectedHolding.yieldPercent, selectedHolding.dataStatus?.price === "missing" || selectedHolding.dataStatus?.dividends === "missing")}</strong>
                </div>
                <div>
                  <span>다음 지급일</span>
                  <strong>{formatDate(selectedHolding.nextPaymentDate)}</strong>
                </div>
              </div>

              <div className="detail-note">
                <span>메모</span>
                <p>{selectedHolding.holding.note || "메모가 없습니다."}</p>
              </div>

              {selectedHolding.warnings?.length ? (
                <div className="loading-box">
                  {selectedHolding.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : null}

              <div className="chart-card">
                <div className="section-head compact">
                  <div>
                    <h3>30일 가격 흐름</h3>
                    <p>선택한 종목만 불러오는 차트입니다.</p>
                  </div>
                  <span className="subtle">
                    {chartUpdatedAt ? `${formatDateTime(chartUpdatedAt)} · ${formatRelativeTime(chartUpdatedAt, nowMs)}` : "-"}
                  </span>
                </div>
                {chartMessage ? <div className="error-box">{chartMessage}</div> : null}
                {chartLoading && !selectedSeries.length ? <div className="loading-box">차트를 불러오는 중입니다...</div> : null}
                {!chartLoading || selectedSeries.length ? (
                  <StockChart data={selectedSeries} positive={selectedGain >= 0} />
                ) : null}
              </div>

              <div className="mini-table-block">
                <div className="section-head compact">
                  <div>
                    <h3>최근 배당 내역</h3>
                    <p>배당락일과 지급일을 빠르게 확인합니다.</p>
                  </div>
                  <span className="subtle">{selectedHolding.dividends.length}건</span>
                </div>
                {selectedHolding.dividends.length ? (
                  <table className="note-mini-table">
                    <thead>
                      <tr>
                        <th>배당락일</th>
                        <th>지급일</th>
                        <th>배당금/주</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHolding.dividends.slice(0, 5).map((item) => (
                        <tr key={`${item.symbol}-${item.date}`}>
                          <td>{formatDate(item.recordDate)}</td>
                          <td>{formatDate(item.paymentDate)}</td>
                          <td>{formatUSDOrEmpty(item.dividendPerShare, item.dividendPerShare === 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty note-empty">
                    현재 플랜에서는 배당 이력 데이터를 가져오지 못했습니다. 최근 종가와 수익률만 표시됩니다.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty note-empty">왼쪽 목록에서 종목을 선택하면 상세가 보입니다.</div>
          )}
        </aside>
      </section>

      <section className="note-grid note-grid--bottom">
        <article className="note-card">
          <div className="section-head">
            <div>
              <h2>월별 예상 배당</h2>
              <p>종목별 예상 배당금을 모아둔 요약입니다.</p>
            </div>
            <span className="subtle">포트폴리오 합계</span>
          </div>
          <table className="note-table compact-table">
            <thead>
              <tr>
                <th>종목</th>
                <th>월 배당</th>
                <th>연 배당</th>
                <th>배당수익률</th>
              </tr>
            </thead>
            <tbody>
              {(portfolio?.items ?? []).map((item) => (
                <tr key={item.quote.symbol}>
                  <td>
                    <strong>{item.quote.name}</strong>
                    <span>{item.quote.symbol}</span>
                  </td>
                  <td>{formatUSDOrEmpty(item.monthlyDividend, item.dataStatus?.dividends === "missing")}</td>
                  <td>{formatUSDOrEmpty(item.annualDividend, item.dataStatus?.dividends === "missing")}</td>
                  <td>{formatPercentOrEmpty(item.yieldPercent, item.dataStatus?.price === "missing" || item.dataStatus?.dividends === "missing")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="note-card">
          <div className="section-head">
            <div>
              <h2>가까운 배당 일정</h2>
              <p>배당락일과 지급일이 가까운 종목을 위로 정렬했습니다.</p>
            </div>
            <span className="subtle">포트폴리오 전체</span>
          </div>
          <table className="note-mini-table">
            <thead>
              <tr>
                <th>종목</th>
                <th>배당락일</th>
                <th>지급일</th>
                <th>월 배당</th>
              </tr>
            </thead>
            <tbody>
              {upcomingDividends.slice(0, 6).map((item) => (
                <tr key={item.symbol}>
                  <td>{item.name}</td>
                  <td>{formatDate(item.nextExDate)}</td>
                  <td>{formatDate(item.nextPaymentDate)}</td>
                  <td>{formatUSDOrEmpty(item.monthlyDividend, item.monthlyDividend === 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </main>
  );
}

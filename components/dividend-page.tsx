"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { loadPersistedWatchlist } from "@/lib/portfolio";
import { PortfolioSnapshot, WatchlistEntry } from "@/lib/types";

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function formatUSDOrEmpty(value: number, missing = false) {
  return missing ? "값이 없습니다" : formatUSD(value);
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

export function DividendPage() {
  const { theme, toggleTheme } = useTheme();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setWatchlist(loadPersistedWatchlist());
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
          throw new Error("message" in payload ? payload.message : "배당 데이터를 불러오지 못했습니다.");
        }

        const nextPayload = payload as PortfolioSnapshot;
        setPortfolio(nextPayload);
        setUpdatedAt(nextPayload.asOf);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPortfolio(null);
          setMessage(error instanceof Error ? error.message : "배당 데이터를 불러오지 못했습니다.");
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

  const rows = useMemo(() => portfolio?.items ?? [], [portfolio]);

  return (
    <main className="note-shell">
      <section className="note-topbar">
        <div className="note-topbar-copy">
          <span className="note-kicker">Deskfolio</span>
          <h1>예상 배당금</h1>
          <p>현재 기준과 예상 기준의 월별 배당금을 같이 보여줍니다.</p>
        </div>
        <div className="note-actions">
          <Link className="ghost-btn" href="/">
            노트
          </Link>
          <Link className="ghost-btn" href="/portfolio">
            종목 입력
          </Link>
          <button className="ghost-btn" type="button" onClick={() => setRefreshNonce((current) => current + 1)}>
            새로고침
          </button>
          <button className="ghost-btn" type="button" onClick={toggleTheme}>
            {theme === "dark" ? "주간모드" : "야간모드"}
          </button>
        </div>
      </section>

      <section className="note-summary-grid">
        <div className="note-card note-stat">
          <span>현재 월 배당</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.currentMonthlyDividend, portfolio.currentMonthlyDividend === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>예상 월 배당</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.expectedMonthlyDividend, portfolio.expectedMonthlyDividend === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>현재 연 배당</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.currentAnnualDividend, portfolio.currentAnnualDividend === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>예상 연 배당</span>
          <strong>{portfolio ? formatUSDOrEmpty(portfolio.expectedAnnualDividend, portfolio.expectedAnnualDividend === 0) : "-"}</strong>
        </div>
        <div className="note-card note-stat">
          <span>보유 종목 수</span>
          <strong>{rows.length}개</strong>
        </div>
        <div className="note-card note-stat">
          <span>최근 갱신</span>
          <strong>{updatedAt ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(updatedAt)) : "-"}</strong>
        </div>
      </section>

      <section className="note-grid">
        <article className="note-card note-table-card">
          <div className="section-head">
            <div>
              <h2>종목별 배당</h2>
              <p>현재 기준과 예상 기준을 같이 비교합니다.</p>
            </div>
            <span className="subtle">월별 / 연별</span>
          </div>

          {message ? <div className="error-box">{message}</div> : null}
          {loading ? <div className="loading-box">배당 데이터를 불러오는 중입니다...</div> : null}
          {!loading && !portfolio ? <div className="empty note-empty">입력한 종목이 없거나 데이터를 불러오지 못했습니다.</div> : null}

          {portfolio ? (
            <div className="table-wrap">
              <table className="note-table">
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>보유</th>
                    <th>현재 월 배당</th>
                    <th>예상 월 배당</th>
                    <th>현재 연 배당</th>
                    <th>예상 연 배당</th>
                    <th>배당락일</th>
                    <th>지급일</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.quote.symbol}>
                      <td>
                        <strong>{item.quote.name}</strong>
                        <span>{item.quote.symbol}</span>
                      </td>
                      <td>{item.holding.shares}주</td>
                      <td>{formatUSDOrEmpty(item.currentMonthlyDividend, item.currentMonthlyDividend === 0)}</td>
                      <td>{formatUSDOrEmpty(item.expectedMonthlyDividend, item.expectedMonthlyDividend === 0)}</td>
                      <td>{formatUSDOrEmpty(item.currentAnnualDividend, item.currentAnnualDividend === 0)}</td>
                      <td>{formatUSDOrEmpty(item.expectedAnnualDividend, item.expectedAnnualDividend === 0)}</td>
                      <td>{formatDate(item.nextExDate)}</td>
                      <td>{formatDate(item.nextPaymentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <aside className="note-card editor-help">
          <div className="section-head">
            <div>
              <h2>읽는 법</h2>
              <p>현재 기준은 최근 12개월 실제 배당, 예상 기준은 앞으로의 배당 추정치입니다.</p>
            </div>
          </div>
          <div className="editor-help-list">
            <div className="editor-help-item">
              <strong>현재 기준</strong>
              <span>지난 12개월 배당을 기준으로 월/연 배당을 계산합니다.</span>
            </div>
            <div className="editor-help-item">
              <strong>예상 기준</strong>
              <span>최근 배당금과 빈도를 바탕으로 앞으로 받을 금액을 추정합니다.</span>
            </div>
            <div className="editor-help-item">
              <strong>총액</strong>
              <span>내 보유수량을 곱한 포트폴리오 전체 월/연 배당 합계입니다.</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

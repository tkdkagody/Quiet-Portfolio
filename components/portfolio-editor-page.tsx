"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StockSearchRow } from "@/components/stock-search-row";
import { useTheme } from "@/components/theme-provider";
import {
  buildDraftRows,
  createDraftRow,
  DEFAULT_WATCHLIST,
  loadPersistedWatchlist,
  parseDraftRows,
  STORAGE_KEY
} from "@/lib/portfolio";
import { DraftRow } from "@/lib/types";

export function PortfolioEditorPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [draftRows, setDraftRows] = useState<DraftRow[]>(buildDraftRows(DEFAULT_WATCHLIST));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextWatchlist = loadPersistedWatchlist();
    setDraftRows(buildDraftRows(nextWatchlist));
  }, []);

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setDraftRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setDraftRows((current) => [...current, createDraftRow()]);
  }

  function removeRow(id: string) {
    setDraftRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function handleSave() {
    const unresolvedRows = draftRows.filter((row) => row.query.trim() && !row.symbol);
    if (unresolvedRows.length) {
      setMessage("검색 결과에서 종목을 선택하지 않은 행이 있습니다. 목록에서 눌러 확정해 주세요.");
      return false;
    }

    const parsed = parseDraftRows(draftRows);
    if (!parsed.length) {
      setMessage("최소 1개 이상의 종목과 보유수량을 입력해 주세요.");
      return false;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    setMessage("저장했습니다. 대시보드에서 바로 확인할 수 있습니다.");
    return true;
  }

  function handleSaveAndReturn() {
    if (handleSave()) {
      window.setTimeout(() => {
        router.push("/");
      }, 120);
    }
  }

  function handleReset() {
    setDraftRows(buildDraftRows(DEFAULT_WATCHLIST));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    setMessage("예시 종목으로 복원했습니다.");
  }

  return (
    <main className="note-shell">
      <section className="note-topbar">
        <div className="note-topbar-copy">
          <span className="note-kicker">Deskfolio</span>
          <h1>배당 종목 입력</h1>
          <p>종목명 검색 후 선택하고, 보유수량과 평균매수가를 적어서 노트처럼 저장합니다.</p>
        </div>
        <div className="note-actions">
          <Link className="ghost-btn" href="/">
            대시보드
          </Link>
          <button className="ghost-btn" type="button" onClick={toggleTheme}>
            {theme === "dark" ? "주간모드" : "야간모드"}
          </button>
        </div>
      </section>

      <section className="note-grid editor-grid">
        <article className="note-card editor-board">
          <div className="section-head">
            <div>
              <h2>미주 보유 종목</h2>
              <p>검색 결과에서 종목을 선택한 뒤 수량과 평단을 적어주세요.</p>
            </div>
            <span className="subtle">{draftRows.length}행</span>
          </div>

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
            <button className="primary-btn" type="button" onClick={handleSave}>
              저장
            </button>
            <button className="ghost-btn" type="button" onClick={handleSaveAndReturn}>
              저장 후 대시보드
            </button>
            <button className="ghost-btn" type="button" onClick={addRow}>
              행 추가
            </button>
            <button className="ghost-btn" type="button" onClick={handleReset}>
              예시 복원
            </button>
          </div>

          {message ? <div className="loading-box editor-message">{message}</div> : null}
        </article>

        <aside className="note-card editor-help">
          <div className="section-head">
            <div>
              <h2>입력 팁</h2>
              <p>메모는 대시보드의 종목별 상세에도 같이 표시됩니다.</p>
            </div>
          </div>

          <div className="editor-help-list">
            <div className="editor-help-item">
              <strong>1. 종목 검색</strong>
              <span>Apple, SCHD, Coca-Cola 같이 이름이나 티커를 입력합니다.</span>
            </div>
            <div className="editor-help-item">
              <strong>2. 결과 선택</strong>
              <span>목록에서 눌러야 심볼이 확정됩니다. 입력만 하면 저장되지 않습니다.</span>
            </div>
            <div className="editor-help-item">
              <strong>3. 수량과 평단</strong>
              <span>보유수량과 평균매수가를 넣으면 예상 배당과 손익을 바로 계산합니다.</span>
            </div>
            <div className="editor-help-item">
              <strong>4. 메모</strong>
              <span>배당주 목적, 매수 이유, 리밸런싱 기준을 짧게 적어두면 나중에 보기 쉽습니다.</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

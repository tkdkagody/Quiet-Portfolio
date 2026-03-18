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
      setMessage("최소 1개 이상의 종목과 금액을 입력해 주세요.");
      return false;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    setMessage("보유 종목이 저장되었습니다. 대시보드에서 바로 반영됩니다.");
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
    <main className="shell">
      <section className="shell-topbar">
        <div className="shell-topbar-copy">
          <strong>Deskfolio</strong>
          <span>보유 종목과 금액을 정리해서 저장하는 입력 전용 화면</span>
        </div>
        <div className="page-actions">
          <Link className="ghost-btn" href="/">
            대시보드로 돌아가기
          </Link>
          <button
            className="ghost-btn"
            type="button"
            onClick={toggleTheme}
          >
            {theme === "dark" ? "주간모드" : "야간모드"}
          </button>
        </div>
      </section>

      <section className="editor-layout">
        <section className="panel editor-page-panel">
          <div className="panel-title">
            <h2>미주 보유 종목 입력</h2>
            <span className="subtle">{draftRows.length}개 행</span>
          </div>
          <p className="hint">
            종목명으로 검색한 뒤 결과를 선택하고, 투자금액을 넣어 저장합니다. 이 페이지는 입력만
            담당하고 실제 확인은 대시보드에서 합니다.
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
              예시 종목 복원
            </button>
          </div>

          {message ? <div className="loading-box" style={{ marginTop: 14 }}>{message}</div> : null}
        </section>

        <aside className="panel editor-help-panel">
          <div className="panel-title">
            <h3>입력 팁</h3>
          </div>
          <div className="editor-help-list">
            <div className="editor-help-item">
              <strong>1. 종목명으로 검색</strong>
              <span>예: Apple, SCHD, Tesla, Nvidia</span>
            </div>
            <div className="editor-help-item">
              <strong>2. 검색 결과에서 확정</strong>
              <span>이름만 입력하면 저장되지 않습니다. 목록에서 눌러야 심볼이 확정됩니다.</span>
            </div>
            <div className="editor-help-item">
              <strong>3. 투자금액 입력</strong>
              <span>원화 기준 금액을 넣으면 대시보드에서 추정 수량과 환산 가격을 같이 보여줍니다.</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

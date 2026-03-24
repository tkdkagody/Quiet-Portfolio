"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StockSearchRow } from "@/components/stock-search-row";
import { useTheme } from "@/components/theme-provider";
import {
  buildEditorRows,
  createDraftRow,
  loadPersistedWatchlist,
  parseDraftRows,
  STORAGE_KEY
} from "@/lib/portfolio";
import { DraftRow } from "@/lib/types";

export function PortfolioEditorPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [draftRows, setDraftRows] = useState<DraftRow[]>([createDraftRow()]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadPersistedWatchlist();
    if (saved.length) {
      setDraftRows(buildEditorRows(saved));
    }
  }, []);

  const previewRows = useMemo(
    () =>
      draftRows
        .filter((row) => row.query.trim() || row.symbol || row.shares.trim() || row.avgPriceUsd.trim() || row.note.trim())
        .map((row) => ({
          id: row.id,
          title: row.symbol || row.query || "미확정",
          subtitle: row.symbol ? row.name || row.symbol : "종목 선택 전",
          exchange: row.exchange,
          shares: row.shares,
          avgPriceUsd: row.avgPriceUsd,
          note: row.note
        }))
        .sort((left, right) => {
          const leftKey = left.title.toUpperCase();
          const rightKey = right.title.toUpperCase();
          return rightKey.localeCompare(leftKey);
        }),
    [draftRows]
  );

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
    setDraftRows([createDraftRow()]);
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage("빈 입력칸으로 복원했습니다.");
  }

  return (
    <main className="note-shell">
      <section className="note-topbar">
        <div className="note-topbar-copy">
          <span className="note-kicker">Deskfolio</span>
          <h1>노트 입력</h1>
          <p>종목명 검색 후 선택하고, 보유수량과 평균매수가를 적어서 저장합니다.</p>
        </div>
        <div className="note-actions">
          <Link className="ghost-btn" href="/">
            대시보드
          </Link>
          <Link className="ghost-btn" href="/dividends">
            예상 배당금
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
              <h2>종목 입력</h2>
              <p>검색 결과에서 종목을 선택한 뒤 수량과 평단을 적어주세요.</p>
            </div>
            <span className="subtle">{draftRows.length}행</span>
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
              빈 행 복원
            </button>
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

          {message ? <div className="loading-box editor-message">{message}</div> : null}
        </article>

        <aside className="note-card editor-preview">
          <div className="section-head">
            <div>
              <h2>입력된 종목</h2>
              <p>왼쪽에서 입력한 항목이 여기 쌓입니다.</p>
            </div>
            <span className="subtle">{previewRows.length}개</span>
          </div>

          <div className="editor-preview-list">
            {previewRows.length ? (
              previewRows.map((row) => (
                <div key={row.id} className="editor-preview-item">
                  <div className="editor-preview-main">
                    <strong>{row.title}</strong>
                    <span>{row.subtitle}</span>
                  </div>
                  <div className="editor-preview-meta">
                    <span>{row.shares ? `${row.shares}주` : "수량 없음"}</span>
                    <span>{row.avgPriceUsd ? `$${row.avgPriceUsd}` : "평단 없음"}</span>
                    {row.note ? <span>{row.note}</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty note-empty">입력한 종목이 여기 쌓입니다.</div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

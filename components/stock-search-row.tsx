"use client";

import { useEffect, useState } from "react";
import { DraftRow, SymbolSearchResult } from "@/lib/types";

type StockSearchRowProps = {
  index: number;
  row: DraftRow;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<DraftRow>) => void;
  onRemove: (id: string) => void;
};

export function StockSearchRow({
  index,
  row,
  canRemove,
  onChange,
  onRemove
}: StockSearchRowProps) {
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const query = row.query.trim();
    const shouldSearch = query.length > 0 && (!row.symbol || query !== row.name);

    if (!shouldSearch) {
      setResults([]);
      setLoading(false);
      setMessage(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const payload = (await response.json()) as
          | { items: SymbolSearchResult[] }
          | { message: string };

        if (!response.ok) {
          throw new Error("message" in payload ? payload.message : "종목 검색 실패");
        }

        const nextPayload = payload as { items: SymbolSearchResult[] };
        setResults(nextPayload.items);
        if (!nextPayload.items.length) {
          setMessage("검색 결과가 없습니다.");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setMessage(error instanceof Error ? error.message : "종목 검색 실패");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [row.name, row.query, row.symbol]);

  return (
    <div className="editor-row">
      <div className="editor-row-head">
        <strong>{index + 1}</strong>
        <button className="mini-btn" type="button" onClick={() => onRemove(row.id)} disabled={!canRemove}>
          삭제
        </button>
      </div>

      <label className="field">
        <span>종목명 또는 티커 검색</span>
        <input
          value={row.query}
          onChange={(event) =>
            onChange(row.id, {
              query: event.target.value,
              symbol: "",
              name: "",
              exchange: ""
            })
          }
          placeholder="애플, 삼성증권, AAPL"
          spellCheck={false}
        />
      </label>

      {row.symbol ? (
        <div className="selected-chip">
          <strong>{row.name || row.symbol}</strong>
          <span>
            {row.symbol}
            {row.exchange ? ` · ${row.exchange}` : ""}
          </span>
        </div>
      ) : null}

      {loading ? <p className="search-meta">검색 중...</p> : null}
      {message ? <p className="search-meta">{message}</p> : null}

      {results.length > 0 ? (
        <div className="search-results">
          {results.map((result) => (
            <button
              key={`${result.symbol}-${result.exchange}`}
              className="search-result"
              type="button"
              onClick={() =>
                onChange(row.id, {
                  query: result.name,
                  symbol: result.symbol,
                  name: result.name,
                  exchange: result.exchange
                })
              }
            >
              <strong>{result.name}</strong>
              <span>
                {result.symbol}
                {result.exchange ? ` · ${result.exchange}` : ""}
                {result.currency ? ` · ${result.currency}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <label className="field">
        <span>보유수량</span>
        <input
          inputMode="numeric"
          value={row.shares}
          onChange={(event) =>
            onChange(row.id, {
              shares: event.target.value.replace(/[^\d.]/g, "")
            })
          }
          placeholder="10"
        />
      </label>

      <label className="field">
        <span>평단가 (USD)</span>
        <input
          inputMode="decimal"
          value={row.avgPriceUsd}
          onChange={(event) =>
            onChange(row.id, {
              avgPriceUsd: event.target.value.replace(/[^\d.]/g, "")
            })
          }
          placeholder="75.00"
        />
      </label>

      <label className="field">
        <span>메모</span>
        <input
          value={row.note}
          onChange={(event) => onChange(row.id, { note: event.target.value })}
          placeholder="예: 장기 보유"
        />
      </label>
    </div>
  );
}

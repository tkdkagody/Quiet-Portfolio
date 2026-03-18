"use client";

import { useEffect, useState } from "react";
import { SymbolSearchResult } from "@/lib/types";

export type DraftRow = {
  id: string;
  query: string;
  symbol: string;
  name: string;
  exchange: string;
  amountKrw: string;
};

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
                  query: result.instrumentName,
                  symbol: result.symbol,
                  name: result.instrumentName,
                  exchange: result.exchange
                })
              }
            >
              <strong>{result.instrumentName}</strong>
              <span>
                {result.symbol}
                {result.exchange ? ` · ${result.exchange}` : ""}
                {result.country ? ` · ${result.country}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <label className="field">
        <span>투자금액 (KRW)</span>
        <input
          inputMode="numeric"
          value={row.amountKrw}
          onChange={(event) =>
            onChange(row.id, {
              amountKrw: event.target.value.replace(/[^\d.]/g, "")
            })
          }
          placeholder="1000000"
        />
      </label>
    </div>
  );
}

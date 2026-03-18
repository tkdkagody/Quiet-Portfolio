"use client";

import { StockSeriesPoint } from "@/lib/types";

type StockChartProps = {
  data: StockSeriesPoint[];
  positive: boolean;
};

function formatLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric"
  }).format(date);
}

export function StockChart({ data, positive }: StockChartProps) {
  if (data.length < 2) {
    return (
      <div className="empty">
        차트를 그리기 위한 데이터가 부족합니다. 다른 종목을 선택하거나 조금 뒤에 다시 새로고침해 보세요.
      </div>
    );
  }

  const width = 880;
  const height = 320;
  const padding = 26;
  const closes = data.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.close - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;
  const stroke = positive ? "#0f766e" : "#c2410c";
  const fill = positive ? "rgba(15, 118, 110, 0.12)" : "rgba(194, 65, 12, 0.12)";
  const latestPoint = points[points.length - 1];

  return (
    <>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="30일 종가 차트">
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={fill} />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {[0.2, 0.5, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={padding}
              x2={width - padding}
              y1={padding + (height - padding * 2) * ratio}
              y2={padding + (height - padding * 2) * ratio}
              stroke="rgba(20, 33, 61, 0.08)"
              strokeDasharray="4 6"
            />
          ))}
          <path d={areaPath} fill="url(#chartGradient)" />
          <path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={latestPoint.x} cy={latestPoint.y} r="6" fill={stroke} />
        </svg>
      </div>
      <div className="chart-metrics">
        <span>{formatLabel(data[0].datetime)}</span>
        <span>저점 {min.toFixed(2)}</span>
        <span>고점 {max.toFixed(2)}</span>
        <span>{formatLabel(data[data.length - 1].datetime)}</span>
      </div>
    </>
  );
}

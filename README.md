# Deskfolio

미국 종목 보유 내역을 노트처럼 정리하고, 최근 종가, 손익, 일정, 예상 월배당/연배당을 확인하는 Next.js 앱입니다.

## 실행

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 설정

```bash
cp .env.example .env.local
```

`POLYGON_API_KEY`에 [Polygon](https://polygon.io/pricing)의 API 키를 넣어 주세요.

3. 개발 서버 실행

```bash
npm run dev
```

## 입력 형식

입력은 `/portfolio` 페이지에서 하고, 메인 `/`은 확인용 대시보드로 사용합니다.

입력 페이지에서 아래 순서로 입력합니다.

- 종목명 또는 티커 검색: `SCHD`, `Coca-Cola`, `AAPL` 같은 검색어 입력 후 결과 선택
- 보유수량: `10` 같은 주식 수량
- 평단가 (USD): `75.00` 같은 평균 매수가
- 메모: 배당 목적, 매수 이유, 리밸런싱 기준 등 짧은 기록

기본 예시는 `SCHD / 10주 / $75`, `KO / 8주 / $58`입니다.

## API 사용 방식

- 포트폴리오 요약은 `POST /api/portfolio`
- 차트는 선택한 종목만 `GET /api/stocks/chart`
- 종목 검색은 `GET /api/symbol-search`
- 최근 종가는 수동 `새로고침` 버튼으로만 갱신

## 구현 포인트

- `app/api/portfolio/route.ts`: 최근 종가, 배당, 손익, 월배당 계산
- `app/api/stocks/chart/route.ts`: 선택 종목 차트만 별도 전달
- `components/portfolio-dashboard.tsx`: 노트와 요약 화면
- `components/stock-chart.tsx`: 외부 차트 라이브러리 없이 SVG로 30일 추세 렌더링

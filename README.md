# Stock Board

보유 주식의 현재가, 원화 환산 단가, 적용 환율, 선택 종목 30일 차트를 한 화면에서 확인하는 Next.js 대시보드입니다.

## 실행

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 설정

```bash
cp .env.example .env.local
```

`TWELVE_DATA_API_KEY`에 [Twelve Data](https://twelvedata.com/docs)의 API 키를 넣어 주세요.

3. 개발 서버 실행

```bash
npm run dev
```

## 입력 형식

왼쪽 입력 패널에서 아래 순서로 입력합니다.

- 종목명 또는 티커 검색: `애플`, `삼성증권`, `AAPL` 같은 검색어 입력 후 결과 선택
- 투자금액 (KRW): `1000000` 같은 원화 금액

기본 예시는 `AAPL / 1,000,000원`, `삼성증권(016360) / 100,000원`입니다.

## API 사용량 최적화

- 전체 종목 목록은 현재가와 환율만 조회
- 30일 차트는 선택한 종목만 별도 조회
- 자동 1분 새로고침 대신 수동 `시세 새로고침` 버튼 사용

## 구현 포인트

- `app/api/stocks/route.ts`: 전체 종목 현재가/환율 전달
- `app/api/stocks/chart/route.ts`: 선택 종목 차트만 별도 전달
- `components/portfolio-dashboard.tsx`: 행 단위 입력 UI와 로컬 스토리지 기반 종목 관리
- `components/stock-chart.tsx`: 외부 차트 라이브러리 없이 SVG로 30일 추세 렌더링
# Quiet-Portfolio

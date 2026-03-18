import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Board",
  description: "보유 주식 현재가와 차트를 한눈에 확인하는 Next.js 대시보드"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

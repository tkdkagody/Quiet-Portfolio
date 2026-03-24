import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/polygon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 1) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await searchSymbols(query);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({
      items: [],
      message: error instanceof Error ? error.message : "종목 검색에 실패했습니다."
    });
  }
}

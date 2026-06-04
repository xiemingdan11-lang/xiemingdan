import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = searchParams.toString();
  try {
    const res = await fetch("http://124.222.223.153:8000/api/search?" + params);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "爬虫服务器连接失败" }, { status: 500 });
  }
}
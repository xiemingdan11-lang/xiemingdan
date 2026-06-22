import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('url parameter is required', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.taobao.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Error: ${message}`, { status: 500 });
  }
}

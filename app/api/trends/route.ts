import { NextResponse } from 'next/server';

// 简单内存缓存（Vercel serverless 实例间不共享，但单次请求内有效）
let cache: { data: Record<string, unknown>; time: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1小时

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

// ===== 微博热搜 =====
async function scrapeWeibo() {
  try {
    const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
      headers: { ...HEADERS, 'Referer': 'https://weibo.com/' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return data.data.realtime.slice(0, 25).map((item: Record<string, unknown>, i: number) => ({
      rank: i + 1,
      title: (item.note || item.word || '') as string,
      hotValue: String(item.num || ''),
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent((item.note || item.word || '') as string)}`,
    })).filter((item: { title: string }) => item.title);
  } catch {
    return [];
  }
}

// ===== 知乎热榜 =====
async function scrapeZhihu() {
  try {
    const res = await fetch('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=25', {
      headers: { ...HEADERS, 'Referer': 'https://www.zhihu.com/hot' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return data.data.slice(0, 25).map((item: Record<string, unknown>, i: number) => {
      const target = (item.target || {}) as Record<string, unknown>;
      return {
        rank: i + 1,
        title: (target.title || '') as string,
        hotValue: (item.detail_text || '') as string,
        url: (target.url || '') as string,
      };
    }).filter((item: { title: string }) => item.title);
  } catch {
    return [];
  }
}

// ===== 今日头条热榜 =====
async function scrapeToutiao() {
  try {
    const res = await fetch(
      'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
      {
        headers: { ...HEADERS, 'Referer': 'https://www.toutiao.com/' },
        signal: AbortSignal.timeout(10000),
      }
    );
    const data = await res.json();
    return (data.data || []).slice(0, 25).map((item: Record<string, unknown>, i: number) => ({
      rank: i + 1,
      title: (item.Title || '') as string,
      hotValue: String(item.HotValue || ''),
      url: (item.Url || '') as string,
    })).filter((item: { title: string }) => item.title);
  } catch {
    return [];
  }
}

// ===== 汇总 =====
async function fetchAllTrends() {
  const [weibo, zhihu, toutiao] = await Promise.allSettled([
    scrapeWeibo(),
    scrapeZhihu(),
    scrapeToutiao(),
  ]);

  const result: Record<string, unknown> = {
    _updatedAt: new Date().toLocaleString('zh-CN'),
  };

  if (weibo.status === 'fulfilled' && weibo.value.length > 0) result['微博热搜'] = weibo.value;
  if (zhihu.status === 'fulfilled' && zhihu.value.length > 0) result['知乎热榜'] = zhihu.value;
  if (toutiao.status === 'fulfilled' && toutiao.value.length > 0) result['今日头条'] = toutiao.value;

  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  // 检查缓存
  if (!forceRefresh && cache && Date.now() - cache.time < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const data = await fetchAllTrends();
  cache = { data, time: Date.now() };

  return NextResponse.json(data);
}

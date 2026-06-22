import { NextResponse } from 'next/server';

function pickMeta(html: string, names: string[]) {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1]);
    }
  }
  return '';
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function absoluteImage(url: string) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return '';
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function extractImages(html: string) {
  const images = [
    ...Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)).map(match => match[1]),
    ...Array.from(html.matchAll(/["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)).map(match => match[1]),
    ...Array.from(html.matchAll(/["'](\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)).map(match => match[1]),
  ]
    .map(absoluteImage)
    .filter(Boolean)
    .filter(url => !url.includes('data:image'))
    .filter(url => !url.includes('avatar'))
    .filter(url => !url.includes('icon'));

  return unique(images).slice(0, 12);
}

function extractTitle(html: string) {
  const metaTitle = pickMeta(html, ['og:title', 'twitter:title', 'title']);
  if (metaTitle) return metaTitle.replace(/[-_].*淘宝.*/, '').trim();

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch?.[1]) return decodeHtml(titleMatch[1]).replace(/[-_].*淘宝.*/, '').trim();

  const jsonTitle = html.match(/"title"\s*:\s*"([^"]+)"/i);
  if (jsonTitle?.[1]) return decodeHtml(jsonTitle[1]);

  return '';
}

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ success: false, error: '请提供淘宝商品链接' });
  }

  try {
    const target = new URL(url);
    const res = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(18000),
    });

    const html = await res.text();
    const images = extractImages(html);
    const title = extractTitle(html);
    const description = pickMeta(html, ['description', 'og:description']) || '';
    const mainImage = absoluteImage(pickMeta(html, ['og:image', 'twitter:image'])) || images[0] || '';

    return NextResponse.json({
      success: true,
      product: {
        title: title || '未识别标题',
        url,
        mainImage,
        detailImages: images.filter(image => image !== mainImage).slice(0, 8),
        detailText: description,
      },
      warning: title || mainImage ? '' : '淘宝页面可能开启了反爬，已保存链接，可手动补充标题和图片。',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '解析失败';
    return NextResponse.json({
      success: false,
      error: `淘宝链接解析失败：${message}`,
    });
  }
}

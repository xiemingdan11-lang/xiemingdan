import { NextResponse } from 'next/server';

const REPO = process.env.GITHUB_REPO || 'xiemingdan11-lang/xiemingdan';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

function extensionFromMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'jpg';
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'material';
}

async function imageToBase64(image: string) {
  if (image.startsWith('data:image/')) {
    const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) throw new Error('图片数据格式不正确');
    return {
      base64: match[2],
      ext: extensionFromMime(match[1]),
    };
  }

  const res = await fetch(image, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(18000),
  });
  if (!res.ok) throw new Error(`下载图片失败 ${res.status}`);

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return {
    base64: Buffer.from(arrayBuffer).toString('base64'),
    ext: extensionFromMime(contentType),
  };
}

export async function POST(request: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({
      success: false,
      error: '未配置 GITHUB_TOKEN，请在 Vercel 环境变量中添加 GitHub Token',
    });
  }

  const { image, title, kind = 'main' } = await request.json();
  if (!image || typeof image !== 'string') {
    return NextResponse.json({ success: false, error: '请提供图片链接或图片数据' });
  }

  try {
    const { base64, ext } = await imageToBase64(image);
    const filename = `${Date.now()}-${slug(title || kind)}.${ext}`;
    const path = `public/materials/${filename}`;

    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `上传素材 ${filename}`,
        content: base64,
        branch: BRANCH,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data.message || '上传 GitHub 失败' });
    }

    return NextResponse.json({
      success: true,
      path,
      githubUrl: data.content?.html_url,
      rawUrl: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`,
      siteUrl: `/${path.replace(/^public\//, '')}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '上传失败';
    return NextResponse.json({ success: false, error: message });
  }
}

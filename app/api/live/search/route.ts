import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { makeId } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEARCH_DIR = path.join(process.cwd(), "public", "live-search");
const STORAGE_STATE = process.env.LIVE_CAPTURE_STORAGE_STATE || "";
const CHROMIUM_EXECUTABLE = process.env.LIVE_CAPTURE_CHROMIUM_EXECUTABLE || "";

type SearchBody = {
  keyword?: string;
};

type SearchCandidate = {
  title: string;
  url: string;
};

type PageDiagnostics = {
  title: string;
  text: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SearchBody;
  const keyword = String(body.keyword || "").trim();

  if (!keyword) {
    return NextResponse.json({ error: "请输入搜索关键词。" }, { status: 400 });
  }

  const searchId = makeId("search");
  const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=live`;

  try {
    const { chromium } = await import("playwright");
    await mkdir(SEARCH_DIR, { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_EXECUTABLE || undefined
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
      storageState: STORAGE_STATE && existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined
    });
    const page = await context.newPage();

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(3500);
    await page.mouse.wheel(0, 900).catch(() => undefined);
    await page.waitForTimeout(1200);

    const candidates = await page.evaluate(() => {
      const seen = new Set<string>();
      const rows: SearchCandidate[] = [];

      for (const link of Array.from(document.querySelectorAll("a"))) {
        const href = link.getAttribute("href") || "";
        const text = (link.textContent || "").replace(/\s+/g, " ").trim();
        if (!href) continue;

        let url = "";
        try {
          url = new URL(href, location.origin).toString();
        } catch {
          continue;
        }

        const looksLikeLive = url.includes("live.douyin.com") || /\/live\//.test(url) || text.includes("直播");
        if (!looksLikeLive || seen.has(url)) continue;

        seen.add(url);
        rows.push({
          title: text.slice(0, 80) || "直播间候选",
          url
        });
      }

      return rows.slice(0, 12);
    });

    const diagnostics = await page.evaluate((): PageDiagnostics => ({
      title: document.title || "",
      text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 500)
    }));

    const fileName = `${searchId}.png`;
    await page.screenshot({ path: path.join(SEARCH_DIR, fileName), fullPage: false });
    await context.close();
    await browser.close();

    return NextResponse.json({
      ok: true,
      keyword,
      searchUrl,
      screenshotUrl: `/api/live/media?kind=search&file=${fileName}`,
      candidates,
      message: candidates.length ? "" : summarizeSearchPage(diagnostics)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "搜索失败。";
    return NextResponse.json({ error: message, keyword, searchUrl, candidates: [] }, { status: 500 });
  }
}

function summarizeSearchPage(diagnostics: PageDiagnostics) {
  const text = `${diagnostics.title} ${diagnostics.text}`;
  if (/验证|校验|captcha|安全|登录|扫码|请完成/i.test(text)) {
    return "搜索页出现登录/验证，请先更新登录态或在服务器浏览器里完成验证。";
  }
  return "已打开搜索页，但没有识别到直播间候选。";
}

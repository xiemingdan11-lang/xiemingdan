import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL = process.env.WORKBENCH_BACKEND_URL ?? (process.env.VERCEL ? "http://124.222.223.153" : "");
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

type TitleRequestItem = {
  id?: string;
  sourceTitle?: string;
  title?: string;
  price?: string;
  shop?: string;
  note?: string;
};

type TitleResult = {
  id: string;
  recommended: string;
  titles: string[];
  keywords: string[];
};

const SYSTEM_PROMPT = `你是淘宝和闲鱼虚拟商品标题优化助手。
目标：基于原标题生成更适合搜索和上架的新标题。

规则：
1. 保留核心商品类型和高价值搜索词。
2. 去掉品牌词、店铺名、官方、旗舰店、正品、logo、水印、网盘、微信等风险词。
3. 不承诺收益、提分、保过、录取、治愈、内部资料。
4. 标题适合虚拟资料、课程、模板、教程、素材包类商品。
5. 每个标题尽量 24 到 30 个中文字符，可用空格分隔关键词，不要使用标点符号。
6. 返回 JSON，不要解释。`;

export async function POST(request: Request) {
  if (BACKEND_URL) {
    return proxyToBackend(request);
  }

  const body = await request.json().catch(() => null);
  const items = normalizeItems(body);

  if (!items.length) {
    return NextResponse.json({ success: false, error: "请提供需要优化的标题。" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "服务器未配置 DEEPSEEK_API_KEY。" }, { status: 500 });
  }

  try {
    const results: TitleResult[] = [];
    for (const item of items) {
      results.push(await optimizeOne(item, apiKey));
    }
    return NextResponse.json({ success: true, items: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "标题优化失败。";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function proxyToBackend(request: Request) {
  const body = await request.text();
  const response = await fetch(new URL("/api/title-optimize", BACKEND_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" }
  });
}

function normalizeItems(body: unknown): TitleRequestItem[] {
  if (!body || typeof body !== "object") return [];
  const data = body as { items?: TitleRequestItem[]; title?: string; sourceTitle?: string; price?: string; detail?: string };
  if (Array.isArray(data.items)) {
    return data.items.filter((item) => (item.sourceTitle || item.title || "").trim());
  }
  if (data.title || data.sourceTitle) {
    return [{ id: "single", sourceTitle: data.sourceTitle ?? data.title, price: data.price, note: data.detail }];
  }
  return [];
}

async function optimizeOne(item: TitleRequestItem, apiKey: string): Promise<TitleResult> {
  const sourceTitle = (item.sourceTitle || item.title || "").trim();
  const response = await fetch(new URL("/v1/chat/completions", DEEPSEEK_BASE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            sourceTitle,
            price: item.price ?? "",
            shop: item.shop ?? "",
            note: item.note ?? "",
            output: {
              recommended: "最佳标题",
              titles: ["标题1", "标题2", "标题3", "标题4", "标题5"],
              keywords: ["核心词1", "核心词2"]
            }
          })
        }
      ],
      temperature: 0.55,
      max_tokens: 900
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek API ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseModelJson(content, sourceTitle);
  return {
    id: item.id ?? sourceTitle,
    recommended: parsed.recommended,
    titles: parsed.titles,
    keywords: parsed.keywords
  };
}

function parseModelJson(content: string, sourceTitle: string): Omit<TitleResult, "id"> {
  try {
    const parsed = JSON.parse(content);
    const titles = cleanTitles(Array.isArray(parsed.titles) ? parsed.titles : []);
    const recommended = cleanTitle(parsed.recommended) || titles[0] || fallbackTitle(sourceTitle);
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 12) : [];
    return { recommended, titles: titles.length ? titles : [recommended], keywords };
  } catch {
    const titles = cleanTitles(content.split(/\r?\n/));
    const recommended = titles[0] || fallbackTitle(sourceTitle);
    return { recommended, titles: titles.length ? titles : [recommended], keywords: [] };
  }
}

function cleanTitles(values: unknown[]) {
  return values
    .map((value) => cleanTitle(String(value)))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 5);
}

function cleanTitle(value: string) {
  return value
    .replace(/^[-\d.\s、，。:：]+/, "")
    .replace(/[，。、“”‘’《》【】[\]{}()（）!！?？,:：;；|/\\]/g, " ")
    .replace(/官方|旗舰店|正品|品牌|logo|LOGO|水印|微信|网盘/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function fallbackTitle(sourceTitle: string) {
  return cleanTitle(sourceTitle) || "虚拟资料教程模板素材包电子版";
}

import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { LIVE_BACKEND_URL, hasLiveBackend } from "@/lib/live-backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOT_DIR = path.join(process.cwd(), "public", "live-shots");

// ── SKILL 提示词 ──────────────────────────────────────────────────────────────

const SKILL_FULL = `你是一个极其死磕细节的图像反推专家与AI提示词工程师。你的任务是打破AI的"刻板印象"，通过深度解构画面的"主信息、画面结构、质感、光影、镜头"，结合"几何形状+物理材质"的精准描述，完美还原参考图视觉张力，输出可直接执行的中文提示词。

核心工作纪律：
1. 精准可视化（拒绝空泛）：禁止使用宽泛词汇（如"复杂的机械"、"好看的背景"）。必须拆解为【几何形状+物理材质】（如"弯曲的拉丝金属管与高透玻璃夹具"）。
2. 严谨推测：对于不确定的信息，必须使用"可能/疑似"并提供备选，绝对不要硬猜。
3. 空间张力校正：精准区分"悬浮特效"与"地面物理存在"。

按照以下"5抓"原则进行像素级拆解：
- 抓主信息：主体是谁/是什么材质？在做什么？画面情绪？
- 抓画面结构：几何位置、前中背景层次、留白、视觉中心、构图规则？
- 抓质感与风格：媒介类型（摄影/3D/插画）？材质细节（塑料/金属/毛绒/磨砂玻璃）？
- 抓光影与色调：冷暖、饱和度、对比度？主光源在哪？柔光/硬光/轮廓光？
- 抓镜头语言：景别（特写/全身）？视角（平视/俯视/仰视）？景深？焦段感？

请严格按照以下格式输出（全部中文）：

📷 画面简介：
[用1-2句话总结主体、场景与整体氛围]

🎥 镜头视角分析：
[详细分析景别、机位视角、焦段感与景深效果，解释需要设定什么样的镜头角度才能复刻此画面]

📐 构图排布分析：
[详细拆解构图法则（三分法/中心对称/对角线等）、前中背景层次叠放关系、留白比例]

✨ 自然语言版提示词：
\`\`\`
[基于"5抓"原则，融合几何、材质、光影、镜头语言，写一段逻辑连贯、细节死磕的中文提示词]
\`\`\`

🚫 负面提示词：
\`\`\`
[根据画面风格提供防翻车词汇，如：低画质, 畸变, 模糊, 抠图感, 水印 等]
\`\`\``;

const SKILL_SIMPLIFIED = `你是一个图像反推专家与AI提示词工程师。通过深度解构画面的"主信息、画面结构、质感、光影、镜头"，结合"几何形状+物理材质"的精准描述，输出可直接执行的中文提示词。

核心规则：禁止使用宽泛词汇，必须拆解为【几何形状+物理材质】。全部输出中文。

请严格按照以下格式输出：

📷 画面简介：
[用1-2句话总结主体、场景与整体氛围]

✨ 自然语言提示词（适用于 Midjourney / 豆包 / 可灵）：
\`\`\`
[基于主体材质、光影、镜头语言，写一段逻辑连贯、细节死磕的中文提示词]
\`\`\`

🚫 负面提示词：
\`\`\`
[防翻车词汇：低画质, 畸变, 模糊, 抠图感, 水印 等]
\`\`\``;

const DEFAULT_PROMPT = `你是一个直播间画面分析专家。请分析这张直播间截图，提取可用于AI生图复刻的关键视觉元素，输出中文关键词。

请按以下维度分析，每条简洁直观，可直接复制用于生图提示词：

🎨 整体风格：[如 618大促氛围、科技蓝、温馨家居、美妆时尚等]
🎭 色调配色：[主色调 + 辅助色 + 氛围感]
🏠 背景布景：[背景元素、装饰道具、灯光布置方式]
👗 主播形象：[服装风格、妆容氛围、整体气质]
📦 产品陈列：[展示方式、价格标牌样式、促销元素]

💡 生图关键词串：
\`\`\`
[精炼为可直接粘贴到生图模型的中文关键词，用逗号分隔]
\`\`\``;

// ── 获取图片 base64 ────────────────────────────────────────────────────────────

async function getImageBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (hasLiveBackend()) {
    const imgRes = await fetch(new URL(imageUrl, LIVE_BACKEND_URL), { cache: "no-store" });
    if (!imgRes.ok) throw new Error(`无法从后端获取图片: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const ct = imgRes.headers.get("content-type") || "image/jpeg";
    return { base64: buffer.toString("base64"), mimeType: ct.split(";")[0].trim() };
  }

  const urlObj = new URL(imageUrl, "http://local");
  const file = urlObj.searchParams.get("file");
  if (!file || !/^[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(file)) {
    throw new Error("无效的图片地址");
  }
  const filePath = path.join(SHOT_DIR, file);
  if (!filePath.startsWith(SHOT_DIR)) throw new Error("非法路径");

  const buffer = await readFile(filePath);
  const mimeType = file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg";
  return { base64: buffer.toString("base64"), mimeType };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      imageUrl?: string;
      skill?: "full" | "simplified" | null;
      apiKey?: string;
    };

    const { imageUrl, skill } = body;
    // 优先使用环境变量中的 API Key，其次使用前端传来的
    const apiKey = process.env.RELAY_API_KEY || process.env.QWEN_API_KEY || process.env.DEEPSEEK_API_KEY || body.apiKey || "";

    if (!apiKey.trim()) {
      return NextResponse.json({ error: "请提供 DeepSeek API Key（在界面设置或 Vercel 环境变量 DEEPSEEK_API_KEY）" }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
    }

    const { base64, mimeType } = await getImageBase64(imageUrl);

    const systemPrompt = skill === "full" ? SKILL_FULL : skill === "simplified" ? SKILL_SIMPLIFIED : DEFAULT_PROMPT;

    const response = await fetch("https://ai.comfly.org/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` }
              },
              {
                type: "text",
                text: "请分析这张直播间截图，输出可用于AI生图复刻的中文关键词和提示词。"
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return NextResponse.json(
        { error: errData.error?.message || `DeepSeek API 返回错误 ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ ok: true, content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

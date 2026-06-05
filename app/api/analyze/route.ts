import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `你是一个专门做虚拟商品选品的电商专家。
用户会给你一个热点关键词，你需要帮他分析：
1. 这个热点的用户群体和消费特征
2. 可以卖哪些虚拟商品（教程、素材、模板、工具、知识付费等）
3. 每个虚拟商品的具体形式和定价建议
4. 在哪些平台销售最合适（淘宝、咸鱼、抖音、小红书等）

请用结构化的方式回答，简洁实用，不要废话。`;

export async function POST(request: Request) {
  const { keyword } = await request.json();

  if (!keyword?.trim()) {
    return NextResponse.json({ success: false, error: '请输入关键词' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: '未配置 DEEPSEEK_API_KEY，请在 Vercel 项目设置 → Environment Variables 中添加',
    });
  }

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `热点关键词：【${keyword}】\n\n请分析这个热点，给出虚拟商品选品建议。` },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: `API 错误 ${res.status}: ${text}` });
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    return NextResponse.json({ success: true, keyword, analysis: content });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知错误';
    return NextResponse.json({ success: false, error: msg });
  }
}

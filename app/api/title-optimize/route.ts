import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `你是一个精通淘宝虚拟产品（教育培训/教程素材）的运营专家。请为用户的课程产品优化出一个高曝光、绝对合规的淘宝标题。

约束条件：
1. 字数严格控制在 28-30 个汉字。
2. 过滤所有名人、名校、知名平台等版权词，用通用行业词代替。
3. 严禁出现“微信”、“网盘”等站外引流词。
4. 不要出现任何标点符号（淘宝搜索不识别标点，浪费字数），用空格代替。

请输出以下三个维度的标题：

【版本1：零基础速成型（针对新手）】
结构突出：自动发货 + 技能大词 + 零基础小白入门 + 全套完整版/送素材

【版本2：职场/实战进阶型（针对高客单价/专业用户）】
结构突出：自动发货 + 高阶技能词 + 职场实战/面试求职 + 附源码讲义

【版本3：副业/变现干货型（针对搞钱/应用场景）】
结构突出：秒发 + 核心技能 + 副业搞钱/居家变现 + 从入门到精通

只输出三个版本标题，每行一个版本，不要解释。`;

export async function POST(request: Request) {
  const { title, detail } = await request.json();

  if (!title?.trim()) {
    return NextResponse.json({ success: false, error: '请提供原始标题' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: '未配置 DEEPSEEK_API_KEY，请在 Vercel 项目设置中添加',
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
          {
            role: 'user',
            content: `原始标题：${title}\n商品详情：${detail || '无'}\n请严格按规则输出三个标题版本。`,
          },
        ],
        temperature: 0.45,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: `API 错误 ${res.status}: ${text}` });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const titles = content
      .split('\n')
      .map((line: string) => line.replace(/^[-\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    return NextResponse.json({ success: true, titles, raw: content });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '未知错误';
    return NextResponse.json({ success: false, error: msg });
  }
}

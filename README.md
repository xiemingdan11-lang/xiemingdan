# 虚拟项目运营工作台

淘宝/闲鱼虚拟项目执行系统。第一版使用本地 mock 数据和浏览器 localStorage 保存，适合先部署到 Vercel 试用，后续再接 Supabase。

## 功能

- 总览看板
- 视频精华/SOP
- 关键词库
- 筛词工作台
- 商品库
- 上架记录
- 每日任务
- 数据复盘

## 本地运行

```bash
npm install
npm run dev
```

## Vercel 部署

导入 GitHub 仓库后，Vercel 会自动识别 Next.js。

默认配置：

- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`


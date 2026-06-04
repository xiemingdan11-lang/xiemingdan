"use client";

import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Home,
  Layers,
  LineChart,
  Plus,
  Rocket,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Store,
  Tags,
  TrendingUp,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Keyword = {
  id: number;
  word: string;
  source: string;
  direction: string;
  price: string;
  payCount: number;
  reviews: number;
  keep: boolean;
  note: string;
};

type Product = {
  id: number;
  name: string;
  keyword: string;
  platform: string;
  title: string;
  price: number;
  cover: string;
  detail: string;
  delivery: string;
  status: string;
};

type Task = {
  id: number;
  text: string;
  done: boolean;
};

type Listing = {
  id: number;
  product: string;
  taobao: boolean;
  xianyu: boolean;
  checked: boolean;
  maintained: boolean;
  cleaned: boolean;
};

type DailyMetric = {
  date: string;
  exposure: number;
  visitors: number;
  consults: number;
  orders: number;
  revenue: number;
};

const initialKeywords: Keyword[] = [
  {
    id: 1,
    word: "PPT教学能力大赛模板",
    source: "闲鱼",
    direction: "办公资料",
    price: "18.8-39",
    payCount: 65,
    reviews: 12,
    keep: true,
    note: "视频第7节示例，先看付款和评价"
  },
  {
    id: 2,
    word: "小红书美甲图片模板",
    source: "小红书",
    direction: "图片素材",
    price: "9.9-29.9",
    payCount: 41,
    reviews: 8,
    keep: true,
    note: "反向选品，检查是否能做出交付"
  },
  {
    id: 3,
    word: "7天起号全流程",
    source: "淘宝",
    direction: "教程资料",
    price: "19.9-59",
    payCount: 22,
    reviews: 5,
    keep: false,
    note: "待看同行数据"
  }
];

const initialProducts: Product[] = [
  {
    id: 1,
    name: "PPT教学能力大赛模板包",
    keyword: "PPT教学能力大赛模板",
    platform: "淘宝/闲鱼",
    title: "PPT教学能力大赛模板教学设计说课课件电子版",
    price: 18.8,
    cover: "待做",
    detail: "待做",
    delivery: "网盘链接",
    status: "准备中"
  },
  {
    id: 2,
    name: "美甲图片参考素材包",
    keyword: "小红书美甲图片模板",
    platform: "闲鱼",
    title: "整理了一套美甲图片参考模板可做款式灵感",
    price: 9.9,
    cover: "已做",
    detail: "待做",
    delivery: "网盘链接",
    status: "待上架"
  }
];

const initialTasks: Task[] = [
  { id: 1, text: "找词 20 个", done: false },
  { id: 2, text: "筛词 10 个", done: false },
  { id: 3, text: "做标题 3 个", done: false },
  { id: 4, text: "做主图 1 个", done: false },
  { id: 5, text: "淘宝上架", done: false },
  { id: 6, text: "闲鱼上架", done: false },
  { id: 7, text: "淘宝商品检测提交", done: false },
  { id: 8, text: "日常维护/清理商品", done: false }
];

const initialListings: Listing[] = [
  {
    id: 1,
    product: "PPT教学能力大赛模板包",
    taobao: false,
    xianyu: true,
    checked: false,
    maintained: false,
    cleaned: false
  },
  {
    id: 2,
    product: "美甲图片参考素材包",
    taobao: false,
    xianyu: false,
    checked: false,
    maintained: false,
    cleaned: false
  }
];

const dailyMetrics: DailyMetric[] = [
  { date: "5/29", exposure: 58, visitors: 8, consults: 1, orders: 0, revenue: 0 },
  { date: "5/30", exposure: 84, visitors: 12, consults: 2, orders: 0, revenue: 0 },
  { date: "5/31", exposure: 126, visitors: 21, consults: 3, orders: 1, revenue: 18.8 },
  { date: "6/1", exposure: 152, visitors: 28, consults: 4, orders: 1, revenue: 18.8 },
  { date: "6/2", exposure: 181, visitors: 33, consults: 5, orders: 2, revenue: 37.6 },
  { date: "6/3", exposure: 216, visitors: 41, consults: 7, orders: 2, revenue: 56.4 },
  { date: "6/4", exposure: 248, visitors: 48, consults: 8, orders: 3, revenue: 75.2 }
];

const channelMetrics = [
  { name: "淘宝", exposure: 426, consults: 9, orders: 3, color: "bg-blue-500" },
  { name: "闲鱼", exposure: 391, consults: 14, orders: 4, color: "bg-emerald-500" },
  { name: "小红书", exposure: 248, consults: 7, orders: 2, color: "bg-rose-500" }
];

const productSignals = [
  { name: "PPT教学能力大赛模板包", score: 86, revenue: 169.2, trend: "+24%", status: "重点推" },
  { name: "美甲图片参考素材包", score: 72, revenue: 89.1, trend: "+11%", status: "继续测" },
  { name: "7天起号全流程资料", score: 48, revenue: 0, trend: "-6%", status: "先观察" }
];

const sop = [
  ["1 大课介绍", "理解项目结构，按找词、选品、上架、检测、发货推进"],
  ["2 店铺开通", "先开通基础店铺，闲管家后面再看"],
  ["3 怎么理解虚拟类目", "理解虚拟产品和交付形式"],
  ["4 淘宝店铺基础开通", "完成淘宝基础后台设置"],
  ["5 选品说明和准备", "选品方法包括淘宝选品、闲鱼选品、小红书反向选品、找热点"],
  ["6 选品基础-找词", "整理自己的虚拟词库：功能词、店铺裂变词、主题参谋词"],
  ["7 筛出优质词等于优质品", "看付款人数、评价、价格"],
  ["8 小红书反向选品", "看主题图、价格、评论、是否能做出产品"],
  ["9 找热点", "用热点找可上架的虚拟资料方向"],
  ["10 红薯速刷轻度标签", "用小红书刷出轻度标签"],
  ["11 AI主图和AI标题", "用 AI 生成标题和主图思路"],
  ["12 淘宝快速上架", "在千牛/淘宝后台快速上架"],
  ["13 闲鱼上架", "同步闲鱼上架"],
  ["14 违规检测", "淘宝商品检测提交、日常维护、清理商品"],
  ["15 货源整理和发货问题", "找上家货源，整理资源，处理手动发货"]
];

const nav = [
  ["overview", "总览", Home],
  ["sop", "视频精华/SOP", BookOpen],
  ["keywords", "关键词库", Search],
  ["screen", "筛词工作台", Tags],
  ["products", "商品库", Store],
  ["listing", "上架记录", ClipboardList],
  ["tasks", "每日任务", CheckCircle2],
  ["review", "数据复盘", BarChart3]
] as const;

function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (raw) setValue(JSON.parse(raw));
  }, [key]);

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" | "blue" }) {
  const tones = {
    gray: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200"
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

function Panel({ title, icon: Icon, children, action }: { title: string; icon: typeof Home; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<(typeof nav)[number][0]>("overview");
  const [keywords, setKeywords] = useLocalState("vp_keywords", initialKeywords);
  const [products] = useLocalState("vp_products", initialProducts);
  const [tasks, setTasks] = useLocalState("vp_tasks", initialTasks);
  const [listings, setListings] = useLocalState("vp_listings", initialListings);
  const [newWord, setNewWord] = useState("");

  const dashboard = useMemo(() => {
    const doneTasks = tasks.filter((item) => item.done).length;
    const keptKeywords = keywords.filter((item) => item.keep).length;
    const listedCount = listings.filter((item) => item.taobao || item.xianyu).length;
    const checkedCount = listings.filter((item) => item.checked).length;
    const latest = dailyMetrics[dailyMetrics.length - 1];
    const previous = dailyMetrics[dailyMetrics.length - 2];
    const exposureGrowth = Math.round(((latest.exposure - previous.exposure) / previous.exposure) * 100);
    const revenue = dailyMetrics.reduce((sum, item) => sum + item.revenue, 0);
    const conversion = latest.visitors ? Math.round((latest.orders / latest.visitors) * 1000) / 10 : 0;

    return {
      doneTasks,
      keptKeywords,
      listedCount,
      checkedCount,
      latest,
      exposureGrowth,
      revenue,
      conversion,
      taskRate: tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0,
      listingRate: products.length ? Math.round((listedCount / products.length) * 100) : 0
    };
  }, [keywords, products.length, listings, tasks]);

  const stats = useMemo<[string, string | number, string, LucideIcon, "blue" | "green" | "amber" | "gray"][]>(() => [
    ["今日曝光", dashboard.latest.exposure, `${dashboard.exposureGrowth >= 0 ? "+" : ""}${dashboard.exposureGrowth}% 较昨日`, Activity, "blue"],
    ["访问转化", `${dashboard.conversion}%`, "访客到成交", TrendingUp, "green"],
    ["预估成交额", `¥${dashboard.revenue.toFixed(1)}`, "7 天累计", WalletCards, "amber"],
    ["任务完成", `${dashboard.doneTasks}/${tasks.length}`, `${dashboard.taskRate}% 进度`, CheckCircle2, "gray"]
  ], [dashboard, tasks.length]);

  const addKeyword = () => {
    if (!newWord.trim()) return;
    setKeywords([
      {
        id: Date.now(),
        word: newWord.trim(),
        source: "手动",
        direction: "待分类",
        price: "-",
        payCount: 0,
        reviews: 0,
        keep: false,
        note: ""
      },
      ...keywords
    ]);
    setNewWord("");
  };

  return (
    <main className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-60 border-r border-line bg-white">
        <div className="border-b border-line px-4 py-4">
          <div className="text-sm font-semibold">虚拟项目运营工作台</div>
          <div className="mt-1 text-xs text-slate-500">淘宝 / 闲鱼执行系统</div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                tab === id ? "bg-ink text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="ml-60 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">薅流虚拟项目执行台</h1>
            <p className="text-xs text-slate-500">按视频流程：找词 → 筛词 → 上架 → 检测 → 发货</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="blue">{new Date().toLocaleDateString("zh-CN")}</Badge>
            <button className="rounded-md border border-line bg-white px-3 py-2 text-sm hover:bg-slate-50">
              <Settings2 className="inline h-4 w-4" /> 设置
            </button>
          </div>
        </header>

        <div className="space-y-5 p-6">
          {tab === "overview" && (
            <>
              <section className="rounded-lg border border-line bg-ink p-5 text-white shadow-panel">
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      今日运营指挥中心
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">虚拟项目数据看板</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      把找词、筛词、上架、检测和成交数据放在一个页面，先看趋势，再决定今天要推哪个品、砍哪个词。
                    </p>
                    <div className="mt-5 grid grid-cols-4 gap-3">
                      {stats.map(([label, value, hint, Icon, tone]) => (
                        <MetricCard key={label} label={label} value={value} hint={hint} icon={Icon} tone={tone} dark />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/6 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">本周执行健康度</span>
                      <Badge tone="green">可推进</Badge>
                    </div>
                    <ProgressRing value={dashboard.taskRate} label="任务完成率" />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div className="rounded-md bg-white/6 p-3">
                        <div>保留词</div>
                        <strong className="mt-1 block text-lg text-white">{dashboard.keptKeywords}</strong>
                      </div>
                      <div className="rounded-md bg-white/6 p-3">
                        <div>已上架</div>
                        <strong className="mt-1 block text-lg text-white">{dashboard.listedCount}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="关键词池" value={keywords.length} hint={`${dashboard.keptKeywords} 个已保留`} icon={Database} tone="blue" />
                <MetricCard label="商品数" value={products.length} hint={`${dashboard.listingRate}% 已进入上架`} icon={Store} tone="green" />
                <MetricCard label="检测提交" value={dashboard.checkedCount} hint="降低违规风险" icon={ShieldAlert} tone="amber" />
                <MetricCard label="SOP进度" value="5/15" hint="先跑完基础闭环" icon={Rocket} tone="gray" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                <Panel title="7 天趋势" icon={LineChart} action={<Badge tone="blue">曝光 / 访客 / 成交额</Badge>}>
                  <TrendBoard data={dailyMetrics} />
                </Panel>
                <Panel title="转化漏斗" icon={BarChart3}>
                  <FunnelBoard latest={dashboard.latest} />
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <Panel title="渠道表现" icon={Activity}>
                  <ChannelBoard />
                </Panel>
                <Panel title="商品信号榜" icon={TrendingUp}>
                  <ProductSignalBoard />
                </Panel>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Panel title="今日执行" icon={CheckCircle2} action={<Badge tone={dashboard.taskRate >= 60 ? "green" : "amber"}>{dashboard.taskRate}%</Badge>}>
                  <TaskList tasks={tasks} setTasks={setTasks} compact />
                </Panel>
                <Panel title="运营提醒" icon={FileText}>
                  <div className="grid gap-2 text-sm">
                    {[
                      ["先推", "PPT模板包有成交信号，今天优先补标题和主图"],
                      ["补数", "关键词池偏少，继续补到 20 个再筛"],
                      ["风控", "上架后记得提交商品检测，避免违规"],
                      ["复盘", "每天记录曝光、咨询、成交，三天无咨询就换方向"]
                    ].map(([label, item]) => (
                      <div key={item} className="grid grid-cols-[52px_1fr] items-center gap-3 rounded-md border border-line px-3 py-2">
                        <Badge tone={label === "风控" ? "amber" : "blue"}>{label}</Badge>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          )}

          {tab === "sop" && (
            <Panel title="15 节视频精华/SOP" icon={BookOpen}>
              <div className="grid gap-2">
                {sop.map(([title, body], index) => (
                  <div key={title} className="grid grid-cols-[42px_220px_1fr_96px] items-center gap-3 rounded-md border border-line px-3 py-2 text-sm">
                    <Badge>{index + 1}</Badge>
                    <strong>{title}</strong>
                    <span className="text-slate-600">{body}</span>
                    <Badge tone={index < 5 ? "green" : "amber"}>{index < 5 ? "先做" : "待做"}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === "keywords" && (
            <Panel title="关键词库" icon={Search}>
              <div className="mb-3 flex gap-2">
                <input value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="输入新关键词" className="w-80 rounded-md border border-line px-3 py-2 text-sm" />
                <button onClick={addKeyword} className="rounded-md bg-ink px-3 py-2 text-sm text-white"><Plus className="inline h-4 w-4" /> 新增</button>
              </div>
              <KeywordTable keywords={keywords} setKeywords={setKeywords} />
            </Panel>
          )}

          {tab === "screen" && (
            <Panel title="筛词工作台" icon={Tags}>
              <div className="grid gap-3">
                {keywords.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_120px_120px_120px_120px] items-center gap-2 rounded-lg border border-line bg-white p-3 text-sm">
                    <div>
                      <div className="font-semibold">{item.word}</div>
                      <div className="text-xs text-slate-500">{item.source} / {item.direction}</div>
                    </div>
                    <Badge tone={item.payCount > 30 ? "green" : "amber"}>付款 {item.payCount}</Badge>
                    <Badge>评价 {item.reviews}</Badge>
                    <Badge>{item.price}</Badge>
                    <button onClick={() => setKeywords(keywords.map((kw) => kw.id === item.id ? { ...kw, keep: !kw.keep } : kw))} className="rounded-md border border-line px-3 py-2 hover:bg-slate-50">
                      {item.keep ? "保留" : "待定"}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === "products" && (
            <Panel title="商品库" icon={Store}>
              <DataTable headers={["产品名称", "关键词", "平台", "标题", "价格", "主图", "详情", "交付", "状态"]}>
                {products.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.keyword}</td>
                    <td>{item.platform}</td>
                    <td className="max-w-[360px] truncate">{item.title}</td>
                    <td>{item.price}</td>
                    <td>{item.cover}</td>
                    <td>{item.detail}</td>
                    <td>{item.delivery}</td>
                    <td><Badge tone="blue">{item.status}</Badge></td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
          )}

          {tab === "listing" && (
            <Panel title="上架记录" icon={ClipboardList}>
              <DataTable headers={["商品", "淘宝上架", "闲鱼上架", "商品检测提交", "日常维护", "清理商品"]}>
                {listings.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product}</td>
                    {(["taobao", "xianyu", "checked", "maintained", "cleaned"] as const).map((field) => (
                      <td key={field}>
                        <input
                          type="checkbox"
                          checked={item[field]}
                          onChange={() => setListings(listings.map((row) => row.id === item.id ? { ...row, [field]: !row[field] } : row))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </DataTable>
            </Panel>
          )}

          {tab === "tasks" && (
            <Panel title="每日任务" icon={CheckCircle2}>
              <TaskList tasks={tasks} setTasks={setTasks} />
            </Panel>
          )}

          {tab === "review" && (
            <Panel title="数据复盘" icon={BarChart3}>
              <DataTable headers={["日期", "曝光", "访客", "咨询", "成交", "保留/淘汰"]}>
                {[
                  ["今天", "待填", "待填", "待填", "待填", "待判断"],
                  ["昨天", "128", "21", "3", "1", "保留"],
                  ["前天", "42", "6", "0", "0", "淘汰"]
                ].map((row) => (
                  <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                ))}
              </DataTable>
            </Panel>
          )}
        </div>
      </section>
    </main>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-md border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>{headers.map((item) => <th key={item} className="whitespace-nowrap px-3 py-2 font-medium">{item}</th>)}</tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2">{children}</tbody>
      </table>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  dark = false
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "gray";
  dark?: boolean;
}) {
  const toneClass = {
    blue: dark ? "bg-blue-400/15 text-blue-200" : "bg-blue-50 text-blue-700",
    green: dark ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-50 text-emerald-700",
    amber: dark ? "bg-amber-400/15 text-amber-200" : "bg-amber-50 text-amber-700",
    gray: dark ? "bg-slate-400/15 text-slate-200" : "bg-slate-100 text-slate-700"
  };

  return (
    <div className={`${dark ? "border-white/10 bg-white/6" : "border-line bg-white"} rounded-lg border p-4 shadow-panel`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${dark ? "text-slate-300" : "text-slate-500"}`}>{label}</span>
        <span className={`rounded-md p-1.5 ${toneClass[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-3 text-2xl font-semibold ${dark ? "text-white" : "text-ink"}`}>{String(value)}</div>
      <div className={`mt-1 text-xs ${dark ? "text-slate-300" : "text-slate-500"}`}>{hint}</div>
    </div>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const degrees = Math.max(0, Math.min(100, value)) * 3.6;
  return (
    <div className="mt-5 flex items-center gap-4">
      <div
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(#34d399 ${degrees}deg, rgba(255,255,255,0.12) 0deg)` }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-ink text-center">
          <div>
            <div className="text-2xl font-semibold">{value}%</div>
            <div className="text-[11px] text-slate-400">{label}</div>
          </div>
        </div>
      </div>
      <div className="text-sm leading-6 text-slate-300">
        <div>今日目标：先完成一个可卖闭环。</div>
        <div>判断标准：有词、有图、有上架、有检测。</div>
      </div>
    </div>
  );
}

function TrendBoard({ data }: { data: DailyMetric[] }) {
  const maxExposure = Math.max(...data.map((item) => item.exposure));
  const maxRevenue = Math.max(...data.map((item) => item.revenue));

  return (
    <div className="space-y-4">
      <div className="grid h-56 grid-cols-7 items-end gap-3 rounded-lg bg-slate-50 p-4">
        {data.map((item) => (
          <div key={item.date} className="flex h-full flex-col justify-end gap-2">
            <div className="flex flex-1 items-end gap-1">
              <div
                className="w-full rounded-t bg-blue-500"
                title={`曝光 ${item.exposure}`}
                style={{ height: `${Math.max(12, (item.exposure / maxExposure) * 100)}%` }}
              />
              <div
                className="w-full rounded-t bg-emerald-500"
                title={`成交额 ${item.revenue}`}
                style={{ height: `${Math.max(8, maxRevenue ? (item.revenue / maxRevenue) * 100 : 8)}%` }}
              />
            </div>
            <div className="text-center text-xs text-slate-500">{item.date}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-blue-500" />曝光</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500" />成交额</span>
        <span>趋势用于判断方向是否继续加码，不是财务报表。</span>
      </div>
    </div>
  );
}

function FunnelBoard({ latest }: { latest: DailyMetric }) {
  const rows = [
    ["曝光", latest.exposure, "bg-blue-500"],
    ["访客", latest.visitors, "bg-cyan-500"],
    ["咨询", latest.consults, "bg-amber-500"],
    ["成交", latest.orders, "bg-emerald-500"]
  ] as const;
  const max = latest.exposure || 1;

  return (
    <div className="space-y-3">
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
          <div className="h-8 rounded-md bg-slate-100 p-1">
            <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        咨询到成交偏低时，优先优化标题、价格和首图承诺。
      </div>
    </div>
  );
}

function ChannelBoard() {
  const max = Math.max(...channelMetrics.map((item) => item.exposure));

  return (
    <div className="space-y-4">
      {channelMetrics.map((item) => (
        <div key={item.name} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.name}</span>
            <span className="text-slate-500">{item.consults} 咨询 / {item.orders} 成交</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.exposure / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductSignalBoard() {
  return (
    <div className="grid gap-3">
      {productSignals.map((item, index) => (
        <div key={item.name} className="grid grid-cols-[36px_1fr_92px_76px_76px] items-center gap-3 rounded-md border border-line px-3 py-3 text-sm">
          <Badge tone={index === 0 ? "green" : index === 1 ? "blue" : "amber"}>{index + 1}</Badge>
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-ink" style={{ width: `${item.score}%` }} />
            </div>
          </div>
          <div className="text-right font-semibold">¥{item.revenue.toFixed(1)}</div>
          <Badge tone={item.trend.startsWith("+") ? "green" : "amber"}>{item.trend}</Badge>
          <Badge tone={index === 0 ? "green" : "gray"}>{item.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function KeywordTable({ keywords, setKeywords }: { keywords: Keyword[]; setKeywords: (value: Keyword[]) => void }) {
  return (
    <DataTable headers={["关键词", "来源", "方向", "价格", "付款/想要", "评价", "是否保留", "备注"]}>
      {keywords.map((item) => (
        <tr key={item.id}>
          <td className="font-medium">{item.word}</td>
          <td>{item.source}</td>
          <td>{item.direction}</td>
          <td>{item.price}</td>
          <td>{item.payCount}</td>
          <td>{item.reviews}</td>
          <td>
            <button onClick={() => setKeywords(keywords.map((kw) => kw.id === item.id ? { ...kw, keep: !kw.keep } : kw))}>
              <Badge tone={item.keep ? "green" : "gray"}>{item.keep ? "保留" : "待定"}</Badge>
            </button>
          </td>
          <td>{item.note}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function TaskList({ tasks, setTasks, compact = false }: { tasks: Task[]; setTasks: (value: Task[]) => void; compact?: boolean }) {
  return (
    <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
      {tasks.map((item) => (
        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-slate-50">
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => setTasks(tasks.map((task) => task.id === item.id ? { ...task, done: !task.done } : task))}
          />
          <span className={item.done ? "text-slate-400 line-through" : ""}>{item.text}</span>
        </label>
      ))}
    </div>
  );
}

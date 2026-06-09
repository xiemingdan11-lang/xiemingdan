"use client";

import {
  ArrowDownToLine,
  CheckCircle2,
  Clipboard,
  Download,
  FileSpreadsheet,
  ImageUp,
  Link as LinkIcon,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";

type ProductStatus = "pending" | "prompted" | "uploaded" | "ready";

type ProductItem = {
  id: string;
  sourceTitle: string;
  newTitle: string;
  imageUrl: string;
  productUrl: string;
  price: string;
  shop: string;
  sales: string;
  note: string;
  resultImageUrl: string;
  detailImageUrl: string;
  optimizedTitles: string[];
  titleKeywords: string[];
  status: ProductStatus;
  createdAt: string;
};

const STATE_KEY = "xmd_product_factory_items";

const FIELD_HINTS = {
  title: ["title", "标题", "商品标题", "宝贝标题", "名称", "商品名称"],
  image: ["image", "img", "主图", "图片", "商品主图", "主图链接", "图片链接", "pic"],
  url: ["url", "link", "链接", "商品链接", "宝贝链接", "详情链接", "href"],
  price: ["price", "价格", "售价", "现价"],
  shop: ["shop", "店铺", "店铺名", "卖家", "掌柜"],
  sales: ["sales", "销量", "付款人数", "成交", "售出"]
};

const demoItems: ProductItem[] = [
  {
    id: "demo-1",
    sourceTitle: "PPT教学能力大赛模板说课课件教学设计资料包",
    newTitle: "教学能力大赛PPT模板说课稿教案答辩资料电子版",
    imageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=900&auto=format&fit=crop",
    productUrl: "https://item.taobao.com/item.htm?id=demo",
    price: "19.9",
    shop: "示例店铺",
    sales: "126",
    note: "先用这条熟悉流程，正式导入后可删除。",
    resultImageUrl: "",
    detailImageUrl: "",
    optimizedTitles: [],
    titleKeywords: [],
    status: "pending",
    createdAt: new Date().toISOString()
  }
];

function useServerState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/state", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((store: Record<string, T>) => {
        if (store[key] !== undefined) setValue(store[key]);
      })
      .catch(() => {
        const raw = window.localStorage.getItem(key);
        if (raw) setValue(JSON.parse(raw));
      })
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(key, JSON.stringify(value));
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    }).catch(() => undefined);
  }, [key, loaded, value]);

  return [value, setValue, loaded] as const;
}

export default function HomePage() {
  const [items, setItems, loaded] = useServerState<ProductItem[]>(STATE_KEY, demoItems);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeId && items[0]) setActiveId(items[0].id);
  }, [activeId, items]);

  const active = items.find((item) => item.id === activeId) ?? items[0];
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => [item.sourceTitle, item.newTitle, item.shop, item.note].join(" ").toLowerCase().includes(keyword));
  }, [items, query]);

  const stats = useMemo(() => {
    const uploaded = items.filter((item) => item.resultImageUrl || item.detailImageUrl).length;
    const ready = items.filter((item) => item.newTitle && item.resultImageUrl).length;
    return { total: items.length, uploaded, ready, pending: Math.max(items.length - ready, 0) };
  }, [items]);

  const patchItem = (id: string, patch: Partial<ProductItem>) => {
    setItems(items.map((item) => (item.id === id ? normalizeStatus({ ...item, ...patch }) : item)));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const rows = await parseSheet(file);
      const imported = rows.map(rowToProduct).filter((item) => item.sourceTitle || item.imageUrl || item.productUrl);
      if (!imported.length) {
        showToast("没有识别到商品行");
        return;
      }
      setItems([...imported, ...items]);
      setActiveId(imported[0].id);
      showToast(`已导入 ${imported.length} 个商品`);
    } catch {
      showToast("表格解析失败，请换 CSV / XLSX 再试");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    showToast(message);
    if (active) patchItem(active.id, { status: "prompted" });
  };

  const optimizeTitles = async (targetItems: ProductItem[]) => {
    const candidates = targetItems.filter((item) => item.sourceTitle.trim());
    if (!candidates.length) {
      showToast("没有可优化的标题");
      return;
    }

    setOptimizing(true);
    try {
      const res = await fetch("/api/title-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: candidates.map((item) => ({
            id: item.id,
            sourceTitle: item.sourceTitle,
            price: item.price,
            shop: item.shop,
            note: item.note
          }))
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "标题优化失败");
        return;
      }

      const resultMap = new Map<string, { recommended: string; titles: string[]; keywords: string[] }>(
        data.items.map((item: { id: string; recommended: string; titles: string[]; keywords: string[] }) => [item.id, item])
      );
      setItems(items.map((item) => {
        const result = resultMap.get(item.id);
        if (!result) return item;
        return normalizeStatus({
          ...item,
          newTitle: result.recommended || item.newTitle,
          optimizedTitles: result.titles || [],
          titleKeywords: result.keywords || []
        });
      }));
      showToast(`已优化 ${resultMap.size} 个标题`);
    } catch {
      showToast("标题优化接口连接失败");
    } finally {
      setOptimizing(false);
    }
  };

  const uploadResult = async (id: string, file: File, field: "resultImageUrl" | "detailImageUrl") => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || !data.url) {
      showToast("图片上传失败");
      return;
    }
    patchItem(id, { [field]: data.url, status: "uploaded" });
    showToast("成品图已保存");
  };

  const removeItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    if (activeId === id) setActiveId(next[0]?.id ?? "");
  };

  const addBlank = () => {
    const item = rowToProduct({ 标题: "新商品", 价格: "", 链接: "", 主图: "" });
    setItems([item, ...items]);
    setActiveId(item.id);
  };

  const exportCsv = () => {
    const rows = items.map((item, index) => ({
      编号: String(index + 1).padStart(3, "0"),
      原标题: item.sourceTitle,
      新标题: item.newTitle,
      原链接: item.productUrl,
      价格: item.price,
      店铺: item.shop,
      销量: item.sales,
      新主图: absoluteUrl(item.resultImageUrl),
      新详情图: absoluteUrl(item.detailImageUrl),
      备注: item.note
    }));
    downloadBlob(toCsv(rows), "上架资料.csv", "text/csv;charset=utf-8");
  };

  const exportZip = async () => {
    const zip = new JSZip();
    zip.file("上架资料.csv", toCsv(items.map((item, index) => ({
      编号: String(index + 1).padStart(3, "0"),
      原标题: item.sourceTitle,
      新标题: item.newTitle,
      原链接: item.productUrl,
      价格: item.price,
      新主图: item.resultImageUrl,
      新详情图: item.detailImageUrl
    }))));

    for (const [index, item] of items.entries()) {
      const folder = zip.folder(`${String(index + 1).padStart(3, "0")}-${safeFilePart(item.newTitle || item.sourceTitle)}`);
      folder?.file("GPT操作话术.txt", buildImageInstruction(item));
      folder?.file("详情页话术.txt", buildDetailInstruction(item));
      await addImageToZip(folder, item.resultImageUrl, "新主图");
      await addImageToZip(folder, item.detailImageUrl, "新详情图");
    }

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "上架素材包.zip", "application/zip");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-[#f6f8fb]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(71,118,255,0.22),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(18,196,159,0.12),transparent_30%),linear-gradient(180deg,#07090d,#0a0d13_48%,#07090d)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />
      <div className="relative border-b border-white/[0.08] bg-[#090c12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1580px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.08] text-[#8fb3ff] shadow-[0_0_36px_rgba(71,118,255,0.22)]">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8fb3ff]">AI Product Factory</div>
              <h1 className="text-lg font-semibold">批量仿品加工台</h1>
              <p className="text-xs text-[#8b95a7]">导入竞品表格，逐个喂给 GPT，回收成品图并导出上架包</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])}
            />
            <IconButton icon={Upload} label={importing ? "导入中" : "导入表格"} onClick={() => fileRef.current?.click()} primary />
            <IconButton icon={Plus} label="手动新增" onClick={addBlank} />
            <IconButton icon={RefreshCw} label={optimizing ? "优化中" : "批量优化标题"} onClick={() => optimizeTitles(items)} />
            <IconButton icon={Download} label="导出CSV" onClick={exportCsv} />
            <IconButton icon={ArrowDownToLine} label="导出ZIP" onClick={exportZip} />
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1580px] grid-cols-[340px_minmax(0,1fr)_380px] gap-4 px-5 py-4">
        <aside className="min-h-[calc(100vh-104px)] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.055] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-white/[0.08] p-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <Metric label="总数" value={stats.total} />
              <Metric label="待做" value={stats.pending} />
              <Metric label="有图" value={stats.uploaded} />
              <Metric label="可导" value={stats.ready} />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">
              <Search className="h-4 w-4 text-[#8b95a7]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题 / 店铺 / 备注" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#687386]" />
            </div>
          </div>
          <div className="max-h-[calc(100vh-230px)] overflow-auto">
            {filtered.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={`flex w-full gap-3 border-b border-white/[0.06] p-3 text-left transition hover:bg-white/[0.075] ${item.id === active?.id ? "bg-[#4776ff]/15 ring-1 ring-inset ring-[#4776ff]/30" : ""}`}
              >
                <Thumb src={item.resultImageUrl || item.imageUrl} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#8fb3ff]">#{String(index + 1).padStart(3, "0")}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="line-clamp-2 text-sm font-medium text-[#f6f8fb]">{item.newTitle || item.sourceTitle || "未命名商品"}</div>
                  <div className="mt-1 truncate text-xs text-[#8b95a7]">{item.price ? `¥${item.price}` : "未填价格"} {item.sales ? ` · ${item.sales}` : ""}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-[calc(100vh-104px)] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.055] shadow-2xl shadow-black/30 backdrop-blur-xl">
          {active ? (
            <ProductWorkspace
              item={active}
              onPatch={(patch) => patchItem(active.id, patch)}
              onCopy={copyText}
              onOptimize={() => optimizeTitles([active])}
              optimizing={optimizing}
              onUpload={uploadResult}
              onRemove={() => removeItem(active.id)}
            />
          ) : (
            <div className="grid h-full place-items-center text-[#8b95a7]">先导入表格或新增商品</div>
          )}
        </section>

        <aside className="min-h-[calc(100vh-104px)] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.055] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-white/[0.08] p-4">
            <div className="flex items-center gap-2 font-semibold">
              <Clipboard className="h-4 w-4 text-[#8fb3ff]" />
              GPT 操作话术
            </div>
            <p className="mt-1 text-xs text-[#8b95a7]">不用写提示词，点复制后把原图和这段话一起发给 GPT。</p>
          </div>
          {active && (
            <div className="space-y-4 p-4">
              <PromptBox title="主图处理" text={buildImageInstruction(active)} onCopy={() => copyText(buildImageInstruction(active), "主图话术已复制")} />
              <PromptBox title="详情页处理" text={buildDetailInstruction(active)} onCopy={() => copyText(buildDetailInstruction(active), "详情页话术已复制")} />
              <PromptBox title="标题处理" text={buildTitleInstruction(active)} onCopy={() => copyText(buildTitleInstruction(active), "标题话术已复制")} />
            </div>
          )}
        </aside>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-white/10 bg-[#101722] px-4 py-2 text-sm text-white shadow-2xl shadow-black/40">{toast}</div>}
      {!loaded && <div className="fixed inset-x-0 top-0 h-1 animate-pulse bg-[#8fb3ff]" />}
    </main>
  );
}

function ProductWorkspace({
  item,
  onPatch,
  onCopy,
  onOptimize,
  optimizing,
  onUpload,
  onRemove
}: {
  item: ProductItem;
  onPatch: (patch: Partial<ProductItem>) => void;
  onCopy: (text: string, message: string) => void;
  onOptimize: () => void;
  optimizing: boolean;
  onUpload: (id: string, file: File, field: "resultImageUrl" | "detailImageUrl") => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.025] p-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-[#8b95a7]">{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <h2 className="mt-2 max-w-3xl text-lg font-semibold text-white">{item.newTitle || item.sourceTitle}</h2>
        </div>
        <div className="flex gap-2">
          {item.productUrl && <IconButton icon={LinkIcon} label="打开原链接" onClick={() => window.open(item.productUrl, "_blank")} />}
          <IconButton icon={RefreshCw} label={optimizing ? "优化中" : "优化标题"} onClick={onOptimize} />
          <IconButton icon={Clipboard} label="复制主图话术" onClick={() => onCopy(buildImageInstruction(item), "主图话术已复制")} primary />
          <IconButton icon={Trash2} label="删除" onClick={onRemove} danger />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4 overflow-auto p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ImagePanel title="原始主图" src={item.imageUrl} empty="表格里没有识别到主图链接" />
            <ImagePanel title="GPT 成品主图" src={item.resultImageUrl} empty="把 GPT 下载的成品图拖到右侧上传" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <UploadPanel label="上传成品主图" onFile={(file) => onUpload(item.id, file, "resultImageUrl")} />
            <UploadPanel label="上传详情页图" onFile={(file) => onUpload(item.id, file, "detailImageUrl")} />
          </div>
          <ImagePanel title="GPT 成品详情页" src={item.detailImageUrl} empty="可选：详情页处理完后上传到这里" wide />
        </div>

        <div className="space-y-3">
          <Field label="原标题" value={item.sourceTitle} onChange={(value) => onPatch({ sourceTitle: value })} textarea />
          <Field label="新标题" value={item.newTitle} onChange={(value) => onPatch({ newTitle: value })} textarea />
          {!!item.optimizedTitles?.length && (
            <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#8b95a7]">
                <CheckCircle2 className="h-4 w-4 text-[#8fb3ff]" />
                DeepSeek 备选标题
              </div>
              <div className="space-y-2">
                {item.optimizedTitles.map((title) => (
                  <button
                    key={title}
                    onClick={() => onPatch({ newTitle: title })}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm text-[#dce5f2] transition hover:border-[#8fb3ff]/45 hover:bg-white/[0.08] ${title === item.newTitle ? "border-[#8fb3ff]/55 bg-[#4776ff]/15" : "border-white/[0.08] bg-white/[0.03]"}`}
                  >
                    {title}
                  </button>
                ))}
              </div>
              {!!item.titleKeywords?.length && <div className="mt-2 text-xs text-[#8b95a7]">词根：{item.titleKeywords.join(" / ")}</div>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="价格" value={item.price} onChange={(value) => onPatch({ price: value })} />
            <Field label="销量" value={item.sales} onChange={(value) => onPatch({ sales: value })} />
          </div>
          <Field label="店铺" value={item.shop} onChange={(value) => onPatch({ shop: value })} />
          <Field label="商品链接" value={item.productUrl} onChange={(value) => onPatch({ productUrl: value })} />
          <Field label="主图链接" value={item.imageUrl} onChange={(value) => onPatch({ imageUrl: value })} />
          <Field label="备注" value={item.note} onChange={(value) => onPatch({ note: value })} textarea />
        </div>
      </div>
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick, primary, danger }: { icon: typeof Upload; label: string; onClick?: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
        primary
          ? "border-[#8fb3ff]/50 bg-[#4776ff] text-white shadow-[0_0_28px_rgba(71,118,255,0.28)] hover:bg-[#5d87ff]"
          : danger
            ? "border-[#ff6f8e]/30 bg-[#ff5c7a]/10 text-[#ff9ab0] hover:bg-[#ff5c7a]/18"
            : "border-white/[0.08] bg-white/[0.065] text-[#dce5f2] hover:border-[#8fb3ff]/35 hover:bg-white/[0.11]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/20 p-2">
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="text-[11px] text-[#8b95a7]">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const map = {
    pending: "待处理",
    prompted: "已复制",
    uploaded: "已传图",
    ready: "可导出"
  };
  return <span className="rounded-md border border-[#8fb3ff]/20 bg-[#4776ff]/12 px-2 py-0.5 text-xs font-medium text-[#9fbdff]">{map[status]}</span>;
}

function Thumb({ src }: { src: string }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/25">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><FileSpreadsheet className="h-5 w-5 text-[#687386]" /></div>}
    </div>
  );
}

function ImagePanel({ title, src, empty, wide }: { title: string; src: string; empty: string; wide?: boolean }) {
  return (
    <div className={`${wide ? "min-h-[320px]" : "aspect-square"} overflow-hidden rounded-xl border border-white/[0.08] bg-black/20`}>
      <div className="flex h-10 items-center justify-between border-b border-white/[0.08] bg-white/[0.035] px-3 text-sm font-medium text-[#edf3ff]">
        {title}
        {src && <a href={src} download className="text-xs text-[#8fb3ff]">下载</a>}
      </div>
      {src ? <img src={src} alt={title} className="h-[calc(100%-40px)] w-full object-contain" /> : <div className="grid h-[calc(100%-40px)] place-items-center px-6 text-center text-sm text-[#8b95a7]">{empty}</div>}
    </div>
  );
}

function UploadPanel({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.18] bg-white/[0.035] text-sm text-[#aeb8c9] transition hover:border-[#8fb3ff]/50 hover:bg-[#4776ff]/10 hover:text-[#dce7ff]">
      <ImageUp className="h-5 w-5" />
      {label}
      <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
    </label>
  );
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#8b95a7]">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-[#687386] focus:border-[#8fb3ff]/55" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-[#687386] focus:border-[#8fb3ff]/55" />
      )}
    </label>
  );
}

function PromptBox({ title, text, onCopy }: { title: string; text: string; onCopy: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.035] px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-[#edf3ff]"><Wand2 className="h-4 w-4 text-[#8fb3ff]" />{title}</div>
        <button onClick={onCopy} className="text-xs font-medium text-[#8fb3ff]">复制</button>
      </div>
      <div className="max-h-48 overflow-auto whitespace-pre-wrap p-3 text-sm leading-6 text-[#cbd5e4]">{text}</div>
    </div>
  );
}

async function parseSheet(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
}

function rowToProduct(row: Record<string, unknown>): ProductItem {
  const title = pickField(row, FIELD_HINTS.title);
  const imageUrl = pickField(row, FIELD_HINTS.image);
  const productUrl = pickField(row, FIELD_HINTS.url);
  return normalizeStatus({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceTitle: title,
    newTitle: rewriteTitle(title),
    imageUrl,
    productUrl,
    price: pickField(row, FIELD_HINTS.price),
    shop: pickField(row, FIELD_HINTS.shop),
    sales: pickField(row, FIELD_HINTS.sales),
    note: "",
    resultImageUrl: "",
    detailImageUrl: "",
    optimizedTitles: [],
    titleKeywords: [],
    status: "pending",
    createdAt: new Date().toISOString()
  });
}

function pickField(row: Record<string, unknown>, hints: string[]) {
  const keys = Object.keys(row);
  const found = keys.find((key) => hints.some((hint) => key.toLowerCase().includes(hint.toLowerCase())));
  return String(found ? row[found] ?? "" : "").trim();
}

function rewriteTitle(title: string) {
  return title
    .replace(/官方|旗舰店|正品|品牌|logo|LOGO/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function normalizeStatus(item: ProductItem): ProductItem {
  const status: ProductStatus = item.newTitle && item.resultImageUrl ? "ready" : item.resultImageUrl || item.detailImageUrl ? "uploaded" : item.status === "prompted" ? "prompted" : "pending";
  return {
    ...item,
    optimizedTitles: item.optimizedTitles ?? [],
    titleKeywords: item.titleKeywords ?? [],
    status
  };
}

function buildImageInstruction(_item: ProductItem) {
  return "帮我把这张图重新设计成淘宝虚拟商品主图。保留大概卖点，但换一种排版、背景、字体和配色，不要出现原图里的店铺名、logo、水印、品牌标识。画面比例做成 1:1，整体要像新的商品图，不要太像原图。";
}

function buildDetailInstruction(_item: ProductItem) {
  return "帮我参考这张详情页或商品图，重新做一版新的虚拟商品详情页长图。保留大概信息结构，但文案、排版、颜色、图标和版式都重新设计，不要出现原图里的店铺名、logo、水印、品牌标识。";
}

function buildTitleInstruction(_item: ProductItem) {
  return "帮我把这个淘宝/闲鱼商品标题重新优化一下，保留核心搜索词，调整词序，去掉品牌词、店铺词和侵权风险词，生成 5 个适合上架的标题。";
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => csvCell(row[header])).join(","));
  return `\uFEFF${headers.join(",")}\n${body.join("\n")}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function absoluteUrl(url: string) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  return `${window.location.origin}${url}`;
}

function safeFilePart(text: string) {
  return text.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "").slice(0, 28) || "商品";
}

async function addImageToZip(folder: JSZip | null, url: string, name: string) {
  if (!folder || !url) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png";
    folder.file(`${name}.${ext}`, blob);
  } catch {
    folder.file(`${name}-下载失败.txt`, url);
  }
}

"use client";
import { useState } from "react";
import { Link2, ArrowLeft, Loader2, AlertCircle, Download, Trash2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

const API_BASE = "";

type Item = {
  url: string; title: string; price: number; sales: number;
  img: string; desc: string; itemId: string; platform: string; status: string;
};

export default function ImportPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    const urls = text.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
    if (!urls.length) { setError("请输入有效链接，每行一条"); return; }
    if (urls.length > 20) { setError("最多20条链接"); return; }
    setLoading(true); setError(null); setItems([]);
    try {
      const res = await fetch(`${API_BASE}/api/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) throw new Error(`服务器返回 ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setError(msg.includes("fetch") ? "无法连接到解析服务器" : msg);
    } finally { setLoading(false); }
  }

  function exportCSV() {
    const rows = [["标题","价格","销量","平台","链接","状态"]];
    items.forEach(i => rows.push([i.title, String(i.price), String(i.sales), i.platform, i.url, i.status]));
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "选品数据.csv"; a.click();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm"><ArrowLeft size={16} /> 返回工作台</Link>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2"><Link2 size={18} className="text-orange-500" /><h1 className="font-semibold text-gray-900">批量链接解析</h1></div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-3">粘贴淘宝/闲鱼商品链接，每行一条，最多20条</p>
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder={"https://item.taobao.com/item.htm?id=123456\nhttps://www.goofish.com/item?id=789012\n..."}
            className="w-full h-40 px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={handleParse} disabled={loading || !text.trim()}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
              {loading ? <><Loader2 size={16} className="animate-spin" /> 解析中...</> : <><Link2 size={16} /> 开始解析</>}
            </button>
            {items.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
                <Download size={16} /> 导出CSV
              </button>
            )}
            {items.length > 0 && (
              <button onClick={() => { setItems([]); setText(""); }} className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm px-3 py-2.5">
                <Trash2 size={16} /> 清空
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><p>{error}</p>
          </div>
        )}
        {items.length > 0 && (
          <div className="mt-6">
            <h2 className="font-semibold text-gray-900 mb-4">解析结果 <span className="text-sm font-normal text-gray-500">共{items.length}条</span></h2>
            <div className="grid gap-3">
              {items.map((item, i) => (
                <div key={i} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${item.status === "ok" ? "border-gray-200 hover:border-orange-200" : "border-red-100 bg-red-50/30"}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                    {item.status === "ok" ? <CheckCircle2 size={20} className="text-green-500" /> : <XCircle size={20} className="text-red-400" />}
                  </div>
                  {item.img && item.status === "ok" && (
                    <img src={item.img} alt={item.title} className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-100"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    {item.status === "ok" ? (
                      <>
                        <p className="font-medium text-gray-900 text-sm line-clamp-1">{item.title || "未获取到标题"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                          {item.price > 0 && <span className="text-orange-600 font-bold text-base">¥{item.price}</span>}
                          {item.sales > 0 && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">已售{item.sales.toLocaleString()}</span>}
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.platform}</span>
                          {item.desc && <span className="text-gray-400 truncate max-w-xs">{item.desc}</span>}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-red-500">{item.url.slice(0, 60)}... — {item.status}</p>
                    )}
                  </div>
                  {item.status === "ok" && item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-xs text-orange-500 hover:underline">查看原链接</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
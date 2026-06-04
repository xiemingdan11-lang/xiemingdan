"use client";
import { useState } from "react";
import { Search, ExternalLink, ShoppingBag, TrendingUp, Filter, ArrowLeft, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
const API_BASE = "http://124.222.223.153:8000";
type Item = { title: string; price: number; sales: number; shop: string; img: string; link: string; itemId: string; };
type SearchResult = { keyword: string; min_price: number; max_price: number; total: number; items: Item[]; };
export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("100");
  const [pages, setPages] = useState("2");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function handleSearch() {
    if (!keyword.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const params = new URLSearchParams({ keyword: keyword.trim(), min_price: minPrice||"0", max_price: maxPrice||"9999", pages: pages||"2" });
      const res = await fetch(`${API_BASE}/api/search?${params}`);
      if (!res.ok) throw new Error("服务器返回 " + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setError(msg.includes("fetch") ? "无法连接到爬虫服务器" : msg);
    } finally { setLoading(false); }
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm"><ArrowLeft size={16} /> 返回工作台</Link>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2"><ShoppingBag size={18} className="text-orange-500" /><h1 className="font-semibold text-gray-900">淘宝选品搜索</h1></div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5"><Filter size={18} className="text-orange-500" /><h2 className="font-semibold text-gray-900">筛选条件</h2></div>
          <div className="grid gap-4 md:grid-cols-4">
            <div><label className="block text-xs text-gray-500 mb-1.5">搜索关键词</label>
              <input type="text" value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder="例如：设计素材" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" /></div>
            <div><label className="block text-xs text-gray-500 mb-1.5">最低价 (¥)</label>
              <input type="number" value={minPrice} onChange={e=>setMinPrice(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" /></div>
            <div><label className="block text-xs text-gray-500 mb-1.5">最高价 (¥)</label>
              <input type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" /></div>
            <div><label className="block text-xs text-gray-500 mb-1.5">抓取页数</label>
              <select value={pages} onChange={e=>setPages(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
                <option value="1">1页</option><option value="2">2页</option><option value="3">3页</option><option value="5">5页</option></select></div>
          </div>
          <button onClick={handleSearch} disabled={loading||!keyword.trim()} className="mt-5 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
            {loading ? <><Loader2 size={16} className="animate-spin" /> 爬取中...</> : <><Search size={16} /> 开始搜索</>}
          </button>
        </div>
        {error && <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /><p>{error}</p></div>}
        {result && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp size={18} className="text-orange-500" />搜索结果 <span className="text-sm font-normal text-gray-500">共{result.total}条</span></h2>
              <button onClick={handleSearch} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"><RefreshCw size={14} /> 刷新</button>
            </div>
            <div className="grid gap-3">{result.items.map((item,i)=>(
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:border-orange-200 hover:shadow-sm transition-all">
                <div className={"w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 "+(i===0?"bg-orange-500 text-white":i===1?"bg-orange-300 text-white":i===2?"bg-orange-200 text-orange-800":"bg-gray-100 text-gray-500")}>{i+1}</div>
                {item.img&&<img src={item.img} alt={item.title} className="w-14 h-14 rounded-xl object-cover shrink-0" onError={e=>{(e.target as HTMLImageElement).style.display="none"}} />}
                <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 text-sm line-clamp-2">{item.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs"><span className="text-orange-600 font-bold text-base">¥{item.price}</span>
                    {item.sales>0&&<span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">月销{item.sales.toLocaleString()}</span>}
                    {item.shop&&<span className="text-gray-500">{item.shop}</span>}</div></div>
                {item.link&&<a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold text-sm px-4 py-2 rounded-xl shrink-0">查看<ExternalLink size={14} /></a>}
              </div>))}</div>
          </div>)}
      </main>
    </div>
  );
}
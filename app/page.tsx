'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Flame,
  LayoutDashboard,
  Link as LinkIcon,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';

type ProductStatus = '考虑中' | '已选' | '已放弃';

interface Product {
  id: number;
  name: string;
  url: string;
  price: string;
  category: string;
  notes: string;
  status: ProductStatus;
  createdAt: string;
}

interface TrendItem {
  rank: number;
  title: string;
  hotValue: string;
  url: string;
}

interface TrendsData {
  [platform: string]: TrendItem[] | string | undefined;
  _updatedAt?: string;
}

const STORAGE_KEY = 'xuanpin_products';

function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

const statusStyles: Record<ProductStatus, string> = {
  考虑中: 'bg-[#eef4ff] text-[#3168d8]',
  已选: 'bg-[#e7f8ef] text-[#168044]',
  已放弃: 'bg-[#fff0ef] text-[#d92d20]',
};

const moduleCards = [
  { title: 'AI 选品库', desc: '记录商品灵感与价格状态', color: 'from-[#6ea8ff] to-[#9ad7ff]' },
  { title: '热点分析', desc: '从热榜提取可卖方向', color: 'from-[#9b8cff] to-[#f4b4ff]' },
  { title: 'AI 延伸', desc: '生成虚拟商品建议', color: 'from-[#69dbb8] to-[#b6f5d7]' },
];

export default function Home() {
  const [tab, setTab] = useState<'products' | 'trends'>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt'>>({
    name: '',
    url: '',
    price: '',
    category: '',
    notes: '',
    status: '考虑中',
  });

  const [trends, setTrends] = useState<TrendsData>({});
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsUpdatedAt, setTrendsUpdatedAt] = useState('');

  const [analyzeKeyword, setAnalyzeKeyword] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [toast, setToast] = useState<{ show: boolean; msg: string; type: string }>({ show: false, msg: '', type: '' });

  useEffect(() => {
    setProducts(loadProducts());
  }, []);

  const showToast = (msg: string, type = '') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3000);
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.notes.includes(search);
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchCategory = !filterCategory || p.category === filterCategory;
    return matchSearch && matchStatus && matchCategory;
  });

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const openAddModal = () => {
    setEditingId(null);
    setForm({ name: '', url: '', price: '', category: '', notes: '', status: '考虑中' });
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p.id);
    setForm({ name: p.name, url: p.url, price: p.price, category: p.category, notes: p.notes, status: p.status });
    setShowModal(true);
  };

  const saveProduct = () => {
    if (!form.name.trim()) {
      showToast('请填写商品名称', 'error');
      return;
    }

    let updated: Product[];
    if (editingId !== null) {
      updated = products.map(p => (p.id === editingId ? { ...p, ...form } : p));
      showToast('修改成功');
    } else {
      updated = [{ id: Date.now(), ...form, createdAt: new Date().toLocaleString('zh-CN') }, ...products];
      showToast('添加成功');
    }

    setProducts(updated);
    saveProducts(updated);
    setShowModal(false);
  };

  const deleteProduct = (id: number) => {
    if (!confirm('确定删除这条选品吗？')) return;
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    saveProducts(updated);
    showToast('已删除');
  };

  const quickStatus = (id: number, status: ProductStatus) => {
    const updated = products.map(p => (p.id === id ? { ...p, status } : p));
    setProducts(updated);
    saveProducts(updated);
  };

  const loadTrends = useCallback(async (forceRefresh = false) => {
    setTrendsLoading(true);
    try {
      const url = forceRefresh ? '/api/trends?refresh=1' : '/api/trends';
      const res = await fetch(url);
      const data = await res.json();
      setTrends(data);
      setTrendsUpdatedAt(data._updatedAt || '');
    } catch {
      showToast('热榜加载失败', 'error');
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  const handleTabTrends = () => {
    setTab('trends');
    if (Object.keys(trends).length === 0) loadTrends();
  };

  const doAnalyze = async (keyword?: string) => {
    const kw = keyword || analyzeKeyword;
    if (!kw.trim()) return;
    if (keyword) setAnalyzeKeyword(keyword);
    setTab('trends');
    setAnalyzing(true);
    setAnalyzeResult('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw }),
      });
      const data = await res.json();
      setAnalyzeResult(data.success ? data.analysis : `错误：${data.error}`);
    } catch {
      setAnalyzeResult('请求失败，请检查网络');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatHot = (val: string) => {
    const n = parseInt(val);
    if (isNaN(n) || !val) return val || '';
    return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : val;
  };

  const trendsEntries = Object.entries(trends).filter(
    (entry): entry is [string, TrendItem[]] => Array.isArray(entry[1])
  );

  const stats = [
    { label: '全部', value: products.length },
    { label: '考虑中', value: products.filter(p => p.status === '考虑中').length },
    { label: '已选', value: products.filter(p => p.status === '已选').length },
    { label: '放弃', value: products.filter(p => p.status === '已放弃').length },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_5%,#d8e7ff_0,#eaf3ff_28%,#f8fbff_62%,#edf5ff_100%)] text-[#172033]">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-0 top-0 h-[420px] w-[520px] rounded-full bg-[#9fc5ff]/45 blur-3xl" />
        <div className="absolute right-[-120px] top-24 h-[360px] w-[480px] rounded-full bg-[#c7b8ff]/35 blur-3xl" />
        <div className="absolute bottom-[-160px] left-1/3 h-[360px] w-[560px] rounded-full bg-[#b7f0ff]/45 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="mb-8">
          <div className="mb-4 inline-flex rounded-[8px] bg-[#dbe9ff] px-4 py-2 text-sm font-semibold text-[#3b79df] shadow-sm">
            设计分享
          </div>
          <h1 className="text-5xl font-black tracking-normal text-[#101828] sm:text-6xl">
            <span className="text-[#2f80ed]">AI界面</span>-WEB端
          </h1>
        </section>

        <section className="overflow-hidden rounded-[8px] border border-white/70 bg-white/78 shadow-[0_24px_80px_rgba(80,120,190,0.25)] backdrop-blur-xl">
          <div className="flex min-h-[720px]">
            <aside className="hidden w-52 border-r border-[#e8eef8] bg-white/72 p-4 lg:block">
              <div className="mb-8 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#4f8cff] to-[#8c6dff] text-white">
                  <Sparkles size={17} />
                </div>
                <span className="font-bold">AI选品助手</span>
              </div>

              <nav className="space-y-2 text-sm">
                <button
                  onClick={() => setTab('products')}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left font-medium transition ${
                    tab === 'products' ? 'bg-[#f0f5ff] text-[#2f6fe4]' : 'text-[#667085] hover:bg-[#f7f9fd]'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  首页
                </button>
                <button
                  onClick={handleTabTrends}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left font-medium transition ${
                    tab === 'trends' ? 'bg-[#f0f5ff] text-[#2f6fe4]' : 'text-[#667085] hover:bg-[#f7f9fd]'
                  }`}
                >
                  <Flame size={16} />
                  AI 热榜
                </button>
                <button
                  onClick={openAddModal}
                  className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left font-medium text-[#667085] transition hover:bg-[#f7f9fd]"
                >
                  <FileText size={16} />
                  选品记录
                </button>
                <button
                  onClick={() => doAnalyze()}
                  className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left font-medium text-[#667085] transition hover:bg-[#f7f9fd]"
                >
                  <Bot size={16} />
                  AI 分析
                </button>
              </nav>
            </aside>

            <div className="min-w-0 flex-1 bg-[#f8fbff]/80">
              <header className="flex h-14 items-center gap-3 border-b border-[#e8eef8] bg-white/62 px-4 sm:px-6">
                <button className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#667085] lg:hidden">
                  <Menu size={18} />
                </button>
                <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                  <button
                    onClick={() => setTab('products')}
                    className={`whitespace-nowrap rounded-[8px] px-3 py-1.5 text-xs font-semibold ${
                      tab === 'products' ? 'bg-[#eef4ff] text-[#2f6fe4]' : 'bg-white text-[#667085]'
                    }`}
                  >
                    AI 选品
                  </button>
                  <button
                    onClick={handleTabTrends}
                    className={`whitespace-nowrap rounded-[8px] px-3 py-1.5 text-xs font-semibold ${
                      tab === 'trends' ? 'bg-[#eef4ff] text-[#2f6fe4]' : 'bg-white text-[#667085]'
                    }`}
                  >
                    热点分析
                  </button>
                  <button onClick={openAddModal} className="whitespace-nowrap rounded-[8px] bg-white px-3 py-1.5 text-xs font-semibold text-[#667085]">
                    新建记录
                  </button>
                </div>
                <button
                  onClick={openAddModal}
                  className="flex h-9 items-center gap-2 rounded-[8px] bg-[#2f6fe4] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#245ed0]"
                >
                  <Plus size={15} />
                  添加
                </button>
              </header>

              <div className="p-4 sm:p-6">
                {tab === 'products' && (
                  <>
                    <div className="mb-6 rounded-[8px] border border-[#e5edfb] bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        {['AI 选品', '淘宝链接', '竞品备注', '更多'].map(item => (
                          <span key={item} className="rounded-[8px] bg-[#f6f8fc] px-3 py-1.5 text-xs font-semibold text-[#667085]">
                            {item}
                          </span>
                        ))}
                      </div>
                      <div className="flex min-h-[96px] flex-col justify-between rounded-[8px] border border-[#e6edf8] bg-[#fbfdff] p-4">
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="输入商品名、设计目标、竞品关键词，快速筛选选品记录"
                          className="w-full bg-transparent text-sm text-[#172033] outline-none placeholder:text-[#98a2b3]"
                        />
                        <div className="mt-5 flex items-center justify-end gap-2">
                          <Search size={17} className="text-[#98a2b3]" />
                          <button onClick={openAddModal} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf4ff] text-[#2f6fe4]">
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6 grid gap-4 md:grid-cols-3">
                      {moduleCards.map(card => (
                        <div key={card.title} className="rounded-[8px] border border-[#e5edfb] bg-white p-4 shadow-sm">
                          <div className={`mb-4 h-28 rounded-[8px] bg-gradient-to-br ${card.color}`} />
                          <h3 className="font-bold">{card.title}</h3>
                          <p className="mt-1 text-xs text-[#667085]">{card.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-4 grid gap-3 sm:grid-cols-4">
                      {stats.map(item => (
                        <div key={item.label} className="rounded-[8px] border border-[#e5edfb] bg-white p-4 shadow-sm">
                          <div className="text-2xl font-black text-[#2f6fe4]">{item.value}</div>
                          <div className="text-xs font-semibold text-[#667085]">{item.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mb-4 flex flex-col gap-3 rounded-[8px] border border-[#e5edfb] bg-white p-3 shadow-sm sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={16} />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="搜索商品名或备注"
                          className="h-10 w-full rounded-[8px] bg-[#f6f8fc] pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b8d3ff]"
                        />
                      </div>
                      <FilterSelect value={filterStatus} onChange={setFilterStatus} options={['考虑中', '已选', '已放弃']} placeholder="全部状态" />
                      <FilterSelect value={filterCategory} onChange={setFilterCategory} options={categories} placeholder="全部分类" />
                    </div>

                    {filteredProducts.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredProducts.map(p => (
                          <article key={p.id} className="rounded-[8px] border border-[#e5edfb] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-bold leading-snug">{p.name}</h3>
                                <p className="mt-1 text-xs text-[#98a2b3]">{p.createdAt}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[p.status]}`}>{p.status}</span>
                            </div>
                            <div className="mb-3 flex flex-wrap gap-2">
                              {p.price && <span className="rounded-full bg-[#fff7e8] px-2.5 py-1 text-xs font-bold text-[#b76b00]">¥{p.price}</span>}
                              {p.category && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f6fb] px-2.5 py-1 text-xs text-[#667085]">
                                  <Tag size={12} />
                                  {p.category}
                                </span>
                              )}
                            </div>
                            {p.notes && <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-[#667085]">{p.notes}</p>}
                            {p.url && (
                              <a href={p.url} target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-2 truncate rounded-[8px] bg-[#f6f8fc] px-3 py-2 text-xs text-[#2f6fe4]">
                                <LinkIcon size={14} />
                                <span className="truncate">{p.url}</span>
                                <ExternalLink size={13} className="ml-auto flex-shrink-0" />
                              </a>
                            )}
                            <div className="flex items-center gap-2">
                              <button onClick={() => openEditModal(p)} className="rounded-[8px] bg-[#eef4ff] px-3 py-1.5 text-xs font-semibold text-[#2f6fe4]">
                                编辑
                              </button>
                              <select value={p.status} onChange={e => quickStatus(p.id, e.target.value as ProductStatus)} className="rounded-[8px] bg-[#f6f8fc] px-3 py-1.5 text-xs text-[#667085] outline-none">
                                <option>考虑中</option>
                                <option>已选</option>
                                <option>已放弃</option>
                              </select>
                              <button onClick={() => deleteProduct(p.id)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-[8px] text-[#d92d20] hover:bg-[#fff0ef]" title="删除">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[8px] border border-dashed border-[#cdddf5] bg-white/72 py-16 text-center text-sm text-[#667085]">
                        暂无选品记录，点击添加创建第一个商品灵感。
                      </div>
                    )}
                  </>
                )}

                {tab === 'trends' && (
                  <div className="space-y-5">
                    <div className="rounded-[8px] border border-[#e5edfb] bg-white p-5 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-black">AI 热点选品分析</h2>
                          <p className="mt-1 text-xs text-[#667085]">输入热词，生成虚拟商品方向、定价和销售平台建议。</p>
                        </div>
                        {trendsUpdatedAt && <span className="text-xs text-[#98a2b3]">更新于 {trendsUpdatedAt}</span>}
                      </div>
                      <div className="flex min-h-[108px] flex-col justify-between rounded-[8px] border border-[#e6edf8] bg-[#fbfdff] p-4">
                        <input
                          value={analyzeKeyword}
                          onChange={e => setAnalyzeKeyword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && doAnalyze()}
                          placeholder="输入热点关键词，如 AI绘画、小红书、考试资料"
                          className="w-full bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
                        />
                        <div className="mt-5 flex justify-end">
                          <button onClick={() => doAnalyze()} disabled={analyzing} className="flex items-center gap-2 rounded-[8px] bg-[#2f6fe4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            <Sparkles size={16} />
                            {analyzing ? '分析中' : 'AI 分析'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[8px] border border-[#e5edfb] bg-white p-5 shadow-sm">
                      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#eef4ff] text-[#2f6fe4]">
                            <Flame size={22} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black">实时热榜</h2>
                            <p className="mt-1 text-xs text-[#667085]">已扩展到微博、百度、头条、抖音、B站、知乎。点击词条可直接进行 AI 分析。</p>
                          </div>
                        </div>
                        <button onClick={() => loadTrends(true)} disabled={trendsLoading} className="flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#f0f5ff] px-4 text-sm font-semibold text-[#2f6fe4] disabled:opacity-50">
                          <RefreshCw size={16} className={trendsLoading ? 'animate-spin' : ''} />
                          刷新热榜
                        </button>
                      </div>
                      {trendsLoading ? (
                        <div className="flex min-h-[620px] items-center justify-center rounded-[8px] bg-[#f6f8fc] text-sm text-[#667085]">
                          <RefreshCw className="mr-2 animate-spin" size={17} />
                          加载热榜数据中
                        </div>
                      ) : trendsEntries.length > 0 ? (
                        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                          {trendsEntries.map(([platform, items]) => (
                            <div key={platform} className="rounded-[8px] border border-[#e6edf8] bg-[#fbfdff] p-4">
                              <div className="mb-4 flex items-center justify-between">
                                <div>
                                  <h3 className="text-lg font-black">{platform}</h3>
                                  <p className="mt-0.5 text-xs text-[#98a2b3]">最多显示 {items.length} 条热点</p>
                                </div>
                                <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#2f6fe4]">{items.length} 条</span>
                              </div>
                              <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                                {items.map(item => (
                                  <button key={`${platform}-${item.rank}`} onClick={() => doAnalyze(item.title)} className="flex min-h-[72px] w-full items-center gap-3 rounded-[8px] bg-white p-3 text-left shadow-sm transition hover:bg-[#f5f8ff] hover:shadow-md">
                                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${item.rank <= 3 ? 'bg-[#2f6fe4] text-white' : 'bg-[#eef2f8] text-[#667085]'}`}>
                                      {item.rank}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</span>
                                      {item.hotValue && <span className="mt-1 block text-xs text-[#98a2b3]">{formatHot(item.hotValue)}</span>}
                                    </span>
                                    <Bot size={16} className="flex-shrink-0 text-[#2f6fe4]" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[8px] border border-dashed border-[#cdddf5] bg-[#fbfdff] py-24 text-center text-sm text-[#667085]">
                          暂无热榜数据，点击刷新获取。
                        </div>
                      )}
                    </div>

                    <aside className="rounded-[8px] border border-[#e5edfb] bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#2f6fe4] to-[#8c6dff] text-white">
                          <Bot size={22} />
                        </div>
                        <div>
                          <h2 className="font-black">AI 输出</h2>
                          <p className="text-xs text-[#667085]">选品建议会显示在这里</p>
                        </div>
                      </div>
                      <div className="min-h-[360px] overflow-y-auto rounded-[8px] bg-[#f6f8fc] p-4">
                        {analyzing ? (
                          <div className="flex min-h-[300px] flex-col items-center justify-center text-sm text-[#667085]">
                            <RefreshCw className="mb-3 animate-spin text-[#2f6fe4]" size={24} />
                            AI 正在生成分析
                          </div>
                        ) : analyzeResult ? (
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#344054]">{analyzeResult}</pre>
                        ) : (
                          <div className="flex min-h-[300px] flex-col items-center justify-center text-center text-sm text-[#98a2b3]">
                            <BarChart3 className="mb-3 text-[#b8c7df]" size={34} />
                            选择一个热榜关键词，或手动输入关键词。
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[8px] border border-white/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(80,120,190,0.16)] backdrop-blur-xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-[8px] bg-gradient-to-br from-[#2f6fe4] to-[#8c6dff]" />
              <span className="text-sm font-bold">选品工作流</span>
            </div>
            <span className="rounded-full border border-[#d9e5f8] bg-white px-3 py-1 text-xs text-[#667085]">AI Gallery 选品灵感平台</span>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[8px] bg-white shadow-sm">
              <Sparkles className="text-[#172033]" size={26} />
            </div>
            <h2 className="text-xl font-black">虚拟商品大模型</h2>
            <p className="mt-1 text-xs tracking-[0.2em] text-[#667085]">AI FOR PRODUCT IDEAS AND TREND ANALYSIS</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {['热点发现', 'AI 分析', '选品记录', '链接整理', '状态跟进'].map((item, index) => (
              <div key={item} className="rounded-[8px] border border-[#e5edfb] bg-white/78 p-4 shadow-sm">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#f0f5ff] text-[#2f6fe4]">
                  {index + 1}
                </div>
                <h3 className="text-sm font-bold">{item}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#98a2b3]">把灵感整理成可执行商品方向。</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/45 p-4 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[8px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2f6fe4]">{editingId !== null ? '编辑记录' : '新建记录'}</p>
                <h2 className="text-2xl font-black">{editingId !== null ? '调整选品信息' : '添加选品信息'}</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#eef4ff] text-[#2f6fe4]">
                <Plus size={20} />
              </div>
            </div>

            <div className="space-y-4">
              <FieldLabel label="商品名称 *">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入商品名称" className="field-input" />
              </FieldLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="参考价格（¥）">
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" type="number" className="field-input" />
                </FieldLabel>
                <FieldLabel label="状态">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProductStatus }))} className="field-input">
                    <option>考虑中</option>
                    <option>已选</option>
                    <option>已放弃</option>
                  </select>
                </FieldLabel>
              </div>
              <FieldLabel label="分类">
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="如：教程、素材、模板" className="field-input" />
              </FieldLabel>
              <FieldLabel label="商品链接">
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://item.taobao.com/..." className="field-input" />
              </FieldLabel>
              <FieldLabel label="备注">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="记录选品原因、竞品分析、上架思路" rows={4} className="field-input h-auto resize-y py-2" />
              </FieldLabel>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-[8px] bg-[#f2f5fa] px-4 py-2 text-sm font-semibold text-[#667085] hover:bg-[#e8eef8]">
                取消
              </button>
              <button onClick={saveProduct} className="flex items-center gap-2 rounded-[8px] bg-[#2f6fe4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#245ed0]">
                <Check size={16} />
                {editingId !== null ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-[8px] px-4 py-2 text-sm font-semibold shadow-lg ${
          toast.type === 'error' ? 'bg-[#fff0ef] text-[#d92d20]' : 'bg-[#e7f8ef] text-[#168044]'
        }`}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 min-w-[128px] appearance-none rounded-[8px] bg-[#f6f8fc] px-3 pr-9 text-sm text-[#667085] outline-none focus:ring-2 focus:ring-[#b8d3ff]"
      >
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={15} />
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

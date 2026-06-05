'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ExternalLink,
  Flame,
  LayoutGrid,
  Link as LinkIcon,
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
  考虑中: 'bg-[#fff3cd] text-[#8a5d00]',
  已选: 'bg-[#dff5e7] text-[#0f7a3c]',
  已放弃: 'bg-[#ffe3e0] text-[#b42318]',
};

const statusDotStyles: Record<ProductStatus, string> = {
  考虑中: 'bg-[#f2b705]',
  已选: 'bg-[#24a148]',
  已放弃: 'bg-[#d92d20]',
};

const boardAccents = ['#f6d365', '#fda085', '#a1c4fd', '#c2e9fb', '#d4fc79', '#fbc2eb'];

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
      const newProduct: Product = {
        id: Date.now(),
        ...form,
        createdAt: new Date().toLocaleString('zh-CN'),
      };
      updated = [newProduct, ...products];
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
    { label: '全部灵感', value: products.length },
    { label: '考虑中', value: products.filter(p => p.status === '考虑中').length },
    { label: '已选中', value: products.filter(p => p.status === '已选').length },
    { label: '已放弃', value: products.filter(p => p.status === '已放弃').length },
  ];

  return (
    <main className="min-h-screen bg-[#f7f3ee] text-[#211f1c]">
      <header className="sticky top-0 z-40 border-b border-[#eadfd4] bg-[#fffaf5]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button
            onClick={() => setTab('products')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d92525] text-white shadow-sm"
            title="选品助手"
          >
            <Sparkles size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-normal text-[#211f1c]">选品灵感板</h1>
            <p className="hidden text-xs text-[#7c7167] sm:block">虚拟商品选品、热点分析和销售灵感整理</p>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-full bg-[#efe7df] p-1">
            <button
              onClick={() => setTab('products')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === 'products' ? 'bg-white text-[#211f1c] shadow-sm' : 'text-[#766b61] hover:text-[#211f1c]'
              }`}
            >
              <LayoutGrid size={16} />
              选品
            </button>
            <button
              onClick={handleTabTrends}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === 'trends' ? 'bg-white text-[#211f1c] shadow-sm' : 'text-[#766b61] hover:text-[#211f1c]'
              }`}
            >
              <Flame size={16} />
              热点
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="hidden items-center gap-2 rounded-full bg-[#d92525] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b91f1f] sm:flex"
          >
            <Plus size={16} />
            添加选品
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {tab === 'products' && (
          <section>
            <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-[8px] bg-[#211f1c] p-6 text-white shadow-sm">
                <p className="mb-2 text-sm text-[#f7c7b8]">今日工作台</p>
                <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-normal sm:text-4xl">
                  把热点变成可售卖的虚拟商品灵感。
                </h2>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8f84]" size={18} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="搜索商品名或备注"
                      className="h-12 w-full rounded-full border border-transparent bg-white pl-11 pr-4 text-sm text-[#211f1c] outline-none transition focus:border-[#f18f7d]"
                    />
                  </div>
                  <button
                    onClick={openAddModal}
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#d92525] px-5 text-sm font-semibold text-white transition hover:bg-[#b91f1f] sm:hidden"
                  >
                    <Plus size={16} />
                    添加选品
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stats.map((item, index) => (
                  <div key={item.label} className="rounded-[8px] bg-white p-4 shadow-sm ring-1 ring-[#eadfd4]">
                    <div
                      className="mb-5 h-2 rounded-full"
                      style={{ background: boardAccents[index % boardAccents.length] }}
                    />
                    <div className="text-2xl font-bold">{item.value}</div>
                    <div className="text-sm text-[#7c7167]">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-3 rounded-[8px] bg-white p-3 shadow-sm ring-1 ring-[#eadfd4] sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8f84]" size={17} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索灵感"
                  className="h-10 w-full rounded-full bg-[#f7f3ee] pl-10 pr-4 text-sm outline-none ring-1 ring-transparent focus:ring-[#d92525]"
                />
              </div>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="h-10 appearance-none rounded-full bg-[#f7f3ee] px-4 pr-9 text-sm outline-none ring-1 ring-transparent focus:ring-[#d92525]"
                >
                  <option value="">全部状态</option>
                  <option>考虑中</option>
                  <option>已选</option>
                  <option>已放弃</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7c7167]" size={16} />
              </div>
              <div className="relative">
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="h-10 appearance-none rounded-full bg-[#f7f3ee] px-4 pr-9 text-sm outline-none ring-1 ring-transparent focus:ring-[#d92525]"
                >
                  <option value="">全部分类</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7c7167]" size={16} />
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                {filteredProducts.map((p, index) => (
                  <article
                    key={p.id}
                    className="mb-4 break-inside-avoid overflow-hidden rounded-[8px] bg-white shadow-sm ring-1 ring-[#eadfd4] transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div
                      className="flex min-h-[120px] flex-col justify-between p-5 text-[#211f1c]"
                      style={{
                        background: `linear-gradient(135deg, ${boardAccents[index % boardAccents.length]} 0%, #fffaf5 78%)`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[p.status]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[p.status]}`} />
                          {p.status}
                        </span>
                        {p.price && <span className="rounded-full bg-white/75 px-3 py-1 text-sm font-bold">¥{p.price}</span>}
                      </div>
                      <h3 className="mt-8 text-xl font-bold leading-tight">{p.name}</h3>
                    </div>

                    <div className="p-4">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {p.category && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1ece6] px-2.5 py-1 text-xs text-[#6b6259]">
                            <Tag size={12} />
                            {p.category}
                          </span>
                        )}
                        <span className="rounded-full bg-[#f1ece6] px-2.5 py-1 text-xs text-[#8a8178]">{p.createdAt}</span>
                      </div>

                      {p.notes && <p className="mb-3 text-sm leading-relaxed text-[#5d554e]">{p.notes}</p>}

                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-3 flex items-center gap-2 truncate rounded-full bg-[#f7f3ee] px-3 py-2 text-xs font-medium text-[#b91f1f] hover:bg-[#f1e4dc]"
                        >
                          <LinkIcon size={14} />
                          <span className="truncate">{p.url}</span>
                          <ExternalLink size={13} className="ml-auto flex-shrink-0" />
                        </a>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded-full bg-[#211f1c] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
                        >
                          编辑
                        </button>
                        <select
                          value={p.status}
                          onChange={e => quickStatus(p.id, e.target.value as ProductStatus)}
                          className="rounded-full bg-[#f7f3ee] px-3 py-1.5 text-xs text-[#5d554e] outline-none"
                        >
                          <option>考虑中</option>
                          <option>已选</option>
                          <option>已放弃</option>
                        </select>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[#b42318] transition hover:bg-[#ffe3e0]"
                          title="删除"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[8px] bg-white py-20 text-center shadow-sm ring-1 ring-[#eadfd4]">
                <LayoutGrid className="mx-auto mb-4 text-[#c2b7ad]" size={42} />
                <p className="text-sm text-[#7c7167]">
                  {search || filterStatus || filterCategory ? '没有符合条件的选品' : '还没有选品记录，先添加一个灵感'}
                </p>
              </div>
            )}
          </section>
        )}

        {tab === 'trends' && (
          <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
            <aside className="rounded-[8px] bg-white p-5 shadow-sm ring-1 ring-[#eadfd4] lg:sticky lg:top-24 lg:h-fit">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#d92525]">AI 选品分析</p>
                  <h2 className="mt-1 text-2xl font-bold">从热点延伸商品</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0ed] text-[#d92525]">
                  <Bot size={22} />
                </div>
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  value={analyzeKeyword}
                  onChange={e => setAnalyzeKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doAnalyze()}
                  placeholder="输入热点关键词"
                  className="h-11 min-w-0 flex-1 rounded-full bg-[#f7f3ee] px-4 text-sm outline-none ring-1 ring-transparent focus:ring-[#d92525]"
                />
                <button
                  onClick={() => doAnalyze()}
                  disabled={analyzing}
                  className="flex h-11 items-center gap-2 rounded-full bg-[#d92525] px-4 text-sm font-semibold text-white transition hover:bg-[#b91f1f] disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  {analyzing ? '分析中' : '分析'}
                </button>
              </div>

              <div className="min-h-[280px] max-h-[620px] overflow-y-auto rounded-[8px] bg-[#211f1c] p-4 text-white">
                {analyzing ? (
                  <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-[#f7c7b8]">
                    <RefreshCw className="animate-spin" size={24} />
                    <span className="text-sm">AI 正在整理选品路径</span>
                  </div>
                ) : analyzeResult ? (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#fffaf5]">{analyzeResult}</pre>
                ) : (
                  <div className="flex min-h-[240px] flex-col items-center justify-center text-center text-sm text-[#cbbfb5]">
                    <Flame className="mb-3 text-[#f18f7d]" size={28} />
                    点击右侧热榜词条，或手动输入关键词生成选品建议。
                  </div>
                )}
              </div>
            </aside>

            <div className="rounded-[8px] bg-white p-5 shadow-sm ring-1 ring-[#eadfd4]">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#d92525]">实时趋势</p>
                  <h2 className="text-2xl font-bold">热点灵感流</h2>
                  {trendsUpdatedAt && <p className="mt-1 text-xs text-[#8a8178]">更新于 {trendsUpdatedAt}</p>}
                </div>
                <button
                  onClick={() => loadTrends(true)}
                  disabled={trendsLoading}
                  className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#211f1c] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  <RefreshCw size={16} className={trendsLoading ? 'animate-spin' : ''} />
                  {trendsLoading ? '刷新中' : '刷新热榜'}
                </button>
              </div>

              {trendsLoading ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-[8px] bg-[#f7f3ee] text-[#7c7167]">
                  <RefreshCw className="mr-2 animate-spin" size={18} />
                  加载热榜数据中
                </div>
              ) : trendsEntries.length > 0 ? (
                <div className="columns-1 gap-4 xl:columns-2">
                  {trendsEntries.map(([platform, items], platformIndex) => (
                    <article key={platform} className="mb-4 break-inside-avoid overflow-hidden rounded-[8px] bg-[#f7f3ee] ring-1 ring-[#eadfd4]">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <h3 className="font-bold">{platform}</h3>
                          <p className="text-xs text-[#8a8178]">{items.length} 条可分析热点</p>
                        </div>
                        <span
                          className="h-10 w-10 rounded-full"
                          style={{ background: boardAccents[platformIndex % boardAccents.length] }}
                        />
                      </div>
                      <div className="space-y-2 p-3 pt-0">
                        {items.map(item => (
                          <button
                            key={`${platform}-${item.rank}`}
                            onClick={() => doAnalyze(item.title)}
                            className="group flex w-full items-center gap-3 rounded-[8px] bg-white p-3 text-left shadow-sm transition hover:bg-[#fff7f5]"
                          >
                            <span
                              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                item.rank <= 3 ? 'bg-[#d92525] text-white' : 'bg-[#f1ece6] text-[#766b61]'
                              }`}
                            >
                              {item.rank}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium leading-snug text-[#211f1c]">{item.title}</span>
                              {item.hotValue && <span className="mt-1 block text-xs text-[#9a8f84]">{formatHot(item.hotValue)}</span>}
                            </span>
                            <Bot className="flex-shrink-0 text-[#d92525] opacity-0 transition group-hover:opacity-100" size={16} />
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[8px] bg-[#f7f3ee] py-20 text-center text-sm text-[#7c7167]">
                  <Flame className="mx-auto mb-3 text-[#c2b7ad]" size={38} />
                  暂无热榜数据，点击刷新热榜获取
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#211f1c]/60 p-4 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[8px] bg-[#fffaf5] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#d92525]">{editingId !== null ? '编辑灵感' : '新建灵感'}</p>
                <h2 className="text-2xl font-bold">{editingId !== null ? '调整选品记录' : '添加选品记录'}</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0ed] text-[#d92525]">
                <Plus size={20} />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6b6259]">商品名称 *</span>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="输入商品名称"
                  className="h-11 w-full rounded-[8px] border border-[#eadfd4] bg-white px-3 text-sm outline-none focus:border-[#d92525]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6b6259]">参考价格（¥）</span>
                  <input
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    type="number"
                    className="h-11 w-full rounded-[8px] border border-[#eadfd4] bg-white px-3 text-sm outline-none focus:border-[#d92525]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6b6259]">状态</span>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ProductStatus }))}
                    className="h-11 w-full rounded-[8px] border border-[#eadfd4] bg-white px-3 text-sm outline-none focus:border-[#d92525]"
                  >
                    <option>考虑中</option>
                    <option>已选</option>
                    <option>已放弃</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6b6259]">分类</span>
                <input
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="如：教程、素材、模板"
                  className="h-11 w-full rounded-[8px] border border-[#eadfd4] bg-white px-3 text-sm outline-none focus:border-[#d92525]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6b6259]">商品链接</span>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://item.taobao.com/..."
                  className="h-11 w-full rounded-[8px] border border-[#eadfd4] bg-white px-3 text-sm outline-none focus:border-[#d92525]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6b6259]">备注</span>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="记录选品原因、竞品分析、上架思路"
                  rows={4}
                  className="w-full resize-y rounded-[8px] border border-[#eadfd4] bg-white px-3 py-2 text-sm outline-none focus:border-[#d92525]"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full bg-[#efe7df] px-4 py-2 text-sm font-semibold text-[#5d554e] transition hover:bg-[#e4d8cc]"
              >
                取消
              </button>
              <button
                onClick={saveProduct}
                className="flex items-center gap-2 rounded-full bg-[#d92525] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b91f1f]"
              >
                <Check size={16} />
                {editingId !== null ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
            toast.type === 'error' ? 'bg-[#ffe3e0] text-[#b42318]' : 'bg-[#dff5e7] text-[#0f7a3c]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}

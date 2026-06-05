'use client';

import { useEffect, useState, useCallback } from 'react';

// ==================== 类型定义 ====================

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

// ==================== 本地存储工具 ====================

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

// ==================== 主组件 ====================

export default function Home() {
  const [tab, setTab] = useState<'products' | 'trends'>('products');

  // 选品记录状态
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt'>>({
    name: '', url: '', price: '', category: '', notes: '', status: '考虑中',
  });

  // 热榜状态
  const [trends, setTrends] = useState<TrendsData>({});
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsUpdatedAt, setTrendsUpdatedAt] = useState('');

  // AI 分析状态
  const [analyzeKeyword, setAnalyzeKeyword] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: string }>({ show: false, msg: '', type: '' });

  // ===== 初始化 =====
  useEffect(() => {
    setProducts(loadProducts());
  }, []);

  const showToast = (msg: string, type = '') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3000);
  };

  // ===== 选品 CRUD =====

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
    if (!form.name.trim()) { showToast('请填写商品名称', 'error'); return; }
    let updated: Product[];
    if (editingId !== null) {
      updated = products.map(p => p.id === editingId ? { ...p, ...form } : p);
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
    const updated = products.map(p => p.id === id ? { ...p, status } : p);
    setProducts(updated);
    saveProducts(updated);
  };

  // ===== 热榜 =====

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

  // ===== AI 分析 =====

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
      setAnalyzeResult(data.success ? data.analysis : `❌ ${data.error}`);
    } catch (e: unknown) {
      setAnalyzeResult('❌ 请求失败，请检查网络');
    } finally {
      setAnalyzing(false);
    }
  };

  // ===== 辅助函数 =====

  const platformIcon = (name: string) =>
    ({ '微博热搜': '🌊', '知乎热榜': '💡', '百度热搜': '🔍', '今日头条': '📰' } as Record<string, string>)[name] || '📊';

  const formatHot = (val: string) => {
    const n = parseInt(val);
    if (isNaN(n) || !val) return val || '';
    return n >= 10000 ? (n / 10000).toFixed(1) + '万' : val;
  };

  const trendsEntries = Object.entries(trends).filter(
    (entry): entry is [string, TrendItem[]] => Array.isArray(entry[1])
  );

  // ==================== 渲染 ====================

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-200">

      {/* 顶栏 */}
      <div className="sticky top-0 z-50 bg-[#161b22] border-b border-[#30363d] h-14 flex items-center px-6 gap-8">
        <span className="text-lg font-bold text-[#58a6ff]">选品<span className="text-white">助手</span></span>
        <div className="flex gap-1">
          <button onClick={() => setTab('products')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'products' ? 'bg-[#21262d] text-[#58a6ff] font-medium' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}>
            📦 选品记录
          </button>
          <button onClick={handleTabTrends}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === 'trends' ? 'bg-[#21262d] text-[#58a6ff] font-medium' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}>
            🔥 热点分析
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {/* ===== 选品记录 Tab ===== */}
        {tab === 'products' && (
          <div>
            {/* 统计 */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: '全部', value: products.length, color: 'text-white' },
                { label: '考虑中', value: products.filter(p => p.status === '考虑中').length, color: 'text-[#58a6ff]' },
                { label: '已选中', value: products.filter(p => p.status === '已选').length, color: 'text-[#3fb950]' },
                { label: '已放弃', value: products.filter(p => p.status === '已放弃').length, color: 'text-[#f85149]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-white">选品记录</span>
                <button onClick={openAddModal}
                  className="bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043] text-white text-sm px-4 py-1.5 rounded-md transition-colors">
                  ＋ 添加选品
                </button>
              </div>

              {/* 搜索筛选 */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 搜索商品名/备注..."
                  className="flex-1 min-w-[200px] bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#58a6ff]" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]">
                  <option value="">全部状态</option>
                  <option>考虑中</option><option>已选</option><option>已放弃</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  className="bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]">
                  <option value="">全部分类</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* 产品网格 */}
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="bg-[#0d1117] border border-[#21262d] hover:border-[#388bfd] rounded-lg p-4 transition-colors">
                      <div className="font-semibold text-white mb-2">{p.name}</div>
                      <div className="flex flex-wrap gap-2 mb-2 items-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === '考虑中' ? 'bg-[#1f3a5f] text-[#58a6ff]' :
                          p.status === '已选' ? 'bg-[#1a3a2a] text-[#3fb950]' :
                          'bg-[#3a1a1a] text-[#f85149]'}`}>{p.status}</span>
                        {p.price && <span className="text-xs font-semibold text-yellow-400">¥{p.price}</span>}
                        {p.category && <span className="text-xs bg-[#21262d] text-gray-400 px-2 py-0.5 rounded-full">{p.category}</span>}
                      </div>
                      {p.notes && <p className="text-xs text-gray-400 mb-2 leading-relaxed">{p.notes}</p>}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer"
                          className="text-xs text-[#388bfd] hover:underline block mb-2 truncate">
                          🔗 {p.url}
                        </a>
                      )}
                      <div className="flex gap-2 mt-2 items-center">
                        <button onClick={() => openEditModal(p)}
                          className="text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-gray-300 px-2.5 py-1 rounded-md transition-colors">
                          编辑
                        </button>
                        <select value={p.status} onChange={e => quickStatus(p.id, e.target.value as ProductStatus)}
                          className="text-xs bg-[#21262d] border border-[#30363d] text-gray-300 px-2 py-1 rounded-md outline-none">
                          <option>考虑中</option><option>已选</option><option>已放弃</option>
                        </select>
                        <button onClick={() => deleteProduct(p.id)}
                          className="text-xs border border-[#f85149] text-[#f85149] hover:bg-[#f8514918] px-2.5 py-1 rounded-md transition-colors ml-auto">
                          删除
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-2">{p.createdAt}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">📦</div>
                  <div className="text-sm">{search || filterStatus || filterCategory ? '没有符合条件的选品' : '还没有选品记录，点击「添加选品」开始吧'}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 热点分析 Tab ===== */}
        {tab === 'trends' && (
          <div>
            {/* AI 分析区域 */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-5">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-white">🤖 AI 虚拟商品延伸分析</span>
                {trendsUpdatedAt && <span className="text-xs text-gray-500">热榜更新于 {trendsUpdatedAt}</span>}
              </div>
              <div className="flex gap-2 mb-4">
                <input value={analyzeKeyword} onChange={e => setAnalyzeKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doAnalyze()}
                  placeholder="输入热点关键词，如：王者荣耀、AI绘画、减肥..."
                  className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#58a6ff]" />
                <button onClick={() => doAnalyze()} disabled={analyzing}
                  className="bg-[#1f6feb] hover:bg-[#388bfd] border border-[#388bfd] text-white text-sm px-4 py-2 rounded-md transition-colors disabled:opacity-50">
                  {analyzing ? '分析中...' : '🚀 AI 分析'}
                </button>
              </div>
              <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 min-h-[100px] max-h-[500px] overflow-y-auto">
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-2 h-2 bg-[#58a6ff] rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">AI 正在分析中...</span>
                  </div>
                ) : analyzeResult ? (
                  <pre className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analyzeResult}</pre>
                ) : (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    👆 点击热榜词条或手动输入关键词，AI 会帮你分析可以卖什么虚拟商品
                  </div>
                )}
              </div>
            </div>

            {/* 热榜区域 */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-white">🔥 实时热榜</span>
                <button onClick={() => loadTrends(true)} disabled={trendsLoading}
                  className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-gray-300 text-sm px-3 py-1.5 rounded-md transition-colors disabled:opacity-50">
                  {trendsLoading ? '刷新中...' : '⟳ 刷新热榜'}
                </button>
              </div>

              {trendsLoading ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">⏳</div>加载热榜数据中...
                </div>
              ) : trendsEntries.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trendsEntries.map(([platform, items]) => (
                    <div key={platform} className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-[#21262d]">
                        <span>{platformIcon(platform)}</span>
                        <span className="text-sm font-semibold text-white">{platform}</span>
                        <span className="text-xs text-gray-500 ml-auto">{(items as TrendItem[]).length} 条</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {(items as TrendItem[]).map((item) => (
                          <div key={item.rank} onClick={() => doAnalyze(item.title)}
                            className="flex items-center gap-3 px-4 py-2.5 border-b border-[#161b22] hover:bg-[#161b22] cursor-pointer group transition-colors">
                            <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${
                              item.rank === 1 ? 'text-[#f85149]' : item.rank === 2 ? 'text-[#f0883e]' : item.rank === 3 ? 'text-[#f0c040]' : 'text-gray-600'
                            }`}>{item.rank}</span>
                            <span className="text-xs text-gray-300 flex-1 leading-snug">{item.title}</span>
                            {item.hotValue && <span className="text-[10px] text-gray-600 flex-shrink-0">{formatHot(item.hotValue)}</span>}
                            <button className="text-[10px] px-2 py-0.5 bg-[#1f3a5f] text-[#58a6ff] rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              分析
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">📡</div>
                  <div className="text-sm">暂无热榜数据，点击「刷新热榜」获取</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 添加/编辑模态框 ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold mb-5">{editingId !== null ? '编辑选品' : '添加选品'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">商品名称 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="输入商品名称"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">参考价格（¥）</label>
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00" type="number"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">状态</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProductStatus }))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]">
                    <option>考虑中</option><option>已选</option><option>已放弃</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">分类</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="如：教程、素材、模板..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">淘宝链接</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://item.taobao.com/..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff]" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">备注</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="记录选品原因、竞品分析等..." rows={3}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#58a6ff] resize-y" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)}
                className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-gray-300 text-sm px-4 py-2 rounded-md transition-colors">
                取消
              </button>
              <button onClick={saveProduct}
                className="bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043] text-white text-sm px-4 py-2 rounded-md transition-colors">
                {editingId !== null ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm z-50 border ${
          toast.type === 'error' ? 'bg-[#3a1a1a] border-[#f85149] text-[#f85149]' : 'bg-[#1a3a2a] border-[#2ea043] text-[#3fb950]'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}

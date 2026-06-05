'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  Link as LinkIcon,
  Loader2,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

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
  imageUrl?: string;
  detailText?: string;
  detailImages?: string[];
  optimizedTitles?: string[];
  processedMainImage?: string;
  processedDetailImages?: string[];
  githubMainImage?: string;
  githubDetailImages?: string[];
  listingStatus?: '待处理' | '待改图' | '已改图' | '可上架';
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
  _source?: string;
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
  考虑中: 'bg-amber-50 text-amber-700 ring-amber-200',
  已选: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  已放弃: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function Home() {
  const [tab, setTab] = useState<'products' | 'trends'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [taobaoUrl, setTaobaoUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [optimizingId, setOptimizingId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt'>>({
    name: '',
    url: '',
    price: '',
    category: '',
    notes: '',
    status: '考虑中',
    imageUrl: '',
    detailText: '',
    detailImages: [],
    optimizedTitles: [],
    processedMainImage: '',
    processedDetailImages: [],
    githubMainImage: '',
    githubDetailImages: [],
    listingStatus: '待处理',
  });

  const [trends, setTrends] = useState<TrendsData>({});
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsUpdatedAt, setTrendsUpdatedAt] = useState('');
  const [analyzeKeyword, setAnalyzeKeyword] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: string }>({ show: false, msg: '', type: '' });

  useEffect(() => {
    const saved = loadProducts();
    setProducts(saved);
    setSelectedProductId(saved[0]?.id || null);
  }, []);

  const showToast = (msg: string, type = '') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 2800);
  };

  const persistProducts = (next: Product[]) => {
    setProducts(next);
    saveProducts(next);
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.notes.includes(search);
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchCategory = !filterCategory || p.category === filterCategory;
    return matchSearch && matchStatus && matchCategory;
  });

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  const openAddModal = () => {
    setEditingId(null);
    setForm({ name: '', url: '', price: '', category: '', notes: '', status: '考虑中', imageUrl: '', detailText: '', detailImages: [], optimizedTitles: [] });
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      url: p.url,
      price: p.price,
      category: p.category,
      notes: p.notes,
      status: p.status,
      imageUrl: p.imageUrl || '',
      detailText: p.detailText || '',
      detailImages: p.detailImages || [],
      optimizedTitles: p.optimizedTitles || [],
      processedMainImage: p.processedMainImage || '',
      processedDetailImages: p.processedDetailImages || [],
      githubMainImage: p.githubMainImage || '',
      githubDetailImages: p.githubDetailImages || [],
      listingStatus: p.listingStatus || '待处理',
    });
    setShowModal(true);
  };

  const saveProduct = () => {
    if (!form.name.trim()) {
      showToast('请填写商品名称', 'error');
      return;
    }
    const next = editingId !== null
      ? products.map(p => (p.id === editingId ? { ...p, ...form } : p))
      : [{ id: Date.now(), ...form, createdAt: new Date().toLocaleString('zh-CN') }, ...products];
    persistProducts(next);
    setSelectedProductId(editingId || next[0].id);
    setShowModal(false);
    showToast(editingId !== null ? '修改成功' : '添加成功');
  };

  const importTaobao = async () => {
    if (!taobaoUrl.trim()) {
      showToast('请先粘贴淘宝链接', 'error');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/taobao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: taobaoUrl.trim() }),
      });
      const data = await res.json();
      const item = data.product || {};
      const product: Product = {
        id: Date.now(),
        name: item.title || '淘宝商品',
        url: taobaoUrl.trim(),
        price: '',
        category: '淘宝采集',
        notes: data.warning || '已从淘宝链接自动采集',
        status: '考虑中',
        createdAt: new Date().toLocaleString('zh-CN'),
        imageUrl: item.mainImage || '',
        detailText: item.detailText || '',
        detailImages: item.detailImages || [],
        optimizedTitles: [],
        processedMainImage: '',
        processedDetailImages: [],
        githubMainImage: '',
        githubDetailImages: [],
        listingStatus: '待处理',
      };
      const next = [product, ...products];
      persistProducts(next);
      setSelectedProductId(product.id);
      setTaobaoUrl('');
      showToast(data.success ? '已自动保存淘宝商品' : '已保存链接，可手动补充信息');
    } catch {
      showToast('淘宝链接导入失败', 'error');
    } finally {
      setImporting(false);
    }
  };

  const importExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const splitImages = (value: unknown) => String(value || '')
        .split(/[\n\r,，;；\s]+/)
        .map(item => item.trim())
        .filter(item => /^https?:\/\//.test(item) || item.startsWith('data:image'));

      const imported = rows
        .map((row, index): Product | null => {
          const name = String(row['标题'] || row['商品标题'] || row['宝贝标题'] || '').trim();
          const url = String(row['宝贝链接'] || row['商品链接'] || row['链接'] || '').trim();
          const imageUrl = String(row['图片地址'] || row['主图'] || row['主图地址'] || '').trim();
          const detailImages = [
            ...splitImages(row['详情图']),
            ...splitImages(row['详情页图片']),
            ...splitImages(row['详情图片']),
            ...splitImages(row['详情页素材']),
            ...splitImages(row['详情素材']),
            ...splitImages(row['图片列表']),
          ].filter(image => image !== imageUrl);
          const detailText = String(row['详情文案'] || row['详情页文案'] || row['商品详情'] || row['描述'] || '').trim();
          const price = String(row['价格'] || row['售价'] || '').trim();
          const sales = String(row['销量'] || '').trim();
          const itemId = String(row['宝贝ID'] || row['商品ID'] || '').trim();

          if (!name && !url && !imageUrl) return null;

          return {
            id: Date.now() + index,
            name: name || `插件导入商品 ${index + 1}`,
            url,
            price,
            category: '插件Excel导入',
            notes: [itemId && `宝贝ID：${itemId}`, sales && `销量：${sales}`].filter(Boolean).join(' ｜ '),
            status: '考虑中',
            createdAt: new Date().toLocaleString('zh-CN'),
            imageUrl,
            detailText,
            detailImages,
            optimizedTitles: [],
            processedMainImage: '',
            processedDetailImages: [],
            githubMainImage: '',
            githubDetailImages: [],
            listingStatus: detailImages.length > 0 ? '待改图' : '待处理',
          };
        })
        .filter((item): item is Product => Boolean(item));

      if (imported.length === 0) {
        showToast('没有识别到可导入的商品行', 'error');
        return;
      }

      const next = [...imported, ...products];
      persistProducts(next);
      setSelectedProductId(imported[0].id);
      showToast(`已导入 ${imported.length} 条选品`);
    } catch {
      showToast('Excel 导入失败，请检查文件格式', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setFormImageFromFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('图片不能超过 2MB，避免浏览器存储爆满', 'error');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setForm(f => ({ ...f, imageUrl: dataUrl }));
    showToast('主图已添加');
  };

  const readImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
    if (file.size > 2 * 1024 * 1024) throw new Error('图片不能超过 2MB');
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const updateProduct = (id: number, patch: Partial<Product>) => {
    persistProducts(products.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  const uploadImageToGitHub = async (product: Product, image: string, kind: 'main' | 'detail') => {
    try {
      const res = await fetch('/api/github-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, title: product.name, kind }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || '上传 GitHub 失败', 'error');
        return '';
      }
      return data.rawUrl as string;
    } catch {
      showToast('上传 GitHub 失败', 'error');
      return '';
    }
  };

  const uploadMainToGitHub = async (product: Product) => {
    if (!product.imageUrl) {
      showToast('当前商品没有主图', 'error');
      return;
    }
    const url = await uploadImageToGitHub(product, product.imageUrl, 'main');
    if (!url) return;
    updateProduct(product.id, { githubMainImage: url });
    await navigator.clipboard.writeText(url);
    showToast('主图 GPT 链接已生成并复制');
  };

  const uploadDetailsToGitHub = async (product: Product) => {
    const images = product.detailImages || [];
    if (images.length === 0) {
      showToast('当前商品没有详情图', 'error');
      return;
    }
    const uploaded: string[] = [];
    for (const image of images) {
      const url = await uploadImageToGitHub(product, image, 'detail');
      if (url) uploaded.push(url);
    }
    if (uploaded.length === 0) return;
    updateProduct(product.id, { githubDetailImages: [...(product.githubDetailImages || []), ...uploaded] });
    await navigator.clipboard.writeText(uploaded.join('\n'));
    showToast(`已生成 ${uploaded.length} 张详情图 GPT 链接`);
  };

  const copyListingInfo = async (product: Product) => {
    const title = product.optimizedTitles?.[0] || product.name;
    const lines = [
      `标题：${title}`,
      `原始标题：${product.name}`,
      product.price && `价格：${product.price}`,
      product.url && `链接：${product.url}`,
      product.imageUrl && `原主图：${product.imageUrl}`,
      product.githubMainImage && `GitHub主图：${product.githubMainImage}`,
      product.detailImages?.length && `原详情图：\n${product.detailImages.join('\n')}`,
      product.githubDetailImages?.length && `GitHub详情图：\n${product.githubDetailImages.join('\n')}`,
      product.processedMainImage && `加工后主图：已保存到资料库`,
      product.processedDetailImages?.length && `加工后详情图：${product.processedDetailImages.length} 张`,
      (product.detailText || product.notes) && `详情/备注：${product.detailText || product.notes}`,
    ].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(lines);
    showToast('上架资料已复制');
  };

  const fetchImageBlob = async (image: string) => {
    const url = image.startsWith('data:image') ? image : `/api/proxy-image?url=${encodeURIComponent(image)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('图片下载失败');
    return res.blob();
  };

  const downloadProductZip = async (product: Product) => {
    try {
      const zip = new JSZip();
      const safeName = product.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 36) || '商品素材';
      const listingText = [
        `标题：${product.optimizedTitles?.[0] || product.name}`,
        `原始标题：${product.name}`,
        `链接：${product.url}`,
        `价格：${product.price}`,
        `分类：${product.category}`,
        `备注：${product.notes}`,
        `详情：${product.detailText || ''}`,
      ].join('\n');

      zip.file('上架资料.txt', listingText);

      const addImage = async (folder: string, name: string, image?: string) => {
        if (!image) return;
        const blob = await fetchImageBlob(image);
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
        zip.file(`${folder}/${name}.${ext}`, blob);
      };

      await addImage('原始素材', '主图', product.imageUrl);
      for (const [index, image] of (product.detailImages || []).entries()) {
        await addImage('原始素材', `详情图-${index + 1}`, image);
      }
      await addImage('加工后素材', '加工后主图', product.processedMainImage);
      for (const [index, image] of (product.processedDetailImages || []).entries()) {
        await addImage('加工后素材', `加工后详情图-${index + 1}`, image);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${safeName}-上架素材包.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('素材包已生成');
    } catch {
      showToast('素材包下载失败，可能有图片链接失效', 'error');
    }
  };

  const setProcessedMainImage = async (product: Product, file: File) => {
    try {
      const image = await readImageFile(file);
      updateProduct(product.id, { processedMainImage: image, listingStatus: '已改图' });
      showToast('加工后主图已保存');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '图片上传失败', 'error');
    }
  };

  const addProcessedDetailImages = async (product: Product, files: FileList) => {
    try {
      const images = await Promise.all(Array.from(files).map(readImageFile));
      updateProduct(product.id, {
        processedDetailImages: [...(product.processedDetailImages || []), ...images],
        listingStatus: '已改图',
      });
      showToast(`已保存 ${images.length} 张加工后详情图`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '图片上传失败', 'error');
    }
  };

  const optimizeTitle = async (product: Product) => {
    setOptimizingId(product.id);
    try {
      const res = await fetch('/api/title-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: product.name, detail: product.detailText || product.notes }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || '标题优化失败', 'error');
        return;
      }
      const next = products.map(p => (p.id === product.id ? { ...p, optimizedTitles: data.titles } : p));
      persistProducts(next);
      showToast('标题优化完成');
    } catch {
      showToast('标题优化失败', 'error');
    } finally {
      setOptimizingId(null);
    }
  };

  const deleteProduct = (id: number) => {
    if (!confirm('确定删除这条选品吗？')) return;
    const next = products.filter(p => p.id !== id);
    persistProducts(next);
    setSelectedProductId(next[0]?.id || null);
    setSelectedIds(ids => ids.filter(item => item !== id));
    showToast('已删除');
  };

  const toggleSelectProduct = (id: number) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  };

  const toggleSelectFiltered = () => {
    const filteredIds = filteredProducts.map(product => product.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !filteredIds.includes(id)) : [...new Set([...selectedIds, ...filteredIds])]);
  };

  const deleteSelectedProducts = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确定删除已选的 ${selectedIds.length} 条选品吗？`)) return;
    const next = products.filter(product => !selectedIds.includes(product.id));
    persistProducts(next);
    setSelectedProductId(next[0]?.id || null);
    setSelectedIds([]);
    showToast(`已删除 ${selectedIds.length} 条选品`);
  };

  const quickStatus = (id: number, status: ProductStatus) => {
    persistProducts(products.map(p => (p.id === id ? { ...p, status } : p)));
  };

  const loadTrends = useCallback(async (forceRefresh = false) => {
    setTrendsLoading(true);
    try {
      const res = await fetch(forceRefresh ? '/api/trends?refresh=1' : '/api/trends');
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
  const trendSource = typeof trends._source === 'string' ? trends._source : '聚合平台';

  return (
    <main className="min-h-screen bg-[#eef5ff] text-[#102033]">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,#cfe0ff_0,#edf5ff_28%,transparent_55%),radial-gradient(circle_at_85%_10%,#d9d5ff_0,transparent_34%)]" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/70 bg-white/70 p-6 backdrop-blur-xl lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2f6fe4] text-white shadow-lg shadow-blue-300/40">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="text-lg font-black">跨境选品助手</div>
              <div className="text-xs text-[#667085]">热点采集与虚拟商品运营</div>
            </div>
          </div>
          <nav className="space-y-2">
            <NavButton active={tab === 'products'} icon={<LayoutDashboard size={18} />} label="选品工作台" onClick={() => setTab('products')} />
            <NavButton active={tab === 'trends'} icon={<Flame size={18} />} label="热榜分析" onClick={handleTabTrends} />
            <button onClick={openAddModal} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f6fe4] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-300/30">
              <PackagePlus size={18} />
              手动新增选品
            </button>
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-xl shadow-blue-100/60 backdrop-blur-xl xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#2f6fe4]">
                AI PRODUCT OPS
              </div>
              <h1 className="text-3xl font-black tracking-normal text-[#111827] sm:text-4xl">虚拟产品选品工作台</h1>
              <p className="mt-2 text-sm text-[#667085]">导入淘宝竞品，保存主图详情，用 AI 优化合规高曝光标题。</p>
            </div>
            <div className="flex rounded-2xl bg-[#eef4ff] p-1">
              <button onClick={() => setTab('products')} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === 'products' ? 'bg-white text-[#2f6fe4] shadow-sm' : 'text-[#667085]'}`}>选品</button>
              <button onClick={handleTabTrends} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === 'trends' ? 'bg-white text-[#2f6fe4] shadow-sm' : 'text-[#667085]'}`}>热榜</button>
            </div>
          </header>

          {tab === 'products' ? (
            <div className="grid min-h-[calc(100vh-170px)] gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
              <div className="space-y-6">
                <section className="rounded-[30px] border border-white/80 bg-white p-6 shadow-xl shadow-blue-100/50">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black">竞品资料导入</h2>
                      <p className="mt-1 text-sm text-[#667085]">推荐使用插件导出的 Excel 批量导入标题、链接、主图、价格和销量，绕开淘宝反爬。</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2f6fe4]">
                      <Globe2 size={23} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 rounded-3xl bg-[#f6f9ff] p-3 md:flex-row">
                    <input
                      value={taobaoUrl}
                      onChange={e => setTaobaoUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && importTaobao()}
                      placeholder="粘贴淘宝商品链接，例如 https://item.taobao.com/item.htm?id=..."
                      className="h-13 min-h-13 flex-1 rounded-2xl border border-transparent bg-white px-4 text-sm outline-none focus:border-[#9cc3ff]"
                    />
                    <button onClick={importTaobao} disabled={importing} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#2f6fe4] px-6 text-sm font-black text-white disabled:opacity-60">
                      {importing ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />}
                      自动保存
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-dashed border-[#bdd3f3] bg-[#fbfdff] p-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-[#667085]">
                      插件 Excel 支持列名：标题、宝贝ID、宝贝链接、图片地址、价格、销量。
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && importExcel(e.target.files[0])}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#2f6fe4] shadow-sm ring-1 ring-[#dbe8fb]"
                    >
                      <Upload size={17} />
                      导入插件 Excel
                    </button>
                  </div>
                </section>

                <section className="rounded-[30px] border border-white/80 bg-white p-5 shadow-xl shadow-blue-100/50">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索商品标题或备注" className="h-12 w-full rounded-2xl bg-[#f6f9ff] pl-11 pr-4 text-sm outline-none" />
                    </div>
                    <FilterSelect value={filterStatus} onChange={setFilterStatus} options={['考虑中', '已选', '已放弃']} placeholder="全部状态" />
                    <FilterSelect value={filterCategory} onChange={setFilterCategory} options={categories} placeholder="全部分类" />
                  </div>
                  <div className="mb-4 flex flex-col gap-3 rounded-3xl bg-[#f6f9ff] p-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm font-bold text-[#667085]">
                      当前显示 {filteredProducts.length} 条，已选择 {selectedIds.length} 条
                    </div>
                    <div className="flex gap-2">
                      <button onClick={toggleSelectFiltered} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-[#2f6fe4] ring-1 ring-[#dbe8fb]">
                        {filteredProducts.length > 0 && filteredProducts.every(product => selectedIds.includes(product.id)) ? '取消全选' : '全选当前'}
                      </button>
                      <button onClick={deleteSelectedProducts} disabled={selectedIds.length === 0} className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-40">
                        批量删除
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {filteredProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        active={selectedProduct?.id === product.id}
                        checked={selectedIds.includes(product.id)}
                        optimizing={optimizingId === product.id}
                        onSelect={() => setSelectedProductId(product.id)}
                        onToggleSelect={() => toggleSelectProduct(product.id)}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => deleteProduct(product.id)}
                        onOptimize={() => optimizeTitle(product)}
                        onStatus={status => quickStatus(product.id, status)}
                      />
                    ))}
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-[#c8d8ef] py-20 text-center text-sm text-[#667085]">
                      还没有选品，先粘贴淘宝链接自动导入。
                    </div>
                  )}
                </section>
              </div>

              <ProductInspector
                product={selectedProduct}
                onOptimize={optimizeTitle}
                optimizing={selectedProduct ? optimizingId === selectedProduct.id : false}
                onProcessedMain={setProcessedMainImage}
                onProcessedDetails={addProcessedDetailImages}
                onUpdate={updateProduct}
                onUploadMain={uploadMainToGitHub}
                onUploadDetails={uploadDetailsToGitHub}
                onCopyListing={copyListingInfo}
                onDownloadZip={downloadProductZip}
              />
            </div>
          ) : (
            <div className="grid min-h-[calc(100vh-170px)] gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
              <section className="rounded-[30px] border border-white/80 bg-white p-5 shadow-xl shadow-blue-100/50">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">实时热榜</h2>
                    <p className="mt-1 text-sm text-[#667085]">已接入 {trendSource}，点击热词后右侧立即显示 AI 分析，不用向下滚动。</p>
                  </div>
                  <button onClick={() => loadTrends(true)} disabled={trendsLoading} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#eef4ff] px-4 text-sm font-bold text-[#2f6fe4] disabled:opacity-60">
                    <RefreshCw size={17} className={trendsLoading ? 'animate-spin' : ''} />
                    刷新热榜
                  </button>
                </div>
                {trendsLoading ? (
                  <div className="flex h-[680px] items-center justify-center rounded-3xl bg-[#f6f9ff] text-sm text-[#667085]">
                    <Loader2 className="mr-2 animate-spin text-[#2f6fe4]" size={18} />
                    正在加载全网热榜
                  </div>
                ) : trendsEntries.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {trendsEntries.map(([platform, items]) => (
                      <TrendBoard key={platform} platform={platform} items={items} formatHot={formatHot} onAnalyze={doAnalyze} />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-[680px] items-center justify-center rounded-3xl border border-dashed border-[#c8d8ef] text-sm text-[#667085]">
                    点击刷新热榜获取数据
                  </div>
                )}
              </section>

              <aside className="sticky top-8 h-[calc(100vh-64px)] rounded-[30px] border border-white/80 bg-[#101828] p-5 text-white shadow-2xl shadow-blue-200/70">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#9cc3ff]">
                    <Bot size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">AI 选品分析</h2>
                    <p className="text-xs text-white/50">{trendsUpdatedAt ? `热榜更新于 ${trendsUpdatedAt}` : '点击左侧热词开始分析'}</p>
                  </div>
                </div>
                <div className="mb-4 flex gap-2 rounded-2xl bg-white/8 p-2">
                  <input value={analyzeKeyword} onChange={e => setAnalyzeKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAnalyze()} placeholder="手动输入热点关键词" className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/35" />
                  <button onClick={() => doAnalyze()} disabled={analyzing} className="flex h-11 items-center gap-2 rounded-xl bg-[#2f6fe4] px-4 text-sm font-bold disabled:opacity-60">
                    {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                    分析
                  </button>
                </div>
                <div className="h-[calc(100%-132px)] overflow-y-auto rounded-2xl bg-white/[0.06] p-4">
                  {analyzing ? (
                    <div className="flex h-full flex-col items-center justify-center text-sm text-white/60">
                      <Loader2 className="mb-3 animate-spin text-[#9cc3ff]" size={28} />
                      正在生成选品建议
                    </div>
                  ) : analyzeResult ? (
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-white/88">{analyzeResult}</pre>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-white/45">
                      <Flame className="mb-3 text-[#9cc3ff]" size={36} />
                      热榜点击后，分析结果会固定显示在这里。
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102033]/45 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#2f6fe4]">{editingId !== null ? '编辑选品' : '新建选品'}</p>
                <h2 className="text-2xl font-black">商品档案</h2>
              </div>
              <button onClick={saveProduct} className="flex items-center gap-2 rounded-2xl bg-[#2f6fe4] px-4 py-2 text-sm font-bold text-white">
                <Check size={16} />
                保存
              </button>
            </div>
            <div className="grid gap-4">
              <FieldLabel label="商品标题 *"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="field-input" /></FieldLabel>
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="overflow-hidden rounded-3xl bg-[#eef4ff]">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="主图预览" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center text-[#98a2b3]">
                      <ImageIcon size={34} />
                    </div>
                  )}
                </div>
                <div className="rounded-3xl border border-dashed border-[#c8d8ef] bg-[#fbfdff] p-4">
                  <div className="mb-2 text-sm font-black">主图</div>
                  <p className="mb-4 text-xs leading-5 text-[#667085]">可以上传本地图片，也可以粘贴图片链接。上传图片会保存在浏览器本地资料库里。</p>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-2xl bg-[#2f6fe4] px-4 text-sm font-bold text-white">
                    <Upload size={16} />
                    上传主图
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && setFormImageFromFile(e.target.files[0])}
                    />
                  </label>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="主图链接"><input value={form.imageUrl || ''} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="field-input" /></FieldLabel>
                <FieldLabel label="分类"><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="field-input" /></FieldLabel>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldLabel label="商品链接"><input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="field-input" /></FieldLabel>
                <FieldLabel label="状态">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProductStatus }))} className="field-input">
                    <option>考虑中</option><option>已选</option><option>已放弃</option>
                  </select>
                </FieldLabel>
              </div>
              <FieldLabel label="详情摘要"><textarea value={form.detailText || form.notes} onChange={e => setForm(f => ({ ...f, detailText: e.target.value, notes: e.target.value }))} rows={5} className="field-input h-auto resize-y py-2" /></FieldLabel>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-2xl bg-[#f2f5fa] px-4 py-2 text-sm font-bold text-[#667085]">取消</button>
              <button onClick={saveProduct} className="rounded-2xl bg-[#2f6fe4] px-4 py-2 text-sm font-bold text-white">保存修改</button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl px-4 py-3 text-sm font-bold shadow-xl ${toast.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? 'bg-[#eef4ff] text-[#2f6fe4]' : 'text-[#667085] hover:bg-white/70'}`}>
      {icon}
      {label}
    </button>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="h-12 min-w-[138px] appearance-none rounded-2xl bg-[#f6f9ff] px-4 pr-9 text-sm text-[#667085] outline-none">
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={15} />
    </div>
  );
}

function ProductCard({ product, active, checked, optimizing, onSelect, onToggleSelect, onEdit, onDelete, onOptimize, onStatus }: {
  product: Product;
  active: boolean;
  checked: boolean;
  optimizing: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOptimize: () => void;
  onStatus: (status: ProductStatus) => void;
}) {
  return (
    <article onClick={onSelect} className={`cursor-pointer overflow-hidden rounded-[24px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${active ? 'border-[#2f6fe4] ring-4 ring-blue-100' : 'border-[#e5edfb]'}`}>
      <div className="relative h-44 bg-[#eef4ff]">
        <label onClick={e => e.stopPropagation()} className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/90 shadow-sm">
          <input type="checkbox" checked={checked} onChange={onToggleSelect} className="h-4 w-4 accent-[#2f6fe4]" />
        </label>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#98a2b3]"><ImageIcon size={36} /></div>}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusStyles[product.status]}`}>{product.status}</span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[44px] font-black leading-snug">{product.name}</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#667085]">
          {product.category && <span className="rounded-full bg-[#f4f6fb] px-2.5 py-1">{product.category}</span>}
          <span className="rounded-full bg-[#f4f6fb] px-2.5 py-1">{product.createdAt}</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onOptimize(); }} disabled={optimizing} className="flex items-center gap-1 rounded-xl bg-[#eef4ff] px-3 py-2 text-xs font-bold text-[#2f6fe4] disabled:opacity-60">
            {optimizing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
            优化标题
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} className="rounded-xl bg-[#f6f9ff] px-3 py-2 text-xs font-bold text-[#667085]">编辑</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
        </div>
        <select value={product.status} onClick={e => e.stopPropagation()} onChange={e => onStatus(e.target.value as ProductStatus)} className="mt-3 h-9 w-full rounded-xl bg-[#f6f9ff] px-3 text-xs text-[#667085] outline-none">
          <option>考虑中</option><option>已选</option><option>已放弃</option>
        </select>
      </div>
    </article>
  );
}

function ProductInspector({
  product,
  optimizing,
  onOptimize,
  onProcessedMain,
  onProcessedDetails,
  onUploadMain,
  onUploadDetails,
  onCopyListing,
  onDownloadZip,
}: {
  product?: Product;
  optimizing: boolean;
  onOptimize: (product: Product) => void;
  onProcessedMain: (product: Product, file: File) => void;
  onProcessedDetails: (product: Product, files: FileList) => void;
  onUpdate: (id: number, patch: Partial<Product>) => void;
  onUploadMain: (product: Product) => void;
  onUploadDetails: (product: Product) => void;
  onCopyListing: (product: Product) => void;
  onDownloadZip: (product: Product) => void;
}) {
  if (!product) {
    return (
      <aside className="rounded-[30px] border border-white/80 bg-white p-6 shadow-xl shadow-blue-100/50">
        <div className="flex h-full min-h-[520px] flex-col items-center justify-center text-center text-sm text-[#98a2b3]">
          <PackagePlus className="mb-3" size={38} />
          导入或选择一个商品后，这里会显示详情和标题优化结果。
        </div>
      </aside>
    );
  }

  return (
    <aside className="sticky top-8 h-[calc(100vh-64px)] overflow-y-auto rounded-[30px] border border-white/80 bg-white p-6 shadow-xl shadow-blue-100/50">
      <div className="mb-5 overflow-hidden rounded-[24px] bg-[#eef4ff]">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-64 w-full object-cover" /> : <div className="flex h-64 items-center justify-center text-[#98a2b3]"><ImageIcon size={42} /></div>}
      </div>
      <h2 className="text-xl font-black leading-snug">{product.name}</h2>
      {product.url && <a href={product.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-2xl bg-[#f6f9ff] px-3 py-2 text-xs font-bold text-[#2f6fe4]"><LinkIcon size={14} />查看原链接<ExternalLink size={13} /></a>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={() => onCopyListing(product)} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#101828] text-sm font-black text-white">
          <Copy size={16} />
          复制上架资料
        </button>
        <button onClick={() => onDownloadZip(product)} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#eef4ff] text-sm font-black text-[#2f6fe4]">
          <Download size={16} />
          下载素材包
        </button>
      </div>
      <div className="mt-5 rounded-3xl bg-[#eef4ff] p-4">
        <div className="mb-3 text-sm font-black">GPT 原图链接</div>
        <div className="grid gap-2">
          <button onClick={() => onUploadMain(product)} className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#2f6fe4] text-sm font-black text-white">
            <Upload size={16} />
            上传主图给 GPT
          </button>
          <button onClick={() => onUploadDetails(product)} className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#2f6fe4] ring-1 ring-[#dbe8fb]">
            <Upload size={16} />
            上传详情图给 GPT
          </button>
        </div>
        {product.githubMainImage && (
          <button onClick={() => navigator.clipboard.writeText(product.githubMainImage || '')} className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left text-xs font-bold text-[#667085]">
            <Copy size={13} />
            <span className="truncate">{product.githubMainImage}</span>
          </button>
        )}
        {product.githubDetailImages && product.githubDetailImages.length > 0 && (
          <button onClick={() => navigator.clipboard.writeText((product.githubDetailImages || []).join('\n'))} className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left text-xs font-bold text-[#667085]">
            <Copy size={13} />
            已上传 {product.githubDetailImages.length} 张详情图，点击复制链接
          </button>
        )}
      </div>
      <div className="mt-5 rounded-3xl bg-[#f6f9ff] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-black"><Tag size={16} />详情摘要</div>
        <p className="text-sm leading-6 text-[#667085]">{product.detailText || product.notes || '暂无详情摘要'}</p>
      </div>
      {product.imageUrl && (
        <button onClick={() => navigator.clipboard.writeText(product.imageUrl || '')} className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-[#f6f9ff] px-3 py-2 text-left text-xs font-bold text-[#667085]">
          <Copy size={13} />
          <span className="truncate">复制原主图链接：{product.imageUrl}</span>
        </button>
      )}
      {product.detailImages && product.detailImages.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-black">详情图</div>
            <button onClick={() => navigator.clipboard.writeText((product.detailImages || []).join('\n'))} className="text-xs font-bold text-[#2f6fe4]">复制全部链接</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {product.detailImages.slice(0, 9).map(image => <img key={image} src={image} alt="" className="aspect-square rounded-2xl object-cover" />)}
          </div>
        </div>
      )}
      <button onClick={() => onOptimize(product)} disabled={optimizing} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#2f6fe4] text-sm font-black text-white disabled:opacity-60">
        {optimizing ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
        AI 优化淘宝标题
      </button>
      <div className="mt-5 rounded-3xl bg-[#f6f9ff] p-4">
        <div className="mb-3 text-sm font-black">加工后素材</div>
        <label className="mb-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#2f6fe4] ring-1 ring-[#dbe8fb]">
          <Upload size={16} />
          上传加工后主图
          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onProcessedMain(product, e.target.files[0])} />
        </label>
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#2f6fe4] ring-1 ring-[#dbe8fb]">
          <Upload size={16} />
          上传加工后详情图
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && onProcessedDetails(product, e.target.files)} />
        </label>
        {product.processedMainImage && <img src={product.processedMainImage} alt="加工后主图" className="mt-3 aspect-square w-full rounded-2xl object-cover" />}
        {product.processedDetailImages && product.processedDetailImages.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {product.processedDetailImages.map(image => <img key={image} src={image} alt="" className="aspect-square rounded-2xl object-cover" />)}
          </div>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {(product.optimizedTitles || []).map((title, index) => (
          <div key={`${title}-${index}`} className="rounded-2xl border border-[#e5edfb] bg-[#fbfdff] p-3">
            <div className="mb-2 text-xs font-bold text-[#2f6fe4]">版本 {index + 1}</div>
            <div className="text-sm font-bold leading-6">{title}</div>
            <button onClick={() => navigator.clipboard.writeText(title)} className="mt-2 flex items-center gap-1 text-xs font-bold text-[#667085]"><Copy size={13} />复制</button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function TrendBoard({ platform, items, formatHot, onAnalyze }: { platform: string; items: TrendItem[]; formatHot: (value: string) => string; onAnalyze: (keyword: string) => void }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#e1e9f6] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eef3fa] px-4 py-3">
        <div>
          <h3 className="font-black">{platform}</h3>
          <p className="text-xs text-[#98a2b3]">{items.length} 条热点</p>
        </div>
        <Flame className="text-[#2f6fe4]" size={18} />
      </div>
      <div className="max-h-[640px] overflow-y-auto">
        {items.map(item => (
          <button key={`${platform}-${item.rank}`} onClick={() => onAnalyze(item.title)} className="group flex min-h-[62px] w-full items-center gap-3 border-b border-[#f1f5fb] px-4 py-3 text-left last:border-b-0 hover:bg-[#f7faff]">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${item.rank <= 3 ? 'bg-[#2f6fe4] text-white' : 'bg-[#eef4ff] text-[#667085]'}`}>{item.rank}</span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-bold leading-snug">{item.title}</span>
              {item.hotValue && <span className="mt-1 block text-xs text-[#98a2b3]">{formatHot(item.hotValue)}</span>}
            </span>
            <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[11px] font-bold text-[#2f6fe4] opacity-0 transition group-hover:opacity-100">分析</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

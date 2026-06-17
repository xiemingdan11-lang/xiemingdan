"use client";

import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Folder,
  ImageIcon,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type LiveRoom = {
  id: string;
  name: string;
  url: string;
  publishTime: string;
  enabled: boolean;
  notes: string;
  createdAt: string;
  lastRunAt?: string;
};

type LiveShot = {
  id: string;
  roomId: string;
  roomName: string;
  imageUrl: string;
  pageUrl: string;
  status: "published" | "failed";
  capturedAt: string;
  message?: string;
  keyword?: string;
};

type ShotGroup = { key: string; label: string; shots: LiveShot[] };
type SkillKey = "full" | "simplified";

const ALL_GROUP = "__all__";
const SEARCH_CAPTURE_LIMIT = 4;
const LS_API_KEY = "deepseek_api_key";

const SKILLS: Record<SkillKey, { label: string; desc: string }> = {
  full: { label: "反推-完整版", desc: "含镜头构图分析" },
  simplified: { label: "反推-简化版", desc: "适用于豆包/可灵" }
};

const emptyRoom = (): LiveRoom => ({
  id: `room-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
  name: "新直播间",
  url: "",
  publishTime: "09:30",
  enabled: false,
  notes: "",
  createdAt: new Date().toISOString()
});

export default function HomePage() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [shots, setShots] = useState<LiveShot[]>([]);
  const [activeGroup, setActiveGroup] = useState(ALL_GROUP);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [agentingId, setAgentingId] = useState("");
  const [toast, setToast] = useState("");
  const [lastTask, setLastTask] = useState("");

  // ── Analysis modal ──────────────────────────────────────────────────────────
  const [selectedShot, setSelectedShot] = useState<LiveShot | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiInput, setShowApiInput] = useState(false);
  const [activeSkill, setActiveSkill] = useState<SkillKey | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [copied, setCopied] = useState(false);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];
  const publishedShots = useMemo(() => shots.filter((shot) => shot.status === "published"), [shots]);
  const failedCount = useMemo(() => shots.filter((shot) => shot.status === "failed").length, [shots]);
  const groups = useMemo(() => groupShots(publishedShots), [publishedShots]);
  const visibleGroups = activeGroup === ALL_GROUP ? groups : groups.filter((group) => group.key === activeGroup);
  const visibleShots = visibleGroups.flatMap((group) => group.shots);

  useEffect(() => {
    refresh();
    const saved = typeof window !== "undefined" ? localStorage.getItem(LS_API_KEY) || "" : "";
    setApiKey(saved);
  }, []);

  useEffect(() => {
    if (!activeRoomId && rooms[0]) setActiveRoomId(rooms[0].id);
  }, [activeRoomId, rooms]);

  // Close modal on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedShot(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/live/rooms", { cache: "no-store" });
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setShots(data.shots ?? []);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const searchLives = async () => {
    const term = keyword.trim();
    if (!term) return showToast("请输入关键词");
    setSearching(true);
    try {
      const res = await fetch("/api/live/agent/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "search-capture", keyword: term, limit: SEARCH_CAPTURE_LIMIT })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return showToast(data.error || "发送失败，请重试");
      setActiveGroup(term);
      setLastTask(`已发送「${term}」竖版截图任务，默认抓取 ${SEARCH_CAPTURE_LIMIT} 个相关直播间。`);
      showToast("任务已发送给共享电脑");
      window.setTimeout(refresh, 5000);
    } finally {
      setSearching(false);
    }
  };

  const queueAgentCapture = async (roomId: string) => {
    setAgentingId(roomId);
    try {
      const res = await fetch("/api/live/agent/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "capture-room", roomId })
      });
      const data = await res.json().catch(() => ({}));
      showToast(res.ok ? "已通知共享电脑截图" : data.error || "通知共享电脑失败");
      if (res.ok) window.setTimeout(refresh, 5000);
    } finally {
      setAgentingId("");
    }
  };

  const saveRooms = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/live/rooms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return showToast(data.error || "保存失败");
      setRooms(data.rooms);
      showToast("已保存");
    } finally {
      setSaving(false);
    }
  };

  const deleteShot = async (shotId: string) => {
    if (!window.confirm("删除这张截图吗？")) return;
    const res = await fetch("/api/live/shots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || "删除失败");
    setShots((current) => current.filter((shot) => shot.id !== shotId));
    showToast("已删除截图");
  };

  const deleteGroup = async (groupKey: string) => {
    const label = groupKey === ALL_GROUP ? "全部截图" : `「${groupKey}」分类`;
    if (!window.confirm(`清空${label}吗？`)) return;
    const res = await fetch("/api/live/shots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groupKey === ALL_GROUP ? { all: true } : { keyword: groupKey })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || "删除失败");
    if (groupKey === ALL_GROUP) {
      setShots((current) => current.filter((shot) => shot.status !== "published"));
    } else {
      setShots((current) => current.filter((shot) => inferKeyword(shot) !== groupKey));
      setActiveGroup(ALL_GROUP);
    }
    showToast(`已删除 ${data.deleted ?? 0} 张截图`);
    await refresh();
  };

  const addRoom = () => {
    const room = emptyRoom();
    setRooms((current) => [room, ...current]);
    setActiveRoomId(room.id);
  };

  const patchRoom = (id: string, patch: Partial<LiveRoom>) => {
    setRooms((current) => current.map((room) => (room.id === id ? { ...room, ...patch } : room)));
  };

  const removeRoom = (id: string) => {
    const next = rooms.filter((room) => room.id !== id);
    setRooms(next);
    if (activeRoomId === id) setActiveRoomId(next[0]?.id ?? "");
  };

  const openAnalysis = (shot: LiveShot) => {
    setSelectedShot(shot);
    setAnalysisResult("");
    setCopied(false);
    setAnalyzing(false);
  };

  const runAnalysis = async () => {
    if (!selectedShot) return;
    if (!apiKey.trim()) { setShowApiInput(true); showToast("请先设置 DeepSeek API Key"); return; }
    setAnalyzing(true);
    setAnalysisResult("");
    try {
      const res = await fetch("/api/live/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: selectedShot.imageUrl, skill: activeSkill, apiKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) { showToast(data.error || "分析失败，请重试"); return; }
      setAnalysisResult(data.content || "");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveApiKey = (value: string) => {
    setApiKey(value);
    if (typeof window !== "undefined") {
      if (value) localStorage.setItem(LS_API_KEY, value);
      else localStorage.removeItem(LS_API_KEY);
    }
  };

  const copyResult = async () => {
    if (!analysisResult) return;
    await navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const toggleSkill = (key: SkillKey) => setActiveSkill((prev) => (prev === key ? null : key));

  return (
    <main className="min-h-screen bg-[#e7e7e4] text-[#111111]">
      <header className="border-b border-black/10 bg-[#eeeeeb]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1640px] items-center justify-between gap-5 px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#111111] text-[#66e99a]">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-black/55">Live Capture Library</div>
              <h1 className="text-xl font-semibold tracking-[-0.03em]">直播竖版截图库</h1>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-xs font-medium text-black/55 md:flex">
            <span>{groups.length} 个分类</span>
            <span>{publishedShots.length} 张竖版图</span>
            <span>{failedCount} 次失败</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ActionButton icon={RefreshCw} label="刷新" onClick={refresh} />
            <ActionButton icon={Plus} label="新增直播间" onClick={addRoom} />
            <ActionButton icon={Save} label={saving ? "保存中" : "保存"} onClick={saveRooms} dark />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1640px] px-8 py-8">
        <section className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[28px] bg-[#111111] p-6 text-white shadow-[0_28px_70px_rgba(0,0,0,0.22)]">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[720px]">
                <div className="mb-4 inline-flex rounded-full border border-white/18 px-3 py-1 text-xs text-white/72">SCREENSHOT BOARD</div>
                <h2 className="max-w-[760px] text-5xl font-semibold leading-[0.94] tracking-[-0.07em] md:text-7xl">
                  Capture live rooms into polished portrait cards
                </h2>
              </div>
              <div className="grid min-w-[240px] grid-cols-3 overflow-hidden rounded-[22px] border border-white/10">
                <Stat label="分类" value={groups.length} />
                <Stat label="截图" value={publishedShots.length} />
                <Stat label="失败" value={failedCount} />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/38">Quick Capture</div>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">抓取多个直播间</h3>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#64e994] text-black">
                <Search className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && searchLives()}
                  placeholder="例如：好奇"
                  className="h-12 rounded-full border border-black/10 bg-[#f4f4f1] px-5 text-sm outline-none transition placeholder:text-black/35 focus:border-black/30"
                />
                <ActionButton icon={searching ? Loader2 : Search} label={searching ? "发送中" : "抓取"} onClick={searchLives} dark />
              </div>
              {activeRoom && (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select value={activeRoom.id} onChange={(event) => setActiveRoomId(event.target.value)} className="h-12 rounded-full border border-black/10 bg-[#f4f4f1] px-5 text-sm outline-none transition focus:border-black/30">
                    {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                  </select>
                  <ActionButton icon={agentingId === activeRoom.id ? Loader2 : Radio} label={agentingId === activeRoom.id ? "通知中" : "固定截图"} onClick={() => queueAgentCapture(activeRoom.id)} />
                </div>
              )}
              {lastTask && <div className="rounded-2xl bg-[#64e994] px-4 py-3 text-sm font-medium text-black">{lastTask}</div>}
            </div>
          </div>
        </section>

        <div className="my-8 flex flex-wrap items-center gap-2">
          <GroupPill label="全部" count={publishedShots.length} active={activeGroup === ALL_GROUP} onClick={() => setActiveGroup(ALL_GROUP)} />
          {groups.map((group) => (
            <GroupPill key={group.key} label={group.label} count={group.shots.length} active={activeGroup === group.key} onClick={() => setActiveGroup(group.key)} />
          ))}
          <div className="flex-1" />
          {visibleShots.length > 0 && (
            <button onClick={() => deleteGroup(activeGroup)} className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black transition hover:bg-[#111111] hover:text-white">
              <Trash2 className="h-4 w-4" />
              {activeGroup === ALL_GROUP ? "清空全部" : "清空分类"}
            </button>
          )}
        </div>

        {visibleShots.length ? (
          <section className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-7">
            {visibleShots.map((shot, index) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                index={index}
                onDelete={() => deleteShot(shot.id)}
                onAnalyze={() => openAnalysis(shot)}
              />
            ))}
          </section>
        ) : (
          <section className="grid min-h-[520px] place-items-center rounded-[32px] border border-black/10 bg-white text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div>
              <ImageIcon className="mx-auto h-10 w-10 text-black/30" />
              <div className="mt-4 text-2xl font-semibold tracking-[-0.04em]">暂无竖版截图</div>
              <div className="mt-2 text-sm text-black/52">输入关键词后，共享电脑会进入直播间并上传 9:16 截图。</div>
            </div>
          </section>
        )}

        {activeRoom && (
          <section className="mt-8 rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.07)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/38">Room Settings</div>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">固定直播间设置</h3>
              </div>
              <button onClick={() => removeRoom(activeRoom.id)} className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-[#f4f4f1] text-black transition hover:bg-[#111111] hover:text-white">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="名称" value={activeRoom.name} onChange={(value) => patchRoom(activeRoom.id, { name: value })} />
              <Field label="直播间链接" value={activeRoom.url} onChange={(value) => patchRoom(activeRoom.id, { url: value })} />
              <Field label="发布时间" type="time" value={activeRoom.publishTime} onChange={(value) => patchRoom(activeRoom.id, { publishTime: value })} />
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/42">启用</span>
                <button onClick={() => patchRoom(activeRoom.id, { enabled: !activeRoom.enabled })} className={`h-12 w-full rounded-full border text-sm font-semibold transition ${activeRoom.enabled ? "border-[#64e994] bg-[#64e994] text-black" : "border-black/10 bg-[#f4f4f1] text-black/58"}`}>
                  {activeRoom.enabled ? "开启" : "关闭"}
                </button>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeRoom.url && <a href={activeRoom.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-[#f4f4f1] px-4 text-sm font-medium text-black transition hover:bg-[#111111] hover:text-white"><ExternalLink className="h-4 w-4" />打开直播间</a>}
            </div>
          </section>
        )}
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white shadow-2xl">{toast}</div>}

      {selectedShot && (
        <AnalysisModal
          shot={selectedShot}
          apiKey={apiKey}
          showApiInput={showApiInput}
          activeSkill={activeSkill}
          analyzing={analyzing}
          analysisResult={analysisResult}
          copied={copied}
          onClose={() => setSelectedShot(null)}
          onToggleApiInput={() => setShowApiInput((v) => !v)}
          onSaveApiKey={saveApiKey}
          onToggleSkill={toggleSkill}
          onAnalyze={runAnalysis}
          onCopy={copyResult}
        />
      )}
    </main>
  );
}

// ── Analysis Modal ────────────────────────────────────────────────────────────

function AnalysisModal({
  shot,
  apiKey,
  showApiInput,
  activeSkill,
  analyzing,
  analysisResult,
  copied,
  onClose,
  onToggleApiInput,
  onSaveApiKey,
  onToggleSkill,
  onAnalyze,
  onCopy
}: {
  shot: LiveShot;
  apiKey: string;
  showApiInput: boolean;
  activeSkill: SkillKey | null;
  analyzing: boolean;
  analysisResult: string;
  copied: boolean;
  onClose: () => void;
  onToggleApiInput: () => void;
  onSaveApiKey: (v: string) => void;
  onToggleSkill: (k: SkillKey) => void;
  onAnalyze: () => void;
  onCopy: () => void;
}) {
  const apiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showApiInput) apiInputRef.current?.focus();
  }, [showApiInput]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
        {/* Left: image */}
        <div className="relative flex w-[38%] shrink-0 items-center justify-center bg-[#111111]">
          <div className="h-full w-full">
            <img
              src={shot.imageUrl}
              alt={shot.roomName}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-[#64e994] px-3 py-1 text-xs font-semibold text-black">
            {inferKeyword(shot)}
          </div>
          <a
            href={shot.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-black shadow transition hover:bg-white"
            title="在新标签页打开原图"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Right: analysis panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/8 px-6 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/38">AI Analysis</div>
              <h2 className="mt-0.5 truncate text-lg font-semibold tracking-[-0.04em]">{shot.roomName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleApiInput}
                title="设置 API Key"
                className={`grid h-9 w-9 place-items-center rounded-full border transition ${showApiInput ? "border-[#111111] bg-[#111111] text-white" : "border-black/10 bg-[#f4f4f1] text-black hover:border-black/20"}`}
              >
                <Settings className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-[#f4f4f1] text-black transition hover:bg-[#111111] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {/* API Key input (collapsible) */}
            {showApiInput && (
              <div className="rounded-2xl border border-black/10 bg-[#f7f7f5] p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">DeepSeek API Key</div>
                <div className="flex gap-2">
                  <input
                    ref={apiInputRef}
                    type="password"
                    value={apiKey}
                    onChange={(e) => onSaveApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-10 flex-1 rounded-full border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/30"
                  />
                </div>
                <p className="mt-2 text-xs text-black/38">保存于本地，不会上传。也可在 Vercel 配置 DEEPSEEK_API_KEY 环境变量。</p>
              </div>
            )}

            {/* SKILL toggles */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/42">分析模式（可选）</div>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(SKILLS) as [SkillKey, { label: string; desc: string }][]).map(([key, skill]) => (
                  <button
                    key={key}
                    onClick={() => onToggleSkill(key)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${activeSkill === key ? "border-[#111111] bg-[#111111] text-white" : "border-black/10 bg-[#f4f4f1] text-black hover:border-black/20"}`}
                  >
                    {activeSkill === key && <Check className="h-3.5 w-3.5" />}
                    <span>{skill.label}</span>
                    <span className={`text-xs ${activeSkill === key ? "text-white/60" : "text-black/38"}`}>{skill.desc}</span>
                  </button>
                ))}
                {activeSkill === null && (
                  <span className="flex items-center px-1 text-xs text-black/38">默认：提取生图关键词</span>
                )}
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111111] text-sm font-semibold text-white transition hover:bg-[#222] disabled:opacity-60"
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "分析中…" : "分析直播间"}
            </button>

            {/* Result */}
            {analysisResult && (
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-black/42">分析结果</div>
                  <button
                    onClick={onCopy}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${copied ? "border-[#64e994] bg-[#64e994] text-black" : "border-black/10 bg-white text-black hover:border-black/20"}`}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto rounded-2xl border border-black/8 bg-[#f7f7f5] p-4 text-sm leading-relaxed text-black/80 whitespace-pre-wrap">
                  {analysisResult}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!analysisResult && !analyzing && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-black/35">
                <Sparkles className="h-8 w-8" />
                <div className="text-sm">点击「分析直播间」，AI 将提取画面关键词<br />可搭配 SKILL 获得更详细的提示词</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-white/10 px-4 py-3 last:border-r-0">
      <div className="text-2xl font-semibold tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-xs text-white/45">{label}</div>
    </div>
  );
}

function ShotCard({ shot, index, onDelete, onAnalyze }: { shot: LiveShot; index: number; onDelete: () => void; onAnalyze: () => void }) {
  const dark = index % 5 === 0;
  return (
    <article className={`group overflow-hidden rounded-[30px] p-3 shadow-[0_22px_60px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-1 ${dark ? "bg-[#111111] text-white" : "bg-white text-black"}`}>
      <div className="relative overflow-hidden rounded-[24px] bg-[#dcdcd9]">
        {/* Clickable image → open analysis */}
        <button onClick={onAnalyze} className="block w-full cursor-pointer">
          <div className="aspect-[9/16]">
            <img src={shot.imageUrl} alt={shot.roomName} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </button>
        {/* Hover overlay */}
        <div
          onClick={onAnalyze}
          className="pointer-events-none absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:bg-black/35 group-hover:opacity-100"
        >
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black shadow-lg">
            <Sparkles className="h-4 w-4" />
            分析直播间
          </div>
        </div>
        <div className="absolute left-3 top-3 rounded-full bg-[#64e994] px-3 py-1 text-xs font-semibold text-black">
          {inferKeyword(shot)}
        </div>
        <button onClick={onDelete} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-black opacity-0 shadow-lg transition group-hover:opacity-100">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-end justify-between gap-3 px-2 py-4">
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold tracking-[-0.05em]">{shot.roomName}</div>
          <div className={`mt-2 flex items-center gap-1 text-xs ${dark ? "text-white/48" : "text-black/48"}`}>
            <Clock className="h-3.5 w-3.5" />
            {formatDate(shot.capturedAt)}
          </div>
        </div>
        <a href={shot.imageUrl} target="_blank" rel="noreferrer" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${dark ? "bg-white text-black hover:bg-[#64e994]" : "bg-[#111111] text-white hover:bg-[#64e994] hover:text-black"}`}>
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function GroupPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${active ? "border-[#111111] bg-[#111111] text-white" : "border-black/10 bg-white text-black/65 hover:text-black"}`}>
      <Folder className="h-4 w-4" />
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/14" : "bg-black/6"}`}>{count}</span>
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, dark }: { icon: typeof Search; label: string; onClick?: () => void; dark?: boolean }) {
  const spinning = label.includes("中");
  return (
    <button onClick={onClick} className={`inline-flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition ${dark ? "border-[#111111] bg-[#111111] text-white hover:bg-[#64e994] hover:text-black" : "border-black/10 bg-white text-black hover:border-black/20"}`}>
      <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-black/42">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-full border border-black/10 bg-[#f4f4f1] px-5 text-sm text-black outline-none transition focus:border-black/30" />
    </label>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupShots(shots: LiveShot[]): ShotGroup[] {
  const buckets = new Map<string, Map<string, LiveShot>>();
  for (const shot of shots) {
    const groupKey = inferKeyword(shot);
    const liveKey = normalizeKey(shot.pageUrl || shot.roomName || shot.roomId);
    const group = buckets.get(groupKey) ?? new Map<string, LiveShot>();
    const previous = group.get(liveKey);
    if (!previous || new Date(shot.capturedAt).getTime() > new Date(previous.capturedAt).getTime()) group.set(liveKey, shot);
    buckets.set(groupKey, group);
  }
  return Array.from(buckets.entries())
    .map(([key, shotMap]) => ({ key, label: key, shots: Array.from(shotMap.values()).sort(sortShotDesc) }))
    .sort((a, b) => sortShotDesc(a.shots[0], b.shots[0]));
}

function inferKeyword(shot: LiveShot) {
  const explicit = shot.keyword?.trim();
  if (explicit) return explicit;
  const match = shot.message?.match(/关键词\s+(.+?)\s+(?:自动|搜索|直播|截图|第)/);
  return match?.[1]?.trim() || "未分类";
}

function normalizeKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function sortShotDesc(a?: LiveShot, b?: LiveShot) {
  return new Date(b?.capturedAt || 0).getTime() - new Date(a?.capturedAt || 0).getTime();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

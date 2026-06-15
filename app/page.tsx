"use client";

import { Camera, CheckCircle2, ExternalLink, Folder, FolderOpen, Loader2, Plus, Radio, RefreshCw, Save, Search, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LiveRoom = {
  id: string;
  name: string;
  url: string;
  publishTime: string;
  enabled: boolean;
  notes: string;
  createdAt: string;
  lastRunAt?: string;
  lastShotId?: string;
  lastError?: string;
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

const ALL_GROUP = "__all__";

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
  const [activeRoomId, setActiveRoomId] = useState("");
  const [activeGroup, setActiveGroup] = useState(ALL_GROUP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [capturingId, setCapturingId] = useState("");
  const [agentingId, setAgentingId] = useState("");
  const [toast, setToast] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [lastTask, setLastTask] = useState("");

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];
  const publishedShots = useMemo(() => shots.filter((shot) => shot.status === "published"), [shots]);
  const failedShots = useMemo(() => shots.filter((shot) => shot.status === "failed"), [shots]);
  const groups = useMemo(() => groupShots(publishedShots), [publishedShots]);
  const visibleGroups = activeGroup === ALL_GROUP ? groups : groups.filter((group) => group.key === activeGroup);
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.shots.length, 0);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!activeRoomId && rooms[0]) setActiveRoomId(rooms[0].id);
  }, [activeRoomId, rooms]);

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
    await refresh();
    showToast(`已删除 ${data.deleted ?? 0} 张截图`);
  };

  const patchRoom = (id: string, patch: Partial<LiveRoom>) => {
    setRooms((current) => current.map((room) => (room.id === id ? { ...room, ...patch } : room)));
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
    } finally {
      setAgentingId("");
    }
  };

  const capture = async (roomId: string) => {
    setCapturingId(roomId);
    try {
      const res = await fetch("/api/live/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId })
      });
      const data = await res.json().catch(() => ({}));
      showToast(res.ok ? "截图已发布" : data.error || "截图失败");
      await refresh();
    } finally {
      setCapturingId("");
    }
  };

  const searchLives = async () => {
    const term = keyword.trim();
    if (!term) return showToast("请输入关键词");
    setSearching(true);
    try {
      const res = await fetch("/api/live/agent/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "search-capture", keyword: term, limit: 1 })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return showToast(data.error || "通知共享电脑失败");
      setActiveGroup(term);
      setLastTask(`已发送「${term}」任务：只抓 1 个直播间，且同直播间只保留最新 1 张。`);
      showToast("已发送单直播间截图任务");
      window.setTimeout(refresh, 7000);
    } finally {
      setSearching(false);
    }
  };

  const addRoom = () => {
    const room = emptyRoom();
    setRooms((current) => [room, ...current]);
    setActiveRoomId(room.id);
  };

  const removeRoom = (id: string) => {
    const next = rooms.filter((room) => room.id !== id);
    setRooms(next);
    if (activeRoomId === id) setActiveRoomId(next[0]?.id ?? "");
  };

  return (
    <main className="min-h-screen bg-[#0b0d10] text-[#f7f7f2]">
      <header className="border-b border-white/10 bg-[#11151a]">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#40c9a2]/35 bg-[#13231f] text-[#40c9a2]">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">直播间截图素材库</h1>
              <div className="mt-1 flex gap-3 text-xs text-[#a8b0bb]">
                <span>{groups.length} 个分类</span>
                <span>{publishedShots.length} 张有效图</span>
                <span>{failedShots.length} 条失败</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton icon={RefreshCw} label="刷新" onClick={refresh} />
            <IconButton icon={Plus} label="新增直播间" onClick={addRoom} />
            <IconButton icon={Save} label={saving ? "保存中" : "保存"} onClick={saveRooms} primary />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1700px] grid-cols-[280px_minmax(0,1fr)_390px] gap-4 px-5 py-4">
        <aside className="min-h-[calc(100vh-104px)] overflow-hidden rounded-lg border border-white/10 bg-[#15191f]">
          <PanelTitle title="分类" loading={loading} />
          <div className="space-y-2 p-3">
            <GroupButton label="全部" count={publishedShots.length} active={activeGroup === ALL_GROUP} onClick={() => setActiveGroup(ALL_GROUP)} />
            {groups.map((group) => (
              <GroupButton key={group.key} label={group.label} count={group.shots.length} active={activeGroup === group.key} onClick={() => setActiveGroup(group.key)} />
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-[#15191f]">
          <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
            <div className="text-sm font-semibold text-[#d9dde5]">{activeGroup === ALL_GROUP ? "全部截图" : activeGroup}</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[#a8b0bb]">当前显示 {visibleCount} 张</div>
              {visibleCount > 0 && (
                <button onClick={() => deleteGroup(activeGroup)} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#e85d75]/35 bg-[#2b151b] px-2 text-xs text-[#ff9aae] hover:bg-[#3a1b23]">
                  <Trash2 className="h-3.5 w-3.5" />
                  {activeGroup === ALL_GROUP ? "清空全部" : "清空分类"}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[calc(100vh-156px)] overflow-auto bg-[#0f1216] p-4">
            {visibleGroups.length ? (
              <div className="space-y-5">
                {visibleGroups.map((group) => (
                  <section key={group.key} className="rounded-lg border border-white/10 bg-[#15191f]">
                    <div className="flex h-11 items-center justify-between border-b border-white/10 px-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <FolderOpen className="h-4 w-4 shrink-0 text-[#40c9a2]" />
                        <h2 className="truncate text-sm font-semibold">{group.label}</h2>
                      </div>
                      <span className="text-xs text-[#a8b0bb]">{group.shots.length} 张</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
                      {group.shots.map((shot) => <ShotCard key={shot.id} shot={shot} onDelete={() => deleteShot(shot.id)} />)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid h-[520px] place-items-center rounded-lg border border-dashed border-white/15 text-sm text-[#a8b0bb]">暂无截图</div>
            )}
          </div>
        </section>

        <aside className="space-y-4 overflow-auto">
          <div className="rounded-lg border border-white/10 bg-[#15191f] p-4">
            <div className="mb-3 text-sm font-semibold text-[#d9dde5]">抓取一个直播间</div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchLives()} placeholder="例如：好奇" className="h-10 rounded-md border border-white/10 bg-[#101319] px-3 text-sm text-white outline-none transition placeholder:text-[#6f7887] focus:border-[#40c9a2]/60" />
              <IconButton icon={searching ? Loader2 : Search} label={searching ? "发送中" : "抓取"} onClick={searchLives} primary />
            </div>
            {lastTask && <div className="mt-3 rounded-md border border-white/10 bg-[#101319] p-3 text-sm leading-6 text-[#d9dde5]">{lastTask}</div>}
          </div>

          {activeRoom && (
            <div className="rounded-lg border border-white/10 bg-[#15191f] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#d9dde5]">固定直播间</div>
                <button onClick={() => removeRoom(activeRoom.id)} className="grid h-8 w-8 place-items-center rounded-md border border-[#e85d75]/30 bg-[#2b151b] text-[#ff8fa1] transition hover:bg-[#3a1b23]" title="删除直播间">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <select value={activeRoom.id} onChange={(event) => setActiveRoomId(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#101319] px-3 text-sm text-white outline-none transition focus:border-[#40c9a2]/60">
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
                <Field label="名称" value={activeRoom.name} onChange={(value) => patchRoom(activeRoom.id, { name: value })} />
                <Field label="直播间链接" value={activeRoom.url} onChange={(value) => patchRoom(activeRoom.id, { url: value })} />
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Field label="发布时间" type="time" value={activeRoom.publishTime} onChange={(value) => patchRoom(activeRoom.id, { publishTime: value })} />
                  <label className="flex min-w-[96px] flex-col gap-1">
                    <span className="text-xs font-medium text-[#a8b0bb]">启用</span>
                    <button onClick={() => patchRoom(activeRoom.id, { enabled: !activeRoom.enabled })} className={`h-10 rounded-md border text-sm font-medium transition ${activeRoom.enabled ? "border-[#40c9a2]/50 bg-[#18352d] text-[#7fe3c8]" : "border-white/10 bg-[#101319] text-[#a8b0bb]"}`}>
                      {activeRoom.enabled ? "开启" : "关闭"}
                    </button>
                  </label>
                </div>
                <Field label="备注" value={activeRoom.notes} onChange={(value) => patchRoom(activeRoom.id, { notes: value })} textarea />
                <div className="flex flex-wrap gap-2">
                  {activeRoom.url && <a href={activeRoom.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-[#d9dde5] transition hover:bg-white/[0.06]"><ExternalLink className="h-4 w-4" />打开</a>}
                  <IconButton icon={agentingId === activeRoom.id ? Loader2 : Radio} label={agentingId === activeRoom.id ? "通知中" : "共享截图"} onClick={() => queueAgentCapture(activeRoom.id)} primary />
                  <IconButton icon={capturingId === activeRoom.id ? Loader2 : Camera} label={capturingId === activeRoom.id ? "截图中" : "服务器截图"} onClick={() => capture(activeRoom.id)} />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-[#15191f]">
            <PanelTitle title="失败/跳过记录" />
            <div className="max-h-72 overflow-auto p-3">
              {failedShots.length ? failedShots.map((shot) => <div key={shot.id} className="mb-2 rounded-md border border-[#e85d75]/25 bg-[#251419] p-3 text-xs leading-5 text-[#ffbac5]"><div className="flex justify-between gap-2"><span className="truncate">{shot.roomName}</span><XCircle className="h-4 w-4 shrink-0" /></div><div className="mt-1 text-[#ffd3da]">{shot.message}</div></div>) : <div className="grid h-24 place-items-center text-sm text-[#a8b0bb]">暂无失败记录</div>}
            </div>
          </div>
        </aside>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-[#20262f] px-4 py-2 text-sm shadow-2xl">{toast}</div>}
    </main>
  );
}

function PanelTitle({ title, loading }: { title: string; loading?: boolean }) {
  return <div className="flex h-12 items-center justify-between border-b border-white/10 px-4"><div className="text-sm font-semibold text-[#d9dde5]">{title}</div>{loading && <Loader2 className="h-4 w-4 animate-spin text-[#40c9a2]" />}</div>;
}

function GroupButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-md border px-3 py-3 text-left transition ${active ? "border-[#40c9a2]/45 bg-[#24342f]" : "border-white/10 bg-[#101319] hover:bg-white/[0.05]"}`}><span className="flex min-w-0 items-center gap-2">{active ? <FolderOpen className="h-4 w-4 text-[#40c9a2]" /> : <Folder className="h-4 w-4 text-[#a8b0bb]" />}<span className="truncate text-sm font-medium">{label}</span></span><span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[#a8b0bb]">{count}</span></button>;
}

function ShotCard({ shot, onDelete }: { shot: LiveShot; onDelete: () => void }) {
  return <div className="grid grid-cols-[190px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#101319] transition hover:border-[#40c9a2]/45"><a href={shot.imageUrl} target="_blank" rel="noreferrer" className="aspect-video bg-black"><img src={shot.imageUrl} alt={shot.roomName} loading="lazy" className="h-full w-full object-contain" /></a><div className="min-w-0 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-semibold text-[#eef2f7]">{shot.roomName}</div><div className="mt-1 text-xs text-[#a8b0bb]">{formatDate(shot.capturedAt)}</div></div><button onClick={onDelete} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#e85d75]/30 bg-[#2b151b] text-[#ff8fa1] hover:bg-[#3a1b23]" title="删除截图"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 line-clamp-2 text-xs leading-5 text-[#a8b0bb]">{shot.message || "直播间截图"}</div><CheckCircle2 className="mt-3 h-4 w-4 text-[#40c9a2]" /></div></div>;
}

function IconButton({ icon: Icon, label, onClick, primary }: { icon: typeof Camera; label: string; onClick?: () => void; primary?: boolean }) {
  const spinning = label.includes("中");
  return <button onClick={onClick} className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition ${primary ? "border-[#40c9a2]/45 bg-[#167a64] text-white hover:bg-[#1b8d75]" : "border-white/10 bg-[#171d24] text-[#d9dde5] hover:bg-white/[0.07]"}`}><Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} /><span>{label}</span></button>;
}

function Field({ label, value, onChange, textarea, type = "text" }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean; type?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-[#a8b0bb]">{label}</span>{textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full resize-none rounded-md border border-white/10 bg-[#101319] px-3 py-2 text-sm leading-5 text-white outline-none transition focus:border-[#40c9a2]/60" /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#101319] px-3 text-sm text-white outline-none transition focus:border-[#40c9a2]/60" />}</label>;
}

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
  return Array.from(buckets.entries()).map(([key, shotMap]) => ({ key, label: key, shots: Array.from(shotMap.values()).sort(sortShotDesc) })).sort((a, b) => sortShotDesc(a.shots[0], b.shots[0]));
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

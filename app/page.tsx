"use client";

import {
  Clock,
  ExternalLink,
  Folder,
  ImageIcon,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Trash2
} from "lucide-react";
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

const GLOBAL_CSS = `
  :root {
    --bg-0: #020409;
    --bg-1: #05080d;
    --bg-2: #07111c;
    --bg-3: #0a1018;
    --bg-4: #0d1824;
    --ambient-rgb: 68, 112, 145;
    --ambient-soft: rgba(68, 112, 145, 0.22);
    --ambient-glow: rgba(88, 145, 190, 0.28);
    --glass: rgba(255, 255, 255, 0.055);
    --glass-strong: rgba(255, 255, 255, 0.075);
    --glass-border: rgba(190, 220, 255, 0.14);
    --glass-border-active: rgba(180, 215, 255, 0.32);
    --text-main: #eef6ff;
    --text-sub: rgba(238, 246, 255, 0.58);
  }
  .ambient-page {
    background:
      radial-gradient(circle at 50% 35%, rgba(var(--ambient-rgb), 0.20), transparent 36%),
      radial-gradient(circle at 20% 80%, rgba(var(--ambient-rgb), 0.10), transparent 32%),
      radial-gradient(circle at 80% 70%, rgba(var(--ambient-rgb), 0.08), transparent 34%),
      linear-gradient(180deg, #05070b 0%, #07101a 45%, #020409 100%);
  }
  .ambient-panel {
    background: var(--glass);
    border: 1px solid var(--glass-border);
    box-shadow:
      0 28px 90px rgba(0, 0, 0, 0.42),
      inset 0 0 30px rgba(255, 255, 255, 0.035);
    backdrop-filter: blur(20px) saturate(1.2);
  }
  .ambient-button {
    background: rgba(110, 150, 200, 0.16);
    border: 1px solid rgba(180, 215, 255, 0.18);
    box-shadow: 0 0 24px rgba(100, 160, 220, 0.16), inset 0 1px 0 rgba(255,255,255,0.08);
    color: var(--text-main);
    transition: background .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease;
  }
  .ambient-button:hover {
    background: rgba(110, 150, 200, 0.23);
    border-color: rgba(180, 215, 255, 0.30);
    box-shadow: 0 0 34px rgba(100, 160, 220, 0.22), inset 0 1px 0 rgba(255,255,255,0.12);
    transform: translateY(-1px);
  }
  .ambient-button:disabled {
    opacity: .48;
    cursor: not-allowed;
    transform: none;
  }
  .shot-card {
    --card-rgb: 68, 112, 145;
    background: rgba(255, 255, 255, 0.052);
    border: 1px solid rgba(180, 215, 255, 0.16);
    box-shadow:
      0 28px 90px rgba(0, 0, 0, 0.65),
      0 0 70px rgba(var(--card-rgb), 0.14),
      inset 0 0 30px rgba(255, 255, 255, 0.05);
    transition: border-color .22s ease, box-shadow .22s ease, transform .22s ease;
  }
  .shot-card:hover {
    border-color: rgba(180, 215, 255, 0.32);
    box-shadow:
      0 32px 100px rgba(0, 0, 0, 0.68),
      0 0 78px rgba(var(--card-rgb), 0.22),
      inset 0 0 30px rgba(255, 255, 255, 0.055);
    transform: translateY(-3px);
  }
`;

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

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];
  const publishedShots = useMemo(() => shots.filter((shot) => shot.status === "published"), [shots]);
  const failedCount = useMemo(() => shots.filter((shot) => shot.status === "failed").length, [shots]);
  const groups = useMemo(() => groupShots(publishedShots), [publishedShots]);
  const visibleGroups = activeGroup === ALL_GROUP ? groups : groups.filter((group) => group.key === activeGroup);
  const visibleShots = visibleGroups.flatMap((group) => group.shots);

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
      if (!res.ok) return showToast(data.error || "发送失败，请重试");
      setActiveGroup(term);
      setLastTask(`已发送「${term}」竖版截图任务，只抓 1 个直播间。`);
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

  return (
    <main className="ambient-page min-h-screen text-[var(--text-main)]">
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      <header className="sticky top-0 z-30 border-b border-[rgba(190,220,255,0.10)] bg-[rgba(2,4,9,0.72)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-5 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-[rgba(180,215,255,0.16)] bg-[rgba(255,255,255,0.055)] text-[rgba(190,225,255,0.82)] shadow-[0_0_32px_rgba(88,145,190,0.14)]">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">直播竖版截图库</h1>
              <div className="mt-1 flex gap-3 text-xs text-[var(--text-sub)]">
                <span>{groups.length} 个分类</span>
                <span>{publishedShots.length} 张竖版图</span>
                <span>{failedCount} 次失败</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ActionButton icon={RefreshCw} label="刷新" onClick={refresh} />
            <ActionButton icon={Plus} label="新增直播间" onClick={addRoom} />
            <ActionButton icon={Save} label={saving ? "保存中" : "保存"} onClick={saveRooms} primary />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1680px] px-6 py-6">
        <section className="ambient-panel mb-5 rounded-xl p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-[260px] flex-1">
              <span className="mb-2 block text-xs font-medium text-[var(--text-sub)]">关键词抓取一个直播间</span>
              <div className="flex gap-2">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && searchLives()}
                  placeholder="例如：好奇"
                  className="h-11 flex-1 rounded-lg border border-[rgba(180,215,255,0.16)] bg-[rgba(2,4,9,0.58)] px-3 text-sm text-[var(--text-main)] outline-none transition placeholder:text-[rgba(238,246,255,0.32)] focus:border-[rgba(180,215,255,0.32)]"
                />
                <ActionButton icon={searching ? Loader2 : Search} label={searching ? "发送中" : "抓取"} onClick={searchLives} primary />
              </div>
            </label>
            {activeRoom && (
              <div className="grid min-w-[300px] flex-1 grid-cols-[1fr_auto] gap-2">
                <select value={activeRoom.id} onChange={(event) => setActiveRoomId(event.target.value)} className="h-11 rounded-lg border border-[rgba(180,215,255,0.16)] bg-[#05080d] px-3 text-sm text-[var(--text-main)] outline-none transition focus:border-[rgba(180,215,255,0.32)]">
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
                <ActionButton icon={agentingId === activeRoom.id ? Loader2 : Radio} label={agentingId === activeRoom.id ? "通知中" : "固定截图"} onClick={() => queueAgentCapture(activeRoom.id)} />
              </div>
            )}
          </div>
          {lastTask && <div className="mt-3 rounded-lg border border-[rgba(180,215,255,0.16)] bg-[rgba(2,4,9,0.45)] px-3 py-2 text-sm text-[var(--text-main)]">{lastTask}</div>}
        </section>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <GroupPill label="全部" count={publishedShots.length} active={activeGroup === ALL_GROUP} onClick={() => setActiveGroup(ALL_GROUP)} />
          {groups.map((group) => (
            <GroupPill key={group.key} label={group.label} count={group.shots.length} active={activeGroup === group.key} onClick={() => setActiveGroup(group.key)} />
          ))}
          <div className="flex-1" />
          {visibleShots.length > 0 && (
            <button onClick={() => deleteGroup(activeGroup)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[rgba(220,120,135,0.22)] bg-[rgba(55,18,28,0.44)] px-3 text-sm text-[rgba(255,190,200,0.88)] transition hover:border-[rgba(220,120,135,0.34)] hover:bg-[rgba(70,24,36,0.56)]">
              <Trash2 className="h-4 w-4" />
              {activeGroup === ALL_GROUP ? "清空全部" : "清空分类"}
            </button>
          )}
        </div>

        {visibleShots.length ? (
          <section className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
            {visibleShots.map((shot) => (
              <ShotCard key={shot.id} shot={shot} onDelete={() => deleteShot(shot.id)} />
            ))}
          </section>
        ) : (
          <section className="ambient-panel grid min-h-[520px] place-items-center rounded-xl border-dashed text-center">
            <div>
              <ImageIcon className="mx-auto h-10 w-10 text-[rgba(180,215,255,0.30)]" />
              <div className="mt-3 text-sm font-medium text-[var(--text-main)]">暂无竖版截图</div>
              <div className="mt-1 text-xs text-[var(--text-sub)]">输入关键词后，共享电脑会打开直播间并上传 9:16 截图。</div>
            </div>
          </section>
        )}

        {activeRoom && (
          <section className="ambient-panel mt-6 rounded-xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text-main)]">固定直播间设置</div>
              <button onClick={() => removeRoom(activeRoom.id)} className="grid h-8 w-8 place-items-center rounded-md border border-[rgba(220,120,135,0.22)] bg-[rgba(55,18,28,0.44)] text-[rgba(255,190,200,0.88)] transition hover:border-[rgba(220,120,135,0.34)]">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="名称" value={activeRoom.name} onChange={(value) => patchRoom(activeRoom.id, { name: value })} />
              <Field label="直播间链接" value={activeRoom.url} onChange={(value) => patchRoom(activeRoom.id, { url: value })} />
              <Field label="发布时间" type="time" value={activeRoom.publishTime} onChange={(value) => patchRoom(activeRoom.id, { publishTime: value })} />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--text-sub)]">启用</span>
                <button onClick={() => patchRoom(activeRoom.id, { enabled: !activeRoom.enabled })} className={`h-10 w-full rounded-lg border text-sm font-medium transition ${activeRoom.enabled ? "border-[rgba(180,215,255,0.32)] bg-[rgba(110,150,200,0.18)] text-[var(--text-main)]" : "border-[rgba(180,215,255,0.16)] bg-[rgba(2,4,9,0.58)] text-[var(--text-sub)]"}`}>
                  {activeRoom.enabled ? "开启" : "关闭"}
                </button>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeRoom.url && <a href={activeRoom.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[rgba(180,215,255,0.16)] px-3 text-sm text-[var(--text-main)] transition hover:border-[rgba(180,215,255,0.32)] hover:bg-[rgba(255,255,255,0.055)]"><ExternalLink className="h-4 w-4" />打开直播间</a>}
            </div>
          </section>
        )}
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[rgba(180,215,255,0.16)] bg-[#0d1824] px-4 py-2 text-sm shadow-2xl">{toast}</div>}
    </main>
  );
}

function ShotCard({ shot, onDelete }: { shot: LiveShot; onDelete: () => void }) {
  return (
    <article className="shot-card group overflow-hidden rounded-xl">
      <a href={shot.imageUrl} target="_blank" rel="noreferrer" className="block bg-black">
        <div className="aspect-[9/16]">
          <img src={shot.imageUrl} alt={shot.roomName} loading="lazy" className="h-full w-full object-cover" />
        </div>
      </a>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text-main)]">{shot.roomName}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-sub)]">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(shot.capturedAt)}
            </div>
          </div>
          <button onClick={onDelete} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[rgba(220,120,135,0.22)] bg-[rgba(55,18,28,0.44)] text-[rgba(255,190,200,0.88)] opacity-80 transition hover:border-[rgba(220,120,135,0.34)] group-hover:opacity-100">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 inline-flex rounded-full border border-[rgba(180,215,255,0.16)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-sub)]">
          {inferKeyword(shot)}
        </div>
      </div>
    </article>
  );
}

function GroupPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition ${active ? "border-[rgba(180,215,255,0.32)] bg-[rgba(110,150,200,0.16)] text-[var(--text-main)] shadow-[0_0_24px_rgba(100,160,220,0.13)]" : "border-[rgba(180,215,255,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-sub)] hover:border-[rgba(180,215,255,0.26)] hover:bg-[rgba(255,255,255,0.06)]"}`}>
      <Folder className="h-4 w-4" />
      {label}
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs">{count}</span>
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, primary }: { icon: typeof Search; label: string; onClick?: () => void; primary?: boolean }) {
  const spinning = label.includes("中");
  return (
    <button onClick={onClick} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium ${primary ? "ambient-button" : "border border-[rgba(180,215,255,0.16)] bg-[rgba(255,255,255,0.045)] text-[var(--text-main)] transition hover:border-[rgba(180,215,255,0.30)] hover:bg-[rgba(255,255,255,0.07)]"}`}>
      <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--text-sub)]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-[rgba(180,215,255,0.16)] bg-[rgba(2,4,9,0.58)] px-3 text-sm text-[var(--text-main)] outline-none transition focus:border-[rgba(180,215,255,0.32)]" />
    </label>
  );
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

"use client";

import {
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Folder,
  FolderOpen,
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
  const [activeShotId, setActiveShotId] = useState("");
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
  const visibleShots = useMemo(() => visibleGroups.flatMap((group) => group.shots), [visibleGroups]);
  const activeShot = visibleShots.find((shot) => shot.id === activeShotId) ?? visibleShots[0];

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!activeRoomId && rooms[0]) setActiveRoomId(rooms[0].id);
  }, [activeRoomId, rooms]);

  useEffect(() => {
    if (visibleShots[0] && !visibleShots.some((shot) => shot.id === activeShotId)) {
      setActiveShotId(visibleShots[0].id);
    }
    if (!visibleShots.length) setActiveShotId("");
  }, [activeShotId, visibleShots]);

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
      setLastTask(`已发送「${term}」抓取任务，只抓 1 个直播间。`);
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
    <main className="min-h-screen bg-[#080a0d] text-[#f4f1ea]">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(22,122,100,0.20),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(210,85,74,0.12),transparent_26%),linear-gradient(180deg,#0b0f13,#080a0d)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c1015]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#5fd3b3]/25 bg-[#10221d] text-[#5fd3b3] shadow-[0_0_32px_rgba(64,201,162,0.16)]">
              <Radio className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">直播截图素材库</h1>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#99a1ad]">
                <span>{groups.length} 个分类</span>
                <span>{publishedShots.length} 张截图</span>
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

      <div className="mx-auto grid max-w-[1500px] grid-cols-[230px_minmax(0,1fr)_330px] gap-4 px-5 py-5 max-xl:grid-cols-[210px_minmax(0,1fr)] max-lg:grid-cols-1">
        <aside className="rounded-lg border border-white/10 bg-[#12161c]/85 p-3 max-lg:order-2">
          <SectionTitle title="分类" loading={loading} />
          <div className="mt-3 space-y-2">
            <GroupButton label="全部" count={publishedShots.length} active={activeGroup === ALL_GROUP} onClick={() => setActiveGroup(ALL_GROUP)} />
            {groups.map((group) => (
              <GroupButton key={group.key} label={group.label} count={group.shots.length} active={activeGroup === group.key} onClick={() => setActiveGroup(group.key)} />
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#12161c]/85">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{activeGroup === ALL_GROUP ? "全部截图" : activeGroup}</div>
                <div className="mt-1 text-xs text-[#99a1ad]">当前显示 {visibleShots.length} 张，按直播间自动去重</div>
              </div>
              {visibleShots.length > 0 && (
                <button onClick={() => deleteGroup(activeGroup)} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#dc6b7a]/35 bg-[#251319] px-2 text-xs text-[#ff9aae] transition hover:bg-[#351a22]">
                  <Trash2 className="h-3.5 w-3.5" />
                  {activeGroup === ALL_GROUP ? "清空全部" : "清空分类"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-0 max-2xl:grid-cols-1">
              <div className="min-h-[420px] bg-[#0c0f13] p-4">
                {activeShot ? (
                  <div className="flex h-full min-h-[420px] flex-col">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{activeShot.roomName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#99a1ad]">
                          <span>{inferKeyword(activeShot)}</span>
                          <span>{formatDate(activeShot.capturedAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <a href={activeShot.imageUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-[#e2e7ed] transition hover:bg-white/[0.06]">
                          <ExternalLink className="h-4 w-4" />
                          打开
                        </a>
                        <button onClick={() => deleteShot(activeShot.id)} className="grid h-9 w-9 place-items-center rounded-md border border-[#dc6b7a]/35 bg-[#251319] text-[#ff9aae] transition hover:bg-[#351a22]">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <a href={activeShot.imageUrl} target="_blank" rel="noreferrer" className="grid flex-1 place-items-center overflow-hidden rounded-lg border border-white/10 bg-black">
                      <img src={activeShot.imageUrl} alt={activeShot.roomName} className="max-h-[68vh] w-full object-contain" />
                    </a>
                  </div>
                ) : (
                  <div className="grid h-[420px] place-items-center rounded-lg border border-dashed border-white/15 text-center">
                    <div>
                      <ImageIcon className="mx-auto h-9 w-9 text-[#596270]" />
                      <div className="mt-3 text-sm font-medium text-[#d7dde5]">暂无截图</div>
                      <div className="mt-1 text-xs text-[#808895]">右侧输入关键词，抓取一个直播间画面。</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-l border-white/10 bg-[#11151a] p-4 max-2xl:border-l-0 max-2xl:border-t">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-[#d7dde5]">素材缩略图</div>
                  <div className="text-xs text-[#99a1ad]">{visibleShots.length} 张</div>
                </div>
                {visibleGroups.length ? (
                  <div className="max-h-[72vh] space-y-5 overflow-auto pr-1">
                    {visibleGroups.map((group) => (
                      <div key={group.key}>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#74d9bf]">
                          <FolderOpen className="h-3.5 w-3.5" />
                          {group.label}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {group.shots.map((shot) => (
                            <button
                              key={shot.id}
                              onClick={() => setActiveShotId(shot.id)}
                              className={`group overflow-hidden rounded-lg border bg-[#0c0f13] text-left transition hover:border-[#5fd3b3]/45 ${activeShot?.id === shot.id ? "border-[#5fd3b3]/70 ring-2 ring-[#5fd3b3]/15" : "border-white/10"}`}
                            >
                              <div className="aspect-video bg-black">
                                <img src={shot.imageUrl} alt={shot.roomName} loading="lazy" className="h-full w-full object-contain" />
                              </div>
                              <div className="p-2">
                                <div className="truncate text-xs font-semibold text-[#e2e7ed]">{shot.roomName}</div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-[#8993a0]">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(shot.capturedAt)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid h-60 place-items-center rounded-lg border border-dashed border-white/15 text-sm text-[#8993a0]">暂无素材</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 max-xl:col-span-2 max-lg:col-span-1">
          <div className="rounded-lg border border-white/10 bg-[#12161c]/85 p-4">
            <div className="mb-3 text-sm font-semibold text-[#d7dde5]">快速抓取</div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && searchLives()}
                placeholder="例如：好奇"
                className="h-10 rounded-md border border-white/10 bg-[#0d1116] px-3 text-sm text-white outline-none transition placeholder:text-[#67717f] focus:border-[#5fd3b3]/60"
              />
              <ActionButton icon={searching ? Loader2 : Search} label={searching ? "发送中" : "抓取"} onClick={searchLives} primary />
            </div>
            {lastTask && <div className="mt-3 rounded-md border border-white/10 bg-[#0d1116] p-3 text-sm leading-6 text-[#d7dde5]">{lastTask}</div>}
          </div>

          {activeRoom && (
            <div className="rounded-lg border border-white/10 bg-[#12161c]/85 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-[#d7dde5]">固定直播间</div>
                <button onClick={() => removeRoom(activeRoom.id)} className="grid h-8 w-8 place-items-center rounded-md border border-[#dc6b7a]/30 bg-[#251319] text-[#ff9aae] transition hover:bg-[#351a22]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <select value={activeRoom.id} onChange={(event) => setActiveRoomId(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#0d1116] px-3 text-sm text-white outline-none transition focus:border-[#5fd3b3]/60">
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
                <Field label="名称" value={activeRoom.name} onChange={(value) => patchRoom(activeRoom.id, { name: value })} />
                <Field label="直播间链接" value={activeRoom.url} onChange={(value) => patchRoom(activeRoom.id, { url: value })} />
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Field label="发布时间" type="time" value={activeRoom.publishTime} onChange={(value) => patchRoom(activeRoom.id, { publishTime: value })} />
                  <label className="flex min-w-[90px] flex-col gap-1">
                    <span className="text-xs font-medium text-[#99a1ad]">启用</span>
                    <button onClick={() => patchRoom(activeRoom.id, { enabled: !activeRoom.enabled })} className={`h-10 rounded-md border text-sm font-medium transition ${activeRoom.enabled ? "border-[#5fd3b3]/50 bg-[#18352d] text-[#91ead4]" : "border-white/10 bg-[#0d1116] text-[#99a1ad]"}`}>
                      {activeRoom.enabled ? "开启" : "关闭"}
                    </button>
                  </label>
                </div>
                <Field label="备注" value={activeRoom.notes} onChange={(value) => patchRoom(activeRoom.id, { notes: value })} textarea />
                <div className="flex flex-wrap gap-2">
                  {activeRoom.url && <a href={activeRoom.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-[#d7dde5] transition hover:bg-white/[0.06]"><ExternalLink className="h-4 w-4" />打开</a>}
                  <ActionButton icon={agentingId === activeRoom.id ? Loader2 : Radio} label={agentingId === activeRoom.id ? "通知中" : "共享电脑截图"} onClick={() => queueAgentCapture(activeRoom.id)} primary />
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-white/10 bg-[#20262f] px-4 py-2 text-sm shadow-2xl">{toast}</div>}
    </main>
  );
}

function SectionTitle({ title, loading }: { title: string; loading?: boolean }) {
  return <div className="flex items-center justify-between px-1"><div className="text-sm font-semibold text-[#d7dde5]">{title}</div>{loading && <Loader2 className="h-4 w-4 animate-spin text-[#5fd3b3]" />}</div>;
}

function GroupButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition ${active ? "border-[#5fd3b3]/45 bg-[#1b302b]" : "border-white/10 bg-[#0d1116] hover:bg-white/[0.05]"}`}>
      <span className="flex min-w-0 items-center gap-2">
        {active ? <FolderOpen className="h-4 w-4 text-[#5fd3b3]" /> : <Folder className="h-4 w-4 text-[#99a1ad]" />}
        <span className="truncate text-sm font-medium">{label}</span>
      </span>
      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[#99a1ad]">{count}</span>
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, primary }: { icon: typeof Camera; label: string; onClick?: () => void; primary?: boolean }) {
  const spinning = label.includes("中");
  return (
    <button onClick={onClick} className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition ${primary ? "border-[#5fd3b3]/45 bg-[#18836b] text-white hover:bg-[#1b9478]" : "border-white/10 bg-[#171d24] text-[#d7dde5] hover:bg-white/[0.07]"}`}>
      <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      <span>{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, textarea, type = "text" }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#99a1ad]">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full resize-none rounded-md border border-white/10 bg-[#0d1116] px-3 py-2 text-sm leading-5 text-white outline-none transition focus:border-[#5fd3b3]/60" />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#0d1116] px-3 text-sm text-white outline-none transition focus:border-[#5fd3b3]/60" />
      )}
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

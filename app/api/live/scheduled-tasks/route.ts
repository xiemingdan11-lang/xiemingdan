import { NextResponse } from "next/server";
import { hasLiveBackend, proxyLiveJson } from "@/lib/live-backend";
import { makeId, readLiveStore, ScheduledTask, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/scheduled-tasks");
  const store = await readLiveStore();
  return NextResponse.json({ tasks: store.scheduledTasks ?? [] });
}

export async function POST(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/scheduled-tasks");
  const body = (await request.json().catch(() => ({}))) as Partial<ScheduledTask>;
  const now = new Date().toISOString();
  const task: ScheduledTask = {
    id: makeId("task"),
    keyword: String(body.keyword || "").trim(),
    time: /^\d{2}:\d{2}$/.test(String(body.time)) ? String(body.time) : "09:00",
    freq: (["daily", "weekly", "monthly"] as const).includes(body.freq as never) ? body.freq! : "daily",
    weekday: typeof body.weekday === "number" ? body.weekday : 1,
    monthday: typeof body.monthday === "number" ? Math.max(1, Math.min(31, body.monthday)) : 1,
    limit: Math.min(Math.max(Number(body.limit || 4), 1), 20),
    enabled: body.enabled !== false,
    createdAt: now,
  };
  const store = await readLiveStore();
  const tasks = [...(store.scheduledTasks ?? []), task];
  await writeLiveStore({ ...store, scheduledTasks: tasks });
  return NextResponse.json({ ok: true, task });
}

export async function PATCH(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/scheduled-tasks");
  const body = (await request.json().catch(() => ({}))) as Partial<ScheduledTask> & { id: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const store = await readLiveStore();
  const tasks = (store.scheduledTasks ?? []).map((t) =>
    t.id === body.id ? { ...t, ...body, id: t.id } : t
  );
  await writeLiveStore({ ...store, scheduledTasks: tasks });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/scheduled-tasks");
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const store = await readLiveStore();
  const tasks = (store.scheduledTasks ?? []).filter((t) => t.id !== id);
  await writeLiveStore({ ...store, scheduledTasks: tasks });
  return NextResponse.json({ ok: true });
}

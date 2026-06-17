import { NextResponse } from "next/server";
import { makeId, readLiveStore, ScheduledTask, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isTaskDue(task: ScheduledTask, now: Date): boolean {
  const [hh, mm] = task.time.split(":").map(Number);
  if (now.getUTCHours() !== hh || now.getUTCMinutes() !== mm) return false;

  // 防止同一分钟重复触发
  if (task.lastRunAt) {
    const last = new Date(task.lastRunAt);
    if (now.getTime() - last.getTime() < 55_000) return false;
  }

  if (task.freq === "daily") return true;
  if (task.freq === "weekly") return now.getUTCDay() === (task.weekday ?? 1);
  if (task.freq === "monthly") return now.getUTCDate() === (task.monthday ?? 1);
  return false;
}

export async function GET(request: Request) {
  // Vercel Cron 鉴权
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await readLiveStore();
  const tasks = store.scheduledTasks ?? [];
  const now = new Date();
  const due = tasks.filter((t) => t.enabled && t.keyword.trim() && isTaskDue(t, now));

  if (due.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  const nowIso = now.toISOString();
  const newCommands = due.map((t) => ({
    id: makeId("cmd"),
    type: "search-capture" as const,
    status: "pending" as const,
    keyword: t.keyword.trim(),
    limit: t.limit,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  const updatedTasks = tasks.map((t) =>
    due.find((d) => d.id === t.id) ? { ...t, lastRunAt: nowIso } : t
  );

  const commands = [...newCommands, ...(store.commands ?? [])].slice(0, 200);
  await writeLiveStore({ ...store, commands, scheduledTasks: updatedTasks });

  return NextResponse.json({ ok: true, fired: due.length, keywords: due.map((t) => t.keyword) });
}

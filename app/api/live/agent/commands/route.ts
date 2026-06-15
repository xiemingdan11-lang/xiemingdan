import { NextResponse } from "next/server";
import { hasLiveBackend, proxyLiveJson } from "@/lib/live-backend";
import { AgentCommand, makeId, readLiveStore, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateBody = {
  type?: "capture-room" | "search-capture";
  roomId?: string;
  keyword?: string;
  limit?: number;
};

type UpdateBody = {
  id?: string;
  status?: "done" | "failed";
  error?: string;
  resultCount?: number;
};

const STALE_RUNNING_MS = 3 * 60 * 1000;

export async function GET() {
  if (hasLiveBackend()) return proxyLiveJson(new Request("http://local", { method: "GET" }), "/api/live/agent/commands");

  const store = await readLiveStore();
  const commands = store.commands ?? [];
  const nowMs = Date.now();
  const command = commands.find((item) => {
    if (item.status === "pending") return true;
    if (item.status !== "running") return false;
    const updatedAt = new Date(item.updatedAt).getTime();
    return Number.isFinite(updatedAt) && nowMs - updatedAt > STALE_RUNNING_MS;
  });

  if (!command) {
    return NextResponse.json({ command: null });
  }

  const now = new Date().toISOString();
  const next = commands.map((item) =>
    item.id === command.id ? { ...item, status: "running" as const, updatedAt: now } : item
  );
  await writeLiveStore({ ...store, commands: next });

  return NextResponse.json({
    command: { ...command, status: "running", updatedAt: now },
    rooms: store.rooms
  });
}

export async function POST(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/agent/commands");

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  if (body.type !== "capture-room" && body.type !== "search-capture") {
    return NextResponse.json({ error: "Unsupported command type." }, { status: 400 });
  }

  const store = await readLiveStore();
  if (body.type === "capture-room" && !store.rooms.some((item) => item.id === body.roomId)) {
    return NextResponse.json({ error: "没有找到直播间。" }, { status: 404 });
  }
  if (body.type === "search-capture" && !String(body.keyword || "").trim()) {
    return NextResponse.json({ error: "请输入搜索关键词。" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const command: AgentCommand = {
    id: makeId("cmd"),
    type: body.type,
    status: "pending",
    roomId: body.roomId,
    keyword: String(body.keyword || "").trim(),
    limit: Math.min(Math.max(Number(body.limit || 6), 1), 20),
    createdAt: now,
    updatedAt: now
  };

  const commands = [command, ...(store.commands ?? [])].slice(0, 200);
  await writeLiveStore({ ...store, commands });

  return NextResponse.json({ ok: true, command });
}

export async function PATCH(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/agent/commands");

  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  if (!body.id || (body.status !== "done" && body.status !== "failed")) {
    return NextResponse.json({ error: "id and status are required." }, { status: 400 });
  }

  const store = await readLiveStore();
  const now = new Date().toISOString();
  const commands = (store.commands ?? []).map((item) =>
    item.id === body.id
      ? { ...item, status: body.status!, updatedAt: now, error: body.error || "", resultCount: body.resultCount ?? item.resultCount }
      : item
  );
  await writeLiveStore({ ...store, commands });

  return NextResponse.json({ ok: true });
}

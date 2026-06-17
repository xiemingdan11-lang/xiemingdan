import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { hasLiveBackend, proxyLiveForm } from "@/lib/live-backend";
import { LiveRoom, LiveShot, makeId, readLiveStore, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOT_DIR = path.join(process.cwd(), "public", "live-shots");

export async function POST(request: Request) {
  if (hasLiveBackend()) return proxyLiveForm(request, "/api/live/upload-shot");

  const form = await request.formData().catch(() => null);
  const roomId = String(form?.get("roomId") || "");
  const roomName = String(form?.get("roomName") || "temp live room");
  const pageUrl = String(form?.get("pageUrl") || "").trim();
  const message = String(form?.get("message") || "Local computer live screenshot upload.");
  const keyword = String(form?.get("keyword") || "").trim();
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }

  const store = await readLiveStore();
  const room = store.rooms.find((item) => item.id === roomId);
  const fallbackRoom: LiveRoom = {
    id: roomId || makeId("temp-room"),
    name: roomName,
    url: pageUrl,
    publishTime: "00:00",
    enabled: false,
    notes: "Agent search result",
    createdAt: new Date().toISOString()
  };
  const target = room ?? fallbackRoom;
  const finalPageUrl = pageUrl || target.url || "";
  const liveIdentity = extractLiveIdentity(finalPageUrl);

  // Search captures must end on a concrete live room page, not a profile/product/search page.
  if (keyword && !liveIdentity) {
    return NextResponse.json({ error: "Search result did not open a specific live room." }, { status: 400 });
  }

  const shotId = makeId("shot");
  const capturedAt = new Date().toISOString();
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const fileName = `${shotId}.${ext}`;
  await mkdir(SHOT_DIR, { recursive: true });
  await writeFile(path.join(SHOT_DIR, fileName), Buffer.from(await file.arrayBuffer()));

  const shot: LiveShot = {
    id: shotId,
    roomId: target.id,
    roomName: target.name,
    imageUrl: `/api/live/media?kind=shot&file=${fileName}`,
    pageUrl: finalPageUrl,
    status: "published",
    capturedAt,
    message,
    keyword
  };

  const liveKey = liveIdentity || normalizeKey(finalPageUrl || target.name || target.id);
  const keywordKey = normalizeKey(keyword || inferKeyword(message) || "uncategorized");
  const dedupedShots = store.shots.filter((item) => {
    if (item.status !== "published") return true;
    const itemKeyword = normalizeKey(item.keyword || inferKeyword(item.message || "") || "uncategorized");
    const itemLive = extractLiveIdentity(item.pageUrl) || normalizeKey(item.pageUrl || item.roomName || item.roomId);
    return !(itemKeyword === keywordKey && itemLive === liveKey);
  });

  const rooms = room
    ? store.rooms.map((item) =>
        item.id === room.id ? { ...item, lastRunAt: capturedAt, lastShotId: shot.id, lastError: "" } : item
      )
    : store.rooms;
  await writeLiveStore({ ...store, rooms, shots: [shot, ...dedupedShots].slice(0, 500) });

  return NextResponse.json({ ok: true, shot });
}

function inferKeyword(message: string) {
  const english = message.match(/Keyword\s+(.+?)\s+live screenshot/i);
  if (english?.[1]) return english[1].trim();

  const chinese = message.match(/关键词\s+(.+?)\s+(?:自动|搜索|直播|截图|第)/);
  return chinese?.[1]?.trim() || "";
}

function normalizeKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function extractLiveIdentity(value: string) {
  const url = String(value || "").trim();
  if (!url) return "";
  const match =
    url.match(/live\.douyin\.com\/([^/?#]+)/i) ||
    url.match(/douyin\.com\/live\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase() || "";
}

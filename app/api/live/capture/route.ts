import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { hasLiveBackend, proxyLiveJson } from "@/lib/live-backend";
import { isValidHttpUrl, LiveShot, makeId, readLiveStore, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOT_DIR = path.join(process.cwd(), "public", "live-shots");
const STORAGE_STATE = process.env.LIVE_CAPTURE_STORAGE_STATE || "";
const CHROMIUM_EXECUTABLE = process.env.LIVE_CAPTURE_CHROMIUM_EXECUTABLE || "";

type CaptureBody = {
  roomId?: string;
};

export async function POST(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/capture");

  const body = (await request.json().catch(() => ({}))) as CaptureBody;
  const store = await readLiveStore();
  const room = store.rooms.find((item) => item.id === body.roomId);

  if (!room) {
    return NextResponse.json({ error: "没有找到直播间。" }, { status: 404 });
  }

  if (!isValidHttpUrl(room.url)) {
    return NextResponse.json({ error: "直播间链接不是有效网址。" }, { status: 400 });
  }

  const shotId = makeId("shot");
  const capturedAt = new Date().toISOString();

  try {
    const { chromium } = await import("playwright");
    await mkdir(SHOT_DIR, { recursive: true });
    const fileName = `${shotId}.png`;
    const filePath = path.join(SHOT_DIR, fileName);
    const browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_EXECUTABLE || undefined
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
      storageState: STORAGE_STATE && existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined
    });
    const page = await context.newPage();

    await page.goto(room.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: filePath, fullPage: false });
    await context.close();
    await browser.close();

    const shot: LiveShot = {
      id: shotId,
      roomId: room.id,
      roomName: room.name,
      imageUrl: `/api/live/media?kind=shot&file=${fileName}`,
      pageUrl: room.url,
      status: "published",
      capturedAt,
      message: "已截图并发布到看板。"
    };

    const rooms = store.rooms.map((item) =>
      item.id === room.id ? { ...item, lastRunAt: capturedAt, lastShotId: shot.id, lastError: "" } : item
    );
    await writeLiveStore({ ...store, rooms, shots: [shot, ...store.shots].slice(0, 500) });
    return NextResponse.json({ ok: true, shot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "截图失败。";
    const failed: LiveShot = {
      id: shotId,
      roomId: room.id,
      roomName: room.name,
      imageUrl: "",
      pageUrl: room.url,
      status: "failed",
      capturedAt,
      message
    };
    const rooms = store.rooms.map((item) =>
      item.id === room.id ? { ...item, lastRunAt: capturedAt, lastError: message } : item
    );
    await writeLiveStore({ ...store, rooms, shots: [failed, ...store.shots].slice(0, 500) });
    return NextResponse.json({ error: message, shot: failed }, { status: 500 });
  }
}

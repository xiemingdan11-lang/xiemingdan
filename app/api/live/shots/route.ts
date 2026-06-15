import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { hasLiveBackend, proxyLiveJson } from "@/lib/live-backend";
import { LiveShot, readLiveStore, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOT_DIR = path.join(process.cwd(), "public", "live-shots");
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
};

type DeleteBody = {
  shotId?: string;
  keyword?: string;
  all?: boolean;
};

export async function DELETE(request: Request) {
  if (hasLiveBackend()) return proxyLiveJson(request, "/api/live/shots");

  const body = (await request.json().catch(() => ({}))) as DeleteBody;
  const store = await readLiveStore();

  const shouldDelete = (shot: LiveShot) => {
    if (body.all) return shot.status === "published";
    if (body.shotId) return shot.id === body.shotId;
    if (body.keyword) return inferKeyword(shot) === body.keyword;
    return false;
  };

  const removed = store.shots.filter(shouldDelete);
  if (!removed.length) {
    return NextResponse.json({ ok: true, deleted: 0 }, { headers: RESPONSE_HEADERS });
  }

  await Promise.all(removed.map((shot) => deleteMediaFile(shot.imageUrl)));
  const shots = store.shots.filter((shot) => !shouldDelete(shot));
  await writeLiveStore({ ...store, shots });

  return NextResponse.json({ ok: true, deleted: removed.length }, { headers: RESPONSE_HEADERS });
}

function inferKeyword(shot: LiveShot) {
  const explicit = shot.keyword?.trim();
  if (explicit) return explicit;
  const match = shot.message?.match(/关键词\s+(.+?)\s+(?:自动|搜索|直播|截图|第)/);
  return match?.[1]?.trim() || "未分类";
}

async function deleteMediaFile(imageUrl: string) {
  try {
    const url = new URL(imageUrl, "http://local");
    const file = url.searchParams.get("file");
    if (!file || !/^[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(file)) return;
    const filePath = path.join(SHOT_DIR, file);
    if (!filePath.startsWith(SHOT_DIR)) return;
    await unlink(filePath).catch(() => undefined);
  } catch {
    return;
  }
}

import { NextResponse } from "next/server";
import { isValidHttpUrl, LiveRoom, normalizeRoom, readLiveStore, writeLiveStore } from "@/lib/live-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await readLiveStore(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { rooms?: Partial<LiveRoom>[] } | null;
  if (!body || !Array.isArray(body.rooms)) {
    return NextResponse.json({ error: "rooms must be an array." }, { status: 400 });
  }

  const rooms = body.rooms.map(normalizeRoom);
  const invalid = rooms.find((room) => room.url && !isValidHttpUrl(room.url));
  if (invalid) {
    return NextResponse.json({ error: `${invalid.name} 的链接不是有效网址。` }, { status: 400 });
  }

  const store = await readLiveStore();
  await writeLiveStore({ ...store, rooms });
  return NextResponse.json({ ok: true, rooms });
}

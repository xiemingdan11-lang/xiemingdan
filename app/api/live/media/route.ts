import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { hasLiveBackend, proxyLiveMedia } from "@/lib/live-backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROOTS = {
  search: path.join(process.cwd(), "public", "live-search"),
  shot: path.join(process.cwd(), "public", "live-shots")
};

export async function GET(request: Request) {
  if (hasLiveBackend()) return proxyLiveMedia(request, "/api/live/media");

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const file = url.searchParams.get("file");

  if ((kind !== "search" && kind !== "shot") || !file || !/^[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(file)) {
    return NextResponse.json({ error: "Invalid media request." }, { status: 400 });
  }

  const root = ROOTS[kind];
  const filePath = path.join(root, file);

  if (!filePath.startsWith(root)) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }

  const ext = path.extname(file).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";

  try {
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
}

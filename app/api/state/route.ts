import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = process.env.WORKBENCH_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "workbench-state.json");
const BACKEND_URL = process.env.WORKBENCH_BACKEND_URL ?? (process.env.VERCEL ? "http://124.222.223.153" : "");

type StateStore = Record<string, unknown>;

async function readStore(): Promise<StateStore> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StateStore;
  } catch {
    return {};
  }
}

async function writeStore(store: StateStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function GET() {
  if (BACKEND_URL) {
    const response = await fetch(new URL("/api/state", BACKEND_URL), { cache: "no-store" });
    const store = await response.json();
    return NextResponse.json(rewriteUploadUrls(store));
  }

  const store = await readStore();
  return NextResponse.json(store);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.key !== "string") {
    return NextResponse.json({ error: "Missing state key." }, { status: 400 });
  }

  if (BACKEND_URL) {
    const response = await fetch(new URL("/api/state", BACKEND_URL), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({ ok: response.ok }));
    return NextResponse.json(data, { status: response.status });
  }

  const store = await readStore();
  store[body.key] = body.value;
  await writeStore(store);

  return NextResponse.json({ ok: true });
}

function rewriteUploadUrls(value: unknown): unknown {
  if (!BACKEND_URL) return value;
  if (typeof value === "string") {
    return value.startsWith("/uploads/") ? new URL(value, BACKEND_URL).toString() : value;
  }
  if (Array.isArray(value)) return value.map(rewriteUploadUrls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteUploadUrls(item)]));
  }
  return value;
}

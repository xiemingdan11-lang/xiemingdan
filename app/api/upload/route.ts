import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_DIR = process.env.WORKBENCH_UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");
const BACKEND_URL = process.env.WORKBENCH_BACKEND_URL ?? (process.env.VERCEL ? "http://124.222.223.153" : "");

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing upload file." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }

  if (BACKEND_URL) {
    const proxyForm = new FormData();
    proxyForm.append("file", file);

    const response = await fetch(new URL("/api/upload", BACKEND_URL), {
      method: "POST",
      body: proxyForm
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.url) {
      return NextResponse.json(data ?? { error: "Backend upload failed." }, { status: response.status });
    }

    return NextResponse.json({ url: new URL(data.url, BACKEND_URL).toString() });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || `.${file.type.split("/")[1] || "png"}`;
  const filename = `${Date.now()}-${safeName(path.basename(file.name, ext))}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return NextResponse.json({ url: `/uploads/${filename}` });
}

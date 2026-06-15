import { NextResponse } from "next/server";

const WORKER_BASE_URL = process.env.TREND_WORKER_URL ?? "http://124.222.223.153:8787";
const WORKER_TOKEN = process.env.TREND_WORKER_TOKEN ?? "438667b217a4ca2c7a29db052157be8d";

export const dynamic = "force-dynamic";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL("/latest", WORKER_BASE_URL);
    url.searchParams.set("token", WORKER_TOKEN);

    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "offline", summary: `Trend Worker returned ${response.status}`, items: [] },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ status: "online", ...data });
  } catch {
    return NextResponse.json(
      { status: "offline", summary: "Trend Worker is unreachable. Check server firewall port 8787.", items: [] },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

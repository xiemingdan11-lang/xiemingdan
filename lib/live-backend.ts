export const LIVE_BACKEND_URL =
  process.env.LIVE_BACKEND_URL ?? process.env.WORKBENCH_BACKEND_URL ?? (process.env.VERCEL ? "http://124.222.223.153" : "");

export function hasLiveBackend() {
  return Boolean(LIVE_BACKEND_URL);
}

export async function proxyLiveJson(request: Request, pathname: string) {
  const target = new URL(pathname, LIVE_BACKEND_URL);
  const source = new URL(request.url);
  target.search = source.search;

  const init: RequestInit = {
    method: request.method,
    cache: "no-store",
    headers: {
      "Content-Type": request.headers.get("Content-Type") || "application/json"
    }
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const response = await fetch(target, init);
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}

export async function proxyLiveForm(request: Request, pathname: string) {
  const response = await fetch(new URL(pathname, LIVE_BACKEND_URL), {
    method: request.method,
    body: await request.formData(),
    cache: "no-store"
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}

export async function proxyLiveMedia(request: Request, pathname: string) {
  const target = new URL(pathname, LIVE_BACKEND_URL);
  const source = new URL(request.url);
  target.search = source.search;

  const response = await fetch(target, { cache: "no-store" });
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
      "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=31536000, immutable"
    }
  });
}

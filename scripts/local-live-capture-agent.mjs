import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const serverUrl = process.env.LIVE_SERVER_URL || "http://124.222.223.153";
const pollMs = Number(process.env.LIVE_CAPTURE_POLL_MS || 60_000);
const storageState = process.env.LIVE_CAPTURE_STORAGE_STATE || path.join(process.cwd(), "secrets", "douyin-storage-state.json");
const executablePath = process.env.LIVE_CAPTURE_CHROMIUM_EXECUTABLE || "";
const cdpUrl = process.env.LIVE_CAPTURE_CDP_URL || "";
const userDataDir = process.env.LIVE_CAPTURE_USER_DATA_DIR || "";
const headless = process.env.LIVE_CAPTURE_HEADLESS === "1";
const runOnce = process.env.LIVE_CAPTURE_ONCE === "1";
const forceNow = process.env.LIVE_CAPTURE_FORCE === "1";
const onlyRoomId = process.env.LIVE_CAPTURE_ROOM_ID || "";
const fired = new Set();
const VIEWPORT = { width: 1080, height: 1920 };
const PORTRAIT_RATIO = 9 / 16;

function todayKey(roomId, time) {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${day}:${roomId}:${time}`;
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function makeTempRoom(id, name, url) {
  return { id, name, url, publishTime: "", enabled: false, notes: "", createdAt: new Date().toISOString() };
}

function candidateId(keyword, index) {
  const safe = keyword.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").slice(0, 28) || "keyword";
  return `search-${safe}-${Date.now().toString(36)}-${index + 1}`;
}

async function getStore() {
  const res = await fetch(new URL("/api/live/rooms", serverUrl), { cache: "no-store" });
  if (!res.ok) throw new Error(`read rooms failed: ${res.status}`);
  return res.json();
}

async function uploadShot(room, bytes, message = "Local computer live screenshot upload.", keyword = "") {
  const form = new FormData();
  form.append("roomId", room.id);
  form.append("roomName", room.name || "直播间截图");
  form.append("pageUrl", room.url || "");
  form.append("message", message);
  form.append("keyword", keyword);
  form.append("file", new Blob([bytes], { type: "image/jpeg" }), `${room.id}.jpg`);

  const res = await fetch(new URL("/api/live/upload-shot", serverUrl), { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `upload failed: ${res.status}`);
  return data;
}

async function getCommand() {
  const res = await fetch(new URL("/api/live/agent/commands", serverUrl), { cache: "no-store" });
  if (!res.ok) throw new Error(`read command failed: ${res.status}`);
  return res.json();
}

async function finishCommand(id, status, error = "", resultCount) {
  await fetch(new URL("/api/live/agent/commands", serverUrl), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, error, resultCount })
  }).catch(() => undefined);
}

async function withBrowser(fn) {
  if (cdpUrl) {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] || await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    try {
      return await fn(context);
    } finally {
      await browser.close();
    }
  }

  if (userDataDir) {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      executablePath: executablePath || undefined,
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      args: ["--disable-blink-features=AutomationControlled"]
    });
    try {
      return await fn(context);
    } finally {
      await context.close();
    }
  }

  const browser = await chromium.launch({ headless, executablePath: executablePath || undefined });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    storageState: existsSync(storageState) ? storageState : undefined
  });
  try {
    return await fn(context);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function prepareLivePage(page, url) {
  await page.setViewportSize(VIEWPORT).catch(() => undefined);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(4000);
  await page.keyboard.press("KeyB").catch(() => undefined);
  await page.waitForTimeout(800);
  await page.addStyleTag({
    content: `
      [class*="danmu" i], [class*="barrage" i], [class*="comment" i],
      [data-e2e*="comment" i], [data-e2e*="danmu" i] {
        visibility: hidden !important;
      }
    `
  }).catch(() => undefined);
}

async function readLiveState(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const url = location.href;
    const videoCount = Array.from(document.querySelectorAll("video")).filter((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 120 && rect.height > 120;
    }).length;
    const hasCanvas = Array.from(document.querySelectorAll("canvas")).some((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return rect.width > 300 && rect.height > 300;
    });
    const blocked =
      /请完成验证|短信验证|验证码|登录后即可|扫码登录/.test(text) ||
      /直播已结束|主播暂时离开|暂未开播|暂无直播/.test(text);
    const looksLive = videoCount > 0 || hasCanvas || /直播中|正在直播/.test(text) || /live\.douyin\.com/.test(url);
    return { blocked, looksLive, videoCount, url, title: document.title || "" };
  });
}

async function captureCleanLive(page) {
  const videoBox = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("video, canvas"))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          x: Math.max(0, rect.x),
          y: Math.max(0, rect.y),
          width: Math.min(window.innerWidth - Math.max(0, rect.x), rect.width),
          height: Math.min(window.innerHeight - Math.max(0, rect.y), rect.height),
          area: rect.width * rect.height
        };
      })
      .filter((rect) => rect.width > 200 && rect.height > 200)
      .sort((a, b) => b.area - a.area);
    return candidates[0] || null;
  });

  if (!videoBox) return page.screenshot({ fullPage: false, type: "jpeg", quality: 78 });
  const clip = makePortraitClip(videoBox);
  return page.screenshot({
    type: "jpeg",
    quality: 78,
    clip
  });
}

function makePortraitClip(box) {
  let { x, y, width, height } = box;
  const ratio = width / height;

  if (ratio > PORTRAIT_RATIO) {
    const nextWidth = height * PORTRAIT_RATIO;
    x += (width - nextWidth) / 2;
    width = nextWidth;
  } else if (ratio < PORTRAIT_RATIO) {
    const nextHeight = width / PORTRAIT_RATIO;
    y += (height - nextHeight) / 2;
    height = nextHeight;
  }

  x = Math.max(0, x);
  y = Math.max(0, y);
  width = Math.min(VIEWPORT.width - x, width);
  height = Math.min(VIEWPORT.height - y, height);

  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.max(320, Math.floor(width)),
    height: Math.max(568, Math.floor(height))
  };
}

async function captureRoom(room) {
  return withBrowser(async (context) => {
    const page = await context.newPage();
    try {
      await prepareLivePage(page, room.url);
      const state = await readLiveState(page);
      if (state.blocked || !state.looksLive) throw new Error("not a live room or needs verification");
      return await captureCleanLive(page);
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}

async function extractCandidates(page, limit) {
  return page.evaluate((max) => {
    const seen = new Set();
    const items = [];
    for (const anchor of Array.from(document.querySelectorAll("a"))) {
      const rawHref = anchor.getAttribute("href") || "";
      const text = (anchor.textContent || "").replace(/\s+/g, " ").trim();
      let url = "";
      try {
        url = new URL(rawHref, location.origin).toString();
      } catch {
        continue;
      }

      const lowerUrl = url.toLowerCase();
      const isNav =
        lowerUrl.includes("/user/self") ||
        lowerUrl.includes("/follow") ||
        lowerUrl.includes("/friend") ||
        lowerUrl.includes("/my") ||
        lowerUrl.includes("/jingxuan") ||
        lowerUrl.includes("/search/") ||
        lowerUrl === "https://www.douyin.com/" ||
        lowerUrl === "https://www.douyin.com";
      const directLive = lowerUrl.includes("live.douyin.com") || /douyin\.com\/live\//.test(lowerUrl);
      const liveCard = /直播中|正在直播|直播间/.test(text);
      if (isNav || (!directLive && !liveCard) || seen.has(url)) continue;

      seen.add(url);
      items.push({ title: text.slice(0, 100) || "直播间候选", url });
      if (items.length >= max) break;
    }
    return items;
  }, limit);
}

async function searchAndCapture(command) {
  const keyword = (command.keyword || "").trim();
  const limit = Math.max(1, Math.min(Number(command.limit || 6), 12));
  if (!keyword) throw new Error("keyword is required");

  return withBrowser(async (context) => {
    const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=live`;
    const page = await context.newPage();
    console.log(`[${new Date().toLocaleString()}] search live keyword=${keyword}`);
    try {
      await page.setViewportSize(VIEWPORT).catch(() => undefined);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(5000);
      for (let i = 0; i < 3; i += 1) {
        await page.mouse.wheel(0, 900).catch(() => undefined);
        await page.waitForTimeout(1000);
      }

      const candidates = await extractCandidates(page, limit * 2);
      console.log(`[${new Date().toLocaleString()}] found ${candidates.length} candidates`);
      let uploaded = 0;
      for (const [index, candidate] of candidates.entries()) {
        if (uploaded >= limit) break;
        const livePage = await context.newPage();
        try {
          console.log(`[${new Date().toLocaleString()}] check candidate ${index + 1}/${candidates.length}: ${candidate.title}`);
          await prepareLivePage(livePage, candidate.url);
          const state = await readLiveState(livePage);
          if (state.blocked || !state.looksLive) {
            console.log(`[${new Date().toLocaleString()}] skip non-live: ${candidate.url}`);
            continue;
          }
          const room = makeTempRoom(candidateId(keyword, uploaded), candidate.title || `${keyword} 直播间 ${uploaded + 1}`, state.url || candidate.url);
          const bytes = await captureCleanLive(livePage);
          await uploadShot(room, bytes, `关键词 ${keyword} 自动搜索直播间截图，第 ${uploaded + 1} 张。`, keyword);
          uploaded += 1;
        } finally {
          await livePage.close().catch(() => undefined);
        }
      }
      return uploaded;
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}

async function tick() {
  const store = await getStore();
  const now = currentTime();
  const dueRooms = (store.rooms || []).filter((room) => {
    if (!room.url) return false;
    if (onlyRoomId && room.id !== onlyRoomId) return false;
    return forceNow || (room.enabled && room.publishTime === now);
  });
  if (!dueRooms.length) console.log(`[${new Date().toLocaleString()}] no rooms due`);

  for (const room of dueRooms) {
    const key = todayKey(room.id, room.publishTime);
    if (!forceNow && fired.has(key)) continue;
    fired.add(key);
    try {
      console.log(`[${new Date().toLocaleString()}] capture ${room.name}`);
      const bytes = await captureRoom(room);
      await uploadShot(room, bytes);
      console.log(`[${new Date().toLocaleString()}] uploaded ${room.name}`);
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] ${room.name}: ${error.message}`);
    }
  }
}

async function commandTick() {
  const data = await getCommand();
  const command = data.command;
  if (!command) return;

  if (command.type === "search-capture") {
    try {
      const count = await searchAndCapture(command);
      await finishCommand(command.id, "done", "", count);
      console.log(`[${new Date().toLocaleString()}] search command uploaded ${count} live screenshots`);
    } catch (error) {
      await finishCommand(command.id, "failed", error.message);
      console.error(`[${new Date().toLocaleString()}] search command failed: ${error.message}`);
    }
    return;
  }

  if (command.type !== "capture-room") {
    await finishCommand(command.id, "failed", `unsupported command: ${command.type}`);
    return;
  }
  const room = (data.rooms || []).find((item) => item.id === command.roomId);
  if (!room) {
    await finishCommand(command.id, "failed", "room not found");
    return;
  }
  try {
    console.log(`[${new Date().toLocaleString()}] command capture ${room.name}`);
    const bytes = await captureRoom(room);
    await uploadShot(room, bytes);
    await finishCommand(command.id, "done");
    console.log(`[${new Date().toLocaleString()}] command uploaded ${room.name}`);
  } catch (error) {
    await finishCommand(command.id, "failed", error.message);
    console.error(`[${new Date().toLocaleString()}] command failed ${room.name}: ${error.message}`);
  }
}

console.log(`local live capture agent started: ${serverUrl}, poll=${pollMs}ms, headless=${headless}, once=${runOnce}, force=${forceNow}, cdp=${Boolean(cdpUrl)}, profile=${userDataDir || "none"}`);
await tick().catch((error) => console.error(error.message));
await commandTick().catch((error) => console.error(error.message));
if (runOnce) {
  console.log("one-shot run finished");
} else {
  setInterval(() => tick().catch((error) => console.error(error.message)), pollMs);
  setInterval(() => commandTick().catch((error) => console.error(error.message)), 5000);
}

import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const serverUrl = process.env.LIVE_SERVER_URL || "http://124.222.223.153";
const pollMs = Number(process.env.LIVE_CAPTURE_POLL_MS || 60_000);
const storageState =
  process.env.LIVE_CAPTURE_STORAGE_STATE || path.join(process.cwd(), "secrets", "douyin-storage-state.json");
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
const SEARCH_MAX_LIMIT = 12;

const CN = {
  live: "\u76f4\u64ad",
  liveRoom: "\u76f4\u64ad\u95f4",
  liveNow: "\u76f4\u64ad\u4e2d",
  living: "\u6b63\u5728\u76f4\u64ad",
  verify: "\u9a8c\u8bc1",
  verifyContinue: "\u9a8c\u8bc1\u540e\u7ee7\u7eed",
  smsVerify: "\u77ed\u4fe1\u9a8c\u8bc1",
  qrLogin: "\u626b\u7801\u767b\u5f55",
  loginAfter: "\u767b\u5f55\u540e\u5373\u53ef",
  ended: "\u76f4\u64ad\u5df2\u7ed3\u675f",
  away: "\u4e3b\u64ad\u6682\u65f6\u79bb\u5f00",
  notStarted: "\u6682\u672a\u5f00\u64ad",
  noLive: "\u6682\u65e0\u76f4\u64ad",
  follow: "\u4f60\u7684\u5173\u6ce8",
  pressF: "\u70b9\u51fb\u6216\u6309F\u8fdb\u5165\u76f4\u64ad\u95f4"
};

const LIVE_HINT_RE = new RegExp(`${CN.liveNow}|${CN.living}|${CN.liveRoom}|${CN.live}|${CN.follow}`);
const VERIFY_RE = new RegExp(`${CN.verifyContinue}|${CN.smsVerify}|${CN.verify}|${CN.qrLogin}|${CN.loginAfter}`);
const END_RE = new RegExp(`${CN.ended}|${CN.away}|${CN.notStarted}|${CN.noLive}`);
const ENTER_RE = new RegExp(CN.pressF);
const GENERIC_LIVE_TITLES = new Set([
  "live",
  CN.live.toLowerCase(),
  CN.liveRoom.toLowerCase(),
  CN.living.toLowerCase()
]);

function todayKey(roomId, time) {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${day}:${roomId}:${time}`;
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function makeTempRoom(id, name, url) {
  return { id, name, url, publishTime: "", enabled: false, notes: "", createdAt: new Date().toISOString() };
}

function candidateId(keyword, index) {
  const safe = keyword.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").slice(0, 28) || "keyword";
  return `search-${safe}-${Date.now().toString(36)}-${index + 1}`;
}

function isSpecificLiveRoomUrl(value) {
  const url = String(value || "").toLowerCase();
  if (!url) return false;
  if (/^https:\/\/live\.douyin\.com\/?$/.test(url)) return false;
  if (/^https:\/\/www\.douyin\.com\/live\/?$/.test(url)) return false;
  return /live\.douyin\.com\/[^/?#]+/.test(url) || /douyin\.com\/live\/[^/?#]+/.test(url);
}

function extractLiveIdentity(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  const match =
    url.match(/live\.douyin\.com\/([^/?#]+)/i) ||
    url.match(/douyin\.com\/live\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase() || "";
}

function isGenericLiveTitle(value) {
  return GENERIC_LIVE_TITLES.has(String(value || "").trim().toLowerCase());
}

const BADGE_TEXTS = new Set(["认证徽章", "认证", "认证账号", "官方认证", "蓝v认证"]);
function isBadgeText(value) {
  return BADGE_TEXTS.has(String(value || "").trim());
}

async function getStore() {
  const res = await fetch(new URL("/api/live/rooms", serverUrl), { cache: "no-store" });
  if (!res.ok) throw new Error(`read rooms failed: ${res.status}`);
  return res.json();
}

async function uploadShot(room, bytes, message = "Local computer live screenshot upload.", keyword = "") {
  const form = new FormData();
  form.append("roomId", room.id);
  form.append("roomName", room.name || "live shot");
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
    const context =
      browser.contexts()[0] || (await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 }));
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

async function prepareCurrentPage(page) {
  await page.setViewportSize(VIEWPORT).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  await page.keyboard.press("KeyB").catch(() => undefined);
  await page.waitForTimeout(500);
  await page.addStyleTag({
    content: `
      [class*="danmu" i], [class*="barrage" i], [class*="comment" i],
      [data-e2e*="comment" i], [data-e2e*="danmu" i],
      [data-e2e*="live-player-bottom" i], [class*="liveBottom" i],
      [class*="bottom-bar" i], [class*="bottomBar" i],
      [class*="xgplayer-controls" i], [class*="live-control" i],
      [class*="liveControl" i], [class*="toolbar" i][class*="live" i] {
        visibility: hidden !important;
      }
    `
  }).catch(() => undefined);
}

async function prepareLivePage(page, url) {
  await page.setViewportSize(VIEWPORT).catch(() => undefined);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await prepareCurrentPage(page);
}

async function readLiveState(page) {
  return page.evaluate(
    ({ verifyRe, endRe, liveHintRe, enterRe }) => {
      const text = document.body?.innerText || "";
      const url = location.href;
      const title = document.title || "";
      const merged = `${title}\n${text}`;
      const videoCount = Array.from(document.querySelectorAll("video")).filter((video) => {
        const rect = video.getBoundingClientRect();
        return rect.width > 120 && rect.height > 120;
      }).length;
      const hasCanvas = Array.from(document.querySelectorAll("canvas")).some((canvas) => {
        const rect = canvas.getBoundingClientRect();
        return rect.width > 300 && rect.height > 300;
      });
      const blocked = new RegExp(verifyRe).test(merged);
      const ended = new RegExp(endRe).test(text);
      const looksLive = videoCount > 0 || hasCanvas || new RegExp(liveHintRe).test(text) || /live\.douyin\.com/.test(url);
      const needsEnter = new RegExp(enterRe).test(text);
      return { blocked, ended, looksLive, needsEnter, videoCount, hasCanvas, url, title, text: text.slice(0, 2000) };
    },
    {
      verifyRe: VERIFY_RE.source,
      endRe: END_RE.source,
      liveHintRe: LIVE_HINT_RE.source,
      enterRe: ENTER_RE.source
    }
  );
}

async function getLargestMediaRect(page) {
  return page.evaluate(() => {
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

async function captureCleanLive(page) {
  // 直接截 1080×1920 全屏 viewport，保证无缝隙
  return page.screenshot({ fullPage: false, type: "jpeg", quality: 85 });
}

function isSearchPageUrl(url) {
  return /douyin\.com\/search\//i.test(url) || /type=live/i.test(url);
}

async function tryEnterLiveRoom(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = await readLiveState(page);
    if (!state.needsEnter && !isSearchPageUrl(state.url)) return state;

    await page.keyboard.press("KeyF").catch(() => undefined);
    await page.waitForTimeout(1800);

    const mediaRect = await getLargestMediaRect(page);
    if (mediaRect) {
      const centerX = Math.floor(mediaRect.x + mediaRect.width / 2);
      const centerY = Math.floor(mediaRect.y + mediaRect.height / 2);
      await page.mouse.click(centerX, centerY).catch(() => undefined);
      await page.waitForTimeout(1800);
    }

    await prepareCurrentPage(page);
  }
  return readLiveState(page);
}

async function captureRoom(room) {
  return withBrowser(async (context) => {
    const page = await context.newPage();
    try {
      await prepareLivePage(page, room.url);
      const state = await tryEnterLiveRoom(page);
      if (state.blocked || state.ended || !state.looksLive) {
        throw new Error("not a valid live room or verification is required");
      }
      return await captureCleanLive(page);
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}

async function extractCandidates(page, keyword, limit) {
  return page.evaluate(
    ({ normalizedKeyword, max, liveHintRe }) => {
      const seen = new Set();
      const items = [];

      function normalize(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[^\p{L}\p{N}]+/gu, "");
      }

      function isSpecificLiveUrl(url) {
        return /live\.douyin\.com\/[^/?#]+/i.test(url) || /douyin\.com\/live\/[^/?#]+/i.test(url);
      }

      function pickCard(anchor) {
        let node = anchor;
        let best = anchor;
        for (let depth = 0; depth < 8 && node; depth += 1) {
          const rect = node.getBoundingClientRect();
          const text = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (rect.width > 280 && rect.height > 48 && text.length >= 8 && text.length <= 320) {
            best = node;
          }
          node = node.parentElement;
        }
        return best;
      }

      function liveRoomKey(url) {
        const match = String(url).match(/live\.douyin\.com\/([^/?#]+)/i) || String(url).match(/douyin\.com\/live\/([^/?#]+)/i);
        return match?.[1] || url;
      }

      for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
        const rawHref = anchor.getAttribute("href") || "";
        let url = "";
        try {
          url = new URL(rawHref, location.origin).toString();
        } catch {
          continue;
        }

        if (!isSpecificLiveUrl(url)) continue;

        const card = pickCard(anchor);
        const rect = card.getBoundingClientRect();
        const text = (anchor.textContent || "").replace(/\s+/g, " ").trim();
        const cardText = (card.textContent || "").replace(/\s+/g, " ").trim();
        const inMainColumn = rect.left < window.innerWidth * 0.78;
        const inViewportBand = rect.top > 80 && rect.top < window.innerHeight * 3;
        const keywordMatched =
          !normalizedKeyword ||
          normalize(text).includes(normalizedKeyword) ||
          normalize(cardText).includes(normalizedKeyword) ||
          normalize(url).includes(normalizedKeyword);
        const liveMatched = new RegExp(liveHintRe).test(cardText) || new RegExp(liveHintRe).test(text);
        const roomKey = liveRoomKey(url);
        if (!inMainColumn || !inViewportBand || !keywordMatched || !liveMatched || seen.has(roomKey)) continue;

        seen.add(roomKey);
        items.push({
          roomKey,
          title: text.slice(0, 120) || cardText.slice(0, 120) || "live room",
          context: cardText.slice(0, 240),
          url,
          top: rect.top,
          left: rect.left
        });
      }

      items.sort((a, b) => (a.top - b.top) || (a.left - b.left));
      return items.slice(0, max);
    },
    {
      normalizedKeyword: normalizeText(keyword),
      max: limit,
      liveHintRe: LIVE_HINT_RE.source
    }
  );
}

async function searchAndCapture(command) {
  const keyword = (command.keyword || "").trim();
  const limit = Math.max(1, Math.min(Number(command.limit || 4), SEARCH_MAX_LIMIT));
  const normalizedKeyword = normalizeText(keyword);
  if (!keyword) throw new Error("keyword is required");

  return withBrowser(async (context) => {
    const page = await context.newPage();
    const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=live`;
    console.log(`[${new Date().toLocaleString()}] search live keyword=${keyword}, limit=${limit}`);

    try {
      await page.setViewportSize(VIEWPORT).catch(() => undefined);
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(3500);

      const searchState = await readLiveState(page);
      if (searchState.blocked) {
        throw new Error(`search page requires verification: ${searchState.title || searchState.url}`);
      }

      for (let i = 0; i < 4; i += 1) {
        await page.mouse.wheel(0, 800).catch(() => undefined);
        await page.waitForTimeout(900);
      }

      const candidates = await extractCandidates(page, keyword, limit * 3);
      console.log(`[${new Date().toLocaleString()}] matched ${candidates.length} live candidates`);
      if (!candidates.length) {
        throw new Error(`no matched live candidates found for keyword "${keyword}"`);
      }

      let uploaded = 0;
      const uploadedLiveIds = new Set();
      for (const [index, candidate] of candidates.entries()) {
        if (uploaded >= limit) break;
        const livePage = await context.newPage();
        try {
          console.log(
            `[${new Date().toLocaleString()}] candidate ${index + 1}/${candidates.length}: ${candidate.title} -> ${candidate.url}`
          );
          await prepareLivePage(livePage, candidate.url);
          const state = await tryEnterLiveRoom(livePage);
          const titleMatched = normalizeText(candidate.title).includes(normalizedKeyword);
          const pageMatched = normalizeText(`${state.title}\n${state.text}`).includes(normalizedKeyword);
          const openedLiveId = extractLiveIdentity(state.url);
          const candidateLiveId = extractLiveIdentity(candidate.url);
          const liveIdentity = openedLiveId || candidateLiveId;
          const specificRoom = Boolean(openedLiveId);

          if (
            state.blocked ||
            state.ended ||
            !state.looksLive ||
            !specificRoom ||
            (!titleMatched && !pageMatched) ||
            isGenericLiveTitle(candidate.title)
          ) {
            console.log(`[${new Date().toLocaleString()}] skip candidate after open: ${candidate.url}`);
            continue;
          }

          if (uploadedLiveIds.has(liveIdentity)) {
            console.log(`[${new Date().toLocaleString()}] skip duplicate live room: ${liveIdentity}`);
            continue;
          }

          uploadedLiveIds.add(liveIdentity);
          const fromPageTitle = state.title && !isGenericLiveTitle(state.title) ? state.title : "";
          const fromCandidateTitle = !isGenericLiveTitle(candidate.title) && !isBadgeText(candidate.title) ? candidate.title : "";
          const roomTitle = fromPageTitle || fromCandidateTitle || candidate.context || `${keyword} live ${uploaded + 1}`;
          const room = makeTempRoom(candidateId(keyword, uploaded), roomTitle, state.url || candidate.url);
          const bytes = await captureCleanLive(livePage);
          await uploadShot(room, bytes, `Keyword ${keyword} live screenshot #${uploaded + 1}.`, keyword);
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

  if (!dueRooms.length) {
    console.log(`[${new Date().toLocaleString()}] no rooms due`);
  }

  for (const room of dueRooms) {
    const key = todayKey(room.id, room.publishTime);
    if (!forceNow && fired.has(key)) continue;
    fired.add(key);
    try {
      console.log(`[${new Date().toLocaleString()}] capture room=${room.name}`);
      const bytes = await captureRoom(room);
      await uploadShot(room, bytes);
      console.log(`[${new Date().toLocaleString()}] uploaded room=${room.name}`);
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] room=${room.name} error=${error.message}`);
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
      console.log(`[${new Date().toLocaleString()}] search command uploaded ${count} screenshots`);
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
    console.log(`[${new Date().toLocaleString()}] command capture room=${room.name}`);
    const bytes = await captureRoom(room);
    await uploadShot(room, bytes);
    await finishCommand(command.id, "done");
    console.log(`[${new Date().toLocaleString()}] command uploaded room=${room.name}`);
  } catch (error) {
    await finishCommand(command.id, "failed", error.message);
    console.error(`[${new Date().toLocaleString()}] command failed room=${room.name}: ${error.message}`);
  }
}

console.log(
  `local live capture agent started: ${serverUrl}, poll=${pollMs}ms, headless=${headless}, once=${runOnce}, force=${forceNow}, cdp=${Boolean(cdpUrl)}, profile=${userDataDir || "none"}`
);

await tick().catch((error) => console.error(error.message));
await commandTick().catch((error) => console.error(error.message));

if (runOnce) {
  console.log("one-shot run finished");
} else {
  setInterval(() => tick().catch((error) => console.error(error.message)), pollMs);
  setInterval(() => commandTick().catch((error) => console.error(error.message)), 5000);
}

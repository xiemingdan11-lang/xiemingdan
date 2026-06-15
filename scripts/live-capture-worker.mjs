const baseUrl = process.env.LIVE_CAPTURE_BASE_URL || "http://localhost:3000";
const pollMs = Number(process.env.LIVE_CAPTURE_POLL_MS || 60_000);
const fired = new Set();

function todayKey(roomId, time) {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${day}:${roomId}:${time}`;
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

async function getStore() {
  const res = await fetch(new URL("/api/live/rooms", baseUrl), { cache: "no-store" });
  if (!res.ok) throw new Error(`读取直播间失败: ${res.status}`);
  return res.json();
}

async function capture(room) {
  const res = await fetch(new URL("/api/live/capture", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: room.id })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${room.name} 截图失败`);
  return data;
}

async function tick() {
  const store = await getStore();
  const now = currentTime();
  const dueRooms = (store.rooms || []).filter((room) => room.enabled && room.publishTime === now);

  for (const room of dueRooms) {
    const key = todayKey(room.id, room.publishTime);
    if (fired.has(key)) continue;
    fired.add(key);

    try {
      console.log(`[${new Date().toLocaleString()}] capture ${room.name}`);
      await capture(room);
      console.log(`[${new Date().toLocaleString()}] done ${room.name}`);
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] ${error.message}`);
    }
  }
}

console.log(`live capture worker started: ${baseUrl}, poll ${pollMs}ms`);
await tick().catch((error) => console.error(error.message));
setInterval(() => tick().catch((error) => console.error(error.message)), pollMs);

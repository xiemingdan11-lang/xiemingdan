import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type LiveRoom = {
  id: string;
  name: string;
  url: string;
  publishTime: string;
  enabled: boolean;
  notes: string;
  createdAt: string;
  lastRunAt?: string;
  lastShotId?: string;
  lastError?: string;
};

export type LiveShot = {
  id: string;
  roomId: string;
  roomName: string;
  imageUrl: string;
  pageUrl: string;
  status: "published" | "failed";
  capturedAt: string;
  message?: string;
  keyword?: string;
};

export type AgentCommand = {
  id: string;
  type: "capture-room" | "search-capture";
  status: "pending" | "running" | "done" | "failed";
  roomId?: string;
  keyword?: string;
  limit?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  resultCount?: number;
};

export type LiveStore = {
  rooms: LiveRoom[];
  shots: LiveShot[];
  commands?: AgentCommand[];
};

const DATA_DIR = process.env.WORKBENCH_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "live-monitor.json");

const starterRoom: LiveRoom = {
  id: "demo-room",
  name: "示例直播间",
  url: "https://live.douyin.com/",
  publishTime: "09:30",
  enabled: false,
  notes: "替换成你有权访问的抖音直播间链接后启用。",
  createdAt: new Date().toISOString()
};

export async function readLiveStore(): Promise<LiveStore> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const store = JSON.parse(raw) as Partial<LiveStore>;
    return {
      rooms: Array.isArray(store.rooms) ? store.rooms : [starterRoom],
      shots: Array.isArray(store.shots) ? store.shots : [],
      commands: Array.isArray(store.commands) ? store.commands : []
    };
  } catch {
    return { rooms: [starterRoom], shots: [], commands: [] };
  }
}

export async function writeLiveStore(store: LiveStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeRoom(input: Partial<LiveRoom>): LiveRoom {
  const now = new Date().toISOString();
  return {
    id: input.id || makeId("room"),
    name: String(input.name || "未命名直播间").trim(),
    url: String(input.url || "").trim(),
    publishTime: /^\d{2}:\d{2}$/.test(String(input.publishTime)) ? String(input.publishTime) : "09:30",
    enabled: Boolean(input.enabled),
    notes: String(input.notes || "").trim(),
    createdAt: input.createdAt || now,
    lastRunAt: input.lastRunAt,
    lastShotId: input.lastShotId,
    lastError: input.lastError
  };
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

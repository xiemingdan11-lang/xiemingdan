// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
function genId() {
  return "room-" + Math.random().toString(36).slice(2, 10);
}

// RGB → HSL → clamp sat/light → RGB（把提取色处理成环境光色调）
function processColorForAmbient(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  // 饱和度 18–38%，亮度 28–52%
  const sc = Math.min(0.38, Math.max(0.18, s));
  const lc = Math.min(0.52, Math.max(0.28, l));
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  const q = lc < 0.5 ? lc * (1 + sc) : lc + sc - lc * sc;
  const p = 2 * lc - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// 主色提取 — 过滤极黑/极白/低饱和，优先中等亮度色
function getDominantColor(img) {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const size = 64;
    canvas.width = size; canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i], green = data[i + 1], blue = data[i + 2];
      const brightness = (red + green + blue) / 3;
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (brightness < 35 || brightness > 235 || saturation < 25) continue;
      r += red; g += green; b += blue; count++;
    }
    if (!count) return [68, 112, 145];
    return processColorForAmbient(
      Math.round(r / count),
      Math.round(g / count),
      Math.round(b / count)
    );
  } catch {
    return [68, 112, 145];
  }
}

// ─── 全局样式 ──────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; overflow-x: hidden;
    background: #020409;
    font-family: 'Inter', 'Microsoft YaHei', system-ui, sans-serif;
    color: #eef6ff;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(120,165,205,0.18); border-radius: 2px; }

  .glass {
    background: rgba(255,255,255,0.045);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border: 1px solid rgba(190,220,255,0.10);
  }
  /* 深色玻璃按钮 — 取代所有亮蓝按钮 */
  .btn-blue {
    background: rgba(110,150,200,0.14);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(180,215,255,0.18);
    color: rgba(238,246,255,0.88); cursor: pointer;
    transition: all 0.22s ease; font-family: inherit;
    box-shadow: 0 0 24px rgba(100,160,220,0.14), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .btn-blue:hover {
    background: rgba(110,150,200,0.24);
    border-color: rgba(180,215,255,0.32);
    color: #eef6ff;
    box-shadow: 0 0 36px rgba(100,160,220,0.22), inset 0 1px 0 rgba(255,255,255,0.12);
    transform: translateY(-1px);
  }
  .btn-blue:disabled { opacity: 0.38; cursor: not-allowed; transform: none; }
  .btn-glass {
    background: rgba(255,255,255,0.055);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(190,220,255,0.10);
    color: rgba(238,246,255,0.58); cursor: pointer;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-glass:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(180,215,255,0.22);
    color: #eef6ff;
  }
  .inp-glass {
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(190,220,255,0.10);
    color: #eef6ff; font-family: inherit; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .inp-glass::placeholder { color: rgba(148,163,184,0.35); }
  .inp-glass:focus {
    border-color: rgba(120,165,205,0.42);
    box-shadow: 0 0 0 3px rgba(68,112,145,0.12);
  }
  .mode-btn {
    cursor: pointer; transition: all 0.2s ease;
    font-family: inherit; border: none; background: transparent;
    position: relative; padding: 10px 20px;
  }
  .mode-btn::after {
    content: ''; position: absolute;
    bottom: 0; left: 50%; right: 50%; height: 2px;
    border-radius: 1px; background: rgba(120,165,205,0.70);
    transition: left 0.25s ease, right 0.25s ease, box-shadow 0.25s ease;
  }
  .mode-btn.active { color: rgba(190,225,255,0.90); font-weight: 600; }
  .mode-btn.active::after { left: 18%; right: 18%; box-shadow: 0 0 10px rgba(88,145,190,0.55); }
  .mode-btn:not(.active) { color: rgba(148,163,184,0.5); }
  .mode-btn:hover:not(.active) { color: rgba(238,246,255,0.75); }
  .tab-pill {
    cursor: pointer; transition: all 0.2s ease;
    white-space: nowrap; font-family: inherit; border: 1px solid transparent;
  }
  .tab-pill.active {
    background: rgba(68,112,145,0.18);
    border-color: rgba(120,165,205,0.30);
    color: rgba(190,225,255,0.90);
    box-shadow: 0 0 18px rgba(68,112,145,0.18);
  }
  .tab-pill:not(.active) { background: rgba(255,255,255,0.045); color: rgba(148,163,184,0.7); }
  .tab-pill:not(.active):hover { background: rgba(255,255,255,0.075); color: #eef6ff; }

  /* LIVE card grid */
  .room-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 28px;
  }
  @media (max-width: 1100px) { .room-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; } }
  @media (max-width: 760px)  { .room-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }

  .live-card-wrap {
    position: relative;
    transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), z-index 0s;
  }
  .live-card-wrap:hover { transform: translateY(-10px) scale(1.018); z-index: 10; }

  .live-card {
    position: relative; border-radius: 28px; overflow: hidden;
    aspect-ratio: 9/16; width: 100%;
    background: rgba(7,14,26,0.65);
  }
  .live-card img {
    position: absolute; inset: 0;
    width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.45s ease;
  }
  .live-card-wrap:hover .live-card img { transform: scale(1.04); }

  @keyframes livepulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
    50%       { opacity: 0.7; box-shadow: 0 0 0 4px rgba(52,211,153,0); }
  }
  .live-dot { animation: livepulse 2.2s ease infinite; }

  .drawer-overlay {
    position: fixed; inset: 0; z-index: 40;
    background: rgba(2,4,9,0.72);
    backdrop-filter: blur(6px); animation: fadein 0.2s ease;
  }
  .drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 50; width: 380px;
    background: rgba(5,8,18,0.96);
    backdrop-filter: blur(36px);
    border-left: 1px solid rgba(190,220,255,0.08);
    box-shadow: -30px 0 80px rgba(0,0,0,0.85);
    animation: slidein 0.25s ease; overflow-y: auto;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .status-dot.on    { background: #34d399; box-shadow: 0 0 6px #34d399; }
  .status-dot.off   { background: #374151; }
  .status-dot.error { background: #f87171; box-shadow: 0 0 6px #f87171; }

  @keyframes fadein  { from { opacity: 0; }               to { opacity: 1; } }
  @keyframes slidein { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes spin    { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }

  select.inp-glass option { background: #07111c; color: #eef6ff; }
`;

// ─── 动态环境光背景 ──────────────────────────────────────────────────────────
function AmbientBackground({ color }) {
  const [r, g, b] = color;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: -3, background: "#020409" }} />
      {/* Noise 纹理 */}
      <svg style={{ position: "fixed", inset: 0, zIndex: -2, opacity: 0.038, width: "100%", height: "100%", pointerEvents: "none" }}>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)"/>
      </svg>
      {/* 动态环境光层 — 柔和扩散，边缘自然消失 */}
      <div style={{
        position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
        transition: "background 0.55s ease",
        background: `
          radial-gradient(circle at 50% 35%, rgba(${r},${g},${b},0.20), transparent 36%),
          radial-gradient(circle at 20% 80%, rgba(${r},${g},${b},0.10), transparent 32%),
          radial-gradient(circle at 80% 70%, rgba(${r},${g},${b},0.08), transparent 34%),
          linear-gradient(180deg, #05070b 0%, #07101a 45%, #020409 100%)
        `,
      }} />
    </>
  );
}

// ─── 主视觉卡片（9:16）────────────────────────────────────────────────────────
function LiveCard({ id, name, imgSrc, enabled, lastRunAt, lastError, onColorReady, onHover, onLeave }) {
  const [clr, setClr] = useState([68, 112, 145]);
  const [r, g, b] = clr;

  function onImgLoad(e) {
    const c = getDominantColor(e.currentTarget);
    setClr(c);
    onColorReady?.(id, c);
  }

  return (
    <div className="live-card-wrap"
      onMouseEnter={() => onHover?.(id, clr)}
      onMouseLeave={onLeave}
      style={{ paddingBottom: 52 }}
    >
      {/* 卡片背后环境光晕 — 大范围低透明度 */}
      <div style={{
        position: "absolute", inset: "-24px -24px 60px",
        background: `radial-gradient(circle at 50% 58%, rgba(${r},${g},${b},0.22), transparent 68%)`,
        filter: "blur(48px)", zIndex: 0, pointerEvents: "none",
        transition: "background 0.5s ease",
      }}/>

      {/* 卡片本体 */}
      <div className="live-card" style={{
        position: "relative", zIndex: 1,
        border: `1px solid rgba(180,215,255,0.16)`,
        boxShadow: `
          0 28px 90px rgba(0,0,0,0.65),
          0 0 70px rgba(${r},${g},${b},0.22),
          inset 0 0 30px rgba(255,255,255,0.05),
          inset 0 1px 0 rgba(255,255,255,0.10)
        `,
        transition: "border-color 0.5s ease, box-shadow 0.5s ease",
      }}>
        {/* 图片 / 占位 */}
        {imgSrc ? (
          <img src={imgSrc} alt={name} onLoad={onImgLoad} crossOrigin="anonymous" />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(160deg, rgba(${r},${g},${b},0.08), rgba(0,0,0,0.5))`,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 14,
          }}>
            <span style={{ fontSize: 38, opacity: 0.16 }}>📱</span>
            <span style={{ fontSize: 12, color: "rgba(148,163,184,0.35)", textAlign: "center", padding: "0 20px" }}>
              暂无截图
            </span>
          </div>
        )}

        {/* 顶部暗遮罩 */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "38%",
          background: "linear-gradient(to bottom, rgba(2,4,9,0.65), transparent)",
          pointerEvents: "none", zIndex: 2,
        }}/>
        {/* 底部渐变遮罩 */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
          background: "linear-gradient(to top, rgba(2,4,9,0.97) 0%, rgba(5,7,16,0.72) 46%, transparent)",
          pointerEvents: "none", zIndex: 2,
        }}/>

        {/* 顶部徽章 */}
        <div style={{
          position: "absolute", top: 13, left: 13, right: 13,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 3,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 8,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <span className="live-dot" style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#34d399", display: "inline-block",
            }}/>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: 1 }}>LIVE</span>
          </div>
          <div style={{
            padding: "3px 10px", borderRadius: 7, backdropFilter: "blur(10px)",
            background: lastError
              ? "rgba(239,68,68,0.14)"
              : enabled ? "rgba(52,211,153,0.10)" : "rgba(55,65,81,0.18)",
            border: `1px solid ${lastError
              ? "rgba(239,68,68,0.28)"
              : enabled ? "rgba(52,211,153,0.24)" : "rgba(55,65,81,0.28)"}`,
            fontSize: 11, fontWeight: 600,
            color: lastError ? "#f87171" : enabled ? "#34d399" : "#4b5563",
          }}>
            {lastError ? "失败" : enabled ? "启用" : "关闭"}
          </div>
        </div>

        {/* 底部信息 */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 18px", zIndex: 3 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: "#eef6ff", marginBottom: 7,
            lineHeight: 1.3, textShadow: "0 1px 12px rgba(0,0,0,0.95)",
          }}>
            {name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span className="status-dot on" style={{ width: 5, height: 5 }}/>
            <span style={{ fontSize: 11, color: "rgba(238,246,255,0.55)" }}>已抓取</span>
            {lastRunAt && (
              <span style={{ fontSize: 11, color: "rgba(148,163,184,0.38)", marginLeft: "auto" }}>
                {fmtTime(lastRunAt)}
              </span>
            )}
          </div>
        </div>

        {/* 顶部高光线 */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1, zIndex: 4,
          background: "linear-gradient(to right, transparent 5%, rgba(255,255,255,0.20) 40%, rgba(255,255,255,0.12) 60%, transparent 95%)",
        }}/>
        {/* 左侧高光线 */}
        <div style={{
          position: "absolute", top: "5%", left: 0, bottom: "5%", width: 1, zIndex: 4,
          background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.04) 60%, transparent)",
        }}/>
      </div>

      {/* 底部反光 */}
      <div style={{
        position: "absolute", bottom: 0,
        left: "10%", right: "10%", height: 52,
        background: `radial-gradient(ellipse at center, rgba(${r},${g},${b},0.30), transparent 68%)`,
        filter: "blur(22px)", opacity: 0.6, pointerEvents: "none",
        transition: "background 0.5s ease",
      }}/>
    </div>
  );
}

// ─── 空状态占位 ───────────────────────────────────────────────────────────────
function EmptyDisplayState({ onAddRoom }) {
  return (
    <div style={{ padding: "32px 32px 60px", maxWidth: 1400, margin: "0 auto" }}>
      <div className="room-grid">
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ paddingBottom: 48, position: "relative" }}>
            <div style={{
              aspectRatio: "9/16", borderRadius: 28,
              background: "rgba(255,255,255,0.018)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(180,215,255,0.10)",
              boxShadow: "0 0 40px rgba(68,112,145,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 14,
            }}>
              {i === 1 ? (
                <>
                  <div style={{ fontSize: 34, opacity: 0.14 }}>📺</div>
                  <div style={{
                    fontSize: 13, color: "rgba(148,163,184,0.32)",
                    textAlign: "center", padding: "0 22px", lineHeight: 1.7,
                  }}>
                    暂无直播间<br/>请先新增直播间
                  </div>
                  <button className="btn-blue" onClick={onAddRoom}
                    style={{ marginTop: 6, padding: "8px 22px", borderRadius: 10, fontSize: 13, fontWeight: 500 }}>
                    + 新增直播间
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 26, opacity: 0.055 }}>📱</div>
              )}
            </div>
            <div style={{
              position: "absolute", bottom: 0, left: "10%", right: "10%", height: 48,
              background: "radial-gradient(ellipse at center, rgba(68,112,145,0.14), transparent 68%)",
              filter: "blur(18px)", opacity: 0.5, pointerEvents: "none",
            }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 最近截图小卡片 ──────────────────────────────────────────────────────────
function MiniCard({ shot }) {
  const [clr, setClr] = useState([68, 112, 145]);
  const [r, g, b] = clr;
  const [hover, setHover] = useState(false);
  return (
    <div style={{
      flexShrink: 0, width: 108,
      transform: hover ? "translateY(-5px)" : "translateY(0)",
      transition: "transform 0.22s ease", cursor: "pointer",
    }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        borderRadius: 14, overflow: "hidden", aspectRatio: "9/16",
        background: "#07111c",
        border: `1px solid rgba(${r},${g},${b},0.22)`,
        boxShadow: `0 8px 26px rgba(0,0,0,0.65), 0 0 18px rgba(${r},${g},${b},0.16)`,
        marginBottom: 7, position: "relative",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}>
        <img
          src={shot.imageUrl}
          alt={shot.keyword || shot.roomName}
          onLoad={e => setClr(getDominantColor(e.currentTarget))}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "45%",
          background: "linear-gradient(to top, rgba(2,4,9,0.92), transparent)",
        }}/>
      </div>
      <div style={{ fontSize: 11, color: "rgba(238,246,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
        {shot.keyword || shot.roomName || "截图"}
      </div>
      <div style={{ fontSize: 10, color: "rgba(148,163,184,0.45)", marginTop: 2 }}>
        {fmtTime(shot.capturedAt)}
      </div>
    </div>
  );
}

// ─── 展示模式主体 ─────────────────────────────────────────────────────────────
function DisplayMode({ rooms, shots, onCapture, onAddRoom }) {
  const DEFAULT_COLOR = [68, 112, 145];
  const [ambientColor, setAmbientColor] = useState(DEFAULT_COLOR);
  const [colorMap, setColorMap] = useState({});
  const [activeTab, setActiveTab] = useState("全部");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState("");

  const catSet = new Set();
  shots.forEach(s => { if (s.keyword || s.roomName) catSet.add(s.keyword || s.roomName); });
  const categories = ["全部", ...Array.from(catSet)];

  const filteredRooms = activeTab === "全部"
    ? rooms
    : rooms.filter(r =>
        shots.some(s => s.roomId === r.id && (s.keyword === activeTab || s.roomName === activeTab))
      );

  function handleColorReady(id, color) {
    setColorMap(prev => {
      const next = { ...prev, [id]: color };
      const firstRoom = (activeTab === "全部" ? rooms : filteredRooms)[0];
      if (firstRoom && firstRoom.id === id && Object.keys(prev).length === 0) {
        setAmbientColor(color);
      }
      return next;
    });
  }

  function handleHover(id, color) {
    setAmbientColor(color || colorMap[id] || DEFAULT_COLOR);
  }
  function handleLeave() {
    const firstId = (activeTab === "全部" ? rooms : filteredRooms)[0]?.id;
    setAmbientColor(firstId && colorMap[firstId] ? colorMap[firstId] : DEFAULT_COLOR);
  }

  async function handleCapture() {
    if (!keyword.trim()) return;
    setCapturing(true);
    setCaptureMsg("");
    try {
      const res = await fetch("/api/live/agent/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "search-capture", keyword: keyword.trim(), limit: 1 }),
      });
      if (res.ok) {
        setCaptureMsg("✅ 指令已发送，等待共享电脑抓取...");
        onCapture();
        setTimeout(() => { setDrawerOpen(false); setCaptureMsg(""); setKeyword(""); }, 2500);
      } else {
        const j = await res.json().catch(() => ({}));
        setCaptureMsg("❌ " + (j.error || "发送失败，请重试"));
      }
    } catch {
      setCaptureMsg("❌ 网络错误，请检查连接");
    } finally {
      setCapturing(false);
    }
  }

  async function handleCaptureRoom(roomId) {
    try {
      const res = await fetch("/api/live/agent/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "capture-room", roomId }),
      });
      if (res.ok) {
        setCaptureMsg("✅ 指令已发送");
        onCapture();
        setTimeout(() => { setDrawerOpen(false); setCaptureMsg(""); }, 2000);
      } else {
        const j = await res.json().catch(() => ({}));
        setCaptureMsg("❌ " + (j.error || "发送失败"));
      }
    } catch {
      setCaptureMsg("❌ 网络错误");
    }
  }

  const hasRooms = rooms.length > 0;
  const hasShots = shots.length > 0;

  return (
    <>
      <AmbientBackground color={ambientColor} />

      <div style={{ minHeight: "100vh", paddingBottom: 70 }}>
        {/* 分类胶囊 Tabs */}
        {(hasRooms || hasShots) && (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "22px 32px 0" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {categories.map(cat => (
                <button key={cat}
                  className={`tab-pill${activeTab === cat ? " active" : ""}`}
                  onClick={() => setActiveTab(cat)}
                  style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500 }}>
                  {cat}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button className="btn-blue" onClick={() => setDrawerOpen(true)}
                style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
                📸 快速抓取
              </button>
            </div>
          </div>
        )}

        {/* 主内容 */}
        {!hasRooms && !hasShots ? (
          <EmptyDisplayState onAddRoom={onAddRoom} />
        ) : (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "30px 32px 0" }}>
            {filteredRooms.length > 0 ? (
              <div className="room-grid">
                {filteredRooms.map(room => (
                  <LiveCard
                    key={room.id}
                    id={room.id}
                    name={room.name}
                    imgSrc={room.lastShotId ? (shots.find(s => s.id === room.lastShotId)?.imageUrl || null) : null}
                    enabled={room.enabled}
                    lastRunAt={room.lastRunAt}
                    lastError={room.lastError}
                    onColorReady={handleColorReady}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: "center", padding: "60px 0",
                color: "rgba(148,163,184,0.35)", fontSize: 14,
              }}>
                该分类下暂无直播间截图
              </div>
            )}

            {hasShots && (
              <div style={{ marginTop: 52 }}>
                <div style={{
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(148,163,184,0.35)", marginBottom: 16, paddingLeft: 2,
                }}>
                  最近截图 · {shots.length} 张
                </div>
                <div style={{
                  display: "flex", gap: 14,
                  overflowX: "auto", paddingBottom: 12,
                  scrollbarWidth: "none", msOverflowStyle: "none",
                }}>
                  {shots.slice(0, 24).map(shot => (
                    <MiniCard key={shot.id} shot={shot} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 快速抓取抽屉 */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="drawer" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "#eef6ff" }}>📸 快速抓取</span>
              <button className="btn-glass" onClick={() => setDrawerOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 8, fontSize: 20, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                ×
              </button>
            </div>
            <div style={{ marginBottom: 10, fontSize: 12, color: "rgba(148,163,184,0.48)" }}>
              关键词搜索抓取
            </div>
            <input className="inp-glass" value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCapture()}
              placeholder="例如：好奇 / Lily / 母婴"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, marginBottom: 14 }} />
            <button className="btn-blue" onClick={handleCapture} disabled={capturing || !keyword.trim()}
              style={{ width: "100%", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 500 }}>
              {capturing ? "⏳ 正在发送..." : "开始抓取"}
            </button>
            {captureMsg && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 9,
                background: captureMsg.startsWith("✅") ? "rgba(52,211,153,0.10)" : "rgba(239,68,68,0.10)",
                border: `1px solid ${captureMsg.startsWith("✅") ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
                fontSize: 13, color: captureMsg.startsWith("✅") ? "#34d399" : "#f87171",
                textAlign: "center", lineHeight: 1.5,
              }}>
                {captureMsg}
              </div>
            )}

            {rooms.length > 0 && (
              <div style={{ marginTop: 28, borderTop: "1px solid rgba(190,220,255,0.06)", paddingTop: 20 }}>
                <div style={{ fontSize: 12, color: "rgba(148,163,184,0.45)", marginBottom: 14 }}>
                  指定直播间抓取
                </div>
                {rooms.map(r => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", borderRadius: 10, marginBottom: 8,
                    background: "rgba(255,255,255,0.032)", border: "1px solid rgba(190,220,255,0.07)",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#eef6ff", fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", marginTop: 2 }}>
                        最近 {fmtTime(r.lastRunAt)}
                      </div>
                    </div>
                    <button className="btn-blue" onClick={() => handleCaptureRoom(r.id)}
                      style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500 }}>
                      抓取
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── 管理模式 ─────────────────────────────────────────────────────────────────
function ManageMode({ rooms, onSave }) {
  const [list, setList] = useState(rooms.map(r => ({ ...r })));
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", url: "", publishTime: "09:30", enabled: false, notes: "" });

  function update(id, field, val) {
    setList(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  }
  function remove(id) { setList(prev => prev.filter(r => r.id !== id)); }
  function addRoom() {
    if (!newRoom.name.trim() || !newRoom.url.trim()) return;
    const room = { ...newRoom, id: genId(), createdAt: new Date().toISOString(), lastRunAt: null, lastShotId: null, lastError: "" };
    setList(prev => [...prev, room]);
    setNewRoom({ name: "", url: "", publishTime: "09:30", enabled: false, notes: "" });
    setAddOpen(false);
  }
  async function save() {
    setSaving(true);
    try {
      await fetch("/api/live/rooms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: list }),
      });
      onSave(list);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#eef6ff" }}>直播间管理</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-glass" onClick={() => setAddOpen(true)}
            style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            + 新增
          </button>
          <button className="btn-blue" onClick={save} disabled={saving}
            style={{ padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 500 }}>
            {saving ? "保存中..." : "💾 保存"}
          </button>
        </div>
      </div>
      {addOpen && (
        <div className="glass" style={{ borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(190,225,255,0.80)", marginBottom: 16 }}>新增直播间</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="名称">
              <input className="inp-glass" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))}
                placeholder="直播间名称" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
            </FormField>
            <FormField label="发布时间">
              <input className="inp-glass" type="time" value={newRoom.publishTime}
                onChange={e => setNewRoom(p => ({ ...p, publishTime: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, colorScheme: "dark" }} />
            </FormField>
          </div>
          <FormField label="直播间链接" style={{ marginTop: 12 }}>
            <input className="inp-glass" value={newRoom.url} onChange={e => setNewRoom(p => ({ ...p, url: e.target.value }))}
              placeholder="https://live.douyin.com/..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
          </FormField>
          <FormField label="备注" style={{ marginTop: 12 }}>
            <input className="inp-glass" value={newRoom.notes} onChange={e => setNewRoom(p => ({ ...p, notes: e.target.value }))}
              placeholder="可选备注" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
          </FormField>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-blue" onClick={addRoom}
              style={{ padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 500 }}>
              确认添加
            </button>
            <button className="btn-glass" onClick={() => setAddOpen(false)}
              style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13 }}>
              取消
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(148,163,184,0.35)", fontSize: 14 }}>
            暂无直播间，点击右上角"新增"添加
          </div>
        ) : list.map(room => (
          <RoomEditCard key={room.id} room={room}
            onUpdate={(f, v) => update(room.id, f, v)}
            onRemove={() => remove(room.id)} />
        ))}
      </div>
    </div>
  );
}

function RoomEditCard({ room, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass" style={{ borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
        onClick={() => setExpanded(p => !p)}>
        <span className={`status-dot ${room.enabled ? "on" : "off"}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#eef6ff", marginBottom: 2 }}>{room.name}</div>
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {room.url}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "rgba(148,163,184,0.48)" }}>📅 {room.publishTime}</span>
          <ToggleSwitch checked={room.enabled} onChange={v => onUpdate("enabled", v)} />
          <span style={{ fontSize: 18, color: "rgba(148,163,184,0.38)", transition: "transform 0.2s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>›</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(190,220,255,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <FormField label="名称">
              <input className="inp-glass" value={room.name} onChange={e => onUpdate("name", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
            </FormField>
            <FormField label="发布时间">
              <input className="inp-glass" type="time" value={room.publishTime} onChange={e => onUpdate("publishTime", e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, colorScheme: "dark" }} />
            </FormField>
          </div>
          <FormField label="直播间链接" style={{ marginTop: 12 }}>
            <input className="inp-glass" value={room.url} onChange={e => onUpdate("url", e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
          </FormField>
          <FormField label="备注" style={{ marginTop: 12 }}>
            <input className="inp-glass" value={room.notes || ""} onChange={e => onUpdate("notes", e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
          </FormField>
          {room.lastError && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 9,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.16)" }}>
              <div style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.6 }}>
                ⚠️ {room.lastError.slice(0, 150)}...
              </div>
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onRemove}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "#f87171" }}>
              删除此直播间
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 历史模式 ─────────────────────────────────────────────────────────────────
function HistoryMode({ commands, shots, rooms }) {
  const [filterKw, setFilterKw] = useState("");
  const filtered = commands.filter(c => !filterKw || (c.keyword || "").toLowerCase().includes(filterKw.toLowerCase()));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#eef6ff" }}>历史记录</h2>
        <input className="inp-glass" value={filterKw} onChange={e => setFilterKw(e.target.value)}
          placeholder="筛选关键词..."
          style={{ padding: "7px 14px", borderRadius: 9, fontSize: 13, width: 200 }} />
      </div>
      <div style={{ position: "relative" }}>
        {/* 时间线竖线 */}
        <div style={{ position: "absolute", left: 17, top: 0, bottom: 0, width: 1, background: "rgba(68,112,145,0.18)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(148,163,184,0.35)", fontSize: 14 }}>
              暂无记录
            </div>
          ) : filtered.map(cmd => (
            <CommandRow key={cmd.id} cmd={cmd} rooms={rooms} />
          ))}
        </div>
      </div>
      {shots.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.38)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
            截图库 · {shots.length} 张
          </div>
          <div style={{ columns: "160px", columnGap: 12 }}>
            {shots.map(shot => (
              <div key={shot.id} style={{ breakInside: "avoid", marginBottom: 12 }}>
                <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "9/16", background: "#07101a", position: "relative" }}>
                  <img src={shot.imageUrl} alt={shot.keyword}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "45%",
                    background: "linear-gradient(to top, rgba(2,4,9,0.92), transparent)" }}/>
                  <div style={{ position: "absolute", bottom: 8, left: 9, right: 9 }}>
                    <div style={{ fontSize: 11, color: "#eef6ff", fontWeight: 500 }}>{shot.keyword || shot.roomName}</div>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,0.45)", marginTop: 2 }}>{fmtTime(shot.capturedAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommandRow({ cmd, rooms }) {
  const [exp, setExp] = useState(false);
  const isOk = cmd.status === "done", isFail = cmd.status === "failed";
  const room = rooms.find(r => r.id === cmd.roomId);
  const label = cmd.type === "capture-room"
    ? `抓取直播间：${room?.name || cmd.roomId}`
    : `搜索抓取：${cmd.keyword}`;
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1,
        background: isOk ? "rgba(52,211,153,0.10)" : isFail ? "rgba(239,68,68,0.10)" : "rgba(68,112,145,0.12)",
        border: `1px solid ${isOk ? "rgba(52,211,153,0.24)" : isFail ? "rgba(239,68,68,0.24)" : "rgba(68,112,145,0.28)"}`,
        fontSize: 14,
      }}>
        {isOk ? "✓" : isFail ? "✗" : "⏳"}
      </div>
      <div className="glass" style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: isFail ? "pointer" : "default" }}
          onClick={() => isFail && setExp(p => !p)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#eef6ff" }}>{label}</div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", marginTop: 3 }}>
              {new Date(cmd.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isOk && cmd.resultCount != null && (
              <span style={{ fontSize: 12, color: "#34d399", background: "rgba(52,211,153,0.08)",
                padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.18)" }}>
                {cmd.resultCount} 张
              </span>
            )}
            <span style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 6, fontWeight: 500,
              color: isOk ? "#34d399" : isFail ? "#f87171" : "rgba(190,225,255,0.70)",
              background: isOk ? "rgba(52,211,153,0.08)" : isFail ? "rgba(239,68,68,0.08)" : "rgba(68,112,145,0.12)",
              border: `1px solid ${isOk ? "rgba(52,211,153,0.18)" : isFail ? "rgba(239,68,68,0.18)" : "rgba(68,112,145,0.28)"}`,
            }}>
              {isOk ? "完成" : isFail ? "失败" : "进行中"}
            </span>
          </div>
        </div>
        {isFail && exp && (
          <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(190,220,255,0.05)" }}>
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.14)",
              fontSize: 11, color: "#fca5a5", fontFamily: "monospace",
              lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all",
              maxHeight: 120, overflowY: "auto" }}>
              {cmd.error?.slice(0, 400)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 通用组件 ─────────────────────────────────────────────────────────────────
function FormField({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.48)", marginBottom: 6, letterSpacing: 0.4 }}>{label}</div>
      {children}
    </div>
  );
}
function ToggleSwitch({ checked, onChange }) {
  return (
    <div onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: 38, height: 22, borderRadius: 11, cursor: "pointer", flexShrink: 0,
        background: checked ? "rgba(68,112,145,0.72)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${checked ? "rgba(120,165,205,0.42)" : "rgba(190,220,255,0.08)"}`,
        position: "relative", transition: "all 0.2s ease",
        boxShadow: checked ? "0 0 14px rgba(68,112,145,0.32)" : "none",
      }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 2, transition: "left 0.2s ease",
        left: checked ? 18 : 2, boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
      }} />
    </div>
  );
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ mode, setMode, stats, onRefresh, onAddRoom }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(2,4,9,0.88)",
      backdropFilter: "blur(24px)",
      borderBottom: "1px solid rgba(190,220,255,0.07)",
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: "linear-gradient(135deg, rgba(68,112,145,0.80), rgba(40,72,105,0.90))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 18px rgba(68,112,145,0.35)", fontSize: 15,
              border: "1px solid rgba(180,215,255,0.16)",
            }}>📡</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#eef6ff", letterSpacing: -0.3 }}>
              直播截图素材库
            </span>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <StatPill label="今日截图" value={stats.shots} color="#78a5cd" />
            <StatPill label="直播间" value={stats.rooms} color="#9b8ec4" />
            {stats.failed > 0 && <StatPill label="失败" value={stats.failed} color="#f87171" />}
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn-glass" onClick={onRefresh}
            style={{ padding: "7px 14px", borderRadius: 9, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            ↻ 刷新
          </button>
          <button className="btn-blue" onClick={onAddRoom}
            style={{ padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500 }}>
            + 新增直播间
          </button>
        </div>
        {/* 模式切换 */}
        <div style={{ display: "flex", borderTop: "1px solid rgba(190,220,255,0.05)" }}>
          {[
            { key: "display", label: "展示模式" },
            { key: "manage",  label: "管理模式" },
            { key: "history", label: "历史模式" },
          ].map(({ key, label }) => (
            <button key={key} className={`mode-btn${mode === key ? " active" : ""}`}
              onClick={() => setMode(key)}
              style={{ fontSize: 13 }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
function StatPill({ label, value, color }) {
  const rgb = hexToRgb(color);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 20,
      background: `rgba(${rgb},0.08)`,
      border: `1px solid rgba(${rgb},0.18)`,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: "rgba(238,246,255,0.50)" }}>{label}</span>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────
export default function Page() {
  const [mode, setMode] = useState("display");
  const [data, setData] = useState({ rooms: [], shots: [], commands: [] });
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  async function load() {
    try {
      const res = await fetch("/api/live/rooms");
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000);
    return () => clearInterval(timer.current);
  }, []);

  async function handleDeleteShot(shotId) {
    await fetch("/api/live/shots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId }),
    });
    load();
  }

  function handleSaveRooms(rooms) { setData(prev => ({ ...prev, rooms })); }
  function handleAddRoom() { setMode("manage"); }

  const stats = {
    rooms: data.rooms.length,
    shots: data.shots.length,
    failed: data.commands.filter(c => c.status === "failed").length,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      <div style={{ minHeight: "100vh" }}>
        <Header mode={mode} setMode={setMode} stats={stats} onRefresh={load} onAddRoom={handleAddRoom} />

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "rgba(148,163,184,0.35)", fontSize: 14 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 14, display: "inline-block", animation: "spin 1.5s linear infinite" }}>⏳</div>
              <div>加载中...</div>
            </div>
          </div>
        ) : (
          <>
            {mode === "display" && (
              <DisplayMode
                rooms={data.rooms}
                shots={data.shots}
                onCapture={load}
                onAddRoom={handleAddRoom}
              />
            )}
            {mode === "manage" && (
              <ManageMode rooms={data.rooms} onSave={handleSaveRooms} />
            )}
            {mode === "history" && (
              <HistoryMode
                commands={data.commands}
                shots={data.shots}
                rooms={data.rooms}
                onDeleteShot={handleDeleteShot}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

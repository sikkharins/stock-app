import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { sendAIMessage, buildContext } from "../utils/aiChat.js";
import { fmt, todayStr } from "../utils/helpers.js";
import { supabase } from "../utils/supabase.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import * as XLSX from "xlsx";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

marked.setOptions({ breaks: true, gfm: true });
const MAX_AI_MESSAGES = 20;

function exportPDF(text) {
  const html = marked.parse(text || "");
  const tm = text.match(/^#+\s*(.+)/m);
  const title = tm ? tm[1].trim() : "รายงาน";
  const now = new Date();
  const d = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TS Electronics — ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{margin:20mm}
@media print{body{padding:0}.no-print{display:none!important}table{page-break-inside:auto}tr{page-break-inside:avoid}}
body{font-family:'Sarabun',sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto;font-size:14px;line-height:1.8}
.header{border-bottom:3px solid #007AFF;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}
.company{font-size:24px;font-weight:700;color:#007AFF}
.sub{font-size:12px;color:#666;margin-top:4px}
.date{font-size:12px;color:#666;text-align:right}
.title{font-size:18px;font-weight:700;margin-bottom:16px;color:#333}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
th{background:#f0f4ff;font-weight:600;color:#333}
tr:nth-child(even){background:#fafafa}
strong{color:#007AFF}
h1,h2,h3{color:#333;margin:16px 0 8px}
ul,ol{padding-left:20px}
li{margin-bottom:4px}
hr{border:none;border-top:1px solid #eee;margin:16px 0}
.footer{border-top:1px solid #eee;margin-top:32px;padding-top:12px;font-size:11px;color:#999;text-align:center}
.btns{position:fixed;top:20px;right:20px;display:flex;gap:8px}
.btns button{padding:10px 20px;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Sarabun',sans-serif}
.btns .pr{background:#007AFF;color:#fff}
.btns .cl{background:#eee;color:#333}
</style></head><body>
<div class="btns no-print"><button class="pr" onclick="window.print()">พิมพ์ / บันทึก PDF</button><button class="cl" onclick="window.close()">X ปิด</button></div>
<div class="header"><div><div class="company">TS Electronics</div><div class="sub">ระบบจัดการร้านค้าเครื่องใช้ไฟฟ้า</div></div><div class="date">วันที่พิมพ์: ${d}</div></div>
<div class="title">${title}</div>
<div class="content">${html}</div>
<div class="footer">สร้างโดย AI ผู้ช่วย — TS Electronics © ${now.getFullYear()}</div>
</body></html>`);
  w.document.close();
}

function exportExcel(text) {
  const tm = text.match(/^#+\s*(.+)/m);
  const title = tm ? tm[1].trim() : "รายงาน";
  const lines = text.split("\n");
  const tables = [];
  let currentTable = null;
  let nearestHeader = title;
  const isSepRow = (cells) => cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c.trim()));

  for (const line of lines) {
    const headerMatch = line.match(/^#+\s*(.+)/);
    if (headerMatch) {
      nearestHeader = headerMatch[1].trim();
      continue;
    }
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|") && t.length > 1) {
      const cells = t.slice(1, -1).split("|").map(c => c.trim());
      if (isSepRow(cells)) continue;
      if (!currentTable) currentTable = { name: nearestHeader || "Sheet", rows: [] };
      currentTable.rows.push(cells);
    } else {
      if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
        currentTable = null;
      }
    }
  }
  if (currentTable && currentTable.rows.length > 0) tables.push(currentTable);

  const wb = XLSX.utils.book_new();
  if (tables.length === 0) {
    const cleanText = text.replace(/```[\s\S]*?```/g, "").split("\n").map(l => l.replace(/^[#*\-_>\s]+/, "").replace(/[*_`]/g, "").trim()).filter(Boolean);
    const ws = XLSX.utils.aoa_to_sheet(cleanText.map(l => [l]));
    XLSX.utils.book_append_sheet(wb, ws, "รายงาน");
  } else {
    const used = new Set();
    tables.forEach((t, i) => {
      let n = (t.name || ("Sheet" + (i + 1))).replace(/[\[\]\*\?\/\\:]/g, "").slice(0, 30);
      if (!n) n = "Sheet" + (i + 1);
      let base = n, k = 2;
      while (used.has(n)) { n = (base + " " + k).slice(0, 30); k++; }
      used.add(n);
      const ws = XLSX.utils.aoa_to_sheet(t.rows);
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
  }
  const safeName = title.replace(/[\\\/:*?"<>|]/g, "").slice(0, 80) || "รายงาน";
  XLSX.writeFile(wb, safeName + ".xlsx");
}

const DEFAULTS = { voiceOn: true, speechRate: 1.0, ttsEngine: "google", voice: "th-TH-Neural2-C", model: "claude-haiku-4-5-20251001", lang: "th", customPrompt: "", chatHistoryLimit: 30, allowGeneralChat: true, useThaiOCR: true };
const TTS_OPTIONS = [
  { id: "google", name: "Google Neural", desc: "เสียงธรรมชาติ" },
  { id: "browser", name: "Browser", desc: "ฟรี เสียงพื้นฐาน" },
];
const VOICES_TH = [
  { id: "th-TH-Neural2-C", name: "หญิง Neural", desc: "เสียงดีที่สุด" },
  { id: "th-TH-Standard-A", name: "หญิง Standard", desc: "เสียงมาตรฐาน" },
];
const VOICES_EN = [
  { id: "en-US-Neural2-J", name: "Male", desc: "Natural" },
  { id: "en-US-Neural2-F", name: "Female", desc: "Natural" },
  { id: "en-US-Neural2-A", name: "Male 2", desc: "Deep" },
  { id: "en-US-Neural2-C", name: "Female 2", desc: "Warm" },
];
const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5-20251001", name: "Haiku", desc: "เร็ว ประหยัด" },
  { id: "claude-sonnet-4-6", name: "Sonnet", desc: "ฉลาดกว่า" },
  { id: "claude-opus-4-7", name: "Opus", desc: "ฉลาดสุด แพงสุด" },
];
const LANG_OPTIONS = [
  { id: "th", name: "ไทย" },
  { id: "en", name: "English" },
];

function loadSettingsLocal() {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("ai_bot_settings")) };
    if (s.model === "claude-sonnet-4-5-20250514") s.model = "claude-sonnet-4-6";
    return s;
  } catch { return { ...DEFAULTS }; }
}

export default function AISOBot({ sh, onCreateSO, onCreatePO, onCreateQuote, onUpdateProducts }) {
  const { products, contacts, sales, pos, payments, quotes, pN, cN, cu } = sh;
  const [open, setOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKbOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
  const WELCOME = "สวัสดีครับ! สั่งของ สั่งซื้อ เสนอราคา เช็คสต็อก ดูยอดค้าง วิเคราะห์ยอดขาย หรือถามอะไรก็ได้เลย";
  const [view, setView] = useState("chat");
  const [msgs, setMsgs] = useState([{ role: "bot", text: WELCOME, ts: Date.now() }]);
  const [aiMemory, setAiMemory] = useState([]);
  const [aiActionLog, setAiActionLog] = useState([]);
  const [productNotes, setProductNotes] = useState([]);
  const [customerNotes, setCustomerNotes] = useState([]);
  const [cancelReason, setCancelReason] = useState("");
  const quickActions = [
    { label: "สต็อกเหลือน้อย", text: "สินค้าตัวไหนสต็อกเหลือน้อย" },
    { label: "สินค้าขายดี", text: "สินค้าขายดีสุดคืออะไร" },
    { label: "ยอดขายรายเดือน", text: "สรุปยอดขายรายเดือนพร้อมกำไร" },
    { label: "แนวโน้มการขาย", text: "วิเคราะห์แนวโน้มการขายเปรียบเทียบรายเดือน" },
    { label: "ลูกค้าซื้อเยอะ", text: "ลูกค้าที่ซื้อมากที่สุดคือใคร" },
    { label: "สรุปรายงาน", text: "สรุปรายงานภาพรวมธุรกิจ ยอดขาย กำไร สินค้าขายดี ลูกค้าหลัก จัดเป็นตารางให้อ่านง่าย" },
    { label: "ยอดค้างชำระ", text: "ลูกค้าไหนค้างชำระบ้าง" },
  ];
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const isAdmin = cu?.role === "Admin";
  const [settings, setSettings] = useState(loadSettingsLocal);
  const [pendingSO, setPendingSO] = useState(null);
  const [pendingPO, setPendingPO] = useState(null);
  const [pendingQuote, setPendingQuote] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const imgInputRef = useRef(null);
  const chatRef = useRef(null);
  const recogRef = useRef(null);
  const aiMsgsRef = useRef([]);
  const abortRef = useRef(null);

  // Draggable launcher FAB (mirrors the "+" quick-create FAB in App.jsx)
  const aiFabRef = useRef(null);
  const aiDrag = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, moved: false, sz: 52 });
  const [aiFabPos, setAiFabPos] = useState(() => { try { const s = JSON.parse(localStorage.getItem("ai_fab_pos")); if (s && s.x != null && s.x >= 0 && s.y >= 0 && s.x <= window.innerWidth - 32 && s.y <= window.innerHeight - 32) return s; } catch {} return { x: null, y: null }; });
  const onAiDown = useCallback((e) => { const t = e.touches ? e.touches[0] : e; const el = aiFabRef.current; if (!el) return; const r = el.getBoundingClientRect(); aiDrag.current = { dragging: true, startX: t.clientX, startY: t.clientY, startLeft: r.left, startTop: r.top, moved: false, sz: r.width }; }, []);
  const onAiMove = useCallback((e) => { const d = aiDrag.current; if (!d.dragging) return; const t = e.touches ? e.touches[0] : e; const dx = t.clientX - d.startX, dy = t.clientY - d.startY; if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true; if (!d.moved) return; e.preventDefault(); const sz = d.sz; const nx = Math.max(0, Math.min(window.innerWidth - sz, d.startLeft + dx)); const ny = Math.max(0, Math.min(window.innerHeight - sz, d.startTop + dy)); setAiFabPos({ x: nx, y: ny }); }, []);
  const onAiUp = useCallback(() => { const d = aiDrag.current; if (!d.dragging) return; d.dragging = false; if (d.moved && aiFabPos.x != null) { const sz = d.sz; const snapX = aiFabPos.x < window.innerWidth / 2 ? 12 : window.innerWidth - sz - 12; const snapped = { x: snapX, y: aiFabPos.y }; setAiFabPos(snapped); localStorage.setItem("ai_fab_pos", JSON.stringify(snapped)); } }, [aiFabPos]);
  useEffect(() => { window.addEventListener("mousemove", onAiMove); window.addEventListener("mouseup", onAiUp); window.addEventListener("touchmove", onAiMove, { passive: false }); window.addEventListener("touchend", onAiUp); return () => { window.removeEventListener("mousemove", onAiMove); window.removeEventListener("mouseup", onAiUp); window.removeEventListener("touchmove", onAiMove); window.removeEventListener("touchend", onAiUp); }; }, [onAiMove, onAiUp]);

  const chatKey = cu?.id ? `ai_chat_${cu.id}` : null;

  useEffect(() => {
    setMsgs([{ role: "bot", text: WELCOME, ts: Date.now() }]);
    aiMsgsRef.current = [];
    if (!chatKey) return;
    const keys = ["bot_config", "ai_memory", "ai_action_log", "ai_product_notes", "ai_customer_notes", chatKey];
    supabase.from("app_data").select("key, data").in("key", keys).then(({ data: rows }) => {
      (rows || []).forEach(r => {
        if (r.key === "bot_config" && r.data && Object.keys(r.data).length > 0) {
          const s = { ...DEFAULTS, ...r.data };
          if (s.model === "claude-sonnet-4-5-20250514") s.model = "claude-sonnet-4-6";
          setSettings(s); localStorage.setItem("ai_bot_settings", JSON.stringify(s));
        }
        if (r.key === chatKey && Array.isArray(r.data?.msgs) && r.data.msgs.length > 0) {
          setMsgs(r.data.msgs);
          if (Array.isArray(r.data.aiMsgs)) aiMsgsRef.current = r.data.aiMsgs;
        }
        if (r.key === "ai_memory" && Array.isArray(r.data)) setAiMemory(r.data);
        if (r.key === "ai_action_log" && Array.isArray(r.data)) setAiActionLog(r.data);
        if (r.key === "ai_product_notes" && Array.isArray(r.data)) setProductNotes(r.data);
        if (r.key === "ai_customer_notes" && Array.isArray(r.data)) setCustomerNotes(r.data);
      });
    });
  }, [chatKey]);

  useEffect(() => {
    const r = requestAnimationFrame(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    });
    return () => cancelAnimationFrame(r);
  }, [msgs, pendingSO, pendingPO, pendingQuote, pendingUpdate]);

  // Save chat history (debounced, per-user)
  const saveChatTimer = useRef(null);
  useEffect(() => {
    if (msgs.length <= 1 || !chatKey) return;
    clearTimeout(saveChatTimer.current);
    saveChatTimer.current = setTimeout(() => {
      const limit = settings.chatHistoryLimit || 30;
      const lastN = msgs.slice(-limit);
      const lastAi = aiMsgsRef.current.slice(-MAX_AI_MESSAGES);
      supabase.from("app_data").upsert({ key: chatKey, data: { msgs: lastN, aiMsgs: lastAi }, updated_at: new Date().toISOString() });
    }, 1500);
  }, [msgs, chatKey, settings.chatHistoryLimit]);

  // Save memory, action log, product/customer notes when changed
  useEffect(() => { if (aiMemory.length) supabase.from("app_data").upsert({ key: "ai_memory", data: aiMemory, updated_at: new Date().toISOString() }); }, [aiMemory]);
  useEffect(() => { if (aiActionLog.length) supabase.from("app_data").upsert({ key: "ai_action_log", data: aiActionLog, updated_at: new Date().toISOString() }); }, [aiActionLog]);
  useEffect(() => { supabase.from("app_data").upsert({ key: "ai_product_notes", data: productNotes, updated_at: new Date().toISOString() }); }, [productNotes]);
  useEffect(() => { supabase.from("app_data").upsert({ key: "ai_customer_notes", data: customerNotes, updated_at: new Date().toISOString() }); }, [customerNotes]);

  const addActionLog = (action, detail) => setAiActionLog(prev => [{ action, detail, ts: new Date().toISOString(), user: cu?.username }, ...prev].slice(0, 50));

  const updateSetting = (key, val) => {
    if (!isAdmin) return;
    setSettings(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem("ai_bot_settings", JSON.stringify(next));
      supabase.from("app_data").upsert({ key: "bot_config", data: next, updated_at: new Date().toISOString() });
      return next;
    });
  };

  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  const speakBrowser = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = settings.lang === "en" ? "en-US" : "th-TH";
    u.rate = settings.speechRate;
    window.speechSynthesis.speak(u);
  }, [settings.speechRate, settings.lang]);

  const speakGoogle = useCallback(async (text) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: settings.lang, speed: settings.speechRate, voice: settings.voice }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const { audio } = await res.json();
      const ctx = audioCtxRef.current;
      if (ctx) {
        const raw = atob(audio);
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        const audioBuf = await ctx.decodeAudioData(buf.buffer);
        try { if (audioRef.current) audioRef.current.stop(); } catch {} audioRef.current = null;
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        src.start();
        audioRef.current = src;
      } else {
        if (audioRef.current) { audioRef.current.pause(); }
        const a = new Audio("data:audio/mp3;base64," + audio);
        audioRef.current = a;
        a.play();
      }
    } catch {
      speakBrowser(text);
    }
  }, [settings.speechRate, settings.lang, settings.voice, speakBrowser]);

  const speak = useCallback((text) => {
    if (!settings.voiceOn) return;
    if (settings.ttsEngine === "google") speakGoogle(text);
    else speakBrowser(text);
  }, [settings.voiceOn, settings.ttsEngine, speakGoogle, speakBrowser]);

  const addMsg = (role, text, image) => setMsgs((p) => [...p, { role, text, ts: Date.now(), image }]);

  const handleSend = async (text) => {
    const t = (text || input).trim();
    const hasImage = !!pendingImage;
    if ((!t && !hasImage) || loading) return;
    if(abortRef.current)abortRef.current.abort();
    const ctrl=new AbortController();abortRef.current=ctrl;
    unlockAudio();
    setInput("");
    addMsg("user", t, hasImage ? pendingImage.preview : undefined);

    let content;
    if (hasImage) {
      let ocrText = "";
      if (settings.useThaiOCR !== false) {
        try {
          const ocrRes = await fetch("/api/akson-ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: pendingImage.base64, mediaType: pendingImage.mediaType }),
            signal: ctrl.signal,
          });
          if (ocrRes.ok) {
            const data = await ocrRes.json();
            ocrText = (data.text || "").trim();
          } else {
            const err = await ocrRes.json().catch(() => ({}));
            console.warn("Thai OCR failed:", err.error || ocrRes.statusText);
          }
        } catch (e) { if(!ctrl.signal.aborted) console.warn("Thai OCR error:", e.message); }
      }
      const basePrompt = t || "ดูรูปนี้ให้หน่อย ช่วยหาสินค้าที่ตรงกันในระบบ หรืออ่านข้อความในรูป";
      const finalText = ocrText
        ? `${basePrompt}\n\n[Thai OCR (AksonOCR) อ่านข้อความในรูปได้:\n${ocrText}\n]\nใช้ข้อความนี้ประกอบกับรูปเพื่อวิเคราะห์ ถ้า OCR กับรูปขัดกัน ให้เชื่อรูปก่อนและแจ้งผู้ใช้`
        : basePrompt;
      content = [
        { type: "image", source: { type: "base64", media_type: pendingImage.mediaType, data: pendingImage.base64 } },
        { type: "text", text: finalText }
      ];
      setPendingImage(null);
    } else {
      content = t;
    }
    aiMsgsRef.current = [...aiMsgsRef.current, { role: "user", content }];
    if (aiMsgsRef.current.length > MAX_AI_MESSAGES) {
      aiMsgsRef.current = aiMsgsRef.current.slice(-MAX_AI_MESSAGES);
    }
    setLoading(true);

    try {
      const ctx = buildContext(products, contacts, sales, pN, cN, cu, pos, payments, quotes);
      ctx.aiMemory = aiMemory.slice(0, 20);
      ctx.aiActionLog = aiActionLog.slice(0, 15);
      ctx.productNotes = productNotes.slice(0, 50);
      ctx.customerNotes = customerNotes.slice(0, 50);
      const res = await sendAIMessage(aiMsgsRef.current, ctx, { model: settings.model, lang: settings.lang, customPrompt: settings.customPrompt, allowGeneralChat: settings.allowGeneralChat !== false });
      if(ctrl.signal.aborted)return;
      aiMsgsRef.current = [...aiMsgsRef.current, { role: "assistant", content: JSON.stringify(res) }];
      // Extract memory notes from AI
      if (res.memory && Array.isArray(res.memory) && res.memory.length > 0) {
        setAiMemory(prev => {
          const all = [...res.memory.map(m => ({ text: m, ts: new Date().toISOString() })), ...prev];
          const seen = new Set(); return all.filter(n => { const k = n.text.slice(0, 50); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 50);
        });
      }
      // Extract product notes from AI
      if (res.productNotes && Array.isArray(res.productNotes) && res.productNotes.length > 0) {
        setProductNotes(prev => {
          const newNotes = res.productNotes.map(n => ({ productId: n.productId, note: n.note, ts: new Date().toISOString() }));
          return [...newNotes, ...prev].slice(0, 100);
        });
      }
      // Extract customer notes from AI
      if (res.customerNotes && Array.isArray(res.customerNotes) && res.customerNotes.length > 0) {
        setCustomerNotes(prev => {
          const newNotes = res.customerNotes.map(n => ({ contactId: n.contactId, note: n.note, ts: new Date().toISOString() }));
          return [...newNotes, ...prev].slice(0, 100);
        });
      }

      if (res.action === "create_so") {
        addMsg("bot", res.message);
        setPendingSO(res.data);
      } else if (res.action === "create_po") {
        addMsg("bot", res.message);
        setPendingPO(res.data);
      } else if (res.action === "create_quote") {
        addMsg("bot", res.message);
        setPendingQuote(res.data);
      } else if (res.action === "update_products") {
        addMsg("bot", res.message);
        setPendingUpdate(res.data);
      } else {
        addMsg("bot", res.message || "ไม่เข้าใจครับ ลองใหม่อีกครั้ง");
      }
      if (res.speak) { const sp = res.speak.length > 100 ? res.speak.slice(0, 100).replace(/[^\s]*$/, "") + "ครับ" : res.speak; speak(sp); }
    } catch (e) {
      if(ctrl.signal.aborted)return;
      const m = e.message || "";
      const matched = m.includes("Overloaded") || m.includes("overloaded") ? "ระบบ AI มีผู้ใช้จำนวนมาก กรุณาลองใหม่อีกครั้ง"
        : m.includes("rate_limit") ? "เรียก AI บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"
        : m.includes("invalid_api_key") || m.includes("authentication") ? "API Key ไม่ถูกต้อง กรุณาแจ้ง Admin"
        : m.includes("Failed to fetch") || m.includes("NetworkError") ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต"
        : null;
      const friendly = matched || ("เกิดข้อผิดพลาด: " + (m || "ไม่ทราบสาเหตุ"));
      console.error("AI bot error:", e);
      addMsg("bot", friendly);
    }
    setLoading(false);
  };

  const pendingAction = pendingSO ? "so" : pendingPO ? "po" : pendingQuote ? "quote" : pendingUpdate ? "update" : null;

  const doConfirm = () => {
    if (pendingSO) {
      onCreateSO(pendingSO);
      addMsg("bot", "สร้าง SO เรียบร้อยครับ!");
      speak("สร้างใบขายเรียบร้อยครับ");
      addActionLog("สร้าง SO", `ลูกค้า: ${pendingSO.customerName}, ${(pendingSO.items||[]).length} รายการ`);
      setPendingSO(null);
    } else if (pendingPO) {
      onCreatePO(pendingPO);
      addMsg("bot", "สร้าง PO เรียบร้อยครับ!");
      speak("สร้างใบสั่งซื้อเรียบร้อยครับ");
      addActionLog("สร้าง PO", `ซัพพลายเออร์: ${pendingPO.supplierName}, ${(pendingPO.items||[]).length} รายการ`);
      setPendingPO(null);
    } else if (pendingQuote) {
      onCreateQuote(pendingQuote);
      addMsg("bot", "สร้างใบเสนอราคาเรียบร้อยครับ!");
      speak("สร้างใบเสนอราคาเรียบร้อยครับ");
      addActionLog("สร้างใบเสนอราคา", `ลูกค้า: ${pendingQuote.customerName}, ${(pendingQuote.items||[]).length} รายการ`);
      setPendingQuote(null);
    } else if (pendingUpdate) {
      onUpdateProducts(pendingUpdate.updates);
      addMsg("bot", `แก้ไข ${pendingUpdate.updates.length} รายการเรียบร้อยครับ! `);
      speak("แก้ไขเรียบร้อยครับ");
      addActionLog("แก้ไขสินค้า", `${pendingUpdate.updates.length} รายการ — ${pendingUpdate.reason || ""}`);
      setPendingUpdate(null);
    }
    aiMsgsRef.current = [];
  };

  const [showCancelFeedback, setShowCancelFeedback] = useState(false);

  const doCancel = () => {
    if (!showCancelFeedback) {
      setShowCancelFeedback(true);
      return;
    }
    const actionType = pendingSO ? "สร้าง SO" : pendingPO ? "สร้าง PO" : pendingQuote ? "ใบเสนอราคา" : pendingUpdate ? "แก้ไขสินค้า" : "ไม่ทราบ";
    const reason = cancelReason.trim();
    if (reason) {
      addActionLog("ยกเลิก: " + actionType, reason);
    }
    setPendingSO(null); setPendingPO(null); setPendingQuote(null); setPendingUpdate(null);
    setShowCancelFeedback(false); setCancelReason("");
    addMsg("bot", "ยกเลิกแล้วครับ สั่งใหม่ได้เลย");
  };

  const clearChat = () => {
    setMsgs([{ role: "bot", text: WELCOME, ts: Date.now() }]);
    aiMsgsRef.current = [];
    setPendingSO(null); setPendingPO(null); setPendingQuote(null); setPendingUpdate(null); setPendingImage(null);
    if (chatKey) supabase.from("app_data").upsert({ key: chatKey, data: { msgs: [], aiMsgs: [] }, updated_at: new Date().toISOString() });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 1600;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setPendingImage({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", preview: dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startListening = () => {
    unlockAudio();
    if (!SpeechRecognition) { addMsg("bot", "เบราว์เซอร์ไม่รองรับการพูด กรุณาใช้ Chrome"); return; }
    if (recogRef.current) { recogRef.current.stop(); return; }
    const r = new SpeechRecognition();
    r.lang = settings.lang === "en" ? "en-US" : "th-TH";
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setTimeout(() => handleSend(t), 100);
    };
    r.onerror = () => setListening(false);
    r.onend = () => { setListening(false); recogRef.current = null; };
    r.start();
    recogRef.current = r;
  };

  const S = {
    fab: { position: "fixed", bottom: 20, right: 16, width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#007AFF,#5856D6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, letterSpacing: "-0.5px", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,122,255,0.4)", zIndex: 9999, border: "none", transition: "transform 0.2s", fontFamily: "inherit" },
    panel: { position: "fixed", bottom: 82, right: 16, width: 380, maxWidth: "calc(100vw - 20px)", height: 520, maxHeight: "calc(100vh - 120px)", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.3)", zIndex: 9998, display: "flex", flexDirection: "column", overflow: "hidden" },
    header: { padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 },
    chatArea: { flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 },
    inputBar: { padding: "10px 12px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" },
    bubble: (isUser) => ({ maxWidth: "85%", padding: "9px 14px", borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isUser ? "var(--blue)" : "var(--bg2)", color: isUser ? "#fff" : "var(--text)", fontSize: 13, lineHeight: 1.5, alignSelf: isUser ? "flex-end" : "flex-start", whiteSpace: isUser ? "pre-wrap" : "normal", wordBreak: "break-word" }),
    settRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" },
    settLabel: { fontSize: 13, fontWeight: 500 },
    settDesc: { fontSize: 11, color: "var(--dim)", marginTop: 2 },
  };

  const GearIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

  const renderSettings = () => (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
      {/* Voice */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>เสียง</div>

      <div style={S.settRow}>
        <div>
          <div style={S.settLabel}>เสียงตอบกลับ</div>
          <div style={S.settDesc}>AI อ่านข้อความตอบออกเสียง</div>
        </div>
        <button onClick={() => updateSetting("voiceOn", !settings.voiceOn)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: settings.voiceOn ? "var(--green)" : "var(--bg2)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: settings.voiceOn ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </button>
      </div>

      <div style={S.settRow}>
        <div>
          <div style={S.settLabel}>ความเร็วเสียง</div>
          <div style={S.settDesc}>{settings.speechRate <= 0.7 ? "ช้า" : settings.speechRate <= 0.9 ? "ปกติ" : settings.speechRate <= 1.1 ? "เร็ว" : "เร็วมาก"} ({settings.speechRate}x)</div>
        </div>
        <input type="range" min="0.5" max="1.5" step="0.05" value={settings.speechRate} onChange={e => updateSetting("speechRate", +e.target.value)} style={{ width: 100, accentColor: "var(--blue)" }} />
      </div>

      <div style={S.settRow}>
        <div>
          <div style={S.settLabel}>เครื่องเสียง</div>
          <div style={S.settDesc}>{settings.ttsEngine === "google" ? "Google Neural — เสียงธรรมชาติ" : "Browser — ฟรี เสียงพื้นฐาน"}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
        {TTS_OPTIONS.map(t => (
          <button key={t.id} onClick={() => updateSetting("ttsEngine", t.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: settings.ttsEngine === t.id ? "2px solid var(--blue)" : "1px solid var(--line)", background: settings.ttsEngine === t.id ? "rgba(0,122,255,0.1)" : "var(--bg)", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: settings.ttsEngine === t.id ? "var(--blue)" : "var(--text)" }}>{t.name}</div>
            <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 1 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {settings.ttsEngine === "google" && <>
        <div style={{ ...S.settRow, borderBottom: "none", paddingBottom: 4 }}>
          <div>
            <div style={S.settLabel}>เสียงพูด</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          {(settings.lang === "en" ? VOICES_EN : VOICES_TH).map(v => (
            <button key={v.id} onClick={() => updateSetting("voice", v.id)} style={{ padding: "6px 12px", borderRadius: 16, border: settings.voice === v.id ? "2px solid var(--blue)" : "1px solid var(--line)", background: settings.voice === v.id ? "rgba(0,122,255,0.1)" : "var(--bg)", cursor: "pointer", fontSize: 11, fontWeight: 500, color: settings.voice === v.id ? "var(--blue)" : "var(--text)" }}>
              {v.name}
            </button>
          ))}
        </div>
      </>}

      {/* AI Model */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>AI Model</div>

      <div style={{ display: "flex", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
        {MODEL_OPTIONS.map(m => (
          <button key={m.id} onClick={() => updateSetting("model", m.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: settings.model === m.id ? "2px solid var(--blue)" : "1px solid var(--line)", background: settings.model === m.id ? "rgba(0,122,255,0.1)" : "var(--bg)", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: settings.model === m.id ? "var(--blue)" : "var(--text)" }}>{m.name}</div>
            <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Language */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>ภาษา</div>

      <div style={{ display: "flex", gap: 8, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
        {LANG_OPTIONS.map(l => (
          <button key={l.id} onClick={() => updateSetting("lang", l.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: settings.lang === l.id ? "2px solid var(--blue)" : "1px solid var(--line)", background: settings.lang === l.id ? "rgba(0,122,255,0.1)" : "var(--bg)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: settings.lang === l.id ? "var(--blue)" : "var(--text)" }}>
            {l.name}
          </button>
        ))}
      </div>

      {/* Custom prompt */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>คำสั่งเพิ่มเติม</div>

      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
        <div style={S.settDesc}>กำหนดบุคลิกหรือกฎเพิ่มให้ AI เช่น "ตอบสั้น ๆ" หรือ "ใช้คำสุภาพ"</div>
        <textarea
          value={settings.customPrompt}
          onChange={e => updateSetting("customPrompt", e.target.value)}
          placeholder="เช่น ตอบสั้น ๆ กระชับ ใช้ภาษาสุภาพ"
          rows={3}
          style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* Actions */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>อื่น ๆ</div>

      <div style={S.settRow}>
        <div>
          <div style={S.settLabel}>ตอบเรื่องนอกร้านค้า</div>
          <div style={S.settDesc}>ให้ AI ตอบคำถามทั่วไป (สนทนา ความรู้ คำนวณ) ปิดถ้าต้องการให้ตอบแต่เรื่องร้านเท่านั้น</div>
        </div>
        <button onClick={() => updateSetting("allowGeneralChat", !settings.allowGeneralChat)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: settings.allowGeneralChat ? "var(--green)" : "var(--bg2)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: settings.allowGeneralChat ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </button>
      </div>

      <div style={S.settRow}>
        <div>
          <div style={S.settLabel}>ใช้ Thai OCR (AksonOCR)</div>
          <div style={S.settDesc}>เปิดเพื่อใช้ OCR เฉพาะภาษาไทยอ่านรูปก่อนส่งให้ AI (แม่นกับลายมือ/เอกสารไทย) ปิดถ้าอยากให้ AI อ่านรูปเองอย่างเดียว</div>
        </div>
        <button onClick={() => updateSetting("useThaiOCR", !settings.useThaiOCR)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: settings.useThaiOCR ? "var(--green)" : "var(--bg2)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: settings.useThaiOCR ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </button>
      </div>

      <div style={S.settRow}>
        <div>
          <div style={S.settLabel}>จำนวนข้อความที่เก็บ</div>
          <div style={S.settDesc}>ข้อความเก่ากว่านี้จะถูกลบอัตโนมัติ</div>
        </div>
        <select value={settings.chatHistoryLimit || 30} onChange={e => updateSetting("chatHistoryLimit", +e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
          {[10, 20, 30, 50, 100].map(n => <option key={n} value={n}>{n} ข้อความ</option>)}
        </select>
      </div>

      {/* Chat History Info */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>ประวัติแชท</div>
      <div style={{ padding: "8px 0", fontSize: 12, color: "var(--dim)" }}>
        เก็บ {msgs.length - 1} / {settings.chatHistoryLimit || 30} ข้อความ {chatKey ? <span style={{ fontSize: 10, opacity: 0.7 }}>({chatKey})</span> : null}
      </div>
      <div style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
        <button onClick={() => { clearChat(); setView("chat"); }} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--red)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>ล้างประวัติแชท</button>
      </div>

      {/* Memory Viewer */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>ความจำ AI ({aiMemory.length})</div>
      <div style={{ maxHeight: 200, overflowY: "auto", padding: "4px 0" }}>
        {aiMemory.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", padding: "8px 0" }}>ยังไม่มีข้อมูลความจำ</div>}
        {aiMemory.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text)" }}>{m.text}</div>
              {m.ts && <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{new Date(m.ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>}
            </div>
            <button onClick={() => setAiMemory(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1, flexShrink: 0 }} title="ลบ">X</button>
          </div>
        ))}
      </div>
      {aiMemory.length > 0 && <div style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
        <button onClick={() => { setAiMemory([]); supabase.from("app_data").upsert({ key: "ai_memory", data: [], updated_at: new Date().toISOString() }); }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--red)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>ล้างความจำทั้งหมด</button>
      </div>}

      {/* Action Log Viewer */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>ประวัติคำสั่ง ({aiActionLog.length})</div>
      <div style={{ maxHeight: 200, overflowY: "auto", padding: "4px 0 12px 0" }}>
        {aiActionLog.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", padding: "8px 0" }}>ยังไม่มีประวัติคำสั่ง</div>}
        {aiActionLog.map((a, i) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 500, color: "var(--text)" }}>{a.action}</span>
              <span style={{ fontSize: 10, color: "var(--dim)", flexShrink: 0 }}>{a.ts ? new Date(a.ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "?"}</span>
            </div>
            <div style={{ color: "var(--dim)", fontSize: 11, marginTop: 2 }}>{a.detail}</div>
            {a.user && <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 1 }}>โดย {a.user}</div>}
          </div>
        ))}
      </div>

      {/* Product Notes Viewer */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>บันทึกสินค้า ({productNotes.length})</div>
      <div style={{ maxHeight: 200, overflowY: "auto", padding: "4px 0" }}>
        {productNotes.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", padding: "8px 0" }}>ยังไม่มีบันทึก — AI จะเพิ่มอัตโนมัติเมื่อพบข้อมูลสำคัญ</div>}
        {productNotes.map((n, i) => {
          const p = products.find(x => x.id === n.productId);
          return <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
            <div style={{ flex: 1 }}>
              {p && <div style={{ fontWeight: 500, color: "var(--blue)", fontSize: 11 }}>{pN(p)}</div>}
              <div style={{ color: "var(--text)" }}>{n.note}</div>
              {n.ts && <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{new Date(n.ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>}
            </div>
            <button onClick={() => setProductNotes(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1, flexShrink: 0 }} title="ลบ">X</button>
          </div>;
        })}
      </div>
      {productNotes.length > 0 && <div style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
        <button onClick={() => { setProductNotes([]); supabase.from("app_data").upsert({ key: "ai_product_notes", data: [], updated_at: new Date().toISOString() }); }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--red)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>ล้างบันทึกสินค้าทั้งหมด</button>
      </div>}

      {/* Customer Notes Viewer */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 4 }}>บันทึกลูกค้า ({customerNotes.length})</div>
      <div style={{ maxHeight: 200, overflowY: "auto", padding: "4px 0 12px 0" }}>
        {customerNotes.length === 0 && <div style={{ fontSize: 12, color: "var(--dim)", padding: "8px 0" }}>ยังไม่มีบันทึก — AI จะเพิ่มอัตโนมัติเมื่อพบข้อมูลสำคัญ</div>}
        {customerNotes.map((n, i) => {
          const c = contacts.find(x => x.id === n.contactId);
          return <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
            <div style={{ flex: 1 }}>
              {c && <div style={{ fontWeight: 500, color: "var(--blue)", fontSize: 11 }}>{cN(c)}</div>}
              <div style={{ color: "var(--text)" }}>{n.note}</div>
              {n.ts && <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{new Date(n.ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>}
            </div>
            <button onClick={() => setCustomerNotes(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1, flexShrink: 0 }} title="ลบ">X</button>
          </div>;
        })}
      </div>
      {customerNotes.length > 0 && <div style={{ padding: "8px 0" }}>
        <button onClick={() => { setCustomerNotes([]); supabase.from("app_data").upsert({ key: "ai_customer_notes", data: [], updated_at: new Date().toISOString() }); }} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--red)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>ล้างบันทึกลูกค้าทั้งหมด</button>
      </div>}
    </div>
  );

  return <>
    {!kbOpen && <button ref={aiFabRef} onMouseDown={onAiDown} onTouchStart={onAiDown} onClick={() => { if (!aiDrag.current.moved) setOpen(o => !o); }} className="ai-fab-btn" style={{...S.fab, touchAction:"none", ...(aiFabPos.x != null ? {left:aiFabPos.x,top:aiFabPos.y,right:"auto",bottom:"auto"} : {}), ...(open ? {background:"linear-gradient(135deg,#FF3B30,#FF6B6B)",boxShadow:"0 4px 20px rgba(255,59,48,0.4)"} : {})}}>{open ? "X" : "AI"}</button>}

    {open && <div className="ai-panel" style={S.panel}>
      <div style={S.header}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#007AFF,#5856D6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "inherit" }}>AI</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{view === "chat" ? "AI ผู้ช่วย" : "ตั้งค่า AI"}</div>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>{view === "chat" ? `${MODEL_OPTIONS.find(m => m.id === settings.model)?.name || "Haiku"} | ${settings.lang === "th" ? "ไทย" : "EN"}` : "ปรับแต่งการทำงาน"}</div>
        </div>
        {isAdmin&&<button onClick={() => setView(view === "chat" ? "settings" : "chat")} style={{ background: "none", border: "none", cursor: "pointer", color: view === "settings" ? "var(--blue)" : "var(--dim)", display: "flex", alignItems: "center", padding: 4 }} title="ตั้งค่า"><GearIcon /></button>}
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 20 }}>X</button>
      </div>

      {view === "settings" ? renderSettings() : <>
        <div ref={chatRef} style={S.chatArea}>
          {msgs.map((m, i) => (
            m.role === "user"
              ? <div key={i} style={S.bubble(true)}>{m.image && <img src={m.image} style={{ maxWidth: 180, maxHeight: 140, borderRadius: 8, marginBottom: 6, display: "block" }} />}{m.text || "ส่งรูปภาพ"}</div>
              : <div key={i} style={S.bubble(false)}>
                  <div className="ai-md" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(m.text || "")) }} />
                  {m.text && m.text.length > 80 && <div style={{ display: "flex", gap: 12, padding: "6px 0 0" }}>
                    <button onClick={() => exportPDF(m.text)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 11, fontFamily: "inherit", opacity: 0.7, padding: 0 }}>Export PDF</button>
                    <button onClick={() => exportExcel(m.text)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 11, fontFamily: "inherit", opacity: 0.85, padding: 0 }}>Export Excel</button>
                  </div>}
                </div>
          ))}

          {pendingAction && (() => {
            if (pendingUpdate) {
              const ups = pendingUpdate.updates || [];
              const FIELD_LABELS = { price: "ราคาขาย", cost: "ต้นทุน", stock: "สต็อก", minStock: "สต็อกขั้นต่ำ", name: "ชื่อ (EN)", nameT: "ชื่อ (TH)" };
              return <div style={{ alignSelf: "flex-start", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: 12, maxWidth: "90%", fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--orange)" }}>{"แก้ไขสินค้า (" + ups.length + " รายการ)"}</div>
                {ups.map((u, i) => {
                  const p = products.find(x => x.id === u.productId);
                  return <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < ups.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{u.name || (p ? pN(p) : "?")}</div>
                    {Object.entries(u.changes || {}).map(([field, newVal]) => {
                      const oldVal = p ? p[field] : "?";
                      const isNum = typeof newVal === "number";
                      return <div key={field} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: "var(--dim)" }}>{FIELD_LABELS[field] || field}</span>
                        <span>{isNum ? "฿" + fmt(oldVal) : String(oldVal)} → <span style={{ color: "var(--orange)", fontWeight: 600 }}>{isNum ? "฿" + fmt(newVal) : String(newVal)}</span></span>
                      </div>;
                    })}
                  </div>;
                })}
                {pendingUpdate.reason && <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>เหตุผล: {pendingUpdate.reason}</div>}
                {showCancelFeedback && <div style={{ marginTop: 8, padding: 8, background: "var(--bg2)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>ยกเลิกเพราะอะไร? (ไม่บังคับ)</div>
                  <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="เช่น ราคาไม่ถูก, สินค้าผิด..." style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={doConfirm} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>ยืนยันแก้ไข</button>
                  <button onClick={doCancel} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: showCancelFeedback ? "var(--red)" : "var(--dim)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{showCancelFeedback ? "ยืนยันยกเลิก" : "ยกเลิก"}</button>
                </div>
              </div>;
            }
            const d = pendingSO || pendingPO || pendingQuote;
            const isSO = !!pendingSO, isPO = !!pendingPO;
            const label = isSO ? "SO" : isPO ? "PO" : "ใบเสนอราคา";
            const nameLabel = isPO ? "ซัพพลายเออร์" : "ลูกค้า";
            const nameVal = isPO ? d.supplierName : d.customerName;
            const priceKey = isPO ? "cost" : "price";
            const items = d.items || [];
            const total = items.reduce((s, i) => s + i.qty * (i[priceKey] || 0), 0);
            return <div style={{ alignSelf: "flex-start", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: 12, maxWidth: "90%", fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: isSO ? "var(--blue)" : isPO ? "var(--orange)" : "var(--purple)" }}>{"สรุป " + label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "var(--dim)" }}>{nameLabel}</span>
                <span style={{ fontWeight: 500 }}>{nameVal || "-"}</span>
              </div>
              {items.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "var(--dim)" }}>{it.name}</span>
                  <span>{it.qty} x ฿{fmt(it[priceKey] || 0)}</span>
                </div>
              ))}
              {!isPO && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "var(--dim)" }}>เงื่อนไข</span>
                <span style={{ color: d.payType === "cash" ? "var(--green)" : "var(--blue)" }}>
                  {d.payType === "cash" ? `เงินสด${d.discPct ? " -" + d.discPct + "%" : ""}` : `เครดิต ${d.creditDays || 45} วัน`}
                </span>
              </div>}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>รวม</span>
                <span style={{ fontWeight: 700, color: "var(--green)", fontSize: 14 }}>฿{fmt(total)}</span>
              </div>
              {showCancelFeedback && <div style={{ marginTop: 8, padding: 8, background: "var(--bg2)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>ยกเลิกเพราะอะไร? (ไม่บังคับ)</div>
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="เช่น ราคาไม่ถูก, สินค้าผิด..." style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={doConfirm} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: isSO ? "var(--green)" : isPO ? "var(--orange)" : "var(--purple)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{"สร้าง " + label}</button>
                <button onClick={doCancel} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: showCancelFeedback ? "var(--red)" : "var(--dim)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{showCancelFeedback ? "ยืนยันยกเลิก" : "ยกเลิก"}</button>
              </div>
            </div>;
          })()}

          {msgs.length <= 1 && !loading && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignSelf: "flex-start" }}>
            {quickActions.map((q, i) => (
              <button key={i} onClick={() => handleSend(q.text)} style={{ padding: "6px 12px", borderRadius: 16, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{q.label}</button>
            ))}
          </div>}

          {loading && <div style={{ ...S.bubble(false), opacity: 0.6 }}>กำลังคิด...</div>}
        </div>

        {pendingImage && <div style={{ padding: "8px 12px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
          <img src={pendingImage.preview} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
          <span style={{ flex: 1, fontSize: 12, color: "var(--dim)" }}>รูปภาพพร้อมส่ง</span>
          <button onClick={() => setPendingImage(null)} style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 16, padding: 4 }}>X</button>
        </div>}

        <div style={S.inputBar}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "var(--bg2)", borderRadius: 20, padding: "6px 14px", border: "1px solid var(--line)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="พิมพ์คำสั่งหรือคำถาม..."
              disabled={loading}
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
          <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
          <button onClick={() => imgInputRef.current?.click()} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--bg2)", color: "var(--dim)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="ส่งรูปภาพ"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
          <button
            onClick={startListening}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: listening ? "var(--red)" : "linear-gradient(135deg,#5856D6,#007AFF)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: listening ? "pulse 1s infinite" : "none" }}
            title="กดเพื่อพูด"
          ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg></button>
          <button
            onClick={() => handleSend()}
            disabled={loading || (!input.trim() && !pendingImage)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--blue)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: loading || (!input.trim() && !pendingImage) ? 0.4 : 1 }}
          >{">"}</button>
        </div>
      </>}

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        .ai-md p { margin: 0 0 6px 0; }
        .ai-md p:last-child { margin-bottom: 0; }
        .ai-md strong { color: var(--blue); font-weight: 700; }
        .ai-md table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; }
        .ai-md th, .ai-md td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; }
        .ai-md th { background: var(--bg); font-weight: 600; }
        .ai-md ul, .ai-md ol { margin: 4px 0; padding-left: 18px; }
        .ai-md li { margin-bottom: 2px; }
        .ai-md blockquote { border-left: 3px solid var(--blue); margin: 6px 0; padding: 2px 10px; color: var(--dim); }
        .ai-md code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
        .ai-md h1,.ai-md h2,.ai-md h3 { margin: 8px 0 4px 0; font-size: 14px; }
        .ai-md hr { border: none; border-top: 1px solid var(--line); margin: 8px 0; }
        @media (max-width: 600px) {
          .ai-panel { inset: 0 !important; width: 100% !important; height: 100% !important; max-height: 100vh !important; max-width: 100% !important; border-radius: 0 !important; border: none !important; }
          .ai-fab-btn { bottom: 12px; right: 12px; width: 44px !important; height: 44px !important; font-size: 14px !important; }
        }
      `}</style>
    </div>}
  </>;
}

import http from "node:http";
import { isMock, getPresets, gotoPreset, grabFrame } from "./camera.js";

const PORT = Number(process.env.RELAY_PORT) || 8765;
const SETTLE_MS = Number(process.env.SETTLE_MS) || 2500;

// 1x1 JPEG ใช้เป็น mock snapshot (valid JPEG)
const MOCK_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/presets") {
      const presets = isMock()
        ? [{ token: "1", name: "ซ้าย (mock)" }, { token: "2", name: "กลาง (mock)" }, { token: "3", name: "ขวา (mock)" }]
        : await getPresets();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ presets, mock: isMock() }));
      return;
    }
    if (url.pathname === "/snapshot") {
      const preset = url.searchParams.get("preset");
      let jpeg;
      if (isMock()) jpeg = MOCK_JPEG;
      else {
        if (preset) { await gotoPreset(preset); await new Promise((r) => setTimeout(r, SETTLE_MS)); }
        jpeg = await grabFrame();
      }
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(jpeg);
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`relay on http://localhost:${PORT}  (mock=${isMock()})`);
});

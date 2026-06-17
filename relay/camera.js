import { spawn } from "node:child_process";

const cfg = () => ({
  ip: process.env.CAM_IP,
  user: process.env.CAM_USER || "",
  pass: process.env.CAM_PASS || "",
  onvifPort: Number(process.env.ONVIF_PORT) || 2020,
  rtspPath: process.env.RTSP_PATH || "stream1",
});

export const isMock = () => process.env.RELAY_MOCK === "1" || !process.env.CAM_IP;

async function withCam() {
  const { ip, user, pass, onvifPort } = cfg();
  const pkg = await import("onvif");
  const Cam = pkg.Cam || pkg.default?.Cam;
  return new Promise((resolve, reject) => {
    const cam = new Cam({ hostname: ip, username: user, password: pass, port: onvifPort }, (err) => {
      if (err) reject(err); else resolve(cam);
    });
  });
}

// getPresets shape ต่างกันตามเวอร์ชัน onvif → normalize เป็น [{token,name}]
function normalizePresets(raw) {
  if (Array.isArray(raw)) {
    return raw.map((p, i) => ({ token: String(p.token ?? p.$?.token ?? i), name: String(p.name ?? p.Name ?? `Preset ${i + 1}`) }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([name, token]) => ({ token: String(token), name: String(name) }));
  }
  return [];
}

export async function getPresets() {
  const cam = await withCam();
  return new Promise((resolve, reject) => {
    cam.getPresets({}, (err, presets) => { if (err) reject(err); else resolve(normalizePresets(presets)); });
  });
}

export async function gotoPreset(token) {
  const cam = await withCam();
  return new Promise((resolve, reject) => {
    cam.gotoPreset({ presetToken: token }, (err) => { if (err) reject(err); else resolve(); });
  });
}

// ffmpeg ดึง 1 เฟรมจาก RTSP → JPEG Buffer
export function grabFrame() {
  const { ip, user, pass, rtspPath } = cfg();
  const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : "";
  const url = `rtsp://${auth}${ip}:554/${rtspPath}`;
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-q:v", "3", "-f", "image2", "pipe:1"], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = []; let errBuf = "";
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.stderr.on("data", (d) => { errBuf += d.toString(); });
    ff.on("error", (e) => reject(new Error("ffmpeg ไม่พร้อม (ติดตั้งหรือยัง?): " + e.message)));
    ff.on("close", (code) => {
      const buf = Buffer.concat(chunks);
      if (code === 0 && buf.length) resolve(buf);
      else reject(new Error("ffmpeg grab ล้มเหลว (code " + code + "): " + errBuf.slice(-300)));
    });
  });
}

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req, res) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "https://stock-app-gray-seven.vercel.app").split(",");
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.AKSONOCR_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "AKSONOCR_API_KEY not configured" });

  try {
    const { base64, mediaType = "image/jpeg" } = req.body || {};
    if (!base64) return res.status(400).json({ error: "Missing base64 field" });

    const buf = Buffer.from(base64, "base64");
    const ext = (mediaType.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const blob = new Blob([buf], { type: mediaType });
    const form = new FormData();
    form.append("file", blob, "image." + ext);
    form.append("model", "aksonocr-1.0");

    const upstream = await fetch("https://backend.aksonocr.com/api/v2/upload", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: form,
    });

    const ct = upstream.headers.get("content-type") || "";
    const raw = ct.includes("application/json") ? await upstream.json() : await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).json({ error: typeof raw === "string" ? raw : raw.error || upstream.statusText });

    const text = typeof raw === "string"
      ? raw
      : (raw.text || raw.result?.text || raw.content || raw.data?.text || raw.markdown || raw.extracted_text || (raw.result && typeof raw.result === "string" ? raw.result : "") || JSON.stringify(raw));
    return res.status(200).json({ text: String(text).trim(), raw });
  } catch (e) {
    console.error("AksonOCR error:", e.message, e.stack);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}

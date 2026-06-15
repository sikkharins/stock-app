// AI stock-count engine — vision นับสินค้าต่อกองจากรูป แล้วคืนผล (read-only)
// pure helpers (named exports) ทดสอบใน stock-count.test.js; default handler อยู่ท้ายไฟล์

export const MODEL_MAP = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
};

// short key → full model id; unknown/missing → opus (default)
export function resolveModel(model) {
  return MODEL_MAP[model] || MODEL_MAP.opus;
}

// catalog → บรรทัดข้อความสั้นสำหรับ prompt
// สำคัญ: ห้ามใส่ stock หรือ price — AI ต้องนับอิสระ
export function formatCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) return "(catalog ว่าง)";
  return catalog
    .map((p) => {
      const head = [`[${p.id}]`, p.brand || "", "—", p.name || ""].join(" ");
      const tail = [p.unit ? `หน่วย:${p.unit}` : "", p.desc ? `ลักษณะ:${p.desc}` : ""]
        .filter(Boolean)
        .join(" | ");
      return tail ? `${head} | ${tail}` : head;
    })
    .join("\n");
}

// schema บังคับรูปผลลัพธ์ (strict json_schema มักต้องการทุก field ใน required → ใส่ note ด้วย;
// coercePile ยัง default note="" กันพลาด)
export const STOCK_COUNT_SCHEMA = {
  type: "object",
  properties: {
    piles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          productId: { type: ["integer", "string", "null"] },
          guess: { type: "string" },
          count: { type: "integer" },
          confidence: { type: "string", enum: ["low", "med", "high"] },
          note: { type: "string" },
        },
        required: ["productId", "guess", "count", "confidence", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["piles"],
  additionalProperties: false,
};

export function buildSystemPrompt(catalogText) {
  return `คุณเป็นผู้ช่วยตรวจนับสต็อกจากรูปถ่ายในโกดัง
งานของคุณ: ดูรูป 1 รูปที่มี "กองสินค้าวางแยกกันเป็นกองๆ" (มักมี 3-4 กอง ไม่ปนกัน) แล้ว:
1. หาแต่ละกองในรูป
2. จับคู่แต่ละกองกับสินค้าใน catalog ด้านล่าง — ถ้ามั่นใจให้ใส่ productId ตรงตามที่ระบุใน catalog; ถ้าไม่พบหรือไม่มั่นใจให้ productId = null แล้วอธิบายใน guess
3. นับจำนวนชิ้นในแต่ละกองอย่างระมัดระวัง
4. ประเมิน confidence: high = เห็นครบนับชัด, med = พอเดาได้, low = บัง/ซ้อนลึก/เบลอ
5. ถ้าซ้อนลึกจนนับด้านหลังไม่ได้ ให้ confidence = low และอธิบายใน note

กฎสำคัญ:
- คุณ "ไม่รู้" และ "ไม่ต้องสน" ยอดในระบบ ห้ามปัดเลขให้ดูสวยหรือเดาให้ตรงเลขใด ๆ — นับตามที่เห็นจริงเท่านั้น
- guess เป็นข้อความสั้นบอกว่ากองนั้นคืออะไร (ยี่ห้อ/รุ่น/ลักษณะ)
- ตอบตาม schema ที่กำหนดเท่านั้น

catalog สินค้าในระบบ (id | ยี่ห้อ — ชื่อ/รุ่น | หน่วย | ลักษณะ):
${catalogText}`;
}

export function buildRequestBody({ modelId, base64, mediaType, systemPrompt }) {
  return {
    model: modelId,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: STOCK_COUNT_SCHEMA },
    },
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "ตรวจนับสินค้าในรูปนี้ตามคำสั่ง แล้วตอบตาม schema" },
        ],
      },
    ],
  };
}

const CONFIDENCE = new Set(["low", "med", "high"]);

// normalize 1 pile → คืน shape มาตรฐาน หรือ null ถ้าใช้ไม่ได้ (count ไม่ใช่ตัวเลข)
export function coercePile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const count = Number(raw.count);
  if (!Number.isFinite(count)) return null;
  const productId = raw.productId === undefined ? null : raw.productId;
  return {
    productId,
    guess: typeof raw.guess === "string" ? raw.guess : "",
    count: Math.max(0, Math.round(count)),
    confidence: CONFIDENCE.has(raw.confidence) ? raw.confidence : "low",
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

// ดึง+validate piles จาก response ของ Anthropic Messages API
// throw เมื่อ refusal หรือ output อ่านไม่ได้
export function parseStockCountResponse(apiData) {
  if (!apiData || typeof apiData !== "object") throw new Error("empty response");
  if (apiData.stop_reason === "refusal") throw new Error("model refused the request");
  const blocks = Array.isArray(apiData.content) ? apiData.content : [];
  const textBlock = blocks.find((b) => b && b.type === "text" && typeof b.text === "string");
  if (!textBlock) throw new Error("no text block in response");
  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("response was not valid JSON");
  }
  const rawPiles = Array.isArray(parsed && parsed.piles) ? parsed.piles : [];
  return { piles: rawPiles.map(coercePile).filter(Boolean) };
}

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req, res) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "https://stock-app-gray-seven.vercel.app").split(",");
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  try {
    const { image, catalog, model } = req.body || {};
    if (!image || !image.base64) return res.status(400).json({ error: "Missing image.base64" });
    const mediaType = image.mediaType || "image/jpeg";
    const modelId = resolveModel(model);
    const systemPrompt = buildSystemPrompt(formatCatalog(catalog || []));
    const body = buildRequestBody({ modelId, base64: image.base64, mediaType, systemPrompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      const errMsg = (errBody && errBody.error && (errBody.error.message || errBody.error.type)) || response.statusText;
      return res.status(response.status).json({ error: errMsg });
    }

    const data = await response.json();
    const { piles } = parseStockCountResponse(data);
    return res.status(200).json({ piles, model: modelId });
  } catch (e) {
    console.error("stock-count error:", e.message, e.stack);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}

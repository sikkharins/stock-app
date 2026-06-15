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

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

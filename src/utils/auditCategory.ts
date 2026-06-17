export interface AuditCategory {
  key: string;
  label: string;
  color: string; // CSS var, e.g. "var(--red)"
  bg: string;    // tint background to match existing badge style
  risk: boolean;
}

// Ordered rules — first keyword match wins. Destructive keywords are listed
// first so a mixed string like "ลบ SO (ยกเลิก PO)" classifies as a risk.
const RULES: Array<{ kw: string[]; cat: AuditCategory }> = [
  { kw: ["ลบ"],       cat: { key: "delete",    label: "ลบ",       color: "var(--red)",    bg: "rgba(255,59,48,0.12)",  risk: true } },
  { kw: ["ยกเลิก"],   cat: { key: "cancel",    label: "ยกเลิก",   color: "var(--red)",    bg: "rgba(255,59,48,0.12)",  risk: true } },
  { kw: ["ปฏิเสธ"],   cat: { key: "reject",    label: "ปฏิเสธ",   color: "var(--pink)",   bg: "rgba(255,45,85,0.12)",  risk: true } },
  { kw: ["ขออนุมัติ"], cat: { key: "submit",    label: "ขออนุมัติ", color: "var(--blue)",   bg: "var(--blue-bg)",        risk: false } },
  { kw: ["อนุมัติ"],   cat: { key: "approve",   label: "อนุมัติ",   color: "var(--blue)",   bg: "var(--blue-bg)",        risk: false } },
  { kw: ["แก้ไข", "เปลี่ยน", "อัปเดต"], cat: { key: "edit", label: "แก้ไข", color: "var(--orange)", bg: "rgba(255,149,0,0.14)", risk: false } },
  { kw: ["สร้าง", "แปลง"], cat: { key: "create", label: "สร้าง", color: "var(--green)", bg: "rgba(52,199,89,0.12)", risk: false } },
  { kw: ["ปรับสต็อก", "สต็อก"], cat: { key: "stock", label: "สต็อก", color: "var(--purple)", bg: "rgba(175,82,222,0.12)", risk: false } },
  { kw: ["จัดส่ง", "รับของ", "การส่ง"], cat: { key: "logistics", label: "จัดส่ง", color: "var(--teal)", bg: "rgba(90,200,250,0.16)", risk: false } },
  { kw: ["นำเข้า"],   cat: { key: "import",    label: "นำเข้า",   color: "var(--teal)",   bg: "rgba(90,200,250,0.16)", risk: false } },
  { kw: ["ส่ง"],      cat: { key: "send",      label: "ส่ง",      color: "var(--blue)",   bg: "var(--blue-bg)",        risk: false } },
];

const OTHER: AuditCategory = { key: "other", label: "อื่น ๆ", color: "var(--dim)", bg: "var(--hover)", risk: false };

export function categorizeAudit(action: string): AuditCategory {
  const a = action || "";
  for (const r of RULES) {
    if (r.kw.some(k => a.includes(k))) return r.cat;
  }
  return OTHER;
}

// Distinct categories (display order, deduped) for the filter dropdown.
export const CATEGORIES: AuditCategory[] = (() => {
  const seen = new Set<string>();
  const out: AuditCategory[] = [];
  for (const r of RULES) {
    if (!seen.has(r.cat.key)) { seen.add(r.cat.key); out.push(r.cat); }
  }
  out.push(OTHER);
  return out;
})();

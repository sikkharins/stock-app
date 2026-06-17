export type AuditRef =
  | { type: "so" | "po" | "qt"; num: string }
  | { type: "product"; code: string }
  | null;

// Matches "PO-2026-001" (legacy) and "PO-2026-06-001" (monthly): a 4-digit year
// then one or two more numeric groups.
const DOC_RE = /(SO|PO|QT)-\d{4}(?:-\d+){1,2}/;

export function parseAuditRef(detail: string, productCodes: string[] = []): AuditRef {
  const d = detail || "";
  const m = d.match(DOC_RE);
  if (m) {
    return { type: m[1].toLowerCase() as "so" | "po" | "qt", num: m[0] };
  }
  const codeSet = new Set(productCodes);
  for (const t of d.split(/[\s,()]+/).filter(Boolean)) {
    if (codeSet.has(t)) return { type: "product", code: t };
  }
  return null;
}

// audit.date is Thai Buddhist-era text from nowStr(): "DD/MM/BBBB HH:MM".
export function parseAuditDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [datePart, timePart = ""] = dateStr.split(" ");
  const dp = datePart.split("/");
  if (dp.length !== 3) return null;
  const day = +dp[0];
  const month = +dp[1];
  let year = +dp[2];
  if (!day || !month || !year) return null;
  if (year > 2400) year -= 543; // BE -> CE
  const [hh = "0", mm = "0"] = timePart.split(":");
  const d = new Date(year, month - 1, day, +hh || 0, +mm || 0);
  return isNaN(d.getTime()) ? null : d;
}

export type DateRange = "all" | "today" | "7d" | "month";

export function auditInRange(dateStr: string, range: DateRange, now: Date = new Date()): boolean {
  if (range === "all") return true;
  const d = parseAuditDate(dateStr);
  if (!d) return false;
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === "today") return sameMonth && d.getDate() === now.getDate();
  if (range === "month") return sameMonth;
  // "7d": from start of the day 6 days ago through now.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
  return d.getTime() >= start.getTime();
}

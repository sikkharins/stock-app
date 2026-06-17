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

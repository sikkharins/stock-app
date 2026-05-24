const esc = v => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = rows => "﻿" + rows.map(r => r.map(esc).join(",")).join("\r\n");

export function dlCSV(name, rows) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}

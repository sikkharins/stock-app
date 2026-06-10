import { useMemo, useState } from "react";
import {
  salesByCustomerId,
  lifetimeValue,
  outstandingDetail,
  arStatus,
  lastPurchaseDays,
} from "../utils/customerStats.ts";
import { fmt } from "../utils/helpers.js";
import { brandColor } from "../utils/brandColors.ts";

const STATUS_COLOR = {
  overdue: "var(--red)",
  ar: "var(--orange)",
  dormant: "var(--faint)",
  normal: "var(--green)",
};

export default function CustomersTable({ customers, sales, payments, today, cN, onRowClick }) {
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const salesByCust = useMemo(() => salesByCustomerId(sales || []), [sales]);

  const enriched = useMemo(
    () =>
      customers.map((c) => {
        const mine = salesByCust[c.id] || [];
        return {
          c,
          name: cN(c) || "",
          ltv: lifetimeValue(c, mine),
          lpd: lastPurchaseDays(c, mine, today),
          out: outstandingDetail(c, mine, payments || [], today),
          status: arStatus(c, mine, payments || [], today),
        };
      }),
    [customers, salesByCust, payments, today, cN]
  );

  const sorted = useMemo(() => {
    const arr = enriched.slice();
    const sign = sortDir === "asc" ? 1 : -1;
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name, "th") * sign,
      group: (a, b) => (a.c.customerGroup || "").localeCompare(b.c.customerGroup || "") * sign,
      sales: (a, b) => (a.c.salesPerson || "").localeCompare(b.c.salesPerson || "") * sign,
      ltv: (a, b) => (a.ltv - b.ltv) * sign,
      lpd: (a, b) => ((a.lpd ?? 9999) - (b.lpd ?? 9999)) * sign,
      out: (a, b) => (a.out.total - b.out.total) * sign,
    };
    arr.sort(cmp[sortCol] || cmp.name);
    return arr;
  }, [enriched, sortCol, sortDir]);

  const head = (label, col) => (
    <th
      onClick={() => {
        if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortCol(col);
          setSortDir("asc");
        }
      }}
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 600,
        fontSize: 12,
        color: "var(--dim)",
        cursor: "pointer",
        userSelect: "none",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {label} {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ width: 16, padding: "10px 0 10px 12px", background: "var(--bg)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0 }} />
            {head("ชื่อ", "name")}
            {head("กลุ่ม", "group")}
            {head("เซลส์", "sales")}
            {head("ซื้อรวม", "ltv")}
            {head("ซื้อล่าสุด", "lpd")}
            {head("รอเก็บ", "out")}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ c, name, ltv, lpd, out, status }) => {
            const bc = c.salesPerson ? brandColor(c.salesPerson) : null;
            return (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                style={{ cursor: "pointer", borderBottom: "1px solid var(--line)" }}
              >
                <td style={{ padding: "8px 0 8px 12px" }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: STATUS_COLOR[status] }} />
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}>{name}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--dim)" }}>
                  {c.customerGroup === "regular" ? "ประจำ" : c.customerGroup === "walkin" ? "หน้าร้าน" : "-"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: bc ? bc.text : "var(--dim)" }}>
                  {c.salesPerson || "-"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>{ltv > 0 ? "฿" + fmt(Math.round(ltv)) : "-"}</td>
                <td style={{ padding: "8px 12px", fontSize: 12, color: lpd === null ? "var(--faint)" : lpd > 60 ? "var(--red)" : lpd > 30 ? "var(--orange)" : "var(--dim)" }}>
                  {lpd === null ? "—" : lpd + " วันก่อน"}
                </td>
                <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>
                  {out.total > 0 ? (
                    <>
                      ฿{fmt(Math.round(out.total))}
                      {out.overdueCount > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: "rgba(255,59,48,0.12)", color: "var(--red)", borderRadius: 99, padding: "1px 6px", fontWeight: 600 }}>
                          {out.overdueCount} เกิน
                        </span>
                      )}
                    </>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

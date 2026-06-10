import { getSS, fmt } from "../utils/helpers";

type Product = {
  id: number;
  code: string;
  name: string;
  brand: string;
  categoryId: number;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
  discontinued?: boolean;
};

interface ProductsTableProps {
  products: Product[];
  sales: any[];
  pN: (p: Product) => string;
  getCN: (id: number) => string;
  onRowClick: (p: Product) => void;
  onEdit: (p: Product) => void;
  onAdjust: (p: Product) => void;
  onDelete: (p: Product) => void;
  ed: boolean;
  cd: boolean;
  bulkMode: boolean;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  sortBy: string;
  onSortChange: (next: string) => void;
  density: "comfortable" | "compact";
}

const SORT_TOGGLES: Record<string, [string, string]> = {
  name: ["name", "name"],
  price: ["price_asc", "price_desc"],
  stock: ["stock_asc", "stock_desc"],
  last_sold: ["last_sold", "last_sold"],
};

export default function ProductsTable({
  products,
  sales,
  pN,
  getCN,
  onRowClick,
  onEdit,
  onAdjust,
  onDelete,
  ed,
  cd,
  bulkMode,
  selected,
  onToggleSelect,
  sortBy,
  onSortChange,
  density,
}: ProductsTableProps) {
  const rowH = density === "compact" ? 32 : 44;

  const sortClick = (key: keyof typeof SORT_TOGGLES) => {
    const [a, b] = SORT_TOGGLES[key];
    onSortChange(sortBy === a ? b : a);
  };

  const sortArrow = (key: keyof typeof SORT_TOGGLES) => {
    const [a, b] = SORT_TOGGLES[key];
    if (sortBy === a && a !== b) return " ↑";
    if (sortBy === b && a !== b) return " ↓";
    if (sortBy === a) return " •";
    return "";
  };

  const TH: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "var(--panel)",
    borderBottom: "1px solid var(--line)",
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--dim)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
    zIndex: 10,
  };

  const TD: React.CSSProperties = {
    padding: `${rowH === 32 ? 4 : 8}px 12px`,
    fontSize: 13,
    borderBottom: "0.5px solid var(--line)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius-card,12px)", overflow: "auto", boxShadow: "var(--shadow-card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {bulkMode && <th style={{ ...TH, width: 40, cursor: "default" }}> </th>}
            <th style={{ ...TH, cursor: "default" }}>Code</th>
            <th style={TH} onClick={() => sortClick("name")}>ชื่อ{sortArrow("name")}</th>
            <th style={{ ...TH, cursor: "default" }}>หมวด</th>
            <th style={TH} onClick={() => sortClick("stock")}>สต็อก{sortArrow("stock")}</th>
            <th style={{ ...TH, textAlign: "right" }} onClick={() => sortClick("price")}>ราคา{sortArrow("price")}</th>
            <th style={{ ...TH, cursor: "default" }}>สถานะ</th>
            <th style={TH} onClick={() => sortClick("last_sold")}>ขายล่าสุด{sortArrow("last_sold")}</th>
            {ed && <th style={{ ...TH, cursor: "default", width: 60 }}> </th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const ss = getSS(p.id, sales);
            const isLow = p.minStock > 0 && p.stock <= p.minStock;
            const isSel = selected.has(p.id);
            return (
              <tr
                key={p.id}
                onClick={() => (bulkMode ? onToggleSelect(p.id) : onRowClick(p))}
                style={{
                  cursor: "pointer",
                  background: isSel ? "var(--blue-bg)" : "transparent",
                  transition: "background 100ms var(--ease-out, ease-out)",
                }}
                onMouseEnter={(e) => {
                  if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = "var(--hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                }}
              >
                {bulkMode && (
                  <td style={TD} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggleSelect(p.id)}
                      style={{ width: 14, height: 14, accentColor: "var(--blue)", cursor: "pointer" }}
                    />
                  </td>
                )}
                <td style={{ ...TD, fontFamily: "var(--mono, monospace)", fontSize: 11, color: "var(--dim)" }}>{p.code}</td>
                <td style={{ ...TD, fontWeight: 500, textDecoration: p.discontinued ? "line-through" : "none" }}>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--hover)", color: "var(--dim)", marginRight: 6, fontWeight: 600 }}>{p.brand}</span>
                  {pN(p)}
                </td>
                <td style={{ ...TD, color: "var(--dim)" }}>{getCN(p.categoryId)}</td>
                <td style={TD}>
                  <strong className="num" style={{ color: isLow ? "var(--red)" : "var(--green)" }}>{p.stock}</strong>
                  <span style={{ color: "var(--dim)" }}>{" / " + p.minStock}</span>
                </td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 600 }} className="num">{"฿" + fmt(p.price)}</td>
                <td style={TD}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: ss.bg,
                      color: ss.color,
                      fontWeight: 600,
                    }}
                    title={ss.label}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, display: "inline-block" }} />
                    {ss.icon}
                  </span>
                </td>
                <td style={{ ...TD, color: "var(--dim)", fontSize: 12 }}>{ss.days != null ? ss.days + " วัน" : "—"}</td>
                {ed && (
                  <td style={TD} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => onEdit(p)}
                        title="แก้ไข"
                        style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--blue)", background: "var(--blue-bg)", color: "var(--blue)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => onAdjust(p)}
                        title="สต็อก"
                        style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--orange)", background: "rgba(255,149,0,0.14)", color: "var(--orange)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        ±
                      </button>
                      {cd && (
                        <button
                          onClick={() => onDelete(p)}
                          title="ลบ"
                          style={{ fontSize: 11, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--red)", background: "rgba(255,59,48,0.12)", color: "var(--red)", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

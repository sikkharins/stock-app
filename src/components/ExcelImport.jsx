import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Modal, MBtns } from "./ui/Modal.jsx";
import { IB } from "../utils/constants.js";
import { fmt } from "../utils/helpers.js";

const COLS = [
  { key: "code", label: "รหัส", required: true },
  { key: "brand", label: "ยี่ห้อ", required: true },
  { key: "name", label: "ชื่อ EN", required: true },
  { key: "nameT", label: "ชื่อ TH" },
  { key: "category", label: "หมวด" },
  { key: "subcategory", label: "หมวดย่อย" },
  { key: "size", label: "ขนาด" },
  { key: "distributor", label: "ผู้จัดจำหน่าย" },
  { key: "price", label: "ราคาขาย", required: true, type: "number" },
  { key: "cost", label: "ต้นทุน", required: true, type: "number" },
  { key: "stock", label: "สต็อก", required: true, type: "number" },
  { key: "minStock", label: "ขั้นต่ำ", required: true, type: "number" },
  { key: "unit", label: "หน่วย" },
];

export default function ExcelImport({ onClose, onImport, cats, brands, contacts, products: existingProducts }) {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [step, setStep] = useState("upload");
  const fileRef = useRef();
  const sups = contacts.filter((c) => c.type === "supplier");

  const downloadTemplate = () => {
    const headers = COLS.map((c) => c.label);
    const example = ["P001", "LG", "LG 2-Door Fridge 14Q", "ตู้เย็น LG 2 ประตู 14 คิว", "ตู้เย็น", "2 ประตู", "14 คิว", "", "12900", "9500", "8", "3", "เครื่อง"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map((_, i) => ({ wch: Math.max(12, headers[i].length * 2.5, (example[i] || "").length * 1.5) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สินค้า");
    XLSX.writeFile(wb, "product_template.xlsx");
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (raw.length < 2) {
        setErrors(["ไฟล์ว่าง หรือไม่มีข้อมูล"]);
        return;
      }

      const headerRow = raw[0].map((h) => String(h || "").trim());
      const colMap = {};
      COLS.forEach((col) => {
        const idx = headerRow.findIndex((h) => h === col.label);
        if (idx >= 0) colMap[col.key] = idx;
      });

      const missing = COLS.filter((c) => c.required && colMap[c.key] === undefined).map((c) => c.label);
      if (missing.length) {
        setErrors(["ไม่พบคอลัมน์ที่จำเป็น: " + missing.join(", ")]);
        return;
      }

      const parsed = [];
      const errs = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || r.every((c) => c == null || String(c).trim() === "")) continue;
        const get = (key) => {
          const idx = colMap[key];
          return idx !== undefined && r[idx] != null ? String(r[idx]).trim() : "";
        };
        const row = {};
        COLS.forEach((col) => {
          const val = get(col.key);
          row[col.key] = col.type === "number" ? (val === "" ? 0 : Number(val)) : val;
        });
        if (!row.unit) row.unit = "เครื่อง";

        const rowErrs = [];
        if (!row.code) rowErrs.push("ไม่มีรหัส");
        if (!row.name) rowErrs.push("ไม่มีชื่อ EN");
        if (!row.brand) rowErrs.push("ไม่มียี่ห้อ");
        if (row.price <= 0 && row.cost <= 0) rowErrs.push("ราคาขายหรือต้นทุนต้อง > 0");

        const existing = (existingProducts||[]).find(p=>p.code && p.code === row.code);
        row._isUpdate = !!existing;
        row._existingId = existing ? existing.id : null;
        row._row = i + 1;
        row._errors = rowErrs;
        parsed.push(row);
        if (rowErrs.length) errs.push(`แถว ${i + 1}: ${rowErrs.join(", ")}`);
      }

      setRows(parsed);
      setErrors(errs);
      setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const doImport = () => {
    const valid = rows.filter((r) => r._errors.length === 0);
    const newItems = [];
    const updateItems = [];
    valid.forEach((r) => {
      const catObj = r.category ? cats.find((c) => c.name === r.category) : null;
      const subObj = catObj && r.subcategory ? (catObj.subs || []).find((s) => s.name === r.subcategory) : null;
      const fields = {
        code: r.code,
        name: r.name,
        nameT: r.nameT || "",
        brand: r.brand,
        categoryId: catObj ? catObj.id : 0,
        subcategoryId: subObj ? subObj.id : 0,
        size: r.size || "",
        distributor: r.distributor || "",
        price: r.price || 0,
        cost: r.cost || 0,
        stock: r.stock || 0,
        minStock: r.minStock || 0,
        unit: r.unit || "เครื่อง",
      };
      if (r._isUpdate) {
        updateItems.push({ id: r._existingId, ...fields });
      } else {
        newItems.push({ id: Date.now() + Math.random(), ...fields });
      }
    });
    onImport(newItems, updateItems);
    onClose();
  };

  const validCount = rows.filter((r) => r._errors.length === 0).length;
  const newCount = rows.filter((r) => r._errors.length === 0 && !r._isUpdate).length;
  const updateCount = rows.filter((r) => r._errors.length === 0 && r._isUpdate).length;
  const errCount = rows.filter((r) => r._errors.length > 0).length;

  const TH = { padding: "6px 10px", fontWeight: 500, color: "var(--dim)", borderBottom: "1px solid var(--line)", fontSize: 11, textAlign: "left", whiteSpace: "nowrap" };
  const TD = { padding: "6px 10px", fontSize: 12, borderBottom: "0.5px solid var(--line)" };

  return (
    <Modal title="นำเข้าสินค้าจาก Excel" onClose={onClose} wide>
      {step === "upload" && (
        <div>
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div style={{ fontSize: 14, marginBottom: 16, color: "var(--dim)" }}>ดาวน์โหลดแบบฟอร์ม Excel กรอกข้อมูลสินค้า แล้ว upload กลับมา</div>
            <button onClick={downloadTemplate} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--green)", background: "rgba(52,199,89,0.12)", color: "var(--green)", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", marginBottom: 24 }}>
              ดาวน์โหลดแบบฟอร์ม (.xlsx)
            </button>

            <div style={{ border: "2px dashed var(--line)", borderRadius: 12, padding: "2rem", background: "var(--bg)", cursor: "pointer" }} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ color: "var(--dim)", fontSize: 13, marginBottom: 4 }}>คลิกเลือกไฟล์ หรือลากมาวาง</div>
              <div style={{ color: "var(--faint)", fontSize: 11 }}>รองรับ .xlsx, .xls</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) parseFile(f); }} />
            </div>
          </div>

          {errors.length > 0 && (
            <div style={{ background: "rgba(255,59,48,0.12)", border: "1px solid var(--red)", borderRadius: 8, padding: 12, marginTop: 12 }}>
              {errors.map((e, i) => (<div key={i} style={{ fontSize: 12, color: "var(--red)", marginBottom: 2 }}>{e}</div>))}
            </div>
          )}
        </div>
      )}

      {step === "preview" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {newCount > 0 && <div style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(52,199,89,0.12)", border: "1px solid var(--green)", fontSize: 13 }}>
              <span style={{ color: "var(--green)", fontWeight: 600 }}>{newCount}</span>
              <span style={{ color: "var(--dim)", marginLeft: 4 }}>เพิ่มใหม่</span>
            </div>}
            {updateCount > 0 && <div style={{ padding: "8px 16px", borderRadius: 8, background: "var(--blue-bg)", border: "1px solid var(--blue)", fontSize: 13 }}>
              <span style={{ color: "var(--blue)", fontWeight: 600 }}>{updateCount}</span>
              <span style={{ color: "var(--dim)", marginLeft: 4 }}>อัพเดท</span>
            </div>}
            {errCount > 0 && (
              <div style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,59,48,0.12)", border: "1px solid var(--red)", fontSize: 13 }}>
                <span style={{ color: "var(--red)", fontWeight: 600 }}>{errCount}</span>
                <span style={{ color: "var(--dim)", marginLeft: 4 }}>มีปัญหา (จะข้าม)</span>
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8, maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg)", position: "sticky", top: 0 }}>
                  <th style={TH}>#</th>
                  <th style={TH}>รหัส</th>
                  <th style={TH}>ยี่ห้อ</th>
                  <th style={TH}>ชื่อ EN</th>
                  <th style={TH}>ชื่อ TH</th>
                  <th style={TH}>หมวด</th>
                  <th style={TH}>ขนาด</th>
                  <th style={{ ...TH, textAlign: "right" }}>ราคาขาย</th>
                  <th style={{ ...TH, textAlign: "right" }}>ต้นทุน</th>
                  <th style={{ ...TH, textAlign: "right" }}>สต็อก</th>
                  <th style={TH}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const hasErr = r._errors.length > 0;
                  return (
                    <tr key={i} style={{ background: hasErr ? "rgba(255,59,48,0.06)" : "transparent" }}>
                      <td style={{ ...TD, color: "var(--faint)", fontSize: 11 }}>{r._row}</td>
                      <td style={{ ...TD, fontWeight: 500 }}>{r.code}</td>
                      <td style={TD}>{r.brand}</td>
                      <td style={TD}>{r.name}</td>
                      <td style={{ ...TD, color: "var(--dim)" }}>{r.nameT}</td>
                      <td style={{ ...TD, color: "var(--dim)", fontSize: 11 }}>{r.category}{r.subcategory ? " › " + r.subcategory : ""}</td>
                      <td style={{ ...TD, fontSize: 11 }}>{r.size}</td>
                      <td style={{ ...TD, textAlign: "right", color: "var(--blue)" }}>{"฿" + fmt(r.price)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>{"฿" + fmt(r.cost)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 600 }}>{r.stock}</td>
                      <td style={TD}>
                        {hasErr ? (
                          <span title={r._errors.join(", ")} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,59,48,0.12)", color: "var(--red)", fontWeight: 600 }}>ข้อมูลไม่ครบ</span>
                        ) : r._isUpdate ? (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "var(--blue-bg)", color: "var(--blue)", fontWeight: 600 }}>อัพเดท</span>
                        ) : (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(52,199,89,0.12)", color: "var(--green)", fontWeight: 600 }}>ใหม่</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {errors.length > 0 && (
            <div style={{ background: "rgba(255,149,0,0.12)", border: "1px solid var(--orange)", borderRadius: 8, padding: 12, marginTop: 12, maxHeight: 120, overflowY: "auto" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--orange)", marginBottom: 4 }}>แถวที่มีปัญหา (จะไม่นำเข้า):</div>
              {errors.map((e, i) => (<div key={i} style={{ fontSize: 11, color: "var(--dim)", marginBottom: 1 }}>{e}</div>))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 10 }}>
            <button onClick={() => { setStep("upload"); setRows([]); setErrors([]); if (fileRef.current) fileRef.current.value = ""; }} style={{ padding: "6px 13px", borderRadius: 7, border: "1px solid var(--line)", cursor: "pointer", background: "var(--bg2)", color: "var(--text)", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
              เลือกไฟล์ใหม่
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ padding: "6px 13px", borderRadius: 7, border: "1px solid var(--line)", cursor: "pointer", background: "var(--bg2)", color: "var(--text)", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>ยกเลิก</button>
              <button onClick={doImport} disabled={validCount === 0} style={{ padding: "6px 16px", borderRadius: 7, border: "none", cursor: validCount > 0 ? "pointer" : "not-allowed", background: validCount > 0 ? "var(--green)" : "var(--hover2)", color: validCount > 0 ? "#fff" : "var(--dim)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: validCount === 0 ? 0.6 : 1 }}>
                {"นำเข้า " + validCount + " รายการ" + (updateCount > 0 ? " (อัพเดท " + updateCount + ")" : "")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

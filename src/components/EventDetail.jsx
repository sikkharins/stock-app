import { useState, useMemo, Fragment } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";

const STATUS_LABEL = { draft: "ฉบับร่าง", active: "เปิดใช้งาน", closed: "ปิด event" };

export default function EventDetail({ event, sh, onClose }) {
  const { setEvents, products, contacts, cats, pN, cN, sales, setContacts, canE } = sh;
  const ed = canE("events");
  const [tab, setTab] = useState("setup");
  const [subModal, setSubModal] = useState(null); // {type, data}
  const [confirmAct, setConfirmAct] = useState(null);

  const updateEvent = (patch) => setEvents(prev => prev.map(e => e.id === event.id ? { ...e, ...patch } : e));

  // Tab 1: Setup
  const [setupForm, setSetupForm] = useState({
    name: event.name, description: event.description || "",
    startDate: event.startDate, endDate: event.endDate || "",
    status: event.status || "draft",
  });
  const saveSetup = () => {
    updateEvent({ name: setupForm.name, description: setupForm.description, startDate: setupForm.startDate, endDate: setupForm.endDate || "", status: setupForm.status });
  };

  // Compute earned packs per pack-condition (condition-based)
  const computePackProgress = (custId, pack) => {
    const validSOs = (sales || []).filter(s =>
      s.customerId === custId &&
      ["completed", "pending_delivery"].includes(s.status) &&
      (!event.startDate || s.date >= event.startDate) &&
      (!event.endDate || s.date <= event.endDate)
    );
    let total = 0;
    validSOs.forEach(so => {
      (so.items || []).forEach(it => {
        const prod = products.find(p => p.id === +it.productId);
        if (!prod) return;
        if ((pack.brands || []).length && !pack.brands.includes(prod.brand)) return;
        if ((pack.categoryIds || []).length && !pack.categoryIds.includes(prod.categoryId)) return;
        if ((pack.productIds || []).length && !pack.productIds.includes(prod.id)) return;
        total += pack.measureBy === "qty" ? (+it.qty || 0) : (+it.qty || 0) * (+it.price || 0);
      });
    });
    const threshold = +pack.threshold || 0;
    const earned = threshold > 0 ? Math.floor(total / threshold) : 0;
    const coupons = earned * (+pack.couponsPerPack || 0);
    return { total, earned, coupons, threshold, soCount: validSOs.length };
  };

  // Aggregate progress across all packs for a customer
  const computeProgress = (custId) => {
    let bought = 0, coupons = 0, soCount = 0;
    const perPack = (event.packs || []).map(pack => {
      const r = computePackProgress(custId, pack);
      bought += r.earned;
      coupons += r.coupons;
      soCount = Math.max(soCount, r.soCount);
      return { pack, ...r };
    });
    return { bought, coupons, soCount, perPack };
  };

  const rewardRemaining = (rw) => (rw.totalQty || 0) - ((event.awards || []).filter(a => a.rewardId === rw.id).reduce((s, a) => s + (+a.qty || 0), 0));

  return <Modal title={`Event: ${event.name}`} onClose={onClose} wide>
    {/* Sub-tabs */}
    <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "2px solid var(--line)", flexWrap: "wrap" }}>
      {[
        ["setup", "ตั้งค่า"],
        ["packs", "Packs" + ((event.packs || []).length ? " (" + event.packs.length + ")" : "")],
        ["rewards", "รางวัล" + ((event.rewards || []).length ? " (" + event.rewards.length + ")" : "")],
        ["customers", "ลูกค้า / ออกรางวัล" + ((event.customerTargets || []).length ? " (" + event.customerTargets.length + ")" : "")],
      ].map(([k, label]) => (
        <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === k ? 600 : 400, border: "none", borderBottom: tab === k ? "2px solid var(--text)" : "2px solid transparent", marginBottom: "-2px", background: "transparent", cursor: "pointer", color: tab === k ? "var(--text)" : "var(--dim)", whiteSpace: "nowrap" }}>
          {label}
        </button>
      ))}
    </div>

    {/* TAB 1: Setup */}
    {tab === "setup" && <div style={{ display: "grid", gap: 14 }}>
      <Field label="ชื่อ Event" req><input value={setupForm.name} onChange={e => setSetupForm(f => ({ ...f, name: e.target.value }))} style={IB} /></Field>
      <Field label="คำอธิบาย"><textarea value={setupForm.description} onChange={e => setSetupForm(f => ({ ...f, description: e.target.value }))} style={{ ...IB, height: 60, resize: "vertical" }} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="วันเริ่มต้น" req><ThaiDateInput value={setupForm.startDate} onChange={e => setSetupForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
        <Field label="วันสิ้นสุด"><ThaiDateInput value={setupForm.endDate} onChange={e => setSetupForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
      </div>
      <Field label="สถานะ">
        <CustomSelect value={setupForm.status} onChange={v => setSetupForm(f => ({ ...f, status: v }))} options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
      </Field>
      {ed && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={saveSetup} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>บันทึก</button>
      </div>}
    </div>}

    {/* TAB 2: Packs */}
    {tab === "packs" && <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>Pack = เงื่อนไขซื้อ — ลูกค้าซื้อครบเงื่อนไขจะได้คูปอง (นับซ้ำได้)</div>
        {ed && <button onClick={() => setSubModal({ type: "pack", data: { id: Date.now(), packCode: "", name: "", couponsPerPack: 1, measureBy: "amount", threshold: 0, brands: [], categoryIds: [], productIds: [] } })} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--blue)", background: "var(--blue-bg)", color: "var(--blue)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>+ เพิ่ม Pack</button>}
      </div>
      {(event.packs || []).length === 0 ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", background: "var(--bg)", borderRadius: 8 }}>ยังไม่มี Pack</div> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 10 }}>
          {(event.packs || []).map(pk => {
            const catNames = (pk.categoryIds || []).map(id => { const c = cats.find(x => x.id === id); return c ? c.name : null; }).filter(Boolean);
            const prodNames = (pk.productIds || []).map(id => { const p = products.find(x => x.id === id); return p ? pN(p) : null; }).filter(Boolean);
            const measureLabel = pk.measureBy === "qty" ? fmt(pk.threshold || 0) + " ชิ้น" : "฿" + fmt(pk.threshold || 0);
            return <div key={pk.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{pk.name || "(ไม่มีชื่อ)"}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "monospace" }}>{pk.packCode}</div>
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(175,82,222,0.14)", color: "var(--purple)", fontWeight: 600, whiteSpace: "nowrap" }}>{(pk.couponsPerPack || 0) + " คูปอง"}</span>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 6, padding: "8px 10px", marginBottom: 8, fontSize: 12 }}>
                <div style={{ color: "var(--dim)", fontSize: 10, marginBottom: 2, fontWeight: 600 }}>ครบเงื่อนไข</div>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{measureLabel}</div>
              </div>
              <div style={{ paddingTop: 6, borderTop: "1px dashed var(--line)", display: "flex", flexDirection: "column", gap: 5 }}>
                {(pk.brands || []).length > 0 && <div style={{ fontSize: 11 }}><span style={{ color: "var(--faint)" }}>ยี่ห้อ: </span>{pk.brands.map(b => <span key={b} style={{ display: "inline-block", fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--blue-bg)", color: "var(--blue)", marginRight: 4, fontWeight: 500 }}>{b}</span>)}</div>}
                {catNames.length > 0 && <div style={{ fontSize: 11 }}><span style={{ color: "var(--faint)" }}>หมวด: </span>{catNames.map(n => <span key={n} style={{ display: "inline-block", fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(255,149,0,0.14)", color: "var(--orange)", marginRight: 4, fontWeight: 500 }}>{n}</span>)}</div>}
                {prodNames.length > 0 && <div style={{ fontSize: 11 }}><span style={{ color: "var(--faint)" }}>{"เจาะจง " + prodNames.length + " รุ่น: "}</span><span style={{ fontSize: 10, color: "var(--purple)" }}>{prodNames.slice(0, 2).join(", ") + (prodNames.length > 2 ? " +" + (prodNames.length - 2) + " รุ่น" : "")}</span></div>}
                {(pk.brands || []).length === 0 && catNames.length === 0 && prodNames.length === 0 && <div style={{ fontSize: 11, color: "var(--faint)", fontStyle: "italic" }}>ทุกสินค้า (ไม่กรอง)</div>}
              </div>
              {ed && <div style={{ display: "flex", gap: 8, paddingTop: 8, marginTop: 8, borderTop: "1px solid var(--line)" }}>
                <button onClick={() => setSubModal({ type: "pack", data: { ...pk } })} style={{ fontSize: 11, color: "var(--blue)", background: "transparent", border: "none", cursor: "pointer" }}>แก้ไข</button>
                <button onClick={() => setConfirmAct({ title: "ลบ Pack", msg: "ลบ " + (pk.name || pk.packCode) + " ?", onOk: () => updateEvent({ packs: (event.packs || []).filter(x => x.id !== pk.id) }) })} style={{ fontSize: 11, color: "var(--red)", background: "transparent", border: "none", cursor: "pointer" }}>ลบ</button>
              </div>}
            </div>;
          })}
        </div>
      }
    </div>}

    {/* TAB 3: Rewards (slot-based) */}
    {tab === "rewards" && <RewardsTab event={event} updateEvent={updateEvent} sh={sh} setSubModal={setSubModal} setConfirmAct={setConfirmAct} ed={ed} computeProgress={computeProgress} />}

    {/* TAB 4: Customers + Awards */}
    {tab === "customers" && <CustomerTab event={event} updateEvent={updateEvent} sh={sh} computeProgress={computeProgress} rewardRemaining={rewardRemaining} setSubModal={setSubModal} setConfirmAct={setConfirmAct} ed={ed} />}

    {/* Pack edit/create modal */}
    {subModal?.type === "pack" && <PackForm sh={sh} data={subModal.data} onClose={() => setSubModal(null)} onSave={(pack) => {
      const exists = (event.packs || []).some(x => x.id === pack.id);
      updateEvent({ packs: exists ? event.packs.map(x => x.id === pack.id ? pack : x) : [...(event.packs || []), pack] });
      setSubModal(null);
    }} />}

    {/* Reward edit/create modal */}
    {subModal?.type === "reward" && <RewardForm sh={sh} data={subModal.data} onClose={() => setSubModal(null)} onSave={(rw) => {
      const exists = (event.rewards || []).some(x => x.id === rw.id);
      updateEvent({ rewards: exists ? event.rewards.map(x => x.id === rw.id ? rw : x) : [...(event.rewards || []), rw] });
      setSubModal(null);
    }} />}

    {/* Customer target add modal */}
    {subModal?.type === "target" && <TargetForm sh={sh} data={subModal.data} onClose={() => setSubModal(null)} onSave={(t) => {
      const exists = (event.customerTargets || []).some(x => x.customerId === t.customerId);
      updateEvent({ customerTargets: exists ? event.customerTargets.map(x => x.customerId === t.customerId ? t : x) : [...(event.customerTargets || []), t] });
      setSubModal(null);
    }} />}

    {/* Award modal */}
    {subModal?.type === "award" && <AwardForm sh={sh} event={event} customerId={subModal.data.customerId} rewardRemaining={rewardRemaining} onClose={() => setSubModal(null)} onSave={(award) => {
      // 1. Add to event.awards
      const newAwards = [...(event.awards || []), award];
      updateEvent({ awards: newAwards });
      // 2. Push reward into customer.savedRewards (wallet)
      const rw = (event.rewards || []).find(r => r.id === award.rewardId);
      const prod = products.find(p => p.id === +rw?.productId);
      const cust = contacts.find(c => c.id === award.customerId);
      if (rw && prod && cust) {
        const newReward = {
          id: Date.now() + Math.random(),
          promoId: event.id,
          promoName: event.name + " (Event)",
          tier: { id: rw.id, threshold: 0, rewardType: "product", rewardValue: 0, rewardProductId: +rw.productId },
          savedAt: todayStr(),
          savedFromSO: "(จาก event)",
        };
        // multiply by qty
        const newWalletItems = [];
        for (let i = 0; i < (award.qty || 1); i++) newWalletItems.push({ ...newReward, id: Date.now() + Math.random() + i });
        setContacts(prev => prev.map(c => c.id === cust.id ? { ...c, savedRewards: [...(c.savedRewards || []), ...newWalletItems] } : c));
      }
      setSubModal(null);
    }} />}

    {/* Confirm dialog */}
    {confirmAct && <Modal title={confirmAct.title} onClose={() => setConfirmAct(null)}>
      <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>{confirmAct.msg}</div>
      <MBtns onCancel={() => setConfirmAct(null)} onSave={() => { const f = confirmAct.onOk; setConfirmAct(null); if (typeof f === "function") f(); }} saveLabel="ยืนยัน" />
    </Modal>}
  </Modal>;
}

// ========== Sub-components ==========

function PackForm({ sh, data, onClose, onSave }) {
  const { products, pN, brands = [], cats = [] } = sh;
  const [form, setForm] = useState({
    measureBy: "amount", threshold: 0, productIds: [],
    ...data,
    brands: data.brands || [], categoryIds: data.categoryIds || [],
    productIds: data.productIds || [],
  });
  const toggleBrand = (b) => setForm(f => ({ ...f, brands: f.brands.includes(b) ? f.brands.filter(x => x !== b) : [...f.brands, b] }));
  const toggleCat = (id) => setForm(f => ({ ...f, categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter(x => x !== id) : [...f.categoryIds, id] }));
  const toggleProd = (id) => setForm(f => ({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter(x => x !== id) : [...f.productIds, id] }));
  const valid = form.name && form.packCode && +form.threshold > 0 && +form.couponsPerPack >= 0;

  // Filter products by selected brands/categories (for the multi-pick picker)
  const filteredProducts = useMemo(() => products.filter(p => {
    if ((form.brands || []).length && !form.brands.includes(p.brand)) return false;
    if ((form.categoryIds || []).length && !form.categoryIds.includes(p.categoryId)) return false;
    return true;
  }), [products, form.brands, form.categoryIds]);

  const chip = { display: "inline-block", fontSize: 11, fontWeight: 500, borderRadius: 5, padding: "4px 10px", marginRight: 4, marginBottom: 3, cursor: "pointer", border: "1px solid transparent" };

  return <Modal title="Pack (เงื่อนไขซื้อ)" onClose={onClose}>
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <Field label="รหัส" req><input value={form.packCode} onChange={e => setForm(f => ({ ...f, packCode: e.target.value }))} style={IB} placeholder="PK01" /></Field>
        <Field label="ชื่อเงื่อนไข" req><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={IB} placeholder="เช่น LG ครบ 500K" /></Field>
      </div>

      {/* Measure + threshold */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--dim)", marginBottom: 6 }}>วัดผลด้วย</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {[{ k: "amount", lbl: "ยอดเงิน (บาท)" }, { k: "qty", lbl: "จำนวนสินค้า (ชิ้น)" }].map(opt => {
            const sel = form.measureBy === opt.k;
            return <label key={opt.k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderRadius: 8, border: "1.5px solid " + (sel ? "var(--blue)" : "var(--line)"), background: sel ? "var(--blue-bg)" : "var(--panel)", cursor: "pointer" }}>
              <input type="radio" name="meas" checked={sel} onChange={() => setForm(f => ({ ...f, measureBy: opt.k }))} />
              <span style={{ fontSize: 13, color: sel ? "var(--blue)" : "var(--text)", fontWeight: sel ? 600 : 400 }}>{opt.lbl}</span>
            </label>;
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label={form.measureBy === "qty" ? "ครบ (ชิ้น)" : "ครบ (฿)"} req><input type="number" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: +e.target.value || 0 }))} style={IB} placeholder={form.measureBy === "qty" ? "10" : "500000"} /></Field>
        <Field label="คูปองต่อ pack ที่ครบ"><input type="number" value={form.couponsPerPack} onChange={e => setForm(f => ({ ...f, couponsPerPack: +e.target.value || 0 }))} style={IB} placeholder="5" /></Field>
      </div>

      <div style={{ background: "var(--blue-bg)", border: "1px solid var(--blue)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--blue)" }}>
        ตัวอย่าง: ซื้อสินค้าที่กรองครบ <strong>{(form.measureBy === "qty" ? fmt(form.threshold) + " ชิ้น" : "฿" + fmt(form.threshold))}</strong> → ได้ <strong>{form.couponsPerPack || 0} คูปอง</strong> (นับซ้ำได้ — ซื้อ 2 เท่า ได้คูปอง 2 เท่า)
      </div>

      {/* Brand chips */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--dim)", marginBottom: 6 }}>ยี่ห้อที่นับ <span style={{ fontWeight: 400, color: "var(--faint)" }}>(ว่าง = ทุกยี่ห้อ)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 100, overflowY: "auto", padding: 4 }}>
          {brands.map(b => {
            const sel = (form.brands || []).includes(b);
            return <span key={b} onClick={() => toggleBrand(b)} style={{ ...chip, color: sel ? "var(--blue)" : "var(--dim)", background: sel ? "var(--blue-bg)" : "var(--hover)", border: sel ? "1px solid var(--blue)" : "1px solid transparent" }}>{b}</span>;
          })}
        </div>
      </div>

      {/* Category chips */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--dim)", marginBottom: 6 }}>หมวดสินค้าที่นับ <span style={{ fontWeight: 400, color: "var(--faint)" }}>(ว่าง = ทุกหมวด)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 100, overflowY: "auto", padding: 4 }}>
          {cats.map(c => {
            const sel = (form.categoryIds || []).includes(c.id);
            return <span key={c.id} onClick={() => toggleCat(c.id)} style={{ ...chip, color: sel ? "var(--orange)" : "var(--dim)", background: sel ? "rgba(255,149,0,0.14)" : "var(--hover)", border: sel ? "1px solid var(--orange)" : "1px solid transparent" }}>{c.name}</span>;
          })}
        </div>
      </div>

      {/* Specific products picker (optional) */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--dim)", marginBottom: 6 }}>เจาะจงรุ่นสินค้า <span style={{ fontWeight: 400, color: "var(--faint)" }}>(ว่าง = ตามยี่ห้อ/หมวด • เลือกถ้าต้องการกำหนดเฉพาะรุ่น)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflowY: "auto", padding: 4, background: "var(--bg)", borderRadius: 6 }}>
          {filteredProducts.length === 0 ? <div style={{ fontSize: 11, color: "var(--faint)", padding: 8 }}>ไม่มีสินค้าตามตัวกรอง</div> : filteredProducts.map(p => {
            const sel = (form.productIds || []).includes(p.id);
            return <span key={p.id} onClick={() => toggleProd(p.id)} style={{ ...chip, color: sel ? "var(--purple)" : "var(--dim)", background: sel ? "rgba(175,82,222,0.14)" : "var(--hover)", border: sel ? "1px solid var(--purple)" : "1px solid transparent" }}>{pN(p)}<span style={{ marginLeft: 4, fontSize: 10, color: "var(--faint)" }}>{p.brand}</span></span>;
          })}
        </div>
        {(form.productIds || []).length > 0 && <div style={{ fontSize: 11, color: "var(--purple)", marginTop: 4 }}>{"เลือก " + form.productIds.length + " รุ่น"}</div>}
      </div>
    </div>
    <MBtns onCancel={onClose} onSave={() => onSave({ ...form, brands: form.brands || [], categoryIds: form.categoryIds || [], productIds: form.productIds || [], threshold: +form.threshold || 0, couponsPerPack: +form.couponsPerPack || 0 })} saveLabel="บันทึก" disabled={!valid} />
  </Modal>;
}

function RewardForm({ sh, data, onClose, onSave }) {
  const { products, pN } = sh;
  const [form, setForm] = useState(data);
  const valid = form.productId && +form.totalQty > 0;
  return <Modal title="รางวัล" onClose={onClose}>
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="สินค้า" req>
        <CustomSelect searchable value={String(form.productId || "")} onChange={v => setForm(f => ({ ...f, productId: +v }))} options={[{ value: "", label: "เลือกสินค้า..." }, ...products.map(p => ({ value: String(p.id), label: pN(p) + " (" + p.brand + ")", searchText: p.code || "" }))]} />
      </Field>
      <Field label="จำนวนทั้งหมด" req><input type="number" min="1" value={form.totalQty} onChange={e => setForm(f => ({ ...f, totalQty: +e.target.value || 1 }))} style={IB} /></Field>
    </div>
    <MBtns onCancel={onClose} onSave={() => onSave(form)} saveLabel="บันทึก" disabled={!valid} />
  </Modal>;
}

function TargetForm({ sh, data, onClose, onSave }) {
  const { contacts, cN } = sh;
  const [form, setForm] = useState(data);
  const customers = contacts.filter(c => c.type === "customer");
  const valid = form.customerId && +form.targetPacks > 0;
  return <Modal title="ตั้ง target ลูกค้า" onClose={onClose}>
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="ลูกค้า" req>
        <CustomSelect searchable value={String(form.customerId || "")} onChange={v => setForm(f => ({ ...f, customerId: +v }))} options={[{ value: "", label: "เลือกลูกค้า..." }, ...customers.map(c => ({ value: String(c.id), label: cN(c) }))]} />
      </Field>
      <Field label="จำนวน pack ขั้นต่ำ" req><input type="number" min="1" value={form.targetPacks} onChange={e => setForm(f => ({ ...f, targetPacks: +e.target.value || 1 }))} style={IB} /></Field>
      <Field label="หมายเหตุ"><input value={form.note || ""} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={IB} /></Field>
    </div>
    <MBtns onCancel={onClose} onSave={() => onSave(form)} saveLabel="บันทึก" disabled={!valid} />
  </Modal>;
}

function AwardForm({ sh, event, customerId, rewardRemaining, onClose, onSave }) {
  const { products, contacts, pN, cN } = sh;
  const [rewardId, setRewardId] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const cust = contacts.find(c => c.id === customerId);
  const availRewards = (event.rewards || []).filter(rw => rewardRemaining(rw) > 0);
  const selected = availRewards.find(r => r.id === +rewardId);
  const remaining = selected ? rewardRemaining(selected) : 0;
  const valid = rewardId && +qty > 0 && +qty <= remaining;
  return <Modal title={"ออกรางวัล — " + (cust ? cN(cust) : "")} onClose={onClose}>
    <div style={{ display: "grid", gap: 12 }}>
      {availRewards.length === 0 && <div style={{ background: "rgba(255,59,48,0.12)", border: "1px solid var(--red)", borderRadius: 8, padding: "10px 12px", color: "var(--red)", fontSize: 12 }}>รางวัลใน pool หมดแล้ว</div>}
      <Field label="เลือกรางวัล" req>
        <CustomSelect value={String(rewardId)} onChange={v => { setRewardId(v); setQty(1); }} options={[{ value: "", label: "เลือก..." }, ...availRewards.map(rw => { const p = products.find(x => x.id === +rw.productId); return { value: String(rw.id), label: (p ? pN(p) : "?") + " (เหลือ " + rewardRemaining(rw) + ")" }; })]} />
      </Field>
      {selected && <Field label="จำนวน" req><input type="number" min="1" max={remaining} value={qty} onChange={e => setQty(+e.target.value || 1)} style={IB} /></Field>}
      <Field label="หมายเหตุ"><input value={note} onChange={e => setNote(e.target.value)} style={IB} placeholder="เช่น เลขคูปอง" /></Field>
      <div style={{ background: "var(--blue-bg)", border: "1px solid var(--blue)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--blue)" }}>เมื่อบันทึก รางวัลจะถูกเพิ่มใน wallet ของลูกค้าทันที (ใช้กับ SO ใบไหนก็ได้)</div>
    </div>
    <MBtns onCancel={onClose} onSave={() => onSave({ id: Date.now() + Math.random(), customerId, rewardId: +rewardId, qty: +qty, awardedAt: todayStr(), note })} saveLabel="ออกรางวัล" disabled={!valid} />
  </Modal>;
}

function CustomerTab({ event, updateEvent, sh, computeProgress, rewardRemaining, setSubModal, setConfirmAct, ed }) {
  const { contacts, products, sales, cN, pN } = sh;
  const [expanded, setExpanded] = useState({});
  const targets = event.customerTargets || [];
  const rows = useMemo(() => targets.map(t => {
    const cust = contacts.find(c => c.id === t.customerId);
    const prog = computeProgress(t.customerId);
    const qualified = prog.bought >= t.targetPacks;
    const custAwards = (event.awards || []).filter(a => a.customerId === t.customerId);
    return { ...t, cust, ...prog, qualified, awards: custAwards };
  }), [targets, contacts, event, sales, products]);
  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--dim)" }}>ตั้ง target ลูกค้าแต่ละราย — ครบแล้วถึงจะ qualify รับรางวัล</div>
      {ed && <button onClick={() => setSubModal({ type: "target", data: { customerId: "", targetPacks: 1, note: "" } })} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--blue)", background: "var(--blue-bg)", color: "var(--blue)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>+ เพิ่มลูกค้า</button>}
    </div>
    {rows.length === 0 ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", background: "var(--bg)", borderRadius: 8 }}>ยังไม่มีลูกค้า</div> :
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
            {["ลูกค้า", "Target / ซื้อ", "คูปอง", "สถานะ", "รางวัลที่ได้", ed && ""].filter(x => x !== false).map((h, i) => <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--dim)" }}>{h}</th>)}
          </tr></thead>
          <tbody>{rows.map(r => {
            const pct = r.targetPacks > 0 ? Math.min(100, Math.round(r.bought / r.targetPacks * 100)) : 0;
            const isOpen = !!expanded[r.customerId];
            const colCount = 5 + (ed ? 1 : 0);
            return <Fragment key={r.customerId}>
              <tr style={{ borderBottom: isOpen ? "none" : "0.5px solid var(--line)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                  <div onClick={() => toggleExpand(r.customerId)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--dim)", transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                    <span>{r.cust ? cN(r.cust) : "(ไม่พบ)"}</span>
                  </div>
                  {r.note && <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 2, paddingLeft: 18 }}>{r.note}</div>}
                </td>
                <td style={{ padding: "8px 10px", minWidth: 130 }}>
                  <div style={{ fontSize: 13 }}>{r.bought + " / " + r.targetPacks + " pack"}</div>
                  <div style={{ height: 4, background: "var(--hover)", borderRadius: 99, overflow: "hidden", marginTop: 4 }}><div style={{ height: "100%", width: pct + "%", background: r.qualified ? "var(--green)" : "var(--orange)", transition: "width 0.3s" }} /></div>
                  <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{r.soCount + " ใบ SO"}</div>
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--purple)" }}>{r.coupons}</td>
                <td style={{ padding: "8px 10px" }}>{r.qualified ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(52,199,89,0.14)", color: "var(--green)", fontWeight: 600 }}>✓ Qualified</span> : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(255,149,0,0.14)", color: "var(--orange)" }}>ยังไม่ถึง</span>}</td>
                <td style={{ padding: "8px 10px" }}>
                  {r.awards.length === 0 ? <span style={{ color: "var(--faint)", fontSize: 11 }}>—</span> :
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {r.awards.map(a => { const rw = (event.rewards || []).find(x => x.id === a.rewardId); const p = rw ? products.find(x => x.id === +rw.productId) : null; return <div key={a.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ padding: "1px 6px", borderRadius: 99, background: "rgba(52,199,89,0.14)", color: "var(--green)", fontWeight: 500 }}>{(p ? pN(p) : "?") + " × " + a.qty}</span>
                        {ed && <button onClick={() => setConfirmAct({ title: "ลบรางวัล", msg: "ลบรางวัลนี้ออกจาก event? (ไม่ลบจาก wallet ลูกค้า)", onOk: () => updateEvent({ awards: (event.awards || []).filter(x => x.id !== a.id) }) })} style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1, fontWeight: 700 }}>×</button>}
                      </div>; })}
                    </div>}
                </td>
                {ed && <td style={{ padding: "8px 10px" }}>
                  {r.qualified && <button onClick={() => setSubModal({ type: "award", data: { customerId: r.customerId } })} style={{ padding: "3px 10px", fontSize: 11, borderRadius: 5, border: "1px solid var(--green)", background: "rgba(52,199,89,0.12)", color: "var(--green)", cursor: "pointer", marginRight: 4 }}>+ ออกรางวัล</button>}
                  <button onClick={() => setConfirmAct({ title: "ลบ target", msg: "ลบลูกค้า " + (r.cust ? cN(r.cust) : "?") + " ออกจาก event?", onOk: () => updateEvent({ customerTargets: targets.filter(x => x.customerId !== r.customerId) }) })} style={{ padding: "3px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--red)", background: "rgba(255,59,48,0.12)", color: "var(--red)", cursor: "pointer" }}>ลบ</button>
                </td>}
              </tr>
              {isOpen && <tr style={{ borderBottom: "0.5px solid var(--line)" }}>
                <td colSpan={colCount} style={{ padding: "8px 14px 10px 30px", background: "var(--bg)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", marginBottom: 6 }}>รายละเอียดต่อ Pack</div>
                  {(r.perPack || []).length === 0 ? <div style={{ fontSize: 11, color: "var(--faint)" }}>ยังไม่มี pack ใน event</div> :
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>
                      {r.perPack.map(pp => {
                        const pkPct = pp.threshold > 0 ? Math.min(100, Math.round(pp.total / pp.threshold * 100)) : 0;
                        const measureStr = pp.pack.measureBy === "qty" ? fmt(pp.total) + " ชิ้น" : "฿" + fmt(pp.total);
                        const thresholdStr = pp.pack.measureBy === "qty" ? fmt(pp.threshold) + " ชิ้น" : "฿" + fmt(pp.threshold);
                        return <div key={pp.pack.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{pp.pack.name}</span>
                            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: pp.earned > 0 ? "rgba(175,82,222,0.14)" : "var(--hover)", color: pp.earned > 0 ? "var(--purple)" : "var(--dim)", fontWeight: 600 }}>{pp.earned + " pack × " + pp.pack.couponsPerPack + " = " + pp.coupons + " คูปอง"}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 4 }}>{measureStr + " / " + thresholdStr}</div>
                          <div style={{ height: 3, background: "var(--hover)", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: pkPct + "%", background: pp.earned > 0 ? "var(--green)" : "var(--orange)", transition: "width 0.3s" }} /></div>
                        </div>;
                      })}
                    </div>
                  }
                </td>
              </tr>}
            </Fragment>;
          })}</tbody>
        </table>
      </div>
    }
  </div>;
}

function RewardsTab({ event, updateEvent, sh, setSubModal, setConfirmAct, ed, computeProgress }) {
  const { products, contacts, setContacts, pN, cN } = sh;
  const customers = contacts.filter(c => c.type === "customer");
  // Build map of customer in targets
  const targetMap = useMemo(() => {
    const m = {};
    (event.customerTargets || []).forEach(t => { m[t.customerId] = t; });
    return m;
  }, [event.customerTargets]);

  const isQualified = (custId) => {
    const t = targetMap[custId];
    if (!t) return false;
    return computeProgress(custId).bought >= t.targetPacks;
  };

  // Customer options sorted: in targets (qualified first) → others
  const custOpts = useMemo(() => {
    const opts = [];
    const inTarget = customers.filter(c => targetMap[c.id]);
    const notInTarget = customers.filter(c => !targetMap[c.id]);
    inTarget.sort((a, b) => {
      const qa = isQualified(a.id) ? 0 : 1;
      const qb = isQualified(b.id) ? 0 : 1;
      return qa - qb;
    });
    inTarget.forEach(c => {
      const q = isQualified(c.id);
      opts.push({ value: String(c.id), label: cN(c) + (q ? " ✓" : " (ยังไม่ qualify)"), searchText: cN(c) });
    });
    if (notInTarget.length) {
      notInTarget.forEach(c => opts.push({ value: String(c.id), label: cN(c) + " (นอก event)", searchText: cN(c) }));
    }
    return opts;
  }, [customers, targetMap, event]);

  // Expand awards into slot entries (each qty=1 = 1 slot)
  const slotEntriesFor = (rw) => {
    const awards = (event.awards || []).filter(a => a.rewardId === rw.id);
    const out = [];
    awards.forEach(a => {
      for (let i = 0; i < (a.qty || 1); i++) {
        out.push({ awardId: a.id, slotIdx: i, customerId: a.customerId, awardedAt: a.awardedAt, note: a.note });
      }
    });
    return out;
  };

  const assignSlot = (rw, customerId) => {
    // create new award entry qty=1
    const newAward = { id: Date.now() + Math.random(), customerId: +customerId, rewardId: rw.id, qty: 1, awardedAt: todayStr(), note: "" };
    updateEvent({ awards: [...(event.awards || []), newAward] });
    // push reward into customer.savedRewards
    const prod = products.find(p => p.id === +rw.productId);
    const cust = contacts.find(c => c.id === +customerId);
    if (prod && cust) {
      const newReward = {
        id: Date.now() + Math.random(),
        promoId: event.id,
        promoName: event.name + " (Event)",
        tier: { id: rw.id, threshold: 0, rewardType: "product", rewardValue: 0, rewardProductId: +rw.productId },
        savedAt: todayStr(),
        savedFromSO: "(จาก event)",
      };
      setContacts(prev => prev.map(c => c.id === cust.id ? { ...c, savedRewards: [...(c.savedRewards || []), newReward] } : c));
    }
  };

  const removeSlot = (rw, slot) => {
    setConfirmAct({
      title: "ลบรางวัลของช่องนี้",
      msg: "ลบรางวัลของช่องนี้? รางวัลใน wallet ลูกค้าจะถูกลบด้วย (ถ้ายังไม่ถูกใช้)",
      onOk: () => {
        const ev = event;
        const award = (ev.awards || []).find(a => a.id === slot.awardId);
        if (!award) return;
        let newAwards;
        if ((award.qty || 1) <= 1) newAwards = (ev.awards || []).filter(a => a.id !== award.id);
        else newAwards = (ev.awards || []).map(a => a.id === award.id ? { ...a, qty: a.qty - 1 } : a);
        updateEvent({ awards: newAwards });
        // remove 1 entry from customer.savedRewards matching event + reward productId
        setContacts(prev => prev.map(c => {
          if (c.id !== award.customerId) return c;
          const wallet = c.savedRewards || [];
          const idx = wallet.findIndex(w => w.promoId === ev.id && +w.tier?.rewardProductId === +rw.productId);
          if (idx < 0) return c;
          const next = [...wallet];
          next.splice(idx, 1);
          return { ...c, savedRewards: next };
        }));
      },
    });
  };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontSize: 12, color: "var(--dim)" }}>เลือกร้านให้แต่ละช่องรางวัล — บันทึกทันทีเข้า wallet ลูกค้า</div>
      {ed && <button onClick={() => setSubModal({ type: "reward", data: { id: Date.now(), productId: "", totalQty: 1 } })} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--purple)", background: "rgba(175,82,222,0.14)", color: "var(--purple)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>+ เพิ่มรางวัล</button>}
    </div>
    {(event.rewards || []).length === 0 ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", background: "var(--bg)", borderRadius: 8 }}>ยังไม่มีรางวัล</div> :
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(event.rewards || []).map(rw => {
          const p = products.find(x => x.id === +rw.productId);
          const slots = slotEntriesFor(rw);
          const total = rw.totalQty || 0;
          const filled = slots.length;
          const remaining = total - filled;
          return <div key={rw.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{p ? pN(p) : "(ไม่พบ)"}{p?.brand && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--dim)", fontWeight: 400 }}>{p.brand}</span>}</div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{"ทั้งหมด " + total + " ชิ้น • มอบไปแล้ว " + filled + " • คงเหลือ "}<span style={{ color: remaining > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{remaining}</span></div>
              </div>
              {ed && <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setSubModal({ type: "reward", data: { ...rw } })} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--hover)", color: "var(--dim)", cursor: "pointer", fontFamily: "inherit" }}>แก้</button>
                <button onClick={() => setConfirmAct({ title: "ลบรางวัล", msg: "ลบรางวัล " + (p ? pN(p) : "?") + " ออกจาก pool?", onOk: () => updateEvent({ rewards: (event.rewards || []).filter(x => x.id !== rw.id) }) })} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--red)", background: "rgba(255,59,48,0.12)", color: "var(--red)", cursor: "pointer", fontFamily: "inherit" }}>ลบ</button>
              </div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 8 }}>
              {/* Filled slots */}
              {slots.map((slot, i) => {
                const cust = contacts.find(c => c.id === slot.customerId);
                return <div key={"f" + i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(52,199,89,0.08)", border: "1px solid var(--green)", borderRadius: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--green)", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cust ? cN(cust) : "(ลูกค้าถูกลบ)"}</div>
                    <div style={{ fontSize: 10, color: "var(--dim)" }}>{toBE(slot.awardedAt)}</div>
                  </div>
                  {ed && <button onClick={() => removeSlot(rw, slot)} title="ลบช่องนี้" style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "2px 6px", fontFamily: "inherit", fontWeight: 700 }}>×</button>}
                </div>;
              })}
              {/* Empty slots */}
              {ed && Array.from({ length: remaining }).map((_, i) => {
                const slotNum = filled + i + 1;
                return <EmptySlot key={"e" + i} slotNum={slotNum} custOpts={custOpts} onAssign={(custId) => assignSlot(rw, custId)} />;
              })}
            </div>
          </div>;
        })}
      </div>
    }
  </div>;
}

function EmptySlot({ slotNum, custOpts, onAssign }) {
  const [val, setVal] = useState("");
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "var(--bg)", border: "1px dashed var(--line2)", borderRadius: 8 }}>
    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--hover)", color: "var(--dim)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{slotNum}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <CustomSelect searchable value={val} onChange={v => setVal(v)} options={[{ value: "", label: "เลือกร้าน..." }, ...custOpts]} />
    </div>
    <button disabled={!val} onClick={() => { if (val) { onAssign(val); setVal(""); } }} style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid var(--green)", background: val ? "var(--green)" : "var(--hover)", color: val ? "#fff" : "var(--faint)", fontSize: 11, fontWeight: 600, cursor: val ? "pointer" : "not-allowed", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ มอบ</button>
  </div>;
}

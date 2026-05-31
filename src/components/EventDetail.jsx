import { useState, useMemo } from "react";
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

  // Compute progress per customer (used in Tab 4)
  const computeProgress = (custId) => {
    const validSOs = (sales || []).filter(s => s.customerId === custId && s.eventId === event.id && ["completed", "pending_delivery"].includes(s.status));
    let bought = 0, coupons = 0;
    validSOs.forEach(so => (so.eventPackPurchases || []).forEach(p => {
      bought += +p.qty || 0;
      const pack = (event.packs || []).find(x => x.id === p.packId);
      coupons += (pack?.couponsPerPack || 0) * (+p.qty || 0);
    }));
    return { bought, coupons, soCount: validSOs.length };
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>Pack คือชุดสินค้าที่ขายให้ลูกค้า แต่ละ pack มีจำนวนคูปองต่างกัน</div>
        {ed && <button onClick={() => setSubModal({ type: "pack", data: { id: Date.now(), packCode: "", name: "", price: 0, couponsPerPack: 1, items: [{ productId: "", qty: 1 }] } })} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--blue)", background: "var(--blue-bg)", color: "var(--blue)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>+ เพิ่ม Pack</button>}
      </div>
      {(event.packs || []).length === 0 ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", background: "var(--bg)", borderRadius: 8 }}>ยังไม่มี Pack</div> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
          {(event.packs || []).map(pk => <div key={pk.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{pk.name || "(ไม่มีชื่อ)"}</div>
                <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "monospace" }}>{pk.packCode}</div>
              </div>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "rgba(175,82,222,0.14)", color: "var(--purple)", fontWeight: 600, whiteSpace: "nowrap" }}>{(pk.couponsPerPack || 0) + " คูปอง"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 6 }}>{"ราคา ฿" + fmt(pk.price || 0)}</div>
            <div style={{ marginBottom: 8, paddingTop: 6, borderTop: "1px dashed var(--line)" }}>
              <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>สินค้าใน pack</div>
              {(pk.items || []).map((it, i) => { const p = products.find(x => x.id === +it.productId); return <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ color: "var(--text)" }}>{p ? pN(p) : "(ไม่พบ)"}</span><span style={{ color: "var(--dim)", fontWeight: 500 }}>× {it.qty}</span></div>; })}
            </div>
            {ed && <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <button onClick={() => setSubModal({ type: "pack", data: { ...pk, items: pk.items.map(x => ({ ...x })) } })} style={{ fontSize: 11, color: "var(--blue)", background: "transparent", border: "none", cursor: "pointer" }}>แก้ไข</button>
              <button onClick={() => setConfirmAct({ title: "ลบ Pack", msg: "ลบ " + (pk.name || pk.packCode) + " ?", onOk: () => updateEvent({ packs: (event.packs || []).filter(x => x.id !== pk.id) }) })} style={{ fontSize: 11, color: "var(--red)", background: "transparent", border: "none", cursor: "pointer" }}>ลบ</button>
            </div>}
          </div>)}
        </div>
      }
    </div>}

    {/* TAB 3: Rewards */}
    {tab === "rewards" && <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>Pool รางวัลที่จับสลาก — จำกัดตามจำนวน</div>
        {ed && <button onClick={() => setSubModal({ type: "reward", data: { id: Date.now(), productId: "", totalQty: 1 } })} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--purple)", background: "rgba(175,82,222,0.14)", color: "var(--purple)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>+ เพิ่มรางวัล</button>}
      </div>
      {(event.rewards || []).length === 0 ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "2rem", background: "var(--bg)", borderRadius: 8 }}>ยังไม่มีรางวัล</div> :
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              {["สินค้า", "ทั้งหมด", "มอบไปแล้ว", "คงเหลือ", ed && ""].filter(x => x !== false).map((h, i) => <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--dim)" }}>{h}</th>)}
            </tr></thead>
            <tbody>{(event.rewards || []).map(rw => {
              const p = products.find(x => x.id === +rw.productId);
              const awarded = (rw.totalQty || 0) - rewardRemaining(rw);
              const rem = rewardRemaining(rw);
              return <tr key={rw.id} style={{ borderBottom: "0.5px solid var(--line)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>{p ? pN(p) : "(ไม่พบ)"}{p?.brand && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--dim)" }}>{p.brand}</span>}</td>
                <td style={{ padding: "8px 10px" }}>{rw.totalQty}</td>
                <td style={{ padding: "8px 10px", color: "var(--orange)" }}>{awarded}</td>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: rem > 0 ? "var(--green)" : "var(--red)" }}>{rem}</td>
                {ed && <td style={{ padding: "8px 10px" }}>
                  <button onClick={() => setSubModal({ type: "reward", data: { ...rw } })} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--hover)", color: "var(--dim)", cursor: "pointer", marginRight: 4 }}>แก้</button>
                  <button onClick={() => setConfirmAct({ title: "ลบรางวัล", msg: "ลบรางวัล " + (p ? pN(p) : "?") + " ออกจาก pool?", onOk: () => updateEvent({ rewards: (event.rewards || []).filter(x => x.id !== rw.id) }) })} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--red)", background: "rgba(255,59,48,0.12)", color: "var(--red)", cursor: "pointer" }}>ลบ</button>
                </td>}
              </tr>;
            })}</tbody>
          </table>
        </div>
      }
    </div>}

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
  const { products, pN } = sh;
  const [form, setForm] = useState(data);
  const addItem = () => setForm(f => ({ ...f, items: [...(f.items || []), { productId: "", qty: 1 }] }));
  const setItem = (idx, k, v) => setForm(f => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, [k]: v } : x) }));
  const delItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const valid = form.name && form.packCode && (form.items || []).every(it => it.productId && +it.qty > 0);

  return <Modal title="Pack" onClose={onClose}>
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <Field label="รหัส" req><input value={form.packCode} onChange={e => setForm(f => ({ ...f, packCode: e.target.value }))} style={IB} placeholder="PK01" /></Field>
        <Field label="ชื่อ" req><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={IB} placeholder="Pack A" /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="ราคาขาย (฿)"><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value || 0 }))} style={IB} /></Field>
        <Field label="คูปองต่อ pack"><input type="number" value={form.couponsPerPack} onChange={e => setForm(f => ({ ...f, couponsPerPack: +e.target.value || 0 }))} style={IB} /></Field>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--dim)" }}>สินค้าใน Pack</div>
          <button onClick={addItem} style={{ fontSize: 12, color: "var(--blue)", background: "transparent", border: "none", cursor: "pointer" }}>+ เพิ่มสินค้า</button>
        </div>
        {(form.items || []).map((it, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, marginBottom: 6, alignItems: "end" }}>
          <CustomSelect searchable value={String(it.productId)} onChange={v => setItem(i, "productId", v)} options={[{ value: "", label: "เลือกสินค้า..." }, ...products.map(p => ({ value: String(p.id), label: pN(p) + " (" + p.brand + ")", searchText: p.code || "" }))]} />
          <input type="number" min="1" value={it.qty} onChange={e => setItem(i, "qty", +e.target.value || 1)} style={IB} />
          {form.items.length > 1 && <button onClick={() => delItem(i)} style={{ fontSize: 11, color: "var(--red)", background: "transparent", border: "none", cursor: "pointer", padding: "0 6px" }}>×</button>}
        </div>)}
      </div>
    </div>
    <MBtns onCancel={onClose} onSave={() => onSave({ ...form, items: form.items.map(it => ({ productId: +it.productId, qty: +it.qty })) })} saveLabel="บันทึก" disabled={!valid} />
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
  const targets = event.customerTargets || [];
  const rows = useMemo(() => targets.map(t => {
    const cust = contacts.find(c => c.id === t.customerId);
    const prog = computeProgress(t.customerId);
    const qualified = prog.bought >= t.targetPacks;
    const custAwards = (event.awards || []).filter(a => a.customerId === t.customerId);
    return { ...t, cust, ...prog, qualified, awards: custAwards };
  }), [targets, contacts, event, sales]);

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
            return <tr key={r.customerId} style={{ borderBottom: "0.5px solid var(--line)" }}>
              <td style={{ padding: "8px 10px", fontWeight: 500 }}>{r.cust ? cN(r.cust) : "(ไม่พบ)"}{r.note && <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>{r.note}</div>}</td>
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
            </tr>;
          })}</tbody>
        </table>
      </div>
    }
  </div>;
}

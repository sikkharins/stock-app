import { useState, useMemo, lazy, Suspense } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";

const EventDetail = lazy(() => import("./EventDetail.jsx"));

const STATUS_OPTS = [
  { value: "draft", label: "ฉบับร่าง", color: "var(--faint)", bg: "var(--hover)" },
  { value: "active", label: "เปิดใช้งาน", color: "var(--green)", bg: "rgba(52,199,89,0.12)" },
  { value: "closed", label: "ปิด event", color: "var(--red)", bg: "rgba(255,59,48,0.12)" },
];
const statusInfo = (s) => STATUS_OPTS.find(x => x.value === s) || STATUS_OPTS[0];

const emptyForm = () => ({
  name: "", description: "",
  startDate: todayStr(), endDate: "",
  status: "draft",
  packs: [], rewards: [], customerTargets: [], awards: [],
});

export default function EventsPage({ sh }) {
  const { events, setEvents, modal, oM, cM, canE, canC, canD } = sh;
  const ed = canE("events"); const cr = canC("events"); const cd = canD("events");

  const [form, setForm] = useState(emptyForm());
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewEventId, setViewEventId] = useState(null);
  const [delId, setDelId] = useState(null);

  const list = useMemo(() => {
    let arr = [...events].sort((a, b) => (b.id || 0) - (a.id || 0));
    if (filterStatus !== "all") arr = arr.filter(e => (e.status || "draft") === filterStatus);
    return arr;
  }, [events, filterStatus]);

  const openNew = () => { setForm(emptyForm()); oM("eventForm"); };
  const askDel = (id) => { setDelId(id); oM("eventDel"); };
  const confirmDel = () => { setEvents(p => p.filter(x => x.id !== delId)); cM(); setDelId(null); };

  const save = () => {
    if (!form.name || !form.startDate) return;
    const d = {
      id: Date.now(),
      name: form.name,
      description: form.description || "",
      startDate: form.startDate,
      endDate: form.endDate || "",
      status: "draft",
      packs: [], rewards: [], customerTargets: [], awards: [],
    };
    setEvents(p => [...p, d]);
    cM();
    setViewEventId(d.id);
  };

  const chip = { display: "inline-block", fontSize: 11, fontWeight: 500, borderRadius: 5, padding: "2px 8px", marginRight: 4, marginBottom: 3 };

  const viewEvent = viewEventId ? events.find(e => e.id === viewEventId) : null;

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>งาน Event / Lucky Draw</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <CustomSelect value={filterStatus} onChange={v => setFilterStatus(v)} options={[{ value: "all", label: "ทั้งหมด" }, ...STATUS_OPTS.map(s => ({ value: s.value, label: s.label }))]} style={{ width: 140 }} />
        {cr && <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>+ สร้าง Event</button>}
      </div>
    </div>

    {list.length === 0
      ? <div style={{ textAlign: "center", color: "var(--faint)", padding: "3rem", background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 10 }}>ยังไม่มี Event</div>
      : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {list.map(e => {
          const st = statusInfo(e.status);
          const packs = (e.packs || []).length;
          const rewards = (e.rewards || []).length;
          const customers = (e.customerTargets || []).length;
          const awards = (e.awards || []).length;
          return <div key={e.id} onClick={() => setViewEventId(e.id)} style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 10, padding: 16, cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={ev => ev.currentTarget.style.borderColor = "var(--blue)"}
            onMouseLeave={ev => ev.currentTarget.style.borderColor = "var(--line)"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 15, flex: 1, paddingRight: 8 }}>{e.name}</div>
              <span style={{ ...chip, color: st.color, background: st.bg, flexShrink: 0 }}>{st.label}</span>
            </div>
            {e.description && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8, lineHeight: 1.4 }}>{e.description}</div>}
            <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10 }}>
              {toBE(e.startDate)} — {e.endDate ? toBE(e.endDate) : "ไม่จำกัด"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{packs}</div>
                <div style={{ fontSize: 10, color: "var(--dim)" }}>Packs</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--purple)" }}>{rewards}</div>
                <div style={{ fontSize: 10, color: "var(--dim)" }}>รางวัล</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--blue)" }}>{customers}</div>
                <div style={{ fontSize: 10, color: "var(--dim)" }}>ลูกค้า</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{awards}</div>
                <div style={{ fontSize: 10, color: "var(--dim)" }}>ที่มอบ</div>
              </div>
            </div>
            {ed && cd && <div onClick={ev => ev.stopPropagation()} style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <button onClick={() => askDel(e.id)} style={{ fontSize: 12, color: "var(--red)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>ลบ Event</button>
            </div>}
          </div>;
        })}
      </div>
    }

    {modal === "eventForm" && <Modal title="สร้าง Event ใหม่" onClose={cM}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="ชื่อ Event" req><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={IB} placeholder="เช่น งานประชุมพฤษภา 2569" /></Field>
        <Field label="คำอธิบาย"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...IB, height: 60, resize: "vertical" }} placeholder="รายละเอียดของ event" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="วันเริ่มต้น" req><ThaiDateInput value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
          <Field label="วันสิ้นสุด"><ThaiDateInput value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
        </div>
        <div style={{ background: "var(--blue-bg)", border: "1px solid var(--blue)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--blue)" }}>
          หลังสร้างแล้ว ระบบจะเปิดหน้า detail ให้กำหนด Packs, รางวัล, ลูกค้า ต่อไป
        </div>
      </div>
      <MBtns onCancel={cM} onSave={save} saveLabel="สร้าง Event" disabled={!form.name || !form.startDate} />
    </Modal>}

    {modal === "eventDel" && <Modal title="ยืนยันลบ Event" onClose={cM}>
      <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 8 }}>ต้องการลบ Event นี้หรือไม่? ข้อมูล packs/รางวัล/ลูกค้า ทั้งหมดจะถูกลบ — รางวัลใน wallet ลูกค้าจะยังคงอยู่</div>
      <MBtns onCancel={cM} onSave={confirmDel} saveLabel="ลบ" />
    </Modal>}

    {viewEvent && <Suspense fallback={null}>
      <EventDetail event={viewEvent} sh={sh} onClose={() => setViewEventId(null)} />
    </Suspense>}
  </div>;
}

import { useState, useMemo } from "react";
import {
  fmt, round2, todayStr, legacyPrefix, splitLegacyNum, soRevenue,
  productQualifiesForPromo, calcAccumulatedTotal, calcCurrentMatchTotal,
  findClaimableTiers, buildSalesOrder,
} from "../utils/helpers.js";
import { DISC_OPTS, CREDIT_OPTS, IB } from "../utils/constants.js";

// Quick SO — โหมดสร้างใบขายเร็วบนมือถือ (stepper 3 ขั้น). แยกจากฟอร์มเต็มใน Sales.jsx
// ขั้น 1 ลูกค้า (เรียงยอดซื้อ, ค้นหาล่าง) → 2 สินค้า (POS, +1/+5, ค้นหาล่าง) → 3 ชำระ+โปรย่อ+ยืนยัน
// บันทึกผ่าน buildSalesOrder เพื่อให้ SO เหมือนฟอร์มเดิมเป๊ะ (สต็อกจอง/เลขเอกสาร/อนุมัติพิเศษ)
export default function QuickSO({ sh, onClose }) {
  const { pN, cN, canC, canApv, sales, setSales, products, contacts, setContacts, addA, cu, promos = [], events = [] } = sh;
  const hasApv = canApv ? canApv("sales") : false;
  const isSU = cu?.role === "SalesManager" ? "" : cu?.salesName || "";

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState("");
  const [qtys, setQtys] = useState({});      // { [productId]: number }
  const [prices, setPrices] = useState({});  // { [productId]: number } ราคา override
  const [payType, setPayType] = useState("cash");
  const [discPct, setDiscPct] = useState(1);
  const [creditDays, setCreditDays] = useState(45);
  const [incVat, setIncVat] = useState(true);
  const [extraDiscPct, setExtraDiscPct] = useState("");
  const [extraDiscAmt, setExtraDiscAmt] = useState("");
  const [note, setNote] = useState("");
  const [legacySuffix, setLegacySuffix] = useState("");
  const [useVatRep, setUseVatRep] = useState(false);
  const [vatRepId, setVatRepId] = useState("");
  const [eventId, setEventId] = useState("");
  const [selectedRewards, setSelectedRewards] = useState([]);
  const [custSearch, setCustSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [showAdv, setShowAdv] = useState(false);
  const [busy, setBusy] = useState(false);

  const date = todayStr();

  // ── ลูกค้า: กรองตามเซลส์ + เรียงตามยอดซื้อรวม (มาก→น้อย) ตำแหน่งคงที่ ──
  const custRevenue = useMemo(() => {
    const m = {};
    for (const so of sales) m[so.customerId] = (m[so.customerId] || 0) + soRevenue(so);
    return m;
  }, [sales]);
  const custs = useMemo(() => contacts
    .filter(c => c.type === "customer" && (!isSU || c.salesPerson === isSU))
    .sort((a, b) => (custRevenue[b.id] || 0) - (custRevenue[a.id] || 0)),
    [contacts, isSU, custRevenue]);

  // ── สินค้า: เรียงตามยอดขายรวม (qty ขายดี→น้อย) ตำแหน่งคงที่ ──
  const prodSold = useMemo(() => {
    const m = {};
    for (const so of sales) for (const it of (so.items || [])) m[it.productId] = (m[it.productId] || 0) + (+it.qty || 0);
    return m;
  }, [sales]);
  const prodList = useMemo(() => products
    .filter(p => !p.discontinued)
    .sort((a, b) => (prodSold[b.id] || 0) - (prodSold[a.id] || 0)),
    [products, prodSold]);

  const getAvail = (pid) => {
    const pr = products.find(x => x.id === +pid);
    if (!pr) return 0;
    const pq = sales.filter(so => (so.status === "pending_delivery" || so.status === "out_for_delivery" || so.status === "pending_special_approval") && !so.dropShip)
      .reduce((s, so) => { const it = (so.items || []).find(i => i.productId === +pid); return s + (it ? it.qty : 0); }, 0);
    return Math.max(0, (pr.stock || 0) - pq);
  };

  const priceOf = (p) => (prices[p.id] != null ? prices[p.id] : (p.price || 0));
  const cartItems = useMemo(() => prodList
    .filter(p => (qtys[p.id] || 0) > 0)
    .map(p => ({ productId: p.id, qty: qtys[p.id], price: priceOf(p), prod: p })),
    [prodList, qtys, prices]);
  const curCust = customerId ? contacts.find(c => c.id === +customerId) : null;
  const curVatReps = (curCust && curCust.vatReps) || [];

  const addQty = (pid, n) => setQtys(q => ({ ...q, [pid]: Math.max(0, (q[pid] || 0) + n) }));
  const setQty = (pid, v) => { const n = Math.max(0, Math.floor(+v || 0)); setQtys(q => ({ ...q, [pid]: n })); };
  const setPrice = (pid, v) => setPrices(p => ({ ...p, [pid]: Math.max(0, +v || 0) }));

  const selectCustomer = (c) => {
    setCustomerId(String(c.id));
    if (c.defaultCreditDays) setCreditDays(c.defaultCreditDays);
    if (c.defaultDiscount != null) setDiscPct(c.defaultDiscount);
    if (c.defaultVat != null) setIncVat(c.defaultVat);
    if (c.defaultPayType) setPayType(c.defaultPayType);
    setUseVatRep(false); setVatRepId("");
    setStep(2);
  };

  // ── โปร/รางวัลแบบย่อ (ขั้น 3) ──
  const promoMatch = useMemo(() => {
    const today = todayStr();
    const active = (promos || []).filter(p => p.active && p.startDate <= today && (!p.endDate || p.endDate >= today));
    const perSoP = active.filter(p => (p.mode || "per_so") === "per_so");
    const accumP = active.filter(p => p.mode === "accumulate");
    const withProd = cartItems.filter(i => i.prod);
    const perSo = perSoP.map(p => {
      const matching = withProd.filter(it => productQualifiesForPromo(it.prod, p));
      if (!matching.length) return null;
      const totalVal = p.measureBy === "qty" ? matching.reduce((s, it) => s + it.qty, 0) : matching.reduce((s, it) => s + it.qty * it.price, 0);
      const tiers = (p.tiers || []).slice().sort((a, b) => a.threshold - b.threshold);
      const eligible = tiers.filter(t => totalVal >= t.threshold);
      const bestTier = eligible.length ? eligible[eligible.length - 1] : null;
      return bestTier ? { promo: p, bestTier, total: totalVal } : null;
    }).filter(Boolean);
    const accum = curCust ? accumP.map(p => {
      const grandTotal = calcAccumulatedTotal(curCust.id, p, sales, products) + calcCurrentMatchTotal(cartItems, p, products);
      const claimableTiers = findClaimableTiers(curCust, p, grandTotal);
      return claimableTiers.length ? { promo: p, grandTotal, claimableTiers } : null;
    }).filter(Boolean) : [];
    const wallet = (curCust && curCust.savedRewards) || [];
    return { perSo, accum, wallet };
  }, [promos, cartItems, curCust, sales, products]);

  const rewardLbl = (t) => {
    if (!t) return "";
    if (t.rewardType === "percent") return "ลด " + t.rewardValue + "%";
    if (t.rewardType === "fixed") return "ลด ฿" + fmt(t.rewardValue);
    if (t.rewardType === "special_price") return "ราคาพิเศษ ฿" + fmt(t.specialPrice || 0) + "/หน่วย";
    if (t.rewardType === "product") { const rp = products.find(x => x.id === +t.rewardProductId); return "แถม " + (rp ? pN(rp) : "สินค้า"); }
    return "";
  };
  const rKey = (r) => r.promoId + "|" + r.tierId + "|" + (r.walletId || "");
  const isPicked = (r) => selectedRewards.some(x => rKey(x) === rKey(r));
  const toggleReward = (r) => setSelectedRewards(prev => prev.some(x => rKey(x) === rKey(r)) ? prev.filter(x => rKey(x) !== rKey(r)) : [...prev, r]);

  // ── ยอดรวม (พรีวิว — สะท้อนเฉพาะ percent/fixed เหมือนฟอร์มเดิม) ──
  let prevRewPct = 0, prevRewAmt = 0;
  selectedRewards.forEach(r => { if (r.tier.rewardType === "percent") prevRewPct += r.tier.rewardValue || 0; else if (r.tier.rewardType === "fixed") prevRewAmt += r.tier.rewardValue || 0; });
  const sub = cartItems.reduce((s, i) => s + i.qty * i.price, 0);
  const disc = payType === "cash" ? round2(sub * discPct / 100) : 0;
  const ep = +(extraDiscPct || 0), ea = +(extraDiscAmt || 0);
  const extraDisc = (ep > 0 ? round2(sub * ep / 100) : 0) + ea;
  const totalRewardDisc = (prevRewPct > 0 ? round2(sub * prevRewPct / 100) : 0) + prevRewAmt;
  const totalDisc = disc + extraDisc + totalRewardDisc;
  const after = sub - totalDisc;
  const vat = incVat ? round2(after * 7 / 107) : 0;

  const overStock = cartItems.some(it => it.qty > getAvail(it.productId));
  const itemCount = cartItems.length;

  const canStep2 = !!customerId;
  const canStep3 = itemCount > 0 && !overStock;
  const goStep = (n) => { if (n === 1 || (n === 2 && canStep2) || (n === 3 && canStep3)) setStep(n); };

  const doSave = () => {
    if (busy || !canStep3) return;
    setBusy(true);
    const legacyNum = legacySuffix ? legacyPrefix(date) + legacySuffix : "";
    const input = {
      customerId: +customerId, date,
      items: cartItems.map(i => ({ productId: i.productId, qty: i.qty, price: i.price })),
      payType, discPct, creditDays, includeVat: incVat,
      extraDiscPct: ep, extraDiscAmt: ea, note, legacyNum,
      useVatRep, vatRepId: vatRepId || "", eventId: eventId || "",
      selectedRewards,
    };
    const { so, customerPatch, logLabel } = buildSalesOrder(input, { sales, products, contacts, hasApv });
    setSales(p => [...p, so]);
    if (customerPatch) setContacts(prev => prev.map(c => c.id === customerPatch.id ? customerPatch : c));
    addA(logLabel, so.soNum);
    onClose();
  };

  // ── styles ──
  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 10000, display: "flex", justifyContent: "center" };
  const sheet = { width: "min(480px,100vw)", height: "100dvh", background: "var(--panel)", display: "flex", flexDirection: "column", overflow: "hidden" };
  const pillRow = { display: "flex", gap: 5, padding: "10px 12px 8px" };
  const pill = (n) => ({ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 999, cursor: "pointer", border: "none", fontFamily: "inherit", background: step === n ? "var(--blue)" : "var(--bg2)", color: step === n ? "#fff" : "var(--dim)" });
  const listArea = { flex: 1, overflowY: "auto", padding: "4px 12px" };
  const bottomBar = { flexShrink: 0, borderTop: "0.5px solid var(--line)", padding: "10px 12px" };
  const rowBtn = (active) => ({ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer", fontFamily: "inherit", border: "1.5px solid " + (active ? "var(--blue)" : "var(--line)"), background: active ? "var(--blue-bg)" : "var(--panel)", color: "var(--text)" });
  const stepBtn = { height: 28, padding: "0 9px", fontSize: 12, borderRadius: 7, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit" };
  const primaryBtn = (on) => ({ height: 42, padding: "0 16px", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: on ? "pointer" : "not-allowed", background: on ? "var(--blue)" : "var(--hover2)", color: on ? "#fff" : "var(--dim)", opacity: on ? 1 : 0.7 });
  const searchWrap = { position: "relative", marginTop: 8 };
  const searchInput = { ...IB, height: 40, paddingLeft: 14 };

  // ── ขั้น 1: ลูกค้า ──
  const panelCustomer = () => {
    const s = custSearch.toLowerCase();
    const list = s ? custs.filter(c => (cN(c) || "").toLowerCase().includes(s)) : custs;
    return <div style={{ flex: "0 0 33.3333%", height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--faint)", padding: "2px 14px 4px" }}>เรียงตามยอดซื้อ · ตำแหน่งคงที่</div>
      <div style={listArea}>
        {list.length === 0 && <div style={{ padding: "16px 4px", color: "var(--dim)", fontSize: 13 }}>ไม่พบลูกค้า</div>}
        {list.map(c => {
          const cond = c.defaultPayType === "credit" ? ("เครดิต " + (c.defaultCreditDays || 45)) : "เงินสด";
          return <button key={c.id} onClick={() => selectCustomer(c)} style={rowBtn(String(c.id) === customerId)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{cN(c)}</div>
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 1 }}>{cond}{c.defaultDiscount ? " · ลด " + c.defaultDiscount + "%" : ""}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>{"฿" + fmt(Math.round(custRevenue[c.id] || 0))}</span>
          </button>;
        })}
      </div>
      <div style={bottomBar}>
        <div style={searchWrap}><input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="ค้นหาลูกค้า" style={searchInput} /></div>
      </div>
    </div>;
  };

  // ── ขั้น 2: สินค้า ──
  const panelProducts = () => {
    const s = prodSearch.toLowerCase();
    const list = s ? prodList.filter(p => (pN(p) || "").toLowerCase().includes(s) || (p.brand || "").toLowerCase().includes(s) || (p.code || "").toLowerCase().includes(s)) : prodList;
    return <div style={{ flex: "0 0 33.3333%", height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--faint)", padding: "2px 14px 4px" }}>ขายดีสุดอยู่บน · พิมพ์จำนวน หรือกด +1 / +5</div>
      <div style={listArea}>
        {list.length === 0 && <div style={{ padding: "16px 4px", color: "var(--dim)", fontSize: 13 }}>ไม่พบสินค้า</div>}
        {list.slice(0, 80).map(p => {
          const q = qtys[p.id] || 0;
          const av = getAvail(p.id);
          const over = q > av;
          return <div key={p.id} style={{ padding: "8px 2px", borderBottom: "0.5px solid var(--line)", background: q > 0 ? "var(--blue-bg)" : "transparent" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: over ? "var(--red)" : "var(--text)" }}>{(p.brand ? p.brand + " " : "") + pN(p)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--dim)" }}>
                <span style={{ color: av <= 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{av <= 0 ? "หมด" : "พร้อม " + av}</span>
                <span> · ฿{fmt(p.price)}</span>{p.code ? <span style={{ color: "var(--faint)" }}> · {p.code}</span> : null}
              </div>
              <input type="number" min="0" value={q || ""} onChange={e => setQty(p.id, e.target.value)} placeholder="0" style={{ ...IB, width: 46, height: 32, padding: "0 4px", textAlign: "center", borderColor: over ? "var(--red)" : (q > 0 ? "var(--blue)" : "var(--line)") }} />
              <button onClick={() => addQty(p.id, 1)} style={{ ...stepBtn, height: 32 }}>+1</button>
              <button onClick={() => addQty(p.id, 5)} style={{ ...stepBtn, height: 32 }}>+5</button>
            </div>
            {over && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{"เกินสต็อก (ขาด " + (q - av) + ")"}</div>}
          </div>;
        })}
      </div>
      <div style={bottomBar}>
        {overStock && <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 500, marginBottom: 8 }}>มีสินค้าเกินสต็อก — แก้จำนวนก่อนไปต่อ</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setStep(1)} style={{ ...stepBtn, height: 42, padding: "0 14px" }}>ย้อนกลับ</button>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--dim)" }}>{itemCount + " รายการ"}</div><div style={{ fontSize: 15, fontWeight: 600 }}>{"฿" + fmt(sub)}</div></div>
          <button onClick={() => goStep(3)} disabled={!canStep3} style={primaryBtn(canStep3)}>ถัดไป</button>
        </div>
        <div style={searchWrap}><input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="ค้นหาสินค้า / รหัส" style={searchInput} /></div>
      </div>
    </div>;
  };

  // ── ขั้น 3: ชำระ & ยืนยัน ──
  const panelConfirm = () => {
    const { perSo, accum, wallet } = promoMatch;
    const hasPromo = perSo.length || accum.length || wallet.length;
    return <div style={{ flex: "0 0 33.3333%", height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 6 }}>{curCust ? cN(curCust) : "-"} · แตะที่ราคาเพื่อแก้</div>
        {/* สรุปตะกร้า + แก้ราคา */}
        <div style={{ border: "0.5px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          {cartItems.map((it, i) => {
            const changed = it.prod && +it.price !== +(it.prod.price || 0);
            return <div key={it.productId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i ? "0.5px solid var(--line)" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(it.prod?.brand ? it.prod.brand + " " : "") + pN(it.prod)}</div>
                <div style={{ fontSize: 11, color: "var(--dim)" }}>{"× " + it.qty}</div>
              </div>
              <input type="number" min="0" value={it.price} onChange={e => setPrice(it.productId, e.target.value)} style={{ ...IB, width: 84, height: 32, padding: "0 8px", textAlign: "right", borderColor: changed ? "var(--purple)" : "var(--line)" }} />
              <span onClick={() => setQty(it.productId, 0)} style={{ cursor: "pointer", color: "var(--red)", fontSize: 18, padding: "0 2px" }}>×</span>
            </div>;
          })}
        </div>

        {/* การชำระเงิน */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[["cash", "เงินสด"], ["credit", "เครดิต"]].map(([k, lb]) =>
            <button key={k} onClick={() => setPayType(k)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontFamily: "inherit", cursor: "pointer", fontSize: 13, fontWeight: 500, border: "1.5px solid " + (payType === k ? "var(--green)" : "var(--line)"), background: payType === k ? "rgba(52,199,89,0.12)" : "var(--panel)", color: payType === k ? "var(--green)" : "var(--text)" }}>{lb}</button>)}
        </div>
        {payType === "cash" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {DISC_OPTS.map(d => <button key={d} onClick={() => setDiscPct(d)} style={{ padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, border: "1.5px solid " + (discPct === d ? "var(--green)" : "var(--line)"), background: discPct === d ? "rgba(52,199,89,0.12)" : "var(--panel)", color: discPct === d ? "var(--green)" : "var(--dim)" }}>{d === 0 ? "ไม่ลด" : d + "%"}</button>)}
        </div>}
        {payType === "credit" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {CREDIT_OPTS.map(d => <button key={d} onClick={() => setCreditDays(d)} style={{ padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, border: "1.5px solid " + (creditDays === d ? "var(--blue)" : "var(--line)"), background: creditDays === d ? "var(--blue-bg)" : "var(--panel)", color: creditDays === d ? "var(--blue)" : "var(--dim)" }}>{d + " วัน"}</button>)}
        </div>}

        {/* โปร/รางวัลแบบย่อ */}
        {hasPromo ? <div style={{ border: "1px solid var(--purple)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--purple)", marginBottom: 8 }}>โปรโมชั่น / รางวัล</div>
          {perSo.map(m => { const r = { promoId: m.promo.id, tierId: m.bestTier.id, tier: m.bestTier, promo: m.promo, source: "claim", matchedTotal: m.total }; const on = isPicked(r);
            return <button key={"ps" + m.promo.id} onClick={() => toggleReward(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 6, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", border: "1px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "rgba(52,199,89,0.12)" : "var(--bg)", color: "var(--text)" }}>
              <span style={{ fontSize: 12 }}><b style={{ color: "var(--blue)" }}>ต่อใบ</b> {m.promo.name} — {rewardLbl(m.bestTier)}</span><span style={{ fontSize: 11, color: on ? "var(--green)" : "var(--dim)", fontWeight: 600, flexShrink: 0 }}>{on ? "✓ ใช้แล้ว" : "ใช้"}</span>
            </button>; })}
          {accum.map(m => m.claimableTiers.map(t => { const r = { promoId: m.promo.id, tierId: t.id, tier: t, promo: m.promo, source: "claim", matchedTotal: m.grandTotal }; const on = isPicked(r);
            return <button key={"ac" + m.promo.id + t.id} onClick={() => toggleReward(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 6, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", border: "1px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "rgba(52,199,89,0.12)" : "var(--bg)", color: "var(--text)" }}>
              <span style={{ fontSize: 12 }}><b style={{ color: "var(--purple)" }}>สะสม</b> {m.promo.name} — {rewardLbl(t)}</span><span style={{ fontSize: 11, color: on ? "var(--green)" : "var(--dim)", fontWeight: 600, flexShrink: 0 }}>{on ? "✓ รับแล้ว" : "รับ"}</span>
            </button>; }))}
          {wallet.map(w => { const r = { promoId: w.promoId, tierId: w.tier.id, tier: w.tier, promo: w.promo, source: "wallet", walletId: w.id, matchedTotal: w.matchedTotal }; const on = isPicked(r);
            return <button key={"w" + w.id} onClick={() => toggleReward(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", marginBottom: 6, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", border: "1px solid " + (on ? "var(--green)" : "var(--line)"), background: on ? "rgba(52,199,89,0.12)" : "var(--bg)", color: "var(--text)" }}>
              <span style={{ fontSize: 12 }}><b style={{ color: "var(--green)" }}>wallet</b> {rewardLbl(w.tier)}</span><span style={{ fontSize: 11, color: on ? "var(--green)" : "var(--dim)", fontWeight: 600, flexShrink: 0 }}>{on ? "✓ ใช้แล้ว" : "ใช้"}</span>
            </button>; })}
        </div> : null}

        {/* VAT */}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px", borderTop: "0.5px solid var(--line)", cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: "var(--text)" }}>VAT 7%</span>
          <input type="checkbox" checked={incVat} onChange={e => setIncVat(e.target.checked)} />
        </label>

        {/* ตัวเลือกเพิ่มเติม */}
        <div onClick={() => setShowAdv(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px", borderTop: "0.5px solid var(--line)", cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: "var(--dim)" }}>ตัวเลือกเพิ่มเติม</span>
          <span style={{ color: "var(--faint)" }}>{showAdv ? "▲" : "▼"}</span>
        </div>
        {showAdv && <div style={{ padding: "4px 2px 8px" }}>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>ส่วนลดพิเศษ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>%</span>
            <input type="number" min="0" max="100" step="0.1" value={extraDiscPct} onChange={e => setExtraDiscPct(e.target.value)} placeholder="0" style={{ ...IB, width: 80 }} />
            <span style={{ fontSize: 12, color: "var(--dim)" }}>฿</span>
            <input type="number" min="0" value={extraDiscAmt} onChange={e => setExtraDiscAmt(e.target.value)} placeholder="0" style={{ ...IB, width: 110 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>เลข SO ระบบเก่า</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 7, padding: "3px 10px" }}>
            <span style={{ fontSize: 13, color: "var(--dim)", fontFamily: "monospace" }}>{splitLegacyNum(legacyPrefix(date) + legacySuffix).prefix}</span>
            <input value={legacySuffix} onChange={e => setLegacySuffix(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="001" maxLength={3} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", color: "var(--text)", fontSize: 13, fontFamily: "monospace", outline: "none", padding: "4px 0" }} />
          </div>
          {curVatReps.length > 0 && <>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={useVatRep} onChange={e => { setUseVatRep(e.target.checked); if (!e.target.checked) setVatRepId(""); }} />
              <span style={{ fontSize: 13 }}>ออก VAT ให้ตัวแทน</span>
            </label>
            {useVatRep && <select value={vatRepId} onChange={e => setVatRepId(e.target.value)} style={{ ...IB, marginBottom: 10 }}>
              <option value="">-- เลือกตัวแทน --</option>
              {curVatReps.map(r => <option key={r.id} value={r.id}>{r.name + " (" + r.idCard + ")"}</option>)}
            </select>}
          </>}
          {(() => { const today = todayStr(); const evs = (events || []).filter(e => e.status === "active" && e.startDate <= today && (!e.endDate || e.endDate >= today)); if (!evs.length) return null;
            return <><div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>Event</div>
              <select value={eventId} onChange={e => setEventId(e.target.value ? +e.target.value : "")} style={{ ...IB, marginBottom: 10 }}>
                <option value="">— ไม่ใช่ event —</option>
                {evs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select></>; })()}
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 4 }}>หมายเหตุ</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ..." style={{ ...IB, height: 52, resize: "vertical" }} />
        </div>}

        {!hasApv && (cartItems.some(it => it.prod && +it.price !== +(it.prod.price || 0)) || ep > 0 || ea > 0) &&
          <div style={{ background: "rgba(175,82,222,0.12)", border: "1px solid var(--purple)", borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 12, color: "var(--purple)" }}>ราคา/ส่วนลดถูกแก้ — SO จะอยู่สถานะ "รออนุมัติพิเศษ"</div>}
      </div>
      <div style={bottomBar}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "var(--dim)" }}>ยอดสุทธิ{incVat ? " (รวม VAT)" : ""}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>{"฿" + fmt(after)}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setStep(2)} style={{ ...stepBtn, height: 44, padding: "0 16px" }}>ย้อนกลับ</button>
          <button onClick={doSave} disabled={busy || !canStep3} style={{ ...primaryBtn(!busy && canStep3), flex: 1, height: 44 }}>{busy ? "กำลังบันทึก..." : "บันทึก SO"}</button>
        </div>
      </div>
    </div>;
  };

  if (!canC("sales")) return null;

  return <div style={overlay} onClick={onClose}>
    <div style={sheet} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 0" }}>
        <button onClick={() => (step > 1 ? setStep(step - 1) : onClose())} style={{ background: "none", border: "none", fontSize: 22, color: "var(--dim)", cursor: "pointer", padding: "2px 6px", fontFamily: "inherit" }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>สร้างใบขายเร็ว</div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "var(--dim)", cursor: "pointer", padding: "2px 6px", fontFamily: "inherit" }}>×</button>
      </div>
      <div style={pillRow}>
        <button onClick={() => goStep(1)} style={pill(1)}>1 ลูกค้า</button>
        <button onClick={() => goStep(2)} style={pill(2)}>2 สินค้า</button>
        <button onClick={() => goStep(3)} style={pill(3)}>3 ชำระ</button>
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ display: "flex", height: "100%", width: "300%", transform: "translateX(-" + ((step - 1) * (100 / 3)) + "%)", transition: "transform 0.28s ease" }}>
          {panelCustomer()}
          {panelProducts()}
          {panelConfirm()}
        </div>
      </div>
    </div>
  </div>;
}

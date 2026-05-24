import { useState, useEffect, useRef, useCallback } from "react";

const QT_STATUS_LABEL = {draft:"ร่าง",sent:"ส่งแล้ว",approved:"อนุมัติ",converted:"แปลง SO",cancelled:"ยกเลิก",expired:"หมดอายุ"};
const PO_STATUS_LABEL = {pending:"รอรับของ",received:"รับแล้ว",cancelled:"ยกเลิก"};

export default function GlobalSearch({ products, sales, quotes, pos, contacts, pN, cN, cu, canA, onNavigate }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);
  const inputRef = useRef(null);

  const closeMobile = useCallback(() => { setMobileOpen(false); setQ(""); setOpen(false); setResults({}); }, []);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        if (mobileOpen) closeMobile();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen, closeMobile]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults({}); return; }
    timer.current = setTimeout(() => {
      const s = q.toLowerCase();
      const r = {};

      const isSup = !!cu.supplierName;
      const isSales = !!cu.salesName && cu.role !== "SalesManager";
      const myCI = isSales
        ? contacts.filter(c => c.type === "customer" && c.salesPerson === cu.salesName).map(c => c.id)
        : null;

      if (canA("products")) {
        const prods = isSup ? products.filter(p => p.distributor === cu.supplierName) : products;
        const found = prods.filter(p =>
          (p.code||"").toLowerCase().includes(s) ||
          (p.name||"").toLowerCase().includes(s) ||
          (p.nameT||"").toLowerCase().includes(s) ||
          (p.brand||"").toLowerCase().includes(s)
        ).slice(0, 5);
        if (found.length) r.products = found;
      }

      if (canA("sales")) {
        const mySales = myCI ? sales.filter(so => myCI.includes(so.customerId)) : sales;
        const found = mySales.filter(so => (so.soNum||"").toLowerCase().includes(s)).slice(0, 5);
        if (found.length) r.sales = found;

        const myQuotes = myCI ? quotes.filter(qt => myCI.includes(qt.customerId)) : quotes;
        const fq = myQuotes.filter(qt => (qt.qtNum||"").toLowerCase().includes(s)).slice(0, 5);
        if (fq.length) r.quotes = fq;
      }

      if (canA("purchase")) {
        let myPOs = pos;
        if (isSup) {
          const sc = contacts.find(c => c.type === "supplier" && (c.name === cu.supplierName || c.nameT === cu.supplierName));
          myPOs = sc ? pos.filter(po => po.supplierId === sc.id) : [];
        }
        const found = myPOs.filter(po => (po.poNum||"").toLowerCase().includes(s)).slice(0, 5);
        if (found.length) r.pos = found;
      }

      if (canA("customers")) {
        const custs = contacts.filter(c => c.type === "customer" && (!myCI || myCI.includes(c.id)));
        const found = custs.filter(c =>
          (c.name||"").toLowerCase().includes(s) ||
          (c.nameT||"").toLowerCase().includes(s) ||
          (c.phone||"").toLowerCase().includes(s) ||
          (c.email||"").toLowerCase().includes(s)
        ).slice(0, 5);
        if (found.length) r.customers = found;
      }

      if (canA("suppliers")) {
        const sups = isSup
          ? contacts.filter(c => c.type === "supplier" && (c.name === cu.supplierName || c.nameT === cu.supplierName))
          : contacts.filter(c => c.type === "supplier");
        const found = sups.filter(c =>
          (c.name||"").toLowerCase().includes(s) ||
          (c.nameT||"").toLowerCase().includes(s)
        ).slice(0, 5);
        if (found.length) r.suppliers = found;
      }

      setResults(r);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, products, sales, quotes, pos, contacts, cu, canA]);

  const pick = (tab, search) => {
    onNavigate(tab, search);
    setQ("");
    setOpen(false);
    setResults({});
  };

  const groups = [
    {
      key: "products",
      label: "สินค้า",
      items: results.products || [],
      render: p => `[${p.code||"-"}] ${p.brand} — ${pN(p)} (สต็อก: ${p.stock})`,
      onPick: p => pick("products", pN(p)),
    },
    {
      key: "sales",
      label: "ใบขาย",
      items: results.sales || [],
      render: so => {
        const c = contacts.find(x => x.id === so.customerId);
        const tot = (so.items||[]).reduce((s,i) => s + i.qty*i.price, 0) - (so.discountAmt||0);
        return `${so.soNum} — ${c ? cN(c) : "-"} — ฿${tot.toLocaleString("th-TH",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
      },
      onPick: so => pick("sales", so.soNum),
    },
    {
      key: "quotes",
      label: "ใบเสนอราคา",
      items: results.quotes || [],
      render: qt => {
        const c = contacts.find(x => x.id === qt.customerId);
        return `${qt.qtNum} — ${c ? cN(c) : "-"} — ${QT_STATUS_LABEL[qt.status]||qt.status}`;
      },
      onPick: qt => pick("sales", qt.qtNum),
    },
    {
      key: "pos",
      label: "ใบสั่งซื้อ",
      items: results.pos || [],
      render: po => {
        const s = contacts.find(x => x.id === po.supplierId);
        return `${po.poNum} — ${s ? cN(s) : "-"} — ${PO_STATUS_LABEL[po.status]||po.status}`;
      },
      onPick: po => pick("purchase", po.poNum),
    },
    {
      key: "customers",
      label: "ลูกค้า",
      items: results.customers || [],
      render: c => `${cN(c)}${c.phone ? " — "+c.phone : ""}`,
      onPick: c => pick("customers", cN(c)),
    },
    {
      key: "suppliers",
      label: "ซัพพลายเออร์",
      items: results.suppliers || [],
      render: c => `${cN(c)}${c.phone ? " — "+c.phone : ""}`,
      onPick: c => pick("suppliers", cN(c)),
    },
  ].filter(g => g.items.length > 0);

  return (
    <>
      {mobileOpen && <div className="search-backdrop" onClick={closeMobile}/>}
      <div ref={ref} className={`global-search${mobileOpen ? " mobile-open" : ""}`} style={{position:"relative",flexShrink:0}}>
        <div className="search-bar-container" style={{display:"flex",alignItems:"center",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:20,padding:"5px 12px",width:280,gap:6}}>
          <span onClick={() => { setMobileOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }} style={{color:"var(--dim)",fontSize:14,flexShrink:0,cursor:"pointer"}}>&#x2315;</span>
          <input
            ref={inputRef}
            className="search-input"
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => { if (e.key === "Escape") { if (mobileOpen) closeMobile(); else { setOpen(false); setQ(""); } } }}
            placeholder="ค้นหาสินค้า, ใบขาย, ลูกค้า..."
            style={{border:"none",background:"transparent",outline:"none",fontSize:13,width:"100%",color:"var(--text)"}}
          />
          {q && <span className="search-clear" onClick={() => { setQ(""); setResults({}); setOpen(false); }} style={{cursor:"pointer",color:"var(--faint)",fontSize:18,flexShrink:0,lineHeight:1,marginTop:-1}}>×</span>}
          {mobileOpen && <span onClick={closeMobile} style={{cursor:"pointer",color:"var(--dim)",fontSize:20,flexShrink:0,lineHeight:1,padding:"0 2px"}}>×</span>}
        </div>
        {open && q.trim() && (
          <div className="search-dropdown" style={{position:"absolute",top:"calc(100% + 6px)",left:0,width:380,maxHeight:440,overflowY:"auto",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",zIndex:1000}}>
            {groups.length === 0
              ? <div style={{padding:"1.5rem",textAlign:"center",color:"var(--dim)",fontSize:13}}>ไม่พบผลลัพธ์</div>
              : groups.map(g => (
                <div key={g.key}>
                  <div style={{padding:"7px 14px 4px",fontSize:11,fontWeight:700,color:"var(--faint)",background:"var(--bg)",letterSpacing:"0.3px",borderBottom:"0.5px solid var(--line)",borderTop:"0.5px solid var(--line)"}}>{g.label}</div>
                  {g.items.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => { g.onPick(item); if (mobileOpen) closeMobile(); }}
                      style={{padding:"9px 14px",fontSize:13,cursor:"pointer",borderBottom:"0.5px solid var(--line)",color:"var(--text)"}}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--blue-bg)"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                    >{g.render(item)}</div>
                  ))}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </>
  );
}

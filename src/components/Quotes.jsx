import { useState, useMemo, useEffect } from "react";
import { IB, DISC_OPTS, CREDIT_OPTS } from "../utils/constants.js";
import { fmt, toBE, todayStr, AddDue, round2 } from "../utils/helpers.js";
import { printDoc } from "./PrintDocument.jsx";
import { Modal, MBtns } from "./ui/Modal.jsx";
import SB from "./ui/SearchBar.jsx";
import Btn from "./ui/Btn.jsx";
import Field from "./ui/Field.jsx";
import ProductPicker from "./ui/ProductPicker.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";

const QT_STATUS = {
  draft:     {label:"ร่าง",       bg:"var(--hover)",color:"var(--dim)"},
  sent:      {label:"ส่งแล้ว",    bg:"var(--blue-bg)",color:"var(--blue)"},
  approved:  {label:"อนุมัติ",    bg:"rgba(52,199,89,0.12)",color:"var(--green)"},
  converted: {label:"แปลง SO",   bg:"rgba(175,82,222,0.12)",color:"var(--purple)"},
  cancelled: {label:"ยกเลิก",    bg:"rgba(255,59,48,0.12)",color:"var(--red)"},
  expired:   {label:"หมดอายุ",   bg:"rgba(255,149,0,0.14)",color:"var(--orange)"},
};

function QTBadge({status}){
  const s = QT_STATUS[status] || {label:status,bg:"var(--hover)",color:"var(--dim)"};
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:s.bg,color:s.color,fontWeight:500}}>{s.label}</span>;
}

const isExpired = qt =>
  !["converted","cancelled"].includes(qt.status) &&
  !!qt.validUntil && qt.validUntil < todayStr();

const displayStatus = qt => isExpired(qt) ? "expired" : qt.status;

const qtTot = qt => (qt.items||[]).reduce((s,i) => s + i.qty*i.price, 0);

const emptyForm = () => ({
  customerId:"", date:todayStr(), validUntil:AddDue(todayStr(),30),
  items:[{productId:"",qty:1,price:0}],
  includeVat:true, payType:"cash", discPct:0, creditDays:30, note:""
});

export default function QuotesPage({sh}){
  const{pN,cN,canC,canE,quotes,setQuotes,sales,setSales,products,contacts,search,setSearch,modal,oM,cM,cu,addA}=sh;
  const ed = canC("sales");
  const isSU = cu.role==="SalesManager"?"":cu.salesName||"";
  const custs = contacts.filter(c => c.type==="customer" && (!isSU || c.salesPerson===isSU));
  const myCI = isSU ? custs.map(c=>c.id) : null;

  const [fSt, setFSt] = useState("all");
  const [form, setForm] = useState(()=>emptyForm());
  const [incVat, setIncVat] = useState(true);
  const [payType, setPayType] = useState("cash");
  const [discPct, setDiscPct] = useState(0);
  const [creditDays, setCreditDays] = useState(45);
  const [viewQT, setViewQT] = useState(null);
  const [confirmConv, setConfirmConv] = useState(null);
  const [confirmCan, setConfirmCan] = useState(null);
  const [editQT, setEditQT] = useState(null);
  const [formErrors, setFormErrors] = useState([]);

  useEffect(()=>{if(sh.quickCreate==="addQT"&&ed){setFormErrors([]);setForm(emptyForm());setIncVat(true);setPayType("cash");setDiscPct(0);setCreditDays(30);setEditQT(null);oM("addQT");sh.clearQuickCreate();}},[sh.quickCreate]);

  const filtered = useMemo(()=>[...quotes].reverse().filter(qt => {
    if (myCI && !myCI.includes(qt.customerId)) return false;
    const ds = displayStatus(qt);
    if (fSt !== "all" && ds !== fSt) return false;
    if (search) {
      const s = search.toLowerCase();
      const cust = contacts.find(c=>c.id===qt.customerId);
      if (!qt.qtNum.toLowerCase().includes(s) && !(cust?(cN(cust)||""):"").toLowerCase().includes(s)) return false;
    }
    return true;
  }),[quotes,myCI,fSt,search,contacts,cN]);

  const addItem = () => setForm(f=>({...f,items:[...f.items,{productId:"",qty:1,price:0}]}));
  const rmItem = idx => setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const setIt = (idx,k,v) => setForm(f=>{
    const its=[...f.items]; its[idx]={...its[idx],[k]:v};
    if(k==="productId"){const p=products.find(x=>x.id===+v);if(p)its[idx].price=p.price;}
    return{...f,items:its};
  });

  const openCreate = () => {
    const ef = emptyForm();
    setFormErrors([]);setForm(ef); setIncVat(true); setPayType("cash"); setDiscPct(0); setCreditDays(30);
    setEditQT(null); oM("addQT");
  };

  const openEdit = qt => {setFormErrors([]);
    setForm({
      customerId:String(qt.customerId), date:qt.date, validUntil:qt.validUntil||"",
      items:qt.items.map(i=>({productId:String(i.productId),qty:i.qty,price:i.price})),
      includeVat:qt.includeVat!==false, payType:qt.payType||"cash",
      discPct:qt.discPct||0, creditDays:qt.creditDays||30, note:qt.note||""
    });
    setIncVat(qt.includeVat!==false);
    setPayType(qt.payType||"cash");
    setDiscPct(qt.discPct||0);
    setCreditDays(qt.creditDays||30);
    setEditQT(qt); oM("addQT");
  };

  const saveQT = () => {
    const errs=[];if(!form.customerId)errs.push("ยังไม่เลือกลูกค้า");form.items.forEach((it,idx)=>{if(!it.productId)errs.push("สินค้ารายการที่ "+(idx+1)+" ยังไม่เลือก");});if(errs.length){setFormErrors(errs);return;}setFormErrors([]);
    const items = form.items.map(i=>({productId:+i.productId,qty:+i.qty,price:+i.price}));
    const base = {
      customerId:+form.customerId, date:form.date, validUntil:form.validUntil,
      items, includeVat:incVat, payType,
      discPct:payType==="cash"?discPct:0,
      creditDays:payType==="credit"?creditDays:0,
      note:form.note||""
    };
    if(editQT){
      setQuotes(p=>p.map(q=>q.id===editQT.id?{...q,...base}:q));
      addA("แก้ไข QT", editQT.qtNum);
      setEditQT(null);
    } else {
      const yr=new Date().getFullYear();const mxQ=quotes.reduce((m,q)=>{const mt=q.qtNum.match(/^QT-(\d+)-(\d+)$/);return mt&&+mt[1]===yr?Math.max(m,+mt[2]):m;},0);const qn="QT-"+yr+"-"+String(mxQ+1).padStart(3,"0");
      setQuotes(p=>[...p,{id:Date.now(),qtNum:qn,status:"draft",convertedTo:"",...base}]);
      addA("สร้าง QT", qn);
    }
    cM();
  };

  const sendQT    = id => { setQuotes(p=>p.map(q=>q.id===id?{...q,status:"sent"}:q));     addA("ส่ง QT",    quotes.find(q=>q.id===id)?.qtNum||""); };
  const approveQT = id => { setQuotes(p=>p.map(q=>q.id===id?{...q,status:"approved"}:q)); addA("อนุมัติ QT",quotes.find(q=>q.id===id)?.qtNum||""); };
  const cancelQT  = qt => {
    setQuotes(p=>p.map(q=>q.id===qt.id?{...q,status:"cancelled"}:q));
    addA("ยกเลิก QT", qt.qtNum); setConfirmCan(null);
  };
  const deleteQT  = id => { setQuotes(p=>p.filter(q=>q.id!==id)); };

  const convertToSO = qt => {
    const yr2=new Date().getFullYear();const mxS=sales.reduce((m,s)=>{const mt=s.soNum.match(/^SO-(\d+)-(\d+)$/);return mt&&+mt[1]===yr2?Math.max(m,+mt[2]):m;},0);const sn="SO-"+yr2+"-"+String(mxS+1).padStart(3,"0");
    const sub = qt.items.reduce((s,i)=>s+i.qty*i.price,0);
    const disc = qt.payType==="cash" ? round2(sub*(qt.discPct||0)/100) : 0;
    const after = sub - disc;
    const vatAmt = qt.includeVat ? round2(after*7/107) : 0;
    setSales(p=>[...p,{
      id:Date.now(), soNum:sn, customerId:qt.customerId, date:todayStr(),
      status:"pending_delivery", items:qt.items,
      includeVat:qt.includeVat, vatAmount:vatAmt, payType:qt.payType,
      discountAmt:disc, discPct:qt.payType==="cash"?qt.discPct:0,
      creditDays:qt.payType==="credit"?qt.creditDays:0,
      fromQuote:qt.qtNum, useVatRep:false,
      vatRepName:"", vatRepAddress:"", vatRepIdCard:""
    }]);
    setQuotes(p=>p.map(q=>q.id===qt.id?{...q,status:"converted",convertedTo:sn}:q));
    addA("แปลง QT เป็น SO", qt.qtNum);
    setConfirmConv(null); cM();
  };

  const renderItems = () => form.items.map((item,idx)=>{
    const sel = item.productId ? products.find(x=>x.id===+item.productId) : null;
    return <div key={idx} style={{marginBottom:10,padding:"10px 12px",background:"var(--bg)",borderRadius:8,border:"1.5px solid var(--line)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"start",marginBottom:8}}>
        <ProductPicker value={item.productId} onChange={v=>setIt(idx,"productId",v)} products={products} pName={pN} avail={sel?sel.stock:0} unit={sel?sel.unit:""}/>
        <span onClick={()=>rmItem(idx)} style={{cursor:"pointer",color:"var(--red)",fontSize:20,paddingTop:6}}>{"×"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Field label="จำนวน"><input type="number" min="1" value={item.qty} onChange={e=>setIt(idx,"qty",e.target.value)} style={IB}/></Field>
        <Field label="ราคา (฿)"><input type="number" min="0" value={item.price} onChange={e=>setIt(idx,"price",e.target.value)} style={IB}/></Field>
      </div>
    </div>;
  });

  const renderForm = () => {
    const sub = form.items.reduce((s,i)=>(+i.qty||0)*(+i.price||0)+s,0);
    const disc = payType==="cash" ? round2(sub*discPct/100) : 0;
    const after = sub - disc;
    const vatAmt = incVat ? round2(after*7/107) : 0;
    return <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Field label="ลูกค้า"><CustomSelect searchable value={form.customerId} onChange={v=>{setForm(f=>({...f,customerId:v}));const c=contacts.find(x=>x.id===+v);if(c){if(c.defaultCreditDays)setCreditDays(c.defaultCreditDays);if(c.defaultDiscount!=null)setDiscPct(c.defaultDiscount);if(c.defaultVat!=null)setIncVat(c.defaultVat);if(c.defaultPayType)setPayType(c.defaultPayType);}}} options={[{value:"",label:"เลือก..."},...custs.map(c=>({value:String(c.id),label:cN(c)}))]}/></Field>
        <Field label="วันที่"><ThaiDateInput value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="วันหมดอายุ"><ThaiDateInput value={form.validUntil} onChange={e=>setForm(f=>({...f,validUntil:e.target.value}))}/></Field>
      </div>
      {renderItems()}
      <button onClick={addItem} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--line)",cursor:"pointer",background:"transparent",marginBottom:12}}>{"+ เพิ่มสินค้า"}</button>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"12px 14px",marginBottom:12,fontSize:13}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          {[["cash","เงินสด"],["credit","เครดิต"]].map(([v,label])=>
            <label key={v} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(payType===v?"var(--green)":"var(--line)"),cursor:"pointer",background:payType===v?"rgba(52,199,89,0.12)":"var(--panel)"}}>
              <input type="radio" name="qpt" checked={payType===v} onChange={()=>setPayType(v)}/><span style={{fontWeight:500,color:payType===v?"var(--green)":"var(--text)"}}>{label}</span>
            </label>
          )}
        </div>
        {payType==="cash"&&<div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,marginBottom:6}}>ส่วนลด</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {DISC_OPTS.map(d=><button key={d} onClick={()=>setDiscPct(d)} style={{padding:"5px 14px",borderRadius:99,border:"1.5px solid "+(discPct===d?"var(--green)":"var(--line)"),background:discPct===d?"rgba(52,199,89,0.12)":"var(--panel)",color:discPct===d?"var(--green)":"var(--dim)",cursor:"pointer",fontSize:12}}>{d===0?"ไม่ลด":d+"%"}</button>)}
          </div>
        </div>}
        {payType==="credit"&&<div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,marginBottom:6}}>วันเครดิต</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {CREDIT_OPTS.map(d=><button key={d} onClick={()=>setCreditDays(d)} style={{padding:"5px 14px",borderRadius:99,border:"1.5px solid "+(creditDays===d?"var(--blue)":"var(--line)"),background:creditDays===d?"var(--blue-bg)":"var(--panel)",color:creditDays===d?"var(--blue)":"var(--dim)",cursor:"pointer",fontSize:12}}>{d+" วัน"}</button>)}
          </div>
        </div>}
        <div style={{borderTop:"1px solid var(--line)",paddingTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",color:"var(--dim)",marginBottom:4}}><span>ยอดรวม</span><span>{"฿"+fmt(sub)}</span></div>
          {payType==="cash"&&disc>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลด "+discPct+"%"}</span><span>{"-฿"+fmt(disc)}</span></div>}
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,marginBottom:6}}><input type="checkbox" checked={incVat} onChange={e=>setIncVat(e.target.checked)}/>VAT 7%</label>
          {incVat&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--orange)",fontSize:12,marginBottom:4}}><span>VAT</span><span>{"฿"+fmt(vatAmt)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,borderTop:"1px solid var(--line)",paddingTop:8}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(after)}</span></div>
        </div>
      </div>
      <Field label="หมายเหตุ"><textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{...IB,height:56,resize:"vertical"}} placeholder="หมายเหตุ / เงื่อนไข..."/></Field>
      {formErrors.length>0&&<div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"10px 14px",marginTop:10}}><div style={{fontSize:12,fontWeight:600,color:"var(--red)",marginBottom:4}}>กรุณากรอกข้อมูลให้ครบ:</div>{formErrors.map((e,i)=><div key={i} style={{fontSize:12,color:"var(--red)",marginBottom:2}}>{"• "+e}</div>)}</div>}
      <MBtns onCancel={()=>{setEditQT(null);cM();}} onSave={saveQT} saveLabel={editQT?"บันทึก":"สร้างใบเสนอราคา"}/>
    </div>;
  };

  const STATUS_FILTERS = ["all","draft","sent","approved","converted","cancelled","expired"];
  const STATUS_FILTER_LABEL = {all:"ทั้งหมด",draft:"ร่าง",sent:"ส่งแล้ว",approved:"อนุมัติ",converted:"แปลง SO",cancelled:"ยกเลิก",expired:"หมดอายุ"};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <SB value={search} onChange={setSearch} placeholder="ค้นหา QT..."/>
      {ed&&<Btn onClick={openCreate}>{"+ สร้างใบเสนอราคา"}</Btn>}
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {STATUS_FILTERS.map(s=>{
        const cnt = s==="all" ? quotes.filter(q=>!myCI||myCI.includes(q.customerId)).length : quotes.filter(q=>(!myCI||myCI.includes(q.customerId))&&displayStatus(q)===s).length;
        const st = QT_STATUS[s]||{label:"ทั้งหมด",bg:"var(--bg)",color:"var(--dim)"};
        const active = fSt===s;
        return <button key={s} onClick={()=>setFSt(s)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1.5px solid "+(active?(st.color||"var(--text)"):"var(--line)"),background:active?(st.bg||"var(--hover)"):"transparent",color:active?(st.color||"var(--text)"):"var(--dim)",cursor:"pointer",fontWeight:active?600:400}}>
          {s==="all"?"ทั้งหมด":st.label} <span style={{opacity:.7}}>({cnt})</span>
        </button>;
      })}
    </div>

    {filtered.length===0&&<div style={{textAlign:"center",color:"var(--dim)",padding:"2rem"}}>ยังไม่มีใบเสนอราคา</div>}
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
        <thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>
          {["QT No.","ลูกค้า","วันที่","หมดอายุ","ยอด","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px 6px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(qt=>{
          const cust = contacts.find(c=>c.id===qt.customerId);
          const ds = displayStatus(qt);
          const exp = ds==="expired";
          return <tr key={qt.id} style={{borderBottom:"0.5px solid var(--line)",background:exp?"rgba(255,149,0,0.08)":""}}>
            <td style={{padding:"8px 6px",fontWeight:500,color:"var(--blue)"}}>{qt.qtNum}</td>
            <td style={{padding:"8px 6px"}}>{cust?cN(cust):"-"}</td>
            <td style={{padding:"8px 6px",color:"var(--dim)"}}>{toBE(qt.date)}</td>
            <td style={{padding:"8px 6px",color:exp?"var(--orange)":"var(--dim)"}}>{toBE(qt.validUntil)}</td>
            <td style={{padding:"8px 6px"}}>{"฿"+fmt(qtTot(qt))}</td>
            <td style={{padding:"8px 6px"}}><QTBadge status={ds}/></td>
            <td style={{padding:"8px 6px",whiteSpace:"nowrap"}}>
              <span onClick={()=>{setViewQT(qt);oM("viewQT");}} style={{cursor:"pointer",color:"var(--blue)",fontSize:12,marginRight:6}}>ดู</span>
              {ed&&qt.status==="draft"&&<><span onClick={()=>openEdit(qt)} style={{cursor:"pointer",color:"var(--orange)",fontSize:12,marginRight:6}}>แก้ไข</span><span onClick={()=>sendQT(qt.id)} style={{cursor:"pointer",color:"var(--blue)",fontSize:12,marginRight:6}}>ส่ง</span></>}
              {ed&&qt.status==="sent"&&!exp&&<span onClick={()=>approveQT(qt.id)} style={{cursor:"pointer",color:"var(--green)",fontSize:12,marginRight:6}}>อนุมัติ</span>}
              {ed&&qt.status==="approved"&&!exp&&<span onClick={()=>{setConfirmConv(qt);oM("confirmConv");}} style={{cursor:"pointer",color:"var(--purple)",fontSize:12,fontWeight:600,marginRight:6}}>{"→ SO"}</span>}
              {ed&&!["converted","cancelled"].includes(qt.status)&&<span onClick={()=>setConfirmCan(qt)} style={{cursor:"pointer",color:"var(--red)",fontSize:12,marginRight:6}}>ยกเลิก</span>}
              {ed&&["draft","cancelled"].includes(qt.status)&&<span onClick={()=>deleteQT(qt.id)} style={{cursor:"pointer",color:"var(--red)",fontSize:12}}>ลบ</span>}
            </td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {modal==="addQT"&&ed&&<Modal title={editQT?"แก้ไข — "+editQT.qtNum:"สร้างใบเสนอราคาใหม่"} onClose={()=>{setEditQT(null);cM();}}>{renderForm()}</Modal>}

    {modal==="viewQT"&&viewQT&&<Modal title={viewQT.qtNum} onClose={cM}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{(()=>{const c=contacts.find(x=>x.id===viewQT.customerId);return c?cN(c):"-";})()}</div>
          <div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>วันที่: {toBE(viewQT.date)} | หมดอายุ: {toBE(viewQT.validUntil)}</div>
          {viewQT.convertedTo&&<div style={{fontSize:12,color:"var(--purple)",marginTop:2}}>{"แปลงเป็น: "+viewQT.convertedTo}</div>}
        </div>
        <QTBadge status={displayStatus(viewQT)}/>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}>
        <thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["สินค้า","Qty","ราคา","รวม"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
        <tbody>{viewQT.items.map((it,i)=>{const pr=products.find(x=>x.id===it.productId);return <tr key={i} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"6px 8px"}}>{pr?pN(pr):"-"}</td><td style={{padding:"6px 8px"}}>{it.qty}</td><td style={{padding:"6px 8px"}}>{"฿"+fmt(it.price)}</td><td style={{padding:"6px 8px",fontWeight:500}}>{"฿"+fmt(it.qty*it.price)}</td></tr>;})}
        </tbody>
      </table>
      {(()=>{
        const sub=qtTot(viewQT);
        const disc=viewQT.payType==="cash"?round2(sub*(viewQT.discPct||0)/100):0;
        const after=sub-disc;
        const vatAmt=viewQT.includeVat?round2(after*7/107):0;
        return <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",fontSize:13}}>
          {viewQT.payType==="cash"&&disc>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลด "+(viewQT.discPct||0)+"%"}</span><span>{"-฿"+fmt(disc)}</span></div>}
          {viewQT.includeVat&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--orange)",marginBottom:4}}><span>VAT 7%</span><span>{"฿"+fmt(vatAmt)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(after)}</span></div>
          {viewQT.payType==="credit"&&<div style={{fontSize:12,color:"var(--dim)",marginTop:4}}>{"เครดิต "+(viewQT.creditDays||0)+" วัน"}</div>}
          {viewQT.note&&<div style={{fontSize:12,color:"var(--dim)",marginTop:8,padding:"6px 8px",background:"var(--panel)",borderRadius:6,border:"0.5px solid var(--line)"}}>{viewQT.note}</div>}
        </div>;
      })()}
      <div style={{marginTop:14,marginBottom:4}}>
        <button onClick={()=>printDoc("qt",viewQT,products,contacts)} style={{padding:"8px 18px",background:"var(--text)",color:"var(--bg)",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"พิมพ์ / PDF"}</button>
      </div>
      <MBtns onCancel={cM}/>
    </Modal>}

    {modal==="confirmConv"&&confirmConv&&<Modal title={"→ แปลงเป็น SO — "+confirmConv.qtNum} onClose={()=>{setConfirmConv(null);cM();}}>
      <div style={{background:"rgba(175,82,222,0.12)",border:"1px solid var(--purple)",borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:13}}>
        <div style={{fontWeight:600,color:"var(--purple)",marginBottom:4}}>{confirmConv.qtNum+" → ใบขายใหม่"}</div>
        <div style={{color:"var(--dim)"}}>ระบบจะสร้างใบขาย (SO) จากใบเสนอราคานี้ และเปลี่ยนสถานะ QT เป็น "แปลง SO" ทันที</div>
      </div>
      <MBtns onCancel={()=>{setConfirmConv(null);cM();}} onSave={()=>convertToSO(confirmConv)} saveLabel="ยืนยันแปลง SO"/>
    </Modal>}

    {confirmCan&&<Modal title={"ยกเลิก — "+confirmCan.qtNum} onClose={()=>setConfirmCan(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"ยืนยันยกเลิกใบเสนอราคา "+confirmCan.qtNum+"?"}</div>
      <MBtns onCancel={()=>setConfirmCan(null)} onSave={()=>cancelQT(confirmCan)} saveLabel="ยกเลิก QT"/>
    </Modal>}
  </div>;
}

import { useState, useMemo, useEffect } from "react";
import { IB, DISC_OPTS, CREDIT_OPTS } from "../utils/constants.js";
import { fmt, toBE, todayStr, mkLog } from "../utils/helpers.js";
import { printDoc } from "./PrintDocument.jsx";
import CustomerProfile from "./CustomerProfile.jsx";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Badge from "./ui/Badge.jsx";
import StatCard from "./ui/StatCard.jsx";
import SB from "./ui/SearchBar.jsx";
import Btn from "./ui/Btn.jsx";
import Field from "./ui/Field.jsx";
import ProductPicker from "./ui/ProductPicker.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import QuotesPage from "./Quotes.jsx";

function SOList({sh}){
  const{pN,cN,canC,canApv,sales,setSales,pos,setPOs,products,setProducts,contacts,search,setSearch,modal,oM,cM,addLog,cu,addA,quotes,payments}=sh;
  const ed=canC("sales");const isSU=cu.role==="SalesManager"?"":cu.salesName||"";
  const custs=contacts.filter(c=>c.type==="customer"&&(!isSU||c.salesPerson===isSU));
  const myCI=isSU?custs.map(c=>c.id):null;

  const ef={customerId:"",date:todayStr(),items:[{productId:"",qty:1,price:0}],useVatRep:false,vatRepId:"",note:""};
  const[form,setForm]=useState(ef);const[viewSO,setViewSO]=useState(null);const[confirmSO,setConfirmSO]=useState(null);const[delSO,setDelSO]=useState(null);const[editSO,setEditSO]=useState(null);const[viewProfile,setViewProfile]=useState(null);const[fSt,setFSt]=useState("all");const[approveSO,setApproveSO]=useState(null);

  const filtered=useMemo(()=>[...sales].reverse().filter(so=>{if(myCI&&!myCI.includes(so.customerId))return false;if(fSt!=="all"&&so.status!==fSt)return false;const s=(search||"").toLowerCase();const cust=contacts.find(c=>c.id===so.customerId);return so.soNum.toLowerCase().includes(s)||(cust&&(cN(cust)||"").toLowerCase().includes(s));}),[sales,myCI,fSt,search,contacts,cN]);
  const[incVat,setIncVat]=useState(true);const[payType,setPayType]=useState("cash");const[discPct,setDiscPct]=useState(1);const[creditDays,setCreditDays]=useState(45);const[extraDiscPct,setExtraDiscPct]=useState("");const[formErrors,setFormErrors]=useState([]);

  useEffect(()=>{if(sh.quickCreate==="addSO"&&ed){setFormErrors([]);setForm(ef);setIncVat(true);setPayType("cash");setDiscPct(1);setCreditDays(45);oM("addSO");sh.clearQuickCreate();}},[sh.quickCreate]);

  const soTot=so=>(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
  const mySO=useMemo(()=>myCI?sales.filter(s=>myCI.includes(s.customerId)):sales,[sales,myCI]);
  const stats=useMemo(()=>{const pend=mySO.filter(s=>s.status==="pending_delivery").length;const comp=mySO.filter(s=>s.status==="completed").length;const pendApv=mySO.filter(s=>s.status==="pending_special_approval").length;const totAmt=mySO.reduce((s,so)=>s+soTot(so)-(so.discountAmt||0),0);return{total:mySO.length,pend,comp,pendApv,totAmt};},[mySO]);
  const addItem=()=>setForm(f=>({...f,items:[...f.items,{productId:"",qty:1,price:0}]}));
  const rmItem=idx=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const setIt=(idx,k,v)=>setForm(f=>{const its=[...f.items];its[idx]={...its[idx],[k]:v};if(k==="productId"){const p=products.find(x=>x.id===+v);if(p)its[idx].price=p.price;}return{...f,items:its};});
  const setCust=cid=>{const c=contacts.find(x=>x.id===+cid);setForm(f=>({...f,customerId:cid,useVatRep:false,vatRepId:""}));if(c){if(c.defaultCreditDays)setCreditDays(c.defaultCreditDays);if(c.defaultDiscount!=null)setDiscPct(c.defaultDiscount);if(c.defaultVat!=null)setIncVat(c.defaultVat);if(c.defaultPayType)setPayType(c.defaultPayType);}};
  const curCust=form.customerId?contacts.find(c=>c.id===+form.customerId):null;
  const curVatReps=(curCust&&curCust.vatReps)||[];

  const getAvail=(pid,exId)=>{const pr=products.find(x=>x.id===+pid);if(!pr)return 0;const pq=sales.filter(so=>(so.status==="pending_delivery"||so.status==="pending_special_approval")&&so.id!==(exId||0)&&!so.dropShip).reduce((s,so)=>{const it=so.items.find(i=>i.productId===+pid);return s+(it?it.qty:0);},0);return Math.max(0,pr.stock-pq);};
  const hasApv=canApv("sales");
  const doSave=(soId)=>{
    const items=form.items.map(i=>({productId:+i.productId,qty:+i.qty,price:+i.price}));
    const sub=items.reduce((s,i)=>s+i.qty*i.price,0);const disc=payType==="cash"?Math.round(sub*discPct/100*100)/100:0;const ep=+(extraDiscPct||0);const extraDisc=ep>0?Math.round(sub*ep/100*100)/100:0;const totalDisc=disc+extraDisc;const vatAmt=incVat?Math.round((sub-totalDisc)*7/107*100)/100:0;
    const selRep=form.useVatRep&&form.vatRepId?curVatReps.find(r=>r.id===+form.vatRepId):null;
    const origPrices=items.map(i=>{const p=products.find(x=>x.id===i.productId);return p?+p.price:+i.price;});
    const priceChanged=items.some((i,idx)=>+i.price!==origPrices[idx]);
    const needsApproval=!hasApv&&(priceChanged||ep>0);
    const soBase={customerId:+form.customerId,date:form.date,items,origPrices,includeVat:incVat,vatAmount:vatAmt,payType,discountAmt:totalDisc,discPct:payType==="cash"?discPct:0,extraDiscPct:ep||0,creditDays:payType==="credit"?creditDays:0,useVatRep:!!form.useVatRep,vatRepName:selRep?selRep.name:"",vatRepAddress:selRep?selRep.address:"",vatRepIdCard:selRep?selRep.idCard:"",note:form.note||""};
    if(soId){const oldSO=sales.find(s=>s.id===soId);const keepStatus=oldSO?.status==="pending_special_approval"&&needsApproval?"pending_special_approval":needsApproval?"pending_special_approval":oldSO?.status||"pending_delivery";setSales(p=>p.map(s=>s.id===soId?{...s,...soBase,status:keepStatus}:s));addA("แก้ไข SO",editSO?.soNum||"");setEditSO(null);}
    else{const yr=new Date().getFullYear();const mx=sales.reduce((m,s)=>{const mt=s.soNum.match(/^SO-(\d+)-(\d+)$/);return mt&&+mt[1]===yr?Math.max(m,+mt[2]):m;},0);const sn="SO-"+yr+"-"+String(mx+1).padStart(3,"0");const st=needsApproval?"pending_special_approval":"pending_delivery";setSales(p=>[...p,{id:Date.now(),soNum:sn,status:st,fromQuote:"",...soBase}]);addA("สร้าง SO"+(needsApproval?" (รออนุมัติ)":""),sn);}
    cM();
  };
  const trySubmit=(soId)=>{const errs=[];if(!form.customerId)errs.push("ยังไม่เลือกลูกค้า");const exId=soId||0;form.items.forEach((it,idx)=>{if(!it.productId)errs.push("สินค้ารายการที่ "+(idx+1)+" ยังไม่เลือก");else if(+it.qty>getAvail(it.productId,exId))errs.push("สินค้ารายการที่ "+(idx+1)+" เกินสต็อก");});if(errs.length){setFormErrors(errs);return;}setFormErrors([]);doSave(soId);};
  const confirmDel=id=>{addA("ลบ SO",sales.find(s=>s.id===id)?.soNum||"");setSales(p=>p.filter(s=>s.id!==id));};
  const confirmDelivery=id=>{const so=sales.find(s=>s.id===id);if(!so||so.status!=="pending_delivery")return;
    if(so.dropShip&&so.linkedPO){
      for(const it of so.items){const pr=products.find(p=>p.id===it.productId);if(pr){addLog(mkLog(pr.id,"in",it.qty,pr.stock,pr.stock+it.qty,so.linkedPO,"รับของ PO (ส่งนอกสถานที่)",cu.username));addLog(mkLog(pr.id,"out",it.qty,pr.stock+it.qty,pr.stock,so.soNum,"จัดส่ง (ส่งนอกสถานที่)",cu.username));}}
      setPOs(p=>p.map(x=>x.poNum===so.linkedPO?{...x,status:"received"}:x));
      addA("จัดส่ง SO (ส่งนอกสถานที่)",so.soNum);addA("รับของ PO อัตโนมัติ",so.linkedPO);
    }else{
      for(const it of so.items){const pr=products.find(p=>p.id===it.productId);if(pr)addLog(mkLog(pr.id,"out",it.qty,pr.stock,Math.max(0,pr.stock-it.qty),so.soNum,"จัดส่ง",cu.username));}
      setProducts(pp=>pp.map(pr=>{const it=so.items.find(i=>i.productId===pr.id);return it?{...pr,stock:Math.max(0,pr.stock-it.qty)}:pr;}));addA("จัดส่ง SO",so.soNum);
    }
    setSales(p=>p.map(s=>s.id===id?{...s,status:"completed"}:s));};
  const openEdit=so=>{setFormErrors([]);
    const cust=contacts.find(c=>c.id===so.customerId);
    const reps=(cust&&cust.vatReps)||[];
    const matchRep=so.useVatRep&&so.vatRepName?reps.find(r=>r.name===so.vatRepName):null;
    setForm({customerId:String(so.customerId),date:so.date,items:so.items.map(i=>({productId:String(i.productId),qty:i.qty,price:i.price})),useVatRep:!!so.useVatRep,vatRepId:matchRep?String(matchRep.id):"",note:so.note||""});
    setIncVat(so.includeVat!==false);setPayType(so.payType||"cash");setDiscPct(so.discPct||1);setCreditDays(so.creditDays||45);setExtraDiscPct(so.extraDiscPct?String(so.extraDiscPct):"");setEditSO(so);oM("editSO");
  };

  const renderItems=(exId)=>form.items.map((item,idx)=>{
    const sel=item.productId?products.find(x=>x.id===+item.productId):null;
    const avail=item.productId?getAvail(item.productId,exId):0;
    const over=sel&&+item.qty>avail;
    return <div key={idx} style={{marginBottom:10,padding:"10px 12px",background:"var(--bg)",borderRadius:8,border:"1.5px solid "+(over?"var(--orange)":"var(--line)")}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"start",marginBottom:8}}>
        <ProductPicker value={item.productId} onChange={v=>setIt(idx,"productId",v)} products={products} pName={pN} avail={avail} unit={sel?sel.unit:""}/>
        <span onClick={()=>rmItem(idx)} style={{cursor:"pointer",color:"var(--red)",fontSize:20,paddingTop:6}}>{"×"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Field label="จำนวน"><input type="number" min="1" value={item.qty} onChange={e=>setIt(idx,"qty",e.target.value)} style={{...IB,borderColor:over?"var(--orange)":"var(--faint)"}}/></Field>
        <Field label="ราคา (฿)"><input type="number" min="0" value={item.price} onChange={e=>setIt(idx,"price",e.target.value)} style={{...IB,borderColor:sel&&+item.price!==+sel.price?"var(--purple)":""}}/>{sel&&+item.price!==+sel.price&&<div style={{fontSize:11,color:"var(--purple)",marginTop:2}}>{"ราคาตั้งต้น: ฿"+fmt(sel.price)}</div>}</Field>
      </div>
      {over&&<div style={{marginTop:6,fontSize:12,color:"var(--red)",fontWeight:500}}>{"เกินสต็อก (ขาด "+(+item.qty-avail)+")"}</div>}
    </div>;
  });

  const renderForm=(soId)=>{
    const exId=soId||0;const hasOver=form.items.some(it=>it.productId&&+it.qty>getAvail(it.productId,exId));
    const sub=form.items.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0);const disc=payType==="cash"?Math.round(sub*discPct/100*100)/100:0;const ep=+(extraDiscPct||0);const extraDisc=ep>0?Math.round(sub*ep/100*100)/100:0;const totalDisc=disc+extraDisc;const after=sub-totalDisc;const vatAmt=incVat?Math.round(after*7/107*100)/100:0;
    return <div>
      <div className="form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Field label="ลูกค้า"><CustomSelect searchable value={form.customerId} onChange={v=>setCust(v)} options={[{value:"",label:"เลือก..."},...custs.map(c=>({value:String(c.id),label:cN(c)}))]}/></Field>
        <Field label="วันที่"><ThaiDateInput value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></Field>
      </div>
      {renderItems(exId)}
      <button onClick={addItem} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--line)",cursor:"pointer",background:"transparent",marginBottom:12}}>{"+ เพิ่ม"}</button>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"12px 14px",marginBottom:12,fontSize:13}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>{[["cash","เงินสด"],["credit","เครดิต"]].map(v=><label key={v[0]} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(payType===v[0]?"var(--green)":"var(--line)"),cursor:"pointer",background:payType===v[0]?"rgba(52,199,89,0.12)":"var(--panel)"}}><input type="radio" name="pt" checked={payType===v[0]} onChange={()=>setPayType(v[0])}/><span style={{fontWeight:500,color:payType===v[0]?"var(--green)":"var(--text)"}}>{v[1]}</span></label>)}</div>
        {payType==="cash"&&<div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:500,marginBottom:6}}>ส่วนลด</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{DISC_OPTS.map(d=><button key={d} onClick={()=>setDiscPct(d)} style={{padding:"5px 14px",borderRadius:99,border:"1.5px solid "+(discPct===d?"var(--green)":"var(--line)"),background:discPct===d?"rgba(52,199,89,0.12)":"var(--panel)",color:discPct===d?"var(--green)":"var(--dim)",cursor:"pointer",fontSize:12}}>{d===0?"ไม่ลด":d+"%"}</button>)}</div></div>}
        <div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:500,marginBottom:6}}>ส่วนลดพิเศษ (%)</div><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" min="0" max="100" step="0.1" value={extraDiscPct} onChange={e=>setExtraDiscPct(e.target.value)} placeholder="0" style={{...IB,width:100,padding:"5px 10px"}}/>{ep>0&&<span style={{fontSize:12,color:"var(--green)"}}>{"−฿"+fmt(extraDisc)}</span>}</div></div>
        {payType==="credit"&&<div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:500,marginBottom:6}}>วันเครดิต</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CREDIT_OPTS.map(d=><button key={d} onClick={()=>setCreditDays(d)} style={{padding:"5px 14px",borderRadius:99,border:"1.5px solid "+(creditDays===d?"var(--blue)":"var(--line)"),background:creditDays===d?"var(--blue-bg)":"var(--panel)",color:creditDays===d?"var(--blue)":"var(--dim)",cursor:"pointer",fontSize:12}}>{d+" วัน"}</button>)}</div></div>}
        <div style={{borderTop:"1px solid var(--line)",paddingTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",color:"var(--dim)",marginBottom:4}}><span>ยอดรวม</span><span>{"฿"+fmt(sub)}</span></div>
          {payType==="cash"&&disc>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลด "+discPct+"%"}</span><span>{"-฿"+fmt(disc)}</span></div>}
          {ep>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลดพิเศษ "+ep+"%"}</span><span>{"-฿"+fmt(extraDisc)}</span></div>}
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,marginBottom:6}}><input type="checkbox" checked={incVat} onChange={e=>setIncVat(e.target.checked)}/>VAT 7%</label>
          {incVat&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--orange)",marginBottom:4,fontSize:12}}><span>VAT</span><span>{"฿"+fmt(vatAmt)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,borderTop:"1px solid var(--line)",paddingTop:8}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(after)}</span></div>
        </div>
      </div>
      <div style={{background:"var(--blue-bg)",border:"1.5px solid var(--blue)",borderRadius:8,padding:"12px 14px",marginBottom:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:form.useVatRep?10:0}}>
          <input type="checkbox" checked={!!form.useVatRep} onChange={e=>setForm(f=>({...f,useVatRep:e.target.checked,vatRepId:e.target.checked?f.vatRepId:""}))}/>
          <span style={{fontSize:13,fontWeight:600,color:"var(--blue)"}}>{"ออก VAT ให้ตัวแทน"}</span>
        </label>
        {form.useVatRep&&(curVatReps.length>0
          ? <div>
              <CustomSelect value={form.vatRepId} onChange={v=>setForm(f=>({...f,vatRepId:v}))} options={[{value:"",label:"-- เลือกตัวแทน --"},...curVatReps.map(r=>({value:String(r.id),label:r.name+" ("+r.idCard+")"}))]} style={{marginBottom:8}}/>
              {form.vatRepId&&(()=>{const r=curVatReps.find(x=>x.id===+form.vatRepId);return r?<div style={{background:"var(--panel)",borderRadius:6,padding:"8px 10px",fontSize:12,border:"1px solid var(--line)"}}>
                <div style={{fontWeight:500}}>{r.name}</div>
                <div style={{color:"var(--dim)",marginTop:2}}>{r.address}</div>
                <div style={{color:"var(--faint)",marginTop:2}}>{"บัตร ปชช: "+r.idCard}</div>
              </div>:null;})()}
            </div>
          : <div style={{fontSize:12,color:"var(--orange)",background:"rgba(255,149,0,0.14)",borderRadius:6,padding:"8px 10px"}}>{"ลูกค้ารายนี้ยังไม่มีตัวแทน VAT — กรุณาเพิ่มในหน้า ลูกค้า ก่อน"}</div>
        )}
      </div>
      <Field label="หมายเหตุ"><textarea value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{...IB,height:56,resize:"vertical"}} placeholder="หมายเหตุ..."/></Field>
      {hasOver&&<div style={{background:"rgba(255,59,48,0.12)",border:"1.5px solid var(--red)",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:13,color:"var(--red)",fontWeight:500}}>{"สินค้าบางรายการเกินสต็อก — กรุณาแก้ไขจำนวน"}</div>}
      {(()=>{const pc=form.items.some(i=>{if(!i.productId)return false;const p=products.find(x=>x.id===+i.productId);return p&&+i.price!==+p.price;});const na=!hasApv&&(pc||ep>0);return na?<div style={{background:"rgba(175,82,222,0.12)",border:"1.5px solid var(--purple)",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:13,color:"var(--purple)",fontWeight:500}}>{"ราคา/ส่วนลดพิเศษถูกแก้ไข — SO จะอยู่สถานะ \"รออนุมัติพิเศษ\""}</div>:null;})()}
      {formErrors.length>0&&<div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"10px 14px",marginBottom:10}}><div style={{fontSize:12,fontWeight:600,color:"var(--red)",marginBottom:4}}>กรุณากรอกข้อมูลให้ครบ:</div>{formErrors.map((e,i)=><div key={i} style={{fontSize:12,color:"var(--red)",marginBottom:2}}>{"• "+e}</div>)}</div>}
      <MBtns onCancel={()=>{setEditSO(null);cM();}} onSave={hasOver?null:()=>trySubmit(soId)} saveLabel={soId?"บันทึก":"สร้างใบขาย"}/>
    </div>;
  };

  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
      <StatCard label="SO ทั้งหมด" value={stats.total} color="var(--blue)" accentBg="var(--blue-bg)"/>
      <StatCard label="รอจัดส่ง" value={stats.pend} color="var(--orange)" accentBg="rgba(255,149,0,0.14)"/>
      <StatCard label="ส่งแล้ว" value={stats.comp} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
      <StatCard label="ยอดขายรวม" value={"฿"+fmt(stats.totAmt)} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <SB value={search} onChange={setSearch} placeholder="ค้นหา SO..."/>
      {ed&&<Btn onClick={()=>{setFormErrors([]);setForm(ef);setIncVat(true);setPayType("cash");setDiscPct(1);setCreditDays(45);oM("addSO");}}>{"+ สร้างใบขาย"}</Btn>}
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {[["all","ทั้งหมด",stats.total],["pending_special_approval","รออนุมัติพิเศษ",stats.pendApv],["pending_delivery","รอจัดส่ง",stats.pend],["completed","ส่งแล้ว",stats.comp]].map(([k,lb,cnt])=>{
        const active=fSt===k;const clr=k==="pending_delivery"?"var(--orange)":k==="completed"?"var(--green)":k==="pending_special_approval"?"var(--purple)":"var(--dim)";const bg=k==="pending_delivery"?"rgba(255,149,0,0.14)":k==="completed"?"rgba(52,199,89,0.12)":k==="pending_special_approval"?"rgba(175,82,222,0.12)":"var(--bg)";
        return <button key={k} onClick={()=>setFSt(k)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1.5px solid "+(active?clr:"var(--line)"),background:active?bg:"transparent",color:active?clr:"var(--dim)",cursor:"pointer",fontWeight:active?600:400}}>{lb} <span style={{opacity:.7}}>({cnt})</span></button>;
      })}
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["SO No.","ลูกค้า","วันที่","รวม","เงื่อนไข","VAT Rep","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px 6px",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(so=>{const cust=contacts.find(c=>c.id===so.customerId);return <tr key={so.id} style={{borderBottom:"0.5px solid var(--line)"}}>
      <td style={{padding:"8px 6px",fontWeight:500}}>
        <span onClick={()=>{setViewSO(so);oM("viewSO");}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{cursor:"pointer",color:"var(--blue)"}}>{so.soNum}</span>
        {so.fromQuote&&<span style={{fontSize:10,background:"rgba(175,82,222,0.12)",color:"var(--purple)",borderRadius:4,padding:"1px 6px",marginLeft:6,fontWeight:500}}>{so.fromQuote}</span>}
        {so.dropShip&&<span style={{fontSize:10,background:"rgba(10,132,255,0.12)",color:"var(--blue)",borderRadius:4,padding:"1px 6px",marginLeft:6,fontWeight:500}}>{"📦 ส่งนอกสถานที่"}</span>}
        {so.linkedPO&&<span onClick={e=>{e.stopPropagation();sh.handleTab("purchase");sh.setSearch(so.linkedPO);}} style={{fontSize:10,background:"rgba(255,149,0,0.12)",color:"var(--orange)",borderRadius:4,padding:"1px 6px",marginLeft:4,fontWeight:500,cursor:"pointer"}}>{"← "+so.linkedPO}</span>}
      </td>
      <td style={{padding:"8px 6px"}}>{cust?<span onClick={()=>setViewProfile(cust)} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{cursor:"pointer",color:"var(--blue)"}}>{cN(cust)}</span>:"-"}</td>
      <td style={{padding:"8px 6px",color:"var(--dim)"}}>{toBE(so.date)}</td>
      <td style={{padding:"8px 6px"}}>{"฿"+fmt(soTot(so))}</td>
      <td style={{padding:"8px 6px"}}>{so.payType==="cash"?<span style={{fontSize:11,background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:4,padding:"2px 8px"}}>{"เงินสด"+(so.discPct?" -"+so.discPct+"%":"")}</span>:<span style={{fontSize:11,background:"var(--blue-bg)",color:"var(--blue)",borderRadius:4,padding:"2px 8px"}}>{"เครดิต "+(so.creditDays||0)+" วัน"}</span>}</td>
      <td style={{padding:"8px 6px"}}>{so.useVatRep&&so.vatRepName?<span style={{fontSize:11,background:"var(--blue-bg)",color:"var(--blue)",borderRadius:4,padding:"2px 8px"}}>{so.vatRepName}</span>:<span style={{color:"var(--faint)"}}>{"—"}</span>}</td>
      <td style={{padding:"8px 6px"}}><Badge status={so.status}/></td>
      <td style={{padding:"8px 6px",whiteSpace:"nowrap"}}>
        {hasApv&&so.status==="pending_special_approval"&&<button onClick={()=>setApproveSO(so)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--purple)",background:"rgba(175,82,222,0.12)",color:"var(--purple)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>อนุมัติ</button>}
        {ed&&(so.status==="pending_delivery"||so.status==="pending_special_approval")&&<button onClick={()=>openEdit(so)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.12)",color:"var(--orange)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>แก้ไข</button>}
        {ed&&so.status==="pending_delivery"&&<button onClick={()=>{setConfirmSO(so);oM("confirmD");}} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>จัดส่ง</button>}
        {ed&&so.status!=="completed"&&!so.linkedPO&&<button onClick={()=>setDelSO(so)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}
      </td>
    </tr>;})}</tbody></table></div>

    {modal==="addSO"&&ed&&<Modal title="สร้างใบขายใหม่" onClose={cM}>{renderForm(null)}</Modal>}
    {modal==="editSO"&&editSO&&ed&&<Modal title={"แก้ไข — "+editSO.soNum} onClose={()=>{setEditSO(null);cM();}}>{renderForm(editSO.id)}</Modal>}
    {modal==="confirmD"&&confirmSO&&(()=>{
      const cust=contacts.find(c=>c.id===confirmSO.customerId);
      return<Modal title={"ยืนยันจัดส่ง — "+confirmSO.soNum} onClose={cM}>
        <div style={{fontSize:13,marginBottom:8}}><span style={{color:"var(--dim)"}}>ลูกค้า: </span><span style={{fontWeight:500}}>{cust?cN(cust):"-"}</span></div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:10}}>{"วันที่: "+toBE(confirmSO.date)}</div>
        <div style={{overflowX:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:14}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"var(--bg)"}}>
              {["สินค้า","จำนวน","ราคา/หน่วย","รวม"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)"}}>{h}</th>)}
            </tr></thead>
            <tbody>{(confirmSO.items||[]).map((it,i)=>{const pr=products.find(x=>x.id===it.productId);return<tr key={i} style={{borderBottom:"0.5px solid var(--line)"}}>
              <td style={{padding:"6px 10px",fontWeight:500}}>{pr?pN(pr):"-"}</td>
              <td style={{padding:"6px 10px"}}>{it.qty}</td>
              <td style={{padding:"6px 10px"}}>{"฿"+fmt(it.price)}</td>
              <td style={{padding:"6px 10px",fontWeight:600}}>{"฿"+fmt(it.qty*it.price)}</td>
            </tr>;})}
            <tr style={{background:"var(--bg)",fontWeight:600}}>
              <td colSpan={3} style={{padding:"6px 10px",textAlign:"right",color:"var(--dim)"}}>ยอดรวม</td>
              <td style={{padding:"6px 10px"}}>{"฿"+fmt(soTot(confirmSO))}</td>
            </tr></tbody>
          </table>
        </div>
        {confirmSO.dropShip?<div style={{background:"rgba(10,132,255,0.08)",border:"1px solid var(--blue)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}><strong>{"📦 ส่งนอกสถานที่"}</strong><div style={{fontSize:12,color:"var(--dim)",marginTop:4}}>{"สต็อกจะ +รับเข้า แล้ว -จ่ายออก (ไม่กระทบยอดสต็อก)"}</div>{confirmSO.linkedPO&&<div style={{fontSize:12,color:"var(--blue)",marginTop:2}}>{confirmSO.linkedPO+" จะเปลี่ยนเป็น \"รับแล้ว\" อัตโนมัติ"}</div>}</div>
        :<div style={{background:"rgba(52,199,89,0.12)",border:"1px solid var(--green)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}><strong>ยืนยันแล้วสต็อกจะถูกตัดทันที</strong></div>}
        <MBtns onCancel={cM} onSave={()=>{confirmDelivery(confirmSO.id);setConfirmSO(null);cM();}} saveLabel="ยืนยัน"/>
      </Modal>;
    })()}
    {modal==="viewSO"&&viewSO&&(()=>{
      const vSub=soTot(viewSO);const vDisc=viewSO.discountAmt||0;const vAfter=vSub-vDisc;const vVat=viewSO.vatAmount||0;
      return <Modal title={viewSO.soNum} onClose={cM}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{contacts.find(c=>c.id===viewSO.customerId)?cN(contacts.find(c=>c.id===viewSO.customerId)):"-"}</div>
          <div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>{"วันที่: "+toBE(viewSO.date)}</div>
        </div>
        <Badge status={viewSO.status}/>
      </div>
      {viewSO.fromQuote&&<div style={{fontSize:12,background:"rgba(175,82,222,0.12)",color:"var(--purple)",borderRadius:6,padding:"6px 10px",marginBottom:10}}>{"มาจากใบเสนอราคา: "+viewSO.fromQuote}</div>}
      {viewSO.linkedPO&&<div style={{fontSize:12,background:"rgba(255,149,0,0.12)",color:"var(--orange)",borderRadius:6,padding:"6px 10px",marginBottom:10}}>{"📦 ส่งนอกสถานที่จาก PO: "}<span onClick={()=>{cM();sh.handleTab("purchase");sh.setSearch(viewSO.linkedPO);}} style={{fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>{viewSO.linkedPO}</span></div>}
      {viewSO.status==="pending_special_approval"&&<div style={{background:"rgba(175,82,222,0.12)",border:"1.5px solid var(--purple)",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:12}}>
        <div style={{fontWeight:600,color:"var(--purple)",marginBottom:6}}>{"รายการที่แก้ไข:"}</div>
        {(viewSO.origPrices||[]).map((op,i)=>{const it=viewSO.items[i];if(!it)return null;const diff=+it.price!==+op;return diff?<div key={i} style={{color:"var(--purple)"}}>{(products.find(x=>x.id===it.productId)?pN(products.find(x=>x.id===it.productId)):"-")+" — ราคาตั้งต้น ฿"+fmt(op)+" → ฿"+fmt(it.price)}</div>:null;})}
        {(viewSO.extraDiscPct||0)>0&&<div style={{color:"var(--purple)"}}>{"ส่วนลดพิเศษ: "+viewSO.extraDiscPct+"%"}</div>}
      </div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        {viewSO.payType==="cash"?<span style={{fontSize:12,background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:6,padding:"4px 10px",fontWeight:500}}>{"เงินสด"+(viewSO.discPct?" ลด "+viewSO.discPct+"%":"")}</span>
        :<span style={{fontSize:12,background:"var(--blue-bg)",color:"var(--blue)",borderRadius:6,padding:"4px 10px",fontWeight:500}}>{"เครดิต "+(viewSO.creditDays||0)+" วัน"}</span>}
        {viewSO.includeVat&&<span style={{fontSize:12,background:"rgba(255,149,0,0.14)",color:"var(--orange)",borderRadius:6,padding:"4px 10px",fontWeight:500}}>VAT 7%</span>}
      </div>
      {viewSO.useVatRep&&viewSO.vatRepName?<div style={{background:"var(--blue-bg)",border:"1.5px solid var(--blue)",borderRadius:8,padding:"10px 14px",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--blue)",marginBottom:6}}>{"ตัวแทนรับ VAT"}</div>
        <div style={{fontWeight:500,fontSize:13}}>{viewSO.vatRepName}</div>
        {viewSO.vatRepAddress&&<div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>{viewSO.vatRepAddress}</div>}
        {viewSO.vatRepIdCard&&<div style={{fontSize:12,color:"var(--faint)",marginTop:2}}>{"บัตร ปชช: "+viewSO.vatRepIdCard}</div>}
      </div>:null}
      <table style={{width:"100%",borderCollapse:"collapse",marginTop:10}}><thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["สินค้า","Qty","ราคา","รวม"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead><tbody>{viewSO.items.map((it,i)=>{const pr=products.find(x=>x.id===it.productId);return <tr key={i} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"6px 8px"}}>{pr?pN(pr):"-"}</td><td style={{padding:"6px 8px"}}>{it.qty}</td><td style={{padding:"6px 8px"}}>{"฿"+fmt(it.price)}</td><td style={{padding:"6px 8px",fontWeight:500}}>{"฿"+fmt(it.qty*it.price)}</td></tr>;})}</tbody></table>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",color:"var(--dim)",marginBottom:4}}><span>ยอดรวม</span><span>{"฿"+fmt(vSub)}</span></div>
        {viewSO.discPct>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลด "+viewSO.discPct+"%"}</span><span>{"-฿"+fmt(Math.round(vSub*viewSO.discPct/100*100)/100)}</span></div>}
        {(viewSO.extraDiscPct||0)>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลดพิเศษ "+viewSO.extraDiscPct+"%"}</span><span>{"-฿"+fmt(Math.round(vSub*viewSO.extraDiscPct/100*100)/100)}</span></div>}
        {viewSO.includeVat&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--orange)",marginBottom:4}}><span>VAT 7%</span><span>{"฿"+fmt(vVat)}</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,borderTop:"1px solid var(--line)",paddingTop:8}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(vAfter)}</span></div>
      </div>
      {viewSO.note&&<div style={{fontSize:12,color:"var(--dim)",marginTop:10,padding:"8px 10px",background:"var(--panel)",borderRadius:6,border:"0.5px solid var(--line)"}}>{viewSO.note}</div>}
      <div style={{marginTop:14,marginBottom:4,display:"flex",gap:8}}>
        <button onClick={()=>printDoc("so",viewSO,products,contacts)} style={{padding:"8px 18px",background:"var(--text)",color:"var(--bg)",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"พิมพ์ / PDF"}</button>
        {hasApv&&viewSO.status==="pending_special_approval"&&<button onClick={()=>{setApproveSO(viewSO);cM();}} style={{padding:"8px 18px",background:"var(--purple)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"อนุมัติ"}</button>}
      </div>
      <MBtns onCancel={cM}/>
    </Modal>;
    })()}
    {delSO&&<Modal title="ยืนยันลบ" onClose={()=>setDelSO(null)}><div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบ "+delSO.soNum+" ถาวร"}</div><MBtns onCancel={()=>setDelSO(null)} onSave={()=>{confirmDel(delSO.id);setDelSO(null);}} saveLabel="ลบ"/></Modal>}
    {approveSO&&(()=>{const so=approveSO;const cust=contacts.find(c=>c.id===so.customerId);const aSub=so.items.reduce((s,i)=>s+i.qty*i.price,0);const aDisc=so.discPct?Math.round(aSub*so.discPct/100*100)/100:0;const aExtra=(so.extraDiscPct||0)>0?Math.round(aSub*so.extraDiscPct/100*100)/100:0;const aVat=so.includeVat?Math.round((aSub-aDisc-aExtra)*7/107*100)/100:0;const aTotal=aSub-aDisc-aExtra+aVat;const hasChanges=(so.origPrices||[]).some((op,i)=>so.items[i]&&+so.items[i].price!==+op)||(so.extraDiscPct||0)>0;return<Modal title="ยืนยันอนุมัติ" onClose={()=>setApproveSO(null)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div><div style={{fontWeight:700,fontSize:15}}>{so.soNum}</div><div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>{cust?cN(cust):"-"}{" — "+toBE(so.date)}</div></div>
        <Badge status={so.status}/>
      </div>
      {hasChanges&&<div style={{background:"rgba(175,82,222,0.12)",border:"1.5px solid var(--purple)",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:12}}>
        <div style={{fontWeight:600,color:"var(--purple)",marginBottom:6}}>{"รายการที่แก้ไขราคา:"}</div>
        {(so.origPrices||[]).map((op,i)=>{const it=so.items[i];if(!it)return null;const diff=+it.price!==+op;return diff?<div key={i} style={{display:"flex",justifyContent:"space-between",color:"var(--purple)",marginBottom:3}}><span>{products.find(x=>x.id===it.productId)?pN(products.find(x=>x.id===it.productId)):"-"}</span><span>{"฿"+fmt(op)+" → ฿"+fmt(it.price)+" ("+((+it.price-op>=0)?"+":"")+fmt(+it.price-op)+")"}</span></div>:null;})}
        {(so.extraDiscPct||0)>0&&<div style={{color:"var(--purple)",marginTop:4}}>{"ส่วนลดพิเศษ: "+so.extraDiscPct+"% (-฿"+fmt(aExtra)+")"}</div>}
      </div>}
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}><thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["สินค้า","Qty","ราคา","รวม"].map(h=><th key={h} style={{padding:"5px 6px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead><tbody>{so.items.map((it,i)=>{const pr=products.find(x=>x.id===it.productId);const orig=(so.origPrices||[])[i];const diff=orig!=null&&+it.price!==+orig;return<tr key={i} style={{borderBottom:"0.5px solid var(--line)",background:diff?"rgba(175,82,222,0.06)":"transparent"}}><td style={{padding:"5px 6px"}}>{pr?pN(pr):"-"}</td><td style={{padding:"5px 6px"}}>{it.qty}</td><td style={{padding:"5px 6px",color:diff?"var(--purple)":""}}>{"฿"+fmt(it.price)}{diff&&<span style={{fontSize:10,color:"var(--faint)",marginLeft:4}}>{"(เดิม ฿"+fmt(orig)+")"}</span>}</td><td style={{padding:"5px 6px",fontWeight:500}}>{"฿"+fmt(it.qty*it.price)}</td></tr>;})}</tbody></table>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",color:"var(--dim)",marginBottom:4}}><span>ยอดรวม</span><span>{"฿"+fmt(aSub)}</span></div>
        {so.discPct>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--green)",marginBottom:4}}><span>{"ส่วนลด "+so.discPct+"%"}</span><span>{"-฿"+fmt(aDisc)}</span></div>}
        {(so.extraDiscPct||0)>0&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--purple)",marginBottom:4,fontWeight:600}}><span>{"ส่วนลดพิเศษ "+so.extraDiscPct+"%"}</span><span>{"-฿"+fmt(aExtra)}</span></div>}
        {so.includeVat&&<div style={{display:"flex",justifyContent:"space-between",color:"var(--orange)",marginBottom:4}}><span>VAT 7%</span><span>{"฿"+fmt(aVat)}</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,borderTop:"1px solid var(--line)",paddingTop:8}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(aTotal)}</span></div>
      </div>
      <MBtns onCancel={()=>setApproveSO(null)} onSave={()=>{setSales(p=>p.map(s=>s.id===so.id?{...s,status:"pending_delivery"}:s));addA("อนุมัติพิเศษ SO",so.soNum);setApproveSO(null);}} saveLabel="อนุมัติ"/>
    </Modal>;})()}
    {viewProfile&&<CustomerProfile customer={viewProfile} sales={sales} quotes={quotes} payments={payments} products={products} pN={pN} onClose={()=>setViewProfile(null)}/>}
  </div>;
}

export default function SalesPage({sh}){
  const{sales,setSales,products,contacts,addA,cu,canC}=sh;
  const ed=canC("sales");
  const[subTab,setSubTab]=useState("so");


  return <div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--line)"}}>
      {[["so","ใบขาย"],["qt","ใบเสนอราคา"]].map(([k,label])=>
        <button key={k} onClick={()=>setSubTab(k)} style={{padding:"10px 20px",fontSize:13,fontWeight:subTab===k?600:400,border:"none",borderBottom:subTab===k?"2px solid var(--text)":"2px solid transparent",marginBottom:"-2px",background:"transparent",cursor:"pointer",color:subTab===k?"var(--text)":"var(--dim)"}}>
          {label}
        </button>
      )}
    </div>
    {subTab==="so"&&<SOList sh={sh}/>}
    {subTab==="qt"&&<QuotesPage sh={sh}/>}
  </div>;
}

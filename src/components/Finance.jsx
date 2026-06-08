import React, { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE, round2 } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import SupplierCN from "./Finance/SupplierCN.jsx";
import Cheque from "./Finance/Cheque.jsx";
import Billing from "./Finance/Billing.jsx";
import CN from "./Finance/CN.jsx";
import Bank from "./Finance/Bank.jsx";
import ARAP from "./Finance/ARAP.jsx";
import { BANK_OPTS, CN_TYPES, hasPerm } from "./Finance/constants.js";

const TB={padding:"10px 20px",fontSize:13,border:"none",marginBottom:"-2px",background:"transparent",cursor:"pointer",fontFamily:"inherit"};

export default function FinPage({sh}){
  const{cN,pN,contacts,sales,payments,setPayments,products,canE,canD,modal,oM,cM,setCheques,bankAccs,setBankTxns,cnotes,billings,tagMappings}=sh;
  const ed=canE("finance");const cd=canD("finance");
  const[sub,setSub]=useState("ap");
  const[payForm,setPayForm]=useState({refId:"",type:"",amount:"",method:"โอนเงิน",date:todayStr(),note:""});
  const[viewSO,setViewSO]=useState(null);
  const[confirmDelPay,setConfirmDelPay]=useState(null);const[search,setSearch]=useState("");const[warnMsg,setWarnMsg]=useState(null);

  const autoTag=(key)=>{const m=tagMappings.find(x=>x.key===key);return m?{catId:m.catId,subCatId:m.subCatId}:{catId:null,subCatId:null};};

  const cnTot=cn=>{if(cn.type==="promo")return +cn.amount||0;const items=cn.items||[];if(cn.type!=="defective"&&cn.soNum){const so=sales.find(s=>s.soNum===cn.soNum);if(so&&so.discountAmt>0){const sub=(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const r=sub>0?(sub-so.discountAmt)/sub:1;const raw=items.reduce((s,it)=>{const si=(so.items||[]).find(x=>x.productId===it.productId);return s+it.qty*(si?si.price*r:it.price);},0);return round2(raw);}}return items.reduce((s,i)=>s+i.qty*i.price,0);};

  const arList=useMemo(()=>sales.filter(so=>so.status==="completed").map(so=>{const cust=contacts.find(c=>c.id===so.customerId);const soPays=payments.filter(p=>p.refId===so.soNum&&p.type==="ar");const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const paid=soPays.reduce((s,p)=>s+(+p.amount||0),0);const rem=tot-paid;
    let dueDate=null,overdue=false;
    if(so.date){const days=so.payType==="credit"&&so.creditDays>0?so.creditDays:7;const d=new Date(so.date);d.setDate(d.getDate()+days);dueDate=d.toISOString().slice(0,10);overdue=rem>0&&dueDate<todayStr();}
    const st2=paid===0?"unpaid":rem<=0?"paid":soPays.length>0&&soPays.every(p=>p.method==="หักลดหนี้")?"cn_credit":"partial";
    return{...so,custName:cust?cN(cust):"-",total:tot,paid,remaining:rem,status2:st2,dueDate,overdue};}),[sales,contacts,payments]);
  // openPay/openEditPay set payForm + open addPay modal (modal stays in parent because
  // viewSO modal (also in parent) needs to open addPay from anywhere — including Billing/CN tabs)
  const openPay=item=>{setPayForm({refId:item.poNum||item.soNum,type:item.poNum?"ap":"ar",amount:Math.max(0,item.remaining).toFixed(2),method:item.poNum?"โอนเงินออก":"โอนเงิน",date:todayStr(),note:"",name:item.supName||item.custName,accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:""});oM("addPay");};
  const openEditPay=(p,nameStr)=>{setPayForm({editId:p.id,refId:p.refId,type:p.type,amount:String(p.amount),method:p.method,date:p.date,note:p.note||"",name:nameStr||"",accId:p.accId||bankAccs[0]?.id||1,chequeNo:p.chequeNo||"",chequeBank:p.chequeBank||"",chequeDue:p.chequeDue||""});oM("addPay");};
  const delPay=(p)=>{const wantType=p.type==="ar"?"in":"out";setPayments(prev=>prev.filter(x=>x.id!==p.id));setBankTxns(prev=>prev.filter(t=>!(t.refId===p.refId&&Math.abs(t.amount-p.amount)<0.01&&t.date===p.date&&t.type===wantType)));if(p.method==="เช็ค"&&p.chequeNo)setCheques(prev=>prev.filter(c=>!(c.chequeNo===p.chequeNo&&c.refId===p.refId)));};
  const savePay=()=>{if(!payForm.amount||+payForm.amount<=0)return;const amt=+payForm.amount;if(isNaN(amt)||amt<=0)return;if(payForm.method==="เช็ค"&&payForm.type==="ar"&&!payForm.chequeNo)return;
    // Validation: ยอดชำระไม่เกินยอดคงค้าง — compute inline from arList (AR) หรือ payments+items (AP)
    let allowed=null;
    if(payForm.type==="ar"){const target=arList.find(x=>x.soNum===payForm.refId);if(target)allowed=Math.max(0,target.remaining);}
    else{const po=sh.pos.find(p=>p.poNum===payForm.refId);if(po){const total=(po.items||[]).reduce((s,i)=>s+i.qty*i.cost,0);const paid=payments.filter(p=>p.refId===po.poNum&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);allowed=Math.max(0,total-paid);}}
    if(allowed!==null){if(payForm.editId){const oldP=payments.find(x=>x.id===payForm.editId);if(oldP)allowed+=(+oldP.amount||0);}if(amt>allowed+0.01){setWarnMsg("ยอดชำระเกินยอดคงค้าง (เหลือ ฿"+fmt(allowed)+")");return;}}
    const isApBank=payForm.type==="ap"&&payForm.method==="โอนเงินออก"&&payForm.accId;
    const isApEpp=payForm.type==="ap"&&payForm.method==="จ่ายEPP"&&payForm.accId;
    const isArBank=payForm.type==="ar"&&payForm.method==="โอนเงิน"&&payForm.accId;
    const isApCash=payForm.type==="ap"&&payForm.method==="เงินสด"&&payForm.accId;
    const isArCash=payForm.type==="ar"&&payForm.method==="เงินสด"&&payForm.accId;
    if(payForm.editId){const old=payments.find(x=>x.id===payForm.editId);setPayments(p=>p.map(x=>x.id===payForm.editId?{...x,amount:amt,method:payForm.method,date:payForm.date,note:payForm.note,accId:payForm.accId,chequeNo:payForm.chequeNo,chequeBank:payForm.chequeBank,chequeDue:payForm.chequeDue}:x));if(old){setBankTxns(prev=>prev.filter(t=>!(t.refId===old.refId&&Math.abs(t.amount-old.amount)<0.01&&t.date===old.date)));if(old.method==="เช็ค"&&old.chequeNo)setCheques(prev=>prev.filter(c=>!(c.chequeNo===old.chequeNo&&c.refId===old.refId)));}if(isArBank){const tag=autoTag("ar_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApBank){const tag=autoTag("ap_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่าย "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApEpp){const tag=autoTag("ap_epp");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายEPP "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isArCash){const tag=autoTag("ar_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApCash){const tag=autoTag("ap_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(payForm.method==="เช็ค"&&payForm.type==="ar"){setCheques(p=>[...p,{id:Date.now()+2,chequeNo:payForm.chequeNo,bank:payForm.chequeBank,amount:amt,date:payForm.date,dueDate:payForm.chequeDue,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,status:"pending"}]);}
    }else{setPayments(p=>[...p,{id:Date.now(),...payForm,amount:amt}]);if(isArBank){const tag=autoTag("ar_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApBank){const tag=autoTag("ap_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่าย "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApEpp){const tag=autoTag("ap_epp");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายEPP "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isArCash){const tag=autoTag("ar_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApCash){const tag=autoTag("ap_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(payForm.method==="เช็ค"&&payForm.type==="ar"){setCheques(p=>[...p,{id:Date.now()+2,chequeNo:payForm.chequeNo,bank:payForm.chequeBank,amount:amt,date:payForm.date,dueDate:payForm.chequeDue,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,status:"pending"}]);}}cM();};

  const[viewBill,setViewBill]=useState(null);
  const soBillMap=useMemo(()=>{const m={};for(const b of billings)for(const sn of(b.soNums||[]))m[sn]=b;return m;},[billings]);

  const TAB_GROUPS=[[["ap","จ่ายซัพพลายเออร์"],["supcn","ใบลดหนี้ (ซัพฯ)"]],[["ar","เก็บเงินลูกค้า"],["billing","ใบวางบิล"],["cn","ใบลดหนี้"]],[["cheque","เช็ค"],["bank","บัญชี"]]];

  return <div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--line)",overflowX:"auto"}}>{TAB_GROUPS.map((grp,gi)=><React.Fragment key={gi}>{gi>0&&<span style={{borderLeft:"1.5px solid var(--line)",margin:"6px 4px",alignSelf:"stretch"}}/>}{grp.map(v=><button key={v[0]} onClick={()=>{setSub(v[0]);setSearch("");}} style={{...TB,fontWeight:sub===v[0]?600:400,borderBottom:sub===v[0]?"2px solid var(--text)":"2px solid transparent",color:sub===v[0]?"var(--text)":"var(--dim)"}}>{v[1]}</button>)}</React.Fragment>)}</div>

    {(sub==="ap"||sub==="ar")&&<ARAP sh={sh} sub={sub} setSub={setSub} arList={arList} autoTag={autoTag} cN={cN} search={search} setSearch={setSearch} setViewSO={setViewSO} setViewBill={setViewBill} soBillMap={soBillMap} openPay={openPay} openEditPay={openEditPay} setConfirmDelPay={setConfirmDelPay}/>}
    {sub==="cheque"&&<Cheque sh={sh} autoTag={autoTag} hasPerm={hasPerm} setWarnMsg={setWarnMsg} search={search} setSearch={setSearch}/>}

    {sub==="bank"&&<Bank sh={sh} autoTag={autoTag} search={search} setSearch={setSearch}/>}

    {sub==="billing"&&<Billing sh={sh} arList={arList} setViewBill={setViewBill} setViewSO={setViewSO} search={search} setSearch={setSearch} cN={cN} cnTot={cnTot}/>}

    {sub==="cn"&&<CN sh={sh} setViewSO={setViewSO} setViewBill={setViewBill} setSub={setSub} setWarnMsg={setWarnMsg} search={search} setSearch={setSearch} cN={cN} cnTot={cnTot}/>}

    {viewSO&&(()=>{const so=viewSO;const cust=contacts.find(c=>c.id===so.customerId);const bl=soBillMap[so.soNum];const payHist=payments.filter(p=>p.refId===so.soNum&&p.type==="ar");
      let dueDate=null,overdue=false;
      if(so.date){const days=so.payType==="credit"&&so.creditDays>0?so.creditDays:7;const d=new Date(so.date);d.setDate(d.getDate()+days);dueDate=d.toISOString().slice(0,10);overdue=so.remaining>0&&dueDate<todayStr();}
      const stLabel=so.paid===0?"รอชำระ":so.remaining<=0?"ชำระแล้ว":"บางส่วน";const stColor=so.paid===0?"var(--orange)":so.remaining<=0?"var(--green)":"var(--blue)";const stBg=so.paid===0?"rgba(255,149,0,0.14)":so.remaining<=0?"rgba(52,199,89,0.12)":"var(--blue-bg)";
      return<Modal title={"รายละเอียด SO — "+so.soNum} onClose={()=>setViewSO(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{so.soNum}</div>{so.legacyNum&&<div style={{fontSize:11,color:"var(--dim)",fontFamily:"monospace",marginTop:2}}>{so.legacyNum}</div>}</div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ลูกค้า</span><div style={{fontWeight:600}}>{cust?cN(cust):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(so.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เงื่อนไข</span><div>{so.payType==="credit"?<span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:"var(--blue-bg)",color:"var(--blue)",fontWeight:500}}>{"เครดิต "+so.creditDays+" วัน"}</span>:<span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>เงินสด 7 วัน</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ครบกำหนด</span><div>{dueDate?<span style={{fontWeight:500,color:overdue?"var(--red)":"var(--text)"}}>{toBE(dueDate)}{overdue&&<span style={{marginLeft:4,fontSize:10,background:"rgba(255,59,48,0.12)",color:"var(--red)",borderRadius:4,padding:"1px 6px"}}>เกินกำหนด</span>}</span>:<span style={{color:"var(--faint)"}}>—</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:stBg,color:stColor,fontWeight:500}}>{stLabel}</span></div></div>
        </div>

        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({(so.items||[]).length})</div>
        <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ราคา/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>{(so.items||[]).map((it,i)=>{const pr=products.find(p=>p.id===it.productId);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
            <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
            <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(it.price)}</td>
            <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*it.price)}</td>
          </tr>;})}</tbody></table>
        </div>

        {so.discountAmt>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 16px",fontSize:13,color:"var(--red)",marginBottom:4}}><span>ส่วนลด</span><span style={{fontWeight:600}}>{"- ฿"+fmt(so.discountAmt)}</span></div>}

        {bl&&<div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:14,fontSize:13}}>
          <span style={{color:"var(--dim)"}}>ใบวางบิล:</span> <span style={{color:"var(--blue)",fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setViewSO(null);setViewBill(bl);}}>{bl.billNum}</span>
          <span style={{marginLeft:8,fontSize:11,padding:"2px 8px",borderRadius:99,background:bl.status==="collected"?"rgba(52,199,89,0.12)":"rgba(255,149,0,0.14)",color:bl.status==="collected"?"var(--green)":"var(--orange)"}}>{bl.status==="collected"?"เก็บแล้ว":"รอเก็บเงิน"}</span>
        </div>}

        {payHist.length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ประวัติการชำระ ({payHist.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","รายละเอียด","จำนวน","หมายเหตุ",...(ed?[""]:[])]
              .map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i===3?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{payHist.map(p=>{const acc=p.method==="โอนเงิน"&&p.accId?bankAccs.find(a=>a.id===p.accId):null;const isCN=p.method==="หักลดหนี้";return<tr key={p.id} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{toBE(p.date)}</td>
              <td style={{padding:"6px 12px"}}>{p.method}</td>
              <td style={{padding:"6px 12px",fontSize:11,color:"var(--dim)"}}>{acc?acc.name+" — "+acc.bank:p.method==="เช็ค"&&p.chequeNo?"เช็ค #"+p.chequeNo+(p.chequeBank?" ("+p.chequeBank+")":""):"—"}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{p.note||"—"}</td>
              {ed&&<td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{!isCN&&<><button onClick={()=>{setViewSO(null);openEditPay(p,so.custName);}} style={{padding:"2px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",marginRight:4}}>แก้ไข</button>{cd&&<button onClick={()=>setConfirmDelPay({pay:p})} style={{padding:"2px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</>}</td>}
            </tr>;})}</tbody></table>
          </div>
        </>}

        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอดรวม</span><span style={{fontWeight:600}}>{"฿"+fmt(so.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ชำระแล้ว</span><span style={{fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(so.paid)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--line)"}}><span>ค้างชำระ</span><span style={{color:so.remaining>0?"var(--red)":"var(--green)"}}>{"฿"+fmt(Math.max(0,so.remaining))}</span></div>
        </div>
      </Modal>;
    })()}


    {modal==="addPay"&&ed&&<Modal title={(payForm.editId?"แก้ไขชำระ — ":sub==="ap"?"จ่าย — ":"รับ — ")+payForm.refId+" — "+(payForm.name||"")} onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="จำนวน (฿)"><input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="วิธี"><CustomSelect value={payForm.method} onChange={v=>setPayForm(f=>{const filt=bankAccs.filter(a=>v==="เงินสด"?a.isCash:!a.isCash);const stillValid=filt.some(a=>a.id===f.accId);return{...f,method:v,accId:stillValid?f.accId:(filt[0]?.id||0)};})} options={payForm.type==="ap"?["โอนเงินออก","เงินสด","จ่ายEPP"]:["โอนเงิน","เงินสด","เช็ค","บัตรเครดิต"]}/></Field>
        {payForm.type==="ap"&&(payForm.method==="โอนเงินออก"||payForm.method==="จ่ายEPP"||payForm.method==="เงินสด")&&<Field label={payForm.method==="เงินสด"?"จ่ายจากบัญชีเงินสด":payForm.method==="จ่ายEPP"?"จ่ายจากบัญชี":"โอนจากบัญชี"}><CustomSelect value={String(payForm.accId||"")} onChange={v=>setPayForm(f=>({...f,accId:+v}))} options={bankAccs.filter(a=>payForm.method==="เงินสด"?a.isCash:(!a.isCash&&hasPerm(a,payForm.method==="จ่ายEPP"?"payEPP":"transferOut"))).map(a=>({value:String(a.id),label:a.name+(a.isCash?"":" — "+a.bank)}))}/></Field>}
        {payForm.type==="ar"&&(payForm.method==="โอนเงิน"||payForm.method==="เงินสด")&&<Field label={payForm.method==="เงินสด"?"เข้าบัญชีเงินสด":"เข้าบัญชี"}><CustomSelect value={String(payForm.accId||"")} onChange={v=>setPayForm(f=>({...f,accId:+v}))} options={bankAccs.filter(a=>payForm.method==="เงินสด"?a.isCash:(!a.isCash&&hasPerm(a,"receive"))).map(a=>({value:String(a.id),label:a.name+(a.isCash?"":" — "+a.bank)}))}/></Field>}
        {payForm.type==="ar"&&payForm.method==="เช็ค"&&<>
          <Field label="เลขที่เช็ค *"><input value={payForm.chequeNo} onChange={e=>setPayForm(f=>({...f,chequeNo:e.target.value}))} style={IB} placeholder="เลขที่เช็ค"/></Field>
          <Field label="ธนาคาร"><CustomSelect value={payForm.chequeBank} onChange={v=>setPayForm(f=>({...f,chequeBank:v}))} options={BANK_OPTS}/></Field>
          <Field label="วันครบกำหนด"><ThaiDateInput value={payForm.chequeDue} onChange={e=>setPayForm(f=>({...f,chequeDue:e.target.value}))}/></Field>
        </>}
        <Field label="หมายเหตุ"><input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
      </div>
      <MBtns onCancel={cM} onSave={savePay}/>
    </Modal>}



    {viewBill&&(()=>{const b=viewBill;const cust=contacts.find(c=>c.id===b.customerId);
      const soDetails=(b.soNums||[]).map(soNum=>{const so=sales.find(s=>s.soNum===soNum);if(!so)return{soNum,items:[],total:0};const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);return{soNum,items:so.items,total:tot,date:so.date,payType:so.payType,creditDays:so.creditDays};});
      const cnDetails=(b.cnIds||[]).map(cnId=>{const cn=cnotes.find(c=>c.id===cnId);if(!cn)return null;const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];const tot=cnTot(cn);return{...cn,tp,tot};}).filter(Boolean);
      return<Modal title={"รายละเอียดใบวางบิล — "+b.billNum} onClose={()=>setViewBill(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{b.billNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ลูกค้า</span><div style={{fontWeight:600}}>{cust?cN(cust):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(b.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div>{b.status==="collected"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>เก็บแล้ว</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>รอเก็บเงิน</span>}</div></div>
          {b.note&&<div style={{gridColumn:"2/-1"}}><span style={{fontSize:11,color:"var(--dim)"}}>หมายเหตุ</span><div style={{fontSize:13}}>{b.note}</div></div>}
        </div>

        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการ SO ({soDetails.length})</div>
        <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          {soDetails.map((so,si)=><div key={si} style={{borderBottom:si<soDetails.length-1?"1px solid var(--line)":"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"var(--bg)"}}>
              <div><span style={{fontWeight:600,color:"var(--blue)",marginRight:8,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const orig=sales.find(s=>s.soNum===so.soNum);if(orig){const cust2=contacts.find(c=>c.id===orig.customerId);const tot2=orig.items.reduce((s2,i2)=>s2+i2.qty*i2.price,0)-(orig.discountAmt||0);const paid2=payments.filter(p=>p.refId===orig.soNum&&p.type==="ar").reduce((s2,p)=>s2+(+p.amount||0),0);setViewSO({...orig,custName:cust2?cN(cust2):"—",total:tot2,paid:paid2,remaining:tot2-paid2});setViewBill(null);}}}>{so.soNum}</span>{(()=>{const orig=sales.find(s=>s.soNum===so.soNum);return orig?.legacyNum?<span style={{fontSize:11,color:"var(--dim)",fontFamily:"monospace",marginRight:8}}>{"("+orig.legacyNum+")"}</span>:null;})()}<span style={{fontSize:11,color:"var(--dim)"}}>{so.date?toBE(so.date):""}</span>{so.payType==="credit"&&<span style={{marginLeft:8,fontSize:10,padding:"1px 6px",borderRadius:4,background:"var(--blue-bg)",color:"var(--blue)"}}>{"เครดิต "+so.creditDays+" วัน"}</span>}</div>
              <span style={{fontWeight:600}}>{"฿"+fmt(so.total)}</span>
            </div>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><tbody>
              {so.items.map((it,ii)=>{const pr=products.find(p=>p.id===it.productId);return<tr key={ii} style={{borderTop:"1px solid var(--line)"}}>
                <td style={{padding:"6px 12px",color:"var(--dim)",width:30}}>{ii+1}</td>
                <td style={{padding:"6px 4px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
                <td style={{padding:"6px 12px",textAlign:"right",color:"var(--dim)"}}>{it.qty+" ชิ้น"}</td>
                <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(it.price)}</td>
                <td style={{padding:"6px 12px",textAlign:"right",fontWeight:500}}>{"฿"+fmt(it.qty*it.price)}</td>
              </tr>;})}
            </tbody></table>
          </div>)}
        </div>

        {cnDetails.length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ใบลดหนี้ที่หัก ({cnDetails.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            {cnDetails.map((cn,ci)=><div key={ci} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:ci<cnDetails.length-1?"1px solid var(--line)":"none"}}>
              <div><span style={{fontWeight:600,color:"var(--blue)",marginRight:8}}>{cn.cnNum}</span><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:cn.tp.bg,color:cn.tp.color}}>{cn.tp.label}</span>{cn.reason&&<span style={{marginLeft:8,fontSize:11,color:"var(--dim)"}}>{cn.reason}</span>}</div>
              <span style={{fontWeight:600,color:"var(--red)"}}>{"- ฿"+fmt(cn.tot)}</span>
            </div>)}
          </div>
        </>}

        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอดรวม SO</span><span style={{fontWeight:600}}>{"฿"+fmt(b.soTotal)}</span></div>
          {b.cnTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>หัก CN</span><span style={{fontWeight:600,color:"var(--red)"}}>{"- ฿"+fmt(b.cnTotal)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--line)"}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(b.net)}</span></div>
        </div>
      </Modal>;
    })()}

    {confirmDelPay&&<Modal title="ยืนยันลบรายการชำระ" onClose={()=>setConfirmDelPay(null)}>
      <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>อ้างอิง</span><span style={{fontWeight:600,color:"var(--blue)"}}>{confirmDelPay.pay.refId}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>วิธีชำระ</span><span>{confirmDelPay.pay.method}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>วันที่</span><span>{toBE(confirmDelPay.pay.date)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid var(--line)",fontSize:15,fontWeight:700}}><span>จำนวน</span><span style={{color:"var(--red)"}}>{"฿"+fmt(confirmDelPay.pay.amount)}</span></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setConfirmDelPay(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--text)",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
        <button onClick={()=>{delPay(confirmDelPay.pay);setConfirmDelPay(null);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"var(--red)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยืนยันลบ</button>
      </div>
    </Modal>}

    {warnMsg&&<Modal title="แจ้งเตือน" onClose={()=>setWarnMsg(null)}>
      <div style={{background:"rgba(255,149,0,0.12)",border:"1px solid var(--orange)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:14,color:"var(--orange)",fontWeight:500}}>{warnMsg}</div>
      <button onClick={()=>setWarnMsg(null)} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:"var(--blue)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ตกลง</button>
    </Modal>}



    {sub==="supcn"&&<SupplierCN sh={sh}/>}
  </div>;
}

import { useState, useMemo } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, todayStr, toBE, shipmentTotals, findSOCombos, round2 } from "../../utils/helpers.js";
import { Modal, MBtns } from "../ui/Modal.jsx";
import StatCard from "../ui/StatCard.jsx";
import Field from "../ui/Field.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";
import ThaiDateInput from "../ui/ThaiDateInput.jsx";
import CustomerProfile from "../CustomerProfile.jsx";
import SupplierProfile from "../SupplierProfile.jsx";
import { BANK_OPTS, hasPerm } from "./constants.js";

// AR/AP (เก็บเงินลูกค้า + จ่ายซัพพลายเออร์) — combined sub-tab of Finance
// Extracted from Finance.jsx in 2026-06-08 as part of incremental Finance split (Strategy C, รอบ 6 สุดท้าย)
//
// AR + AP รวมไฟล์เดียว เพราะ:
// - UI block render ใช้ `(sub==="ap"||sub==="ar")` block เดียวกัน — table มี conditional rendering ตาม sub
// - savePay handler ใช้ payForm.type ("ar"|"ap") สลับ logic
//
// Shared modals (payForm/addPay/confirmDelPay/viewSO/viewBill/warnMsg) คงไว้ที่ parent เพราะ:
// - addPay เปิดจาก viewSO modal ที่อยู่ parent ด้วย (cross-tab from Billing/CN)
// - confirmDelPay เปิดจาก viewSO modal (parent) + viewPO/viewPayHist (ใน ARAP)
//
// Cross-tab deps (passed as props):
// - sub, setSub, arList, autoTag, cN
// - setViewSO, setViewBill, soBillMap (cross-tab modal/nav)
// - openPay, openEditPay (parent's payForm handlers)
// - setConfirmDelPay (trigger parent's modal)
// - search/setSearch (Finance-local)
export default function ARAP({sh, sub, setSub, arList, autoTag, cN, search, setSearch, setViewSO, setViewBill, soBillMap, openPay, openEditPay, setConfirmDelPay}){
  const{pN,contacts,setContacts,pos,sales,quotes,payments,setPayments,products,canE,canD,modal,oM,cM,bankAccs,setBankTxns,cnotes,billings,supCNotes,setSupCNotes,setCheques}=sh;
  const ed=canE("finance");const cd=canD("finance");

  // State (15 useState)
  const[fSt,setFSt]=useState("all");
  const[viewPO,setViewPO]=useState(null);
  const[viewProfile,setViewProfile]=useState(null);
  const[viewSupplier,setViewSupplier]=useState(null);
  const[viewPayHist,setViewPayHist]=useState(null);
  const[batchCust,setBatchCust]=useState("");
  const[batchSOs,setBatchSOs]=useState([]);
  const[batchLines,setBatchLines]=useState([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);
  const[recvAmount,setRecvAmount]=useState("");
  const[recvTol,setRecvTol]=useState("50");
  const[matchResults,setMatchResults]=useState([]);
  const[matchMsg,setMatchMsg]=useState("");
  const[bapSup,setBapSup]=useState("");const[bapPOs,setBapPOs]=useState([]);const[bapCNs,setBapCNs]=useState([]);
  const[bapMethod,setBapMethod]=useState("โอนเงินออก");const[bapAccId,setBapAccId]=useState(bankAccs[0]?.id||1);const[bapDate,setBapDate]=useState(todayStr());const[bapNote,setBapNote]=useState("");

  // apList — ARAP-only, compute internally
  // AP includes fully-received POs AND partially-shipped drop-ship POs. The
  // amount owed reflects the qty actually received (delivered shipments) × cost;
  // legacy received POs without `shipments` bill the full ordered qty as before.
  const apList=useMemo(()=>pos.filter(po=>po.status==="received"||po.status==="partial").map(po=>{const sup=contacts.find(c=>c.id===po.supplierId);const total=(po.shipments&&po.shipments.length)?shipmentTotals(po).reduce((s,r)=>{const line=po.items.find(i=>+i.productId===r.productId);return s+r.received*(line?line.cost:0);},0):po.items.reduce((s,i)=>s+i.qty*i.cost,0);const paid=payments.filter(p=>p.refId===po.poNum&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);const rem=total-paid;return{...po,supName:sup?cN(sup):"-",total,paid,cnDeduct:0,remaining:rem,status2:paid===0?"unpaid":rem<=0?"paid":"partial"};}).filter(po=>po.status==="received"||po.total>0),[pos,contacts,payments,cN]);

  const list=sub==="ap"?apList:arList;
  const filtered=list.filter(i=>fSt==="all"||i.status2===fSt).filter(i=>{if(!search)return true;const q=search.toLowerCase();return(i.soNum||i.poNum||"").toLowerCase().includes(q)||(i.custName||i.supName||"").toLowerCase().includes(q);}).sort((a,b)=>{if((a.overdue||false)!==(b.overdue||false))return a.overdue?-1:1;if(a.status2!==b.status2){const ord={unpaid:0,partial:1,cn_credit:2,paid:3};return(ord[a.status2]??9)-(ord[b.status2]??9);}return(b.date||"").localeCompare(a.date||"");});
  const totalUnpaid=filtered.filter(i=>i.status2!=="paid").reduce((s,i)=>s+Math.max(0,i.remaining),0);

  // batchPay (AR) derived
  const batchSOList=useMemo(()=>{if(!batchCust)return[];return arList.filter(so=>so.customerId===batchCust&&so.status2!=="paid");},[batchCust,arList]);
  const batchTotal=batchSOs.reduce((s,soNum)=>{const so=batchSOList.find(x=>x.soNum===soNum);return s+(so?Math.max(0,so.remaining):0);},0);
  const batchLineTotal=batchLines.reduce((s,l)=>s+(+l.amount||0),0);

  // batchAP (AP) derived
  const bapPOList=useMemo(()=>{if(!bapSup)return[];return apList.filter(po=>po.supplierId===+bapSup&&po.status2!=="paid");},[bapSup,apList]);
  const bapCNList=useMemo(()=>{if(!bapSup)return[];return(supCNotes||[]).filter(c=>c.supplierId===+bapSup&&!c.used);},[bapSup,supCNotes]);
  const bapPOTotal=bapPOs.reduce((s,poNum)=>{const po=bapPOList.find(x=>x.poNum===poNum);return s+(po?Math.max(0,po.remaining):0);},0);
  const bapCNTotal=bapCNs.reduce((s,id)=>{const cn=bapCNList.find(x=>x.id===id);return s+(cn?(Number(cn.amount)||0):0);},0);
  const bapNetTotal=Math.max(0,bapPOTotal-bapCNTotal);

  // Status badge helper
  const stB=s=>s==="paid"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>ชำระแล้ว</span>:s==="partial"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"var(--blue-bg)",color:"var(--blue)"}}>บางส่วน</span>:s==="cn_credit"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(175,82,222,0.12)",color:"var(--purple)"}}>หักCN</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>รอชำระ</span>;

  // batchPay (AR) handlers
  const openBatch=()=>{setBatchCust("");setBatchSOs([]);setBatchLines([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);setRecvAmount("");setRecvTol("50");setMatchResults([]);setMatchMsg("");oM("batchPay");};
  const toggleBatchSO=soNum=>setBatchSOs(prev=>prev.includes(soNum)?prev.filter(x=>x!==soNum):[...prev,soNum]);
  const applyCombo=combo=>{
    setBatchSOs(combo.soNums);
    const total=combo.soNums.reduce((s,n)=>{const so=batchSOList.find(x=>x.soNum===n);return s+(so?Math.max(0,so.remaining):0);},0);
    setBatchLines(p=>p.map((l,i)=>i===0?{...l,amount:String(round2(total))}:l));
    setMatchResults([]);setMatchMsg("");
  };
  const runMatch=()=>{
    const amt=+recvAmount;if(!amt||amt<=0){setMatchResults([]);setMatchMsg("");return;}
    const tol=Math.max(0,+recvTol||0);
    const target=Math.round(amt*100);const tolSat=Math.round(tol*100);
    const sos=batchSOList.map(so=>({soNum:so.soNum,remaining:Math.max(0,so.remaining),date:so.date}));
    const combos=findSOCombos(sos,target,tolSat);
    if(combos.length===1){applyCombo(combos[0]);}
    else if(combos.length>1){setMatchResults(combos);setMatchMsg("");}
    else{
      const near=findSOCombos(sos,target,Math.max(tolSat*10,10000));
      setMatchResults([]);
      setMatchMsg(near.length?("ไม่เจอชุดที่รวมได้พอดี — ชุดที่ใกล้สุด: "+near[0].soNums.join(", ")+" (฿"+fmt(near[0].sumSatang/100)+")"):"ไม่เจอชุดที่รวมได้ใกล้ยอดนี้");
    }
  };
  const addBatchLine=()=>setBatchLines(p=>[...p,{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);
  const updBatchLine=(idx,k,v)=>setBatchLines(p=>p.map((l,i)=>i===idx?{...l,[k]:v}:l));
  const rmBatchLine=idx=>setBatchLines(p=>p.filter((_,i)=>i!==idx));
  const saveBatch=()=>{
    if(batchSOs.length===0||batchLines.length===0)return;
    for(const ln of batchLines){if(!ln.amount||+ln.amount<=0)return;if(ln.method==="เช็ค"&&!ln.chequeNo)return;}
    const custObj=contacts.find(c=>c.id===batchCust);const custName=custObj?cN(custObj):"";
    let remain=batchLines.map(l=>+l.amount);
    const newPays=[];const newTxns=[];const newChqs=[];let ts=Date.now();
    for(const soNum of batchSOs){
      const so=batchSOList.find(x=>x.soNum===soNum);if(!so)continue;
      let soRem=Math.max(0,so.remaining);
      for(let li=0;li<batchLines.length&&soRem>0;li++){
        if(remain[li]<=0)continue;
        const alloc=Math.min(soRem,remain[li]);
        remain[li]-=alloc;soRem-=alloc;
        newPays.push({id:ts++,refId:soNum,type:"ar",amount:alloc,method:batchLines[li].method,date:batchLines[li].date,note:"รับชำระรวม",name:custName});
      }
    }
    for(const ln of batchLines){
      const amt=+ln.amount;
      if(ln.method==="โอนเงิน"&&ln.accId){const tag=autoTag("ar_batch");newTxns.push({id:ts++,accId:ln.accId,type:"in",amount:amt,date:ln.date,from:custName,refId:batchSOs.join(","),note:"รับชำระรวม",catId:tag.catId,subCatId:tag.subCatId,transferPair:null});}
      if(ln.method==="เช็ค"){newChqs.push({id:ts++,chequeNo:ln.chequeNo,bank:ln.chequeBank,amount:amt,date:ln.date,dueDate:ln.chequeDue,from:custName,refId:batchSOs.join(","),note:"รับชำระรวม",status:"pending"});}
    }
    setPayments(p=>[...p,...newPays]);
    if(newTxns.length)setBankTxns(p=>[...p,...newTxns]);
    if(newChqs.length)setCheques(p=>[...p,...newChqs]);
    cM();
  };

  // batchAP (AP) handlers
  const openBatchAP=()=>{setBapSup("");setBapPOs([]);setBapCNs([]);setBapMethod("โอนเงินออก");setBapAccId(bankAccs[0]?.id||1);setBapDate(todayStr());setBapNote("");oM("batchAP");};
  const toggleBapPO=poNum=>setBapPOs(p=>p.includes(poNum)?p.filter(x=>x!==poNum):[...p,poNum]);
  const toggleBapCN=id=>setBapCNs(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const saveBatchAP=()=>{
    if(bapPOs.length===0)return;
    const supObj=contacts.find(c=>c.id===+bapSup);const supName=supObj?cN(supObj):"";
    let ts=Date.now();const newPays=[];const refPOs=bapPOs.join(",");
    const cnNote=bapCNTotal>0?" (หัก CN ฿"+fmt(bapCNTotal)+")":"";
    for(const poNum of bapPOs){
      const po=bapPOList.find(x=>x.poNum===poNum);if(!po)continue;
      const rem=Math.max(0,po.remaining);
      if(rem>0)newPays.push({id:ts++,refId:poNum,type:"ap",amount:rem,method:bapMethod,date:bapDate,note:"จ่ายรวม"+cnNote,name:supName,accId:bapAccId});
    }
    setPayments(p=>[...p,...newPays]);
    if(bapNetTotal>0&&bapAccId){const tag=autoTag("ap_batch");setBankTxns(p=>[...p,{id:ts++,accId:bapAccId,type:"out",amount:bapNetTotal,date:bapDate,from:supName,refId:refPOs,note:(bapMethod==="จ่ายEPP"?"จ่ายEPP ":"จ่าย ")+"จ่ายรวม "+refPOs,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}
    if(bapCNs.length>0){setSupCNotes(p=>p.map(c=>bapCNs.includes(c.id)?{...c,used:true}:c));}
    cM();
  };

  return <>
    {/* AR/AP table block */}
    {(()=>{
      const paidCount=list.filter(i=>i.status2==="paid").length;
      const partialCount=list.filter(i=>i.status2==="partial").length;
      const unpaidCount=list.filter(i=>i.status2==="unpaid").length;
      const overdueCount=sub==="ar"?list.filter(i=>i.overdue).length:0;
      const totalPaid=list.filter(i=>i.status2==="paid").reduce((s,i)=>s+i.total,0);
      return<>
    <div className="stat-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <StatCard label="รายการทั้งหมด" value={list.length} sub={paidCount+" ชำระแล้ว"}/>
      <StatCard label="ชำระแล้ว" value={"฿"+fmt(totalPaid)} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
      {sub==="ar"?<StatCard label="เกินกำหนด" value={overdueCount} color={overdueCount>0?"var(--red)":"var(--green)"} accentBg={overdueCount>0?"rgba(255,59,48,0.12)":"rgba(52,199,89,0.12)"} sub={unpaidCount+" รอชำระ, "+partialCount+" บางส่วน"}/>:<StatCard label="รอชำระ / บางส่วน" value={unpaidCount+" / "+partialCount} color={unpaidCount>0?"var(--orange)":"var(--green)"} accentBg={unpaidCount>0?"rgba(255,149,0,0.14)":"rgba(52,199,89,0.12)"}/>}
      <StatCard label={sub==="ap"?"ค้างจ่ายรวม":"ค้างรับรวม"} value={"฿"+fmt(totalUnpaid)} color={totalUnpaid>0?"var(--red)":"var(--green)"} accentBg={totalUnpaid>0?"rgba(255,59,48,0.12)":"rgba(52,199,89,0.12)"}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["all","ทั้งหมด"],["unpaid","รอชำระ"],["partial","บางส่วน"],["cn_credit","หักCN"],["paid","ชำระแล้ว"]].map(v=><button key={v[0]} onClick={()=>setFSt(v[0])} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(fSt===v[0]?"var(--text)":"var(--line)"),background:fSt===v[0]?"var(--text)":"transparent",color:fSt===v[0]?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{v[1]}</button>)}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&sub==="ar"&&<button onClick={openBatch} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>รับชำระรวม</button>}{ed&&sub==="ap"&&<button onClick={openBatchAP} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>จ่ายรวม</button>}</div>
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{(sub==="ap"?["PO","ซัพพลายเออร์"]:["SO","ลูกค้า","เงื่อนไข","ครบกำหนด"]).concat(["ยอด","ชำระแล้ว"]).concat(sub==="ap"?["หักลดหนี้"]:[]).concat(["ค้าง","วิธีชำระ"]).concat(sub==="ar"?["วางบิล"]:[]).concat([""]).map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(it=>{const bl=sub==="ar"?soBillMap[it.soNum]:null;return<tr key={it.id} style={{borderBottom:"0.5px solid var(--line)",background:it.overdue?"rgba(255,59,48,0.06)":""}}>
      <td style={{padding:"8px",fontWeight:500,color:"var(--blue)"}}><div>{sub==="ap"?<span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewPO(it)}>{it.poNum}</span>:<span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewSO(it)}>{it.soNum}</span>}</div>{sub==="ar"&&it.legacyNum&&<div style={{fontSize:11,color:"var(--dim)",fontFamily:"monospace",marginTop:2,fontWeight:400}}>{it.legacyNum}</div>}</td>
      <td style={{padding:"8px"}}>{sub==="ap"?(()=>{const sup=contacts.find(x=>x.id===it.supplierId);return sup?<span onClick={()=>setViewSupplier(sup)} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{cursor:"pointer",color:"var(--blue)"}}>{it.supName}</span>:it.supName;})():(()=>{const c=contacts.find(x=>x.id===it.customerId);return c?<span onClick={()=>setViewProfile(c)} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{cursor:"pointer",color:"var(--blue)"}}>{it.custName}</span>:it.custName;})()}</td>
      {sub==="ar"&&<td style={{padding:"8px",fontSize:12}}>{it.payType==="credit"?<span style={{background:"var(--blue-bg)",color:"var(--blue)",borderRadius:4,padding:"2px 8px",fontSize:11}}>{"เครดิต "+it.creditDays+" วัน"}</span>:<span style={{background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:4,padding:"2px 8px",fontSize:11}}>เงินสด 7 วัน</span>}</td>}
      {sub==="ar"&&<td style={{padding:"8px",fontSize:12}}>{it.dueDate?(()=>{const days=it.overdue?Math.ceil((new Date(todayStr())-new Date(it.dueDate))/(1000*60*60*24)):0;const agColor=days>60?"#b00":days>30?"var(--red)":"var(--orange)";return<span style={{fontWeight:500,color:it.overdue?agColor:"var(--text)"}}>{toBE(it.dueDate)}{it.overdue&&<span style={{marginLeft:4,fontSize:10,background:days>30?"rgba(176,0,0,0.12)":"rgba(255,59,48,0.12)",color:agColor,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{"เกิน "+days+" วัน"}</span>}</span>;})():<span style={{color:"var(--faint)"}}>—</span>}</td>}
      <td style={{padding:"8px"}}>{"฿"+fmt(it.total)}</td><td style={{padding:"8px",color:"var(--green)"}}>{"฿"+fmt(it.paid)}</td>{sub==="ap"&&<td style={{padding:"8px",color:it.cnDeduct>0?"var(--orange)":"var(--faint)"}}>{it.cnDeduct>0?"฿"+fmt(it.cnDeduct):"-"}</td>}<td style={{padding:"8px",color:it.remaining>0?"var(--red)":"var(--green)",fontWeight:600}}>{"฿"+fmt(Math.max(0,it.remaining))}</td>
      <td style={{padding:"8px",minWidth:180}}>{(()=>{
        const refNum=sub==="ap"?it.poNum:it.soNum;
        const pays=payments.filter(p=>p.refId===refNum&&p.type===sub);
        if(pays.length===0&&(it.cnDeduct||0)===0)return <span style={{fontSize:11,color:"var(--faint)"}}>—</span>;
        const methodColor=m=>m==="เช็ค"?{c:"var(--purple)",b:"rgba(175,82,222,0.14)"}:m==="โอนเงิน"||m==="โอนเงินออก"?{c:"var(--blue)",b:"var(--blue-bg)"}:m==="เงินสด"?{c:"var(--green)",b:"rgba(52,199,89,0.12)"}:m==="หักลดหนี้"?{c:"var(--orange)",b:"rgba(255,149,0,0.14)"}:m==="จ่ายEPP"?{c:"var(--teal)",b:"rgba(90,200,250,0.14)"}:{c:"var(--dim)",b:"var(--hover)"};
        const detailOf=p=>{
          if(p.method==="เช็ค"&&p.chequeNo)return "#"+p.chequeNo+(p.chequeBank?" • "+p.chequeBank.replace(/\s*\([^)]*\)/,""):"");
          if((p.method==="โอนเงิน"||p.method==="โอนเงินออก"||p.method==="จ่ายEPP")&&p.accId){const a=bankAccs.find(x=>x.id===p.accId);return a?"→ "+a.name+(a.bank?" "+a.bank:""):"";}
          if(p.method==="หักลดหนี้"&&p.billId){const bl=billings.find(b=>b.id===p.billId);if(bl){const cnNums=(bl.cnIds||[]).map(id=>{const cn=cnotes.find(c=>c.id===id);return cn?cn.cnNum:null;}).filter(Boolean);return cnNums.length?"CN: "+cnNums.join(", "):"ใบ "+bl.billNum;}return "";}
          return "";
        };
        return <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {pays.map(p=>{const col=methodColor(p.method||"อื่นๆ");const det=detailOf(p);return <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,flexWrap:"wrap"}}>
            <span style={{padding:"1px 7px",borderRadius:99,background:col.b,color:col.c,fontWeight:500,whiteSpace:"nowrap"}}>{p.method||"อื่นๆ"}</span>
            <span style={{color:"var(--text)",fontVariantNumeric:"tabular-nums",fontWeight:500}}>{"฿"+fmt(+p.amount||0)}</span>
            {det&&<span style={{color:"var(--dim)",fontSize:10}}>{det}</span>}
          </div>;})}
          {sub==="ap"&&(it.cnDeduct||0)>0&&(()=>{const col=methodColor("หักลดหนี้");return <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><span style={{padding:"1px 7px",borderRadius:99,background:col.b,color:col.c,fontWeight:500,whiteSpace:"nowrap"}}>หักลดหนี้</span><span style={{color:"var(--text)",fontVariantNumeric:"tabular-nums",fontWeight:500}}>{"฿"+fmt(it.cnDeduct)}</span></div>;})()}
        </div>;
      })()}</td>
      {sub==="ar"&&<td style={{padding:"8px"}}>{bl?<span style={{fontSize:11,cursor:"pointer"}} onClick={()=>{setSub("billing");setViewBill(bl);}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>วางบิลแล้ว</span><span style={{marginLeft:4,color:"var(--blue)",fontWeight:500}}>{bl.billNum}</span></span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่วางบิล</span>}</td>}
      <td style={{padding:"8px",whiteSpace:"nowrap"}}><div style={{display:"flex",gap:4}}>{ed&&it.status2!=="paid"&&<button onClick={()=>openPay(it)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",fontFamily:"inherit"}}>{sub==="ap"?"+ จ่าย":"+ รับ"}</button>}{ed&&it.paid>0&&<button onClick={()=>setViewPayHist(it)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>ประวัติ</button>}</div></td>
    </tr>;})}</tbody></table></div>
    </>;
    })()}

    {/* viewPO modal */}
    {viewPO&&(()=>{const po=viewPO;const sup=contacts.find(c=>c.id===po.supplierId);const payHist=payments.filter(p=>p.refId===po.poNum&&p.type==="ap");
      return<Modal title={"รายละเอียด PO — "+po.poNum} onClose={()=>setViewPO(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{po.poNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ซัพพลายเออร์</span><div style={{fontWeight:600}}>{sup?cN(sup):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(po.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div>{stB(po.status2)}</div></div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({(po.items||[]).length})</div>
        <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ต้นทุน/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>{(po.items||[]).map((it,i)=>{const pr=products.find(p=>p.id===it.productId);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
            <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
            <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(it.cost)}</td>
            <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*it.cost)}</td>
          </tr>;})}</tbody></table>
        </div>
        {payHist.length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ประวัติการชำระ ({payHist.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","จำนวน","หมายเหตุ",...(ed?[""]:[])]
              .map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i===2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{payHist.map(p=><tr key={p.id} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{toBE(p.date)}</td>
              <td style={{padding:"6px 12px"}}>{p.method}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{p.note||"—"}</td>
              {ed&&<td style={{padding:"6px 8px",whiteSpace:"nowrap"}}><button onClick={()=>{setViewPO(null);openEditPay(p,po.supName);}} style={{padding:"2px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",marginRight:4}}>แก้ไข</button>{cd&&<button onClick={()=>setConfirmDelPay({pay:p})} style={{padding:"2px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</td>}
            </tr>)}</tbody></table>
          </div>
        </>}
        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอดรวม</span><span style={{fontWeight:600}}>{"฿"+fmt(po.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ชำระแล้ว</span><span style={{fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(po.paid)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--line)"}}><span>ค้างชำระ</span><span style={{color:po.remaining>0?"var(--red)":"var(--green)"}}>{"฿"+fmt(Math.max(0,po.remaining))}</span></div>
        </div>
      </Modal>;
    })()}

    {/* Contact profile modals */}
    {viewProfile&&<CustomerProfile customer={contacts.find(c=>c.id===viewProfile.id)||viewProfile} sales={sales} quotes={quotes} payments={payments} products={products} pN={pN} promos={sh.promos||[]} setContacts={setContacts} canEdit={canE("contacts")||canE("finance")} onClose={()=>setViewProfile(null)}/>}
    {viewSupplier&&<SupplierProfile supplier={viewSupplier} pos={pos} payments={payments} products={products} pN={pN} cN={cN} onClose={()=>setViewSupplier(null)}/>}

    {/* viewPayHist modal */}
    {viewPayHist&&<Modal title={"ประวัติชำระ — "+(viewPayHist.soNum||viewPayHist.poNum)} onClose={()=>setViewPayHist(null)}>
      {(()=>{const refId=viewPayHist.soNum||viewPayHist.poNum;const ty=viewPayHist.soNum?"ar":"ap";const pys=payments.filter(p=>p.refId===refId&&p.type===ty);const nameStr=viewPayHist.custName||viewPayHist.supName||"";return pys.length===0?<div style={{textAlign:"center",padding:"2rem",color:"var(--faint)"}}>ยังไม่มีรายการชำระ</div>:<div><div style={{fontSize:12,color:"var(--dim)",marginBottom:8}}>{"ยอดรวม ฿"+fmt(viewPayHist.total)+" — ชำระแล้ว ฿"+fmt(viewPayHist.paid)+" — ค้าง ฿"+fmt(Math.max(0,viewPayHist.remaining))}</div><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","จำนวน","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead><tbody>{pys.map(p=><tr key={p.id} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"8px"}}>{toBE(p.date)}</td><td style={{padding:"8px"}}>{p.method}</td><td style={{padding:"8px",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td><td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{p.note||"—"}</td><td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&<div style={{display:"flex",gap:4}}><button onClick={()=>{setViewPayHist(null);openEditPay(p,nameStr);}} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>{setViewPayHist(null);setConfirmDelPay({pay:p});}} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button></div>}</td></tr>)}</tbody></table></div>;})()}
    </Modal>}

    {/* batchPay modal (AR) */}
    {modal==="batchPay"&&ed&&<Modal title="รับชำระรวม" onClose={cM} wide>
      <div style={{marginBottom:14}}>
        <Field label="ลูกค้า"><CustomSelect searchable value={batchCust} onChange={v=>{setBatchCust(v);setBatchSOs([]);}} options={[{value:"",label:"— เลือกลูกค้า —"},...contacts.filter(c=>c.type==="customer").map(c=>({value:c.id,label:cN(c)}))]}/></Field>
      </div>
      {batchCust&&<>
        {/* auto-match by received amount */}
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:matchMsg||matchResults.length>1?8:14,flexWrap:"wrap"}}>
          <Field label="ยอดเงินที่ได้รับ"><input type="number" value={recvAmount} onChange={e=>setRecvAmount(e.target.value)} placeholder="ยอดที่ได้รับ" style={{...IB,width:160}}/></Field>
          <Field label="± บาท"><input type="number" value={recvTol} onChange={e=>setRecvTol(e.target.value)} style={{...IB,width:80}}/></Field>
          <button onClick={runMatch} disabled={!recvAmount} style={{padding:"7px 14px",fontSize:12,borderRadius:7,border:"none",background:recvAmount?"var(--blue)":"var(--line)",color:"#fff",cursor:recvAmount?"pointer":"default",fontFamily:"inherit",fontWeight:500}}>หา SO ที่ตรงยอด</button>
        </div>
        {matchMsg&&<div style={{fontSize:12,color:"var(--dim)",marginBottom:14}}>{matchMsg}</div>}
        {matchResults.length>1&&<div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",padding:"8px 12px",background:"var(--bg)"}}>{"เจอ "+matchResults.length+" ชุดที่เป็นไปได้ — เลือกชุด"}</div>
          {matchResults.map((combo,i)=><div key={i} onClick={()=>applyCombo(combo)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 12px",borderTop:"1px solid var(--line)",cursor:"pointer"}}>
            <span style={{fontSize:12}}>{combo.soNums.join(", ")}<span style={{color:"var(--dim)",marginLeft:6}}>{"("+combo.soNums.length+" ใบ)"}</span></span>
            <span style={{fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{"฿"+fmt(combo.sumSatang/100)}{combo.diffSatang!==0&&<span style={{fontSize:11,color:"var(--orange)",marginLeft:6}}>{(combo.diffSatang>0?"+":"")+fmt(combo.diffSatang/100)}</span>}</span>
          </div>)}
        </div>}
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>SO ค้างชำระ</div>
        {batchSOList.length===0?<div style={{padding:"12px",fontSize:13,color:"var(--faint)",background:"var(--bg)",borderRadius:8,marginBottom:14}}>ไม่มี SO ค้างชำระ</div>:
        <div style={{maxHeight:180,overflowY:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:14}}>
          {batchSOList.map(so=><label key={so.soNum} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:"1px solid var(--line)",cursor:"pointer",background:batchSOs.includes(so.soNum)?"var(--blue-bg)":"transparent"}}>
            <input type="checkbox" checked={batchSOs.includes(so.soNum)} onChange={()=>toggleBatchSO(so.soNum)}/>
            <span style={{fontWeight:500,color:"var(--blue)",minWidth:70}}>{so.soNum}</span>
            <span style={{flex:1,fontSize:12,color:"var(--dim)"}}>{so.custName}</span>
            <span style={{fontWeight:600,color:"var(--red)"}}>{"฿"+fmt(Math.max(0,so.remaining))}</span>
          </label>)}
        </div>}
        {batchSOs.length>0&&<div style={{fontSize:13,fontWeight:600,marginBottom:12,color:"var(--text)"}}>{"ยอดรวมที่เลือก: ฿"+fmt(batchTotal)}</div>}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>รายการชำระ</div>
          <button onClick={addBatchLine} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>+ เพิ่มรายการ</button>
        </div>
        {batchLines.map((ln,i)=><div key={i} style={{padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>{"#"+(i+1)}</span>
            {batchLines.length>1&&<button onClick={()=>rmBatchLine(i)} style={{fontSize:11,color:"var(--red)",background:"none",border:"none",cursor:"pointer"}}>ลบ</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="วิธี"><CustomSelect value={ln.method} onChange={v=>updBatchLine(i,"method",v)} options={["โอนเงิน","เงินสด","เช็ค","บัตรเครดิต"]}/></Field>
            <Field label="จำนวน (฿)"><input type="number" value={ln.amount} onChange={e=>updBatchLine(i,"amount",e.target.value)} style={IB}/></Field>
            <Field label="วันที่"><ThaiDateInput value={ln.date} onChange={e=>updBatchLine(i,"date",e.target.value)}/></Field>
            {ln.method==="โอนเงิน"&&<Field label="เข้าบัญชี"><CustomSelect value={String(ln.accId||"")} onChange={v=>updBatchLine(i,"accId",+v)} options={bankAccs.filter(a=>hasPerm(a,"receive")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>}
            {ln.method==="เช็ค"&&<>
              <Field label="เลขที่เช็ค *"><input value={ln.chequeNo} onChange={e=>updBatchLine(i,"chequeNo",e.target.value)} style={IB}/></Field>
              <Field label="ธนาคาร"><CustomSelect value={ln.chequeBank} onChange={v=>updBatchLine(i,"chequeBank",v)} options={BANK_OPTS}/></Field>
              <Field label="วันครบกำหนด"><ThaiDateInput value={ln.chequeDue} onChange={e=>updBatchLine(i,"chequeDue",e.target.value)}/></Field>
            </>}
          </div>
        </div>)}
        <div style={{fontSize:13,fontWeight:600,marginTop:8,marginBottom:4,color:Math.abs(batchLineTotal-batchTotal)<0.01?"var(--green)":"var(--orange)"}}>{"ยอดชำระรวม: ฿"+fmt(batchLineTotal)}{Math.abs(batchLineTotal-batchTotal)>=0.01&&<span style={{fontSize:11,fontWeight:400,marginLeft:8,color:"var(--orange)"}}>{"(ค้าง ฿"+fmt(batchTotal)+")"}</span>}</div>
      </>}
      <MBtns onCancel={cM} onSave={saveBatch} saveLabel="บันทึก"/>
    </Modal>}

    {/* batchAP modal (AP) */}
    {modal==="batchAP"&&ed&&(()=>{
      const suppliers=contacts.filter(c=>c.type==="supplier");
      const supObj=bapSup?contacts.find(c=>c.id===+bapSup):null;
      const supCredit=supObj?.creditDays||0;
      const daysLeft=(po)=>{if(!supCredit||!po.date)return null;const d=new Date(po.date);d.setDate(d.getDate()+supCredit);const diff=Math.ceil((d-new Date())/(1000*60*60*24));return diff;};
      return<Modal title="จ่ายรวมซัพพลายเออร์" onClose={cM} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <Field label="ซัพพลายเออร์"><CustomSelect searchable value={bapSup} onChange={v=>{setBapSup(v);setBapPOs([]);setBapCNs([]);}} options={[{value:"",label:"— เลือก —"},...suppliers.map(s=>({value:String(s.id),label:cN(s)+(s.creditDays?" ("+s.creditDays+" วัน)":"")}))]}/></Field>
          {supObj&&<div style={{fontSize:12,color:"var(--dim)",alignSelf:"end",paddingBottom:8}}>{"เครดิต: "+(supCredit?supCredit+" วัน":"ไม่ระบุ")}</div>}
        </div>
        {bapSup&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>PO ค้างชำระ ({bapPOList.length})</div>
          {bapPOList.length===0?<div style={{padding:"12px",fontSize:13,color:"var(--faint)",background:"var(--bg)",borderRadius:8,marginBottom:14}}>ไม่มี PO ค้างชำระ</div>:
          <div style={{maxHeight:220,overflowY:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:14}}>
            {bapPOList.map(po=>{const dl=daysLeft(po);const overdue=dl!==null&&dl<0;return<label key={po.poNum} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:"1px solid var(--line)",cursor:"pointer",background:bapPOs.includes(po.poNum)?"var(--blue-bg)":"transparent"}}>
              <input type="checkbox" checked={bapPOs.includes(po.poNum)} onChange={()=>toggleBapPO(po.poNum)}/>
              <span style={{fontWeight:500,color:"var(--blue)",minWidth:90}}>{po.poNum}</span>
              <span style={{flex:1,fontSize:12,color:"var(--dim)"}}>{toBE(po.date)}</span>
              {dl!==null&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:6,fontWeight:600,background:overdue?"rgba(255,59,48,0.12)":"rgba(52,199,89,0.12)",color:overdue?"var(--red)":"var(--green)"}}>{overdue?"เกิน "+Math.abs(dl)+" วัน":"อีก "+dl+" วัน"}</span>}
              <span style={{fontWeight:600,color:"var(--red)",minWidth:80,textAlign:"right"}}>{"฿"+fmt(Math.max(0,po.remaining))}</span>
            </label>;})}
          </div>}

          {bapCNList.length>0&&<>
            <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ใบลดหนี้ที่หักได้ ({bapCNList.length})</div>
            <div style={{maxHeight:150,overflowY:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:14}}>
              {bapCNList.map(cn=><label key={cn.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:"1px solid var(--line)",cursor:"pointer",background:bapCNs.includes(cn.id)?"rgba(175,82,222,0.08)":"transparent"}}>
                <input type="checkbox" checked={bapCNs.includes(cn.id)} onChange={()=>toggleBapCN(cn.id)}/>
                <span style={{fontWeight:500,color:"var(--purple)",minWidth:80}}>{cn.scnNum}</span>
                <span style={{flex:1,fontSize:12,color:"var(--dim)"}}>{cn.refNo||cn.reason||"-"}</span>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:cn.recognized?"rgba(52,199,89,0.12)":"rgba(255,149,0,0.12)",color:cn.recognized?"var(--green)":"var(--orange)"}}>{cn.recognized?"รับรู้แล้ว":"ยังไม่รับรู้"}</span>
                <span style={{fontWeight:600,color:"var(--green)",minWidth:70,textAlign:"right"}}>{"฿"+fmt(cn.amount)}</span>
              </label>)}
            </div>
          </>}

          {bapPOs.length>0&&<div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอด PO ที่เลือก</span><span style={{fontWeight:600}}>{"฿"+fmt(bapPOTotal)}</span></div>
            {bapCNTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--purple)"}}>หัก CN</span><span style={{fontWeight:600,color:"var(--purple)"}}>{"- ฿"+fmt(bapCNTotal)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,borderTop:"1px solid var(--line)",paddingTop:6,marginTop:4}}><span>ยอดจ่ายจริง</span><span style={{color:"var(--blue)"}}>{"฿"+fmt(bapNetTotal)}</span></div>
          </div>}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
            <Field label="วิธีจ่าย"><CustomSelect value={bapMethod} onChange={v=>setBapMethod(v)} options={[{value:"โอนเงินออก",label:"โอนเงินออก"},{value:"จ่ายEPP",label:"จ่ายEPP"}]}/></Field>
            <Field label={bapMethod==="จ่ายEPP"?"จ่ายจากบัญชี":"โอนจากบัญชี"}><CustomSelect value={String(bapAccId||"")} onChange={v=>setBapAccId(+v)} options={bankAccs.filter(a=>hasPerm(a,bapMethod==="จ่ายEPP"?"payEPP":"transferOut")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>
            <Field label="วันที่"><ThaiDateInput value={bapDate} onChange={v=>setBapDate(v)}/></Field>
            <Field label="หมายเหตุ"><input value={bapNote} onChange={e=>setBapNote(e.target.value)} style={IB}/></Field>
          </div>
        </>}
        <MBtns onCancel={cM} onSave={saveBatchAP} saveLabel="จ่ายรวม"/>
      </Modal>;
    })()}
  </>;
}

import React, { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE, round2 } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import StatCard from "./ui/StatCard.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import CustomerProfile from "./CustomerProfile.jsx";
import SupplierProfile from "./SupplierProfile.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import SupplierCN from "./Finance/SupplierCN.jsx";
import Cheque from "./Finance/Cheque.jsx";
import Billing from "./Finance/Billing.jsx";
import CN from "./Finance/CN.jsx";
import Bank from "./Finance/Bank.jsx";
import { BANK_OPTS, CN_TYPES, hasPerm } from "./Finance/constants.js";

const TB={padding:"10px 20px",fontSize:13,border:"none",marginBottom:"-2px",background:"transparent",cursor:"pointer",fontFamily:"inherit"};

export default function FinPage({sh}){
  const{cN,pN,contacts,setContacts,pos,sales,quotes,payments,setPayments,products,canE,canD,modal,oM,cM,setCheques,bankAccs,setBankTxns,cnotes,billings,supCNotes,setSupCNotes,tagMappings}=sh;
  const ed=canE("finance");const cd=canD("finance");
  const[sub,setSub]=useState("ap");const[viewProfile,setViewProfile]=useState(null);
  const[payForm,setPayForm]=useState({refId:"",type:"",amount:"",method:"โอนเงิน",date:todayStr(),note:""});
  const[fSt,setFSt]=useState("all");
  const[batchCust,setBatchCust]=useState("");
  const[batchSOs,setBatchSOs]=useState([]);
  const[batchLines,setBatchLines]=useState([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);
  const[viewSO,setViewSO]=useState(null);
  const[viewPO,setViewPO]=useState(null);const[confirmDelPay,setConfirmDelPay]=useState(null);const[search,setSearch]=useState("");const[viewSupplier,setViewSupplier]=useState(null);const[viewPayHist,setViewPayHist]=useState(null);const[warnMsg,setWarnMsg]=useState(null);
  const[bapSup,setBapSup]=useState("");const[bapPOs,setBapPOs]=useState([]);const[bapCNs,setBapCNs]=useState([]);
  const[bapMethod,setBapMethod]=useState("โอนเงินออก");const[bapAccId,setBapAccId]=useState(bankAccs[0]?.id||1);const[bapDate,setBapDate]=useState(todayStr());const[bapNote,setBapNote]=useState("");

  const autoTag=(key)=>{const m=tagMappings.find(x=>x.key===key);return m?{catId:m.catId,subCatId:m.subCatId}:{catId:null,subCatId:null};};

  const cnTot=cn=>{if(cn.type==="promo")return +cn.amount||0;const items=cn.items||[];if(cn.type!=="defective"&&cn.soNum){const so=sales.find(s=>s.soNum===cn.soNum);if(so&&so.discountAmt>0){const sub=(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const r=sub>0?(sub-so.discountAmt)/sub:1;const raw=items.reduce((s,it)=>{const si=(so.items||[]).find(x=>x.productId===it.productId);return s+it.qty*(si?si.price*r:it.price);},0);return round2(raw);}}return items.reduce((s,i)=>s+i.qty*i.price,0);};

  const apList=useMemo(()=>pos.filter(po=>po.status==="received").map(po=>{const sup=contacts.find(c=>c.id===po.supplierId);const total=po.items.reduce((s,i)=>s+i.qty*i.cost,0);const paid=payments.filter(p=>p.refId===po.poNum&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);const rem=total-paid;return{...po,supName:sup?cN(sup):"-",total,paid,cnDeduct:0,remaining:rem,status2:paid===0?"unpaid":rem<=0?"paid":"partial"};}),[pos,contacts,payments]);
  const arList=useMemo(()=>sales.filter(so=>so.status==="completed").map(so=>{const cust=contacts.find(c=>c.id===so.customerId);const soPays=payments.filter(p=>p.refId===so.soNum&&p.type==="ar");const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const paid=soPays.reduce((s,p)=>s+(+p.amount||0),0);const rem=tot-paid;
    let dueDate=null,overdue=false;
    if(so.date){const days=so.payType==="credit"&&so.creditDays>0?so.creditDays:7;const d=new Date(so.date);d.setDate(d.getDate()+days);dueDate=d.toISOString().slice(0,10);overdue=rem>0&&dueDate<todayStr();}
    const st2=paid===0?"unpaid":rem<=0?"paid":soPays.length>0&&soPays.every(p=>p.method==="หักลดหนี้")?"cn_credit":"partial";
    return{...so,custName:cust?cN(cust):"-",total:tot,paid,remaining:rem,status2:st2,dueDate,overdue};}),[sales,contacts,payments]);
  const list=sub==="ap"?apList:arList;const filtered=list.filter(i=>fSt==="all"||i.status2===fSt).filter(i=>{if(!search)return true;const q=search.toLowerCase();return(i.soNum||i.poNum||"").toLowerCase().includes(q)||(i.custName||i.supName||"").toLowerCase().includes(q);}).sort((a,b)=>{if((a.overdue||false)!==(b.overdue||false))return a.overdue?-1:1;if(a.status2!==b.status2){const ord={unpaid:0,partial:1,cn_credit:2,paid:3};return(ord[a.status2]??9)-(ord[b.status2]??9);}return(b.date||"").localeCompare(a.date||"");});
  const totalUnpaid=filtered.filter(i=>i.status2!=="paid").reduce((s,i)=>s+Math.max(0,i.remaining),0);
  const openPay=item=>{setPayForm({refId:sub==="ap"?item.poNum:item.soNum,type:sub,amount:Math.max(0,item.remaining).toFixed(2),method:sub==="ap"?"โอนเงินออก":"โอนเงิน",date:todayStr(),note:"",name:sub==="ap"?item.supName:item.custName,accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:""});oM("addPay");};
  const openEditPay=(p,nameStr)=>{setPayForm({editId:p.id,refId:p.refId,type:p.type,amount:String(p.amount),method:p.method,date:p.date,note:p.note||"",name:nameStr||"",accId:p.accId||bankAccs[0]?.id||1,chequeNo:p.chequeNo||"",chequeBank:p.chequeBank||"",chequeDue:p.chequeDue||""});oM("addPay");};
  const delPay=(p)=>{const wantType=p.type==="ar"?"in":"out";setPayments(prev=>prev.filter(x=>x.id!==p.id));setBankTxns(prev=>prev.filter(t=>!(t.refId===p.refId&&Math.abs(t.amount-p.amount)<0.01&&t.date===p.date&&t.type===wantType)));if(p.method==="เช็ค"&&p.chequeNo)setCheques(prev=>prev.filter(c=>!(c.chequeNo===p.chequeNo&&c.refId===p.refId)));};
  const savePay=()=>{if(!payForm.amount||+payForm.amount<=0)return;const amt=+payForm.amount;if(isNaN(amt)||amt<=0)return;if(payForm.method==="เช็ค"&&payForm.type==="ar"&&!payForm.chequeNo)return;
    const target=(payForm.type==="ap"?apList:arList).find(x=>(payForm.type==="ap"?x.poNum:x.soNum)===payForm.refId);
    if(target){let allowed=Math.max(0,target.remaining);if(payForm.editId){const oldP=payments.find(x=>x.id===payForm.editId);if(oldP)allowed+=(+oldP.amount||0);}if(amt>allowed+0.01){setWarnMsg("ยอดชำระเกินยอดคงค้าง (เหลือ ฿"+fmt(allowed)+")");return;}}
    const isApBank=payForm.type==="ap"&&payForm.method==="โอนเงินออก"&&payForm.accId;
    const isApEpp=payForm.type==="ap"&&payForm.method==="จ่ายEPP"&&payForm.accId;
    const isArBank=payForm.type==="ar"&&payForm.method==="โอนเงิน"&&payForm.accId;
    const isApCash=payForm.type==="ap"&&payForm.method==="เงินสด"&&payForm.accId;
    const isArCash=payForm.type==="ar"&&payForm.method==="เงินสด"&&payForm.accId;
    if(payForm.editId){const old=payments.find(x=>x.id===payForm.editId);setPayments(p=>p.map(x=>x.id===payForm.editId?{...x,amount:amt,method:payForm.method,date:payForm.date,note:payForm.note,accId:payForm.accId,chequeNo:payForm.chequeNo,chequeBank:payForm.chequeBank,chequeDue:payForm.chequeDue}:x));if(old){setBankTxns(prev=>prev.filter(t=>!(t.refId===old.refId&&Math.abs(t.amount-old.amount)<0.01&&t.date===old.date)));if(old.method==="เช็ค"&&old.chequeNo)setCheques(prev=>prev.filter(c=>!(c.chequeNo===old.chequeNo&&c.refId===old.refId)));}if(isArBank){const tag=autoTag("ar_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApBank){const tag=autoTag("ap_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่าย "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApEpp){const tag=autoTag("ap_epp");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายEPP "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isArCash){const tag=autoTag("ar_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApCash){const tag=autoTag("ap_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(payForm.method==="เช็ค"&&payForm.type==="ar"){setCheques(p=>[...p,{id:Date.now()+2,chequeNo:payForm.chequeNo,bank:payForm.chequeBank,amount:amt,date:payForm.date,dueDate:payForm.chequeDue,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,status:"pending"}]);}
    }else{setPayments(p=>[...p,{id:Date.now(),...payForm,amount:amt}]);if(isArBank){const tag=autoTag("ar_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApBank){const tag=autoTag("ap_bank");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่าย "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApEpp){const tag=autoTag("ap_epp");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายEPP "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isArCash){const tag=autoTag("ar_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(isApCash){const tag=autoTag("ap_cash");setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"จ่ายเงินสด "+payForm.refId,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}if(payForm.method==="เช็ค"&&payForm.type==="ar"){setCheques(p=>[...p,{id:Date.now()+2,chequeNo:payForm.chequeNo,bank:payForm.chequeBank,amount:amt,date:payForm.date,dueDate:payForm.chequeDue,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,status:"pending"}]);}}cM();};

  const openBatch=()=>{setBatchCust("");setBatchSOs([]);setBatchLines([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);oM("batchPay");};
  const batchSOList=useMemo(()=>{if(!batchCust)return[];return arList.filter(so=>so.customerId===batchCust&&so.status2!=="paid");},[batchCust,arList]);
  const batchTotal=batchSOs.reduce((s,soNum)=>{const so=batchSOList.find(x=>x.soNum===soNum);return s+(so?Math.max(0,so.remaining):0);},0);
  const batchLineTotal=batchLines.reduce((s,l)=>s+(+l.amount||0),0);
  const toggleBatchSO=soNum=>setBatchSOs(prev=>prev.includes(soNum)?prev.filter(x=>x!==soNum):[...prev,soNum]);
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

  const openBatchAP=()=>{setBapSup("");setBapPOs([]);setBapCNs([]);setBapMethod("โอนเงินออก");setBapAccId(bankAccs[0]?.id||1);setBapDate(todayStr());setBapNote("");oM("batchAP");};
  const bapPOList=useMemo(()=>{if(!bapSup)return[];return apList.filter(po=>po.supplierId===+bapSup&&po.status2!=="paid");},[bapSup,apList]);
  const bapCNList=useMemo(()=>{if(!bapSup)return[];return(supCNotes||[]).filter(c=>c.supplierId===+bapSup&&!c.used);},[bapSup,supCNotes]);
  const bapPOTotal=bapPOs.reduce((s,poNum)=>{const po=bapPOList.find(x=>x.poNum===poNum);return s+(po?Math.max(0,po.remaining):0);},0);
  const bapCNTotal=bapCNs.reduce((s,id)=>{const cn=bapCNList.find(x=>x.id===id);return s+(cn?(Number(cn.amount)||0):0);},0);
  const bapNetTotal=Math.max(0,bapPOTotal-bapCNTotal);
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

  const stB=s=>s==="paid"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>ชำระแล้ว</span>:s==="partial"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"var(--blue-bg)",color:"var(--blue)"}}>บางส่วน</span>:s==="cn_credit"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(175,82,222,0.12)",color:"var(--purple)"}}>หักCN</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>รอชำระ</span>;



  const[viewBill,setViewBill]=useState(null);
  const soBillMap=useMemo(()=>{const m={};for(const b of billings)for(const sn of(b.soNums||[]))m[sn]=b;return m;},[billings]);

  const TAB_GROUPS=[[["ap","จ่ายซัพพลายเออร์"],["supcn","ใบลดหนี้ (ซัพฯ)"]],[["ar","เก็บเงินลูกค้า"],["billing","ใบวางบิล"],["cn","ใบลดหนี้"]],[["cheque","เช็ค"],["bank","บัญชี"]]];

  return <div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--line)",overflowX:"auto"}}>{TAB_GROUPS.map((grp,gi)=><React.Fragment key={gi}>{gi>0&&<span style={{borderLeft:"1.5px solid var(--line)",margin:"6px 4px",alignSelf:"stretch"}}/>}{grp.map(v=><button key={v[0]} onClick={()=>{setSub(v[0]);setFSt("all");setSearch("");}} style={{...TB,fontWeight:sub===v[0]?600:400,borderBottom:sub===v[0]?"2px solid var(--text)":"2px solid transparent",color:sub===v[0]?"var(--text)":"var(--dim)"}}>{v[1]}</button>)}</React.Fragment>)}</div>

    {(sub==="ap"||sub==="ar")&&(()=>{
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
    </>;})()}

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

    {viewProfile&&<CustomerProfile customer={contacts.find(c=>c.id===viewProfile.id)||viewProfile} sales={sales} quotes={quotes} payments={payments} products={products} pN={pN} promos={sh.promos||[]} setContacts={setContacts} canEdit={canE("contacts")||canE("finance")} onClose={()=>setViewProfile(null)}/>}
    {viewSupplier&&<SupplierProfile supplier={viewSupplier} pos={pos} payments={payments} products={products} pN={pN} cN={cN} onClose={()=>setViewSupplier(null)}/>}

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

    {modal==="batchPay"&&ed&&<Modal title="รับชำระรวม" onClose={cM} wide>
      <div style={{marginBottom:14}}>
        <Field label="ลูกค้า"><CustomSelect searchable value={batchCust} onChange={v=>{setBatchCust(v);setBatchSOs([]);}} options={[{value:"",label:"— เลือกลูกค้า —"},...contacts.filter(c=>c.type==="customer").map(c=>({value:c.id,label:cN(c)}))]}/></Field>
      </div>
      {batchCust&&<>
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
              {bapCNList.map(cn=>{const sup2=contacts.find(c=>c.id===cn.supplierId);return<label key={cn.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:"1px solid var(--line)",cursor:"pointer",background:bapCNs.includes(cn.id)?"rgba(175,82,222,0.08)":"transparent"}}>
                <input type="checkbox" checked={bapCNs.includes(cn.id)} onChange={()=>toggleBapCN(cn.id)}/>
                <span style={{fontWeight:500,color:"var(--purple)",minWidth:80}}>{cn.scnNum}</span>
                <span style={{flex:1,fontSize:12,color:"var(--dim)"}}>{cn.refNo||cn.reason||"-"}</span>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:cn.recognized?"rgba(52,199,89,0.12)":"rgba(255,149,0,0.12)",color:cn.recognized?"var(--green)":"var(--orange)"}}>{cn.recognized?"รับรู้แล้ว":"ยังไม่รับรู้"}</span>
                <span style={{fontWeight:600,color:"var(--green)",minWidth:70,textAlign:"right"}}>{"฿"+fmt(cn.amount)}</span>
              </label>;})}
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

    {viewPayHist&&<Modal title={"ประวัติชำระ — "+(viewPayHist.soNum||viewPayHist.poNum)} onClose={()=>setViewPayHist(null)}>
      {(()=>{const refId=viewPayHist.soNum||viewPayHist.poNum;const ty=viewPayHist.soNum?"ar":"ap";const pys=payments.filter(p=>p.refId===refId&&p.type===ty);const nameStr=viewPayHist.custName||viewPayHist.supName||"";return pys.length===0?<div style={{textAlign:"center",padding:"2rem",color:"var(--faint)"}}>ยังไม่มีรายการชำระ</div>:<div><div style={{fontSize:12,color:"var(--dim)",marginBottom:8}}>{"ยอดรวม ฿"+fmt(viewPayHist.total)+" — ชำระแล้ว ฿"+fmt(viewPayHist.paid)+" — ค้าง ฿"+fmt(Math.max(0,viewPayHist.remaining))}</div><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","จำนวน","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead><tbody>{pys.map(p=><tr key={p.id} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"8px"}}>{toBE(p.date)}</td><td style={{padding:"8px"}}>{p.method}</td><td style={{padding:"8px",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td><td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{p.note||"—"}</td><td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&<div style={{display:"flex",gap:4}}><button onClick={()=>{setViewPayHist(null);openEditPay(p,nameStr);}} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>{setViewPayHist(null);setConfirmDelPay({pay:p});}} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button></div>}</td></tr>)}</tbody></table></div>;})()}
    </Modal>}


    {sub==="supcn"&&<SupplierCN sh={sh}/>}
  </div>;
}

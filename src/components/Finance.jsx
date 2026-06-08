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
import { BANK_OPTS, CN_TYPES } from "./Finance/constants.js";

const TB={padding:"10px 20px",fontSize:13,border:"none",marginBottom:"-2px",background:"transparent",cursor:"pointer",fontFamily:"inherit"};
const DEF_PERMS={receive:true,clearCheque:true,payEPP:true,transferOut:true};
const hasPerm=(acc,key)=>{const p=acc.perms;if(!p)return true;if(key==="payEPP")return p.payEPP!==undefined?!!p.payEPP:p.payOnline!==undefined?!!p.payOnline:true;if(key==="transferOut")return p.transferOut!==undefined?!!p.transferOut:true;return p[key]!==undefined?!!p[key]:true;};

export default function FinPage({sh}){
  const{cN,pN,contacts,setContacts,pos,sales,quotes,payments,setPayments,products,canE,canD,modal,oM,cM,setCheques,bankAccs,setBankAccs,bankTxns,setBankTxns,cnotes,billings,supCNotes,setSupCNotes,cashCats,setCashCats,tagMappings,setTagMappings}=sh;
  const ed=canE("finance");const cd=canD("finance");
  const[sub,setSub]=useState("ap");const[viewProfile,setViewProfile]=useState(null);
  const[payForm,setPayForm]=useState({refId:"",type:"",amount:"",method:"โอนเงิน",date:todayStr(),note:""});
  const[fSt,setFSt]=useState("all");
  const[txnForm,setTxnForm]=useState({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:"",catId:"",subCatId:""});
  const[accFilter,setAccFilter]=useState("all");
  const[accForm,setAccForm]=useState({name:"",bank:"",accNo:"",perms:{...DEF_PERMS}});
  const[editAcc,setEditAcc]=useState(null);const[delAcc,setDelAcc]=useState(null);
  const[acctType,setAcctType]=useState(null);
  const[cashAcctForm,setCashAcctForm]=useState({name:"",openingBalance:"",openingDate:todayStr()});
  const[selCatId,setSelCatId]=useState(null);
  const[newCatName,setNewCatName]=useState("");
  const[newCatType,setNewCatType]=useState("both");
  const[newSubName,setNewSubName]=useState({});
  const[catUsageWarn,setCatUsageWarn]=useState(null);
  const[editingCatId,setEditingCatId]=useState(null);
  const[editCatName,setEditCatName]=useState("");
  const[editCatType,setEditCatType]=useState("both");
  const[editingSubId,setEditingSubId]=useState(null);
  const[editSubName,setEditSubName]=useState("");
  const[tfForm,setTfForm]=useState({fromAccId:"",toAccId:"",amount:"",date:todayStr(),note:""});
  const[adjForm,setAdjForm]=useState({accId:null,actualBalance:"",date:todayStr(),note:""});
  const[wdForm,setWdForm]=useState({accId:"",amount:"",date:todayStr(),note:""});
  const[batchCust,setBatchCust]=useState("");
  const[batchSOs,setBatchSOs]=useState([]);
  const[batchLines,setBatchLines]=useState([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);
  const[viewSO,setViewSO]=useState(null);
  const[viewPO,setViewPO]=useState(null);const[confirmDelPay,setConfirmDelPay]=useState(null);const[search,setSearch]=useState("");const[viewSupplier,setViewSupplier]=useState(null);const[viewPayHist,setViewPayHist]=useState(null);const[confirmDelTxn,setConfirmDelTxn]=useState(null);const[warnMsg,setWarnMsg]=useState(null);
  const[bapSup,setBapSup]=useState("");const[bapPOs,setBapPOs]=useState([]);const[bapCNs,setBapCNs]=useState([]);
  const[bapMethod,setBapMethod]=useState("โอนเงินออก");const[bapAccId,setBapAccId]=useState(bankAccs[0]?.id||1);const[bapDate,setBapDate]=useState(todayStr());const[bapNote,setBapNote]=useState("");

  const catsForDir=(dir)=>{if(!dir)return cashCats;return cashCats.filter(c=>c.type===dir||c.type==="both");};
  const subsForCat=(catId)=>{if(!catId)return [];const c=cashCats.find(x=>x.id===+catId);return c?.subs||[];};
  // Hardcoded flow definitions (internal — UI consumes this for the settings modal)
  const FLOW_DEFS=[
    {key:"ar_cash",                label:"รับเงินสดจาก SO",            direction:"in"},
    {key:"ar_bank",                label:"ลูกค้าโอนเงินจ่าย SO",       direction:"in"},
    {key:"ar_cheque",              label:"รับเช็คจาก SO (เคลีย)",      direction:"in"},
    {key:"ar_batch",               label:"รวมหลาย SO (batch)",         direction:"in"},
    {key:"ap_cash",                label:"จ่ายซัพด้วยเงินสด",          direction:"out"},
    {key:"ap_bank",                label:"โอนเงินจ่ายซัพ",             direction:"out"},
    {key:"ap_epp",                 label:"จ่ายซัพ EPP",                direction:"out"},
    {key:"ap_cheque",              label:"จ่ายเช็คซัพ (เคลีย)",        direction:"out"},
    {key:"ap_batch",               label:"รวมหลาย PO (batch AP)",      direction:"out"},
    {key:"transfer_depositToBank", label:"ฝากเงินสดเข้าธนาคาร",       direction:"both"},
    {key:"transfer_withdrawFromBank", label:"ถอนเงินจากธนาคาร",       direction:"both"},
    {key:"transfer_interAccount",  label:"โอนระหว่างบัญชี",            direction:"both"},
    {key:"withdraw",               label:"ถอนเงินสด (modal เก่า)",     direction:"out"},
    {key:"adjust_over",            label:"ปรับยอด (เกิน)",             direction:"in"},
    {key:"adjust_short",           label:"ปรับยอด (ขาด)",              direction:"out"},
  ];
  const autoTag=(key)=>{const m=tagMappings.find(x=>x.key===key);return m?{catId:m.catId,subCatId:m.subCatId}:{catId:null,subCatId:null};};
  const setTagMapping=(key,patch)=>{setTagMappings(prev=>{const i=prev.findIndex(x=>x.key===key);if(i===-1)return[...prev,{key,catId:null,subCatId:null,...patch}];return prev.map((x,idx)=>idx===i?{...x,...patch}:x);});};

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


  const saveTxn=()=>{if(!txnForm.amount||+txnForm.amount<=0)return;const newTxn={id:Date.now(),accId:txnForm.accId,type:txnForm.type,amount:+txnForm.amount,date:txnForm.date,from:txnForm.from,refId:txnForm.refId,note:txnForm.note,catId:txnForm.catId?+txnForm.catId:null,subCatId:txnForm.subCatId?+txnForm.subCatId:null,transferPair:null};setBankTxns(p=>[...p,newTxn]);cM();};
  const getAccBal=accId=>{const acc=bankAccs.find(a=>a.id===accId);const opening=acc&&acc.openingBalance?+acc.openingBalance||0:0;return opening+bankTxns.filter(t=>t.accId===accId).reduce((s,t)=>{if(t.type==="in")return s+(+t.amount||0);if(t.type==="out")return s-(+t.amount||0);if(t.type==="opening")return s;if(t.type==="transfer")return s+(+t.amount||0);if(t.type==="adjust")return s+(+t.amount||0);return s;},0);};
  const saveAcc=()=>{if(!accForm.name||!accForm.bank)return;const data={...accForm,perms:accForm.perms||{...DEF_PERMS}};if(editAcc){setBankAccs(p=>p.map(a=>a.id===editAcc.id?{...a,...data}:a));setEditAcc(null);}else{setBankAccs(p=>[...p,{id:Date.now(),...data}]);}cM();};
  const saveCashAccount=()=>{
    if(!cashAcctForm.name.trim())return;
    const openingAmt=+cashAcctForm.openingBalance||0;
    const newId=Date.now();
    const newAcc={id:newId,name:cashAcctForm.name.trim(),bank:"เงินสด",accNo:"",
      isCash:true,openingBalance:openingAmt,openingDate:cashAcctForm.openingDate,
      perms:{receive:true,payOut:true,transfer:true,clearCheque:false}};
    setBankAccs(p=>[...p,newAcc]);
    if(openingAmt>0){
      setBankTxns(p=>[...p,{id:newId+1,accId:newId,type:"opening",
        amount:openingAmt,date:cashAcctForm.openingDate,
        from:"ตั้งยอดเริ่มต้น",refId:"",note:"ยอดเริ่มต้น",
        catId:null,subCatId:null,transferPair:null}]);
    }
    setCashAcctForm({name:"",openingBalance:"",openingDate:todayStr()});
    setAcctType(null);
    cM();
  };
  const deleteAcc=id=>{setBankAccs(p=>p.filter(a=>a.id!==id));setBankTxns(p=>p.filter(t=>t.accId!==id));setDelAcc(null);};
  const catUsageCount=(catId,subCatId=null)=>bankTxns.filter(t=>subCatId==null?t.catId===catId:(t.catId===catId&&t.subCatId===subCatId)).length;
  const addCat=()=>{
    if(!newCatName.trim())return;
    const id=Date.now();
    setCashCats(p=>[...p,{id,name:newCatName.trim(),type:newCatType,subs:[]}]);
    setNewCatName("");setNewCatType("both");setSelCatId(id);
  };
  const renameCat=(id,name)=>setCashCats(p=>p.map(c=>c.id===id?{...c,name}:c));
  const changeCatType=(id,type)=>setCashCats(p=>p.map(c=>c.id===id?{...c,type}:c));
  const delCat=(id)=>{
    const used=catUsageCount(id);
    if(used>0){setCatUsageWarn({type:"cat",id,count:used});return;}
    setCashCats(p=>p.filter(c=>c.id!==id));
    if(selCatId===id)setSelCatId(null);
  };
  const addSub=(catId)=>{
    const n=(newSubName[catId]||"").trim();
    if(!n)return;
    setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:[...(c.subs||[]),{id:Date.now(),name:n}]}:c));
    setNewSubName(p=>({...p,[catId]:""}));
  };
  const renameSub=(catId,subId,name)=>setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:c.subs.map(s=>s.id===subId?{...s,name}:s)}:c));
  const delSub=(catId,subId)=>{
    const used=catUsageCount(catId,subId);
    if(used>0){setCatUsageWarn({type:"sub",catId,subId,count:used});return;}
    setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:c.subs.filter(s=>s.id!==subId)}:c));
  };
  const saveTransfer=()=>{
    const amt=+tfForm.amount;
    if(!tfForm.fromAccId||!tfForm.toAccId||+tfForm.fromAccId===+tfForm.toAccId)return;
    if(!amt||amt<=0)return;
    const fromAcc=bankAccs.find(a=>a.id===+tfForm.fromAccId);
    const toAcc=bankAccs.find(a=>a.id===+tfForm.toAccId);
    if(!fromAcc||!toAcc)return;
    const dir=(fromAcc.isCash&&!toAcc.isCash)?"depositToBank":
              (!fromAcc.isCash&&toAcc.isCash)?"withdrawFromBank":
              "interAccount";
    const tag=autoTag("transfer_"+dir);
    const pairId=Date.now();
    const outTxn={id:pairId,accId:fromAcc.id,type:"transfer",amount:-amt,date:tfForm.date,
      from:toAcc.name,refId:"",note:tfForm.note||"โอนไป "+toAcc.name,
      catId:tag.catId,subCatId:tag.subCatId,transferPair:pairId};
    const inTxn={id:pairId+1,accId:toAcc.id,type:"transfer",amount:amt,date:tfForm.date,
      from:fromAcc.name,refId:"",note:tfForm.note||"โอนจาก "+fromAcc.name,
      catId:tag.catId,subCatId:tag.subCatId,transferPair:pairId};
    setBankTxns(p=>[...p,outTxn,inTxn]);
    setTfForm({fromAccId:"",toAccId:"",amount:"",date:todayStr(),note:""});
    cM();
  };
  const saveAdjust=()=>{
    if(!adjForm.accId||adjForm.actualBalance===""||isNaN(+adjForm.actualBalance))return;
    const current=getAccBal(adjForm.accId);
    const actual=+adjForm.actualBalance;
    const diff=round2(actual-current);
    if(diff===0){cM();return;}
    const tag=autoTag(diff>=0?"adjust_over":"adjust_short");
    setBankTxns(p=>[...p,{id:Date.now(),accId:adjForm.accId,type:"adjust",
      amount:diff,date:adjForm.date,from:"",refId:"",
      note:adjForm.note||"ปรับยอด ("+(diff>0?"+":"")+fmt(diff)+")",
      catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);
    setAdjForm({accId:null,actualBalance:"",date:todayStr(),note:""});
    cM();
  };
  const getBankColor=b=>b.includes("กสิกร")?"#138f2d":b.includes("กรุงไทย")?"#1ba5e0":b.includes("กรุงเทพ")?"#012e6b":b.includes("ไทยพาณิชย์")||b.includes("พาณิชย์")?"#4e2a84":b.toUpperCase().includes("TTB")||b.includes("ทหารไทยธนชาต")?"#fc6e20":"var(--blue)";
  const txnFiltered=(accFilter==="all"?bankTxns:bankTxns.filter(t=>t.accId===+accFilter)).filter(t=>{if(!search)return true;const q=search.toLowerCase();return(t.from||"").toLowerCase().includes(q)||(t.refId||"").toLowerCase().includes(q)||(t.note||"").toLowerCase().includes(q);});

  const[viewBill,setViewBill]=useState(null);
  const soBillMap=useMemo(()=>{const m={};for(const b of billings)for(const sn of(b.soNums||[]))m[sn]=b;return m;},[billings]);

  const TAB_GROUPS=[[["ap","จ่ายซัพพลายเออร์"],["supcn","ใบลดหนี้ (ซัพฯ)"]],[["ar","เก็บเงินลูกค้า"],["billing","ใบวางบิล"],["cn","ใบลดหนี้"]],[["cheque","เช็ค"],["bank","บัญชี"]]];

  return <div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--line)",overflowX:"auto"}}>{TAB_GROUPS.map((grp,gi)=><React.Fragment key={gi}>{gi>0&&<span style={{borderLeft:"1.5px solid var(--line)",margin:"6px 4px",alignSelf:"stretch"}}/>}{grp.map(v=><button key={v[0]} onClick={()=>{setSub(v[0]);setFSt("all");setAccFilter("all");setSearch("");}} style={{...TB,fontWeight:sub===v[0]?600:400,borderBottom:sub===v[0]?"2px solid var(--text)":"2px solid transparent",color:sub===v[0]?"var(--text)":"var(--dim)"}}>{v[1]}</button>)}</React.Fragment>)}</div>

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

    {sub==="bank"&&<>
      {(()=>{
        const cashTotal=bankAccs.filter(a=>a.isCash).reduce((s,a)=>s+getAccBal(a.id),0);
        const bankTotal=bankAccs.filter(a=>!a.isCash).reduce((s,a)=>s+getAccBal(a.id),0);
        return <div style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid var(--line)",marginBottom:12,fontSize:13,alignItems:"center"}}>
          <span>เงินสด: <strong style={{color:"var(--green)"}}>฿{fmt(cashTotal)}</strong></span>
          <span style={{color:"var(--faint)"}}>·</span>
          <span>ธนาคาร: <strong style={{color:"var(--blue)"}}>฿{fmt(bankTotal)}</strong></span>
          <span style={{color:"var(--faint)"}}>·</span>
          <span>รวมทั้งหมด: <strong>฿{fmt(cashTotal+bankTotal)}</strong></span>
        </div>;
      })()}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {ed&&<button onClick={()=>{setAcctType(null);oM("newAccount");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ เพิ่มบัญชี</button>}
        {ed&&bankAccs.length>=2&&<button onClick={()=>{setTfForm({fromAccId:bankAccs[0]?.id||"",toAccId:bankAccs[1]?.id||"",amount:"",date:todayStr(),note:""});oM("transfer");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>โอนระหว่างบัญชี</button>}
        {ed&&bankAccs.length>0&&<button onClick={()=>{setWdForm({accId:String(bankAccs[0]?.id||""),amount:"",date:todayStr(),note:""});oM("withdraw");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.12)",color:"var(--orange)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>ถอนเงินสด</button>}
        {ed&&<button onClick={()=>{setSelCatId(null);setNewCatName("");setNewCatType("both");setNewSubName({});setEditingCatId(null);setEditingSubId(null);oM("manageCats");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"1px solid var(--line)",background:"transparent",color:"var(--dim)",cursor:"pointer",fontFamily:"inherit",fontWeight:500,marginLeft:"auto"}}>จัดการหมวด</button>}
        {ed&&<button onClick={()=>oM("tagSettings")} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"1px solid var(--line)",background:"transparent",color:"var(--dim)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>ตั้งค่า Auto-tag</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:16}}>
        {bankAccs.map(acc=>{const bal=getAccBal(acc.id);const txns=bankTxns.filter(t=>t.accId===acc.id);const todayIn=txns.filter(t=>t.type==="in"&&(t.date||"").startsWith(todayStr())).reduce((s,t)=>s+t.amount,0);const todayOut=txns.filter(t=>t.type==="out"&&(t.date||"").startsWith(todayStr())).reduce((s,t)=>s+t.amount,0);const last=txns.length>0?txns[txns.length-1]:null;const bankColor=getBankColor(acc.bank);
        return<div key={acc.id} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"16px 20px",borderLeft:"4px solid "+bankColor,position:"relative",overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontSize:11,color:bankColor,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:2}}>{acc.bank}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{background:acc.isCash?"rgba(52,199,89,0.12)":"var(--blue-bg)",color:acc.isCash?"var(--green)":"var(--blue)",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:500}}>{acc.isCash?"เงินสด":"ธนาคาร"}</span>
                <div style={{fontWeight:600,fontSize:15}}>{acc.name}</div>
              </div>
              {acc.accNo&&<div style={{fontSize:11,color:"var(--faint)",marginTop:1,fontFamily:"monospace"}}>{acc.accNo}</div>}
              <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>{hasPerm(acc,"receive")&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>รับโอน</span>}{hasPerm(acc,"clearCheque")&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:"var(--blue-bg)",color:"var(--blue)"}}>เคลียร์เช็ค</span>}{hasPerm(acc,"transferOut")&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:"rgba(255,149,0,0.12)",color:"var(--orange)"}}>โอนเงินออก</span>}{hasPerm(acc,"payEPP")&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:"rgba(175,82,222,0.14)",color:"var(--purple)"}}>จ่าย EPP</span>}</div>
            </div>
            <div style={{width:36,height:36,borderRadius:8,background:bankColor+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:bankColor}}>{acc.bank.charAt(0)}</div>
          </div>
          <div style={{fontSize:26,fontWeight:700,color:bal>=0?"var(--green)":"var(--red)",marginBottom:8}}>{"฿"+fmt(bal)}</div>
          <div style={{display:"flex",gap:12,fontSize:11,color:"var(--dim)",borderTop:"1px solid var(--line)",paddingTop:8}}>
            {todayIn>0&&<span style={{color:"var(--green)"}}>{"+ ฿"+fmt(todayIn)+" วันนี้"}</span>}
            {todayOut>0&&<span style={{color:"var(--red)"}}>{"- ฿"+fmt(todayOut)+" วันนี้"}</span>}
            {todayIn===0&&todayOut===0&&last&&<span>{"รายการล่าสุด: "+toBE(last.date)}</span>}
            {todayIn===0&&todayOut===0&&!last&&<span>ยังไม่มีรายการ</span>}
            <span style={{marginLeft:"auto"}}>{txns.length+" รายการ"}</span>
          </div>
          {ed&&<div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={()=>{setTxnForm({accId:acc.id,type:"out",amount:"",date:todayStr(),from:"",refId:"",note:"",catId:"",subCatId:""});oM("addTxn");}} style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--dim)",background:"transparent",color:"var(--text)",cursor:"pointer",fontFamily:"inherit"}}>+ รายการ</button>
            {bankAccs.length>=2&&<button onClick={()=>{setTfForm({fromAccId:acc.id,toAccId:"",amount:"",date:todayStr(),note:""});oM("transfer");}} style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--blue)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>โอน</button>}
            {acc.isCash&&<button onClick={()=>{setAdjForm({accId:acc.id,actualBalance:"",date:todayStr(),note:""});oM("adjust");}} style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--orange)",background:"transparent",color:"var(--orange)",cursor:"pointer",fontFamily:"inherit"}}>ปรับยอด</button>}
            <button onClick={()=>{setAccForm({name:acc.name,bank:acc.bank,accNo:acc.accNo||"",perms:{receive:hasPerm(acc,"receive"),clearCheque:hasPerm(acc,"clearCheque"),transferOut:hasPerm(acc,"transferOut"),payEPP:hasPerm(acc,"payEPP")}});setEditAcc(acc);oM("addAcc");}} style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--line)",background:"transparent",color:"var(--dim)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไข</button>
            {cd&&<button onClick={()=>setDelAcc(acc)} style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--red)",background:"transparent",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}
          </div>}
        </div>;})}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setAccFilter("all")} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(accFilter==="all"?"var(--text)":"var(--line)"),background:accFilter==="all"?"var(--text)":"transparent",color:accFilter==="all"?"var(--bg)":"var(--dim)",cursor:"pointer"}}>ทั้งหมด</button>
          {bankAccs.map(acc=><button key={acc.id} onClick={()=>setAccFilter(String(acc.id))} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(accFilter===String(acc.id)?"var(--text)":"var(--line)"),background:accFilter===String(acc.id)?"var(--text)":"transparent",color:accFilter===String(acc.id)?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{acc.name+" — "+acc.bank}</button>)}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={()=>{setTxnForm({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:"",catId:"",subCatId:""});oM("addTxn");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ บันทึกรายการ</button>}</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["วันที่","บัญชี","ประเภท","จำนวน","จาก/ถึง","อ้างอิง","หมวด","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
      <tbody>{txnFiltered.length===0?<tr><td colSpan={9} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีรายการเคลื่อนไหว</div>{ed&&<button onClick={()=>{setTxnForm({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:"",catId:"",subCatId:""});oM("addTxn");}} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ บันทึกรายการแรก</button>}</td></tr>:[...txnFiltered].reverse().map(t=>{
        const acc=bankAccs.find(a=>a.id===t.accId);
        return<tr key={t.id} style={{borderBottom:"0.5px solid var(--line)"}}>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(t.date)}</td>
          <td style={{padding:"8px",fontWeight:500}}>{acc?acc.name:"—"}</td>
          <td style={{padding:"8px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,fontWeight:600,background:t.type==="in"?"rgba(52,199,89,0.12)":"rgba(255,59,48,0.12)",color:t.type==="in"?"var(--green)":"var(--red)"}}>{t.type==="in"?"เงินเข้า":"เงินออก"}</span></td>
          <td style={{padding:"8px",fontWeight:600,color:t.type==="in"?"var(--green)":"var(--red)"}}>{(t.type==="in"?"+":"-")+"฿"+fmt(t.amount)}</td>
          <td style={{padding:"8px"}}>{t.from||"—"}</td>
          <td style={{padding:"8px",color:"var(--blue)",fontSize:12}}>{t.refId||"—"}</td>
          <td style={{padding:"8px"}}>{t.catId?(()=>{const c=cashCats.find(x=>x.id===t.catId);if(!c)return <span style={{color:"var(--faint)",fontSize:11}}>(หาไม่เจอ)</span>;const s=t.subCatId?(c.subs||[]).find(x=>x.id===t.subCatId):null;return <span style={{fontSize:11,background:"var(--blue-bg)",color:"var(--blue)",padding:"2px 7px",borderRadius:4}}>{c.name}{s?" / "+s.name:""}</span>;})():<span onClick={ed?()=>oM("tagSettings"):undefined} style={{color:ed?"var(--blue)":"var(--faint)",fontSize:11,cursor:ed?"pointer":"default",textDecoration:ed?"underline":"none"}}>{ed?"(ตั้งค่า auto-tag)":"(ไม่ระบุ)"}</span>}</td>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{t.note||"—"}</td>
          <td style={{padding:"8px",whiteSpace:"nowrap"}}>{cd&&<button onClick={()=>setConfirmDelTxn(t)} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</td>
        </tr>;})}
      </tbody></table></div>
    </>}

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

    {modal==="addTxn"&&ed&&<Modal title="บันทึกรายการ บัญชีธนาคาร" onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="บัญชี"><CustomSelect value={String(txnForm.accId)} onChange={v=>setTxnForm(f=>({...f,accId:+v}))} options={bankAccs.map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>
        <Field label="ประเภท"><CustomSelect value={txnForm.type} onChange={v=>setTxnForm(f=>({...f,type:v}))} options={[{value:"in",label:"เงินเข้า"},{value:"out",label:"เงินออก"}]}/></Field>
        <Field label="จำนวน (฿)"><input type="number" value={txnForm.amount} onChange={e=>setTxnForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={txnForm.date} onChange={e=>setTxnForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="จาก/ถึง"><input value={txnForm.from} onChange={e=>setTxnForm(f=>({...f,from:e.target.value}))} style={IB}/></Field>
        <Field label="อ้างอิง (SO/PO)"><input value={txnForm.refId} onChange={e=>setTxnForm(f=>({...f,refId:e.target.value}))} style={IB}/></Field>
        <div style={{gridColumn:"1/-1"}}><Field label="หมายเหตุ"><input value={txnForm.note} onChange={e=>setTxnForm(f=>({...f,note:e.target.value}))} style={IB}/></Field></div>
        <Field label="หมวด"><CustomSelect value={String(txnForm.catId||"")} onChange={v=>setTxnForm(f=>({...f,catId:v,subCatId:""}))} options={[{value:"",label:"(ไม่ระบุ)"},...catsForDir(txnForm.type).map(c=>({value:String(c.id),label:c.name}))]}/></Field>
        {txnForm.catId&&subsForCat(txnForm.catId).length>0&&<Field label="หมวดย่อย"><CustomSelect value={String(txnForm.subCatId||"")} onChange={v=>setTxnForm(f=>({...f,subCatId:v}))} options={[{value:"",label:"(ไม่ระบุ)"},...subsForCat(txnForm.catId).map(s=>({value:String(s.id),label:s.name}))]}/></Field>}
      </div>
      <MBtns onCancel={cM} onSave={saveTxn}/>
    </Modal>}

    {modal==="addAcc"&&ed&&<Modal title={editAcc?"แก้ไขบัญชี":"เพิ่มบัญชีธนาคาร"} onClose={()=>{setEditAcc(null);cM();}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="ชื่อบัญชี"><input value={accForm.name} onChange={e=>setAccForm(f=>({...f,name:e.target.value}))} placeholder="เช่น บัญชี 3" style={IB}/></Field>
        <Field label="ธนาคาร"><input value={accForm.bank} onChange={e=>setAccForm(f=>({...f,bank:e.target.value}))} placeholder="เช่น TTB, กสิกรไทย" style={IB}/></Field>
        <div style={{gridColumn:"1/-1"}}><Field label="เลขบัญชี (ไม่บังคับ)"><input value={accForm.accNo} onChange={e=>setAccForm(f=>({...f,accNo:e.target.value}))} placeholder="xxx-x-xxxxx-x" style={IB}/></Field></div>
        <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--line)",paddingTop:12}}>
          <div style={{fontSize:12,color:"var(--dim)",marginBottom:8,fontWeight:500}}>สิทธิ์การใช้งาน</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>{[{key:"receive",label:"รับโอน",color:"var(--green)"},{key:"clearCheque",label:"เคลียร์เช็ค",color:"var(--blue)"},{key:"transferOut",label:"โอนเงินออก",color:"var(--orange)"},{key:"payEPP",label:"จ่าย EPP",color:"var(--purple)"}].map(p=><label key={p.key} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}><input type="checkbox" checked={!!(accForm.perms||{})[p.key]} onChange={e=>setAccForm(f=>({...f,perms:{...(f.perms||{...DEF_PERMS}),[p.key]:e.target.checked}}))} style={{accentColor:p.color}}/><span style={{color:(accForm.perms||{})[p.key]?p.color:"var(--faint)"}}>{p.label}</span></label>)}</div>
        </div>
      </div>
      <MBtns onCancel={()=>{setEditAcc(null);cM();}} onSave={saveAcc} saveLabel={editAcc?"บันทึก":"เพิ่มบัญชี"}/>
    </Modal>}

    {modal==="newAccount"&&ed&&<Modal title="สร้างบัญชีใหม่" onClose={()=>{setAcctType(null);cM();}}>
      {!acctType&&<div style={{display:"flex",gap:12,padding:8}}>
        <button onClick={()=>{setAccForm({name:"",bank:"",accNo:"",perms:{...DEF_PERMS}});setEditAcc(null);setAcctType(null);oM("addAcc");}} style={{flex:1,padding:"24px 16px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",cursor:"pointer",fontFamily:"inherit",fontSize:14,color:"var(--text)"}}>
          <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>บัญชีธนาคาร</div>
          <div style={{fontSize:12,color:"var(--dim)"}}>กสิกร · SCB · TTB · ฯลฯ</div>
        </button>
        <button onClick={()=>setAcctType("cash")} style={{flex:1,padding:"24px 16px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",cursor:"pointer",fontFamily:"inherit",fontSize:14,color:"var(--text)"}}>
          <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>บัญชีเงินสด</div>
          <div style={{fontSize:12,color:"var(--dim)"}}>ลิ้นชักหน้าร้าน / Petty cash</div>
        </button>
      </div>}
      {acctType==="cash"&&<div>
        <Field label="ชื่อบัญชี"><input value={cashAcctForm.name} onChange={e=>setCashAcctForm({...cashAcctForm,name:e.target.value})} placeholder="เช่น เงินสดหน้าร้าน" style={IB}/></Field>
        <Field label="ยอดเริ่มต้น (บาท)"><input type="number" value={cashAcctForm.openingBalance} onChange={e=>setCashAcctForm({...cashAcctForm,openingBalance:e.target.value})} placeholder="0" style={IB}/></Field>
        <Field label="วันที่ตั้งยอด"><input type="date" value={cashAcctForm.openingDate} onChange={e=>setCashAcctForm({...cashAcctForm,openingDate:e.target.value})} style={IB}/></Field>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:10}}>
          <button onClick={()=>setAcctType(null)} style={{padding:"6px 13px",borderRadius:7,border:"1px solid var(--line)",cursor:"pointer",background:"var(--bg2)",color:"var(--text)",fontFamily:"inherit",fontSize:13,fontWeight:500}}>ย้อนกลับ</button>
          <button onClick={saveCashAccount} disabled={!cashAcctForm.name.trim()} style={{padding:"6px 13px",borderRadius:7,border:"none",cursor:!cashAcctForm.name.trim()?"not-allowed":"pointer",background:!cashAcctForm.name.trim()?"var(--hover2)":"var(--blue)",color:!cashAcctForm.name.trim()?"var(--dim)":"#fff",fontFamily:"inherit",fontSize:13,fontWeight:500,opacity:!cashAcctForm.name.trim()?0.6:1}}>บันทึก</button>
        </div>
      </div>}
    </Modal>}

    {modal==="manageCats"&&ed&&(()=>{
      const typeBadge=(t)=>{
        const cfg=t==="in"?{label:"รับ",color:"var(--green)",bg:"rgba(52,199,89,0.14)"}:t==="out"?{label:"จ่าย",color:"var(--red)",bg:"rgba(255,59,48,0.12)"}:{label:"ทั้งคู่",color:"var(--blue)",bg:"var(--blue-bg)"};
        return <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,color:cfg.color,background:cfg.bg,border:"1px solid "+cfg.color}}>{cfg.label}</span>;
      };
      const saveCat=(id)=>{const n=editCatName.trim();if(!n)return;renameCat(id,n);changeCatType(id,editCatType);setEditingCatId(null);};
      const saveSub=(cid,sid)=>{const n=editSubName.trim();if(!n)return;renameSub(cid,sid,n);setEditingSubId(null);};
      return <Modal title="จัดการหมวดเงินสด" onClose={cM} wide>
        <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
          <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()} placeholder="ชื่อหมวดใหม่..." style={{...IB,flex:1}}/>
          <select value={newCatType} onChange={e=>setNewCatType(e.target.value)} style={{fontSize:13,padding:"7px 8px",background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:6,fontFamily:"inherit"}}>
            <option value="in">รับ</option><option value="out">จ่าย</option><option value="both">ทั้งคู่</option>
          </select>
          <button onClick={addCat} style={{padding:"8px 16px",borderRadius:6,border:"none",background:"var(--green)",color:"#fff",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{"+ เพิ่มหมวด"}</button>
        </div>
        {cashCats.length===0&&<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem"}}>ยังไม่มีหมวด</div>}
        {cashCats.map(cat=>{
          const isEdit=editingCatId===cat.id;
          return <div key={cat.id} style={{border:"1.5px solid var(--line)",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
            <div style={{background:"var(--bg)",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
              {isEdit
                ? <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                    <input value={editCatName} onChange={e=>setEditCatName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveCat(cat.id)} style={{...IB,flex:1,padding:"5px 8px"}} autoFocus/>
                    <select value={editCatType} onChange={e=>setEditCatType(e.target.value)} style={{fontSize:12,padding:"5px 6px",background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:6,fontFamily:"inherit"}}>
                      <option value="in">รับ</option><option value="out">จ่าย</option><option value="both">ทั้งคู่</option>
                    </select>
                    <button onClick={()=>saveCat(cat.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"var(--green)",color:"#fff",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>บันทึก</button>
                    <button onClick={()=>setEditingCatId(null)} style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--line)",background:"transparent",cursor:"pointer",fontSize:12,color:"var(--dim)",fontFamily:"inherit"}}>ยกเลิก</button>
                  </div>
                : <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                    <span style={{fontWeight:600,fontSize:14}}>{cat.name}</span>
                    {typeBadge(cat.type)}
                    <span style={{fontSize:11,color:"var(--faint)",marginLeft:"auto"}}>{(cat.subs||[]).length+" หมวดย่อย"}</span>
                    <button onClick={()=>{setEditingCatId(cat.id);setEditCatName(cat.name);setEditCatType(cat.type||"both");}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{"แก้ไข"}</button>
                    {cd&&<button onClick={()=>delCat(cat.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{"ลบ"}</button>}
                  </div>
              }
            </div>
            <div style={{padding:"12px 14px"}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
                {(cat.subs||[]).map(sub=>{
                  const isES=editingSubId===sub.id;
                  return <div key={sub.id} style={{display:"flex",alignItems:"center",gap:4,background:"var(--panel)",border:"1px solid "+(isES?"var(--green)":"var(--line)"),borderRadius:6,padding:"4px 8px"}}>
                    {isES
                      ? <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <input value={editSubName} onChange={e=>setEditSubName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSub(cat.id,sub.id)} style={{...IB,width:120,padding:"3px 6px",fontSize:12}} autoFocus/>
                          <button onClick={()=>saveSub(cat.id,sub.id)} style={{padding:"2px 8px",borderRadius:4,border:"none",background:"var(--green)",color:"#fff",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>{"OK"}</button>
                          <button onClick={()=>setEditingSubId(null)} style={{padding:"2px 6px",borderRadius:4,border:"1px solid var(--line)",background:"transparent",cursor:"pointer",fontSize:11,color:"var(--dim)",fontFamily:"inherit"}}>{"X"}</button>
                        </div>
                      : <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:13}}>{sub.name}</span>
                          <button onClick={()=>{setEditingSubId(sub.id);setEditSubName(sub.name);}} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:"var(--blue)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{"แก้ไข"}</button>
                          {cd&&<button onClick={()=>delSub(cat.id,sub.id)} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>{"×"}</button>}
                        </div>
                    }
                  </div>;
                })}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={newSubName[cat.id]||""} onChange={e=>setNewSubName(p=>({...p,[cat.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSub(cat.id)} placeholder="เพิ่มหมวดย่อย..." style={{...IB,flex:1,padding:"5px 8px",fontSize:12}}/>
                <button onClick={()=>addSub(cat.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{"+ เพิ่ม"}</button>
              </div>
            </div>
          </div>;
        })}
        <MBtns onCancel={cM}/>
      </Modal>;
    })()}

    {catUsageWarn&&<Modal title="ลบไม่ได้" onClose={()=>setCatUsageWarn(null)}>
      <div style={{padding:12,fontSize:13,lineHeight:1.5}}>{"มีรายการเงินสด "}<strong>{catUsageWarn.count}</strong>{" รายการใช้หมวด"+(catUsageWarn.type==="sub"?"ย่อย":"")+"นี้อยู่ — กรุณาแก้ไขหรือลบรายการเหล่านั้นก่อน"}</div>
      <div style={{padding:"0 12px 12px",display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setCatUsageWarn(null)} style={{padding:"6px 13px",borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500}}>ปิด</button></div>
    </Modal>}

    {delAcc&&<Modal title="ยืนยันลบบัญชี" onClose={()=>setDelAcc(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบ \""+delAcc.name+" — "+delAcc.bank+"\" และรายการเคลื่อนไหวทั้งหมดของบัญชีนี้"}</div>
      <MBtns onCancel={()=>setDelAcc(null)} onSave={()=>deleteAcc(delAcc.id)} saveLabel="ลบ"/>
    </Modal>}

    {modal==="transfer"&&ed&&<Modal title="โอนเงินระหว่างบัญชี" onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="จากบัญชี"><CustomSelect value={String(tfForm.fromAccId||"")} onChange={v=>setTfForm(f=>({...f,fromAccId:v?+v:""}))} options={[{value:"",label:"— เลือก —"},...bankAccs.filter(a=>a.isCash||hasPerm(a,"transferOut")).map(a=>({value:String(a.id),label:a.name+(a.isCash?" (เงินสด)":" — "+a.bank)+" (฿"+fmt(getAccBal(a.id))+")"}))]}/></Field>
        <Field label="ไปบัญชี"><CustomSelect value={String(tfForm.toAccId||"")} onChange={v=>setTfForm(f=>({...f,toAccId:v?+v:""}))} options={[{value:"",label:"— เลือก —"},...bankAccs.filter(a=>a.id!==+tfForm.fromAccId&&(a.isCash||hasPerm(a,"receive"))).map(a=>({value:String(a.id),label:a.name+(a.isCash?" (เงินสด)":" — "+a.bank)+" (฿"+fmt(getAccBal(a.id))+")"}))]}/></Field>
        <Field label="จำนวน (บาท)"><input type="number" value={tfForm.amount} onChange={e=>setTfForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={tfForm.date} onChange={e=>setTfForm(f=>({...f,date:e.target.value}))}/></Field>
        <div style={{gridColumn:"1/-1"}}><Field label="หมายเหตุ"><input value={tfForm.note} onChange={e=>setTfForm(f=>({...f,note:e.target.value}))} style={IB}/></Field></div>
      </div>
      {tfForm.fromAccId&&tfForm.toAccId&&tfForm.amount&&+tfForm.amount>0&&<div style={{background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:8,padding:"12px",marginTop:12,fontSize:13,color:"var(--blue)"}}>
        {"โอน ฿"+fmt(+tfForm.amount)+" จาก "+((bankAccs.find(a=>a.id===+tfForm.fromAccId)||{}).name||"")+" → "+((bankAccs.find(a=>a.id===+tfForm.toAccId)||{}).name||"")}
      </div>}
      <div style={{padding:"12px 0 0"}}>
        <button onClick={saveTransfer} disabled={!tfForm.fromAccId||!tfForm.toAccId||!+tfForm.amount||+tfForm.fromAccId===+tfForm.toAccId} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:(!tfForm.fromAccId||!tfForm.toAccId||!+tfForm.amount||+tfForm.fromAccId===+tfForm.toAccId)?"var(--hover)":"var(--blue)",color:(!tfForm.fromAccId||!tfForm.toAccId||!+tfForm.amount||+tfForm.fromAccId===+tfForm.toAccId)?"var(--dim)":"#fff",fontWeight:500,fontSize:14,cursor:(!tfForm.fromAccId||!tfForm.toAccId||!+tfForm.amount||+tfForm.fromAccId===+tfForm.toAccId)?"not-allowed":"pointer",fontFamily:"inherit"}}>บันทึก</button>
      </div>
    </Modal>}

    {modal==="adjust"&&ed&&adjForm.accId&&(()=>{
      const acc=bankAccs.find(a=>a.id===adjForm.accId);
      const current=getAccBal(adjForm.accId);
      const actual=+adjForm.actualBalance||0;
      const diff=round2(actual-current);
      return <Modal title={"ปรับยอด — "+(acc?.name||"")} onClose={cM}>
        <div style={{padding:"8px 0",fontSize:13}}>ยอดในระบบตอนนี้: <strong>{"฿"+fmt(current)}</strong></div>
        <Field label="ยอดที่นับจริง (บาท)"><input type="number" value={adjForm.actualBalance} onChange={e=>setAdjForm(f=>({...f,actualBalance:e.target.value}))} style={IB}/></Field>
        {adjForm.actualBalance!==""&&<div style={{padding:"6px 0",fontSize:13,color:diff===0?"var(--dim)":diff>0?"var(--green)":"var(--red)"}}>{"ส่วนต่าง: "+(diff>=0?"+":"")+"฿"+fmt(diff)+" "+(diff>0?"(เกิน)":diff<0?"(ขาด)":"")}</div>}
        <Field label="วันที่"><input type="date" value={adjForm.date} onChange={e=>setAdjForm(f=>({...f,date:e.target.value}))} style={IB}/></Field>
        <Field label="หมายเหตุ"><input value={adjForm.note} onChange={e=>setAdjForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
        <MBtns onCancel={cM} onSave={saveAdjust} saveLabel="บันทึก" disabled={adjForm.actualBalance===""||diff===0}/>
      </Modal>;
    })()}

    {modal==="tagSettings"&&ed&&<Modal title="ตั้งค่า Auto-tag" onClose={cM} wide>
      <div style={{padding:"8px 0",fontSize:12,color:"var(--dim)",borderBottom:"1px solid var(--line)",marginBottom:12}}>
        เลือกหมวด + หมวดย่อย ที่จะใช้ tag อัตโนมัติเมื่อบันทึก txn จาก flow แต่ละเส้น
      </div>
      {FLOW_DEFS.map(flow=>{
        const m=tagMappings.find(x=>x.key===flow.key)||{catId:null,subCatId:null};
        const catOpts=[{value:"",label:"— ไม่ tag —"},...catsForDir(flow.direction).map(c=>({value:String(c.id),label:c.name}))];
        const selectedCat=m.catId?cashCats.find(c=>c.id===m.catId):null;
        const subOpts=selectedCat?[{value:"",label:"— ไม่ระบุ —"},...selectedCat.subs.map(s=>({value:String(s.id),label:s.name}))]:[];
        return <div key={flow.key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--line)"}}>
          <span style={{flex:"0 0 220px",fontSize:13}}>{flow.label}</span>
          <div style={{flex:1,minWidth:0}}>
            <CustomSelect value={String(m.catId||"")} onChange={v=>setTagMapping(flow.key,{catId:v?+v:null,subCatId:null})} options={catOpts}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            {m.catId&&<CustomSelect value={String(m.subCatId||"")} onChange={v=>setTagMapping(flow.key,{subCatId:v?+v:null})} options={subOpts}/>}
            {!m.catId&&<div style={{fontSize:12,color:"var(--faint)",padding:"6px 12px"}}>(ไม่ tag)</div>}
          </div>
        </div>;
      })}
      <div style={{padding:"12px 0 0",fontSize:11,color:"var(--dim)"}}>
        หมายเหตุ: การตั้งค่าจะ apply เฉพาะ txn ที่บันทึก<strong>หลังจาก</strong>ตั้งค่านี้
      </div>
      <MBtns onCancel={cM} onSave={cM} saveLabel="ปิด"/>
    </Modal>}

    {modal==="withdraw"&&ed&&<Modal title="ถอนเงินสด" onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="จากบัญชี"><CustomSelect value={wdForm.accId} onChange={v=>setWdForm(f=>({...f,accId:v}))} options={bankAccs.filter(a=>!a.isCash).map(a=>({value:String(a.id),label:a.name+" — "+a.bank+" (฿"+fmt(getAccBal(a.id))+")" }))}/></Field>
        <Field label="จำนวนเงิน (฿)"><input type="number" value={wdForm.amount} onChange={e=>setWdForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={wdForm.date} onChange={e=>setWdForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="หมายเหตุ"><input value={wdForm.note} onChange={e=>setWdForm(f=>({...f,note:e.target.value}))} style={IB} placeholder="เช่น ถอนเงินสดย่อย"/></Field>
      </div>
      {wdForm.accId&&wdForm.amount&&+wdForm.amount>0&&<div style={{background:"rgba(255,149,0,0.12)",border:"1px solid var(--orange)",borderRadius:8,padding:"12px",marginTop:12,fontSize:13,color:"var(--orange)"}}>
        {"ถอนเงินสด ฿"+fmt(+wdForm.amount)+" จาก "+((bankAccs.find(a=>a.id===+wdForm.accId)||{}).name||"")}
      </div>}
      <MBtns onCancel={cM} onSave={()=>{if(!wdForm.accId||!wdForm.amount||+wdForm.amount<=0)return;const tag=autoTag("withdraw");setBankTxns(p=>[...p,{id:Date.now(),accId:+wdForm.accId,type:"out",amount:+wdForm.amount,date:wdForm.date,from:"ถอนเงินสด",refId:"WD-"+Date.now(),note:wdForm.note,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);cM();}} saveLabel="ยืนยันถอน"/>
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

    {confirmDelTxn&&<Modal title="ยืนยันลบรายการธนาคาร" onClose={()=>setConfirmDelTxn(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบรายการ "+(confirmDelTxn.type==="in"?"เงินเข้า":confirmDelTxn.type==="out"?"เงินออก":"โอน")+" ฿"+fmt(Math.abs(confirmDelTxn.amount))+" ("+(confirmDelTxn.from||"—")+") ถาวร"+(confirmDelTxn.transferPair?" (ลบทั้งสองฝั่งของการโอน)":"")}</div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setConfirmDelTxn(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--text)",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
        <button onClick={()=>{if(confirmDelTxn.transferPair){setBankTxns(p=>p.filter(x=>x.transferPair!==confirmDelTxn.transferPair));}else{setBankTxns(p=>p.filter(x=>x.id!==confirmDelTxn.id));}setConfirmDelTxn(null);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"var(--red)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>
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

import React, { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE, mkLog, round2 } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import StatCard from "./ui/StatCard.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import CustomerProfile from "./CustomerProfile.jsx";
import SupplierProfile from "./SupplierProfile.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";

const TB={padding:"10px 20px",fontSize:13,border:"none",marginBottom:"-2px",background:"transparent",cursor:"pointer",fontFamily:"inherit"};
const CHQ_ST=[{key:"pending",label:"รอขึ้นเงิน",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},{key:"deposited",label:"นำฝากแล้ว",color:"var(--blue)",bg:"var(--blue-bg)"},{key:"cleared",label:"เคลียร์แล้ว",color:"var(--green)",bg:"rgba(52,199,89,0.12)"},{key:"bounced",label:"เด้ง",color:"var(--red)",bg:"rgba(255,59,48,0.12)"}];
const CN_TYPES=[{key:"return",label:"คืนสินค้า",color:"var(--blue)",bg:"var(--blue-bg)"},{key:"defective",label:"สินค้าชำรุด",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},{key:"promo",label:"โปรโมชั่น",color:"var(--purple)",bg:"rgba(175,82,222,0.14)"}];
const DEF_PERMS={receive:true,clearCheque:true,payEPP:true,transferOut:true};
const hasPerm=(acc,key)=>{const p=acc.perms;if(!p)return true;if(key==="payEPP")return p.payEPP!==undefined?!!p.payEPP:p.payOnline!==undefined?!!p.payOnline:true;if(key==="transferOut")return p.transferOut!==undefined?!!p.transferOut:true;return p[key]!==undefined?!!p[key]:true;};

export default function FinPage({sh}){
  const{cN,pN,contacts,pos,sales,quotes,payments,setPayments,products,setProducts,canE,canD,modal,oM,cM,cheques,setCheques,bankAccs,setBankAccs,bankTxns,setBankTxns,cnotes,setCNotes,addLog,defectives,setDefectives,cu,billings,setBillings,supCNotes,setSupCNotes}=sh;
  const ed=canE("finance");const cd=canD("finance");
  const[sub,setSub]=useState("ap");const[viewProfile,setViewProfile]=useState(null);
  const[payForm,setPayForm]=useState({refId:"",type:"",amount:"",method:"โอนเงิน",date:todayStr(),note:""});
  const[fSt,setFSt]=useState("all");
  const[chqForm,setChqForm]=useState({chequeNo:"",bank:"",amount:"",date:todayStr(),dueDate:"",from:"",refId:"",note:"",status:"pending"});
  const[chqFilter,setChqFilter]=useState("all");
  const[txnForm,setTxnForm]=useState({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:""});
  const[accFilter,setAccFilter]=useState("all");
  const[accForm,setAccForm]=useState({name:"",bank:"",accNo:"",perms:{...DEF_PERMS}});
  const[editAcc,setEditAcc]=useState(null);const[delAcc,setDelAcc]=useState(null);
  const[tfForm,setTfForm]=useState({fromAcc:"",toAcc:"",amount:"",date:todayStr(),note:""});
  const[wdForm,setWdForm]=useState({accId:"",amount:"",date:todayStr(),note:""});
  const[batchCust,setBatchCust]=useState("");
  const[batchSOs,setBatchSOs]=useState([]);
  const[batchLines,setBatchLines]=useState([{method:"เช็ค",amount:"",accId:bankAccs[0]?.id||1,chequeNo:"",chequeBank:"",chequeDue:"",date:todayStr()}]);
  const[cnFilter,setCnFilter]=useState("all");const[viewCN,setViewCN]=useState(null);const[viewSO,setViewSO]=useState(null);
  const[cnForm,setCnForm]=useState({type:"return",customerId:"",soNum:"",date:todayStr(),items:[],amount:"",reason:"",note:""});
  const[viewPO,setViewPO]=useState(null);const[confirmDelPay,setConfirmDelPay]=useState(null);const[search,setSearch]=useState("");const[viewSupplier,setViewSupplier]=useState(null);const[viewPayHist,setViewPayHist]=useState(null);const[confirmDelTxn,setConfirmDelTxn]=useState(null);const[warnMsg,setWarnMsg]=useState(null);
  const[scnForm,setScnForm]=useState({supplierId:"",recognized:false,refNo:"",date:todayStr(),amount:"",reason:"",note:""});
  const[confirmDelScn,setConfirmDelScn]=useState(null);
  const[bapSup,setBapSup]=useState("");const[bapPOs,setBapPOs]=useState([]);const[bapCNs,setBapCNs]=useState([]);
  const[bapMethod,setBapMethod]=useState("โอนเงินออก");const[bapAccId,setBapAccId]=useState(bankAccs[0]?.id||1);const[bapDate,setBapDate]=useState(todayStr());const[bapNote,setBapNote]=useState("");

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
    const isApBank=payForm.type==="ap"&&(payForm.method==="โอนเงินออก"||payForm.method==="จ่ายEPP")&&payForm.accId;
    const isArBank=payForm.type==="ar"&&payForm.method==="โอนเงิน"&&payForm.accId;
    if(payForm.editId){const old=payments.find(x=>x.id===payForm.editId);setPayments(p=>p.map(x=>x.id===payForm.editId?{...x,amount:amt,method:payForm.method,date:payForm.date,note:payForm.note,accId:payForm.accId,chequeNo:payForm.chequeNo,chequeBank:payForm.chequeBank,chequeDue:payForm.chequeDue}:x));if(old){setBankTxns(prev=>prev.filter(t=>!(t.refId===old.refId&&Math.abs(t.amount-old.amount)<0.01&&t.date===old.date)));if(old.method==="เช็ค"&&old.chequeNo)setCheques(prev=>prev.filter(c=>!(c.chequeNo===old.chequeNo&&c.refId===old.refId)));}if(isArBank){setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId}]);}if(isApBank){setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:(payForm.method==="จ่ายEPP"?"จ่ายEPP ":"จ่าย ")+payForm.refId}]);}if(payForm.method==="เช็ค"&&payForm.type==="ar"){setCheques(p=>[...p,{id:Date.now()+2,chequeNo:payForm.chequeNo,bank:payForm.chequeBank,amount:amt,date:payForm.date,dueDate:payForm.chequeDue,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,status:"pending"}]);}
    }else{setPayments(p=>[...p,{id:Date.now(),...payForm,amount:amt}]);if(isArBank){setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"in",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId}]);}if(isApBank){setBankTxns(p=>[...p,{id:Date.now()+1,accId:payForm.accId,type:"out",amount:amt,date:payForm.date,from:payForm.name||"",refId:payForm.refId,note:(payForm.method==="จ่ายEPP"?"จ่ายEPP ":"จ่าย ")+payForm.refId}]);}if(payForm.method==="เช็ค"&&payForm.type==="ar"){setCheques(p=>[...p,{id:Date.now()+2,chequeNo:payForm.chequeNo,bank:payForm.chequeBank,amount:amt,date:payForm.date,dueDate:payForm.chequeDue,from:payForm.name||"",refId:payForm.refId,note:"รับชำระ "+payForm.refId,status:"pending"}]);}}cM();};

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
      if(ln.method==="โอนเงิน"&&ln.accId){newTxns.push({id:ts++,accId:ln.accId,type:"in",amount:amt,date:ln.date,from:custName,refId:batchSOs.join(","),note:"รับชำระรวม"});}
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
    if(bapNetTotal>0&&bapAccId){setBankTxns(p=>[...p,{id:ts++,accId:bapAccId,type:"out",amount:bapNetTotal,date:bapDate,from:supName,refId:refPOs,note:(bapMethod==="จ่ายEPP"?"จ่ายEPP ":"จ่าย ")+"จ่ายรวม "+refPOs}]);}
    if(bapCNs.length>0){setSupCNotes(p=>p.map(c=>bapCNs.includes(c.id)?{...c,used:true}:c));}
    cM();
  };

  const stB=s=>s==="paid"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>ชำระแล้ว</span>:s==="partial"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"var(--blue-bg)",color:"var(--blue)"}}>บางส่วน</span>:s==="cn_credit"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(175,82,222,0.12)",color:"var(--purple)"}}>หักCN</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>รอชำระ</span>;

  const saveChq=()=>{if(!chqForm.chequeNo||!chqForm.amount||+chqForm.amount<=0)return;if(chqForm.id){const old=cheques.find(c=>c.id===chqForm.id);if(old&&old.status!==chqForm.status){if(chqForm.status==="cleared"&&old.status==="bounced"){setWarnMsg("เช็คเด้งแล้ว ไม่สามารถเคลียร์ได้");return;}updateChqStatus(chqForm.id,chqForm.status);}setCheques(p=>p.map(c=>c.id===chqForm.id?{...c,chequeNo:chqForm.chequeNo,bank:chqForm.bank,amount:+chqForm.amount,receiveDate:chqForm.receiveDate,dueDate:chqForm.dueDate,from:chqForm.from,refId:chqForm.refId,note:chqForm.note}:c));}else{setCheques(p=>[...p,{id:Date.now(),...chqForm,amount:+chqForm.amount}]);}cM();};
  const openChqEdit=c=>{setChqForm({...c,amount:String(c.amount)});oM("addChq");};
  const updateChqStatus=(id,st,extra)=>{
    const old=cheques.find(c=>c.id===id);if(!old)return;
    if(st==="cleared"&&old.status==="bounced"){setWarnMsg("เช็คเด้งแล้ว ไม่สามารถเคลียร์ได้");return;}
    setCheques(p=>p.map(c=>c.id===id?{...c,status:st,...(extra||{})}:c));
    if(st==="cleared"&&old.depositAccId){setBankTxns(p=>[...p,{id:Date.now(),accId:old.depositAccId,type:"in",amount:old.amount,date:todayStr(),from:"เช็ค "+old.chequeNo,refId:old.refId||"",note:"เคลียร์เช็ค"}]);}
    if(st==="bounced"&&old.status==="cleared"&&old.depositAccId){setBankTxns(p=>[...p,{id:Date.now()+1,accId:old.depositAccId,type:"out",amount:old.amount,date:todayStr(),from:"เช็คเด้ง "+old.chequeNo,refId:old.refId||"",note:"เช็คเด้ง (กลับรายการเคลียร์)"}]);}
  };
  const[chqConfirm,setChqConfirm]=useState(null);
  const chqFiltered=cheques.filter(c=>chqFilter==="all"||c.status===chqFilter).filter(c=>{if(!search)return true;const q=search.toLowerCase();return(c.chequeNo||"").toLowerCase().includes(q)||(c.bank||"").toLowerCase().includes(q)||(c.from||"").toLowerCase().includes(q)||(c.refId||"").toLowerCase().includes(q);});
  const chqTotalPending=cheques.filter(c=>c.status==="pending").reduce((s,c)=>s+c.amount,0);

  const saveTxn=()=>{if(!txnForm.amount||+txnForm.amount<=0)return;setBankTxns(p=>[...p,{id:Date.now(),...txnForm,amount:+txnForm.amount}]);cM();};
  const getAccBal=accId=>bankTxns.filter(t=>t.accId===accId).reduce((s,t)=>s+(t.type==="in"?t.amount:-t.amount),0);
  const saveAcc=()=>{if(!accForm.name||!accForm.bank)return;const data={...accForm,perms:accForm.perms||{...DEF_PERMS}};if(editAcc){setBankAccs(p=>p.map(a=>a.id===editAcc.id?{...a,...data}:a));setEditAcc(null);}else{setBankAccs(p=>[...p,{id:Date.now(),...data}]);}cM();};
  const deleteAcc=id=>{setBankAccs(p=>p.filter(a=>a.id!==id));setBankTxns(p=>p.filter(t=>t.accId!==id));setDelAcc(null);};
  const saveTransfer=()=>{if(!tfForm.fromAcc||!tfForm.toAcc||tfForm.fromAcc===tfForm.toAcc||!tfForm.amount||+tfForm.amount<=0)return;const ts=Date.now();const fromA=bankAccs.find(a=>a.id===+tfForm.fromAcc);const toA=bankAccs.find(a=>a.id===+tfForm.toAcc);setBankTxns(p=>[...p,{id:ts,accId:+tfForm.fromAcc,type:"out",amount:+tfForm.amount,date:tfForm.date,from:"โอนไป "+toA?.name,refId:"TF-"+ts,note:tfForm.note},{id:ts+1,accId:+tfForm.toAcc,type:"in",amount:+tfForm.amount,date:tfForm.date,from:"โอนจาก "+fromA?.name,refId:"TF-"+ts,note:tfForm.note}]);cM();};
  const getBankColor=b=>b.includes("กสิกร")?"#138f2d":b.includes("กรุงไทย")?"#1ba5e0":b.includes("กรุงเทพ")?"#012e6b":b.includes("ไทยพาณิชย์")||b.includes("พาณิชย์")?"#4e2a84":b.toUpperCase().includes("TTB")||b.includes("ทหารไทยธนชาต")?"#fc6e20":"var(--blue)";
  const txnFiltered=(accFilter==="all"?bankTxns:bankTxns.filter(t=>t.accId===+accFilter)).filter(t=>{if(!search)return true;const q=search.toLowerCase();return(t.from||"").toLowerCase().includes(q)||(t.refId||"").toLowerCase().includes(q)||(t.note||"").toLowerCase().includes(q);});

  const[billFilter,setBillFilter]=useState("all");const[viewBill,setViewBill]=useState(null);const[confirmBill,setConfirmBill]=useState(null);
  const[billForm,setBillForm]=useState({customerId:"",soNums:[],cnIds:[],date:todayStr(),note:""});
  const soBillMap=useMemo(()=>{const m={};for(const b of billings)for(const sn of(b.soNums||[]))m[sn]=b;return m;},[billings]);
  const billCustSOs=useMemo(()=>{if(!billForm.customerId)return[];const today=todayStr();return arList.filter(so=>{if(so.customerId!==billForm.customerId)return false;if(so.remaining<=0&&!(billForm.id&&billForm.soNums.includes(so.soNum)))return false;const used=soBillMap[so.soNum];if(used&&!(billForm.id&&used.id===billForm.id))return false;if(billForm.id&&billForm.soNums.includes(so.soNum))return true;if(so.payType!=="credit")return true;if(so.dueDate&&so.dueDate<=today)return true;return false;});},[billForm.customerId,billForm.id,billForm.soNums,arList,soBillMap]);
  const billCustCNs=useMemo(()=>{if(!billForm.customerId)return[];return cnotes.filter(cn=>cn.customerId===billForm.customerId&&(!billings.some(b=>b.cnIds?.includes(cn.id))||(billForm.id&&billForm.cnIds.includes(cn.id))));},[billForm.customerId,billForm.id,billForm.cnIds,cnotes,billings]);
  const oldBillCNPays=useMemo(()=>billForm.id?payments.filter(p=>p.billId===billForm.id):[], [billForm.id,payments]);
  const oldBillCNByRef=useMemo(()=>{const m={};for(const p of oldBillCNPays)m[p.refId]=(m[p.refId]||0)+p.amount;return m;},[oldBillCNPays]);
  const billSOTotal=billForm.soNums.reduce((s,soNum)=>{const so=billCustSOs.find(x=>x.soNum===soNum);return s+(so?Math.max(0,so.remaining)+(oldBillCNByRef[soNum]||0):0);},0);
  const billCNTotal=billForm.cnIds.reduce((s,cnId)=>{const cn=cnotes.find(c=>c.id===cnId);if(!cn)return s;return s+cnTot(cn);},0);
  const billNet=Math.max(0,billSOTotal-billCNTotal);
  const billList=useMemo(()=>{let bl=billFilter==="all"?billings:billings.filter(b=>b.status===billFilter);if(search){const q=search.toLowerCase();bl=bl.filter(b=>{const cu2=contacts.find(c=>c.id===b.customerId);return(b.billNum||"").toLowerCase().includes(q)||(cu2?cN(cu2):"").toLowerCase().includes(q)||(b.soNums||[]).some(sn=>sn.toLowerCase().includes(q));});}return[...bl].reverse();},[billings,billFilter,search,contacts]);
  const cnList=useMemo(()=>{let cl=cnFilter==="all"?cnotes:cnotes.filter(c=>c.type===cnFilter);if(search){const q=search.toLowerCase();cl=cl.filter(cn=>{const cu2=contacts.find(c=>c.id===cn.customerId);return(cn.cnNum||"").toLowerCase().includes(q)||(cu2?cN(cu2):"").toLowerCase().includes(q)||(cn.soNum||"").toLowerCase().includes(q);});}return[...cl].reverse();},[cnotes,cnFilter,search,contacts]);
  const nextBillNum=()=>{const yr=new Date().getFullYear()+543;const nums=billings.filter(b=>b.billNum?.startsWith("BL-"+yr)).map(b=>+b.billNum.split("-")[2]||0);return"BL-"+yr+"-"+String(Math.max(0,...nums)+1).padStart(3,"0");};
  const saveBill=()=>{
    if(!billForm.customerId||billForm.soNums.length===0)return;
    if(billCNTotal>billSOTotal)return;
    const isEdit=!!billForm.id;
    const billId=isEdit?billForm.id:Date.now();
    const billNum=isEdit?billForm.billNum:nextBillNum();

    // CN credit payments: allocate to SO with highest remaining first
    const cnPays=[];
    if(billCNTotal>0){
      const soList=billForm.soNums.map(soNum=>{const so=billCustSOs.find(x=>x.soNum===soNum);if(!so)return null;const cleanRem=Math.max(0,so.remaining)+(oldBillCNByRef[soNum]||0);return{soNum,cleanRem};}).filter(Boolean).sort((a,b)=>b.cleanRem-a.cleanRem);
      let rem=billCNTotal;let ts2=billId+1000;
      for(const s of soList){if(rem<=0)break;if(s.cleanRem<=0)continue;const alloc=Math.min(rem,s.cleanRem);rem-=alloc;cnPays.push({id:ts2++,refId:s.soNum,type:"ar",amount:alloc,method:"หักลดหนี้",date:billForm.date,note:"หักจาก CN ใน "+billNum,billId});}
    }
    setPayments(p=>[...p.filter(py=>py.billId!==billId),...cnPays]);

    if(isEdit){
      const orig=billings.find(b=>b.id===billForm.id);
      const oldCnIds=orig?.cnIds||[];
      const removed=oldCnIds.filter(id=>!billForm.cnIds.includes(id));
      const added=billForm.cnIds.filter(id=>!oldCnIds.includes(id));
      for(const cnId of removed){const cn=cnotes.find(c=>c.id===cnId);if(cn&&cn.type==="defective"&&cn.defectiveId)setDefectives(p=>p.map(d=>d.id===cn.defectiveId?{...d,custStatus:"cn_created"}:d));}
      for(const cnId of added){const cn=cnotes.find(c=>c.id===cnId);if(cn&&cn.type==="defective"&&cn.defectiveId)setDefectives(p=>p.map(d=>d.id===cn.defectiveId?{...d,custStatus:"cn_used"}:d));}
      setBillings(p=>p.map(b=>b.id===billForm.id?{...b,customerId:billForm.customerId,soNums:billForm.soNums,cnIds:billForm.cnIds,date:billForm.date,note:billForm.note,soTotal:billSOTotal,cnTotal:billCNTotal,net:billNet}:b));
    }else{
      const bill={id:billId,billNum,customerId:billForm.customerId,soNums:billForm.soNums,cnIds:billForm.cnIds,date:billForm.date,note:billForm.note,soTotal:billSOTotal,cnTotal:billCNTotal,net:billNet,status:"pending"};
      setBillings(p=>[...p,bill]);
      for(const cnId of billForm.cnIds){const cn=cnotes.find(c=>c.id===cnId);if(cn&&cn.type==="defective"&&cn.defectiveId)setDefectives(p=>p.map(d=>d.id===cn.defectiveId?{...d,custStatus:"cn_used"}:d));}
    }
    cM();
  };
  const delBill=()=>{
    if(!billForm.id)return;
    setPayments(p=>p.filter(py=>py.billId!==billForm.id));
    for(const cnId of billForm.cnIds){const cn=cnotes.find(c=>c.id===cnId);if(cn&&cn.type==="defective"&&cn.defectiveId)setDefectives(p=>p.map(d=>d.id===cn.defectiveId?{...d,custStatus:"cn_created"}:d));}
    setBillings(p=>p.filter(b=>b.id!==billForm.id));
    cM();
  };
  const openEditBill=b=>{setBillForm({id:b.id,billNum:b.billNum,customerId:b.customerId,soNums:[...b.soNums],cnIds:[...(b.cnIds||[])],date:b.date,note:b.note||""});oM("addBill");};

  const TAB_GROUPS=[[["ap","จ่ายซัพพลายเออร์"],["supcn","ใบลดหนี้ (ซัพฯ)"]],[["ar","เก็บเงินลูกค้า"],["billing","ใบวางบิล"],["cn","ใบลดหนี้"]],[["cheque","เช็ค"],["bank","บัญชีธนาคาร"]]];

  return <div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--line)",overflowX:"auto"}}>{TAB_GROUPS.map((grp,gi)=><React.Fragment key={gi}>{gi>0&&<span style={{borderLeft:"1.5px solid var(--line)",margin:"6px 4px",alignSelf:"stretch"}}/>}{grp.map(v=><button key={v[0]} onClick={()=>{setSub(v[0]);setFSt("all");setChqFilter("all");setAccFilter("all");setSearch("");}} style={{...TB,fontWeight:sub===v[0]?600:400,borderBottom:sub===v[0]?"2px solid var(--text)":"2px solid transparent",color:sub===v[0]?"var(--text)":"var(--dim)"}}>{v[1]}</button>)}</React.Fragment>)}</div>

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
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{(sub==="ap"?["PO","ซัพพลายเออร์"]:["SO","ลูกค้า","เงื่อนไข","ครบกำหนด"]).concat(["ยอด","ชำระแล้ว"]).concat(sub==="ap"?["หักลดหนี้"]:[]).concat(["ค้าง","ความคืบหน้า"]).concat(sub==="ar"?["วางบิล"]:[]).concat([""]).map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(it=>{const bl=sub==="ar"?soBillMap[it.soNum]:null;return<tr key={it.id} style={{borderBottom:"0.5px solid var(--line)",background:it.overdue?"rgba(255,59,48,0.06)":""}}>
      <td style={{padding:"8px",fontWeight:500,color:"var(--blue)"}}>{sub==="ap"?<span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewPO(it)}>{it.poNum}</span>:<span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewSO(it)}>{it.soNum}</span>}</td>
      <td style={{padding:"8px"}}>{sub==="ap"?(()=>{const sup=contacts.find(x=>x.id===it.supplierId);return sup?<span onClick={()=>setViewSupplier(sup)} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{cursor:"pointer",color:"var(--blue)"}}>{it.supName}</span>:it.supName;})():(()=>{const c=contacts.find(x=>x.id===it.customerId);return c?<span onClick={()=>setViewProfile(c)} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{cursor:"pointer",color:"var(--blue)"}}>{it.custName}</span>:it.custName;})()}</td>
      {sub==="ar"&&<td style={{padding:"8px",fontSize:12}}>{it.payType==="credit"?<span style={{background:"var(--blue-bg)",color:"var(--blue)",borderRadius:4,padding:"2px 8px",fontSize:11}}>{"เครดิต "+it.creditDays+" วัน"}</span>:<span style={{background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:4,padding:"2px 8px",fontSize:11}}>เงินสด 7 วัน</span>}</td>}
      {sub==="ar"&&<td style={{padding:"8px",fontSize:12}}>{it.dueDate?(()=>{const days=it.overdue?Math.ceil((new Date(todayStr())-new Date(it.dueDate))/(1000*60*60*24)):0;const agColor=days>60?"#b00":days>30?"var(--red)":"var(--orange)";return<span style={{fontWeight:500,color:it.overdue?agColor:"var(--text)"}}>{toBE(it.dueDate)}{it.overdue&&<span style={{marginLeft:4,fontSize:10,background:days>30?"rgba(176,0,0,0.12)":"rgba(255,59,48,0.12)",color:agColor,borderRadius:4,padding:"1px 6px",fontWeight:600}}>{"เกิน "+days+" วัน"}</span>}</span>;})():<span style={{color:"var(--faint)"}}>—</span>}</td>}
      <td style={{padding:"8px"}}>{"฿"+fmt(it.total)}</td><td style={{padding:"8px",color:"var(--green)"}}>{"฿"+fmt(it.paid)}</td>{sub==="ap"&&<td style={{padding:"8px",color:it.cnDeduct>0?"var(--orange)":"var(--faint)"}}>{it.cnDeduct>0?"฿"+fmt(it.cnDeduct):"-"}</td>}<td style={{padding:"8px",color:it.remaining>0?"var(--red)":"var(--green)",fontWeight:600}}>{"฿"+fmt(Math.max(0,it.remaining))}</td>
      <td style={{padding:"8px",minWidth:100}}>{(()=>{const settled=it.paid+(it.cnDeduct||0);const pct=it.total>0?Math.round(settled/it.total*100):0;return<div><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--dim)",marginBottom:2}}><span>{pct+"%"}</span>{stB(it.status2)}</div><div style={{background:"var(--hover)",borderRadius:3,height:5,overflow:"hidden"}}><div style={{background:pct>=100?"var(--green)":pct>0?"var(--blue)":"var(--hover)",borderRadius:3,height:5,width:Math.min(100,pct)+"%",transition:"width 0.3s"}}/></div></div>;})()}</td>
      {sub==="ar"&&<td style={{padding:"8px"}}>{bl?<span style={{fontSize:11,cursor:"pointer"}} onClick={()=>{setSub("billing");setViewBill(bl);}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>วางบิลแล้ว</span><span style={{marginLeft:4,color:"var(--blue)",fontWeight:500}}>{bl.billNum}</span></span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่วางบิล</span>}</td>}
      <td style={{padding:"8px",whiteSpace:"nowrap"}}><div style={{display:"flex",gap:4}}>{ed&&it.status2!=="paid"&&<button onClick={()=>openPay(it)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",fontFamily:"inherit"}}>{sub==="ap"?"+ จ่าย":"+ รับ"}</button>}{ed&&it.paid>0&&<button onClick={()=>setViewPayHist(it)} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>ประวัติ</button>}</div></td>
    </tr>;})}</tbody></table></div>
    </>;})()}

    {sub==="cheque"&&<>
      <div className="stat-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <StatCard label="เช็คทั้งหมด" value={cheques.length}/>
        <StatCard label="รอขึ้นเงิน" value={cheques.filter(c=>c.status==="pending").length} color="var(--orange)" accentBg="rgba(255,149,0,0.14)" sub={"฿"+fmt(chqTotalPending)}/>
        <StatCard label="นำฝากแล้ว" value={cheques.filter(c=>c.status==="deposited").length} color="var(--blue)" accentBg="var(--blue-bg)"/>
        <StatCard label="เคลียร์แล้ว" value={cheques.filter(c=>c.status==="cleared").length} color="var(--green)" accentBg="rgba(52,199,89,0.12)" sub={cheques.filter(c=>c.status==="bounced").length>0?cheques.filter(c=>c.status==="bounced").length+" เด้ง":""}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[{key:"all",label:"ทั้งหมด"},...CHQ_ST].map(v=><button key={v.key} onClick={()=>setChqFilter(v.key)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(chqFilter===v.key?"var(--text)":"var(--line)"),background:chqFilter===v.key?"var(--text)":"transparent",color:chqFilter===v.key?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{v.label}</button>)}</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={()=>{setChqForm({chequeNo:"",bank:"",amount:"",date:todayStr(),dueDate:"",from:"",refId:"",note:"",status:"pending"});oM("addChq");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ เพิ่มเช็ค</button>}</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["เลขที่เช็ค","ธนาคาร","จำนวน","วันที่รับ","วันครบกำหนด","จาก","อ้างอิง","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
      <tbody>{chqFiltered.length===0?<tr><td colSpan={9} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีเช็คในระบบ</div>{ed&&<button onClick={()=>{setChqForm({chequeNo:"",bank:"",amount:"",date:todayStr(),dueDate:"",from:"",refId:"",note:"",status:"pending"});oM("addChq");}} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ เพิ่มเช็ครายการแรก</button>}</td></tr>:chqFiltered.map(c=>{
        const st=CHQ_ST.find(s=>s.key===c.status)||CHQ_ST[0];
        const overdue=c.status==="pending"&&c.dueDate&&c.dueDate<todayStr();
        return<tr key={c.id} style={{borderBottom:"0.5px solid var(--line)",background:overdue?"rgba(255,59,48,0.06)":""}}>
          <td style={{padding:"8px",fontWeight:500}}>{c.chequeNo}</td>
          <td style={{padding:"8px"}}>{c.bank}</td>
          <td style={{padding:"8px",fontWeight:600}}>{"฿"+fmt(c.amount)}</td>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(c.date)}</td>
          <td style={{padding:"8px",fontSize:12}}>{c.dueDate?<span style={{fontWeight:500,color:overdue?"var(--red)":"var(--text)"}}>{toBE(c.dueDate)}{overdue&&<span style={{marginLeft:4,fontSize:10,background:"rgba(255,59,48,0.12)",color:"var(--red)",borderRadius:4,padding:"1px 6px"}}>เกินกำหนด</span>}</span>:"—"}</td>
          <td style={{padding:"8px"}}>{c.from||"—"}</td>
          <td style={{padding:"8px",color:"var(--blue)",fontSize:12}}>{c.refId||"—"}</td>
          <td style={{padding:"8px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:st.bg,color:st.color}}>{st.label}</span>{c.depositAccId&&(c.status==="deposited"||c.status==="cleared")&&(()=>{const da=bankAccs.find(a=>a.id===c.depositAccId);return da?<span style={{fontSize:10,color:"var(--dim)",marginLeft:4}}>{"→ "+da.name}</span>:null;})()}{c.depositDate&&c.status==="deposited"&&<span style={{fontSize:10,color:"var(--faint)",marginLeft:4}}>{toBE(c.depositDate)}</span>}</td>
          <td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&<button onClick={()=>openChqEdit(c)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--dim)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>แก้ไข</button>}
          {ed&&c.status==="pending"&&<><button onClick={()=>setChqConfirm({id:c.id,action:"deposited",chequeNo:c.chequeNo,amount:c.amount,accId:bankAccs[0]?.id||1,depositDate:todayStr()})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>นำฝาก</button><button onClick={()=>updateChqStatus(c.id,"bounced")} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>เด้ง</button></>}
          {ed&&c.status==="deposited"&&<button onClick={()=>setChqConfirm({id:c.id,action:"cleared",chequeNo:c.chequeNo,amount:c.amount})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",fontFamily:"inherit"}}>เคลียร์</button>}
          </td>
        </tr>;})}
      </tbody></table></div>
      {chqConfirm&&<Modal title={chqConfirm.action==="deposited"?"ยืนยันนำฝากเช็ค":"ยืนยันเคลียร์เช็ค"} onClose={()=>setChqConfirm(null)}>
        <div style={{padding:"8px 0",fontSize:13,color:"var(--text)"}}>
          <div style={{marginBottom:8}}>{chqConfirm.action==="deposited"?"ต้องการนำฝากเช็คนี้?":"ต้องการเคลียร์เช็คนี้?"}</div>
          <div style={{display:"flex",gap:16,padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:12}}>
            <div><span style={{color:"var(--dim)",fontSize:12}}>เลขที่เช็ค</span><div style={{fontWeight:600}}>{chqConfirm.chequeNo}</div></div>
            <div><span style={{color:"var(--dim)",fontSize:12}}>จำนวน</span><div style={{fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(chqConfirm.amount)}</div></div>
          </div>
          {chqConfirm.action==="deposited"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="นำฝากเข้าบัญชี"><CustomSelect value={String(chqConfirm.accId)} onChange={v=>setChqConfirm(p=>({...p,accId:+v}))} options={bankAccs.filter(a=>hasPerm(a,"clearCheque")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>
            <Field label="วันที่นำฝาก"><ThaiDateInput value={chqConfirm.depositDate||todayStr()} onChange={e=>setChqConfirm(p=>({...p,depositDate:e.target.value}))}/></Field>
          </div>}
        </div>
        <MBtns onCancel={()=>setChqConfirm(null)} onSave={()=>{if(chqConfirm.action==="deposited"){updateChqStatus(chqConfirm.id,"deposited",{depositAccId:chqConfirm.accId,depositDate:chqConfirm.depositDate});}else{updateChqStatus(chqConfirm.id,"cleared");}setChqConfirm(null);}} saveLabel="ยืนยัน"/>
      </Modal>}
    </>}

    {sub==="bank"&&<>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {ed&&<button onClick={()=>{setAccForm({name:"",bank:"",accNo:"",perms:{...DEF_PERMS}});setEditAcc(null);oM("addAcc");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ เพิ่มบัญชี</button>}
        {ed&&bankAccs.length>=2&&<button onClick={()=>{setTfForm({fromAcc:String(bankAccs[0]?.id||""),toAcc:String(bankAccs[1]?.id||""),amount:"",date:todayStr(),note:""});oM("transfer");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>โอนระหว่างบัญชี</button>}
        {ed&&bankAccs.length>0&&<button onClick={()=>{setWdForm({accId:String(bankAccs[0]?.id||""),amount:"",date:todayStr(),note:""});oM("withdraw");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.12)",color:"var(--orange)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>ถอนเงินสด</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:16}}>
        {bankAccs.map(acc=>{const bal=getAccBal(acc.id);const txns=bankTxns.filter(t=>t.accId===acc.id);const todayIn=txns.filter(t=>t.type==="in"&&(t.date||"").startsWith(todayStr())).reduce((s,t)=>s+t.amount,0);const todayOut=txns.filter(t=>t.type==="out"&&(t.date||"").startsWith(todayStr())).reduce((s,t)=>s+t.amount,0);const last=txns.length>0?txns[txns.length-1]:null;const bankColor=getBankColor(acc.bank);
        return<div key={acc.id} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"16px 20px",borderLeft:"4px solid "+bankColor,position:"relative",overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontSize:11,color:bankColor,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:2}}>{acc.bank}</div>
              <div style={{fontWeight:600,fontSize:15}}>{acc.name}</div>
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
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={()=>{setTxnForm({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:""});oM("addTxn");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ บันทึกรายการ</button>}</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["วันที่","บัญชี","ประเภท","จำนวน","จาก/ถึง","อ้างอิง","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
      <tbody>{txnFiltered.length===0?<tr><td colSpan={8} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีรายการเคลื่อนไหว</div>{ed&&<button onClick={()=>{setTxnForm({accId:bankAccs[0]?.id||1,type:"in",amount:"",date:todayStr(),from:"",refId:"",note:""});oM("addTxn");}} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ บันทึกรายการแรก</button>}</td></tr>:[...txnFiltered].reverse().map(t=>{
        const acc=bankAccs.find(a=>a.id===t.accId);
        return<tr key={t.id} style={{borderBottom:"0.5px solid var(--line)"}}>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(t.date)}</td>
          <td style={{padding:"8px",fontWeight:500}}>{acc?acc.name:"—"}</td>
          <td style={{padding:"8px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,fontWeight:600,background:t.type==="in"?"rgba(52,199,89,0.12)":"rgba(255,59,48,0.12)",color:t.type==="in"?"var(--green)":"var(--red)"}}>{t.type==="in"?"เงินเข้า":"เงินออก"}</span></td>
          <td style={{padding:"8px",fontWeight:600,color:t.type==="in"?"var(--green)":"var(--red)"}}>{(t.type==="in"?"+":"-")+"฿"+fmt(t.amount)}</td>
          <td style={{padding:"8px"}}>{t.from||"—"}</td>
          <td style={{padding:"8px",color:"var(--blue)",fontSize:12}}>{t.refId||"—"}</td>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{t.note||"—"}</td>
          <td style={{padding:"8px",whiteSpace:"nowrap"}}>{cd&&<button onClick={()=>setConfirmDelTxn(t)} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</td>
        </tr>;})}
      </tbody></table></div>
    </>}

    {sub==="billing"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
        <StatCard label="ใบวางบิลทั้งหมด" value={billings.length}/>
        <StatCard label="รอเก็บเงิน" value={billings.filter(b=>b.status==="pending").length} color="var(--orange)"/>
        <StatCard label="ยอดค้าง" value={"฿"+fmt(billings.filter(b=>b.status==="pending").reduce((s,b)=>s+b.net,0))} color="var(--red)"/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["all","ทั้งหมด"],["pending","รอเก็บเงิน"],["collected","เก็บแล้ว"]].map(v=><button key={v[0]} onClick={()=>setBillFilter(v[0])} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(billFilter===v[0]?"var(--text)":"var(--line)"),background:billFilter===v[0]?"var(--text)":"transparent",color:billFilter===v[0]?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{v[1]}</button>)}</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={()=>{setBillForm({customerId:"",soNums:[],cnIds:[],date:todayStr(),note:""});oM("addBill");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบวางบิล</button>}</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["เลขที่","ลูกค้า","วันที่","SO","ยอดรวม","หัก CN","ยอดสุทธิ","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
      <tbody>{billList.length===0?<tr><td colSpan={9} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีใบวางบิล</div>{ed&&<button onClick={()=>{setBillForm({customerId:"",soNums:[],cnIds:[],date:todayStr(),note:""});oM("addBill");}} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบวางบิลแรก</button>}</td></tr>:billList.map(b=>{
        const cust=contacts.find(c=>c.id===b.customerId);
        return<tr key={b.id} style={{borderBottom:"0.5px solid var(--line)"}}>
          <td style={{padding:"8px",fontWeight:500,color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewBill(b)}>{b.billNum}</td>
          <td style={{padding:"8px"}}>{cust?cN(cust):"—"}</td>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(b.date)}</td>
          <td style={{padding:"8px",fontSize:12}}>{(b.soNums||[]).map((sn,i)=>{const so=sales.find(s=>s.soNum===sn);return<span key={sn}>{i>0&&", "}<span style={{color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>{if(so){const cust=contacts.find(c=>c.id===so.customerId);const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const paid=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cust?cN(cust):"—",total:tot,paid,remaining:tot-paid});}}}>{sn}</span></span>;})}</td>
          <td style={{padding:"8px"}}>{"฿"+fmt(b.soTotal)}</td>
          <td style={{padding:"8px",color:"var(--red)"}}>{"- ฿"+fmt(b.cnTotal)}</td>
          <td style={{padding:"8px",fontWeight:600}}>{"฿"+fmt(b.net)}</td>
          <td style={{padding:"8px"}}>{b.status==="collected"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>เก็บแล้ว</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>รอเก็บเงิน</span>}</td>
          <td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&b.status==="pending"&&<><button onClick={()=>openEditBill(b)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--dim)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>setConfirmBill(b)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",fontFamily:"inherit"}}>เก็บเงินแล้ว</button></>}</td>
        </tr>;
      })}</tbody></table></div>
    </>}

    {sub==="cn"&&<>
      <div className="stat-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <StatCard label="ใบลดหนี้ทั้งหมด" value={cnotes.length}/>
        <StatCard label="คืนสินค้า" value={cnotes.filter(c=>c.type==="return").length} color="var(--blue)" accentBg="var(--blue-bg)"/>
        <StatCard label="สินค้าชำรุด" value={cnotes.filter(c=>c.type==="defective").length} color="var(--orange)" accentBg="rgba(255,149,0,0.14)"/>
        <StatCard label="ยอดรวม CN" value={"฿"+fmt(cnotes.reduce((s,c)=>s+cnTot(c),0))} color="var(--red)" accentBg="rgba(255,59,48,0.12)"/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{key:"all",label:"ทั้งหมด"},...CN_TYPES].map(v=><button key={v.key} onClick={()=>setCnFilter(v.key)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(cnFilter===v.key?"var(--text)":"var(--line)"),background:cnFilter===v.key?"var(--text)":"transparent",color:cnFilter===v.key?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{v.label}</button>)}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={()=>{setCnForm({type:"return",customerId:"",soNum:"",date:todayStr(),items:[],amount:"",reason:"",note:""});oM("addCN");}} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบลดหนี้</button>}</div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["เลขที่ CN","ประเภท","ลูกค้า","อ้างอิง SO","วันที่","ยอด","สถานะ","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
      <tbody>{cnList.length===0?<tr><td colSpan={9} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีใบลดหนี้</div>{ed&&<button onClick={()=>{setCnForm({type:"return",customerId:"",soNum:"",date:todayStr(),items:[],amount:"",reason:"",note:""});oM("addCN");}} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบลดหนี้แรก</button>}</td></tr>:cnList.map(cn=>{
        const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];
        const cust=contacts.find(c=>c.id===cn.customerId);
        const tot=cnTot(cn);
        const usedBill=billings.find(b=>(b.cnIds||[]).includes(cn.id));
        return<tr key={cn.id} style={{borderBottom:"0.5px solid var(--line)"}}>
          <td style={{padding:"8px",fontWeight:500,color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewCN(cn)}>{cn.cnNum}</td>
          <td style={{padding:"8px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:tp.bg,color:tp.color}}>{tp.label}</span></td>
          <td style={{padding:"8px"}}>{cust?cN(cust):"—"}</td>
          <td style={{padding:"8px",fontSize:12}}>{cn.soNum?<span style={{color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const so=sales.find(s=>s.soNum===cn.soNum);if(so){const cu2=contacts.find(c=>c.id===so.customerId);const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const pd=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cu2?cN(cu2):"—",total:tot,paid:pd,remaining:tot-pd});}}}>{cn.soNum}</span>:"—"}</td>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(cn.date)}</td>
          <td style={{padding:"8px",fontWeight:600,color:"var(--red)"}}>{"฿"+fmt(tot)}</td>
          <td style={{padding:"8px"}}>{usedBill?<span style={{fontSize:11}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>ใช้แล้ว</span><span style={{marginLeft:6,color:"var(--blue)",fontWeight:500,cursor:"pointer"}} onClick={()=>{setSub("billing");setViewBill(usedBill);}}>{usedBill.billNum}</span></span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่ได้ใช้</span>}</td>
          <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{cn.reason||cn.note||"—"}</td>
          <td style={{padding:"8px"}}>{ed&&<><button onClick={()=>{const items=cn.items||[];let adjItems=items;if(cn.type==="return"&&cn.soNum){const so=sales.find(s=>s.soNum===cn.soNum);if(so){const sub=(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const d=so.discountAmt||0;const r=sub>0?(sub-d)/sub:1;adjItems=items.map(it=>{const si=(so.items||[]).find(x=>x.productId===it.productId);return{...it,price:si?round2(si.price*r):it.price};});}}setCnForm({...cn,amount:String(cn.type==="promo"?cn.amount:""),items:adjItems});oM("addCN");}} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--dim)",cursor:"pointer",fontFamily:"inherit",marginRight:4}}>แก้ไข</button>{!usedBill&&<button onClick={()=>{if(confirm("ยืนยันลบใบลดหนี้ "+cn.cnNum+" ?")){if(cn.type==="return"&&cn.items){for(const it of cn.items){const pr=products.find(p=>p.id===it.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===it.productId?{...p,stock:p.stock-it.qty}:p));addLog(mkLog(it.productId,"cn_cancel",it.qty,bef,Math.max(0,bef-it.qty),cn.cnNum,"ยกเลิก CN",cu?.username));}}if(cn.type==="defective"&&cn.defectiveId)setDefectives(p=>p.map(d=>d.id===cn.defectiveId?{...d,custStatus:"pending"}:d));setCNotes(p=>p.filter(c=>c.id!==cn.id));}}} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</>}</td>
        </tr>;
      })}</tbody></table></div>
    </>}

    {viewCN&&(()=>{const cn=viewCN;const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];const cust=contacts.find(c=>c.id===cn.customerId);const tot=cnTot(cn);const usedBill=billings.find(b=>(b.cnIds||[]).includes(cn.id));const df=cn.defectiveId?defectives.find(d=>d.id===cn.defectiveId):null;
      const cnSO=cn.soNum?sales.find(s=>s.soNum===cn.soNum):null;const cnSOSub=cnSO?(cnSO.items||[]).reduce((s,i)=>s+i.qty*i.price,0):0;const cnDiscR=cnSO&&cnSO.discountAmt>0&&cnSOSub>0?(cnSOSub-cnSO.discountAmt)/cnSOSub:1;const adjP=(it)=>{if(cnDiscR===1)return it.price;const si=cnSO?(cnSO.items||[]).find(x=>x.productId===it.productId):null;return si?round2(si.price*cnDiscR):it.price;};
      return<Modal title={"รายละเอียดใบลดหนี้ — "+cn.cnNum} onClose={()=>setViewCN(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{cn.cnNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ประเภท</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:tp.bg,color:tp.color,fontWeight:500}}>{tp.label}</span></div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(cn.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ลูกค้า</span><div style={{fontWeight:600}}>{cust?cN(cust):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>อ้างอิง SO</span><div>{cn.soNum?<span style={{color:"var(--blue)",fontWeight:500,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const so=sales.find(s=>s.soNum===cn.soNum);if(so){const cu3=contacts.find(c=>c.id===so.customerId);const tot3=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const pd3=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cu3?cN(cu3):"—",total:tot3,paid:pd3,remaining:tot3-pd3});setViewCN(null);}}}>{cn.soNum}</span>:<span style={{fontWeight:500}}>—</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div>{usedBill?<span style={{fontSize:12}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>ใช้แล้ว</span><span style={{marginLeft:6,color:"var(--blue)",fontWeight:500}}>{usedBill.billNum}</span></span>:<span style={{fontSize:12,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่ได้ใช้</span>}</div></div>
        </div>

        {df&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ข้อมูลสินค้าชำรุด</div>
          <div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:14,fontSize:13}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
              <div><span style={{color:"var(--dim)"}}>รหัส:</span> <b style={{color:"var(--blue)"}}>{df.code}</b></div>
              <div><span style={{color:"var(--dim)"}}>สินค้า:</span> <b>{(()=>{const pr=products.find(p=>p.id===df.productId);return pr?pN(pr):"—";})()}</b></div>
              <div><span style={{color:"var(--dim)"}}>S/N:</span> <span style={{fontFamily:"monospace"}}>{df.serialNo||"—"}</span></div>
              <div><span style={{color:"var(--dim)"}}>อาการ:</span> {df.symptom||"—"}</div>
            </div>
          </div>
        </>}

        {(cn.items||[]).length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({cn.items.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ราคา/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{cn.items.map((it,i)=>{const pr=products.find(p=>p.id===it.productId);const ap=adjP(it);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
              <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
              <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
              <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(ap)}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*ap)}</td>
            </tr>;})}</tbody></table>
          </div>
        </>}

        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700}}><span>ยอดรวม CN</span><span style={{color:"var(--red)"}}>{"฿"+fmt(tot)}</span></div>
        </div>

        {(cn.reason||cn.note)&&<div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",fontSize:13}}>
          {cn.reason&&<div><span style={{color:"var(--dim)"}}>เหตุผล:</span> {cn.reason}</div>}
          {cn.note&&<div style={{marginTop:cn.reason?4:0}}><span style={{color:"var(--dim)"}}>หมายเหตุ:</span> {cn.note}</div>}
        </div>}
      </Modal>;
    })()}

    {viewSO&&(()=>{const so=viewSO;const cust=contacts.find(c=>c.id===so.customerId);const bl=soBillMap[so.soNum];const payHist=payments.filter(p=>p.refId===so.soNum&&p.type==="ar");
      let dueDate=null,overdue=false;
      if(so.date){const days=so.payType==="credit"&&so.creditDays>0?so.creditDays:7;const d=new Date(so.date);d.setDate(d.getDate()+days);dueDate=d.toISOString().slice(0,10);overdue=so.remaining>0&&dueDate<todayStr();}
      const stLabel=so.paid===0?"รอชำระ":so.remaining<=0?"ชำระแล้ว":"บางส่วน";const stColor=so.paid===0?"var(--orange)":so.remaining<=0?"var(--green)":"var(--blue)";const stBg=so.paid===0?"rgba(255,149,0,0.14)":so.remaining<=0?"rgba(52,199,89,0.12)":"var(--blue-bg)";
      return<Modal title={"รายละเอียด SO — "+so.soNum} onClose={()=>setViewSO(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{so.soNum}</div></div>
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

    {viewProfile&&<CustomerProfile customer={viewProfile} sales={sales} quotes={quotes} payments={payments} products={products} pN={pN} onClose={()=>setViewProfile(null)}/>}
    {viewSupplier&&<SupplierProfile supplier={viewSupplier} pos={pos} payments={payments} products={products} pN={pN} cN={cN} onClose={()=>setViewSupplier(null)}/>}

    {modal==="addPay"&&ed&&<Modal title={(payForm.editId?"แก้ไขชำระ — ":sub==="ap"?"จ่าย — ":"รับ — ")+payForm.refId+" — "+(payForm.name||"")} onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="จำนวน (฿)"><input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="วิธี"><CustomSelect value={payForm.method} onChange={v=>setPayForm(f=>({...f,method:v}))} options={payForm.type==="ap"?["โอนเงินออก","จ่ายEPP"]:["โอนเงิน","เงินสด","เช็ค","บัตรเครดิต"]}/></Field>
        {payForm.type==="ap"&&<Field label={payForm.method==="จ่ายEPP"?"จ่ายจากบัญชี":"โอนจากบัญชี"}><CustomSelect value={String(payForm.accId||"")} onChange={v=>setPayForm(f=>({...f,accId:+v}))} options={bankAccs.filter(a=>hasPerm(a,payForm.method==="จ่ายEPP"?"payEPP":"transferOut")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>}
        {payForm.type==="ar"&&payForm.method==="โอนเงิน"&&<Field label="เข้าบัญชี"><CustomSelect value={String(payForm.accId||"")} onChange={v=>setPayForm(f=>({...f,accId:+v}))} options={bankAccs.filter(a=>hasPerm(a,"receive")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>}
        {payForm.type==="ar"&&payForm.method==="เช็ค"&&<>
          <Field label="เลขที่เช็ค *"><input value={payForm.chequeNo} onChange={e=>setPayForm(f=>({...f,chequeNo:e.target.value}))} style={IB} placeholder="เลขที่เช็ค"/></Field>
          <Field label="ธนาคาร"><input value={payForm.chequeBank} onChange={e=>setPayForm(f=>({...f,chequeBank:e.target.value}))} style={IB} placeholder="ชื่อธนาคาร"/></Field>
          <Field label="วันครบกำหนด"><ThaiDateInput value={payForm.chequeDue} onChange={e=>setPayForm(f=>({...f,chequeDue:e.target.value}))}/></Field>
        </>}
        <Field label="หมายเหตุ"><input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
      </div>
      <MBtns onCancel={cM} onSave={savePay}/>
    </Modal>}

    {modal==="addChq"&&ed&&<Modal title={chqForm.id?"แก้ไขเช็ค":"เพิ่มเช็ค"} onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="เลขที่เช็ค"><input value={chqForm.chequeNo} onChange={e=>setChqForm(f=>({...f,chequeNo:e.target.value}))} style={IB}/></Field>
        <Field label="ธนาคาร"><input value={chqForm.bank} onChange={e=>setChqForm(f=>({...f,bank:e.target.value}))} style={IB}/></Field>
        <Field label="จำนวน (฿)"><input type="number" value={chqForm.amount} onChange={e=>setChqForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่รับ"><ThaiDateInput value={chqForm.date} onChange={e=>setChqForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="วันครบกำหนด"><ThaiDateInput value={chqForm.dueDate} onChange={e=>setChqForm(f=>({...f,dueDate:e.target.value}))}/></Field>
        <Field label="จาก"><input value={chqForm.from} onChange={e=>setChqForm(f=>({...f,from:e.target.value}))} style={IB}/></Field>
        <Field label="อ้างอิง (SO/PO)"><input value={chqForm.refId} onChange={e=>setChqForm(f=>({...f,refId:e.target.value}))} style={IB}/></Field>
        {chqForm.id?<Field label="สถานะ"><CustomSelect value={chqForm.status} onChange={v=>setChqForm(f=>({...f,status:v}))} options={CHQ_ST.map(s=>({value:s.key,label:s.label}))}/></Field>
        :<Field label="หมายเหตุ"><input value={chqForm.note} onChange={e=>setChqForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>}
        {chqForm.id?<Field label="หมายเหตุ"><input value={chqForm.note||""} onChange={e=>setChqForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>:null}
      </div>
      {chqForm.id&&cd&&<div style={{marginTop:12,textAlign:"right"}}><button onClick={()=>{setCheques(p=>p.filter(c=>c.id!==chqForm.id));cM();}} style={{padding:"4px 12px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบเช็ค</button></div>}
      <MBtns onCancel={cM} onSave={saveChq}/>
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

    {delAcc&&<Modal title="ยืนยันลบบัญชี" onClose={()=>setDelAcc(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบ \""+delAcc.name+" — "+delAcc.bank+"\" และรายการเคลื่อนไหวทั้งหมดของบัญชีนี้"}</div>
      <MBtns onCancel={()=>setDelAcc(null)} onSave={()=>deleteAcc(delAcc.id)} saveLabel="ลบ"/>
    </Modal>}

    {modal==="transfer"&&ed&&<Modal title="โอนระหว่างบัญชี" onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="จากบัญชี"><CustomSelect value={tfForm.fromAcc} onChange={v=>setTfForm(f=>({...f,fromAcc:v}))} options={bankAccs.filter(a=>hasPerm(a,"transferOut")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank+" (฿"+fmt(getAccBal(a.id))+")" }))}/></Field>
        <Field label="ไปบัญชี"><CustomSelect value={tfForm.toAcc} onChange={v=>setTfForm(f=>({...f,toAcc:v}))} options={bankAccs.filter(a=>String(a.id)!==tfForm.fromAcc&&hasPerm(a,"receive")).map(a=>({value:String(a.id),label:a.name+" — "+a.bank+" (฿"+fmt(getAccBal(a.id))+")" }))}/></Field>
        <Field label="จำนวนเงิน (฿)"><input type="number" value={tfForm.amount} onChange={e=>setTfForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={tfForm.date} onChange={e=>setTfForm(f=>({...f,date:e.target.value}))}/></Field>
        <div style={{gridColumn:"1/-1"}}><Field label="หมายเหตุ"><input value={tfForm.note} onChange={e=>setTfForm(f=>({...f,note:e.target.value}))} style={IB}/></Field></div>
      </div>
      {tfForm.fromAcc&&tfForm.toAcc&&tfForm.amount&&+tfForm.amount>0&&<div style={{background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:8,padding:"12px",marginTop:12,fontSize:13,color:"var(--blue)"}}>
        {"โอน ฿"+fmt(+tfForm.amount)+" จาก "+((bankAccs.find(a=>a.id===+tfForm.fromAcc)||{}).name||"")+" → "+((bankAccs.find(a=>a.id===+tfForm.toAcc)||{}).name||"")}
      </div>}
      <MBtns onCancel={cM} onSave={saveTransfer} saveLabel="ยืนยันโอน"/>
    </Modal>}

    {modal==="withdraw"&&ed&&<Modal title="ถอนเงินสด" onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="จากบัญชี"><CustomSelect value={wdForm.accId} onChange={v=>setWdForm(f=>({...f,accId:v}))} options={bankAccs.map(a=>({value:String(a.id),label:a.name+" — "+a.bank+" (฿"+fmt(getAccBal(a.id))+")" }))}/></Field>
        <Field label="จำนวนเงิน (฿)"><input type="number" value={wdForm.amount} onChange={e=>setWdForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>
        <Field label="วันที่"><ThaiDateInput value={wdForm.date} onChange={e=>setWdForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="หมายเหตุ"><input value={wdForm.note} onChange={e=>setWdForm(f=>({...f,note:e.target.value}))} style={IB} placeholder="เช่น ถอนเงินสดย่อย"/></Field>
      </div>
      {wdForm.accId&&wdForm.amount&&+wdForm.amount>0&&<div style={{background:"rgba(255,149,0,0.12)",border:"1px solid var(--orange)",borderRadius:8,padding:"12px",marginTop:12,fontSize:13,color:"var(--orange)"}}>
        {"ถอนเงินสด ฿"+fmt(+wdForm.amount)+" จาก "+((bankAccs.find(a=>a.id===+wdForm.accId)||{}).name||"")}
      </div>}
      <MBtns onCancel={cM} onSave={()=>{if(!wdForm.accId||!wdForm.amount||+wdForm.amount<=0)return;setBankTxns(p=>[...p,{id:Date.now(),accId:+wdForm.accId,type:"out",amount:+wdForm.amount,date:wdForm.date,from:"ถอนเงินสด",refId:"WD-"+Date.now(),note:wdForm.note}]);cM();}} saveLabel="ยืนยันถอน"/>
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
              <Field label="ธนาคาร"><input value={ln.chequeBank} onChange={e=>updBatchLine(i,"chequeBank",e.target.value)} style={IB}/></Field>
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
              <div><span style={{fontWeight:600,color:"var(--blue)",marginRight:8,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const orig=sales.find(s=>s.soNum===so.soNum);if(orig){const cust2=contacts.find(c=>c.id===orig.customerId);const tot2=orig.items.reduce((s2,i2)=>s2+i2.qty*i2.price,0)-(orig.discountAmt||0);const paid2=payments.filter(p=>p.refId===orig.soNum&&p.type==="ar").reduce((s2,p)=>s2+(+p.amount||0),0);setViewSO({...orig,custName:cust2?cN(cust2):"—",total:tot2,paid:paid2,remaining:tot2-paid2});setViewBill(null);}}}>{so.soNum}</span><span style={{fontSize:11,color:"var(--dim)"}}>{so.date?toBE(so.date):""}</span>{so.payType==="credit"&&<span style={{marginLeft:8,fontSize:10,padding:"1px 6px",borderRadius:4,background:"var(--blue-bg)",color:"var(--blue)"}}>{"เครดิต "+so.creditDays+" วัน"}</span>}</div>
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

    {confirmBill&&(()=>{const b=confirmBill;const cust=contacts.find(c=>c.id===b.customerId);
      return<Modal title={"ยืนยันเก็บเงิน — "+b.billNum} onClose={()=>setConfirmBill(null)}>
        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:13}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>ลูกค้า</span><span style={{fontWeight:600}}>{cust?cN(cust):"—"}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>วันที่</span><span>{toBE(b.date)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>SO ({(b.soNums||[]).length})</span><span>{(b.soNums||[]).join(", ")}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>ยอดรวม SO</span><span>{"฿"+fmt(b.soTotal)}</span></div>
          {b.cnTotal>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"var(--dim)"}}>หัก CN</span><span style={{color:"var(--red)"}}>{"- ฿"+fmt(b.cnTotal)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid var(--line)",fontSize:15,fontWeight:700}}><span>ยอดสุทธิ</span><span style={{color:"var(--green)"}}>{"฿"+fmt(b.net)}</span></div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setConfirmBill(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--text)",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
          <button onClick={()=>{setBillings(p=>p.map(x=>x.id===b.id?{...x,status:"collected"}:x));setConfirmBill(null);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"var(--green)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยืนยันเก็บเงิน</button>
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
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบรายการ "+(confirmDelTxn.type==="in"?"เงินเข้า":"เงินออก")+" ฿"+fmt(confirmDelTxn.amount)+" ("+(confirmDelTxn.from||"—")+") ถาวร"}</div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setConfirmDelTxn(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--text)",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
        <button onClick={()=>{setBankTxns(p=>p.filter(x=>x.id!==confirmDelTxn.id));setConfirmDelTxn(null);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"var(--red)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>
      </div>
    </Modal>}

    {warnMsg&&<Modal title="แจ้งเตือน" onClose={()=>setWarnMsg(null)}>
      <div style={{background:"rgba(255,149,0,0.12)",border:"1px solid var(--orange)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:14,color:"var(--orange)",fontWeight:500}}>{warnMsg}</div>
      <button onClick={()=>setWarnMsg(null)} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:"var(--blue)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ตกลง</button>
    </Modal>}

    {viewPayHist&&<Modal title={"ประวัติชำระ — "+(viewPayHist.soNum||viewPayHist.poNum)} onClose={()=>setViewPayHist(null)}>
      {(()=>{const refId=viewPayHist.soNum||viewPayHist.poNum;const ty=viewPayHist.soNum?"ar":"ap";const pys=payments.filter(p=>p.refId===refId&&p.type===ty);const nameStr=viewPayHist.custName||viewPayHist.supName||"";return pys.length===0?<div style={{textAlign:"center",padding:"2rem",color:"var(--faint)"}}>ยังไม่มีรายการชำระ</div>:<div><div style={{fontSize:12,color:"var(--dim)",marginBottom:8}}>{"ยอดรวม ฿"+fmt(viewPayHist.total)+" — ชำระแล้ว ฿"+fmt(viewPayHist.paid)+" — ค้าง ฿"+fmt(Math.max(0,viewPayHist.remaining))}</div><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","จำนวน","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead><tbody>{pys.map(p=><tr key={p.id} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"8px"}}>{toBE(p.date)}</td><td style={{padding:"8px"}}>{p.method}</td><td style={{padding:"8px",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td><td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{p.note||"—"}</td><td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&<div style={{display:"flex",gap:4}}><button onClick={()=>{setViewPayHist(null);openEditPay(p,nameStr);}} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>{setViewPayHist(null);setConfirmDelPay({pay:p});}} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button></div>}</td></tr>)}</tbody></table></div>;})()}
    </Modal>}

    {modal==="addBill"&&ed&&<Modal title={billForm.id?"แก้ไขใบวางบิล — "+billForm.billNum:"สร้างใบวางบิล"} onClose={cM} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <Field label="ลูกค้า"><CustomSelect searchable value={billForm.customerId} onChange={v=>{setBillForm(f=>({...f,customerId:v,soNums:[],cnIds:[]}));}} options={[{value:"",label:"— เลือกลูกค้า —"},...contacts.filter(c=>c.type==="customer").map(c=>({value:c.id,label:cN(c)}))]}/></Field>
        <Field label="วันที่"><ThaiDateInput value={billForm.date} onChange={e=>setBillForm(f=>({...f,date:e.target.value}))}/></Field>
      </div>
      {billForm.customerId&&<>
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>เลือก SO ที่ครบชำระ</div>
        {billCustSOs.length===0?<div style={{padding:"12px",fontSize:13,color:"var(--faint)",background:"var(--bg)",borderRadius:8,marginBottom:14}}>ไม่มี SO ค้างชำระ</div>:
        <div style={{maxHeight:180,overflowY:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:14}}>
          {billCustSOs.map(so=><label key={so.soNum} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:"1px solid var(--line)",cursor:"pointer",background:billForm.soNums.includes(so.soNum)?"var(--blue-bg)":"transparent"}}>
            <input type="checkbox" checked={billForm.soNums.includes(so.soNum)} onChange={()=>setBillForm(f=>({...f,soNums:f.soNums.includes(so.soNum)?f.soNums.filter(x=>x!==so.soNum):[...f.soNums,so.soNum]}))}/>
            <span style={{fontWeight:500,color:"var(--blue)",minWidth:70}}>{so.soNum}</span>
            <span style={{flex:1,fontSize:12,color:"var(--dim)"}}>{toBE(so.date||"")}</span>
            <span style={{fontWeight:600,color:"var(--red)"}}>{"฿"+fmt(Math.max(0,so.remaining))}</span>
          </label>)}
        </div>}

        {billCustCNs.length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>หัก CN (ถ้ามี)</div>
          <div style={{maxHeight:140,overflowY:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:14}}>
            {billCustCNs.map(cn=>{const tot=cn.type==="promo"?+cn.amount:(cn.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];return<label key={cn.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:"1px solid var(--line)",cursor:"pointer",background:billForm.cnIds.includes(cn.id)?"rgba(255,59,48,0.06)":"transparent"}}>
              <input type="checkbox" checked={billForm.cnIds.includes(cn.id)} onChange={()=>setBillForm(f=>({...f,cnIds:f.cnIds.includes(cn.id)?f.cnIds.filter(x=>x!==cn.id):[...f.cnIds,cn.id]}))}/>
              <span style={{fontWeight:500,color:"var(--blue)",minWidth:80}}>{cn.cnNum}</span>
              <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:tp.bg,color:tp.color}}>{tp.label}</span>
              <span style={{flex:1}}/>
              <span style={{fontWeight:600,color:"var(--red)"}}>{"- ฿"+fmt(tot)}</span>
            </label>;})}
          </div>
        </>}

        {billForm.soNums.length>0&&<div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอดรวม SO</span><span style={{fontWeight:600}}>{"฿"+fmt(billSOTotal)}</span></div>
          {billCNTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>หัก CN</span><span style={{fontWeight:600,color:"var(--red)"}}>{"- ฿"+fmt(billCNTotal)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,paddingTop:6,borderTop:"1px solid var(--line)"}}><span>ยอดสุทธิ</span><span style={{color:billCNTotal>billSOTotal?"var(--red)":"var(--green)"}}>{"฿"+fmt(billNet)}</span></div>
          {billCNTotal>billSOTotal&&<div style={{marginTop:6,fontSize:12,color:"var(--red)",fontWeight:500}}>ยอด CN รวมมากกว่ายอด SO ไม่สามารถสร้างใบวางบิลได้</div>}
        </div>}

        <Field label="หมายเหตุ"><input value={billForm.note} onChange={e=>setBillForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
      </>}
      {billForm.id&&cd&&<div style={{marginTop:12,textAlign:"right"}}><button onClick={()=>{if(confirm("ยืนยันลบใบวางบิล "+billForm.billNum+" ? ข้อมูลจะไม่สามารถกู้คืนได้"))delBill();}} style={{padding:"4px 12px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบใบวางบิล</button></div>}
      <MBtns onCancel={cM} onSave={saveBill}/>
    </Modal>}

    {modal==="addCN"&&ed&&(()=>{
      const isEdit=!!cnForm.id;
      const custSOs=cnForm.customerId?sales.filter(so=>so.customerId===cnForm.customerId&&so.status==="completed"):[];
      const selSO=custSOs.find(so=>so.soNum===cnForm.soNum);
      const soItems=selSO?(selSO.items||[]):[];
      const soSub=soItems.reduce((s,i)=>s+i.qty*i.price,0);
      const soDiscAmt=selSO?.discountAmt||0;
      const discRatio=soSub>0?(soSub-soDiscAmt)/soSub:1;
      const discPrice=p=>round2(p*discRatio);
      const cnItemTotal=(cnForm.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
      const nextCN=()=>{const yr=new Date().getFullYear()+543;const nums=cnotes.filter(c=>c.cnNum?.startsWith("CN-"+yr)).map(c=>+c.cnNum.split("-")[2]||0);return"CN-"+yr+"-"+String(Math.max(0,...nums)+1).padStart(3,"0");};
      const addCnItem=()=>setCnForm(f=>({...f,items:[...f.items,{productId:"",qty:1,price:0}]}));
      const updCnItem=(idx,k,v)=>setCnForm(f=>({...f,items:f.items.map((it,i)=>i===idx?{...it,[k]:v}:it)}));
      const rmCnItem=idx=>setCnForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
      const loadSOItems=soNum=>{const so=custSOs.find(x=>x.soNum===soNum);if(so){const sub=(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const d=so.discountAmt||0;const r=sub>0?(sub-d)/sub:1;setCnForm(f=>({...f,soNum,items:(so.items||[]).map(i=>({productId:i.productId,qty:i.qty,price:round2(i.price*r)}))}));}else setCnForm(f=>({...f,soNum,items:[]}));};
      const saveCN=()=>{
        if(cnForm.type==="defective"&&!cnForm.defectiveId)return;
        if(cnForm.type!=="defective"&&!cnForm.customerId)return;
        if(cnForm.type==="return"&&(!cnForm.soNum||(cnForm.items||[]).length===0))return;
        if(cnForm.type==="promo"&&(!cnForm.amount||+cnForm.amount<=0))return;
        for(const it of(cnForm.items||[])){if(!it.productId||it.qty<=0)return;}
        if(cnForm.type==="defective"||cnForm.type==="return"){
          const refSoNum=cnForm.soNum||(cnForm.defectiveId?defectives.find(d=>d.id===cnForm.defectiveId)?.soNum:null);
          if(refSoNum){
            const refSo=sales.find(s=>s.soNum===refSoNum);
            if(refSo){
              const soSub=(refSo.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
              const soTotal=soSub-(refSo.discountAmt||0);
              const cnItems=(cnForm.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
              if(cnItems>soTotal+0.01){setWarnMsg("ยอด CN (฿"+fmt(cnItems)+") เกินยอด SO ต้นฉบับ (฿"+fmt(soTotal)+")");return;}
              for(const ci of(cnForm.items||[])){const si=(refSo.items||[]).find(x=>x.productId===ci.productId);if(!si){setWarnMsg("สินค้าไม่อยู่ใน SO ต้นฉบับ");return;}if(ci.qty>si.qty){setWarnMsg("จำนวน CN ("+ci.qty+") เกินจำนวนใน SO ("+si.qty+")");return;}}
            }
          }
        }
        const ts=Date.now();
        if(isEdit){
          const orig=cnotes.find(c=>c.id===cnForm.id);
          if(orig&&orig.type==="return"){
            for(const oi of(orig.items||[])){
              const ni=(cnForm.items||[]).find(x=>x.productId===oi.productId);
              const diff=oi.qty-(ni?ni.qty:0);
              if(diff!==0){const pr=products.find(p=>p.id===oi.productId);const bef=pr?pr.stock:0;const aft=bef-diff;setProducts(ps=>ps.map(p=>p.id===oi.productId?{...p,stock:aft}:p));addLog(mkLog(oi.productId,"cn_edit",Math.abs(diff),bef,aft,orig.cnNum,diff>0?"แก้ไข CN ลดจำนวน":"แก้ไข CN เพิ่มจำนวน",cu?.username));}
            }
            for(const ni of(cnForm.items||[])){
              if(!(orig.items||[]).find(x=>x.productId===ni.productId)){const pr=products.find(p=>p.id===ni.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===ni.productId?{...p,stock:p.stock+ni.qty}:p));addLog(mkLog(ni.productId,"cn_edit",ni.qty,bef,bef+ni.qty,orig.cnNum,"แก้ไข CN เพิ่มสินค้า",cu?.username));}
            }
          }
          setCNotes(p=>p.map(c=>c.id===cnForm.id?{...cnForm,amount:cnForm.type==="promo"?+cnForm.amount:0}:c));
        }else{
          const cn={id:ts,cnNum:nextCN(),...cnForm,amount:cnForm.type==="promo"?+cnForm.amount:0};
          setCNotes(p=>[...p,cn]);
          if(cnForm.type==="return"){
            for(const it of cnForm.items){const pr=products.find(p=>p.id===it.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===it.productId?{...p,stock:p.stock+it.qty}:p));addLog(mkLog(it.productId,"cn_return",it.qty,bef,bef+it.qty,cn.cnNum,"CN คืนสินค้า ref "+cnForm.soNum,cu?.username));}
          }
          if(cnForm.type==="defective"&&cnForm.defectiveId){
            setDefectives(p=>p.map(d=>d.id===cnForm.defectiveId?{...d,custStatus:"cn_created"}:d));
          }
        }
        cM();
      };
      return<Modal title={isEdit?"แก้ไขใบลดหนี้":"สร้างใบลดหนี้"} onClose={cM} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <Field label="ประเภท"><CustomSelect value={cnForm.type} onChange={v=>setCnForm(f=>({...f,type:v,items:[],soNum:"",amount:"",customerId:"",defectiveId:""}))} options={CN_TYPES.map(t=>({value:t.key,label:t.label}))}/></Field>
          <Field label="วันที่"><ThaiDateInput value={cnForm.date} onChange={e=>setCnForm(f=>({...f,date:e.target.value}))}/></Field>
          {cnForm.type==="defective"?<Field label="รายการชำรุด"><CustomSelect value={String(cnForm.defectiveId||"")} onChange={v=>{const df=defectives.find(d=>d.id===+v);if(df){const pr=products.find(p=>p.id===df.productId);setCnForm(f=>({...f,defectiveId:+v,customerId:df.customerId,soNum:df.soNum||"",items:[{productId:df.productId,qty:1,price:pr?pr.price:0}]}));}else{setCnForm(f=>({...f,defectiveId:"",customerId:"",soNum:"",items:[]}));}}} options={[{value:"",label:"— เลือกรายการชำรุด —"},...defectives.map(d=>{const pr=products.find(p=>p.id===d.productId);const cu=contacts.find(c=>c.id===d.customerId);return{value:String(d.id),label:d.code+" — "+(pr?pN(pr):"")+" ("+(cu?cN(cu):"")+")"};})]} /></Field>:<>
          <Field label="ลูกค้า"><CustomSelect searchable value={cnForm.customerId} onChange={v=>setCnForm(f=>({...f,customerId:v,soNum:"",items:[]}))} options={[{value:"",label:"— เลือกลูกค้า —"},...contacts.filter(c=>c.type==="customer").map(c=>({value:c.id,label:cN(c)}))]}/></Field>
          {cnForm.type==="return"&&<Field label="อ้างอิง SO"><CustomSelect value={cnForm.soNum} onChange={v=>loadSOItems(v)} options={[{value:"",label:"— เลือก SO —"},...custSOs.map(so=>({value:so.soNum,label:so.soNum}))]}/></Field>}
          </>}
        </div>

        {cnForm.type==="defective"&&cnForm.defectiveId&&(()=>{const df=defectives.find(d=>d.id===cnForm.defectiveId);const pr=df?products.find(p=>p.id===df.productId):null;const cu=df?contacts.find(c=>c.id===df.customerId):null;return<div style={{background:"var(--bg2)",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
            <div><span style={{color:"var(--dim)"}}>ลูกค้า:</span> <b>{cu?cN(cu):"-"}</b></div>
            <div><span style={{color:"var(--dim)"}}>SO:</span> <span style={{color:"var(--blue)"}}>{df?.soNum||"—"}</span></div>
            <div><span style={{color:"var(--dim)"}}>สินค้า:</span> {pr?pN(pr):"-"}</div>
            <div><span style={{color:"var(--dim)"}}>S/N:</span> <span style={{fontFamily:"monospace"}}>{df?.serialNo||"—"}</span></div>
            <div style={{gridColumn:"1/-1"}}><span style={{color:"var(--dim)"}}>อาการ:</span> {df?.symptom||"-"}</div>
          </div>
          {cnForm.items.length>0&&<div style={{fontSize:13,fontWeight:600,marginTop:6,color:"var(--red)"}}>{"ยอดรวม: ฿"+fmt(cnItemTotal)}</div>}
        </div>;})()}

        {cnForm.type==="return"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>รายการสินค้า</div>
            <button onClick={addCnItem} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>+ เพิ่มรายการ</button>
          </div>
          {(cnForm.items||[]).map((it,i)=>{const pr=products.find(p=>p.id===it.productId);const soMax=it.productId?soItems.find(x=>x.productId===it.productId)?.qty||0:0;return<div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,marginBottom:6,alignItems:"end"}}>
            <Field label={i===0?"สินค้า":""}><CustomSelect value={it.productId?String(it.productId):""} onChange={v=>{const p=products.find(x=>x.id===+v);updCnItem(i,"productId",+v);if(p){const si=soItems.find(x=>x.productId===+v);updCnItem(i,"price",si?discPrice(si.price):p.price);if(si)updCnItem(i,"qty",Math.min(it.qty,si.qty));}}} options={[{value:"",label:"— เลือก —"},...(soItems.length>0?(()=>{const opts=soItems.map(si=>{const p=products.find(x=>x.id===si.productId);return{value:String(si.productId),label:p?pN(p)+"  ("+si.qty+")":"—"};});if(it.productId&&!opts.find(o=>o.value===String(it.productId))){const ep=products.find(x=>x.id===it.productId);opts.unshift({value:String(it.productId),label:ep?pN(ep):"—"});}return opts.filter((v,idx,a)=>a.findIndex(x=>x.value===v.value)===idx);})():products.map(p=>({value:String(p.id),label:pN(p),searchText:(p.code||"")+" "+(p.brand||"")})))]}/></Field>
            <Field label={i===0?"จำนวน"+(soMax?" (สูงสุด "+soMax+")":""):""}><input type="number" min="1" max={soMax||undefined} value={it.qty} onChange={e=>{const v=Math.max(1,+e.target.value);updCnItem(i,"qty",soMax?Math.min(v,soMax):v);}} style={{...IB,borderColor:soMax&&it.qty>soMax?"var(--red)":""}}/></Field>
            <Field label={i===0?"ราคา/หน่วย":""}><input type="number" value={it.price} onChange={e=>updCnItem(i,"price",+e.target.value)} style={IB}/></Field>
            <button onClick={()=>rmCnItem(i)} style={{padding:"6px 8px",fontSize:11,color:"var(--red)",background:"none",border:"none",cursor:"pointer",marginBottom:2}}>ลบ</button>
          </div>;})}
          {cnForm.items.length>0&&<div style={{fontSize:13,fontWeight:600,marginTop:6,color:"var(--red)"}}>{"ยอดรวม: ฿"+fmt(cnItemTotal)}{soDiscAmt>0&&<span style={{fontSize:11,color:"var(--dim)",fontWeight:400,marginLeft:8}}>{"(หลังส่วนลด "+((selSO?.discPct||0)||Math.round(soDiscAmt/soSub*10000)/100)+"% จาก SO)"}</span>}</div>}
        </>}

        {cnForm.type==="promo"&&<Field label="จำนวนเงิน (฿)"><input type="number" value={cnForm.amount} onChange={e=>setCnForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
          <Field label="เหตุผล"><input value={cnForm.reason||""} onChange={e=>setCnForm(f=>({...f,reason:e.target.value}))} style={IB} placeholder={cnForm.type==="promo"?"เช่น โปรส่งท้ายปี":"เหตุผลการคืน"}/></Field>
          <Field label="หมายเหตุ"><input value={cnForm.note||""} onChange={e=>setCnForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
        </div>
        {isEdit&&cd&&<div style={{marginTop:12,textAlign:"right"}}><button onClick={()=>{
          const orig=cnotes.find(c=>c.id===cnForm.id);
          if(orig&&orig.type==="return"&&orig.items){for(const it of orig.items){const pr=products.find(p=>p.id===it.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===it.productId?{...p,stock:p.stock-it.qty}:p));addLog(mkLog(it.productId,"cn_cancel",it.qty,bef,Math.max(0,bef-it.qty),orig.cnNum,"ยกเลิก CN",cu?.username));}}
          setCNotes(p=>p.filter(c=>c.id!==cnForm.id));cM();
        }} style={{padding:"4px 12px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบใบลดหนี้</button></div>}
        <MBtns onCancel={cM} onSave={saveCN}/>
      </Modal>;
    })()}

    {sub==="supcn"&&(()=>{
      const suppliers=contacts.filter(c=>c.type==="supplier");
      const scnList=(supCNotes||[]).map(cn=>{
        const sup=contacts.find(c=>c.id===cn.supplierId);
        return{...cn,supName:sup?cN(sup):"-"};
      }).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      const totalScn=scnList.reduce((s,c)=>s+(+c.amount||0),0);
      const isEdit=!!scnForm.id;
      const scnNum=isEdit?scnForm.scnNum:"SCN-"+String((supCNotes||[]).length+1).padStart(4,"0");

      const saveScn=()=>{
        if(!scnForm.supplierId||!scnForm.amount||+scnForm.amount<=0)return;
        const d={supplierId:+scnForm.supplierId,recognized:!!scnForm.recognized,refNo:scnForm.refNo||"",date:scnForm.date,amount:+scnForm.amount,reason:scnForm.reason,note:scnForm.note};
        if(isEdit){
          setSupCNotes(p=>p.map(c=>c.id===scnForm.id?{...c,...d}:c));
        }else{
          setSupCNotes(p=>[...p,{id:Date.now(),scnNum,...d}]);
        }
        cM();
      };
      const openEditScn=cn=>{setScnForm({id:cn.id,scnNum:cn.scnNum,supplierId:String(cn.supplierId),recognized:!!cn.recognized,refNo:cn.refNo||"",date:cn.date,amount:String(cn.amount),reason:cn.reason||"",note:cn.note||""});oM("addScn");};
      const openNewScn=()=>{setScnForm({supplierId:"",recognized:false,refNo:"",date:todayStr(),amount:"",reason:"",note:""});oM("addScn");};
      const delScn=id=>{setSupCNotes(p=>p.filter(c=>c.id!==id));setConfirmDelScn(null);};

      return<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div><span style={{fontWeight:600,fontSize:14}}>ใบลดหนี้จากซัพพลายเออร์</span>{scnList.length>0&&<span style={{fontSize:12,color:"var(--dim)",marginLeft:8}}>{scnList.length+" รายการ — รวม ฿"+fmt(totalScn)}</span>}</div>
          {ed&&<button onClick={openNewScn} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบลดหนี้</button>}
        </div>

        {scnList.length===0?<div style={{textAlign:"center",color:"var(--faint)",padding:"3rem",background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8}}>ยังไม่มีใบลดหนี้จากซัพพลายเออร์</div>
        :<div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>
          {["เลขที่","ซัพพลายเออร์","เลขอ้างอิง","สถานะ","วันที่","จำนวนเงิน","ชนิด CN",""].map((h,i)=><th key={i} style={{textAlign:i===5?"right":"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}
        </tr></thead><tbody>
          {scnList.map(cn=><tr key={cn.id} style={{borderBottom:"0.5px solid var(--line)"}}>
            <td style={{padding:"8px",fontWeight:500,color:"var(--blue)"}}>{cn.scnNum}</td>
            <td style={{padding:"8px"}}>{cn.supName}</td>
            <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{cn.refNo||"-"}</td>
            <td style={{padding:"8px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:6,background:cn.recognized?"rgba(52,199,89,0.12)":"rgba(255,149,0,0.12)",color:cn.recognized?"var(--green)":"var(--orange)"}}>{cn.recognized?"รับรู้แล้ว":"ยังไม่รับรู้"}</span>{cn.used&&<span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:6,background:"rgba(175,82,222,0.12)",color:"var(--purple)",marginLeft:4}}>ใช้แล้ว</span>}</td>
            <td style={{padding:"8px",color:"var(--faint)",fontSize:12}}>{toBE(cn.date)}</td>
            <td style={{padding:"8px",textAlign:"right",fontWeight:600,color:cn.used?"var(--dim)":"var(--green)"}}>{"฿"+fmt(cn.amount)}</td>
            <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{cn.reason||"-"}</td>
            <td style={{padding:"8px",textAlign:"right"}}><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
              {ed&&<button onClick={()=>openEditScn(cn)} style={{padding:"4px 10px",fontSize:11,borderRadius:5,border:"1px solid var(--line)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไข</button>}
              {cd&&<button onClick={()=>setConfirmDelScn(cn.id)} style={{padding:"4px 10px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.08)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}
            </div></td>
          </tr>)}
        </tbody></table></div>}

        {confirmDelScn&&<Modal title="ยืนยันลบ" onClose={()=>setConfirmDelScn(null)}>
          <div style={{fontSize:13,marginBottom:16}}>ต้องการลบใบลดหนี้นี้?</div>
          <MBtns onCancel={()=>setConfirmDelScn(null)} onSave={()=>delScn(confirmDelScn)} saveLabel="ลบ" saveColor="var(--red)"/>
        </Modal>}

        {modal==="addScn"&&<Modal title={isEdit?"แก้ไขใบลดหนี้ (ซัพฯ)":"สร้างใบลดหนี้จากซัพพลายเออร์"} onClose={cM} width={480}>
          <div style={{fontSize:12,color:"var(--faint)",marginBottom:12}}>{"เลขที่: "+scnNum}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="ซัพพลายเออร์"><CustomSelect searchable value={scnForm.supplierId} onChange={v=>{setScnForm(f=>({...f,supplierId:v}));}} options={[{value:"",label:"— เลือก —"},...suppliers.map(s=>({value:String(s.id),label:cN(s)}))]}/></Field>
            <Field label="สถานะการรับรู้"><CustomSelect value={scnForm.recognized?"1":"0"} onChange={v=>setScnForm(f=>({...f,recognized:v==="1"}))} options={[{value:"0",label:"ยังไม่รับรู้ CN"},{value:"1",label:"รับรู้ CN แล้ว"}]}/></Field>
            <Field label="เลขอ้างอิงใบลดหนี้"><input value={scnForm.refNo||""} onChange={e=>setScnForm(f=>({...f,refNo:e.target.value}))} style={IB} placeholder="เลข CN จากซัพพลายเออร์"/></Field>
            <Field label="วันที่"><ThaiDateInput value={scnForm.date} onChange={v=>setScnForm(f=>({...f,date:v}))}/></Field>
            <Field label="จำนวนเงิน (฿)"><input type="number" value={scnForm.amount} onChange={e=>setScnForm(f=>({...f,amount:e.target.value}))} style={IB} min="0"/></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
            <Field label="ชนิด CN"><CustomSelect value={scnForm.reason||""} onChange={v=>setScnForm(f=>({...f,reason:v}))} options={[{value:"",label:"— เลือก —"},{value:"คืนของเสีย",label:"คืนของเสีย"},{value:"รีเบท",label:"รีเบท"},{value:"ส่งเสริมการขาย",label:"ส่งเสริมการขาย"}]}/></Field>
            <Field label="หมายเหตุ"><input value={scnForm.note||""} onChange={e=>setScnForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
          </div>
          <MBtns onCancel={cM} onSave={saveScn}/>
        </Modal>}
      </>;
    })()}
  </div>;
}

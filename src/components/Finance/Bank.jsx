import { useState } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, todayStr, toBE, round2 } from "../../utils/helpers.js";
import { Modal, MBtns } from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";
import ThaiDateInput from "../ui/ThaiDateInput.jsx";
import { DEF_PERMS, hasPerm, FLOW_DEFS } from "./constants.js";

// บัญชีธนาคาร (Bank) — sub-tab of Finance
// Extracted from Finance.jsx in 2026-06-08 as part of incremental Finance split (Strategy C, รอบ 5)
// Cross-tab deps:
// - autoTag: ใช้ใน saveTxn / saveTransfer / saveAdjust / withdraw (ส่งจาก parent เพราะ AR/AP/Cheque ก็ใช้)
// - search/setSearch: Finance-local state
// Everything else (state, helpers, modals) is internal to Bank.
export default function Bank({sh, autoTag, search, setSearch}){
  const{bankAccs,setBankAccs,bankTxns,setBankTxns,cashCats,setCashCats,tagMappings,setTagMappings,canE,canD,modal,oM,cM}=sh;
  const ed=canE("finance");const cd=canD("finance");

  // States
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
  const[confirmDelTxn,setConfirmDelTxn]=useState(null);

  // Helpers
  const catsForDir=(dir)=>{if(!dir)return cashCats;return cashCats.filter(c=>c.type===dir||c.type==="both");};
  const subsForCat=(catId)=>{if(!catId)return [];const c=cashCats.find(x=>x.id===+catId);return c?.subs||[];};
  const getAccBal=accId=>{const acc=bankAccs.find(a=>a.id===accId);const opening=acc&&acc.openingBalance?+acc.openingBalance||0:0;return opening+bankTxns.filter(t=>t.accId===accId).reduce((s,t)=>{if(t.type==="in")return s+(+t.amount||0);if(t.type==="out")return s-(+t.amount||0);if(t.type==="opening")return s;if(t.type==="transfer")return s+(+t.amount||0);if(t.type==="adjust")return s+(+t.amount||0);return s;},0);};
  const getBankColor=b=>b.includes("กสิกร")?"#138f2d":b.includes("กรุงไทย")?"#1ba5e0":b.includes("กรุงเทพ")?"#012e6b":b.includes("ไทยพาณิชย์")||b.includes("พาณิชย์")?"#4e2a84":b.toUpperCase().includes("TTB")||b.includes("ทหารไทยธนชาต")?"#fc6e20":"var(--blue)";
  const txnFiltered=(accFilter==="all"?bankTxns:bankTxns.filter(t=>t.accId===+accFilter)).filter(t=>{if(!search)return true;const q=search.toLowerCase();return(t.from||"").toLowerCase().includes(q)||(t.refId||"").toLowerCase().includes(q)||(t.note||"").toLowerCase().includes(q);});
  const catUsageCount=(catId,subCatId=null)=>bankTxns.filter(t=>subCatId==null?t.catId===catId:(t.catId===catId&&t.subCatId===subCatId)).length;
  const setTagMapping=(key,patch)=>{setTagMappings(prev=>{const i=prev.findIndex(x=>x.key===key);if(i===-1)return[...prev,{key,catId:null,subCatId:null,...patch}];return prev.map((x,idx)=>idx===i?{...x,...patch}:x);});};

  // Handlers
  const saveTxn=()=>{if(!txnForm.amount||+txnForm.amount<=0)return;const newTxn={id:Date.now(),accId:txnForm.accId,type:txnForm.type,amount:+txnForm.amount,date:txnForm.date,from:txnForm.from,refId:txnForm.refId,note:txnForm.note,catId:txnForm.catId?+txnForm.catId:null,subCatId:txnForm.subCatId?+txnForm.subCatId:null,transferPair:null};setBankTxns(p=>[...p,newTxn]);cM();};
  const saveAcc=()=>{if(!accForm.name||!accForm.bank)return;const data={...accForm,perms:accForm.perms||{...DEF_PERMS}};if(editAcc){setBankAccs(p=>p.map(a=>a.id===editAcc.id?{...a,...data}:a));setEditAcc(null);}else{setBankAccs(p=>[...p,{id:Date.now(),...data}]);}cM();};
  const saveCashAccount=()=>{
    if(!cashAcctForm.name.trim())return;
    const openingAmt=+cashAcctForm.openingBalance||0;
    const newId=Date.now();
    const newAcc={id:newId,name:cashAcctForm.name.trim(),bank:"เงินสด",accNo:"",isCash:true,openingBalance:openingAmt,openingDate:cashAcctForm.openingDate,perms:{receive:true,payOut:true,transfer:true,clearCheque:false}};
    setBankAccs(p=>[...p,newAcc]);
    if(openingAmt>0){
      setBankTxns(p=>[...p,{id:newId+1,accId:newId,type:"opening",amount:openingAmt,date:cashAcctForm.openingDate,from:"ตั้งยอดเริ่มต้น",refId:"",note:"ยอดเริ่มต้น",catId:null,subCatId:null,transferPair:null}]);
    }
    setCashAcctForm({name:"",openingBalance:"",openingDate:todayStr()});
    setAcctType(null);
    cM();
  };
  const deleteAcc=id=>{setBankAccs(p=>p.filter(a=>a.id!==id));setBankTxns(p=>p.filter(t=>t.accId!==id));setDelAcc(null);};
  const addCat=()=>{if(!newCatName.trim())return;const id=Date.now();setCashCats(p=>[...p,{id,name:newCatName.trim(),type:newCatType,subs:[]}]);setNewCatName("");setNewCatType("both");setSelCatId(id);};
  const renameCat=(id,name)=>setCashCats(p=>p.map(c=>c.id===id?{...c,name}:c));
  const changeCatType=(id,type)=>setCashCats(p=>p.map(c=>c.id===id?{...c,type}:c));
  const delCat=(id)=>{const used=catUsageCount(id);if(used>0){setCatUsageWarn({type:"cat",id,count:used});return;}setCashCats(p=>p.filter(c=>c.id!==id));if(selCatId===id)setSelCatId(null);};
  const addSub=(catId)=>{const n=(newSubName[catId]||"").trim();if(!n)return;setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:[...(c.subs||[]),{id:Date.now(),name:n}]}:c));setNewSubName(p=>({...p,[catId]:""}));};
  const renameSub=(catId,subId,name)=>setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:c.subs.map(s=>s.id===subId?{...s,name}:s)}:c));
  const delSub=(catId,subId)=>{const used=catUsageCount(catId,subId);if(used>0){setCatUsageWarn({type:"sub",catId,subId,count:used});return;}setCashCats(p=>p.map(c=>c.id===catId?{...c,subs:c.subs.filter(s=>s.id!==subId)}:c));};
  const saveTransfer=()=>{
    const amt=+tfForm.amount;
    if(!tfForm.fromAccId||!tfForm.toAccId||+tfForm.fromAccId===+tfForm.toAccId)return;
    if(!amt||amt<=0)return;
    const fromAcc=bankAccs.find(a=>a.id===+tfForm.fromAccId);
    const toAcc=bankAccs.find(a=>a.id===+tfForm.toAccId);
    if(!fromAcc||!toAcc)return;
    const dir=(fromAcc.isCash&&!toAcc.isCash)?"depositToBank":(!fromAcc.isCash&&toAcc.isCash)?"withdrawFromBank":"interAccount";
    const tag=autoTag("transfer_"+dir);
    const pairId=Date.now();
    const outTxn={id:pairId,accId:fromAcc.id,type:"transfer",amount:-amt,date:tfForm.date,from:toAcc.name,refId:"",note:tfForm.note||"โอนไป "+toAcc.name,catId:tag.catId,subCatId:tag.subCatId,transferPair:pairId};
    const inTxn={id:pairId+1,accId:toAcc.id,type:"transfer",amount:amt,date:tfForm.date,from:fromAcc.name,refId:"",note:tfForm.note||"โอนจาก "+fromAcc.name,catId:tag.catId,subCatId:tag.subCatId,transferPair:pairId};
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
    setBankTxns(p=>[...p,{id:Date.now(),accId:adjForm.accId,type:"adjust",amount:diff,date:adjForm.date,from:"",refId:"",note:adjForm.note||"ปรับยอด ("+(diff>0?"+":"")+fmt(diff)+")",catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);
    setAdjForm({accId:null,actualBalance:"",date:todayStr(),note:""});
    cM();
  };

  return <>
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

    {confirmDelTxn&&<Modal title="ยืนยันลบรายการธนาคาร" onClose={()=>setConfirmDelTxn(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบรายการ "+(confirmDelTxn.type==="in"?"เงินเข้า":confirmDelTxn.type==="out"?"เงินออก":"โอน")+" ฿"+fmt(Math.abs(confirmDelTxn.amount))+" ("+(confirmDelTxn.from||"—")+") ถาวร"+(confirmDelTxn.transferPair?" (ลบทั้งสองฝั่งของการโอน)":"")}</div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setConfirmDelTxn(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--text)",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
        <button onClick={()=>{if(confirmDelTxn.transferPair){setBankTxns(p=>p.filter(x=>x.transferPair!==confirmDelTxn.transferPair));}else{setBankTxns(p=>p.filter(x=>x.id!==confirmDelTxn.id));}setConfirmDelTxn(null);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"var(--red)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>
      </div>
    </Modal>}
  </>;
}

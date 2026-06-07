import { useState } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, todayStr, toBE } from "../../utils/helpers.js";
import { Modal, MBtns } from "../ui/Modal.jsx";
import StatCard from "../ui/StatCard.jsx";
import Field from "../ui/Field.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";
import ThaiDateInput from "../ui/ThaiDateInput.jsx";
import { CHQ_ST, BANK_OPTS } from "./constants.js";

// เช็ค (Cheque) — sub-tab of Finance
// Extracted from Finance.jsx 2026-06-08 as part of Strategy C incremental split (รอบ 2)
// Cross-tab deps (passed as props): autoTag, hasPerm, setWarnMsg
export default function Cheque({sh, autoTag, hasPerm, setWarnMsg, search, setSearch}){
  const{cheques,setCheques,bankAccs,setBankTxns,canE,canD,modal,oM,cM}=sh;
  const ed=canE("finance");const cd=canD("finance");

  const[chqForm,setChqForm]=useState({chequeNo:"",bank:"",amount:"",date:todayStr(),dueDate:"",from:"",refId:"",note:"",status:"pending"});
  const[chqFilter,setChqFilter]=useState("all");
  const[chqConfirm,setChqConfirm]=useState(null);
  const[bounceConfirm,setBounceConfirm]=useState(null);

  const updateChqStatus=(id,st,extra)=>{
    const old=cheques.find(c=>c.id===id);if(!old)return;
    if(st==="cleared"&&old.status==="bounced"){setWarnMsg("เช็คเด้งแล้ว ไม่สามารถเคลียร์ได้");return;}
    setCheques(p=>p.map(c=>c.id===id?{...c,status:st,...(extra||{})}:c));
    const isApChq=(old.refId||"").startsWith("PO-");
    const chqTagKey=isApChq?"ap_cheque":"ar_cheque";
    if(st==="cleared"&&old.depositAccId){const tag=autoTag(chqTagKey);setBankTxns(p=>[...p,{id:Date.now(),accId:old.depositAccId,type:"in",amount:old.amount,date:todayStr(),from:"เช็ค "+old.chequeNo,refId:old.refId||"",note:"เคลียร์เช็ค",catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}
    if(st==="bounced"&&old.status==="cleared"&&old.depositAccId){const tag=autoTag(chqTagKey);setBankTxns(p=>[...p,{id:Date.now()+1,accId:old.depositAccId,type:"out",amount:old.amount,date:todayStr(),from:"เช็คเด้ง "+old.chequeNo,refId:old.refId||"",note:"เช็คเด้ง (กลับรายการเคลียร์)",catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}
  };

  const saveChq=()=>{if(!chqForm.chequeNo||!chqForm.amount||+chqForm.amount<=0)return;if(chqForm.id){const old=cheques.find(c=>c.id===chqForm.id);if(old&&old.status!==chqForm.status){if(chqForm.status==="cleared"&&old.status==="bounced"){setWarnMsg("เช็คเด้งแล้ว ไม่สามารถเคลียร์ได้");return;}updateChqStatus(chqForm.id,chqForm.status);}setCheques(p=>p.map(c=>c.id===chqForm.id?{...c,chequeNo:chqForm.chequeNo,bank:chqForm.bank,amount:+chqForm.amount,receiveDate:chqForm.receiveDate,dueDate:chqForm.dueDate,from:chqForm.from,refId:chqForm.refId,note:chqForm.note}:c));}else{setCheques(p=>[...p,{id:Date.now(),...chqForm,amount:+chqForm.amount}]);}cM();};
  const openChqEdit=c=>{setChqForm({...c,amount:String(c.amount)});oM("addChq");};

  const chqFiltered=cheques.filter(c=>chqFilter==="all"||c.status===chqFilter).filter(c=>{if(!search)return true;const q=search.toLowerCase();return(c.chequeNo||"").toLowerCase().includes(q)||(c.bank||"").toLowerCase().includes(q)||(c.from||"").toLowerCase().includes(q)||(c.refId||"").toLowerCase().includes(q);});
  const chqTotalPending=cheques.filter(c=>c.status==="pending").reduce((s,c)=>s+c.amount,0);

  return <>
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
        <td style={{padding:"8px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:st.bg,color:st.color}}>{st.label}</span>{c.depositAccId&&(c.status==="deposited"||c.status==="cleared")&&(()=>{const da=bankAccs.find(a=>a.id===c.depositAccId);return da?<span style={{fontSize:10,color:"var(--dim)",marginLeft:4}}>{"→ "+da.name}</span>:null;})()}{c.depositDate&&c.status==="deposited"&&<span style={{fontSize:10,color:"var(--faint)",marginLeft:4}}>{toBE(c.depositDate)}</span>}{c.status==="bounced"&&c.bounceResolve&&(()=>{
          if(c.bounceResolve==="new_cheque")return <span style={{fontSize:10,color:"var(--blue)",marginLeft:6,padding:"1px 6px",borderRadius:99,background:"var(--blue-bg)",border:"1px solid var(--blue)"}}>{"↻ เช็คใหม่ "+(c.bounceNewChqNo||"")}</span>;
          if(c.bounceResolve==="transfer"){const da=bankAccs.find(a=>a.id===c.bounceTxnAccId);return <span style={{fontSize:10,color:"var(--green)",marginLeft:6,padding:"1px 6px",borderRadius:99,background:"rgba(52,199,89,0.12)",border:"1px solid var(--green)"}}>{"✓ โอนแล้ว"+(da?" → "+da.name:"")}</span>;}
          if(c.bounceResolve==="none")return <span style={{fontSize:10,color:"var(--orange)",marginLeft:6,padding:"1px 6px",borderRadius:99,background:"rgba(255,149,0,0.14)",border:"1px solid var(--orange)"}}>⚠ ยังไม่แก้</span>;
          return null;
        })()}</td>
        <td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&<button onClick={()=>openChqEdit(c)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--dim)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>แก้ไข</button>}
        {ed&&c.status==="pending"&&<><button onClick={()=>setChqConfirm({id:c.id,action:"deposited",chequeNo:c.chequeNo,amount:c.amount,accId:(bankAccs.find(a=>a.id===3)||bankAccs[0])?.id||3,depositDate:todayStr()})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>นำฝาก</button><button onClick={()=>setBounceConfirm({id:c.id,chequeNo:c.chequeNo,amount:c.amount,from:c.from,refId:c.refId,resolve:"none",newChequeNo:"",newBank:"",newDueDate:"",txnAccId:(bankAccs.find(a=>a.id===3)||bankAccs[0])?.id||3,txnDate:todayStr()})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>เด้ง</button></>}
        {ed&&c.status==="deposited"&&<><button onClick={()=>setChqConfirm({id:c.id,action:"cleared",chequeNo:c.chequeNo,amount:c.amount})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>เคลียร์</button><button onClick={()=>setBounceConfirm({id:c.id,chequeNo:c.chequeNo,amount:c.amount,from:c.from,refId:c.refId,resolve:"none",newChequeNo:"",newBank:"",newDueDate:"",txnAccId:(bankAccs.find(a=>a.id===3)||bankAccs[0])?.id||3,txnDate:todayStr()})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>เด้ง</button></>}
        {ed&&c.status==="bounced"&&(!c.bounceResolve||c.bounceResolve==="none")&&<button onClick={()=>setBounceConfirm({id:c.id,chequeNo:c.chequeNo,amount:c.amount,from:c.from,refId:c.refId,resolve:"new_cheque",newChequeNo:"",newBank:"",newDueDate:"",txnAccId:(bankAccs.find(a=>a.id===3)||bankAccs[0])?.id||3,txnDate:todayStr(),resolveOnly:true})} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.14)",color:"var(--orange)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไขเด้ง</button>}
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
    {bounceConfirm&&<Modal title="เช็คเด้ง — เลือกวิธีแก้ไข" onClose={()=>setBounceConfirm(null)}>
      <div style={{padding:"8px 0",fontSize:13,color:"var(--text)"}}>
        <div style={{display:"flex",gap:16,padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:14}}>
          <div><span style={{color:"var(--dim)",fontSize:12}}>เลขที่เช็ค</span><div style={{fontWeight:600}}>{bounceConfirm.chequeNo}</div></div>
          <div><span style={{color:"var(--dim)",fontSize:12}}>จำนวน</span><div style={{fontWeight:600,color:"var(--red)"}}>{"฿"+fmt(bounceConfirm.amount)}</div></div>
          {bounceConfirm.from&&<div><span style={{color:"var(--dim)",fontSize:12}}>จาก</span><div style={{fontWeight:600}}>{bounceConfirm.from}</div></div>}
        </div>
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:8,fontWeight:600}}>วิธีแก้ไข</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {[{k:"none",lbl:"ยังไม่แก้ไข (เพียงบันทึกว่าเด้ง)"},{k:"new_cheque",lbl:"ลูกค้าจ่ายเช็คใหม่"},{k:"transfer",lbl:"ลูกค้าโอนเงินมา"}].map(opt=>{
            const active=bounceConfirm.resolve===opt.k;
            return <div key={opt.k} onClick={()=>setBounceConfirm(p=>({...p,resolve:opt.k}))} style={{padding:"10px 12px",border:"1px solid "+(active?"var(--blue)":"var(--line)"),borderRadius:8,background:active?"var(--blue-bg)":"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
              <span style={{width:16,height:16,borderRadius:"50%",border:"2px solid "+(active?"var(--blue)":"var(--dim)"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{active&&<span style={{width:8,height:8,borderRadius:"50%",background:"var(--blue)"}}/>}</span>
              <span style={{fontSize:13,color:active?"var(--blue)":"var(--text)",fontWeight:active?600:400}}>{opt.lbl}</span>
            </div>;
          })}
        </div>
        {bounceConfirm.resolve==="new_cheque"&&<div style={{padding:12,background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <Field label="เลขที่เช็คใหม่ *"><input value={bounceConfirm.newChequeNo} onChange={e=>setBounceConfirm(p=>({...p,newChequeNo:e.target.value}))} style={IB} placeholder="เลขที่เช็ค"/></Field>
            <Field label="วันครบกำหนด *"><ThaiDateInput value={bounceConfirm.newDueDate} onChange={e=>setBounceConfirm(p=>({...p,newDueDate:e.target.value}))}/></Field>
          </div>
          <Field label="ธนาคาร"><CustomSelect value={bounceConfirm.newBank} onChange={v=>setBounceConfirm(p=>({...p,newBank:v}))} options={BANK_OPTS}/></Field>
        </div>}
        {bounceConfirm.resolve==="transfer"&&<div style={{padding:12,background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="โอนเข้าบัญชี"><CustomSelect value={String(bounceConfirm.txnAccId)} onChange={v=>setBounceConfirm(p=>({...p,txnAccId:+v}))} options={bankAccs.map(a=>({value:String(a.id),label:a.name+" — "+a.bank}))}/></Field>
          <Field label="วันที่โอน"><ThaiDateInput value={bounceConfirm.txnDate} onChange={e=>setBounceConfirm(p=>({...p,txnDate:e.target.value}))}/></Field>
        </div>}
      </div>
      <MBtns onCancel={()=>setBounceConfirm(null)} onSave={()=>{
        if(bounceConfirm.resolve==="new_cheque"&&(!bounceConfirm.newChequeNo||!bounceConfirm.newDueDate)){setWarnMsg("กรุณากรอกเลขที่เช็คใหม่และวันครบกำหนด");return;}
        const newChqId=Date.now();const newTxnId=Date.now()+1;
        const extra={bounceResolve:bounceConfirm.resolve,bounceDate:todayStr()};
        if(bounceConfirm.resolve==="new_cheque"){extra.bounceNewChqId=newChqId;extra.bounceNewChqNo=bounceConfirm.newChequeNo;}
        if(bounceConfirm.resolve==="transfer"){extra.bounceTxnId=newTxnId;extra.bounceTxnAccId=bounceConfirm.txnAccId;extra.bounceTxnDate=bounceConfirm.txnDate;}
        updateChqStatus(bounceConfirm.id,"bounced",extra);
        if(bounceConfirm.resolve==="new_cheque"){
          setCheques(p=>[...p,{id:newChqId,chequeNo:bounceConfirm.newChequeNo,bank:bounceConfirm.newBank,amount:bounceConfirm.amount,receiveDate:todayStr(),dueDate:bounceConfirm.newDueDate,from:bounceConfirm.from||"",refId:bounceConfirm.refId||"",note:"แทนเช็คเด้ง "+bounceConfirm.chequeNo,status:"pending"}]);
        }else if(bounceConfirm.resolve==="transfer"){
          {const tag=autoTag("ar_cheque");setBankTxns(p=>[...p,{id:newTxnId,accId:bounceConfirm.txnAccId,type:"in",amount:bounceConfirm.amount,date:bounceConfirm.txnDate,from:bounceConfirm.from||"ลูกค้า",refId:bounceConfirm.refId||"",note:"โอนแทนเช็คเด้ง "+bounceConfirm.chequeNo,catId:tag.catId,subCatId:tag.subCatId,transferPair:null}]);}
        }
        setBounceConfirm(null);
      }} saveLabel="ยืนยัน"/>
    </Modal>}

    {modal==="addChq"&&ed&&<Modal title={chqForm.id?"แก้ไขเช็ค":"เพิ่มเช็ค"} onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="เลขที่เช็ค"><input value={chqForm.chequeNo} onChange={e=>setChqForm(f=>({...f,chequeNo:e.target.value}))} style={IB}/></Field>
        <Field label="ธนาคาร"><CustomSelect value={chqForm.bank} onChange={v=>setChqForm(f=>({...f,bank:v}))} options={BANK_OPTS}/></Field>
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
  </>;
}

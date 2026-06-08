import { useState, useMemo } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, todayStr, toBE } from "../../utils/helpers.js";
import { Modal, MBtns } from "../ui/Modal.jsx";
import StatCard from "../ui/StatCard.jsx";
import Field from "../ui/Field.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";
import ThaiDateInput from "../ui/ThaiDateInput.jsx";
import { CN_TYPES } from "./constants.js";

// ใบวางบิล (Billing) — sub-tab of Finance
// Extracted from Finance.jsx in 2026-06-08 as part of incremental Finance split (Strategy C, รอบ 3)
// Cross-tab deps received from parent:
// - arList: computed list of AR-side SOs (defined in Finance.jsx, also used by AR/batch AP modals)
// - setViewBill: lifted so CN tab / viewSO modal in parent can also open the bill detail
// - cnTot: helper that needs sales+discount adjustments (kept in parent)
// - cN: contact-name helper
export default function Billing({sh, arList, setViewBill, setViewSO, search, setSearch, cN, cnTot}){
  const{contacts,sales,payments,setPayments,billings,setBillings,cnotes,setDefectives,canE,canD,modal,oM,cM}=sh;
  const ed=canE("finance");const cd=canD("finance");

  const[billFilter,setBillFilter]=useState("all");
  const[confirmBill,setConfirmBill]=useState(null);
  const[billForm,setBillForm]=useState({customerId:"",soNums:[],cnIds:[],date:todayStr(),note:""});

  const soBillMap=useMemo(()=>{const m={};for(const b of billings)for(const sn of(b.soNums||[]))m[sn]=b;return m;},[billings]);
  const billCustSOs=useMemo(()=>{if(!billForm.customerId)return[];const today=todayStr();return arList.filter(so=>{if(so.customerId!==billForm.customerId)return false;if(so.remaining<=0&&!(billForm.id&&billForm.soNums.includes(so.soNum)))return false;const used=soBillMap[so.soNum];if(used&&!(billForm.id&&used.id===billForm.id))return false;if(billForm.id&&billForm.soNums.includes(so.soNum))return true;if(so.payType!=="credit")return true;if(so.dueDate&&so.dueDate<=today)return true;return false;});},[billForm.customerId,billForm.id,billForm.soNums,arList,soBillMap]);
  const billCustCNs=useMemo(()=>{if(!billForm.customerId)return[];return cnotes.filter(cn=>cn.customerId===billForm.customerId&&(!billings.some(b=>b.cnIds?.includes(cn.id))||(billForm.id&&billForm.cnIds.includes(cn.id))));},[billForm.customerId,billForm.id,billForm.cnIds,cnotes,billings]);
  const oldBillCNPays=useMemo(()=>billForm.id?payments.filter(p=>p.billId===billForm.id):[], [billForm.id,payments]);
  const oldBillCNByRef=useMemo(()=>{const m={};for(const p of oldBillCNPays)m[p.refId]=(m[p.refId]||0)+p.amount;return m;},[oldBillCNPays]);
  const billSOTotal=billForm.soNums.reduce((s,soNum)=>{const so=billCustSOs.find(x=>x.soNum===soNum);return s+(so?Math.max(0,so.remaining)+(oldBillCNByRef[soNum]||0):0);},0);
  const billCNTotal=billForm.cnIds.reduce((s,cnId)=>{const cn=cnotes.find(c=>c.id===cnId);if(!cn)return s;return s+cnTot(cn);},0);
  const billNet=Math.max(0,billSOTotal-billCNTotal);
  const billList=useMemo(()=>{let bl=billFilter==="all"?billings:billings.filter(b=>b.status===billFilter);if(search){const q=search.toLowerCase();bl=bl.filter(b=>{const cu2=contacts.find(c=>c.id===b.customerId);return(b.billNum||"").toLowerCase().includes(q)||(cu2?cN(cu2):"").toLowerCase().includes(q)||(b.soNums||[]).some(sn=>sn.toLowerCase().includes(q));});}return[...bl].reverse();},[billings,billFilter,search,contacts,cN]);

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
  const openNewBill=()=>{setBillForm({customerId:"",soNums:[],cnIds:[],date:todayStr(),note:""});oM("addBill");};

  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
      <StatCard label="ใบวางบิลทั้งหมด" value={billings.length}/>
      <StatCard label="รอเก็บเงิน" value={billings.filter(b=>b.status==="pending").length} color="var(--orange)"/>
      <StatCard label="ยอดค้าง" value={"฿"+fmt(billings.filter(b=>b.status==="pending").reduce((s,b)=>s+b.net,0))} color="var(--red)"/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["all","ทั้งหมด"],["pending","รอเก็บเงิน"],["collected","เก็บแล้ว"]].map(v=><button key={v[0]} onClick={()=>setBillFilter(v[0])} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(billFilter===v[0]?"var(--text)":"var(--line)"),background:billFilter===v[0]?"var(--text)":"transparent",color:billFilter===v[0]?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{v[1]}</button>)}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={openNewBill} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบวางบิล</button>}</div>
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["เลขที่","ลูกค้า","วันที่","SO","ยอดรวม","หัก CN","ยอดสุทธิ","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{billList.length===0?<tr><td colSpan={9} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีใบวางบิล</div>{ed&&<button onClick={openNewBill} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบวางบิลแรก</button>}</td></tr>:billList.map(b=>{
      const cust=contacts.find(c=>c.id===b.customerId);
      return<tr key={b.id} style={{borderBottom:"0.5px solid var(--line)"}}>
        <td style={{padding:"8px",fontWeight:500,color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewBill(b)}>{b.billNum}</td>
        <td style={{padding:"8px"}}>{cust?cN(cust):"—"}</td>
        <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(b.date)}</td>
        <td style={{padding:"8px",fontSize:12}}>{(b.soNums||[]).map((sn,i)=>{const so=sales.find(s=>s.soNum===sn);return<span key={sn}>{i>0&&", "}<span style={{color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>{if(so){const cust2=contacts.find(c=>c.id===so.customerId);const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const paid=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cust2?cN(cust2):"—",total:tot,paid,remaining:tot-paid});}}}>{sn}</span></span>;})}</td>
        <td style={{padding:"8px"}}>{"฿"+fmt(b.soTotal)}</td>
        <td style={{padding:"8px",color:"var(--red)"}}>{"- ฿"+fmt(b.cnTotal)}</td>
        <td style={{padding:"8px",fontWeight:600}}>{"฿"+fmt(b.net)}</td>
        <td style={{padding:"8px"}}>{b.status==="collected"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>เก็บแล้ว</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>รอเก็บเงิน</span>}</td>
        <td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&b.status==="pending"&&<><button onClick={()=>openEditBill(b)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--dim)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>แก้ไข</button><button onClick={()=>setConfirmBill(b)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)",cursor:"pointer",fontFamily:"inherit"}}>เก็บเงินแล้ว</button></>}</td>
      </tr>;
    })}</tbody></table></div>

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
  </>;
}

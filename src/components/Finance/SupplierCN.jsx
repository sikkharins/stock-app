import { useState } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, todayStr, toBE } from "../../utils/helpers.js";
import { Modal, MBtns } from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";
import ThaiDateInput from "../ui/ThaiDateInput.jsx";

// ใบลดหนี้จากซัพพลายเออร์ (Supplier Credit Notes) — sub-tab of Finance
// Extracted from Finance.jsx in 2026-06-08 as part of incremental Finance split (Strategy C)
// — No cross-tab couplings; data only read by Finance/Batch AP (via supCNotes via sh)
export default function SupplierCN({sh}){
  const{cN,contacts,supCNotes,setSupCNotes,canE,canD,modal,oM,cM}=sh;
  const ed=canE("finance");const cd=canD("finance");
  const[scnForm,setScnForm]=useState({supplierId:"",recognized:false,refNo:"",date:todayStr(),amount:"",reason:"",note:""});
  const[confirmDelScn,setConfirmDelScn]=useState(null);

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

  return <>
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
}

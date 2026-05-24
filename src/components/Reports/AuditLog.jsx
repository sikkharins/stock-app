import { useState } from "react";
import { IB } from "../../utils/constants.js";
import { fmtD } from "../../utils/helpers.js";
import { dlCSV } from "../../utils/csv.js";
import CustomSelect from "../ui/CustomSelect.jsx";

export default function AuditTab({audit}){
  const[fU,setFU]=useState("");
  const us=[...new Set(audit.map(l=>l.user))];
  const fl=fU?audit.filter(l=>l.user===fU):audit;
  const exportCSV=()=>{
    const hdr=["วันที่","ผู้ใช้","การกระทำ","รายละเอียด"];
    const rows=fl.map(l=>[fmtD(l.date),l.user,l.action,l.detail]);
    dlCSV("audit-log.csv",[hdr,...rows]);
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <span style={{fontWeight:600,fontSize:14}}>{"Audit Log"}</span>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <CustomSelect value={fU} onChange={v=>setFU(v)} options={[{value:"",label:"ทุก User"},...us.map(u=>({value:u,label:u}))]} style={{width:"auto",minWidth:160}}/>
        {fl.length>0&&<button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid var(--line)",background:"var(--bg)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Export CSV</button>}
      </div>
    </div>
    {fl.length===0&&<div style={{textAlign:"center",color:"var(--dim)",padding:"2rem"}}>ยังไม่มี</div>}
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["วันที่","ผู้ใช้","การกระทำ","รายละเอียด"].map(h=><th key={h} style={{padding:"8px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead><tbody>{fl.slice(0,100).map(l=><tr key={l.id} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"8px",color:"var(--dim)",fontSize:11}}>{fmtD(l.date)}</td><td style={{padding:"8px",fontWeight:500}}>{l.user}</td><td style={{padding:"8px"}}><span style={{background:"var(--blue-bg)",color:"var(--blue)",borderRadius:4,padding:"2px 8px",fontSize:11}}>{l.action}</span></td><td style={{padding:"8px"}}>{l.detail}</td></tr>)}</tbody></table></div>
  </div>;
}

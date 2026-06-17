import { useState, useMemo } from "react";
import { fmtD } from "../../utils/helpers.js";
import { dlCSV } from "../../utils/csv.js";
import { categorizeAudit, CATEGORIES } from "../../utils/auditCategory.ts";
import { auditInRange } from "../../utils/auditRefs.ts";
import CustomSelect from "../ui/CustomSelect.jsx";

const DATE_CHIPS = [["all","ทั้งหมด"],["today","วันนี้"],["7d","7 วัน"],["month","เดือนนี้"]];

function CatBadge({ cat }) {
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:cat.bg,color:cat.color,fontWeight:500,whiteSpace:"nowrap"}}>{cat.label}</span>;
}

function Stat({ label, value, color, dot }) {
  return <div style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10,padding:"8px 12px"}}>
    <div style={{fontSize:11,color:"var(--dim)",display:"flex",alignItems:"center",gap:4}}>
      {dot&&<span style={{width:6,height:6,borderRadius:"50%",background:dot}}/>}{label}
    </div>
    <div style={{fontSize:18,fontWeight:600,color:color||"var(--text)"}}>{value}</div>
  </div>;
}

export default function AuditTab({ audit, sales, pos, quotes, products, contacts, pN, cN }){
  const [q,setQ]=useState("");
  const [range,setRange]=useState("all");
  const [fU,setFU]=useState("");
  const [fCat,setFCat]=useState("");
  const [riskOnly,setRiskOnly]=useState(false);

  const rows=useMemo(()=>audit.map(l=>({...l,cat:categorizeAudit(l.action)})),[audit]);
  const users=useMemo(()=>[...new Set(audit.map(l=>l.user))],[audit]);

  const ql=q.trim().toLowerCase();
  const filtered=rows.filter(l=>{
    if(ql && !((l.user+" "+l.action+" "+l.detail).toLowerCase().includes(ql))) return false;
    if(fU && l.user!==fU) return false;
    if(fCat && l.cat.key!==fCat) return false;
    if(riskOnly && !l.cat.risk) return false;
    if(!auditInRange(l.date,range)) return false;
    return true;
  });

  const todayCount=filtered.filter(l=>auditInRange(l.date,"today")).length;
  const riskCount=filtered.filter(l=>l.cat.risk).length;
  const userCount=new Set(filtered.map(l=>l.user)).size;

  const exportCSV=()=>{
    const hdr=["วันที่","ผู้ใช้","หมวด","การกระทำ","รายละเอียด"];
    const out=filtered.map(l=>[fmtD(l.date),l.user,l.cat.label,l.action,l.detail]);
    dlCSV("audit-log.csv",[hdr,...out]);
  };

  const chip=(active)=>({fontSize:12,padding:"5px 12px",borderRadius:99,cursor:"pointer",whiteSpace:"nowrap",border:active?"0.5px solid transparent":"0.5px solid var(--line)",background:active?"var(--blue)":"var(--panel)",color:active?"#fff":"var(--text)"});

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10,padding:"8px 12px"}}>
      <span style={{color:"var(--dim)",fontSize:14}}>{"\u{1F50D}"}</span>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา ผู้ใช้ / การกระทำ / เลขเอกสาร..." style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:"var(--text)",fontFamily:"inherit"}}/>
      {q&&<span onClick={()=>setQ("")} style={{cursor:"pointer",color:"var(--dim)",fontSize:14}}>{"✕"}</span>}
    </div>

    <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",marginBottom:12}}>
      {DATE_CHIPS.map(([k,label])=><span key={k} onClick={()=>setRange(k)} style={chip(range===k)}>{label}</span>)}
      <CustomSelect value={fU} onChange={setFU} options={[{value:"",label:"ทุก User"},...users.map(u=>({value:u,label:u}))]} style={{width:"auto",minWidth:130}}/>
      <CustomSelect value={fCat} onChange={setFCat} options={[{value:"",label:"ทุกประเภท"},...CATEGORIES.map(c=>({value:c.key,label:c.label}))]} style={{width:"auto",minWidth:130}}/>
      <span onClick={()=>setRiskOnly(v=>!v)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,cursor:"pointer",whiteSpace:"nowrap",border:"0.5px solid var(--red)",background:riskOnly?"var(--red)":"rgba(255,59,48,0.1)",color:riskOnly?"#fff":"var(--red)",fontWeight:500}}>{"⚠ เฉพาะเสี่ยง"}</span>
      <div style={{flex:1}}/>
      {filtered.length>0&&<button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid var(--line)",background:"var(--bg)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",color:"var(--text)"}}>Export CSV</button>}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
      <Stat label="เหตุการณ์" value={filtered.length}/>
      <Stat label="วันนี้" value={todayCount}/>
      <Stat label="เสี่ยง" value={riskCount} color="var(--red)" dot="var(--red)"/>
      <Stat label="ผู้ใช้" value={userCount}/>
    </div>

    {filtered.length===0
      ? <div style={{textAlign:"center",color:"var(--dim)",padding:"2rem"}}>{audit.length===0?"ยังไม่มี":"ไม่พบรายการ"}</div>
      : <>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:6}}>{"แสดง "+filtered.length+" รายการ"}</div>
        <div style={{overflowX:"auto",maxHeight:"70vh",overflowY:"auto",border:"0.5px solid var(--line)",borderRadius:10}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead><tr style={{position:"sticky",top:0,zIndex:1,background:"var(--bg)"}}>
              {["เวลา","การกระทำ","ผู้ใช้"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:h==="ผู้ใช้"?"right":"left",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)",whiteSpace:"nowrap"}}>{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map(l=>{
              const [dpart,tpart]=fmtD(l.date).split(" ");
              return <tr key={l.id} style={{borderBottom:"0.5px solid var(--line)",borderLeft:l.cat.risk?"3px solid var(--red)":"3px solid transparent",background:l.cat.risk?"rgba(255,59,48,0.05)":"transparent"}}>
                <td style={{padding:"8px 12px",color:"var(--dim)",fontSize:11,whiteSpace:"nowrap"}}>
                  <div style={{color:"var(--text)"}}>{tpart||"-"}</div>
                  <div style={{color:"var(--faint)"}}>{dpart}</div>
                </td>
                <td style={{padding:"8px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <CatBadge cat={l.cat}/>
                    <span>{l.action}</span>
                    {l.detail&&<span style={{color:"var(--dim)"}}>{"· "+l.detail}</span>}
                  </div>
                </td>
                <td style={{padding:"8px 12px",fontWeight:500,textAlign:"right",whiteSpace:"nowrap"}}>{l.user}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>}
  </div>;
}

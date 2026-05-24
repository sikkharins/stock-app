import { useState } from "react";
import { TAB_LABELS } from "../utils/constants.js";
import { fmtDur, fmtD } from "../utils/helpers.js";
import { Modal } from "./ui/Modal.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";

const TH_TAB = tab => TAB_LABELS[tab]?.th || tab;

export default function ActivityModal({actLogs,sess,onClose}){
  const[filterUser,setFilterUser]=useState("");
  const[expanded,setExpanded]=useState({});

  const all=[...(sess?[{...sess,_online:true}]:[]),...(actLogs||[])];
  const unames=[...new Set(all.map(s=>s.username))].sort();
  const list=filterUser?all.filter(s=>s.username===filterUser):all;
  const toggle=k=>setExpanded(e=>({...e,[k]:!e[k]}));

  return<Modal title="ประวัติการใช้งาน" onClose={onClose} wide>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
      <CustomSelect value={filterUser} onChange={v=>setFilterUser(v)} options={[{value:"",label:"— ทุก User —"},...unames.map(u=>({value:u,label:u}))]} style={{width:"auto",minWidth:160}}/>
      <span style={{fontSize:12,color:"var(--faint)"}}>{list.length+" session"}</span>
    </div>

    {list.length===0
      ?<div style={{textAlign:"center",color:"var(--faint)",padding:"3rem"}}>ยังไม่มีประวัติการใช้งาน</div>
      :<div style={{maxHeight:520,overflowY:"auto"}}>
        {list.map((s,idx)=>{
          const k=`${s.userId}-${s.loginTime}-${idx}`;
          const isOpen=expanded[k];
          const isOnline=!!s._online;
          const liveDur=isOnline?Math.floor((Date.now()-s.loginTime)/1000):s.totalDuration;
          return<div key={k} style={{border:"0.5px solid var(--line)",borderRadius:8,marginBottom:8,overflow:"hidden"}}>
            <div onClick={()=>toggle(k)} style={{display:"flex",alignItems:"center",padding:"10px 14px",cursor:"pointer",background:isOpen?"var(--bg)":"var(--panel)",userSelect:"none",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                {isOnline&&<span style={{width:8,height:8,borderRadius:"50%",background:"var(--green)",display:"inline-block",flexShrink:0,boxShadow:"0 0 0 2px rgba(52,199,89,0.3)"}}/>}
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    {s.username}
                    {isOnline&&<span style={{fontSize:11,color:"var(--green)",fontWeight:500}}>(ออนไลน์)</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--faint)",marginTop:1}}>{s.role}{s.salesName?" · "+s.salesName:""}{s.supplierName?" · "+s.supplierName:""}</div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginRight:8}}>
                <div style={{fontSize:12,color:"var(--dim)"}}>{"เข้า: "+fmtD(s.loginTimeStr)}</div>
                {s.logoutTimeStr&&<div style={{fontSize:11,color:"var(--faint)"}}>{"ออก: "+fmtD(s.logoutTimeStr)}</div>}
                <div style={{fontSize:11,color:isOnline?"var(--green)":"var(--faint)"}}>{"รวม: "+fmtDur(liveDur)}</div>
              </div>
              <span style={{fontSize:13,color:"var(--faint)",flexShrink:0}}>{isOpen?"▲":"▼"}</span>
            </div>

            {isOpen&&<div style={{borderTop:"1px solid var(--line)",padding:"10px 14px"}}>
              {!(s.tabHistory||[]).length
                ?<div style={{fontSize:12,color:"var(--faint)"}}>ไม่มีข้อมูลหน้าที่เข้าใช้</div>
                :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"var(--bg)"}}>
                    {["#","หน้า","เวลาเข้า","ระยะเวลา"].map((h,i)=><th key={h} style={{padding:"6px 8px",textAlign:i===0||i===3?"center":"left",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {s.tabHistory.map((t,i)=>{
                      const isCur=isOnline&&t.endTime===null;
                      const tabDur=isCur?Math.floor((Date.now()-t.enterTime)/1000):t.duration;
                      const timeStr=t.enterTime?new Date(t.enterTime).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"-";
                      return<tr key={i} style={{borderBottom:"0.5px solid var(--line)",background:isCur?"rgba(52,199,89,0.08)":""}}>
                        <td style={{padding:"6px 8px",textAlign:"center",color:"var(--faint)"}}>{i+1}</td>
                        <td style={{padding:"6px 8px",fontWeight:isCur?600:400}}>
                          {isCur&&<span style={{color:"var(--green)",marginRight:4}}>●</span>}
                          {TH_TAB(t.tab)}
                          {isCur&&<span style={{fontSize:11,color:"var(--green)",marginLeft:4}}>กำลังดู</span>}
                        </td>
                        <td style={{padding:"6px 8px",color:"var(--faint)"}}>{timeStr}</td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:isCur?"var(--green)":"var(--dim)"}}>{fmtDur(tabDur)}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              }
            </div>}
          </div>;
        })}
      </div>
    }
  </Modal>;
}

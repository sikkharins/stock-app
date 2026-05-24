import { useState } from "react";
import { IB } from "../utils/constants.js";
import { Modal, MBtns } from "./ui/Modal.jsx";

export default function CatMgr({cats,setCats,onClose}){
  const[newName,setNewName]=useState("");const[editId,setEditId]=useState(null);const[editName,setEditName]=useState("");
  const[newSubs,setNewSubs]=useState({});const[editSubId,setEditSubId]=useState(null);const[editSubName,setEditSubName]=useState("");
  const addCat=()=>{const n=newName.trim();if(!n)return;setCats(p=>[...p,{id:Date.now(),name:n,subs:[]}]);setNewName("");};
  const saveCat=id=>{const n=editName.trim();if(!n)return;setCats(p=>p.map(c=>c.id===id?{...c,name:n}:c));setEditId(null);};
  const delCat=id=>setCats(p=>p.filter(c=>c.id!==id));
  const addSub=cid=>{const n=(newSubs[cid]||"").trim();if(!n)return;setCats(p=>p.map(c=>c.id===cid?{...c,subs:[...c.subs,{id:Date.now(),name:n}]}:c));setNewSubs(p=>({...p,[cid]:""}));};
  const delSub=(cid,sid)=>setCats(p=>p.map(c=>c.id===cid?{...c,subs:c.subs.filter(s=>s.id!==sid)}:c));
  const saveSub=(cid,sid)=>{const n=editSubName.trim();if(!n)return;setCats(p=>p.map(c=>c.id===cid?{...c,subs:c.subs.map(s=>s.id===sid?{...s,name:n}:s)}:c));setEditSubId(null);};

  return <Modal title="จัดการหมวดสินค้า" onClose={onClose} wide>
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()} placeholder="ชื่อหมวดใหม่..." style={{...IB,flex:1}}/>
      <button onClick={addCat} style={{padding:"8px 16px",borderRadius:6,border:"none",background:"var(--green)",color:"#fff",fontWeight:600,cursor:"pointer"}}>{"+ เพิ่มหมวด"}</button>
    </div>
    {cats.length===0&&<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem"}}>ยังไม่มีหมวด</div>}
    {cats.map(cat=>{
      const isEdit=editId===cat.id;
      return <div key={cat.id} style={{border:"1.5px solid var(--line)",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
        <div style={{background:"var(--bg)",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          {isEdit
            ? <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                <input value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveCat(cat.id)} style={{...IB,flex:1,padding:"5px 8px"}} autoFocus/>
                <button onClick={()=>saveCat(cat.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"var(--green)",color:"#fff",cursor:"pointer",fontSize:12}}>บันทึก</button>
                <button onClick={()=>setEditId(null)} style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--line)",background:"transparent",cursor:"pointer",fontSize:12,color:"var(--dim)"}}>ยกเลิก</button>
              </div>
            : <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                <span style={{fontWeight:600,fontSize:14,flex:1}}>{cat.name}</span>
                <span style={{fontSize:11,color:"var(--faint)"}}>{cat.subs.length+" หมวดย่อย"}</span>
                <button onClick={()=>{setEditId(cat.id);setEditName(cat.name);}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:12}}>{"แก้ไข"}</button>
                <button onClick={()=>delCat(cat.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:12}}>{"ลบ"}</button>
              </div>
          }
        </div>
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {cat.subs.map(sub=>{
              const isES=editSubId===sub.id;
              return <div key={sub.id} style={{display:"flex",alignItems:"center",gap:4,background:"var(--panel)",border:"1px solid "+(isES?"var(--green)":"var(--line)"),borderRadius:6,padding:"4px 8px"}}>
                {isES
                  ? <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <input value={editSubName} onChange={e=>setEditSubName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSub(cat.id,sub.id)} style={{...IB,width:120,padding:"3px 6px",fontSize:12}} autoFocus/>
                      <button onClick={()=>saveSub(cat.id,sub.id)} style={{padding:"2px 8px",borderRadius:4,border:"none",background:"var(--green)",color:"#fff",cursor:"pointer",fontSize:11}}>{"✓"}</button>
                      <button onClick={()=>setEditSubId(null)} style={{padding:"2px 6px",borderRadius:4,border:"1px solid var(--line)",background:"transparent",cursor:"pointer",fontSize:11,color:"var(--dim)"}}>{"✗"}</button>
                    </div>
                  : <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:13}}>{sub.name}</span>
                      <button onClick={()=>{setEditSubId(sub.id);setEditSubName(sub.name);}} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:"var(--blue)",cursor:"pointer",fontSize:12}}>{"แก้ไข"}</button>
                      <button onClick={()=>delSub(cat.id,sub.id)} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:14}}>{"×"}</button>
                    </div>
                }
              </div>;
            })}
          </div>
          <div style={{display:"flex",gap:6}}>
            <input value={newSubs[cat.id]||""} onChange={e=>setNewSubs(p=>({...p,[cat.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSub(cat.id)} placeholder="เพิ่มหมวดย่อย..." style={{...IB,flex:1,padding:"5px 8px",fontSize:12}}/>
            <button onClick={()=>addSub(cat.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:12}}>{"+ เพิ่ม"}</button>
          </div>
        </div>
      </div>;
    })}
    <MBtns onCancel={onClose}/>
  </Modal>;
}

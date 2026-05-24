import { useState, useMemo } from "react";
import { IB, ALL_TABS, TAB_LABELS, ALL_WIDGET_KEYS, DASH_WIDGETS } from "../utils/constants.js";
import { createUser, updateProfile, adminChangeEmail, adminChangePassword, deleteUser } from "../utils/auth.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Badge from "./ui/Badge.jsx";
import Btn from "./ui/Btn.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import StatCard from "./ui/StatCard.jsx";
import SB from "./ui/SearchBar.jsx";
import ActivityModal from "./ActivityModal.jsx";

const ROLES=["Admin","Manager","Warehouse","Accountant","SalesManager","Sales","Supplier","Staff"];
const RC={Admin:"var(--red)",Manager:"var(--blue)",Warehouse:"var(--orange)",Accountant:"var(--dim)",SalesManager:"var(--blue)",Sales:"var(--purple)",Supplier:"var(--orange)",Staff:"var(--faint)"};
const RBG={Admin:"rgba(255,59,48,0.12)",Manager:"rgba(0,122,255,0.12)",Warehouse:"rgba(255,149,0,0.14)",Accountant:"var(--hover)",SalesManager:"rgba(0,122,255,0.12)",Sales:"rgba(175,82,222,0.12)",Supplier:"rgba(255,149,0,0.14)",Staff:"var(--hover)"};
const RI={Admin:"A",Manager:"M",Warehouse:"W",Accountant:"$",SalesManager:"SM",Sales:"S",Supplier:"Su",Staff:"U"};
const ROLE_PRESETS={
  Admin:t=>({access:true,read:true,create:true,edit:true,delete:true,approve:t==="purchase"||t==="sales"}),
  Manager:()=>({access:true,read:true,create:false,edit:false,delete:false,approve:false}),
  Warehouse:t=>["dashboard","products","stock_log","purchase","suppliers","defective"].includes(t)?{access:true,read:true,create:t==="products"||t==="purchase"||t==="defective",edit:t==="products"||t==="purchase"||t==="defective",delete:false,approve:false}:{access:false,read:false,create:false,edit:false,delete:false,approve:false},
  Accountant:t=>t==="finance"?{access:true,read:true,create:true,edit:true,delete:false,approve:false}:["dashboard","stock_log","reports"].includes(t)?{access:true,read:true,create:false,edit:false,delete:false,approve:false}:{access:false,read:false,create:false,edit:false,delete:false,approve:false},
  SalesManager:t=>["dashboard","products","reports","ai_bot"].includes(t)?{access:true,read:true,create:false,edit:false,delete:false,approve:false}:["sales","customers"].includes(t)?{access:true,read:true,create:true,edit:true,delete:false,approve:true}:{access:false,read:false,create:false,edit:false,delete:false,approve:false},
  Sales:t=>["dashboard","products","ai_bot"].includes(t)?{access:true,read:true,create:false,edit:false,delete:false,approve:false}:["sales","customers"].includes(t)?{access:true,read:true,create:true,edit:false,delete:false,approve:false}:{access:false,read:false,create:false,edit:false,delete:false,approve:false},
  Supplier:t=>["dashboard","products","stock_log","purchase"].includes(t)?{access:true,read:true,create:false,edit:false,delete:false,approve:false}:{access:false,read:false,create:false,edit:false,delete:false,approve:false},
  Staff:()=>({access:false,read:false,create:false,edit:false,delete:false,approve:false}),
};

export default function UserPage({sh}){
  const{users,setUsers,modal,oM,cM,actLogs,sess}=sh;
  const[confirmDel,setConfirmDel]=useState(null);
  const[showActivity,setShowActivity]=useState(false);
  const[searchQ,setSearchQ]=useState("");
  const[roleFilter,setRoleFilter]=useState("");
  const[busy,setBusy]=useState(false);
  const PT=ALL_TABS;
  const PK=["access","read","create","edit","delete","approve"];
  const PL={access:"เข้าถึง",read:"ดู",create:"สร้าง",edit:"แก้ไข",delete:"ลบ",approve:"อนุมัติ"};
  const PC={access:"var(--purple)",read:"var(--blue)",create:"var(--green)",edit:"var(--orange)",delete:"var(--red)",approve:"var(--purple)"};
  const migrateP=perms=>{const r={};for(const[k,v]of Object.entries(perms||{})){if(typeof v==="string")r[k]=v==="edit"?{access:true,read:true,create:true,edit:true,delete:true,approve:k==="purchase"}:v==="view"?{access:true,read:true,create:false,edit:false,delete:false,approve:false}:{access:false,read:false,create:false,edit:false,delete:false,approve:false};else r[k]={...(v||{access:false}),approve:v?.approve??false};}return r;};
  const mkE=()=>{const perms={};[...PT,"users"].forEach(t=>perms[t]={access:false,read:false,create:false,edit:false,delete:false,approve:false});return{username:"",_newPassword:"",role:"Staff",salesName:"",supplierName:"",dashboardWidgets:[...ALL_WIDGET_KEYS],perms};};
  const[form,setForm]=useState(mkE());
  const toggleP=(tab,key)=>setForm(f=>{const cur={...(f.perms[tab]||{})};cur[key]=!cur[key];if(key==="access"&&!cur[key])PK.forEach(k=>cur[k]=false);if(key!=="access"&&cur[key])cur.access=true;if((key==="create"||key==="edit"||key==="delete")&&cur[key])cur.read=true;return{...f,perms:{...f.perms,[tab]:cur}};});
  const setAll=level=>setForm(f=>{const perms={};[...PT,"users"].forEach(t=>{perms[t]=level==="all"?{access:true,read:true,create:true,edit:true,delete:true,approve:t==="purchase"||t==="sales"}:level==="view"?{access:true,read:true,create:false,edit:false,delete:false,approve:false}:{access:false,read:false,create:false,edit:false,delete:false,approve:false};});return{...f,perms};});

  const save=async()=>{
    if(!form.username)return;
    setBusy(true);
    try{
      if(form.id){
        const oldUser=users.find(u=>u.id===form.id);
        const updated=form._newPassword?{...form,password:form._newPassword}:form;
        await updateProfile(form.id,updated);
        if(oldUser&&oldUser.username!==form.username)await adminChangeEmail(form.id,form.username);
        if(form._newPassword)await adminChangePassword(form.id,form._newPassword);
        setUsers(p=>p.map(u=>u.id===form.id?{...updated,_newPassword:undefined}:u));
      }else{
        if(!form._newPassword){setBusy(false);return;}
        const withPw={...form,password:form._newPassword};
        const userId=await createUser(form.username,form._newPassword,withPw);
        setUsers(p=>[...p,{...withPw,id:userId,_newPassword:undefined}]);
      }
      cM();
    }catch(e){
      alert("Error: "+e.message);
    }
    setBusy(false);
  };

  const del=async(id)=>{
    setBusy(true);
    try{
      await deleteUser(id);
      setUsers(p=>p.filter(u=>u.id!==id));
    }catch(e){
      alert("Error: "+e.message);
    }
    setBusy(false);
  };

  const filtered=useMemo(()=>{
    let arr=[...users];
    if(searchQ){const q=searchQ.toLowerCase();arr=arr.filter(u=>u.username.toLowerCase().includes(q)||(u.salesName||"").toLowerCase().includes(q)||(u.supplierName||"").toLowerCase().includes(q)||(u.staffName||"").toLowerCase().includes(q));}
    if(roleFilter)arr=arr.filter(u=>u.role===roleFilter);
    return arr;
  },[users,searchQ,roleFilter]);

  const stats=useMemo(()=>{
    const byRole={};ROLES.forEach(r=>byRole[r]=0);
    users.forEach(u=>{if(byRole[u.role]!==undefined)byRole[u.role]++;});
    return{total:users.length,byRole};
  },[users]);

  const roleOpts=[{value:"",label:"ทุก Role"},...ROLES.map(r=>({value:r,label:r}))];

  return <div>
    <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <StatCard label="User ทั้งหมด" value={stats.total} color="var(--blue)" accentBg="rgba(0,122,255,0.12)"/>
      <StatCard label="Admin / Manager" value={stats.byRole.Admin+stats.byRole.Manager} color="var(--red)" accentBg="rgba(255,59,48,0.12)" sub={stats.byRole.Admin+" admin, "+stats.byRole.Manager+" mgr"}/>
      <StatCard label="Sales" value={stats.byRole.Sales} color="var(--purple)" accentBg="rgba(175,82,222,0.12)"/>
      <StatCard label="Warehouse / Other" value={stats.byRole.Warehouse+stats.byRole.Accountant+stats.byRole.Supplier+stats.byRole.Staff} color="var(--orange)" accentBg="rgba(255,149,0,0.14)" sub={stats.byRole.Supplier+" supplier, "+stats.byRole.Warehouse+" wh"}/>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:8,flexWrap:"wrap"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flex:1,minWidth:200}}>
        <SB value={searchQ} onChange={setSearchQ} placeholder="ค้นหา user..."/>
        <div style={{minWidth:140}}><CustomSelect value={roleFilter} onChange={setRoleFilter} options={roleOpts}/></div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowActivity(true)} style={{padding:"6px 14px",borderRadius:6,border:"1px solid var(--line)",background:"transparent",fontSize:13,cursor:"pointer",color:"var(--text)"}}>{"ประวัติ"}</button>
        <Btn onClick={()=>{setForm(mkE());oM("user");}}>{"+ เพิ่ม User"}</Btn>
      </div>
    </div>

    <div style={{fontWeight:500,fontSize:13,color:"var(--dim)",marginBottom:10}}>{"บัญชีผู้ใช้ ("+filtered.length+")"}</div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{fontSize:48,marginBottom:12}}>U</div>
      <div style={{color:"var(--dim)",fontSize:14,marginBottom:4}}>ไม่พบ User</div>
      <div style={{color:"var(--faint)",fontSize:12,marginBottom:16}}>{searchQ||roleFilter?"ลองค้นหาด้วยคำอื่นหรือเปลี่ยนตัวกรอง":"เพิ่ม User แรกเพื่อเริ่มต้นใช้งาน"}</div>
    </div>}
    <div className="user-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
      {filtered.map(u=>{const mp=migrateP(u.perms);const accTabs=[...PT,"users"].filter(t=>mp[t]?.access);const editTabs=[...PT,"users"].filter(t=>mp[t]?.edit);const rc=RC[u.role]||"var(--dim)";const rbg=RBG[u.role]||"var(--hover)";const ri=RI[u.role]||"U";const isOnline=sess&&sess.username===u.username&&!sess.logoutTime;
      return<div key={u.id} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,borderLeft:"3px solid "+rc,padding:"1rem 1rem 0.75rem 1.1rem"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
          <div style={{width:40,height:40,borderRadius:99,background:rbg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,position:"relative"}}>
            {ri}
            {isOnline&&<span style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:99,background:"var(--green)",border:"2px solid var(--panel)"}}/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:600,fontSize:14}}>{u.username}</div>
              <Badge status={u.role}/>
            </div>
            {u.salesName&&<div style={{fontSize:11,color:"var(--purple)",marginTop:3}}>{u.salesName}</div>}
            {u.supplierName&&<div style={{fontSize:11,color:"var(--orange)",marginTop:2}}>{u.supplierName}{u.staffName?" · "+u.staffName:""}{u.roleTitle?" ("+u.roleTitle+")":""}</div>}
          </div>
        </div>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:10,lineHeight:1.5}}>
          <div>{"เข้าถึง: "+(accTabs.length>0?accTabs.map(t=>TAB_LABELS[t]?.th||t).join(", "):"ไม่มี")}</div>
          {editTabs.length>0&&<div style={{color:"var(--orange)"}}>{"แก้ไข: "+editTabs.map(t=>TAB_LABELS[t]?.th||t).join(", ")}</div>}
        </div>
        <div style={{display:"flex",gap:6,borderTop:"1px solid var(--line)",paddingTop:8}}>
          <button onClick={()=>{setForm({...u,_newPassword:"",perms:mp,dashboardWidgets:u.dashboardWidgets||[...ALL_WIDGET_KEYS]});oM("user");}} style={{flex:1,padding:"5px 0",borderRadius:6,border:"1px solid var(--blue)",background:"rgba(0,122,255,0.08)",color:"var(--blue)",cursor:"pointer",fontSize:11,fontWeight:500}}>{"แก้ไข"}</button>
          <button onClick={()=>{setForm({...u,_newPassword:"",perms:mp,dashboardWidgets:u.dashboardWidgets||[...ALL_WIDGET_KEYS]});oM("user");}} style={{flex:1,padding:"5px 0",borderRadius:6,border:"1px solid var(--purple)",background:"rgba(175,82,222,0.08)",color:"var(--purple)",cursor:"pointer",fontSize:11,fontWeight:500}}>{"สิทธิ์"}</button>
          {u.username!=="admin"&&<button onClick={()=>setConfirmDel(u)} style={{flex:1,padding:"5px 0",borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.08)",color:"var(--red)",cursor:"pointer",fontSize:11,fontWeight:500}}>{"ลบ"}</button>}
        </div>
      </div>;})}
    </div>

    {modal==="user"&&<Modal title={form.id?"แก้ไข User":"เพิ่ม User"} onClose={cM} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Field label="Username"><input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} style={IB}/></Field>
        <Field label={form.id?"เปลี่ยนรหัสผ่าน":"Password *"}><input type="password" value={form._newPassword||""} onChange={e=>setForm(f=>({...f,_newPassword:e.target.value}))} style={IB} placeholder={form.id?"ว่างไว้ถ้าไม่เปลี่ยน":"กรอกรหัสผ่าน"}/></Field>
        <Field label="Role"><CustomSelect value={form.role} onChange={v=>{setForm(f=>({...f,role:v}));}} options={ROLES}/></Field>
        {(form.role==="Sales"||form.role==="SalesManager")&&<Field label="ชื่อเซลส์"><input value={form.salesName||""} onChange={e=>setForm(f=>({...f,salesName:e.target.value}))} style={IB}/></Field>}
        {form.role==="Supplier"&&<Field label="ซัพพลายเออร์"><input value={form.supplierName||""} onChange={e=>setForm(f=>({...f,supplierName:e.target.value}))} style={IB}/></Field>}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontWeight:500,fontSize:13}}>สิทธิ์</div>
        <div style={{display:"flex",gap:6}}>
          {ROLE_PRESETS[form.role]&&<button onClick={()=>{const fn=ROLE_PRESETS[form.role];const perms={};[...PT,"users"].forEach(t=>perms[t]=fn(t));setForm(f=>({...f,perms}));}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid var(--purple)",color:"var(--purple)",background:"transparent",cursor:"pointer"}}>{"ตั้งค่าตาม "+form.role}</button>}
          <button onClick={()=>setAll("all")} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid var(--green)",color:"var(--green)",background:"transparent",cursor:"pointer"}}>ทั้งหมด</button>
          <button onClick={()=>setAll("view")} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid var(--blue)",color:"var(--blue)",background:"transparent",cursor:"pointer"}}>ดูอย่างเดียว</button>
          <button onClick={()=>setAll("none")} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid var(--red)",color:"var(--red)",background:"transparent",cursor:"pointer"}}>ปิด</button>
        </div>
      </div>
      <div className="perm-table-wrap">
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"2px solid var(--line)",background:"var(--bg)"}}><th style={{padding:"10px 8px",textAlign:"left",fontWeight:600,minWidth:100}}>เมนู</th>{PK.map(k=><th key={k} style={{padding:"10px 4px",textAlign:"center",fontWeight:600,color:PC[k],fontSize:11,minWidth:50}}>{PL[k]}{k==="approve"&&<div style={{fontSize:9,color:"var(--faint)",fontWeight:400}}>(PO/SO)</div>}</th>)}</tr></thead>
          <tbody>{[...PT,"users"].map(tab=>{const p=form.perms[tab]||{};return <tr key={tab} style={{borderBottom:"0.5px solid var(--line)",background:p.access?"":"var(--hover)"}}><td style={{padding:"8px",fontWeight:500,color:p.access?"var(--text)":"var(--faint)"}}>{TAB_LABELS[tab]?TAB_LABELS[tab].th:tab}</td>{PK.map(k=>{if(k==="approve"&&!["purchase","sales"].includes(tab))return <td key={k} style={{padding:"6px 4px",textAlign:"center",color:"var(--line)",fontSize:14}}>{"—"}</td>;return <td key={k} style={{padding:"6px 4px",textAlign:"center"}}><label style={{cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,background:p[k]?PC[k]+"18":"var(--hover)",border:"1.5px solid "+(p[k]?PC[k]:"var(--line)")}}><input type="checkbox" checked={!!p[k]} onChange={()=>toggleP(tab,k)} style={{display:"none"}}/>{p[k]&&<span style={{color:PC[k],fontWeight:700,fontSize:13}}>{"✓"}</span>}</label></td>;})}</tr>;})}</tbody>
        </table>
      </div>
      <div style={{marginTop:16,marginBottom:4}}>
        <div style={{fontWeight:500,fontSize:13,marginBottom:8}}>ลายเซ็นต์ (สำหรับอนุมัติ PO)</div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {form.signature&&<img src={form.signature} alt="sig" style={{height:48,border:"1px solid var(--line)",borderRadius:6}}/>}
          <label style={{cursor:"pointer",padding:"6px 12px",borderRadius:6,border:"1px solid var(--line)",fontSize:12,background:"var(--bg)",display:"inline-block"}}>
            {form.signature?"เปลี่ยนรูป":"อัปโหลดลายเซ็นต์"}
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setForm(fm=>({...fm,signature:ev.target.result}));r.readAsDataURL(f);}}/>
          </label>
          {form.signature&&<button onClick={()=>setForm(f=>({...f,signature:null}))} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1px solid var(--red)",color:"var(--red)",background:"transparent",cursor:"pointer"}}>ลบ</button>}
        </div>
      </div>
      <div style={{marginTop:16,marginBottom:4}}>
        <div style={{fontWeight:500,fontSize:13,marginBottom:10}}>Dashboard Widgets</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {DASH_WIDGETS.map(w=>{
            const on=(form.dashboardWidgets||[]).includes(w.key);
            const toggle=()=>setForm(f=>{const ws=f.dashboardWidgets||[];return{...f,dashboardWidgets:on?ws.filter(k=>k!==w.key):[...ws,w.key]};});
            return<button key={w.key} onClick={toggle} style={{padding:"6px 14px",borderRadius:6,border:"1.5px solid "+(on?"var(--green)":"var(--line)"),background:on?"rgba(52,199,89,0.12)":"var(--hover)",color:on?"var(--green)":"var(--faint)",fontSize:12,fontWeight:on?600:400,cursor:"pointer"}}>
              {on?"✓ ":""}{w.label}
            </button>;
          })}
        </div>
      </div>
      <MBtns onCancel={cM} onSave={save} saveLabel={busy?"กำลังบันทึก...":"บันทึก"} disabled={busy}/>
    </Modal>}

    {confirmDel&&<Modal title="ยืนยันลบ" onClose={()=>setConfirmDel(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบ "+confirmDel.username+" ถาวร"}</div>
      <MBtns onCancel={()=>setConfirmDel(null)} onSave={()=>{del(confirmDel.id);setConfirmDel(null);}} saveLabel={busy?"กำลังลบ...":"ลบ"} disabled={busy}/>
    </Modal>}

    {showActivity&&<ActivityModal actLogs={actLogs} sess={sess} onClose={()=>setShowActivity(false)}/>}
  </div>;
}

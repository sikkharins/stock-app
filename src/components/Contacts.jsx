import { useState, useMemo } from "react";
import { IB, TAB_LABELS } from "../utils/constants.js";
import { fmt, parseGmapsUrl } from "../utils/helpers.js";
import { createUser, deleteUser } from "../utils/auth.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Badge from "./ui/Badge.jsx";
import SB from "./ui/SearchBar.jsx";
import Btn from "./ui/Btn.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import StatCard from "./ui/StatCard.jsx";
import CustomerProfile from "./CustomerProfile.jsx";
import SupplierProfile from "./SupplierProfile.jsx";
import ContactExcelImport from "./ContactExcelImport.jsx";
import {
  salesByCustomerId,
  outstandingDetail,
  arStatus,
} from "../utils/customerStats.ts";

const STAFF_TABS = ["dashboard","products","stock_log","purchase","sales","finance","reports"];

const mkStaffPerms = () => Object.fromEntries(
  [...STAFF_TABS,"suppliers","customers","users"].map(t=>[t,{
    access:t==="products"||t==="purchase",
    read:t==="products"||t==="purchase",
    create:false,edit:false,delete:false
  }])
);

export default function ContactPage({sh,ft}){
  const{cN,pN,canE,canD,contacts,setContacts,search,setSearch,modal,oM,cM,cu,users,sales,quotes,payments,products,pos,brands}=sh;
  const SS=(users||[]).filter(u=>u.salesName).map(u=>u.salesName);
  const isC=ft==="customer";const tk=isC?"customers":"suppliers";const ed=canE(tk);const cd=canD(tk);
  const sf=isC&&cu.role!=="SalesManager"&&cu.salesName;
  const ef={type:ft,name:"",nameT:"",phone:"",email:"",address:"",taxId:"",salesPerson:"",vatReps:[],staff:[]};
  const[form,setForm]=useState(ef);const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const[viewProfile,setViewProfile]=useState(null);
  const[viewSupplier,setViewSupplier]=useState(null);
  const[newVR,setNewVR]=useState({name:"",address:"",idCard:""});
  const addVR=()=>{const n=newVR.name.trim();if(!n)return;setForm(f=>({...f,vatReps:[...f.vatReps,{id:Date.now(),name:n,address:newVR.address.trim(),idCard:newVR.idCard.trim()}]}));setNewVR({name:"",address:"",idCard:""});};
  const delVR=id=>setForm(f=>({...f,vatReps:f.vatReps.filter(r=>r.id!==id)}));

  // Staff management
  const[staffForm,setStaffForm]=useState(null);
  const mkSF=()=>({name:"",roleTitle:"",phone:"",email:"",lineId:"",username:"",_password:"",dashboardWidgets:["products","stock_value","recent_po","recent_log"],perms:mkStaffPerms()});
  const toggleSA=tab=>setStaffForm(f=>{const on=!f.perms[tab]?.access;return{...f,perms:{...f.perms,[tab]:{access:on,read:on,create:false,edit:false,delete:false}}};});
  const saveStaff=()=>{
    if(!staffForm.name||!staffForm.username||(!staffForm.authId&&!staffForm._password))return;
    const s={...staffForm,id:staffForm.id||Date.now()};
    setForm(f=>({...f,staff:staffForm.id?(f.staff||[]).map(x=>x.id===staffForm.id?s:x):[...(f.staff||[]),s]}));
    setStaffForm(null);
  };
  const delStaff=id=>setForm(f=>({...f,staff:(f.staff||[]).filter(s=>s.id!==id)}));

  const mk="c_"+ft;const title=isC?"ลูกค้า":"ซัพพลายเออร์";
  const[groupFilter,setGroupFilter]=useState("all");
  const filtered=(contacts||[]).filter(c=>{
    if(!c||c.type!==ft)return false;
    if(sf&&c.salesPerson!==cu.salesName)return false;
    if(isC&&groupFilter!=="all"){if(groupFilter==="regular"&&c.customerGroup!=="regular")return false;if(groupFilter==="walkin"&&c.customerGroup!=="walkin")return false;}
    if(search){const s=search.toLowerCase();if(!((cN(c)||"").toLowerCase().includes(s)||(c.email||"").toLowerCase().includes(s)))return false;}
    return true;
  });
  const groupCounts=useMemo(()=>{if(!isC)return{};const custs=(contacts||[]).filter(c=>c&&c.type==="customer"&&(!sf||c.salesPerson===cu.salesName));return{all:custs.length,regular:custs.filter(c=>c.customerGroup==="regular").length,walkin:custs.filter(c=>c.customerGroup==="walkin").length};},[contacts,isC,sf,cu]);
  const[savingContact,setSavingContact]=useState(false);const[formErrors,setFormErrors]=useState([]);
  const save=async()=>{
    const errs=[];if(!form.name)errs.push("ยังไม่กรอกชื่อ");if(errs.length){setFormErrors(errs);return;}setFormErrors([]);
    setSavingContact(true);
    try{
      const updatedStaff=[];
      for(const s of(form.staff||[])){
        if(s.username&&s._password&&!s.authId){
          const authId=await createUser(s.username,s._password,{role:"Supplier",supplierName:form.nameT||form.name,supplierStaffId:s.id,staffName:s.name,roleTitle:s.roleTitle||"",dashboardWidgets:s.dashboardWidgets||["products","stock_value","recent_po","recent_log"],perms:s.perms||{}});
          const{_password,...rest}=s;
          updatedStaff.push({...rest,authId});
        }else{
          const{_password,...rest}=s;
          updatedStaff.push(rest);
        }
      }
      const item={...form,staff:updatedStaff,id:form.id||Date.now()};
      setContacts(p=>form.id?p.map(c=>c.id===form.id?item:c):[...p,item]);
      cM();
    }catch(e){
      alert("Error: "+e.message);
    }
    setSavingContact(false);
  };
  const del=async id=>{const c=(contacts||[]).find(x=>x.id===id);if(!c)return;const staffWithAuth=(c.type==="supplier"&&Array.isArray(c.staff))?c.staff.filter(s=>s.authId):[];const extraWarn=staffWithAuth.length>0?"\n\nจะลบบัญชีผู้ใช้ที่ผูกอยู่ "+staffWithAuth.length+" คนด้วย":"";if(!confirm("ต้องการลบ "+(cN(c)||c.name||"รายการนี้")+" ?"+extraWarn))return;for(const s of staffWithAuth){try{await deleteUser(s.authId);}catch(e){console.warn("Failed to delete supplier auth:",s.username,e?.message);}}setContacts(p=>p.filter(x=>x.id!==id));};

  const todayDate=useMemo(()=>new Date(),[]);
  const salesByCust=useMemo(()=>salesByCustomerId(sales||[]),[sales]);

  const custStats=useMemo(()=>{
    if(!isC)return null;
    const custs=(contacts||[]).filter(c=>c&&c.type==="customer"&&(!sf||c.salesPerson===cu.salesName));
    const cutoff30=new Date(todayDate.getTime()-30*86_400_000).toISOString().slice(0,10);
    const cutoff60=new Date(todayDate.getTime()-60*86_400_000).toISOString().slice(0,10);
    let newCount=0,newCountPrev=0;
    const thirtyMs=30*86_400_000;
    for(const c of custs){
      if(typeof c.id!=="number")continue;
      const age=todayDate.getTime()-c.id;
      if(age<thirtyMs)newCount++;
      else if(age<2*thirtyMs)newCountPrev++;
    }
    const countDelta=newCountPrev>0?Math.round(((newCount-newCountPrev)/newCountPrev)*100):0;
    let revLast30=0,revPrev30=0,orderCount=0;
    const custIdSet=new Set(custs.map(c=>c.id));
    for(const so of sales||[]){
      if(so==null||!so.date||!custIdSet.has(so.customerId))continue;
      const net=(so.items||[]).reduce((s,i)=>s+(i.qty||0)*(i.price||0),0)-(so.discountAmt||0);
      if(so.date>=cutoff30){revLast30+=net;orderCount++;}
      else if(so.date>=cutoff60)revPrev30+=net;
    }
    const revDelta=revPrev30>0?Math.round(((revLast30-revPrev30)/revPrev30)*100):0;
    let arTotal=0,arCount=0,overdueCount=0,dormantCount=0,dormantCountPrior=0;
    const sevenAgo=new Date(todayDate.getTime()-7*86_400_000);
    for(const c of custs){
      const mine=salesByCust[c.id]||[];
      const od=outstandingDetail(c,mine,payments||[],todayDate);
      arTotal+=od.total;arCount+=od.count;overdueCount+=od.overdueCount;
      if(arStatus(c,mine,payments||[],todayDate)==="dormant")dormantCount++;
      if(arStatus(c,mine,payments||[],sevenAgo)==="dormant")dormantCountPrior++;
    }
    const dormantDelta=dormantCount-dormantCountPrior;
    const revSeries=new Array(30).fill(0);
    const cumCustSeries=new Array(30).fill(0);
    for(let i=0;i<30;i++){
      const day=new Date(todayDate.getTime()-(29-i)*86_400_000).toISOString().slice(0,10);
      for(const so of sales||[]){
        if(!so||so.date!==day||!custIdSet.has(so.customerId))continue;
        const net=(so.items||[]).reduce((s,it)=>s+(it.qty||0)*(it.price||0),0)-(so.discountAmt||0);
        revSeries[i]+=net;
      }
      const dayMs=new Date(day+"T23:59:59Z").getTime();
      cumCustSeries[i]=custs.filter(c=>typeof c.id==="number"&&c.id<=dayMs).length;
    }
    return{total:custs.length,newCount,countDelta,revLast30,orderCount,revDelta,arTotal,arCount,overdueCount,dormantCount,dormantDelta,revSeries,cumCustSeries};
  },[isC,contacts,sales,payments,salesByCust,sf,cu,todayDate]);

  const supStats=useMemo(()=>{
    if(isC)return null;
    const sups=filtered;
    const allPOs=(pos||[]).filter(po=>sups.some(s=>s.id===po.supplierId));
    const pendingPOs=allPOs.filter(po=>["pending","pending_approval","approved"].includes(po.status)).length;
    const totalStaff=sups.reduce((s,c)=>s+(c.staff||[]).length,0);
    const totalVal=allPOs.reduce((s,po)=>s+(po.items||[]).reduce((a,i)=>a+i.qty*(i.cost||0),0),0);
    return{totalPO:allPOs.length,pendingPOs,totalStaff,totalVal};
  },[isC,filtered,pos]);

  const poCountMap=useMemo(()=>{
    if(isC)return{};
    const m={};
    (pos||[]).forEach(po=>{if(!m[po.supplierId])m[po.supplierId]={count:0,val:0};m[po.supplierId].count++;m[po.supplierId].val+=(po.items||[]).reduce((s,i)=>s+i.qty*(i.cost||0),0);});
    return m;
  },[isC,pos]);

  return <div>
    {!isC&&supStats&&<div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <StatCard label="ซัพพลายเออร์" value={filtered.length} color="var(--blue)" accentBg="rgba(0,122,255,0.12)"/>
      <StatCard label="PO ทั้งหมด" value={supStats.totalPO} sub={"฿"+fmt(supStats.totalVal)}/>
      <StatCard label="PO รอดำเนินการ" value={supStats.pendingPOs} color={supStats.pendingPOs>0?"var(--orange)":"var(--green)"} accentBg={supStats.pendingPOs>0?"rgba(255,149,0,0.14)":"rgba(52,199,89,0.12)"}/>
      <StatCard label="Staff ทั้งหมด" value={supStats.totalStaff} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
    </div>}
    {isC&&custStats&&<div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <StatCard
        label="ลูกค้าทั้งหมด"
        value={null}
        animatedValue={custStats.total}
        format={n=>Math.round(n).toLocaleString()}
        sub={"+"+custStats.newCount+" ใหม่ 30 วัน"}
        delta={custStats.countDelta!==0?{text:(custStats.countDelta>0?"+":"")+custStats.countDelta+"%",positive:custStats.countDelta>=0}:undefined}
        sparkline={custStats.cumCustSeries}
        color="var(--blue)"
        accentBg="rgba(0,122,255,0.12)"
      />
      <StatCard
        label="ยอดขาย 30 วัน"
        value={null}
        animatedValue={custStats.revLast30}
        format={n=>"฿"+fmt(Math.round(n))}
        sub={"จาก "+custStats.orderCount+" orders"}
        delta={custStats.revDelta!==0?{text:(custStats.revDelta>0?"+":"")+custStats.revDelta+"%",positive:custStats.revDelta>=0}:undefined}
        sparkline={custStats.revSeries}
        color="var(--green)"
        accentBg="rgba(52,199,89,0.12)"
      />
      <StatCard
        label="AR ค้าง"
        value={"฿"+fmt(Math.round(custStats.arTotal))}
        sub={custStats.arCount+" ใบ · "+custStats.overdueCount+" เกินกำหนด"}
        color={custStats.overdueCount>0?"var(--red)":"var(--orange)"}
        accentBg={custStats.overdueCount>0?"rgba(255,59,48,0.12)":"rgba(255,149,0,0.14)"}
      />
      <StatCard
        label="เสี่ยงหาย"
        value={custStats.dormantCount}
        sub="ไม่ซื้อเกิน 60 วัน"
        delta={custStats.dormantDelta!==0?{text:(custStats.dormantDelta>0?"+":"")+custStats.dormantDelta+" สัปดาห์นี้",positive:custStats.dormantDelta<=0}:undefined}
        color={custStats.dormantCount>0?"var(--red)":"var(--green)"}
        accentBg={custStats.dormantCount>0?"rgba(255,59,48,0.12)":"rgba(52,199,89,0.12)"}
      />
    </div>}
    {isC&&<div style={{display:"flex",gap:6,marginBottom:12}}>
      {[{k:"all",label:"ทั้งหมด",icon:""},{k:"regular",label:"ประจำ",icon:""},{k:"walkin",label:"หน้าร้าน",icon:""}].map(g=><button key={g.k} onClick={()=>setGroupFilter(g.k)} style={{padding:"6px 14px",borderRadius:20,border:groupFilter===g.k?"2px solid var(--blue)":"1px solid var(--line)",background:groupFilter===g.k?"rgba(0,122,255,0.1)":"var(--bg)",color:groupFilter===g.k?"var(--blue)":"var(--dim)",fontSize:12,fontWeight:groupFilter===g.k?600:400,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>{g.icon&&<span>{g.icon}</span>}{g.label}<span style={{fontSize:11,opacity:0.7,marginLeft:2}}>({groupCounts[g.k]||0})</span></button>)}
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:8,flexWrap:"wrap"}}>
      <SB value={search} onChange={setSearch} placeholder={"ค้นหา"+title+"..."}/>
      {ed&&<div style={{display:"flex",gap:8}}><Btn onClick={()=>oM("contactImport")}>{"นำเข้า Excel"}</Btn><Btn onClick={()=>{setFormErrors([]);setForm({...ef,customerGroup:isC?"walkin":undefined});oM(mk);}}>{"+ เพิ่ม"+title}</Btn></div>}
    </div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{fontSize:48,marginBottom:12}}>{isC?"C":"S"}</div>
      <div style={{color:"var(--dim)",fontSize:14,marginBottom:4}}>{"ยังไม่มี"+title}</div>
      <div style={{color:"var(--faint)",fontSize:12,marginBottom:16}}>{search?"ลองค้นหาด้วยคำอื่น":("เพิ่ม"+title+"รายแรกเพื่อเริ่มต้นใช้งาน")}</div>
      {ed&&!search&&<Btn onClick={()=>{setFormErrors([]);setForm({...ef});oM(mk);}}>{"+ เพิ่ม"+title+"แรก"}</Btn>}
    </div>}
    <div className="contact-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
      {filtered.map(c=>{const poInfo=!isC?poCountMap[c.id]:null;return<div key={c.id} style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem 1.25rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div onClick={isC?()=>setViewProfile(c):()=>setViewSupplier(c)} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"} style={{fontWeight:600,fontSize:14,cursor:"pointer",color:"var(--blue)"}}>{cN(c)}</div>
          <Badge status={c.type}/>
        </div>
        {isC&&c.customerGroup&&<div style={{marginBottom:4}}><span style={{fontSize:11,borderRadius:99,padding:"2px 8px",fontWeight:500,...(c.customerGroup==="regular"?{background:"rgba(52,199,89,0.12)",color:"var(--green)"}:{background:"rgba(142,142,147,0.12)",color:"var(--faint)"})}}>{c.customerGroup==="regular"?"ประจำ":"หน้าร้าน"}</span></div>}
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:2}}>{c.phone||"-"}</div>
        <div style={{fontSize:12,color:"var(--blue)",marginBottom:4}}>{c.email||"-"}</div>
        {!isC&&c.taxId&&<div style={{fontSize:11,color:"var(--faint)",marginBottom:2}}>{"Tax ID: "+c.taxId}</div>}
        {!isC&&c.address&&<div style={{fontSize:11,color:"var(--faint)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address}</div>}
        {!isC&&poInfo&&<div style={{display:"flex",gap:8,marginBottom:8,marginTop:6}}>
          <span style={{fontSize:11,background:"rgba(0,122,255,0.1)",color:"var(--blue)",borderRadius:99,padding:"3px 10px",fontWeight:500}}>{poInfo.count+" PO"}</span>
          <span style={{fontSize:11,background:"rgba(52,199,89,0.1)",color:"var(--green)",borderRadius:99,padding:"3px 10px",fontWeight:500}}>{"฿"+fmt(poInfo.val)}</span>
        </div>}
        {isC&&c.salesPerson&&<div style={{fontSize:12,marginBottom:6}}><span style={{background:"rgba(175,82,222,0.12)",color:"var(--purple)",borderRadius:99,padding:"2px 10px",fontWeight:500,fontSize:11}}>{c.salesPerson}</span></div>}
        {isC&&c.vatReps&&c.vatReps.length>0&&<div style={{background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:6,padding:"6px 10px",marginBottom:8,fontSize:12}}>
          <div style={{color:"var(--blue)",fontWeight:500,marginBottom:4}}>{"ตัวแทน VAT ("+c.vatReps.length+")"}</div>
          {c.vatReps.map(r=><div key={r.id} style={{marginBottom:3}}><span style={{fontWeight:500}}>{r.name}</span><span style={{color:"var(--faint)",marginLeft:6}}>{r.idCard}</span></div>)}
        </div>}
        {!isC&&(c.staff||[]).length>0&&<div style={{background:"rgba(52,199,89,0.08)",border:"1px solid var(--green)",borderRadius:6,padding:"6px 10px",marginBottom:8,fontSize:12}}>
          <div style={{color:"var(--green)",fontWeight:500,marginBottom:4}}>{"Staff ("+c.staff.length+" คน)"}</div>
          {c.staff.map(s=><div key={s.id} style={{marginBottom:3,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontWeight:500}}>{s.name}</span>
            <span style={{background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:99,padding:"1px 7px",fontSize:10}}>{s.roleTitle}</span>
            <span style={{color:"var(--faint)",fontSize:11}}>{"@"+s.username}</span>
          </div>)}
        </div>}
        {ed&&<div style={{display:"flex",gap:8,marginTop:8,borderTop:"1px solid var(--line)",paddingTop:8}}>
          <button onClick={()=>{setFormErrors([]);setForm({vatReps:[],address:"",taxId:"",salesPerson:"",staff:[],...c});oM(mk);}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"6px 0",borderRadius:6,border:"1px solid var(--blue)",background:"rgba(0,122,255,0.08)",color:"var(--blue)",cursor:"pointer",fontSize:12,fontWeight:500}}>{"แก้ไข"}</button>
          {cd&&<button onClick={()=>del(c.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"6px 0",borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.08)",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:500}}>{"ลบ"}</button>}
        </div>}
      </div>;})}
    </div>

    {modal==="contactImport"&&<ContactExcelImport contactType={ft} onClose={cM} onImport={(items)=>{setContacts(p=>[...p,...items]);sh.addA("นำเข้า Excel",items.length+" "+title);}}/>}

    {viewProfile&&isC&&<CustomerProfile customer={contacts.find(c=>c.id===viewProfile.id)||viewProfile} sales={sales} quotes={quotes} payments={payments} products={products} pN={pN} promos={sh.promos||[]} setContacts={setContacts} canEdit={canE("contacts")} onClose={()=>setViewProfile(null)}/>}
    {viewSupplier&&!isC&&<SupplierProfile supplier={viewSupplier} pos={pos||[]} payments={payments||[]} products={products||[]} pN={pN} cN={cN} onClose={()=>setViewSupplier(null)}/>}

    {modal===mk&&ed&&<Modal title={(form.id?"แก้ไข":"เพิ่ม")+title} onClose={cM} wide>
      <div className="form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="ชื่อ EN"><input value={form.name||""} onChange={e=>setF("name",e.target.value)} style={IB}/></Field>
        <Field label="ชื่อ TH"><input value={form.nameT||""} onChange={e=>setF("nameT",e.target.value)} style={IB}/></Field>
        <Field label="โทร"><input value={form.phone||""} onChange={e=>setF("phone",e.target.value)} style={IB}/></Field>
        <Field label="Email"><input value={form.email||""} onChange={e=>setF("email",e.target.value)} style={IB}/></Field>
        {isC&&<div style={{gridColumn:"1/-1"}}><Field label="เซลส์"><CustomSelect value={form.salesPerson||""} onChange={v=>setF("salesPerson",v)} options={[{value:"",label:"ไม่ระบุ"},...SS.map(s=>({value:s,label:s}))]}/></Field></div>}
        {isC&&<Field label="กลุ่มลูกค้า"><CustomSelect value={form.customerGroup||""} onChange={v=>setF("customerGroup",v)} options={[{value:"walkin",label:"ลูกค้าหน้าร้าน"},{value:"regular",label:"ลูกค้าประจำ"}]}/></Field>}
        {isC&&<Field label="วันเครดิตเริ่มต้น"><CustomSelect value={String(form.defaultCreditDays||"")} onChange={v=>setF("defaultCreditDays",v?+v:0)} options={[{value:"",label:"ค่าเริ่มต้น (45 วัน)"},...[45,60,90].map(d=>({value:String(d),label:d+" วัน"}))]}/></Field>}
        {isC&&<Field label="ส่วนลดเริ่มต้น"><CustomSelect value={String(form.defaultDiscount!=null?form.defaultDiscount:"")} onChange={v=>setF("defaultDiscount",v!==""?+v:null)} options={[{value:"",label:"ค่าเริ่มต้น (1%)"},...[0,1,2,3,5].map(d=>({value:String(d),label:d===0?"ไม่ลด":d+"%"}))]}/></Field>}
        {isC&&<Field label="ประเภทชำระเริ่มต้น"><CustomSelect value={form.defaultPayType||""} onChange={v=>setF("defaultPayType",v||"")} options={[{value:"",label:"ค่าเริ่มต้น (เงินสด)"},{value:"cash",label:"เงินสด"},{value:"credit",label:"เครดิต"}]}/></Field>}
        {isC&&<Field label="VAT เริ่มต้น"><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"6px 0"}}><input type="checkbox" checked={form.defaultVat!==false} onChange={e=>setF("defaultVat",e.target.checked)}/><span style={{fontSize:13,color:"var(--text)"}}>รวม VAT 7%</span></label></Field>}
        {!isC&&<Field label="เครดิตวัน"><CustomSelect value={String(form.creditDays||"")} onChange={v=>setF("creditDays",v?+v:0)} options={[{value:"",label:"— เลือก —"},{value:"45",label:"45 วัน"},{value:"60",label:"60 วัน"}]}/></Field>}
        {!isC&&<div style={{gridColumn:"1/-1"}}><Field label="ยี่ห้อที่จำหน่าย">
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{(form.linkedBrands||[]).map(b=><span key={b} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:99,background:"var(--blue-bg)",border:"1px solid var(--blue)",color:"var(--blue)",fontSize:12,fontWeight:500}}>{b}<span onClick={()=>setF("linkedBrands",(form.linkedBrands||[]).filter(x=>x!==b))} style={{cursor:"pointer",fontSize:14,lineHeight:1}}>{"×"}</span></span>)}</div>
          <CustomSelect value="" onChange={v=>{if(v&&!(form.linkedBrands||[]).includes(v))setF("linkedBrands",[...(form.linkedBrands||[]),v]);}} options={[{value:"",label:"+ เลือกยี่ห้อ..."},...(brands||[]).filter(b=>!(form.linkedBrands||[]).includes(b)).map(b=>({value:b,label:b}))]}/>
        </Field></div>}
        <div style={{gridColumn:"1/-1"}}><Field label="Tax ID"><input value={form.taxId||""} onChange={e=>setF("taxId",e.target.value)} style={IB}/></Field></div>
        <div style={{gridColumn:"1/-1"}}><Field label="ที่อยู่"><textarea value={form.address||""} onChange={e=>setF("address",e.target.value)} style={{...IB,height:56,resize:"vertical"}}/></Field></div>
        {isC&&<div style={{gridColumn:"1/-1",background:"var(--hover)",border:"1px solid var(--line)",borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:8}}>พิกัดสำหรับวางแผนจัดส่ง (ไม่บังคับ)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <Field label="Latitude"><input type="number" step="0.000001" value={form.lat??""} onChange={e=>setF("lat",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="13.7563"/></Field>
            <Field label="Longitude"><input type="number" step="0.000001" value={form.lng??""} onChange={e=>setF("lng",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="100.5018"/></Field>
          </div>
          <Field label="วาง URL จาก Google Maps">
            <input type="text" placeholder="เปิด Google Maps → คัดลอก URL → วางที่นี่" style={IB} onChange={e=>{const r=parseGmapsUrl(e.target.value);if(r){setF("lat",r.lat);setF("lng",r.lng);e.target.value="";}}}/>
          </Field>
          <div style={{fontSize:11,color:"var(--faint)",marginTop:4}}>หมายเหตุ: ถ้าเป็นลิงก์สั้น (maps.app.goo.gl) เปิดก่อนแล้ว copy URL ที่ขึ้นใหม่</div>
          <div style={{marginTop:8}}>
            <Field label="โน้ตจุดส่ง (สำหรับคนขับ)"><input value={form.geoNote||""} onChange={e=>setF("geoNote",e.target.value)} style={IB} placeholder="เช่น อยู่หน้าตลาดสด, ตรงข้ามปั๊ม"/></Field>
          </div>
        </div>}
        {isC&&<div style={{gridColumn:"1/-1"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--blue)",background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:8,padding:"8px 12px",marginBottom:8}}>{"ตัวแทนรับ VAT ("+(form.vatReps||[]).length+" คน)"}</div>
          {(form.vatReps||[]).map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:6,marginBottom:6}}>
            <div style={{flex:1,fontSize:12}}><div style={{fontWeight:500}}>{r.name}</div><div style={{color:"var(--dim)"}}>{r.address}</div><div style={{color:"var(--faint)"}}>{"บัตร ปชช: "+r.idCard}</div></div>
            <button onClick={()=>delVR(r.id)} style={{padding:"4px 8px",borderRadius:4,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:12}}>{"×"}</button>
          </div>)}
          <div style={{background:"var(--hover)",border:"1px dashed var(--blue)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:11,fontWeight:500,color:"var(--blue)",marginBottom:6}}>เพิ่มตัวแทนใหม่</div>
            <div className="form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Field label="ชื่อ"><input value={newVR.name} onChange={e=>setNewVR(p=>({...p,name:e.target.value}))} style={IB} placeholder="ชื่อ-นามสกุล"/></Field>
              <Field label="เลขบัตร ปชช."><input value={newVR.idCard} onChange={e=>setNewVR(p=>({...p,idCard:e.target.value}))} style={IB} placeholder="13 หลัก"/></Field>
            </div>
            <Field label="ที่อยู่"><textarea value={newVR.address} onChange={e=>setNewVR(p=>({...p,address:e.target.value}))} style={{...IB,height:50,resize:"vertical"}} placeholder="ที่อยู่สำหรับออก VAT"/></Field>
            <button onClick={addVR} style={{marginTop:8,padding:"6px 14px",borderRadius:6,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:500}}>{"+ เพิ่มตัวแทน"}</button>
          </div>
        </div>}

        {/* Supplier Staff Section */}
        {!isC&&<div style={{gridColumn:"1/-1",marginTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(52,199,89,0.08)",border:"1px solid var(--green)",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--green)"}}>{"Staff / พนักงาน ("+(form.staff||[]).length+" คน)"}</div>
            <button onClick={()=>setStaffForm(mkSF())} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"var(--green)",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:500}}>{"+ เพิ่ม Staff"}</button>
          </div>
          {(form.staff||[]).length===0&&<div style={{textAlign:"center",color:"var(--faint)",fontSize:12,padding:"12px",background:"var(--hover)",borderRadius:6,border:"1px dashed var(--line)"}}>ยังไม่มี Staff — กด "+ เพิ่ม Staff" เพื่อสร้างบัญชีพนักงาน</div>}
          {(form.staff||[]).map(s=><div key={s.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontWeight:500,fontSize:13}}>{s.name}</span>
                <span style={{background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:500}}>{s.roleTitle||"Staff"}</span>
              </div>
              <div style={{fontSize:11,color:"var(--faint)",display:"flex",gap:10,flexWrap:"wrap"}}>
                <span>{s.username}</span>
                {s.phone&&<span>{s.phone}</span>}
                {s.lineId&&<span>{"LINE: "+s.lineId}</span>}
              </div>
              <div style={{fontSize:11,color:"var(--dim)",marginTop:3}}>
                {STAFF_TABS.filter(t=>s.perms?.[t]?.access).map(t=>TAB_LABELS[t]?.th||t).join(", ")||"ไม่มีสิทธิ์เข้าถึงเมนู"}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>setStaffForm({...s})} style={{padding:"4px 10px",borderRadius:5,border:"1px solid var(--blue)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontSize:12}}>แก้ไข</button>
              <button onClick={()=>delStaff(s.id)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid var(--red)",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:12}}>ลบ</button>
            </div>
          </div>)}
        </div>}
      </div>
      {formErrors.length>0&&<div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"10px 14px",marginTop:12}}><div style={{fontSize:12,fontWeight:600,color:"var(--red)",marginBottom:4}}>กรุณากรอกข้อมูลให้ครบ:</div>{formErrors.map((e,i)=><div key={i} style={{fontSize:12,color:"var(--red)",marginBottom:2}}>{"• "+e}</div>)}</div>}
      <MBtns onCancel={cM} onSave={save}/>
    </Modal>}

    {/* Staff detail modal — z:200, stacks above supplier modal */}
    {modal===mk&&staffForm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:200,paddingTop:40,overflowY:"auto"}}>
      <div style={{background:"var(--panel)",borderRadius:12,border:"1.5px solid var(--line)",padding:"1.5rem",width:"min(680px,96%)",maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:600,fontSize:15}}>{(staffForm.id?"แก้ไข":"เพิ่ม")+" Staff"}</span>
          <span onClick={()=>setStaffForm(null)} style={{cursor:"pointer",color:"var(--faint)",fontSize:26,lineHeight:1}}>{"×"}</span>
        </div>
        <div className="form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <Field label="ชื่อ *"><input value={staffForm.name||""} onChange={e=>setStaffForm(f=>({...f,name:e.target.value}))} style={IB} placeholder="ชื่อ-นามสกุล"/></Field>
          <Field label="ตำแหน่ง (Role Title)"><input value={staffForm.roleTitle||""} onChange={e=>setStaffForm(f=>({...f,roleTitle:e.target.value}))} style={IB} placeholder="เช่น Sales, Manager"/></Field>
          <Field label="โทร"><input value={staffForm.phone||""} onChange={e=>setStaffForm(f=>({...f,phone:e.target.value}))} style={IB}/></Field>
          <Field label="Email"><input value={staffForm.email||""} onChange={e=>setStaffForm(f=>({...f,email:e.target.value}))} style={IB}/></Field>
          <Field label="LINE ID"><input value={staffForm.lineId||""} onChange={e=>setStaffForm(f=>({...f,lineId:e.target.value}))} style={IB}/></Field>
          <div/>
          <Field label="Username *"><input value={staffForm.username||""} onChange={e=>setStaffForm(f=>({...f,username:e.target.value}))} style={IB} placeholder="สำหรับเข้าสู่ระบบ" disabled={!!staffForm.authId}/></Field>
          <Field label={staffForm.authId?"เปลี่ยนรหัสผ่าน":"Password *"}><input type="password" value={staffForm._password||""} onChange={e=>setStaffForm(f=>({...f,_password:e.target.value}))} style={IB} placeholder={staffForm.authId?"ว่างไว้ถ้าไม่เปลี่ยน":"รหัสผ่าน"}/></Field>
        </div>
        <div style={{background:"rgba(255,149,0,0.14)",border:"1px solid var(--orange)",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"var(--orange)"}}>
          {"Staff ทุกคนดูได้อย่างเดียว (View Only) — ไม่สามารถสร้าง แก้ไข หรือลบข้อมูลได้"}
        </div>
        <div style={{fontWeight:500,fontSize:13,marginBottom:10}}>{"สิทธิ์เข้าใช้เมนู (เลือกเมนูที่เปิดให้ดู)"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {STAFF_TABS.map(tab=>{
            const on=staffForm.perms?.[tab]?.access;
            return <label key={tab} onClick={()=>toggleSA(tab)} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"1.5px solid "+(on?"var(--green)":"var(--line)"),background:on?"rgba(52,199,89,0.12)":"var(--hover)"}}>
              <span style={{width:20,height:20,borderRadius:4,border:"1.5px solid "+(on?"var(--green)":"var(--line)"),background:on?"var(--green)":"var(--panel)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,flexShrink:0}}>{on&&"v"}</span>
              <span style={{fontSize:12,fontWeight:on?500:400,color:on?"var(--green)":"var(--dim)"}}>{TAB_LABELS[tab]?.th||tab}</span>
            </label>;
          })}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:10}}>
          <button onClick={()=>setStaffForm(null)} style={{padding:"7px 14px",borderRadius:6,border:"1px solid var(--line)",cursor:"pointer",background:"transparent",color:"var(--dim)"}}>ยกเลิก</button>
          <button onClick={saveStaff} style={{padding:"7px 14px",borderRadius:6,border:"1px solid var(--green)",cursor:"pointer",background:"rgba(52,199,89,0.12)",fontWeight:500,color:"var(--green)"}}>บันทึก Staff</button>
        </div>
      </div>
    </div>}
  </div>;
}

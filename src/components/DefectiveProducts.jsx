import { useState, useMemo, useEffect, useCallback } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";

const SUP_STATUSES=[
  {key:"pending_inspection",label:"รอช่างตรวจสอบ",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},
  {key:"inspected",label:"ตรวจแล้วรอเก็บ",color:"var(--blue)",bg:"var(--blue-bg)"},
  {key:"stored",label:"เก็บแล้วรอ CN",color:"var(--purple)",bg:"rgba(175,82,222,0.14)"},
  {key:"cn_received",label:"ได้รับ CN แล้ว",color:"var(--green)",bg:"rgba(52,199,89,0.12)"},
];
const CUST_STATUSES=[
  {key:"cn_created",label:"สร้าง CN แล้ว",color:"#2aa198",bg:"rgba(42,161,152,0.12)"},
  {key:"cn_used",label:"คืน CN แล้ว",color:"#28a745",bg:"rgba(40,167,69,0.12)"},
];
const ALL_STATUSES=[...SUP_STATUSES,...CUST_STATUSES];

const stLabel=key=>{const s=ALL_STATUSES.find(x=>x.key===key);return s?s.label:key||"—";};
const stColor=key=>{const s=ALL_STATUSES.find(x=>x.key===key);return s?s.color:"var(--dim)";};
const stBg=key=>{const s=ALL_STATUSES.find(x=>x.key===key);return s?s.bg:"var(--hover)";};

export default function DefectivePage({sh}){
  const{pN,cN,products,contacts,sales,defectives,setDefectives,cnotes,canE,canC,canD,modal,oM,cM}=sh;
  const ed=canE("defective");const cd=canD("defective");
  const[filter,setFilter]=useState("all");
  const[search,setSearch]=useState("");
  const[form,setForm]=useState(null);
  const[viewItem,setViewItem]=useState(null);
  const[statusDropId,setStatusDropId]=useState(null);

  useEffect(()=>{
    if(!statusDropId)return;
    const close=()=>setStatusDropId(null);
    document.addEventListener("click",close);
    return()=>document.removeEventListener("click",close);
  },[statusDropId]);

  const customers=useMemo(()=>contacts.filter(c=>c.type==="customer"),[contacts]);

  const genCode=()=>{
    const yr=String(new Date().getFullYear()+543);
    const nums=defectives.filter(d=>d.code&&d.code.startsWith("DF-"+yr)).map(d=>+d.code.split("-")[2]||0);
    return "DF-"+yr+"-"+String(Math.max(0,...nums)+1).padStart(3,"0");
  };

  const filtered=useMemo(()=>{
    let list=[...defectives].reverse();
    if(filter!=="all"){
      if(CUST_STATUSES.some(s=>s.key===filter))list=list.filter(d=>d.custStatus===filter);
      else list=list.filter(d=>d.status===filter);
    }
    if(search){const s=search.toLowerCase();list=list.filter(d=>{
      const pr=products.find(p=>p.id===d.productId);
      const cust=contacts.find(c=>c.id===d.customerId);
      return (d.code||"").toLowerCase().includes(s)||
        (pr&&pN(pr).toLowerCase().includes(s))||
        (cust&&cN(cust).toLowerCase().includes(s))||
        (d.soNum||"").toLowerCase().includes(s)||
        (d.serialNo||"").toLowerCase().includes(s);
    });}
    return list;
  },[defectives,filter,search,products,contacts]);

  const counts=useMemo(()=>{
    const c={all:defectives.length};
    SUP_STATUSES.forEach(s=>c[s.key]=defectives.filter(d=>d.status===s.key).length);
    CUST_STATUSES.forEach(s=>c[s.key]=defectives.filter(d=>d.custStatus===s.key).length);
    return c;
  },[defectives]);

  const openAdd=()=>{
    setForm({id:null,code:genCode(),productId:"",customerId:"",soNum:"",serialNo:"",symptom:"",status:"pending_inspection",custStatus:"",date:todayStr(),note:""});
    oM("defForm");
  };

  const openEdit=d=>{
    setForm({...d,productId:String(d.productId),customerId:String(d.customerId)});
    oM("defForm");
  };

  const openView=d=>setViewItem(d);
  const closeView=()=>setViewItem(null);

  const custSOs=useMemo(()=>{
    if(!form||!form.customerId)return[];
    let list=sales.filter(so=>so.customerId===+form.customerId&&so.status!=="draft");
    if(form.productId)list=list.filter(so=>(so.items||[]).some(i=>i.productId===+form.productId));
    return list;
  },[form?.customerId,form?.productId,sales]);

  const save=()=>{
    if(!form.productId||!form.customerId||!form.symptom)return;
    if(form.id){
      setDefectives(p=>p.map(d=>d.id===form.id?{...form,productId:+form.productId,customerId:+form.customerId}:d));
    }else{
      setDefectives(p=>[...p,{...form,id:Date.now(),productId:+form.productId,customerId:+form.customerId}]);
    }
    cM();setForm(null);
  };

  const del=id=>{setDefectives(p=>p.filter(d=>d.id!==id));cM();setForm(null);};

  const quickStatus=(id,newSt)=>{
    setDefectives(p=>p.map(d=>d.id===id?{...d,status:newSt}:d));
    setStatusDropId(null);
  };

  const FB={padding:"6px 14px",borderRadius:20,border:"1px solid var(--line)",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500,background:"transparent",color:"var(--text)"};
  const FBA=(active)=>({...FB,...(active?{background:"var(--text)",color:"var(--bg)",border:"1px solid var(--text)"}:{})});

  return <>
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <button onClick={()=>setFilter("all")} style={FBA(filter==="all")}>{"ทั้งหมด ("+counts.all+")"}</button>
      <span style={{fontSize:10,color:"var(--dim)",margin:"0 4px"}}>ซัพฯ:</span>
      {SUP_STATUSES.map(s=><button key={s.key} onClick={()=>setFilter(s.key)} style={FBA(filter===s.key)}>{s.label+" ("+(counts[s.key]||0)+")"}</button>)}
      <span style={{fontSize:10,color:"var(--dim)",margin:"0 4px"}}>ลูกค้า:</span>
      {CUST_STATUSES.map(s=><button key={s.key} onClick={()=>setFilter(s.key)} style={FBA(filter===s.key)}>{s.label+" ("+(counts[s.key]||0)+")"}</button>)}
      <div style={{flex:1}}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:200,fontSize:12}}/>
      {ed&&<button onClick={openAdd} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500}}>+ เพิ่มรายการ</button>}
    </div>

    <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,overflow:"visible"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg2)"}}>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>รหัส</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>สินค้า</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>ร้าน/ลูกค้า</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>SO</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>S/N</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>อาการ</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>วันที่</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>สถานะซัพฯ</th>
          <th style={{padding:"10px 16px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>สถานะลูกค้า</th>
          <th style={{padding:"10px 16px",textAlign:"right",fontWeight:500,color:"var(--dim)"}}></th>
        </tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={10} style={{padding:"2rem",textAlign:"center",color:"var(--dim)"}}>ไม่มีรายการ</td></tr>}
          {filtered.map(d=>{
            const pr=products.find(p=>p.id===d.productId);
            const cust=contacts.find(c=>c.id===d.customerId);
            return <tr key={d.id} style={{borderBottom:"1px solid var(--line)",cursor:"pointer"}} onClick={()=>openView(d)}>
              <td style={{padding:"10px 16px",color:"var(--blue)",fontWeight:500}}>{d.code}</td>
              <td style={{padding:"10px 16px"}}>{pr?pN(pr):"-"}</td>
              <td style={{padding:"10px 16px"}}>{cust?cN(cust):"-"}</td>
              <td style={{padding:"10px 16px",color:"var(--blue)"}}>{d.soNum||"—"}</td>
              <td style={{padding:"10px 16px",fontFamily:"monospace",fontSize:12}}>{d.serialNo||"—"}</td>
              <td style={{padding:"10px 16px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.symptom}</td>
              <td style={{padding:"10px 16px",color:"var(--dim)"}}>{toBE(d.date)}</td>
              <td style={{padding:"10px 16px",position:"relative"}}>{ed&&SUP_STATUSES.findIndex(x=>x.key===d.status)>=0&&d.status!==SUP_STATUSES[SUP_STATUSES.length-1].key?<span onClick={e=>{e.stopPropagation();setStatusDropId(statusDropId===d.id?null:d.id);}} style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:500,color:stColor(d.status),background:stBg(d.status),cursor:"pointer",userSelect:"none"}}>{stLabel(d.status)} ▾</span>:<span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:500,color:stColor(d.status),background:stBg(d.status)}}>{stLabel(d.status)}</span>}{statusDropId===d.id&&(()=>{const ci=SUP_STATUSES.findIndex(x=>x.key===d.status);const next=SUP_STATUSES.filter((_,i)=>i>ci);return next.length?<div style={{position:"absolute",top:"100%",left:16,zIndex:50,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",padding:4,minWidth:160}}>{next.map(s=><div key={s.key} onClick={e=>{e.stopPropagation();quickStatus(d.id,s.key);}} style={{padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><span style={{width:8,height:8,borderRadius:99,background:s.color,flexShrink:0}}/>{s.label}</div>)}</div>:null;})()}</td>
              <td style={{padding:"10px 16px"}}>{d.custStatus?<span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:500,color:stColor(d.custStatus),background:stBg(d.custStatus)}}>{stLabel(d.custStatus)}</span>:<span style={{fontSize:11,color:"var(--dim)"}}>—</span>}</td>
              <td style={{padding:"10px 16px",textAlign:"right"}}>{ed&&<button onClick={e=>{e.stopPropagation();openEdit(d);}} style={{fontSize:12,padding:"3px 12px",borderRadius:6,border:"1px solid var(--line)",background:"var(--bg2)",color:"var(--text)",cursor:"pointer",fontFamily:"inherit"}}>แก้ไข</button>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    {/* View detail modal */}
    {viewItem&&(()=>{
      const d=viewItem;
      const pr=products.find(p=>p.id===d.productId);
      const cust=contacts.find(c=>c.id===d.customerId);
      const cn=cnotes.find(c=>c.items&&c.items.some(it=>it.productId===d.productId)&&c.type==="defective"&&c.customerId===String(d.customerId));
      return <Modal title={"รายละเอียด "+d.code} onClose={closeView}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px",fontSize:13}}>
          <div><span style={{color:"var(--dim)"}}>สินค้า:</span> <b>{pr?pN(pr):"-"}</b></div>
          <div><span style={{color:"var(--dim)"}}>ร้าน/ลูกค้า:</span> <b>{cust?cN(cust):"-"}</b></div>
          <div><span style={{color:"var(--dim)"}}>SO:</span> <span style={{color:"var(--blue)"}}>{d.soNum||"—"}</span></div>
          <div><span style={{color:"var(--dim)"}}>Serial Number:</span> <span style={{fontFamily:"monospace"}}>{d.serialNo||"—"}</span></div>
          <div style={{gridColumn:"1/-1"}}><span style={{color:"var(--dim)"}}>อาการ/ปัญหา:</span><div style={{marginTop:4,padding:"8px 12px",background:"var(--bg2)",borderRadius:8,lineHeight:1.5}}>{d.symptom}</div></div>
          <div><span style={{color:"var(--dim)"}}>วันที่:</span> {toBE(d.date)}</div>
          <div><span style={{color:"var(--dim)"}}>สถานะซัพฯ:</span> <span style={{fontSize:12,padding:"2px 10px",borderRadius:99,fontWeight:500,color:stColor(d.status),background:stBg(d.status)}}>{stLabel(d.status)}</span></div>
          <div><span style={{color:"var(--dim)"}}>สถานะลูกค้า:</span> {d.custStatus?<span style={{fontSize:12,padding:"2px 10px",borderRadius:99,fontWeight:500,color:stColor(d.custStatus),background:stBg(d.custStatus)}}>{stLabel(d.custStatus)}</span>:<span style={{color:"var(--dim)"}}>—</span>}</div>
          {d.note&&<div style={{gridColumn:"1/-1"}}><span style={{color:"var(--dim)"}}>หมายเหตุ:</span> {d.note}</div>}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:10}}>
          {ed&&<button onClick={()=>{closeView();openEdit(d);}} style={{padding:"6px 13px",borderRadius:7,border:"1px solid var(--blue)",color:"var(--blue)",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>แก้ไข</button>}
          <button onClick={closeView} style={{padding:"6px 13px",borderRadius:7,border:"1px solid var(--line)",background:"var(--bg2)",color:"var(--text)",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>ปิด</button>
        </div>
      </Modal>;
    })()}

    {/* Add/Edit modal */}
    {modal==="defForm"&&form&&<Modal title={form.id?"แก้ไขรายการชำรุด":"เพิ่มรายการชำรุด"} onClose={()=>{cM();setForm(null);}} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
        <Field label="รหัส"><input value={form.code} readOnly style={{...IB,background:"var(--bg)",color:"var(--dim)"}}/></Field>
        <Field label="วันที่"><ThaiDateInput value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/></Field>

        <Field label="สินค้า">
          <CustomSelect searchable value={form.productId} onChange={v=>setForm(f=>({...f,productId:v,soNum:""}))} options={[{value:"",label:"— เลือกสินค้า —"},...products.map(p=>({value:String(p.id),label:pN(p),searchText:(p.code||"")+" "+(p.brand||"")}))]}/>
        </Field>
        <Field label="ร้าน / ลูกค้า">
          <CustomSelect searchable value={form.customerId} onChange={v=>setForm(f=>({...f,customerId:v,soNum:""}))} options={[{value:"",label:"— เลือกลูกค้า —"},...customers.map(c=>({value:String(c.id),label:cN(c)}))]}/>
        </Field>

        <Field label="อ้างอิง SO">
          <CustomSelect value={form.soNum} onChange={v=>setForm(f=>({...f,soNum:v}))} options={[{value:"",label:"— ไม่ระบุ —"},...custSOs.map(so=>({value:so.soNum,label:so.soNum}))]}/>
        </Field>
        <Field label="Serial Number"><input value={form.serialNo} onChange={e=>setForm(f=>({...f,serialNo:e.target.value}))} placeholder="เช่น SN-12345678" style={IB}/></Field>

        <div style={{gridColumn:"1/-1"}}>
          <Field label="อาการ / ปัญหา *"><textarea value={form.symptom} onChange={e=>setForm(f=>({...f,symptom:e.target.value}))} rows={3} placeholder="อธิบายอาการเสียหรือปัญหาที่พบ..." style={{...IB,resize:"vertical"}}/></Field>
        </div>

        <Field label="สถานะซัพพลายเออร์">
          <CustomSelect value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={SUP_STATUSES.map(s=>({value:s.key,label:s.label}))}/>
        </Field>
        <Field label="สถานะลูกค้า">
          <div style={{...IB,background:"var(--bg)",color:"var(--dim)",display:"flex",alignItems:"center",gap:8,padding:"7px 12px"}}>{form.custStatus?<span style={{fontSize:12,padding:"2px 10px",borderRadius:99,fontWeight:500,color:stColor(form.custStatus),background:stBg(form.custStatus)}}>{stLabel(form.custStatus)}</span>:<span>— (อัตโนมัติ)</span>}</div>
        </Field>
        <Field label="หมายเหตุ"><input value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="" style={IB}/></Field>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",marginTop:18}}>
        <div>{form.id&&cd&&<button onClick={()=>del(form.id)} style={{padding:"6px 13px",borderRadius:7,border:"1px solid var(--red)",color:"var(--red)",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>ลบ</button>}</div>
        <MBtns onCancel={()=>{cM();setForm(null);}} onSave={save} disabled={!form.productId||!form.customerId||!form.symptom}/>
      </div>
    </Modal>}
  </>;
}

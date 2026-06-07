import { useState, useEffect, useRef, useMemo } from "react";
import { IB } from "../../utils/constants.js";
import { fmt } from "../../utils/helpers.js";

export default function ProductPicker({value,onChange,products,pName,avail,unit,getAvail}){
  const[q,setQ]=useState("");const[open,setOpen]=useState(false);const ref=useRef(null);
  const sel=value?products.find(p=>p.id===+value):null;
  const fl=useMemo(()=>products.filter(p=>{if(!q)return true;const s=q.toLowerCase();return(pName(p)||"").toLowerCase().includes(s)||(p.brand||"").toLowerCase().includes(s)||(p.code||"").toLowerCase().includes(s);}).slice(0,30),[products,q,pName]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const dv=open?q:(sel?sel.brand+" — "+pName(sel):"");
  return <div ref={ref} style={{position:"relative"}}>
    <input value={dv} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>{setQ("");setOpen(true);}} placeholder="ค้นหาสินค้า (ชื่อ/ยี่ห้อ/รหัส)..." style={{...IB,background:sel?"var(--blue-bg)":"var(--bg2)"}}/>
    {sel&&!open&&<div style={{fontSize:11,color:"var(--dim)",marginTop:3,display:"flex",gap:8}}><span style={{color:"var(--faint)"}}>{sel.code}</span><span style={{color:avail===0?"var(--red)":"var(--green)",fontWeight:600}}>{"พร้อมขาย: "+avail+" "+unit}</span><span>{"฿"+fmt(sel.price)}</span></div>}
    {open&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--panel)",border:"1.5px solid var(--line2)",borderRadius:8,zIndex:200,maxHeight:240,overflowY:"auto",boxShadow:"0 6px 20px rgba(0,0,0,0.15)",marginTop:2}}>
      {q&&fl.length===0&&<div style={{padding:"12px 14px",color:"var(--dim)",fontSize:13}}>{"ไม่พบสินค้า"}</div>}
      {fl.map(pr=>{const av=getAvail?getAvail(pr.id):pr.stock;const isOut=av<=0;const isLow=pr.minStock>0&&av<=pr.minStock&&av>0;const isSel=value&&+value===pr.id;
        return <div key={pr.id} onClick={()=>{onChange(pr.id);setOpen(false);setQ("");}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:"0.5px solid var(--line)",background:isSel?"var(--blue-bg)":isOut?"rgba(255,59,48,0.06)":"var(--panel)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div><div style={{fontSize:13,fontWeight:isSel?600:500,color:isOut?"var(--red)":"var(--text)"}}>{pr.brand+" — "+pName(pr)}</div><div style={{fontSize:11,color:"var(--faint)",marginTop:1}}>{pr.code+(pr.size?" · "+pr.size:"")}</div></div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:12,fontWeight:600,color:isOut?"var(--red)":isLow?"var(--orange)":"var(--green)"}}>{isOut?"หมด":av}</div><div style={{fontSize:11,color:"var(--blue)",fontWeight:500}}>{"฿"+fmt(pr.price)}</div></div>
        </div>;
      })}
    </div>}
  </div>;
}

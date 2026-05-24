import { useState } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, fmtD } from "../../utils/helpers.js";
import { dlCSV } from "../../utils/csv.js";
import CustomSelect from "../ui/CustomSelect.jsx";

export default function PriceTab({priceHist,products,pN}){
  const[fP,setFP]=useState("");
  const fl=fP?priceHist.filter(p=>p.productId===+fP):priceHist;
  const exportCSV=()=>{
    const hdr=["วันที่","สินค้า","ช่อง","เดิม","ใหม่","เปลี่ยน","ผู้แก้"];
    const rows=fl.map(p=>{const pr=products.find(x=>x.id===p.productId);return[fmtD(p.date),pr?pr.brand+" — "+pN(pr):"-",p.field==="price"?"ราคาขาย":"ต้นทุน",p.oldVal,p.newVal,p.newVal-p.oldVal,p.user];});
    dlCSV("price-history.csv",[hdr,...rows]);
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <span style={{fontWeight:600,fontSize:14}}>{"ประวัติราคา"}</span>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <CustomSelect value={fP} onChange={v=>setFP(v)} options={[{value:"",label:"ทุกสินค้า"},...products.map(pr=>({value:String(pr.id),label:pr.brand+" — "+pN(pr)}))]} style={{width:"auto",minWidth:200}}/>
        {fl.length>0&&<button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid var(--line)",background:"var(--bg)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Export CSV</button>}
      </div>
    </div>
    {fl.length===0&&<div style={{textAlign:"center",color:"var(--dim)",padding:"2rem"}}>ยังไม่มี</div>}
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["วันที่","สินค้า","ช่อง","เดิม","ใหม่","เปลี่ยน","ผู้แก้"].map(h=><th key={h} style={{padding:"8px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead><tbody>{fl.slice(0,100).map(p=>{const pr=products.find(x=>x.id===p.productId);const d=p.newVal-p.oldVal;return <tr key={p.id} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"8px",color:"var(--dim)",fontSize:11}}>{fmtD(p.date)}</td><td style={{padding:"8px",fontWeight:500}}>{pr?pr.brand+" — "+pN(pr):"-"}</td><td style={{padding:"8px"}}>{p.field==="price"?"ราคาขาย":"ต้นทุน"}</td><td style={{padding:"8px"}}>{"฿"+fmt(p.oldVal)}</td><td style={{padding:"8px",fontWeight:600}}>{"฿"+fmt(p.newVal)}</td><td style={{padding:"8px",fontWeight:600,color:d>0?"var(--red)":"var(--green)"}}>{(d>0?"+":"")+"฿"+fmt(d)}</td><td style={{padding:"8px",color:"var(--dim)"}}>{p.user}</td></tr>;})}</tbody></table></div>
  </div>;
}

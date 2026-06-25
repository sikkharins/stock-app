import { useState } from "react";
import RepOverview from "./Overview.jsx";
import StockToSales from "./StockToSales.jsx";
import AuditTab from "./AuditLog.jsx";
import PriceTab from "./PriceHistory.jsx";
import CompareReport from "./Compare.jsx";
import TargetsReport from "./Targets.jsx";
import VATRepReport from "./VATRepReport.jsx";

const TABS=[["overview","ภาพรวม"],["stocksales","สต็อก/ขาย"],["compare","เปรียบเทียบ"],["targets","เป้า"],["vatreport","ตัวแทน VAT"],["audit","Audit"],["prices","ราคา"]];

export default function RepPage({sh}){
  const{products,sales,pos,pN,cN,quotes,targets,setTargets,audit,priceHist,users,contacts,canE,cats,logs}=sh;
  const[sub,setSub]=useState("overview");
  return<div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--line)",overflowX:"auto"}}>
      {TABS.map(v=><button key={v[0]} onClick={()=>setSub(v[0])} style={{padding:"10px 16px",fontSize:13,fontWeight:sub===v[0]?600:400,border:"none",borderBottom:sub===v[0]?"2px solid var(--text)":"2px solid transparent",marginBottom:"-2px",background:"transparent",cursor:"pointer",color:sub===v[0]?"var(--text)":"var(--dim)",whiteSpace:"nowrap"}}>{v[1]}</button>)}
    </div>
    {sub==="overview"&&<RepOverview products={products} sales={sales} pN={pN} cats={cats}/>}
    {sub==="stocksales"&&<StockToSales products={products} sales={sales} logs={logs} cats={cats}/>}
    {sub==="compare"&&<CompareReport products={products} sales={sales} cats={cats}/>}
    {sub==="targets"&&<TargetsReport targets={targets} setTargets={setTargets} sales={sales} contacts={contacts} users={users} canE={canE("reports")}/>}
    {sub==="vatreport"&&<VATRepReport sales={sales} contacts={contacts}/>}
    {sub==="audit"&&<AuditTab audit={audit} sales={sales} pos={pos} quotes={quotes} products={products} contacts={contacts} pN={pN} cN={cN}/>}
    {sub==="prices"&&<PriceTab priceHist={priceHist} products={products} pN={pN}/>}
  </div>;
}

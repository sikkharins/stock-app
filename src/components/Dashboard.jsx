import { useMemo, useState } from "react";
import StatCard from "./ui/StatCard.jsx";
import StockValueDonut from "./ui/StockValueDonut.jsx";
import SalesAreaChart from "./ui/SalesAreaChart.jsx";
import NeonGauge, { GAUGE_VARIANTS, useEased, useRev, colorAt, heatTier, heatCardStyle, HeatBadge } from "./ui/NeonGauge.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import DashboardSettingsModal from "./ui/DashboardSettingsModal.jsx";
import { fmt, toBE } from "../utils/helpers.js";
import { MOVE_TYPES, ALL_WIDGET_KEYS, DASH_SECTIONS, ALL_SECTION_KEYS } from "../utils/constants.js";
import { prevMonthKey, actualForMonth, yesterdayPct, projectETA } from "../utils/gaugeData.ts";

const PO_STATUS={
  pending:   {label:"รอรับของ", bg:"rgba(255,149,0,0.14)", color:"var(--orange)"},
  pending_approval:{label:"รออนุมัติ",bg:"rgba(255,149,0,0.14)",color:"var(--orange)"},
  received:  {label:"รับแล้ว",  bg:"rgba(52,199,89,0.12)", color:"var(--green)"},
  cancelled: {label:"ยกเลิก",  bg:"rgba(255,59,48,0.12)", color:"var(--red)"},
  approved:  {label:"อนุมัติ",  bg:"rgba(52,199,89,0.12)", color:"var(--green)"},
};
const SO_STATUS={
  pending:{label:"รอ",bg:"rgba(255,149,0,0.14)",color:"var(--orange)"},
  pending_delivery:{label:"รอส่ง",bg:"rgba(0,122,255,0.12)",color:"var(--blue)"},
  pending_special_approval:{label:"รออนุมัติพิเศษ",bg:"rgba(175,82,222,0.12)",color:"var(--purple)"},
  completed:{label:"เสร็จ",bg:"rgba(52,199,89,0.12)",color:"var(--green)"},
  cancelled:{label:"ยกเลิก",bg:"rgba(255,59,48,0.12)",color:"var(--red)"},
};

const IB=({text,color,bg})=><span style={{width:28,height:28,borderRadius:8,background:bg,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{text}</span>;

function StatusBadge({map,status}){
  const s=map[status]||{label:status,bg:"var(--hover)",color:"var(--dim)"};
  return<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:s.bg,color:s.color,fontWeight:500,whiteSpace:"nowrap"}}>{s.label}</span>;
}

export default function DashPage({sh}){
  const{pN,cN,products,lowStock,sales,pos,logs,contacts,targets,isSup,supN,cu,handleTab,defectives,cats,theme}=sh;
  const isSales=!!cu.salesName&&cu.role!=="SalesManager";
  // ก่อน refactor: top_products / recent_so / sales_target ถูกแสดงตลอดโดยไม่มี gate
  // → migrate user เดิมให้เห็น widget เหล่านี้เป็น default (admin สามารถปิดผ่าน Users form ได้)
  const NEW_DEFAULT_WIDGETS=["sales_target","top_products","recent_so"];
  const widgets=useMemo(()=>{
    const raw=cu.dashboardWidgets||ALL_WIDGET_KEYS;
    const set=new Set(raw);
    NEW_DEFAULT_WIDGETS.forEach(k=>set.add(k));
    return[...set];
  },[cu.dashboardWidgets]);
  const w=key=>widgets.includes(key);
  const[showSettings,setShowSettings]=useState(false);

  // section ที่ user เห็น (default = ทุกอันถ้ายังไม่เคยตั้ง) + จัดลำดับตาม dashboardOrder
  const sectionOrderList=cu.dashboardOrder||ALL_SECTION_KEYS;
  const orderIdx=useMemo(()=>{
    const m={};
    sectionOrderList.forEach((k,i)=>m[k]=i);
    ALL_SECTION_KEYS.forEach((k,i)=>{if(!(k in m))m[k]=1000+i;});
    return m;
  },[sectionOrderList]);
  const sectionAllowed=k=>{const s=DASH_SECTIONS.find(x=>x.key===k);return s?s.widgetKeys.some(wk=>w(wk)):false;};
  const sectionVisible=k=>{if(!sectionAllowed(k))return false;if(!cu.dashboardOrder)return true;return cu.dashboardOrder.includes(k);};
  // ใช้ helper function (ไม่ใช่ component) เพื่อหลีกเลี่ยง re-mount loop จาก identity ใหม่ทุก render
  const sec=(k,content)=>sectionVisible(k)?<div key={k} style={{order:orderIdx[k]??999,marginBottom:"1.5rem"}}>{content}</div>:null;

  const{myCI,myP,myLS,myS,myTS,mySales,profit}=useMemo(()=>{
    const ci=isSales?contacts.filter(c=>c.type==="customer"&&c.salesPerson===cu.salesName).map(c=>c.id):null;
    const mp=isSup?products.filter(p=>p.distributor===supN):products;
    const ls=isSup?mp.filter(p=>p.minStock>0&&p.stock<=p.minStock):lowStock;
    const ms=isSales?sales.filter(so=>ci.includes(so.customerId)):sales;
    const ts=mp.reduce((s,p)=>s+(p.stock||0)*(p.price||0),0);
    const sl=ms.reduce((s,so)=>s+so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0),0);
    const pr=ms.reduce((s,so)=>s+so.items.reduce((a,i)=>{const p=products.find(x=>x.id===i.productId);return a+i.qty*(i.price-(p?p.cost:0));},0),0);
    return{myCI:ci,myP:mp,myLS:ls,myS:ms,myTS:ts,mySales:sl,profit:pr};
  },[isSales,isSup,contacts,products,sales,lowStock,supN,cu.salesName]);

  const supContact=isSup?contacts.find(c=>c.type==="supplier"&&(c.name===supN||c.nameT===supN)):null;
  const recentPOs=[...pos]
    .filter(po=>!isSup||po.supplierId===supContact?.id)
    .sort((a,b)=>b.id-a.id)
    .slice(0,5);
  const{supNameMap,custNameMap}=useMemo(()=>{const sm={};contacts.filter(c=>c.type==="supplier").forEach(c=>sm[c.id]=c.nameT||c.name);const cm={};contacts.filter(c=>c.type==="customer").forEach(c=>cm[c.id]=c.nameT||c.name);return{supNameMap:sm,custNameMap:cm};},[contacts]);

  const supProdIds=isSup?new Set(myP.map(p=>p.id)):null;
  const recentLogs=(logs||[])
    .filter(l=>!isSup||supProdIds.has(l.productId))
    .slice(0,5);
  const prodNameMap=useMemo(()=>{const m={};products.forEach(p=>m[p.id]=pN(p));return m;},[products,pN]);

  const recentSOs=[...myS].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);

  const now=new Date();
  const today=now.toISOString().slice(0,10);
  const curMonth=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  const myTarget=isSales?targets.find(t=>t.salesName===cu.salesName&&t.month===curMonth):null;
  const actualMonth=isSales
    ?myS.filter(so=>(so.date||"").startsWith(curMonth)).reduce((s,so)=>s+so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0),0)
    :0;
  const targetPct=myTarget&&myTarget.target>0?Math.round(actualMonth/myTarget.target*100):0;

  // เกจรวม + per-เซลส์ (สำหรับ Admin/SalesManager) — รวมเป้าทุกเซลส์ vs รวมยอดจริง + breakdown ต่อคน
  const overall=useMemo(()=>{
    if(isSales||isSup)return null;
    const monthTs=targets.filter(t=>t.month===curMonth);
    if(!monthTs.length)return null;
    const custSp={};contacts.forEach(c=>{if(c.type==="customer"&&c.salesPerson)custSp[c.id]=c.salesPerson;});
    const monthSales=sales.filter(so=>(so.date||"").startsWith(curMonth));
    // ยอดจริงต่อเซลส์
    const actualBySp={};
    monthSales.forEach(so=>{
      const sp=custSp[so.customerId];
      if(!sp)return;
      const sub=so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0);
      actualBySp[sp]=(actualBySp[sp]||0)+sub;
    });
    const spSet=new Set(monthTs.map(t=>t.salesName));
    const totTarget=monthTs.reduce((s,t)=>s+(+t.target||0),0);
    const totActual=Object.entries(actualBySp).reduce((s,[sp,v])=>s+(spSet.has(sp)?v:0),0);
    const perSp=monthTs.map(t=>({salesName:t.salesName,target:+t.target||0,actual:actualBySp[t.salesName]||0}));
    return{totTarget,totActual,spCount:monthTs.length,perSp};
  },[isSales,isSup,targets,sales,contacts,curMonth]);

  const[gaugeVariant,setGaugeVariant]=useState("classic");
  const[selectedSp,setSelectedSp]=useState("__all__"); // "__all__" หรือ salesName

  // หา view ที่จะใช้ — sales user: ของตัวเอง / admin+manager: เลือก __all__ หรือเฉพาะคน
  const gaugeView=useMemo(()=>{
    if(isSales){
      return{actual:actualMonth,target:myTarget?.target||0,title:"เป้ายอดขายเดือนนี้",sub:"OF MONTHLY TARGET",who:cu.salesName||"ฉัน",missingTarget:!myTarget};
    }
    if(!overall)return null;
    if(selectedSp==="__all__"){
      return{actual:overall.totActual,target:overall.totTarget,title:"เป้ายอดขายรวม — "+overall.spCount+" เซลส์",sub:"OF TEAM TARGET",who:"ทั้งทีม",missingTarget:false};
    }
    const row=overall.perSp.find(p=>p.salesName===selectedSp);
    if(!row)return{actual:0,target:0,title:"เป้ายอดขายเดือนนี้",sub:"OF MONTHLY TARGET",who:selectedSp,missingTarget:true};
    return{actual:row.actual,target:row.target,title:"เป้ายอดขายเดือนนี้",sub:"OF MONTHLY TARGET",who:selectedSp,missingTarget:false};
  },[isSales,actualMonth,myTarget,overall,selectedSp,cu.salesName]);

  const gaugeRawPct=gaugeView&&gaugeView.target>0?gaugeView.actual/gaugeView.target*100:0;
  const{value:gaugeEased,holding:gaugeHolding,handlers:revHandlers}=useRev(gaugeRawPct);

  // 4 ลูกเล่นเสริมเกจ — sparkline / ghost / ETA / day-delta
  const gaugeExtras=useMemo(()=>{
    if(!gaugeView||gaugeView.target<=0)return null;
    const custSp={};contacts.forEach(c=>{if(c.type==="customer"&&c.salesPerson)custSp[c.id]=c.salesPerson;});
    // predicate: SO ที่ตรงกับ view ปัจจุบัน
    let pred;
    if(isSales){pred=(so)=>custSp[so.customerId]===cu.salesName;}
    else if(selectedSp==="__all__"){
      const spSet=new Set((overall?.perSp||[]).map(p=>p.salesName));
      pred=(so)=>{const s=custSp[so.customerId];return!!s&&spSet.has(s);};
    } else {pred=(so)=>custSp[so.customerId]===selectedSp;}

    // ETA
    const eta=projectETA(gaugeView.actual,gaugeView.target,curMonth,today);
    // % เมื่อวาน
    const ydayP=yesterdayPct(sales,pred,gaugeView.target,today);
    // ghost: % เดือนก่อน
    const prev=prevMonthKey(curMonth);
    let ghostVal=null;
    if(isSales||selectedSp!=="__all__"){
      const spName=isSales?cu.salesName:selectedSp;
      const prevT=targets.find(t=>t.salesName===spName&&t.month===prev);
      if(prevT&&prevT.target>0){
        const prevA=actualForMonth(sales,(so)=>custSp[so.customerId]===spName,prev);
        ghostVal=prevA/prevT.target*100;
      }
    } else {
      const prevTs=targets.filter(t=>t.month===prev);
      const totT=prevTs.reduce((s,t)=>s+(+t.target||0),0);
      if(totT>0){
        const prevSpSet=new Set(prevTs.map(t=>t.salesName));
        const prevA=actualForMonth(sales,(so)=>{const s=custSp[so.customerId];return!!s&&prevSpSet.has(s);},prev);
        ghostVal=prevA/totT*100;
      }
    }
    return{eta,ydayP,ghostVal};
  },[gaugeView,sales,targets,contacts,curMonth,today,isSales,selectedSp,overall,cu.salesName]);

  const pendingApprovalPO=pos.filter(po=>po.status==="pending_approval").length;
  const pendingDeliverySO=myS.filter(so=>so.status==="pending_delivery").length;
  const pendingSpecialSO=myS.filter(so=>so.status==="pending_special_approval").length;
  const defectiveCount=(defectives||[]).filter(d=>d.status==="pending").length;

  const todaySO=myS.filter(so=>(so.date||"").startsWith(today));
  const todaySales=todaySO.reduce((s,so)=>s+so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0),0);

  const topProducts=useMemo(()=>{const ts={};myS.forEach(so=>(so.items||[]).forEach(i=>{ts[i.productId]=(ts[i.productId]||0)+i.qty;}));return Object.entries(ts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,qty])=>({id:+id,name:prodNameMap[+id]||"-",qty}));},[myS,prodNameMap]);

  const hours=now.getHours();
  const greet=hours<12?"สวัสดีตอนเช้า":hours<17?"สวัสดีตอนบ่าย":"สวัสดีตอนเย็น";
  const thaiDay=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"][now.getDay()];
  const thaiMonth=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][now.getMonth()];
  const dateStr="วัน"+thaiDay+"ที่ "+now.getDate()+" "+thaiMonth+" "+(now.getFullYear()+543);

  const QAB=({text,label,count,color,bg,tab})=>count>0?<div onClick={()=>handleTab(tab)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderRadius:10,background:bg,border:"1px solid "+color,cursor:"pointer",minWidth:140}}>
    <span style={{width:32,height:32,borderRadius:8,background:color+"20",color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{text}</span>
    <div><div style={{fontSize:18,fontWeight:700,color}}>{count}</div><div style={{fontSize:11,color:"var(--dim)"}}>{label}</div></div>
  </div>:null;

  return<>
    <div style={{display:"flex",flexDirection:"column"}}>
    <div style={{order:-100,marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:20,fontWeight:700,color:"var(--text)"}}>{greet+", "+(cu.displayName||cu.username)}</div>
        <div style={{fontSize:13,color:"var(--dim)",marginTop:2}}>{dateStr}</div>
        {todaySO.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:6,padding:"5px 14px",borderRadius:8,background:"var(--blue-bg)",border:"1px solid rgba(0,122,255,0.2)"}}>
          <span style={{fontSize:12,color:"var(--blue)",fontWeight:600}}>{"วันนี้ "+todaySO.length+" รายการ"}</span>
          <span style={{fontSize:13,color:"var(--blue)",fontWeight:700}}>{"฿"+fmt(todaySales)}</span>
        </div>}
      </div>
      <button onClick={()=>setShowSettings(true)} title="ตั้งค่า Dashboard" style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--line)",background:"var(--panel)",color:"var(--dim)",cursor:"pointer",fontSize:14,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:15,lineHeight:1}}>⚙</span>
        <span style={{fontSize:12}}>ตั้งค่า</span>
      </button>
    </div>

    {isSup&&<div style={{order:-90,display:"flex",alignItems:"center",gap:10,background:"rgba(255,149,0,0.08)",border:"1px solid var(--orange)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"var(--orange)"}}>
      <IB text="S" color="var(--orange)" bg="rgba(255,149,0,0.14)"/>
      <span style={{fontWeight:600}}>{"Supplier: "+supN}</span>
    </div>}
    {isSales&&<div style={{order:-90,display:"flex",alignItems:"center",gap:10,background:"rgba(175,82,222,0.08)",border:"1px solid var(--purple)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"var(--purple)"}}>
      <IB text="S" color="var(--purple)" bg="rgba(175,82,222,0.12)"/>
      <span style={{fontWeight:600}}>{"เซลส์: "+cu.salesName+" — ดูแล "+(myCI?.length||0)+" ราย"}</span>
    </div>}

    {(pendingApprovalPO>0||pendingDeliverySO>0||pendingSpecialSO>0||defectiveCount>0)&&<div style={{order:-80,display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
      <QAB text="PO" label="PO รออนุมัติ" count={pendingApprovalPO} color="var(--orange)" bg="rgba(255,149,0,0.08)" tab="purchase"/>
      <QAB text="SO" label="SO รออนุมัติพิเศษ" count={pendingSpecialSO} color="var(--purple)" bg="rgba(175,82,222,0.08)" tab="sales"/>
      <QAB text="SO" label="SO รอส่ง" count={pendingDeliverySO} color="var(--blue)" bg="rgba(0,122,255,0.08)" tab="sales"/>
      <QAB text="!!" label="สินค้าชำรุด" count={defectiveCount} color="var(--red)" bg="rgba(255,59,48,0.08)" tab="defective"/>
    </div>}

    {sec("stats",
    (w("products")||w("sales_total")||w("profit"))&&
    <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14}}>
      {w("products")&&<StatCard label="สินค้า" value={myP.length} sub={myLS.length+" ต่ำกว่าขั้นต่ำ"} color="var(--blue)" accentBg="var(--blue-bg)"/>}
      {w("sales_total")&&<StatCard label="ยอดขายรวม" value={"฿"+fmt(mySales)} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>}
      {w("profit")&&<StatCard label="กำไร" value={"฿"+fmt(profit)} color={profit>=0?"var(--green)":"var(--red)"} accentBg={profit>=0?"rgba(52,199,89,0.12)":"rgba(255,59,48,0.12)"}/>}
    </div>
    )}

    {sec("stock_value",myTS>0&&<StockValueDonut products={myP} cats={cats} theme={theme}/>)}

    {sec("sales_chart",!isSup&&<SalesAreaChart sales={myS} pos={pos} theme={theme}/>)}

    {sec("low_stock",myLS.length>0&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
        <IB text="!" color="var(--orange)" bg="rgba(255,149,0,0.14)"/>
        <span>{"แจ้งเตือนสต็อกต่ำ ("+myLS.length+" รายการ)"}</span>
      </div>
      {myLS.map(p=>{const pct=p.minStock>0?Math.min(100,Math.round(p.stock/p.minStock*100)):0;return<div key={p.id} style={{padding:"8px 0",borderBottom:"0.5px solid var(--line)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:500}}>{p.brand+" — "+pN(p)}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:"var(--orange)",fontWeight:600}}>{p.stock+" / "+p.minStock+" "+p.unit}</span>
            <button onClick={()=>handleTab("purchase")} style={{fontSize:10,padding:"2px 8px",borderRadius:4,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>สั่งซื้อ</button>
          </div>
        </div>
        <div style={{background:"var(--hover)",borderRadius:3,height:4}}><div style={{background:pct<50?"var(--red)":"var(--orange)",borderRadius:3,height:4,width:pct+"%"}}/></div>
      </div>;})}
    </div>
    )}

    {sec("sales_target",gaugeView&&(()=>{
      const showPct=Math.round(gaugeRawPct);
      const hit=showPct>=100;
      const tier=heatTier(gaugeRawPct,50,75);
      const spOpts=overall?[{value:"__all__",label:"ทั้งทีม (รวม)"},...overall.perSp.map(p=>({value:p.salesName,label:p.salesName}))]:[];
      return<div style={{background:"linear-gradient(180deg,#0c1016 0%,#090c11 100%)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"16px 18px 8px",boxShadow:"var(--shadow)",position:"relative",overflow:"hidden",...heatCardStyle(tier)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:"#5ed0ff",boxShadow:"0 0 14px 3px #5ed0ff"}}/>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontSize:14,fontWeight:600,color:"#e7ecf2",letterSpacing:-0.2}}>{gaugeView.title}</div>
                <HeatBadge tier={tier}/>
              </div>
              <div style={{fontSize:11,color:"#8893a1",textTransform:"uppercase",letterSpacing:1.2,marginTop:2}}>{gaugeView.who} · เดือนนี้</div>
            </div>
          </div>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {!isSales&&spOpts.length>0&&<div style={{minWidth:150}}>
              <CustomSelect value={selectedSp} onChange={v=>setSelectedSp(v)} options={spOpts}/>
            </div>}
            {gaugeExtras&&Number.isFinite(gaugeExtras.ydayP)&&gaugeExtras.ydayP!==0&&<span title="ยอดเมื่อวาน คิดเป็น % ของเป้า" style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:600,padding:"5px 10px",borderRadius:99,border:"1px solid rgba(255,255,255,0.08)",background:gaugeExtras.ydayP>0?"rgba(86,240,162,0.08)":"rgba(255,99,146,0.08)",color:gaugeExtras.ydayP>0?"#6cf0a8":"#ff6392"}}>
              {gaugeExtras.ydayP>0?"↑":"↓"} {(gaugeExtras.ydayP>=0?"+":"")+gaugeExtras.ydayP.toFixed(1)+"%"}
              <span style={{fontWeight:400,opacity:0.7,marginLeft:2,fontSize:11}}>เมื่อวาน</span>
            </span>}
            <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:99,border:"1px solid rgba(255,255,255,0.08)",background:hit?"rgba(86,240,162,0.08)":"rgba(255,209,102,0.08)",color:hit?"#6cf0a8":"#ffd166"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:hit?"#6cf0a8":"#ffd166",boxShadow:"0 0 10px "+(hit?"#6cf0a8":"#ffd166")}}/>
              {gaugeView.missingTarget?"ยังไม่ได้ตั้งเป้า":(hit?"On / above goal":((100-showPct)+" pts to goal"))}
            </span>
            <div style={{display:"inline-flex",border:"1px solid rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden"}}>
              {GAUGE_VARIANTS.map(o=>(<button key={o.id} onClick={()=>setGaugeVariant(o.id)} style={{padding:"4px 10px",border:"none",background:gaugeVariant===o.id?"#e7ecf2":"transparent",color:gaugeVariant===o.id?"#0a0d12":"#8893a1",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:500}}>{o.label}</button>))}
            </div>
          </div>
        </div>
        {gaugeView.missingTarget
          ?<div style={{fontSize:13,color:"#8893a1",textAlign:"center",padding:"24px 0"}}>ยังไม่ได้ตั้งเป้าสำหรับ {gaugeView.who}</div>
          :<>
            <div {...revHandlers} title="กดค้างเพื่อเร่งคันเร่ง — ปล่อยจะกลับ 0%" style={{margin:"-8px -8px 4px",...revHandlers.style}}>
              <NeonGauge variant={gaugeVariant} uid={"dash-"+gaugeVariant+"-"+selectedSp} value={gaugeEased} target={100} glow={96} theme="reference" sublabel={gaugeView.sub} showTarget={false} ghostValue={gaugeExtras?.ghostVal} flames={true} heatT1={50} heatT2={75}/>
            </div>
            {gaugeExtras?.eta&&<div style={{padding:"0 4px 8px",textAlign:"right",fontSize:11.5,color:gaugeExtras.eta.kind==="hit"?"#6cf0a8":gaugeExtras.eta.kind==="miss"?"#ff6392":"#8893a1",textTransform:"uppercase",letterSpacing:1}}>
              {gaugeExtras.eta.text}
            </div>}
            <div style={{display:"flex",justifyContent:"space-between",gap:16,padding:"10px 4px 6px",borderTop:"1px solid rgba(255,255,255,0.06)",fontSize:13}}>
              <div>
                <div style={{fontSize:10.5,color:"#8893a1",textTransform:"uppercase",letterSpacing:1}}>ยอดจริง</div>
                <div style={{fontSize:20,fontWeight:700,color:colorAt("reference",Math.max(0,Math.min(1,gaugeRawPct/100))),fontVariantNumeric:"tabular-nums",textShadow:"0 0 18px "+colorAt("reference",Math.max(0,Math.min(1,gaugeRawPct/100)))}}>{"฿"+fmt(gaugeView.actual)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10.5,color:"#8893a1",textTransform:"uppercase",letterSpacing:1}}>เป้าหมาย</div>
                <div style={{fontSize:20,fontWeight:700,color:colorAt("reference",1),fontVariantNumeric:"tabular-nums",textShadow:"0 0 18px "+colorAt("reference",1)}}>{"฿"+fmt(gaugeView.target)}</div>
              </div>
            </div>
          </>}
      </div>;
    })()
    )}

    {sec("top_products",topProducts.length>0&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
        <IB text="#" color="var(--green)" bg="rgba(52,199,89,0.12)"/>
        <span>สินค้าขายดี Top 5</span>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {topProducts.map((tp,i)=>{const maxQty=topProducts[0]?.qty||1;const rc=i===0?"var(--green)":i===1?"var(--blue)":i===2?"var(--orange)":"var(--dim)";return<div key={tp.id} style={{flex:"1 1 0",minWidth:120,background:"var(--bg)",borderRadius:8,padding:"10px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{width:22,height:22,borderRadius:99,background:rc+"18",color:rc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{"#"+(i+1)}</span>
            <span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tp.name}</span>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"var(--text)",marginBottom:4}}>{tp.qty+" ชิ้น"}</div>
          <div style={{background:"var(--hover)",borderRadius:3,height:4}}><div style={{background:rc,borderRadius:3,height:4,width:Math.round(tp.qty/maxQty*100)+"%"}}/></div>
        </div>;})}
      </div>
    </div>
    )}

    {sec("recent_po",<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <IB text="PO" color="var(--blue)" bg="var(--blue-bg)"/>
        ใบสั่งซื้อล่าสุด
      </div>
      {recentPOs.length===0
        ?<div style={{fontSize:12,color:"var(--dim)",textAlign:"center",padding:"1rem 0"}}>ยังไม่มีข้อมูล</div>
        :recentPOs.map(po=>{const poTotal=(po.items||[]).reduce((s,i)=>s+i.qty*(i.cost||0),0);return<div key={po.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid var(--line)"}}>
          <div style={{minWidth:0,flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:500}}>{po.poNum}</span><span style={{fontSize:10,color:"var(--faint)"}}>{toBE(po.date)}</span></div>
            <div style={{fontSize:11,color:"var(--dim)",marginTop:1}}>{supNameMap[po.supplierId]||"-"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {poTotal>0&&<span style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{"฿"+fmt(poTotal)}</span>}
            <StatusBadge map={PO_STATUS} status={po.status}/>
          </div>
        </div>;})
      }
    </div>
    )}

    {sec("recent_so",<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <IB text="SO" color="var(--green)" bg="rgba(52,199,89,0.12)"/>
        การขายล่าสุด
      </div>
      {recentSOs.length===0
        ?<div style={{fontSize:12,color:"var(--dim)",textAlign:"center",padding:"1rem 0"}}>ยังไม่มีข้อมูล</div>
        :recentSOs.map(so=>{const soTotal=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);return<div key={so.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid var(--line)",gap:8}}>
          <div style={{minWidth:0,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:500}}>{so.soNum}</span><span style={{fontSize:10,color:"var(--faint)"}}>{toBE(so.date)}</span></div>
            <div style={{fontSize:11,color:"var(--dim)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{custNameMap[so.customerId]||"-"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <span style={{fontSize:12,fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(soTotal)}</span>
            <StatusBadge map={SO_STATUS} status={so.status}/>
          </div>
        </div>;})
      }
    </div>
    )}

    {sec("recent_log",<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <IB text="L" color="var(--dim)" bg="var(--hover)"/>
        <span>ประวัติสต็อกล่าสุด</span>
      </div>
      {recentLogs.length===0
        ?<div style={{fontSize:12,color:"var(--dim)",textAlign:"center",padding:"1rem 0"}}>ยังไม่มีข้อมูล</div>
        :recentLogs.map(l=>{
          const mt=MOVE_TYPES[l.type]||{label:l.type,color:"var(--dim)",bg:"var(--hover)"};
          const isIn=l.type==="in"||l.type==="adjust_in";
          return<div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid var(--line)",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
              <span style={{fontSize:11,padding:"2px 7px",borderRadius:4,background:mt.bg,color:mt.color,fontWeight:500,whiteSpace:"nowrap",flexShrink:0}}>{mt.label}</span>
              <span style={{fontSize:12,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prodNameMap[l.productId]||"-"}</span>
            </div>
            <span style={{fontSize:13,fontWeight:600,color:isIn?"var(--green)":"var(--red)",flexShrink:0}}>{(isIn?"+":"-")+l.qty}</span>
          </div>;
        })
      }
    </div>
    )}
    </div>
    {showSettings&&<DashboardSettingsModal sh={sh} onClose={()=>setShowSettings(false)}/>}
  </>;
}

import { useMemo } from "react";
import StatCard from "./ui/StatCard.jsx";
import { fmt, toBE } from "../utils/helpers.js";
import { MOVE_TYPES, ALL_WIDGET_KEYS } from "../utils/constants.js";

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
  const{pN,cN,products,lowStock,sales,pos,logs,contacts,targets,isSup,supN,cu,handleTab,defectives}=sh;
  const isSales=!!cu.salesName&&cu.role!=="SalesManager";
  const widgets=cu.dashboardWidgets||ALL_WIDGET_KEYS;
  const w=key=>widgets.includes(key);

  const{myCI,myP,myLS,myS,myTS,mySales,profit}=useMemo(()=>{
    const ci=isSales?contacts.filter(c=>c.type==="customer"&&c.salesPerson===cu.salesName).map(c=>c.id):null;
    const mp=isSup?products.filter(p=>p.distributor===supN):products;
    const ls=isSup?mp.filter(p=>p.minStock>0&&p.stock<=p.minStock):lowStock;
    const ms=isSales?sales.filter(so=>ci.includes(so.customerId)):sales;
    const ts=mp.reduce((s,p)=>s+p.stock*p.cost,0);
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

  return<div>
    <div style={{marginBottom:20}}>
      <div style={{fontSize:20,fontWeight:700,color:"var(--text)"}}>{greet+", "+(cu.displayName||cu.username)}</div>
      <div style={{fontSize:13,color:"var(--dim)",marginTop:2}}>{dateStr}</div>
      {todaySO.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:6,padding:"5px 14px",borderRadius:8,background:"var(--blue-bg)",border:"1px solid rgba(0,122,255,0.2)"}}>
        <span style={{fontSize:12,color:"var(--blue)",fontWeight:600}}>{"วันนี้ "+todaySO.length+" รายการ"}</span>
        <span style={{fontSize:13,color:"var(--blue)",fontWeight:700}}>{"฿"+fmt(todaySales)}</span>
      </div>}
    </div>

    {isSup&&<div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,149,0,0.08)",border:"1px solid var(--orange)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"var(--orange)"}}>
      <IB text="S" color="var(--orange)" bg="rgba(255,149,0,0.14)"/>
      <span style={{fontWeight:600}}>{"Supplier: "+supN}</span>
    </div>}
    {isSales&&<div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(175,82,222,0.08)",border:"1px solid var(--purple)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"var(--purple)"}}>
      <IB text="S" color="var(--purple)" bg="rgba(175,82,222,0.12)"/>
      <span style={{fontWeight:600}}>{"เซลส์: "+cu.salesName+" — ดูแล "+(myCI?.length||0)+" ราย"}</span>
    </div>}

    {(pendingApprovalPO>0||pendingDeliverySO>0||pendingSpecialSO>0||defectiveCount>0)&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
      <QAB text="PO" label="PO รออนุมัติ" count={pendingApprovalPO} color="var(--orange)" bg="rgba(255,149,0,0.08)" tab="purchase"/>
      <QAB text="SO" label="SO รออนุมัติพิเศษ" count={pendingSpecialSO} color="var(--purple)" bg="rgba(175,82,222,0.08)" tab="sales"/>
      <QAB text="SO" label="SO รอส่ง" count={pendingDeliverySO} color="var(--blue)" bg="rgba(0,122,255,0.08)" tab="sales"/>
      <QAB text="!!" label="สินค้าชำรุด" count={defectiveCount} color="var(--red)" bg="rgba(255,59,48,0.08)" tab="defective"/>
    </div>}

    {(w("products")||w("stock_value")||w("sales_total")||w("profit"))&&
    <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14,marginBottom:"1.5rem"}}>
      {w("products")&&<StatCard label="สินค้า" value={myP.length} sub={myLS.length+" ต่ำกว่าขั้นต่ำ"} color="var(--blue)" accentBg="var(--blue-bg)"/>}
      {w("stock_value")&&<StatCard label="มูลค่าสต็อก" value={"฿"+fmt(myTS)} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>}
      {w("sales_total")&&<StatCard label="ยอดขายรวม" value={"฿"+fmt(mySales)} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>}
      {w("profit")&&<StatCard label="กำไร" value={"฿"+fmt(profit)} color={profit>=0?"var(--green)":"var(--red)"} accentBg={profit>=0?"rgba(52,199,89,0.12)":"rgba(255,59,48,0.12)"}/>}
    </div>}

    {w("low_stock")&&myLS.length>0&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",marginBottom:"1.5rem",boxShadow:"var(--shadow)"}}>
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
    </div>}

    {isSales&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",marginBottom:"1.5rem",boxShadow:"var(--shadow)"}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        <IB text="T" color="var(--blue)" bg="var(--blue-bg)"/>
        <span>เป้ายอดขายเดือนนี้</span>
      </div>
      {myTarget
        ?<>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
            <span style={{color:"var(--dim)"}}>ยอดจริง</span>
            <span style={{fontWeight:600}}>{"฿"+fmt(actualMonth)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:10}}>
            <span style={{color:"var(--dim)"}}>เป้าหมาย</span>
            <span>{"฿"+fmt(myTarget.target)}</span>
          </div>
          <div style={{background:"var(--hover)",borderRadius:6,height:14,overflow:"hidden",marginBottom:6}}>
            <div style={{background:targetPct>=100?"var(--green)":"var(--blue)",height:14,width:Math.min(targetPct,100)+"%",borderRadius:6}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:15,color:targetPct>=100?"var(--green)":"var(--blue)"}}>{targetPct+"%"}</span>
            {targetPct>=100&&<span style={{fontSize:11,padding:"2px 10px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:600}}>ทำได้แล้ว!</span>}
          </div>
        </>
        :<div style={{fontSize:13,color:"var(--dim)",textAlign:"center",padding:"6px 0"}}>ยังไม่ได้ตั้งเป้าสำหรับเดือนนี้</div>
      }
    </div>}

    {topProducts.length>0&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",marginBottom:"1.5rem",boxShadow:"var(--shadow)"}}>
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
    </div>}

    <div className="dash-panels" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      {w("recent_po")&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
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
      </div>}

      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
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
    </div>

    {w("recent_log")&&<div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"1rem",boxShadow:"var(--shadow)"}}>
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
    </div>}
  </div>;
}

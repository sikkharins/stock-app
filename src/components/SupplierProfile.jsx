import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { fmt, toBE } from "../utils/helpers.js";
import Badge from "./ui/Badge.jsx";
import StatCard from "./ui/StatCard.jsx";

const PO_ST={
  pending_approval:{label:"รออนุมัติ",bg:"rgba(255,149,0,0.14)",color:"var(--orange)"},
  approved:{label:"อนุมัติ",bg:"rgba(52,199,89,0.12)",color:"var(--green)"},
  pending:{label:"รอรับของ",bg:"rgba(255,149,0,0.14)",color:"var(--orange)"},
  received:{label:"รับแล้ว",bg:"rgba(52,199,89,0.12)",color:"var(--green)"},
  cancelled:{label:"ยกเลิก",bg:"rgba(255,59,48,0.12)",color:"var(--red)"},
};
function POBadge({status}){const s=PO_ST[status]||{label:status,bg:"var(--hover)",color:"var(--dim)"};return<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:s.bg,color:s.color,fontWeight:500}}>{s.label}</span>;}

function getLast6Months(){
  const now=new Date();
  return Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1);return{key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:d.toLocaleDateString("th-TH",{month:"short"})};});
}

export default function SupplierProfile({supplier,pos,payments,products,pN,cN,onClose}){
  const[tab,setTab]=useState("po");
  const supPOs=[...pos].filter(po=>po.supplierId===supplier.id).reverse();
  const poTot=po=>(po.items||[]).reduce((s,i)=>s+i.qty*(i.cost||0),0);
  const getPaid=ref=>payments.filter(p=>p.refId===ref&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);

  const totalSpent=supPOs.reduce((s,po)=>s+poTot(po),0);
  const pendingPOs=supPOs.filter(po=>["pending","pending_approval","approved"].includes(po.status)).length;
  const receivedPOs=supPOs.filter(po=>po.status==="received");
  const outstanding=receivedPOs.reduce((s,po)=>s+Math.max(0,poTot(po)-getPaid(po.poNum)),0);

  const prodTotals={};
  supPOs.forEach(po=>(po.items||[]).forEach(i=>{
    if(!prodTotals[i.productId])prodTotals[i.productId]={qty:0,amount:0};
    prodTotals[i.productId].qty+=i.qty;
    prodTotals[i.productId].amount+=i.qty*(i.cost||0);
  }));
  const prodList=Object.entries(prodTotals).sort((a,b)=>b[1].qty-a[1].qty);
  const top5=prodList.slice(0,5).map(([pid,v])=>({prod:products.find(p=>p.id===+pid)||null,...v}));

  const months=getLast6Months();
  const monthTotals=months.map(m=>({...m,total:supPOs.filter(po=>(po.date||"").startsWith(m.key)).reduce((s,po)=>s+poTot(po),0)}));
  const maxTotal=Math.max(...monthTotals.map(m=>m.total),1);
  const lastPO=supPOs.reduce((mx,po)=>(!mx||po.date>mx)?po.date:mx,null);
  const avgPerPO=supPOs.length>0?totalSpent/supPOs.length:0;

  const thTd=(label,i)=><th key={i} style={{padding:"7px 8px",textAlign:"left",fontWeight:500,color:"var(--dim)",fontSize:12}}>{label}</th>;

  return<Modal title={`${cN(supplier)} — ประวัติซัพพลายเออร์`} onClose={onClose} wide>
    <div style={{background:"var(--bg)",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:18,fontWeight:700}}>{cN(supplier)}</div>
          {supplier.nameT&&supplier.name&&<div style={{fontSize:13,color:"var(--dim)",marginTop:1}}>{supplier.name}</div>}
        </div>
        <Badge status="supplier"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"4px 16px",fontSize:12,color:"var(--dim)"}}>
        {supplier.phone&&<div>{supplier.phone}</div>}
        {supplier.email&&<div>{supplier.email}</div>}
        {supplier.taxId&&<div>{"Tax ID: "+supplier.taxId}</div>}
        {supplier.address&&<div style={{gridColumn:"1/-1"}}>{supplier.address}</div>}
      </div>
      {(supplier.staff||[]).length>0&&<div style={{marginTop:10,background:"rgba(52,199,89,0.08)",border:"1px solid var(--green)",borderRadius:6,padding:"8px 10px",fontSize:12}}>
        <div style={{color:"var(--green)",fontWeight:600,marginBottom:6}}>{"Staff ("+supplier.staff.length+" คน)"}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {supplier.staff.map(s=><div key={s.id} style={{background:"var(--panel)",borderRadius:6,padding:"5px 9px",border:"1px solid var(--line)"}}>
            <div style={{fontWeight:500}}>{s.name}</div>
            <div style={{color:"var(--faint)",fontSize:11}}>{(s.roleTitle||"Staff")+" · @"+s.username}</div>
          </div>)}
        </div>
      </div>}
    </div>

    <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <StatCard label="ยอดซื้อสะสม" value={"฿"+fmt(totalSpent)} color="var(--blue)" accentBg="rgba(0,122,255,0.12)"/>
      <StatCard label="จำนวน PO" value={supPOs.length} />
      <StatCard label="PO รอดำเนินการ" value={pendingPOs} color={pendingPOs>0?"var(--orange)":"var(--green)"} accentBg={pendingPOs>0?"rgba(255,149,0,0.14)":"rgba(52,199,89,0.12)"}/>
      <StatCard label="ค้างชำระ" value={"฿"+fmt(outstanding)} color={outstanding>0?"var(--red)":"var(--green)"} accentBg={outstanding>0?"rgba(255,59,48,0.12)":"rgba(52,199,89,0.12)"}/>
    </div>

    <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"2px solid var(--line)"}}>
      {[["po","ใบสั่งซื้อ"],["products","สินค้าที่สั่ง"],["summary","สรุป"]].map(([k,label])=><button key={k} onClick={()=>setTab(k)} style={{padding:"8px 16px",fontSize:13,fontWeight:tab===k?600:400,border:"none",borderBottom:tab===k?"2px solid var(--text)":"2px solid transparent",marginBottom:"-2px",background:"transparent",cursor:"pointer",color:tab===k?"var(--text)":"var(--dim)",whiteSpace:"nowrap"}}>{label}</button>)}
    </div>

    {tab==="po"&&(supPOs.length===0
      ?<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem",fontSize:13}}>ยังไม่มีใบสั่งซื้อ</div>
      :<div style={{overflowX:"auto"}}>
        <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["PO No.","วันที่","สถานะ","มูลค่า","ชำระแล้ว","ค้าง"].map(thTd)}</tr></thead>
          <tbody>{supPOs.map(po=>{const tot=poTot(po);const paid=po.status==="received"?getPaid(po.poNum):0;const rem=po.status==="received"?tot-paid:0;
            return<tr key={po.id} style={{borderBottom:"0.5px solid var(--line)",background:rem>0?"rgba(255,149,0,0.06)":""}}>
              <td style={{padding:"7px 8px",fontWeight:500,color:"var(--blue)"}}>{po.poNum}</td>
              <td style={{padding:"7px 8px",color:"var(--dim)"}}>{toBE(po.date)}</td>
              <td style={{padding:"7px 8px"}}><POBadge status={po.status}/></td>
              <td style={{padding:"7px 8px",fontWeight:500}}>{"฿"+fmt(tot)}</td>
              <td style={{padding:"7px 8px",color:"var(--green)"}}>{po.status==="received"?"฿"+fmt(paid):"-"}</td>
              <td style={{padding:"7px 8px",fontWeight:600,color:rem>0?"var(--red)":"var(--green)"}}>{po.status==="received"?"฿"+fmt(Math.max(0,rem)):"-"}</td>
            </tr>;
          })}</tbody>
          <tfoot><tr style={{borderTop:"2px solid var(--line)",background:"var(--bg)"}}>
            <td colSpan={3} style={{padding:"7px 8px",fontWeight:600}}>รวมทั้งหมด</td>
            <td style={{padding:"7px 8px",fontWeight:700,color:"var(--blue)"}}>{"฿"+fmt(totalSpent)}</td>
            <td colSpan={2}/>
          </tr></tfoot>
        </table>
      </div>
    )}

    {tab==="products"&&(prodList.length===0
      ?<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem",fontSize:13}}>ยังไม่มีข้อมูลสินค้า</div>
      :<div style={{background:"var(--bg)",borderRadius:8,padding:"14px"}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>{"สินค้าที่สั่งซื้อทั้งหมด ("+prodList.length+" รายการ)"}</div>
        {prodList.map(([pid,v],i)=>{const prod=products.find(p=>p.id===+pid);
          return<div key={pid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"0.5px solid var(--line)"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
              <span style={{background:"var(--hover)",color:"var(--dim)",borderRadius:99,width:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
              <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod?pN(prod):"-"}</span>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:12,fontWeight:600}}>{v.qty+" ชิ้น"}</div>
              <div style={{fontSize:11,color:"var(--faint)"}}>{"฿"+fmt(Math.round(v.amount))}</div>
            </div>
          </div>;
        })}
      </div>
    )}

    {tab==="summary"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:"var(--bg)",borderRadius:8,padding:"12px 14px"}}>
          <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>PO ล่าสุด</div>
          <div style={{fontWeight:600,fontSize:14}}>{lastPO?toBE(lastPO):"-"}</div>
        </div>
        <div style={{background:"var(--bg)",borderRadius:8,padding:"12px 14px"}}>
          <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>ค่าเฉลี่ยต่อ PO</div>
          <div style={{fontWeight:600,fontSize:14,color:"var(--blue)"}}>{"฿"+fmt(Math.round(avgPerPO))}</div>
        </div>
      </div>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"14px",marginBottom:14}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>ยอดสั่งซื้อรายเดือน (6 เดือนล่าสุด)</div>
        <div style={{display:"flex",gap:6,alignItems:"flex-end",height:120}}>
          {monthTotals.map(m=><div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%",justifyContent:"flex-end"}}>
            {m.total>0&&<div style={{fontSize:9,color:"var(--dim)",textAlign:"center",whiteSpace:"nowrap"}}>{"฿"+fmt(m.total)}</div>}
            <div style={{width:"100%",background:m.total>0?"var(--blue)":"var(--hover)",borderRadius:"3px 3px 0 0",height:m.total>0?Math.max(4,Math.round(m.total/maxTotal*80))+"px":"4px"}}/>
            <div style={{fontSize:10,color:"var(--dim)",whiteSpace:"nowrap"}}>{m.label}</div>
          </div>)}
        </div>
      </div>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"14px"}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>สินค้าที่สั่งซื้อบ่อย Top 5</div>
        {top5.length===0
          ?<div style={{color:"var(--faint)",fontSize:12,textAlign:"center",padding:"8px 0"}}>ยังไม่มีข้อมูล</div>
          :top5.map((item,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"0.5px solid var(--line)"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
              <span style={{background:"var(--hover)",color:"var(--dim)",borderRadius:99,width:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
              <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.prod?pN(item.prod):"-"}</span>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:12,fontWeight:600}}>{item.qty+" ชิ้น"}</div>
              <div style={{fontSize:11,color:"var(--faint)"}}>{"฿"+fmt(Math.round(item.amount))}</div>
            </div>
          </div>)
        }
      </div>
    </div>}
  </Modal>;
}

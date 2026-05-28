import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { fmt, toBE, todayStr } from "../utils/helpers.js";
import Badge from "./ui/Badge.jsx";
import StatCard from "./ui/StatCard.jsx";

const QT_STATUS_LABEL = {draft:"ร่าง",sent:"ส่งแล้ว",approved:"อนุมัติ",converted:"แปลง SO",cancelled:"ยกเลิก",expired:"หมดอายุ"};
const isQTExpired = qt => !["converted","cancelled"].includes(qt.status) && !!qt.validUntil && qt.validUntil < todayStr();

function SOBadge({ status }) {
  const map = { pending_delivery:["var(--blue-bg)","var(--blue)","รอส่ง"], completed:["rgba(52,199,89,0.12)","var(--green)","สำเร็จ"], cancelled:["rgba(255,59,48,0.12)","var(--red)","ยกเลิก"] };
  const [bg,color,label] = map[status] || ["var(--hover)","var(--dim)",status];
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:bg,color,fontWeight:500}}>{label}</span>;
}

function QTBadge({ qt }) {
  const ds = isQTExpired(qt) ? "expired" : qt.status;
  const map = { draft:["var(--hover)","var(--dim)"],sent:["var(--blue-bg)","var(--blue)"],approved:["rgba(52,199,89,0.12)","var(--green)"],converted:["rgba(175,82,222,0.12)","var(--purple)"],cancelled:["rgba(255,59,48,0.12)","var(--red)"],expired:["rgba(255,149,0,0.14)","var(--orange)"] };
  const [bg,color] = map[ds] || ["var(--hover)","var(--dim)"];
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:bg,color,fontWeight:500}}>{QT_STATUS_LABEL[ds]||ds}</span>;
}

function PayBadge({ s }) {
  const map = { paid:["rgba(52,199,89,0.12)","var(--green)","ชำระแล้ว"], partial:["var(--blue-bg)","var(--blue)","บางส่วน"], unpaid:["rgba(255,149,0,0.14)","var(--orange)","รอชำระ"] };
  const [bg,color,label] = map[s] || ["var(--hover)","var(--dim)",s];
  return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:bg,color,fontWeight:500}}>{label}</span>;
}

function getLast6Months() {
  const now = new Date();
  return Array.from({length:6},(_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5-i), 1);
    return {
      key: d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),
      label: d.toLocaleDateString("th-TH",{month:"short"}),
    };
  });
}

export default function CustomerProfile({ customer, sales, quotes, payments, products, pN, onClose }) {
  const [tab, setTab] = useState("so");

  const custSales  = [...sales].filter(so => so.customerId === customer.id).reverse();
  const custQuotes = [...quotes].filter(qt => qt.customerId === customer.id).reverse();
  const soNet  = so => (so.items||[]).reduce((s,i) => s + i.qty*i.price, 0) - (so.discountAmt||0);
  const getPaid = ref => payments.filter(p => p.refId===ref && p.type==="ar").reduce((s,p) => s + (+p.amount||0), 0);

  // Stat card values
  const totalRevenue = custSales.reduce((s,so) => s + soNet(so), 0);
  const completedSOs = custSales.filter(so => so.status === "completed");
  const outstanding  = completedSOs.reduce((s,so) => s + Math.max(0, soNet(so) - getPaid(so.soNum)), 0);

  // AR list for payment tab
  const arList = completedSOs.map(so => {
    const total = soNet(so);
    const paid  = getPaid(so.soNum);
    const rem   = total - paid;
    const status2 = paid===0 ? "unpaid" : rem<=0 ? "paid" : "partial";
    let dueDate = null; let overdueDays = 0;
    if (so.payType==="credit" && so.creditDays) {
      const due = new Date(so.date);
      due.setDate(due.getDate() + so.creditDays);
      dueDate = due.toISOString().split("T")[0];
      overdueDays = Math.max(0, Math.floor((Date.now()-due.getTime())/864e5));
    }
    return {...so, total, paid, remaining:rem, status2, dueDate, overdueDays};
  });

  // Summary tab
  const months = getLast6Months();
  const monthTotals = months.map(m => ({
    ...m,
    total: custSales.filter(so => (so.date||"").startsWith(m.key)).reduce((s,so) => s + soNet(so), 0),
  }));
  const maxTotal = Math.max(...monthTotals.map(m => m.total), 1);

  const prodTotals = {};
  custSales.forEach(so => (so.items||[]).forEach(i => {
    if (!prodTotals[i.productId]) prodTotals[i.productId] = {qty:0, amount:0};
    prodTotals[i.productId].qty    += i.qty;
    prodTotals[i.productId].amount += i.qty * i.price;
  }));
  const top5 = Object.entries(prodTotals)
    .sort((a,b) => b[1].qty - a[1].qty)
    .slice(0, 5)
    .map(([pid,v]) => ({prod: products.find(p => p.id===+pid)||null, ...v}));

  const lastPurchase = custSales.reduce((mx,so) => (!mx||so.date>mx)?so.date:mx, null);
  const avgPerSO = custSales.length>0 ? totalRevenue/custSales.length : 0;

  const thTd = (label,i) => <th key={i} style={{padding:"7px 8px",textAlign:"left",fontWeight:500,color:"var(--dim)",fontSize:12}}>{label}</th>;

  return (
    <Modal title={`${customer.nameT||customer.name} — ประวัติลูกค้า`} onClose={onClose} wide>

      {/* Header info */}
      <div style={{background:"var(--bg)",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
          <div>
            <div style={{fontSize:18,fontWeight:700}}>{customer.nameT||customer.name}</div>
            {customer.nameT&&customer.name&&<div style={{fontSize:13,color:"var(--dim)",marginTop:1}}>{customer.name}</div>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Badge status="customer"/>
            {customer.salesPerson&&<span style={{background:"rgba(175,82,222,0.12)",color:"var(--purple)",borderRadius:99,padding:"3px 10px",fontSize:12,fontWeight:500}}>{customer.salesPerson}</span>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"4px 16px",fontSize:12,color:"var(--dim)"}}>
          {customer.phone&&<div>{customer.phone}</div>}
          {customer.email&&<div>{customer.email}</div>}
          {customer.taxId&&<div>{"Tax ID: "+customer.taxId}</div>}
          {customer.address&&<div style={{gridColumn:"1/-1"}}>{customer.address}</div>}
        </div>
        {(customer.vatReps||[]).length>0&&(
          <div style={{marginTop:10,background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:6,padding:"8px 10px",fontSize:12}}>
            <div style={{color:"var(--blue)",fontWeight:600,marginBottom:6}}>{"ตัวแทน VAT ("+(customer.vatReps.length)+" คน)"}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {customer.vatReps.map(r=><div key={r.id} style={{background:"var(--panel)",borderRadius:6,padding:"5px 9px",border:"1px solid var(--line)"}}>
                <div style={{fontWeight:500}}>{r.name}</div>
                <div style={{color:"var(--faint)",fontSize:11}}>{r.idCard}</div>
              </div>)}
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <StatCard label="ยอดซื้อสะสม"    value={"฿"+fmt(totalRevenue)} color="var(--green)"/>
        <StatCard label="จำนวนใบขาย"     value={custSales.length}/>
        <StatCard label="ค้างชำระ"        value={"฿"+fmt(outstanding)} color={outstanding>0?"var(--red)":"var(--green)"}/>
        <StatCard label="ใบเสนอราคา"     value={custQuotes.length}/>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"2px solid var(--line)"}}>
        {[["so","ใบขาย"],["qt","ใบเสนอราคา"],["pay","การชำระเงิน"],["summary","สรุป"]].map(([k,label])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"8px 16px",fontSize:13,fontWeight:tab===k?600:400,border:"none",borderBottom:tab===k?"2px solid var(--text)":"2px solid transparent",marginBottom:"-2px",background:"transparent",cursor:"pointer",color:tab===k?"var(--text)":"var(--dim)",whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: ใบขาย */}
      {tab==="so"&&(
        custSales.length===0
          ?<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem",fontSize:13}}>ยังไม่มีใบขาย</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["SO No.","วันที่","สถานะ","การชำระ","ยอด","ตัวแทน VAT"].map(thTd)}</tr></thead>
              <tbody>{custSales.map(so=>{
                const net=soNet(so);
                const ost=so.status==="completed"?Math.max(0,net-getPaid(so.soNum)):0;
                return <tr key={so.id} style={{borderBottom:"0.5px solid var(--line)",background:ost>0?"rgba(255,149,0,0.14)":""}}>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{so.soNum}</td>
                  <td style={{padding:"7px 8px",color:"var(--dim)"}}>{toBE(so.date)}</td>
                  <td style={{padding:"7px 8px"}}><SOBadge status={so.status}/></td>
                  <td style={{padding:"7px 8px",color:"var(--dim)",fontSize:12}}>{so.payType==="cash"?"เงินสด":"เครดิต "+(so.creditDays||0)+" วัน"}</td>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{"฿"+fmt(net)}</td>
                  <td style={{padding:"7px 8px"}}>{so.vatRepName?<span style={{fontSize:11,background:"var(--blue-bg)",color:"var(--blue)",borderRadius:4,padding:"2px 8px"}}>{so.vatRepName}</span>:<span style={{color:"var(--faint)"}}>—</span>}</td>
                </tr>;
              })}</tbody>
              <tfoot><tr style={{borderTop:"2px solid var(--line)",background:"var(--bg)"}}>
                <td colSpan={4} style={{padding:"7px 8px",fontWeight:600,fontSize:13}}>รวมทั้งหมด</td>
                <td style={{padding:"7px 8px",fontWeight:700,fontSize:14,color:"var(--green)"}}>{"฿"+fmt(totalRevenue)}</td>
                <td/>
              </tr></tfoot>
            </table>
          </div>
      )}

      {/* Tab: ใบเสนอราคา */}
      {tab==="qt"&&(
        custQuotes.length===0
          ?<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem",fontSize:13}}>ยังไม่มีใบเสนอราคา</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["QT No.","วันที่","วันหมดอายุ","สถานะ","ยอด"].map(thTd)}</tr></thead>
              <tbody>{custQuotes.map(qt=>{
                const exp=isQTExpired(qt);
                const tot=(qt.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
                return <tr key={qt.id} style={{borderBottom:"0.5px solid var(--line)",background:exp?"rgba(255,149,0,0.14)":""}}>
                  <td style={{padding:"7px 8px",fontWeight:500,color:"var(--blue)"}}>{qt.qtNum}</td>
                  <td style={{padding:"7px 8px",color:"var(--dim)"}}>{toBE(qt.date)}</td>
                  <td style={{padding:"7px 8px",color:exp?"var(--orange)":"var(--dim)"}}>{toBE(qt.validUntil)}</td>
                  <td style={{padding:"7px 8px"}}><QTBadge qt={qt}/></td>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{"฿"+fmt(tot)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
      )}

      {/* Tab: การชำระเงิน */}
      {tab==="pay"&&(
        arList.length===0
          ?<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem",fontSize:13}}>ยังไม่มีใบขายที่สำเร็จ</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["SO No.","วันที่","ยอดเต็ม","ชำระแล้ว","ค้าง","สถานะ","ครบกำหนด"].map(thTd)}</tr></thead>
              <tbody>{arList.map(ar=>(
                <tr key={ar.id} style={{borderBottom:"0.5px solid var(--line)",background:ar.overdueDays>0&&ar.status2!=="paid"?"rgba(255,149,0,0.14)":""}}>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{ar.soNum}</td>
                  <td style={{padding:"7px 8px",color:"var(--dim)"}}>{toBE(ar.date)}</td>
                  <td style={{padding:"7px 8px"}}>{"฿"+fmt(ar.total)}</td>
                  <td style={{padding:"7px 8px",color:"var(--green)"}}>{"฿"+fmt(ar.paid)}</td>
                  <td style={{padding:"7px 8px",fontWeight:600,color:ar.remaining>0?"var(--red)":"var(--green)"}}>{"฿"+fmt(Math.max(0,ar.remaining))}</td>
                  <td style={{padding:"7px 8px"}}><PayBadge s={ar.status2}/></td>
                  <td style={{padding:"7px 8px",fontSize:12}}>
                    {ar.dueDate
                      ?<span style={{color:ar.overdueDays>0&&ar.status2!=="paid"?"var(--red)":"var(--dim)"}}>
                          {toBE(ar.dueDate)}{ar.overdueDays>0&&ar.status2!=="paid"?` (เกิน ${ar.overdueDays} วัน)`:""}
                        </span>
                      :<span style={{color:"var(--faint)"}}>—</span>
                    }
                  </td>
                </tr>
              ))}</tbody>
              <tfoot><tr style={{borderTop:"2px solid var(--line)",background:"var(--bg)"}}>
                <td colSpan={3} style={{padding:"7px 8px",fontWeight:600}}>รวม</td>
                <td style={{padding:"7px 8px",color:"var(--green)",fontWeight:700}}>{"฿"+fmt(arList.reduce((s,a)=>s+a.paid,0))}</td>
                <td style={{padding:"7px 8px",color:outstanding>0?"var(--red)":"var(--green)",fontWeight:700}}>{"฿"+fmt(arList.reduce((s,a)=>s+Math.max(0,a.remaining),0))}</td>
                <td colSpan={2}/>
              </tr></tfoot>
            </table>
          </div>
      )}

      {/* Tab: สรุป */}
      {tab==="summary"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"var(--bg)",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>วันที่ซื้อล่าสุด</div>
              <div style={{fontWeight:600,fontSize:14}}>{lastPurchase?toBE(lastPurchase):"-"}</div>
            </div>
            <div style={{background:"var(--bg)",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>ค่าเฉลี่ยต่อใบขาย</div>
              <div style={{fontWeight:600,fontSize:14,color:"var(--green)"}}>{"฿"+fmt(Math.round(avgPerSO))}</div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{background:"var(--bg)",borderRadius:8,padding:"14px",marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>ยอดซื้อรายเดือน (6 เดือนล่าสุด)</div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",height:120}}>
              {monthTotals.map(m=>(
                <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%",justifyContent:"flex-end"}}>
                  {m.total>0&&<div style={{fontSize:9,color:"var(--dim)",textAlign:"center",whiteSpace:"nowrap"}}>{"฿"+fmt(m.total)}</div>}
                  <div style={{width:"100%",background:m.total>0?"var(--blue)":"var(--hover)",borderRadius:"3px 3px 0 0",height:m.total>0?Math.max(4,Math.round(m.total/maxTotal*80))+"px":"4px"}}/>
                  <div style={{fontSize:10,color:"var(--dim)",whiteSpace:"nowrap"}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 products */}
          <div style={{background:"var(--bg)",borderRadius:8,padding:"14px"}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>สินค้าที่ซื้อบ่อย Top 5</div>
            {top5.length===0
              ?<div style={{color:"var(--faint)",fontSize:12,textAlign:"center",padding:"8px 0"}}>ยังไม่มีข้อมูล</div>
              :top5.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"0.5px solid var(--line)"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
                    <span style={{background:"var(--hover)",color:"var(--dim)",borderRadius:99,width:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
                    <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.prod?pN(item.prod):"-"}</span>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:600}}>{item.qty+" ชิ้น"}</div>
                    <div style={{fontSize:11,color:"var(--faint)"}}>{"฿"+fmt(Math.round(item.amount))}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

    </Modal>
  );
}

import { useState, useEffect } from "react";
import { Modal, MBtns } from "./ui/Modal.jsx";
import { fmt, toBE, todayStr } from "../utils/helpers.js";
import Badge from "./ui/Badge.jsx";
import StatCard from "./ui/StatCard.jsx";
import SlideOver from "./ui/SlideOver.tsx";
import { useMediaQuery } from "../utils/useMediaQuery.ts";

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

export default function CustomerProfile({ customer, sales, quotes, payments, products, pN, promos = [], setContacts, canEdit = true, onClose }) {
  const [tab, setTab] = useState("so");
  const [confirmAct, setConfirmAct] = useState(null); // {title, msg, onOk}

  const isDesktop = useMediaQuery("(min-width: 900px)");

  // Mobile back-button: SlideOver path registers internally on its own; Modal
  // path needs the same hook so mobile back closes the panel instead of
  // falling through to setTab("dashboard"). Stack pattern: SlideOver, if
  // mounted, will push over us and restore on unmount.
  useEffect(() => {
    const prev = window.__slideoverClose;
    window.__slideoverClose = onClose;
    return () => {
      window.__slideoverClose = prev;
    };
  }, [onClose]);

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

  const titleNode = `${customer.nameT||customer.name} — ประวัติลูกค้า`;
  const body = (
    <>

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
          <details style={{marginTop:10}}>
            <summary style={{cursor:"pointer",color:"var(--blue)",fontWeight:600,fontSize:12,background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:6,padding:"6px 10px",listStyle:"none"}}>
              VAT {customer.vatReps.length} คน — ดูรายชื่อ ▾
            </summary>
            <div style={{marginTop:6,background:"var(--blue-bg)",border:"1px solid var(--blue)",borderRadius:6,padding:"8px 10px",fontSize:12}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {customer.vatReps.map(r=><div key={r.id} style={{background:"var(--panel)",borderRadius:6,padding:"5px 9px",border:"1px solid var(--line)"}}>
                  <div style={{fontWeight:500}}>{r.name}</div>
                  <div style={{color:"var(--faint)",fontSize:11}}>{r.idCard}</div>
                </div>)}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Stat cards — 2x2 grid for SlideOver fit; auto-flows wider on Modal mobile-full */}
      <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
        <StatCard label="ซื้อรวม" value={"฿"+fmt(totalRevenue)} color="var(--text)"/>
        <StatCard label="รอเก็บ" value={"฿"+fmt(outstanding)} color={outstanding>0?"var(--orange)":"var(--green)"} accentBg={outstanding>0?"rgba(255,149,0,0.14)":"rgba(52,199,89,0.12)"}/>
        <StatCard label="เฉลี่ย/ใบ" value={"฿"+fmt(Math.round(avgPerSO))} sub={custSales.length+" orders"}/>
        <StatCard label="ซื้อล่าสุด" value={lastPurchase?toBE(lastPurchase):"—"} sub={lastPurchase?"":"ยังไม่มีคำสั่งซื้อ"}/>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"2px solid var(--line)",flexWrap:"wrap"}}>
        {[["so","ใบขาย"],["qt","ใบเสนอราคา"],["pay","การชำระเงิน"],["wallet","รางวัล"+((customer.savedRewards||[]).length>0?" ("+(customer.savedRewards).length+")":"")],["summary","สรุป"]].map(([k,label])=>(
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
              <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["SO No.","วันที่","สถานะ","ยอด"].map(thTd)}</tr></thead>
              <tbody>{custSales.map(so=>{
                const net=soNet(so);
                const ost=so.status==="completed"?Math.max(0,net-getPaid(so.soNum)):0;
                return <tr key={so.id} style={{borderBottom:"0.5px solid var(--line)",background:ost>0?"rgba(255,149,0,0.14)":""}}>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{so.soNum}</td>
                  <td style={{padding:"7px 8px",color:"var(--dim)"}}>{toBE(so.date)}</td>
                  <td style={{padding:"7px 8px"}}><SOBadge status={so.status}/></td>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{"฿"+fmt(net)}</td>
                </tr>;
              })}</tbody>
              <tfoot><tr style={{borderTop:"2px solid var(--line)",background:"var(--bg)"}}>
                <td colSpan={3} style={{padding:"7px 8px",fontWeight:600,fontSize:13}}>รวมทั้งหมด</td>
                <td style={{padding:"7px 8px",fontWeight:700,fontSize:14,color:"var(--green)"}}>{"฿"+fmt(totalRevenue)}</td>
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
              <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{["SO No.","ครบกำหนด","ยอดคงเหลือ","สถานะ"].map(thTd)}</tr></thead>
              <tbody>{arList.map(ar=>(
                <tr key={ar.id} style={{borderBottom:"0.5px solid var(--line)",background:ar.overdueDays>0&&ar.status2!=="paid"?"rgba(255,149,0,0.14)":""}}>
                  <td style={{padding:"7px 8px",fontWeight:500}}>{ar.soNum}</td>
                  <td style={{padding:"7px 8px",fontSize:12}}>
                    {ar.dueDate
                      ?<span style={{color:ar.overdueDays>0&&ar.status2!=="paid"?"var(--red)":"var(--dim)"}}>
                          {toBE(ar.dueDate)}{ar.overdueDays>0&&ar.status2!=="paid"?` (เกิน ${ar.overdueDays} วัน)`:""}
                        </span>
                      :<span style={{color:"var(--faint)"}}>—</span>
                    }
                  </td>
                  <td style={{padding:"7px 8px",fontWeight:600,color:ar.remaining>0?"var(--red)":"var(--green)"}}>{"฿"+fmt(Math.max(0,ar.remaining))}</td>
                  <td style={{padding:"7px 8px"}}><PayBadge s={ar.status2}/></td>
                </tr>
              ))}</tbody>
              <tfoot><tr style={{borderTop:"2px solid var(--line)",background:"var(--bg)"}}>
                <td colSpan={2} style={{padding:"7px 8px",fontWeight:600}}>รวม</td>
                <td style={{padding:"7px 8px",color:outstanding>0?"var(--red)":"var(--green)",fontWeight:700}}>{"฿"+fmt(arList.reduce((s,a)=>s+Math.max(0,a.remaining),0))}</td>
                <td/>
              </tr></tfoot>
            </table>
          </div>
      )}

      {/* Tab: รางวัล (wallet + claim history) */}
      {tab==="wallet"&&(()=>{
        const wallet=customer.savedRewards||[];
        const claims=customer.promoClaims||{};
        const canMutate=canEdit&&typeof setContacts==="function";
        const rewardLbl=(t)=>{
          if(!t)return"-";
          if(t.rewardType==="percent")return"ลด "+t.rewardValue+"%";
          if(t.rewardType==="fixed")return"ลด ฿"+fmt(t.rewardValue);
          if(t.rewardType==="product"){const rp=products.find(x=>x.id===+t.rewardProductId);return"แถม "+(rp?pN(rp):"สินค้า");}
          return"-";
        };
        const _doDeleteWallet=(walletId)=>{
          setContacts(prev=>prev.map(c=>c.id===customer.id?{...c,savedRewards:(c.savedRewards||[]).filter(r=>r.id!==walletId)}:c));
        };
        const _doDeleteClaimTier=(promoId,tierId)=>{
          setContacts(prev=>prev.map(c=>{
            if(c.id!==customer.id)return c;
            const newClaims={...(c.promoClaims||{})};
            const info=newClaims[promoId];
            if(!info)return c;
            const newIds=(info.claimedTierIds||[]).filter(id=>id!==tierId);
            if(newIds.length===0)delete newClaims[promoId];
            else newClaims[promoId]={...info,claimedTierIds:newIds};
            return{...c,promoClaims:newClaims};
          }));
        };
        const _doDeleteClaimEntry=(promoId)=>{
          setContacts(prev=>prev.map(c=>{
            if(c.id!==customer.id)return c;
            const newClaims={...(c.promoClaims||{})};
            delete newClaims[promoId];
            return{...c,promoClaims:newClaims};
          }));
        };
        const deleteWallet=(w)=>{
          if(!canMutate)return;
          setConfirmAct({title:"ลบรางวัลออกจาก wallet",msg:"ต้องการลบรางวัลนี้ใช่หรือไม่?",detail:w.promoName+" — "+rewardLbl(w.tier),onOk:()=>_doDeleteWallet(w.id)});
        };
        const deleteClaimTier=(promoId,tierId,promoName,tier)=>{
          if(!canMutate)return;
          setConfirmAct({title:"ลบ tier ออกจากประวัติเคลม",msg:"ต้องการลบ tier นี้ใช่หรือไม่? ลูกค้าจะสามารถเคลม tier นี้ใหม่ได้",detail:promoName+" — "+(tier?rewardLbl(tier):"tier #"+tierId+" (ถูกลบ)"),onOk:()=>_doDeleteClaimTier(promoId,tierId)});
        };
        const deleteClaimEntry=(promoId,promoName)=>{
          if(!canMutate)return;
          setConfirmAct({title:"ลบประวัติเคลมทั้งหมด",msg:"ต้องการลบประวัติการเคลมโปรนี้ทั้งหมดใช่หรือไม่?",detail:promoName,onOk:()=>_doDeleteClaimEntry(promoId)});
        };
        const claimEntries=Object.entries(claims).map(([promoId,info])=>{
          const promo=promos.find(p=>p.id===+promoId);
          const tierDetails=(info.claimedTierIds||[]).map(tid=>{
            const t=(promo?.tiers||[]).find(x=>x.id===tid);
            return t?{tier:t,id:tid}:{tier:null,id:tid};
          });
          return{promoId:+promoId,promoName:promo?promo.name:"(โปรถูกลบแล้ว)",info,tierDetails};
        }).filter(e=>e.tierDetails.length>0);

        return <div>
          {/* Wallet section */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:"var(--purple)",display:"flex",alignItems:"center",gap:8}}>
              <span>รางวัลที่ยังไม่ได้ใช้ ({wallet.length})</span>
              <span style={{fontSize:11,color:"var(--dim)",fontWeight:400}}>ใช้ตอนสร้าง SO ใบใหม่ได้</span>
            </div>
            {wallet.length===0
              ?<div style={{textAlign:"center",color:"var(--faint)",padding:"1.5rem",fontSize:13,background:"var(--bg)",borderRadius:8}}>ยังไม่มีรางวัลที่เก็บไว้</div>
              :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                {wallet.map(w=><div key={w.id} style={{background:"var(--panel)",border:"1px solid var(--purple)",borderRadius:10,padding:"12px 14px",position:"relative"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                    <div style={{fontSize:12,color:"var(--dim)"}}>จากโปร</div>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <span style={{fontSize:10,padding:"1px 7px",borderRadius:99,background:"rgba(175,82,222,0.14)",color:"var(--purple)",fontWeight:600,whiteSpace:"nowrap"}}>คงเหลือ</span>
                      {canMutate&&<button onClick={()=>deleteWallet(w)} title="ลบรางวัลนี้" style={{background:"transparent",border:"1px solid var(--red)",color:"var(--red)",borderRadius:4,padding:"1px 6px",fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1.2}}>ลบ</button>}
                    </div>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:"var(--text)"}}>{w.promoName}</div>
                  <div style={{background:"var(--bg)",borderRadius:6,padding:"8px 10px",marginBottom:8}}>
                    <div style={{fontSize:11,color:"var(--dim)",marginBottom:2}}>รางวัล</div>
                    <div style={{fontSize:14,fontWeight:600,color:"var(--green)"}}>{rewardLbl(w.tier)}</div>
                    {w.tier&&w.tier.threshold>0&&<div style={{fontSize:10,color:"var(--faint)",marginTop:2}}>{"จากขั้น "+(w.tier.threshold>=1000?"฿"+fmt(w.tier.threshold):w.tier.threshold)}</div>}
                  </div>
                  <div style={{fontSize:11,color:"var(--faint)"}}>
                    {"เก็บเมื่อ "+toBE(w.savedAt)}{w.savedFromSO&&" • จาก "+w.savedFromSO}
                  </div>
                </div>)}
              </div>
            }
          </div>

          {/* Claim history */}
          <div>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:"var(--text)"}}>ประวัติการเคลม</div>
            {claimEntries.length===0
              ?<div style={{textAlign:"center",color:"var(--faint)",padding:"1.5rem",fontSize:13,background:"var(--bg)",borderRadius:8}}>ยังไม่เคยเคลมโปรโมชั่น</div>
              :<div style={{overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
                  <thead><tr style={{borderBottom:"1px solid var(--line)",background:"var(--bg)"}}>{[...["โปรโมชั่น","ขั้น/รางวัลที่เคลม","SO ล่าสุด","วันที่ล่าสุด"],...(canMutate?[""]:[])].map(thTd)}</tr></thead>
                  <tbody>{claimEntries.map(e=>(
                    <tr key={e.promoId} style={{borderBottom:"0.5px solid var(--line)"}}>
                      <td style={{padding:"7px 8px",fontWeight:500}}>{e.promoName}</td>
                      <td style={{padding:"7px 8px"}}>
                        {e.tierDetails.map((td,i)=>(
                          <span key={td.id+"-"+i} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,padding:"2px 4px 2px 7px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",marginRight:4,marginBottom:3,fontWeight:500}}>
                            <span>{td.tier?rewardLbl(td.tier):"tier #"+td.id+" (ถูกลบ)"}</span>
                            {canMutate&&<button onClick={()=>deleteClaimTier(e.promoId,td.id,e.promoName,td.tier)} title="ลบ tier นี้" style={{background:"transparent",border:"none",color:"var(--red)",cursor:"pointer",fontSize:11,padding:"0 4px",lineHeight:1,fontFamily:"inherit",fontWeight:700}}>×</button>}
                          </span>
                        ))}
                      </td>
                      <td style={{padding:"7px 8px",color:"var(--blue)",fontSize:12}}>{e.info.lastClaimedSO||"-"}</td>
                      <td style={{padding:"7px 8px",color:"var(--dim)",fontSize:12}}>{e.info.lastClaimedAt?toBE(e.info.lastClaimedAt):"-"}</td>
                      {canMutate&&<td style={{padding:"7px 8px"}}>
                        <button onClick={()=>deleteClaimEntry(e.promoId,e.promoName)} title="ลบประวัติทั้งหมดของโปรนี้" style={{background:"transparent",border:"1px solid var(--red)",color:"var(--red)",borderRadius:4,padding:"2px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>ลบทั้งหมด</button>
                      </td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            }
          </div>
        </div>;
      })()}

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

      {confirmAct&&(
        <Modal title={confirmAct.title||"ยืนยัน"} onClose={()=>setConfirmAct(null)}>
          <div style={{fontSize:13,color:"var(--text)",marginBottom:10}}>{confirmAct.msg}</div>
          {confirmAct.detail&&<div style={{background:"var(--bg)",borderRadius:8,padding:"10px 12px",fontSize:13,fontWeight:500,color:"var(--text)",border:"1px solid var(--line)",marginBottom:6}}>{confirmAct.detail}</div>}
          <MBtns onCancel={()=>setConfirmAct(null)} onSave={()=>{const f=confirmAct.onOk;setConfirmAct(null);if(typeof f==="function")f();}} saveLabel="ยืนยันลบ"/>
        </Modal>
      )}
    </>
  );

  return isDesktop ? (
    <SlideOver title={titleNode} onClose={onClose}>{body}</SlideOver>
  ) : (
    <Modal title={titleNode} onClose={onClose} wide>{body}</Modal>
  );
}

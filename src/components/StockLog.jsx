import { useState, useMemo } from "react";
import { MOVE_TYPES } from "../utils/constants.js";
import { fmt, fmtD, toBE, todayStr } from "../utils/helpers.js";
import SB from "./ui/SearchBar.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";
import StatCard from "./ui/StatCard.jsx";
import { Modal } from "./ui/Modal.jsx";

export default function LogPage({sh}){
  const{pN,cN,products,logs,setLogs,search,setSearch,sales,contacts,payments,pos,cnotes,billings,defectives,canE}=sh;
  const[fType,setFType]=useState("");const[fProd,setFProd]=useState("");const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");
  const[viewSO,setViewSO]=useState(null);
  const[viewPO,setViewPO]=useState(null);
  const[viewCN,setViewCN]=useState(null);
  const[confirmDelLog,setConfirmDelLog]=useState(null);
  const ed=canE("stock_log");

  const filtered=logs.filter(l=>{if(fType&&l.type!==fType)return false;if(fProd&&l.productId!==+fProd)return false;const ld=(l.date||"").slice(0,10);if(dateFrom&&ld<dateFrom)return false;if(dateTo&&ld>dateTo)return false;if(search){const s=search.toLowerCase();const pr=products.find(x=>x.id===l.productId);if(!((l.ref||"").toLowerCase().includes(s)||(pr?(pN(pr)||"").toLowerCase().includes(s):false)))return false;}return true;});
  const stats=useMemo(()=>{let inQty=0,outQty=0;filtered.forEach(l=>{const isIn=l.type==="in"||l.type==="adjust_in"||l.type==="cn_return"||(l.type==="cn_edit"&&l.qtyAfter>l.qtyBefore);if(isIn)inQty+=Math.abs(l.qty);else outQty+=Math.abs(l.qty);});return{total:filtered.length,inQty,outQty};},[filtered]);

  const openRef=(ref)=>{
    if(!ref||ref==="-"||ref==="Manual")return;
    if(ref.startsWith("SO-")){
      const so=sales.find(s=>s.soNum===ref);
      if(so){const cust=contacts.find(c=>c.id===so.customerId);const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const paid=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cust?cN(cust):"—",total:tot,paid,remaining:tot-paid});}
    }else if(ref.startsWith("PO-")){
      const po=pos.find(p=>p.poNum===ref);
      if(po){const sup=contacts.find(c=>c.id===po.supplierId);const tot=po.items.reduce((s,i)=>s+i.qty*i.cost,0);const paid=payments.filter(p=>p.refId===po.poNum&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);setViewPO({...po,supName:sup?cN(sup):"—",total:tot,paid,remaining:tot-paid});}
    }else if(ref.startsWith("CN-")){
      const cn=cnotes.find(c=>c.cnNum===ref);
      if(cn)setViewCN(cn);
    }
  };

  const isClickable=ref=>ref&&ref!=="-"&&ref!=="Manual"&&(ref.startsWith("SO-")||ref.startsWith("PO-")||ref.startsWith("CN-"));

  const CN_TYPES=[{key:"return",label:"คืนสินค้า",color:"var(--blue)",bg:"var(--blue-bg)"},{key:"defective",label:"สินค้าชำรุด",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},{key:"promo",label:"โปรโมชั่น",color:"var(--purple)",bg:"rgba(175,82,222,0.14)"}];

  const hasFilter=!!(search||fType||fProd||dateFrom||dateTo);

  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
      <StatCard label="รายการทั้งหมด" value={stats.total} color="var(--blue)" accentBg="var(--blue-bg)"/>
      <StatCard label="รับเข้ารวม" value={"+"+stats.inQty} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
      <StatCard label="จ่ายออกรวม" value={"-"+stats.outQty} color="var(--red)" accentBg="rgba(255,59,48,0.12)"/>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
      <SB value={search} onChange={setSearch} placeholder="ค้นหา..."/>
      <CustomSelect value={fType} onChange={setFType} options={[{value:"",label:"ทุกประเภท"},...Object.entries(MOVE_TYPES).map(([k,v])=>({value:k,label:v.label}))]} style={{width:"auto",minWidth:140}}/>
      <CustomSelect searchable value={fProd} onChange={setFProd} options={[{value:"",label:"ทุกสินค้า"},...products.map(p=>({value:String(p.id),label:p.brand+" — "+pN(p),searchText:p.code||""}))]} style={{width:"auto",minWidth:160}}/>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center",fontSize:12}}>
      <span style={{color:"var(--dim)"}}>ช่วงวันที่:</span>
      <ThaiDateInput value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
      <span style={{color:"var(--faint)"}}>—</span>
      <ThaiDateInput value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
      {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid var(--line)",background:"transparent",cursor:"pointer",color:"var(--dim)"}}>ล้าง</button>}
    </div>
    {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem 1rem"}}><div style={{fontSize:18,marginBottom:8,color:"var(--faint)"}}>—</div><div style={{color:"var(--dim)",fontSize:14}}>{hasFilter?"ไม่พบรายการที่ตรงกับตัวกรอง":"ยังไม่มีประวัติการเคลื่อนไหวสต็อก"}</div></div>}
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["วันที่","ประเภท","สินค้า","ก่อน","เคลื่อนไหว","หลัง","อ้างอิง","ผู้บันทึก",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(l=>{const pr=products.find(x=>x.id===l.productId);const mt=MOVE_TYPES[l.type]||{label:l.type,color:"var(--dim)",bg:"var(--line)"};const isIn=l.type==="in"||l.type==="adjust_in"||l.type==="cn_return"||(l.type==="cn_edit"&&l.qtyAfter>l.qtyBefore);return <tr key={l.id} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"8px",color:"var(--dim)",fontSize:11}}>{fmtD(l.date)}</td><td style={{padding:"8px"}}><span style={{background:mt.bg,color:mt.color,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600}}>{mt.label}</span></td><td style={{padding:"8px",fontWeight:500}}>{pr?pr.brand+" — "+pN(pr):"-"}</td><td style={{padding:"8px",color:"var(--dim)"}}>{l.qtyBefore}</td><td style={{padding:"8px",fontWeight:700,color:isIn?"var(--green)":"var(--red)"}}>{(isIn?"+":"-")+Math.abs(l.qty)}</td><td style={{padding:"8px",fontWeight:500}}>{l.qtyAfter}</td><td style={{padding:"8px",fontSize:12}}>{isClickable(l.ref)?<span style={{color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>openRef(l.ref)}>{l.ref}</span>:<span style={{color:"var(--blue)"}}>{l.ref}</span>}</td><td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{l.user}</td><td style={{padding:"8px",whiteSpace:"nowrap"}}>{ed&&<button onClick={()=>setConfirmDelLog(l)} style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</td></tr>;})}</tbody></table></div>

    {filtered.length>0&&<div style={{display:"flex",gap:16,padding:"10px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginTop:10,fontSize:13,flexWrap:"wrap"}}>
      <span style={{color:"var(--dim)"}}>{stats.total+" รายการ"}</span>
      <span style={{color:"var(--green)",fontWeight:600}}>{"รับเข้า: +"+stats.inQty}</span>
      <span style={{color:"var(--red)",fontWeight:600}}>{"จ่ายออก: -"+stats.outQty}</span>
      <span style={{color:"var(--blue)",fontWeight:600}}>{"สุทธิ: "+(stats.inQty-stats.outQty>=0?"+":"")+(stats.inQty-stats.outQty)}</span>
    </div>}

    {viewSO&&(()=>{const so=viewSO;const cust=contacts.find(c=>c.id===so.customerId);const payHist=payments.filter(p=>p.refId===so.soNum&&p.type==="ar");
      const soBillMap={};for(const b of(billings||[]))for(const sn of(b.soNums||[]))soBillMap[sn]=b;
      const bl=soBillMap[so.soNum];
      let dueDate=null,overdue=false;
      if(so.date){const days=so.payType==="credit"&&so.creditDays>0?so.creditDays:7;const d=new Date(so.date);d.setDate(d.getDate()+days);dueDate=d.toISOString().slice(0,10);overdue=so.remaining>0&&dueDate<todayStr();}
      const stLabel=so.paid===0?"รอชำระ":so.remaining<=0?"ชำระแล้ว":"บางส่วน";const stColor=so.paid===0?"var(--orange)":so.remaining<=0?"var(--green)":"var(--blue)";const stBg=so.paid===0?"rgba(255,149,0,0.14)":so.remaining<=0?"rgba(52,199,89,0.12)":"var(--blue-bg)";
      return<Modal title={"รายละเอียด SO — "+so.soNum} onClose={()=>setViewSO(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{so.soNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ลูกค้า</span><div style={{fontWeight:600}}>{cust?cN(cust):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(so.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เงื่อนไข</span><div>{so.payType==="credit"?<span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:"var(--blue-bg)",color:"var(--blue)",fontWeight:500}}>{"เครดิต "+so.creditDays+" วัน"}</span>:<span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>เงินสด 7 วัน</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ครบกำหนด</span><div>{dueDate?<span style={{fontWeight:500,color:overdue?"var(--red)":"var(--text)"}}>{toBE(dueDate)}{overdue&&<span style={{marginLeft:4,fontSize:10,background:"rgba(255,59,48,0.12)",color:"var(--red)",borderRadius:4,padding:"1px 6px"}}>เกินกำหนด</span>}</span>:<span style={{color:"var(--faint)"}}>—</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:stBg,color:stColor,fontWeight:500}}>{stLabel}</span></div></div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({(so.items||[]).length})</div>
        <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ราคา/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>{(so.items||[]).map((it,i)=>{const pr=products.find(p=>p.id===it.productId);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
            <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
            <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(it.price)}</td>
            <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*it.price)}</td>
          </tr>;})}</tbody></table>
        </div>
        {so.discountAmt>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 16px",fontSize:13,color:"var(--red)",marginBottom:4}}><span>ส่วนลด</span><span style={{fontWeight:600}}>{"- ฿"+fmt(so.discountAmt)}</span></div>}
        {bl&&<div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:14,fontSize:13}}>
          <span style={{color:"var(--dim)"}}>ใบวางบิล:</span> <span style={{color:"var(--blue)",fontWeight:600}}>{bl.billNum}</span>
          <span style={{marginLeft:8,fontSize:11,padding:"2px 8px",borderRadius:99,background:bl.status==="collected"?"rgba(52,199,89,0.12)":"rgba(255,149,0,0.14)",color:bl.status==="collected"?"var(--green)":"var(--orange)"}}>{bl.status==="collected"?"เก็บแล้ว":"รอเก็บเงิน"}</span>
        </div>}
        {payHist.length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ประวัติการชำระ ({payHist.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","จำนวน","หมายเหตุ"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i===2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{payHist.map(p=><tr key={p.id} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{toBE(p.date)}</td>
              <td style={{padding:"6px 12px"}}>{p.method}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{p.note||"—"}</td>
            </tr>)}</tbody></table>
          </div>
        </>}
        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอดรวม</span><span style={{fontWeight:600}}>{"฿"+fmt(so.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ชำระแล้ว</span><span style={{fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(so.paid)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--line)"}}><span>ค้างชำระ</span><span style={{color:so.remaining>0?"var(--red)":"var(--green)"}}>{"฿"+fmt(Math.max(0,so.remaining))}</span></div>
        </div>
      </Modal>;
    })()}

    {viewPO&&(()=>{const po=viewPO;const sup=contacts.find(c=>c.id===po.supplierId);const payHist=payments.filter(p=>p.refId===po.poNum&&p.type==="ap");
      const stLabel=po.paid===0?"รอชำระ":po.remaining<=0?"ชำระแล้ว":"บางส่วน";const stColor=po.paid===0?"var(--orange)":po.remaining<=0?"var(--green)":"var(--blue)";const stBg=po.paid===0?"rgba(255,149,0,0.14)":po.remaining<=0?"rgba(52,199,89,0.12)":"var(--blue-bg)";
      return<Modal title={"รายละเอียด PO — "+po.poNum} onClose={()=>setViewPO(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{po.poNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ซัพพลายเออร์</span><div style={{fontWeight:600}}>{sup?cN(sup):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(po.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ PO</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:po.status==="received"?"rgba(52,199,89,0.12)":"rgba(255,149,0,0.14)",color:po.status==="received"?"var(--green)":"var(--orange)",fontWeight:500}}>{po.status==="received"?"รับของแล้ว":po.status==="pending"?"รออนุมัติ":"อนุมัติแล้ว"}</span></div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ชำระเงิน</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:stBg,color:stColor,fontWeight:500}}>{stLabel}</span></div></div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({(po.items||[]).length})</div>
        <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ต้นทุน/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>{(po.items||[]).map((it,i)=>{const pr=products.find(p=>p.id===it.productId);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
            <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
            <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
            <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(it.cost)}</td>
            <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*it.cost)}</td>
          </tr>;})}</tbody></table>
        </div>
        {payHist.length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ประวัติการชำระ ({payHist.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["วันที่","วิธี","จำนวน","หมายเหตุ"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i===2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{payHist.map(p=><tr key={p.id} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{toBE(p.date)}</td>
              <td style={{padding:"6px 12px"}}>{p.method}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(p.amount)}</td>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{p.note||"—"}</td>
            </tr>)}</tbody></table>
          </div>
        </>}
        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ยอดรวม</span><span style={{fontWeight:600}}>{"฿"+fmt(po.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--dim)"}}>ชำระแล้ว</span><span style={{fontWeight:600,color:"var(--green)"}}>{"฿"+fmt(po.paid)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--line)"}}><span>ค้างจ่าย</span><span style={{color:po.remaining>0?"var(--red)":"var(--green)"}}>{"฿"+fmt(Math.max(0,po.remaining))}</span></div>
        </div>
      </Modal>;
    })()}

    {viewCN&&(()=>{const cn=viewCN;const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];const cust=contacts.find(c=>c.id===cn.customerId);const tot=cn.type==="promo"?+cn.amount:(cn.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const usedBill=(billings||[]).find(b=>(b.cnIds||[]).includes(cn.id));const df=cn.defectiveId?(defectives||[]).find(d=>d.id===cn.defectiveId):null;
      return<Modal title={"รายละเอียดใบลดหนี้ — "+cn.cnNum} onClose={()=>setViewCN(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{cn.cnNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ประเภท</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:tp.bg,color:tp.color,fontWeight:500}}>{tp.label}</span></div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(cn.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ลูกค้า</span><div style={{fontWeight:600}}>{cust?cN(cust):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>อ้างอิง SO</span><div>{cn.soNum?<span style={{color:"var(--blue)",fontWeight:500,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const so=sales.find(s=>s.soNum===cn.soNum);if(so){const cu2=contacts.find(c=>c.id===so.customerId);const tot2=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const pd=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cu2?cN(cu2):"—",total:tot2,paid:pd,remaining:tot2-pd});setViewCN(null);}}}>{cn.soNum}</span>:<span style={{fontWeight:500}}>—</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div>{usedBill?<span style={{fontSize:12}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>ใช้แล้ว</span><span style={{marginLeft:6,color:"var(--blue)",fontWeight:500}}>{usedBill.billNum}</span></span>:<span style={{fontSize:12,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่ได้ใช้</span>}</div></div>
        </div>
        {df&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ข้อมูลสินค้าชำรุด</div>
          <div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:14,fontSize:13}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
              <div><span style={{color:"var(--dim)"}}>รหัส:</span> <b style={{color:"var(--blue)"}}>{df.code}</b></div>
              <div><span style={{color:"var(--dim)"}}>สินค้า:</span> <b>{(()=>{const pr=products.find(p=>p.id===df.productId);return pr?pN(pr):"—";})()}</b></div>
              <div><span style={{color:"var(--dim)"}}>S/N:</span> <span style={{fontFamily:"monospace"}}>{df.serialNo||"—"}</span></div>
              <div><span style={{color:"var(--dim)"}}>อาการ:</span> {df.symptom||"—"}</div>
            </div>
          </div>
        </>}
        {(cn.items||[]).length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({cn.items.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ราคา/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{cn.items.map((it,i)=>{const pr=products.find(p=>p.id===it.productId);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
              <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
              <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
              <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(it.price)}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*it.price)}</td>
            </tr>;})}</tbody></table>
          </div>
        </>}
        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700}}><span>ยอดรวม CN</span><span style={{color:"var(--red)"}}>{"฿"+fmt(tot)}</span></div>
        </div>
        {(cn.reason||cn.note)&&<div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",fontSize:13}}>
          {cn.reason&&<div><span style={{color:"var(--dim)"}}>เหตุผล:</span> {cn.reason}</div>}
          {cn.note&&<div style={{marginTop:cn.reason?4:0}}><span style={{color:"var(--dim)"}}>หมายเหตุ:</span> {cn.note}</div>}
        </div>}
      </Modal>;
    })()}

    {confirmDelLog&&<Modal title="ยืนยันลบรายการสต็อก" onClose={()=>setConfirmDelLog(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบรายการ "+(MOVE_TYPES[confirmDelLog.type]?MOVE_TYPES[confirmDelLog.type].label:confirmDelLog.type)+" "+Math.abs(confirmDelLog.qty)+" ชิ้น ("+(products.find(p=>p.id===confirmDelLog.productId)?pN(products.find(p=>p.id===confirmDelLog.productId)):"—")+") ถาวร"}</div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setConfirmDelLog(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--text)",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ยกเลิก</button>
        <button onClick={()=>{setLogs(p=>p.filter(x=>x.id!==confirmDelLog.id));setConfirmDelLog(null);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"var(--red)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>
      </div>
    </Modal>}
  </div>;
}

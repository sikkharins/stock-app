import { useState, useMemo } from "react";

const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DOW_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const fmtC = n => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtC2 = n => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + (days||0));
  return d.toISOString().slice(0,10);
};

const diffDays = (a,b) => Math.round((new Date(a)-new Date(b))/(1000*60*60*24));

export default function FinancialCalendar({sh}){
  const{sales,pos,cheques,payments,contacts,bankAccs,lang}=sh;

  const now = new Date();
  const[year,setYear]=useState(now.getFullYear());
  const[month,setMonth]=useState(now.getMonth());
  const[selDate,setSelDate]=useState(null);

  const todayStr = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");

  const contMap = useMemo(()=>{const m={};contacts.forEach(c=>{m[c.id]=c;});return m;},[contacts]);
  const accMap = useMemo(()=>{const m={};(bankAccs||[]).forEach(a=>{m[a.id]=a;});return m;},[bankAccs]);

  // SO ref → customer name map
  const soMap = useMemo(()=>{const m={};sales.forEach(s=>{m[s.soNum]=s;});return m;},[sales]);
  const poMap = useMemo(()=>{const m={};pos.forEach(p=>{m[p.poNum]=p;});return m;},[pos]);

  const{eventMap,actualIn,actualOut,pendingIn,pendingOut} = useMemo(()=>{
    // map: date → { in:[{kind,ref,name,amount,type}], out:[...] }
    const map = {};
    const addEv = (date,dir,ev)=>{
      if(!date||date==="")return;
      if(!map[date])map[date]={in:[],out:[]};
      map[date][dir].push(ev);
    };

    // ── ACTUAL PAYMENTS (เงินที่รับ/จ่ายจริงแล้ว) ──────────────────────────
    payments.forEach(p=>{
      if(!p.date)return;
      const acc = p.accId?accMap[p.accId]:null;
      const accLabel = acc?`${acc.name} — ${acc.bank}`:"";
      if(p.type==="ar"){
        const so = soMap[p.refId];
        // ถ้า payment.date < so.date แสดงว่า payment นี้เป็นของ SO เก่าที่ถูกลบไปแล้ว (soNum ถูกนำมาใช้ซ้ำ)
        const isStalePmt = so && so.date && p.date < so.date;
        const c = (!isStalePmt && so)?contMap[so.customerId]:null;
        let timing="";
        if(!isStalePmt && so && so.date){
          const days2 = so.payType==="credit"&&so.creditDays>0?so.creditDays:7;
          const dueDate2 = addDays(so.date,days2);
          const diff = diffDays(p.date,dueDate2); // + = ช้า, - = เร็ว
          if(diff<0)timing=`ชำระก่อนกำหนด ${Math.abs(diff)} วัน`;
          else if(diff>0)timing=`ชำระหลังกำหนด ${diff} วัน`;
          else timing="ชำระตรงกำหนด";
        }
        addEv(p.date,"in",{kind:"actual",ref:p.refId,name:c?.nameT||c?.name||p.refId,amount:+p.amount||0,type:"ar_paid",method:p.method||"",timing,accLabel});
      } else if(p.type==="ap"){
        const po = poMap[p.refId];
        // ถ้า payment.date < po.date แสดงว่า payment นี้เป็นของ PO เก่าที่ถูกลบไปแล้ว
        const isStalePo = po && po.date && p.date < po.date;
        const s = (!isStalePo && po)?contMap[po.supplierId]:null;
        let timing="";
        if(!isStalePo && po && po.date){
          const baseDate2=po.deliveryDate||po.date;
          const dueDate2=addDays(baseDate2,po.creditDays||0);
          const diff=diffDays(p.date,dueDate2);
          if(diff<0)timing=`จ่ายก่อนกำหนด ${Math.abs(diff)} วัน`;
          else if(diff>0)timing=`จ่ายหลังกำหนด ${diff} วัน`;
          else timing="จ่ายตรงกำหนด";
        }
        addEv(p.date,"out",{kind:"actual",ref:p.refId,name:s?.nameT||s?.name||p.refId,amount:+p.amount||0,type:"ap_paid",method:p.method||"",timing,accLabel});
      }
    });

    // ── PENDING DUE DATES (ยอดที่ยังค้างชำระ) ─────────────────────────────
    // เงินเข้า: AR ค้างชำระ → แสดงที่วันครบกำหนด
    sales.filter(so=>so.status==="completed").forEach(so=>{
      const tot = so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0)+(so.vatAmount||0);
      // เฉพาะ payment ที่เกิดหลัง SO สร้าง (ป้องกัน soNum ซ้ำหลังลบ)
      const paid = payments.filter(p=>p.refId===so.soNum&&p.type==="ar"&&p.date>=so.date).reduce((s,p)=>s+(+p.amount||0),0);
      const rem = tot - paid;
      if(rem<=0)return;
      const days = so.payType==="credit"&&so.creditDays>0?so.creditDays:7;
      const dueDate = addDays(so.date, days);
      const c = contMap[so.customerId];
      addEv(dueDate,"in",{kind:"pending",ref:so.soNum,name:c?.nameT||c?.name||"-",amount:rem,type:"ar"});
    });

    // เงินเข้า: เช็ครับ pending
    cheques.filter(c=>c.status==="pending"&&c.dueDate).forEach(c=>{
      addEv(c.dueDate,"in",{kind:"pending",ref:"เช็ค "+c.chequeNo,name:c.from||"-",amount:+c.amount||0,type:"cheque"});
    });

    // เงินออก: AP ค้างจ่าย → แสดงที่วันครบกำหนด
    pos.filter(po=>po.status==="received").forEach(po=>{
      const tot = po.items.reduce((s,i)=>s+(i.qty||0)*(i.cost||0),0);
      // เฉพาะ payment ที่เกิดหลัง PO สร้าง (ป้องกัน poNum ซ้ำหลังลบ)
      const paid = payments.filter(p=>p.refId===po.poNum&&p.type==="ap"&&p.date>=po.date).reduce((s,p)=>s+(+p.amount||0),0);
      const rem = tot - paid;
      if(rem<=0)return;
      const baseDate = po.deliveryDate||po.date;
      const dueDate = addDays(baseDate, po.creditDays||0);
      const s = contMap[po.supplierId];
      addEv(dueDate,"out",{kind:"pending",ref:po.poNum,name:s?.nameT||s?.name||"-",amount:rem,type:"ap"});
    });

    // Monthly totals
    const prefix = year+"-"+String(month+1).padStart(2,"0");
    let ai=0,ao=0,pi=0,po2=0;
    Object.entries(map).forEach(([d,ev])=>{
      if(!d.startsWith(prefix))return;
      ev.in.forEach(e=>{if(e.kind==="actual")ai+=e.amount;else pi+=e.amount;});
      ev.out.forEach(e=>{if(e.kind==="actual")ao+=e.amount;else po2+=e.amount;});
    });
    return{eventMap:map,actualIn:ai,actualOut:ao,pendingIn:pi,pendingOut:po2};
  },[sales,pos,cheques,payments,contMap,soMap,poMap,year,month]);

  const cells = useMemo(()=>{
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    return[...Array(firstDow).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  },[year,month]);

  const prevMonth=()=>{if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1);setSelDate(null);};
  const nextMonth=()=>{if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1);setSelDate(null);};
  const goToday=()=>{setYear(now.getFullYear());setMonth(now.getMonth());setSelDate(todayStr);};
  const dateStr = d=>d?year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0"):null;

  const selEv = selDate?eventMap[selDate]||{in:[],out:[]}:{in:[],out:[]};
  const selIn = selEv.in.reduce((s,e)=>s+e.amount,0);
  const selOut = selEv.out.reduce((s,e)=>s+e.amount,0);
  const selActualIn = selEv.in.filter(e=>e.kind==="actual").reduce((s,e)=>s+e.amount,0);
  const selPendingIn = selEv.in.filter(e=>e.kind==="pending").reduce((s,e)=>s+e.amount,0);

  const cellBase={minHeight:76,borderRadius:8,padding:"6px 7px",cursor:"pointer",position:"relative",transition:"background 0.12s",boxSizing:"border-box"};

  const typeLabel = t=>{
    if(t==="ar_paid")return{label:"รับแล้ว",bg:"rgba(52,199,89,0.2)",color:"var(--green)"};
    if(t==="ap_paid")return{label:"จ่ายแล้ว",bg:"rgba(52,199,89,0.1)",color:"var(--green)"};
    if(t==="ar")return{label:"AR ค้าง",bg:"rgba(255,149,0,0.12)",color:"var(--orange)"};
    if(t==="cheque")return{label:"เช็ค",bg:"rgba(255,149,0,0.14)",color:"var(--orange)"};
    if(t==="ap")return{label:"AP ค้าง",bg:"rgba(255,59,48,0.1)",color:"var(--red)"};
    return{label:t,bg:"var(--hover)",color:"var(--dim)"};
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <div>
        <h2 style={{margin:0,fontSize:18,fontWeight:700}}>{lang==="th"?"ปฏิทินการเงิน":"Cash Flow Calendar"}</h2>
        <div style={{fontSize:12,color:"var(--dim)",marginTop:3}}>{lang==="th"?"เงินรับ-จ่ายจริง และยอดค้างชำระ":"Actual payments & pending dues"}</div>
      </div>
    </div>

    {/* Summary cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:20}}>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:10,color:"var(--dim)",fontWeight:500,marginBottom:3}}>รับแล้ว (เดือนนี้)</div>
        <div style={{fontSize:15,fontWeight:700,color:"var(--green)"}}>{"฿"+fmtC(actualIn)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:10,color:"var(--dim)",fontWeight:500,marginBottom:3}}>จ่ายแล้ว (เดือนนี้)</div>
        <div style={{fontSize:15,fontWeight:700,color:"var(--red)"}}>{"฿"+fmtC(actualOut)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:10,color:"var(--dim)",fontWeight:500,marginBottom:3}}>ยังรอรับ (เดือนนี้)</div>
        <div style={{fontSize:15,fontWeight:700,color:"var(--orange)"}}>{"฿"+fmtC(pendingIn)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:10,color:"var(--dim)",fontWeight:500,marginBottom:3}}>ยังค้างจ่าย (เดือนนี้)</div>
        <div style={{fontSize:15,fontWeight:700,color:"var(--orange)"}}>{"฿"+fmtC(pendingOut)}</div>
      </div>
    </div>

    {/* Calendar */}
    <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid var(--line)"}}>
        <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--line)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:14,color:"var(--text)",fontFamily:"inherit"}}>‹</button>
        <div style={{fontWeight:700,fontSize:16}}>{MONTH_TH[month]} {year+543}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={goToday} style={{background:"none",border:"1px solid var(--line)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"var(--blue)",fontFamily:"inherit"}}>{lang==="th"?"วันนี้":"Today"}</button>
          <button onClick={nextMonth} style={{background:"none",border:"1px solid var(--line)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:14,color:"var(--text)",fontFamily:"inherit"}}>›</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--line)"}}>
        {DOW_TH.map((d,i)=><div key={d} style={{textAlign:"center",padding:"8px 4px",fontSize:11,fontWeight:600,color:i===0?"var(--red)":i===6?"var(--blue)":"var(--dim)"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,padding:6}}>
        {cells.map((day,idx)=>{
          if(!day)return <div key={"e"+idx}/>;
          const ds=dateStr(day);
          const ev=eventMap[ds]||{in:[],out:[]};
          const totalIn2=ev.in.reduce((s,e)=>s+e.amount,0);
          const totalOut2=ev.out.reduce((s,e)=>s+e.amount,0);
          const hasActualIn=ev.in.some(e=>e.kind==="actual");
          const hasPendingIn=ev.in.some(e=>e.kind==="pending");
          const hasOut=ev.out.length>0;
          const isToday=ds===todayStr;
          const isSel=ds===selDate;
          const dow=idx%7;
          return <div key={ds} onClick={()=>setSelDate(ds===selDate?null:ds)}
            style={{...cellBase,
              background:isSel?"var(--blue-bg)":isToday?"rgba(255,214,10,0.1)":"var(--hover)",
              border:isSel?"1.5px solid var(--blue)":isToday?"1.5px solid rgba(255,214,10,0.6)":"1.5px solid transparent",
            }}>
            <div style={{fontSize:12,fontWeight:isToday?700:400,color:dow===0?"var(--red)":dow===6?"var(--blue)":"var(--text)",marginBottom:4}}>{day}</div>
            {totalIn2>0&&<div style={{fontSize:10,fontWeight:600,color:"var(--green)",background:hasActualIn?"rgba(52,199,89,0.18)":"rgba(52,199,89,0.08)",borderRadius:4,padding:"2px 4px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",border:hasPendingIn&&!hasActualIn?"1px dashed rgba(52,199,89,0.4)":"none"}}>
              +฿{fmtC(totalIn2)}
            </div>}
            {totalOut2>0&&<div style={{fontSize:10,fontWeight:600,color:"var(--red)",background:"rgba(255,59,48,0.1)",borderRadius:4,padding:"2px 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              -฿{fmtC(totalOut2)}
            </div>}
          </div>;
        })}
      </div>
    </div>

    {/* Detail panel */}
    {selDate&&<div style={{marginTop:14,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:14}}>
          {(()=>{const d=new Date(selDate+"T00:00:00");return d.getDate()+" "+MONTH_TH[d.getMonth()]+" "+(d.getFullYear()+543);})()}
        </div>
        <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--dim)",padding:"0 4px"}}>✕</button>
      </div>

      {selEv.in.length===0&&selEv.out.length===0&&
        <div style={{padding:"2rem",textAlign:"center",color:"var(--dim)",fontSize:13}}>ไม่มีรายการวันนี้</div>
      }

      {selEv.in.length>0&&<div>
        <div style={{padding:"10px 16px 6px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(52,199,89,0.05)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--green)"}}>เงินเข้า</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--green)"}}>{"฿"+fmtC2(selIn)}</div>
        </div>
        {selEv.in.map((e,i)=>{
          const tl=typeLabel(e.type);
          const timingColor=e.timing?.includes("ก่อน")?"var(--green)":e.timing?.includes("หลัง")?"var(--red)":"var(--dim)";
          return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"9px 16px",borderTop:"0.5px solid var(--line)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500}}>{e.name}</div>
              <div style={{fontSize:11,color:"var(--dim)",marginTop:3,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{background:tl.bg,color:tl.color,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:600}}>{tl.label}</span>
                <span>{e.ref}</span>
                {e.method&&<span style={{color:"var(--faint)"}}>· {e.method}</span>}
              </div>
              {e.timing&&<div style={{fontSize:11,color:timingColor,marginTop:3,fontWeight:500}}>{e.timing}</div>}
              {e.accLabel&&<div style={{fontSize:11,color:"var(--blue)",marginTop:2}}>เข้า: {e.accLabel}</div>}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:"var(--green)",marginLeft:12,whiteSpace:"nowrap"}}>{"฿"+fmtC2(e.amount)}</div>
          </div>;
        })}
      </div>}

      {selEv.out.length>0&&<div style={{borderTop:selEv.in.length>0?"1px solid var(--line)":"none"}}>
        <div style={{padding:"10px 16px 6px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,59,48,0.05)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--red)"}}>เงินออก</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--red)"}}>{"฿"+fmtC2(selOut)}</div>
        </div>
        {selEv.out.map((e,i)=>{
          const tl=typeLabel(e.type);
          const timingColor=e.timing?.includes("ก่อน")?"var(--green)":e.timing?.includes("หลัง")?"var(--red)":"var(--dim)";
          return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"9px 16px",borderTop:"0.5px solid var(--line)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500}}>{e.name}</div>
              <div style={{fontSize:11,color:"var(--dim)",marginTop:3,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{background:tl.bg,color:tl.color,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:600}}>{tl.label}</span>
                <span>{e.ref}</span>
                {e.method&&<span style={{color:"var(--faint)"}}>· {e.method}</span>}
              </div>
              {e.timing&&<div style={{fontSize:11,color:timingColor,marginTop:3,fontWeight:500}}>{e.timing}</div>}
              {e.accLabel&&<div style={{fontSize:11,color:"var(--blue)",marginTop:2}}>ออก: {e.accLabel}</div>}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:"var(--red)",marginLeft:12,whiteSpace:"nowrap"}}>{"฿"+fmtC2(e.amount)}</div>
          </div>;
        })}
      </div>}

      {(selEv.in.length>0||selEv.out.length>0)&&<div style={{padding:"10px 16px",borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",background:"var(--hover)"}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>สุทธิวันนี้</div>
        <div style={{fontSize:14,fontWeight:700,color:selIn-selOut>=0?"var(--green)":"var(--red)"}}>{"฿"+fmtC2(selIn-selOut)}</div>
      </div>}
    </div>}

    {/* Legend */}
    <div style={{marginTop:12,display:"flex",gap:14,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--dim)"}}>
        <div style={{width:10,height:10,borderRadius:2,background:"rgba(52,199,89,0.18)"}}/>รับแล้ว (เงินเข้าจริง)
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--dim)"}}>
        <div style={{width:10,height:10,borderRadius:2,background:"rgba(52,199,89,0.08)",border:"1px dashed rgba(52,199,89,0.4)"}}/>ยังรอรับ (due date)
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--dim)"}}>
        <div style={{width:10,height:10,borderRadius:2,background:"rgba(255,59,48,0.12)"}}/>เงินออก
      </div>
    </div>
  </div>;
}

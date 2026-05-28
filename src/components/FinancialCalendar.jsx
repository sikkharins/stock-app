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
const toBE = d => {if(!d)return"-";const p=d.split("-");if(p.length!==3)return d;return p[2]+"/"+p[1]+"/"+(+p[0]+543);};

export default function FinancialCalendar({sh}){
  const{sales,pos,cheques,payments,contacts,lang}=sh;

  const now = new Date();
  const[year,setYear]=useState(now.getFullYear());
  const[month,setMonth]=useState(now.getMonth());
  const[selDate,setSelDate]=useState(null);

  const todayStr = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");

  // Contact map
  const contMap = useMemo(()=>{const m={};contacts.forEach(c=>{m[c.id]=c;});return m;},[contacts]);

  // Build all financial events
  const{eventMap,totalIn,totalOut} = useMemo(()=>{
    const map = {};
    const addEvent = (date, dir, ev) => {
      if(!date||date==="")return;
      if(!map[date])map[date]={in:[],out:[]};
      map[date][dir].push(ev);
    };

    // เงินเข้า: AR due from completed SOs (cash=7วัน, credit=creditDays) — same logic as Finance.jsx
    sales.filter(so=>so.status==="completed").forEach(so=>{
      const tot = so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0)+(so.vatAmount||0);
      const paid = payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);
      const rem = tot - paid;
      if(rem<=0)return;
      const days = so.payType==="credit"&&so.creditDays>0?so.creditDays:7;
      const dueDate = addDays(so.date, days);
      const c = contMap[so.customerId];
      addEvent(dueDate,"in",{ref:so.soNum,name:c?.nameT||c?.name||"-",amount:rem,type:"ar"});
    });

    // เงินเข้า: เช็ครับที่ยังไม่ถึงกำหนด
    cheques.filter(c=>c.status==="pending"&&c.dueDate).forEach(c=>{
      addEvent(c.dueDate,"in",{ref:"เช็ค "+c.chequeNo,name:c.from||"-",amount:+c.amount||0,type:"cheque"});
    });

    // เงินออก: AP due from received POs
    pos.filter(po=>po.status==="received").forEach(po=>{
      const tot = po.items.reduce((s,i)=>s+(i.qty||0)*(i.cost||0),0);
      const paid = payments.filter(p=>p.refId===po.poNum&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);
      const rem = tot - paid;
      if(rem<=0)return;
      const baseDate = po.deliveryDate||po.date;
      const dueDate = addDays(baseDate, po.creditDays||0);
      const s = contMap[po.supplierId];
      addEvent(dueDate,"out",{ref:po.poNum,name:s?.nameT||s?.name||"-",amount:rem,type:"ap"});
    });

    // Monthly totals
    const prefix = year+"-"+String(month+1).padStart(2,"0");
    let ti=0,to=0;
    Object.entries(map).forEach(([d,ev])=>{
      if(d.startsWith(prefix)){
        ti+=ev.in.reduce((s,e)=>s+e.amount,0);
        to+=ev.out.reduce((s,e)=>s+e.amount,0);
      }
    });
    return{eventMap:map,totalIn:ti,totalOut:to};
  },[sales,pos,cheques,payments,contMap,year,month]);

  // Calendar cells
  const cells = useMemo(()=>{
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    return[...Array(firstDow).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  },[year,month]);

  const prevMonth=()=>{if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1);setSelDate(null);};
  const nextMonth=()=>{if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1);setSelDate(null);};
  const goToday=()=>{setYear(now.getFullYear());setMonth(now.getMonth());setSelDate(todayStr);};

  const dateStr = d => d?year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0"):null;

  const selEvents = selDate?eventMap[selDate]||{in:[],out:[]}:{in:[],out:[]};
  const selIn = selEvents.in.reduce((s,e)=>s+e.amount,0);
  const selOut = selEvents.out.reduce((s,e)=>s+e.amount,0);

  // Styles
  const cellBase = {minHeight:76,borderRadius:8,padding:"6px 7px",cursor:"pointer",position:"relative",transition:"background 0.12s",boxSizing:"border-box"};

  return <div>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <div>
        <h2 style={{margin:0,fontSize:18,fontWeight:700}}>{lang==="th"?"ปฏิทินการเงิน":"Cash Flow Calendar"}</h2>
        <div style={{fontSize:12,color:"var(--dim)",marginTop:3}}>{lang==="th"?"ยอดเงินเข้า-ออก ตามวันครบกำหนด":"Expected cash in/out by due date"}</div>
      </div>
    </div>

    {/* Monthly summary cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:20}}>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--dim)",fontWeight:500}}>{lang==="th"?"เงินเข้าเดือนนี้":"Cash In (Month)"}</div>
        <div style={{fontSize:16,fontWeight:700,marginTop:4,color:"var(--green)"}}>{"฿"+fmtC(totalIn)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--dim)",fontWeight:500}}>{lang==="th"?"เงินออกเดือนนี้":"Cash Out (Month)"}</div>
        <div style={{fontSize:16,fontWeight:700,marginTop:4,color:"var(--red)"}}>{"฿"+fmtC(totalOut)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--dim)",fontWeight:500}}>{lang==="th"?"สุทธิ":"Net"}</div>
        <div style={{fontSize:16,fontWeight:700,marginTop:4,color:totalIn-totalOut>=0?"var(--green)":"var(--red)"}}>{"฿"+fmtC(totalIn-totalOut)}</div>
      </div>
    </div>

    {/* Calendar navigation */}
    <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid var(--line)"}}>
        <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--line)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:14,color:"var(--text)",fontFamily:"inherit"}}>{"‹"}</button>
        <div style={{fontWeight:700,fontSize:16}}>
          {MONTH_TH[month]} {year+543}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={goToday} style={{background:"none",border:"1px solid var(--line)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"var(--blue)",fontFamily:"inherit"}}>{lang==="th"?"วันนี้":"Today"}</button>
          <button onClick={nextMonth} style={{background:"none",border:"1px solid var(--line)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:14,color:"var(--text)",fontFamily:"inherit"}}>{"›"}</button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--line)"}}>
        {DOW_TH.map((d,i)=><div key={d} style={{textAlign:"center",padding:"8px 4px",fontSize:11,fontWeight:600,color:i===0?"var(--red)":i===6?"var(--blue)":"var(--dim)"}}>{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,padding:6}}>
        {cells.map((day,idx)=>{
          if(!day) return <div key={"e"+idx}/>;
          const ds = dateStr(day);
          const ev = eventMap[ds]||{in:[],out:[]};
          const hasIn = ev.in.length>0;
          const hasOut = ev.out.length>0;
          const isToday = ds===todayStr;
          const isSel = ds===selDate;
          const dow = (idx)%7;
          const isSun = dow===0;
          const isSat = dow===6;

          return <div key={ds} onClick={()=>setSelDate(ds===selDate?null:ds)}
            style={{...cellBase,
              background: isSel?"var(--blue-bg)":isToday?"rgba(255,214,10,0.1)":"var(--hover)",
              border: isSel?"1.5px solid var(--blue)":isToday?"1.5px solid rgba(255,214,10,0.6)":"1.5px solid transparent",
            }}>
            <div style={{fontSize:12,fontWeight:isToday?700:400,color:isSun?"var(--red)":isSat?"var(--blue)":"var(--text)",marginBottom:4}}>{day}</div>
            {hasIn&&<div style={{fontSize:10,fontWeight:600,color:"var(--green)",background:"rgba(52,199,89,0.12)",borderRadius:4,padding:"2px 4px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              +฿{fmtC(ev.in.reduce((s,e)=>s+e.amount,0))}
            </div>}
            {hasOut&&<div style={{fontSize:10,fontWeight:600,color:"var(--red)",background:"rgba(255,59,48,0.1)",borderRadius:4,padding:"2px 4px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              -฿{fmtC(ev.out.reduce((s,e)=>s+e.amount,0))}
            </div>}
          </div>;
        })}
      </div>
    </div>

    {/* Detail panel */}
    {selDate&&<div style={{marginTop:14,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:14}}>
          {(()=>{const d=new Date(selDate);return d.getDate()+" "+MONTH_TH[d.getMonth()]+" "+(d.getFullYear()+543);})()}
        </div>
        <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--dim)",padding:"0 4px"}}>✕</button>
      </div>

      {selEvents.in.length===0&&selEvents.out.length===0&&
        <div style={{padding:"2rem",textAlign:"center",color:"var(--dim)",fontSize:13}}>{lang==="th"?"ไม่มีรายการวันนี้":"No events on this day"}</div>
      }

      {selEvents.in.length>0&&<div>
        <div style={{padding:"10px 16px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--green)"}}>{lang==="th"?"เงินเข้า":"Cash In"}</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--green)"}}>{"฿"+fmtC2(selIn)}</div>
        </div>
        {selEvents.in.map((e,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",borderTop:"0.5px solid var(--line)"}}>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{e.name}</div>
            <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>
              <span style={{background:e.type==="cheque"?"rgba(255,149,0,0.14)":"rgba(52,199,89,0.12)",color:e.type==="cheque"?"var(--orange)":"var(--green)",borderRadius:4,padding:"1px 6px",marginRight:6,fontSize:10}}>
                {e.type==="cheque"?"เช็ค":"AR"}
              </span>
              {e.ref}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:"var(--green)"}}>{"฿"+fmtC2(e.amount)}</div>
        </div>)}
      </div>}

      {selEvents.out.length>0&&<div style={{borderTop:selEvents.in.length>0?"1px solid var(--line)":"none"}}>
        <div style={{padding:"10px 16px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--red)"}}>{lang==="th"?"เงินออก":"Cash Out"}</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--red)"}}>{"฿"+fmtC2(selOut)}</div>
        </div>
        {selEvents.out.map((e,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",borderTop:"0.5px solid var(--line)"}}>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{e.name}</div>
            <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>
              <span style={{background:"rgba(255,59,48,0.1)",color:"var(--red)",borderRadius:4,padding:"1px 6px",marginRight:6,fontSize:10}}>AP</span>
              {e.ref}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:"var(--red)"}}>{"฿"+fmtC2(e.amount)}</div>
        </div>)}
      </div>}

      {(selEvents.in.length>0||selEvents.out.length>0)&&<div style={{padding:"10px 16px",borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",background:"var(--hover)"}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>{lang==="th"?"สุทธิวันนี้":"Net Today"}</div>
        <div style={{fontSize:14,fontWeight:700,color:selIn-selOut>=0?"var(--green)":"var(--red)"}}>{"฿"+fmtC2(selIn-selOut)}</div>
      </div>}
    </div>}

    {/* Legend */}
    <div style={{marginTop:12,display:"flex",gap:16,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--dim)"}}>
        <div style={{width:10,height:10,borderRadius:2,background:"rgba(52,199,89,0.2)",border:"1px solid var(--green)"}}/>
        {lang==="th"?"เงินเข้า (AR / เช็คครบกำหนด)":"Cash In (AR / Cheque due)"}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--dim)"}}>
        <div style={{width:10,height:10,borderRadius:2,background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)"}}/>
        {lang==="th"?"เงินออก (AP ครบกำหนด)":"Cash Out (AP due)"}
      </div>
    </div>
  </div>;
}

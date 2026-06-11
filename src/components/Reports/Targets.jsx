import { useState, useMemo } from "react";
import { fmt } from "../../utils/helpers.js";
import { IB } from "../../utils/constants.js";
import CustomSelect from "../ui/CustomSelect.jsx";
import NeonGauge, { GAUGE_VARIANTS, colorAt, useEased } from "../ui/NeonGauge.jsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MONTHS_TH=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const mLabel=m=>{const[y,mo]=m.split("-");return MONTHS_TH[+mo]+" "+(+y+543);};
const TOP_N=6;
const OTHERS_COLOR="rgba(160,160,170,0.55)";

// Sales card — gauge + legend ลูกค้า (แยกเป็น component เพื่อใช้ useEased ได้)
function SalesGaugeCard({t,actual,segments,variant,canE,onEdit,onDel}){
  const over=actual>=t.target;
  const rawPct=t.target>0?actual/t.target*100:0;
  const eased=useEased(Math.min(100,Math.max(0,rawPct)),true);
  const legendColor=(i,isOther)=>{
    if(isOther)return OTHERS_COLOR;
    const slot=segments.length>1?(i/(segments.length-1)):0.5;
    return colorAt("reference",slot);
  };
  return<div style={{background:"linear-gradient(180deg,var(--panel) 0%,var(--bg2,var(--panel)) 100%)",border:"0.5px solid var(--line)",borderRadius:14,padding:16,position:"relative",overflow:"hidden"}}>
    {over&&<span style={{position:"absolute",top:12,right:12,fontSize:11,fontWeight:700,background:"rgba(86,240,162,0.12)",color:"#6cf0a8",borderRadius:6,padding:"2px 8px",zIndex:2,boxShadow:"0 0 12px rgba(86,240,162,0.35)"}}>ทำได้แล้ว!</span>}
    <div style={{fontWeight:600,fontSize:15,marginBottom:2,paddingRight:80,letterSpacing:-0.2}}>{t.salesName}</div>
    <div style={{fontSize:11,color:"var(--faint)",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{mLabel(t.month)}</div>
    <div style={{margin:"4px -4px 8px"}}>
      <NeonGauge variant={variant} uid={"g-"+t.id+"-"+variant} value={eased} target={100} glow={96} theme="reference" sublabel="" showTarget={false}/>
    </div>
    {segments.length>0?<div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12,fontSize:11.5}}>
      {segments.map((s,i)=>{
        const c=legendColor(i,s.isOther);
        const pctOfActual=actual>0?(s.amount/actual*100):0;
        return<div key={s.customerId} style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0,boxShadow:s.isOther?"none":"0 0 6px "+c}}/>
          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:s.isOther?"var(--faint)":"var(--text)"}} title={s.name}>{s.name}</span>
          <span style={{color:"var(--dim)",fontVariantNumeric:"tabular-nums"}}>฿{fmt(s.amount)}</span>
          <span style={{color:"var(--faint)",fontVariantNumeric:"tabular-nums",minWidth:36,textAlign:"right"}}>{pctOfActual.toFixed(0)}%</span>
        </div>;
      })}
    </div>:<div style={{textAlign:"center",fontSize:11,color:"var(--faint)",padding:"8px 0",marginBottom:8}}>ยังไม่มียอดในเดือนนี้</div>}
    <div style={{borderTop:"1px solid var(--line)",paddingTop:10,fontSize:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",color:"var(--dim)",marginBottom:5}}>
        <span>ยอดจริง</span><span style={{fontSize:18,fontWeight:700,color:colorAt("reference",Math.max(0,Math.min(1,rawPct/100))),fontVariantNumeric:"tabular-nums",textShadow:"0 0 14px "+colorAt("reference",Math.max(0,Math.min(1,rawPct/100)))}}>฿{fmt(actual)}</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",color:"var(--dim)"}}>
        <span>เป้าหมาย</span><span style={{fontSize:18,fontWeight:700,color:colorAt("reference",1),fontVariantNumeric:"tabular-nums",textShadow:"0 0 14px "+colorAt("reference",1)}}>฿{fmt(t.target)}</span>
      </div>
      {canE&&<div style={{display:"flex",gap:10,marginTop:8,justifyContent:"flex-end"}}>
        <button onClick={onEdit} style={{fontSize:11,color:"var(--blue)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>แก้ไข</button>
        <button onClick={onDel} style={{fontSize:11,color:"var(--red)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>ลบ</button>
      </div>}
    </div>
  </div>;
}

export default function TargetsReport({targets,setTargets,sales,contacts,users,canE}){
  const now=new Date();
  const def=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  const[selMonth,setSelMonth]=useState(def);
  const[adding,setAdding]=useState(false);
  const[form,setForm]=useState({salesName:"",target:""});
  const[variant,setVariant]=useState("classic"); // "classic" | "sweep" | "segment"

  const salesUsers=users.filter(u=>u.role==="Sales"&&u.salesName);
  const custSalesMap=useMemo(()=>{const m={};contacts.forEach(c=>{if(c.type==="customer"&&c.salesPerson)m[c.id]=c.salesPerson;});return m;},[contacts]);

  const monthSales=useMemo(()=>sales.filter(s=>(s.date||"").startsWith(selMonth)),[sales,selMonth]);

  // ยอดรวมต่อเซลส์ (สำหรับ bar chart) + ยอดต่อ (เซลส์, ลูกค้า) สำหรับ donut
  const{actualMap,actualByCustomer}=useMemo(()=>{
    const tot={};
    const byCust={}; // {sp: {custId: {customerId, name, amount}}}
    monthSales.forEach(so=>{
      const sp=custSalesMap[so.customerId];
      if(!sp)return;
      const sub=so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0);
      tot[sp]=(tot[sp]||0)+sub;
      if(!byCust[sp])byCust[sp]={};
      if(!byCust[sp][so.customerId]){
        const c=contacts.find(x=>+x.id===+so.customerId);
        byCust[sp][so.customerId]={customerId:so.customerId,name:c?(c.nameT||c.name||"-"):"(ไม่พบ)",amount:0};
      }
      byCust[sp][so.customerId].amount+=sub;
    });
    const sortedByCust={};
    Object.entries(byCust).forEach(([sp,cs])=>{sortedByCust[sp]=Object.values(cs).sort((a,b)=>b.amount-a.amount);});
    return{actualMap:tot,actualByCustomer:sortedByCust};
  },[monthSales,custSalesMap,contacts]);

  const monthTargets=targets.filter(t=>t.month===selMonth);

  const openAdd=()=>{setForm({salesName:"",target:""});setAdding(true);};

  const saveTarget=()=>{
    if(!form.salesName||!form.target)return;
    const ex=targets.find(t=>t.month===selMonth&&t.salesName===form.salesName);
    if(ex){setTargets(p=>p.map(t=>t.id===ex.id?{...t,target:+form.target}:t));}
    else{setTargets(p=>[...p,{id:Date.now(),salesName:form.salesName,month:selMonth,target:+form.target}]);}
    setAdding(false);setForm({salesName:"",target:""});
  };

  const delTarget=id=>{if(window.confirm("ลบเป้ายอดขายนี้?"))setTargets(p=>p.filter(t=>t.id!==id));};

  const openEdit=t=>{setForm({salesName:t.salesName,target:String(t.target)});setAdding(true);};

  return<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div style={{fontWeight:600,fontSize:15}}>เป้ายอดขายรายเดือน</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{...IB,width:"auto",padding:"6px 10px"}}/>
        {canE&&<button onClick={openAdd} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"var(--text)",color:"var(--bg)",fontSize:13,cursor:"pointer"}}>+ ตั้งเป้า</button>}
      </div>
    </div>

    {adding&&<div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:16,marginBottom:16}}>
      <div style={{fontWeight:500,fontSize:13,marginBottom:12}}>เพิ่ม/แก้ไขเป้า — {mLabel(selMonth)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"end"}}>
        <div>
          <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>เซลส์</div>
          <CustomSelect value={form.salesName} onChange={v=>setForm(f=>({...f,salesName:v}))} options={[{value:"",label:"-- เลือกเซลส์ --"},...salesUsers.map(u=>({value:u.salesName,label:u.salesName}))]}/>
        </div>
        <div>
          <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>เป้าหมาย (บาท)</div>
          <input type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} placeholder="เช่น 100000" style={IB}/>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={saveTarget} style={{padding:"8px 16px",borderRadius:6,border:"none",background:"var(--text)",color:"var(--bg)",fontSize:13,cursor:"pointer"}}>บันทึก</button>
          <button onClick={()=>setAdding(false)} style={{padding:"8px 12px",borderRadius:6,border:"0.5px solid var(--line)",background:"transparent",fontSize:13,cursor:"pointer"}}>ยกเลิก</button>
        </div>
      </div>
    </div>}

    {monthTargets.length>0&&<div style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8,padding:"1rem",marginBottom:16}}>
      <div style={{fontWeight:500,fontSize:13,color:"var(--dim)",marginBottom:8}}>เป้า vs ยอดจริง — {mLabel(selMonth)}</div>
      <ResponsiveContainer width="100%" height={Math.max(140,monthTargets.length*50)}>
        <BarChart data={monthTargets.map(t=>({name:t.salesName,target:t.target,actual:actualMap[t.salesName]||0}))} layout="vertical" margin={{top:5,right:20,left:10,bottom:5}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/>
          <XAxis type="number" tick={{fontSize:11,fill:"var(--dim)"}} tickFormatter={v=>v>=1000?Math.round(v/1000)+"k":v}/>
          <YAxis type="category" dataKey="name" tick={{fontSize:12,fill:"var(--dim)"}} width={80}/>
          <Tooltip formatter={v=>"฿"+fmt(v)} contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,fontSize:12}}/>
          <Legend wrapperStyle={{fontSize:12}}/>
          <Bar dataKey="target" name="เป้าหมาย" fill="var(--blue)" radius={[0,4,4,0]}/>
          <Bar dataKey="actual" name="ยอดจริง" fill="var(--green)" radius={[0,4,4,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>}

    {monthTargets.length===0
      ?<div style={{textAlign:"center",color:"var(--faint)",padding:"3rem",background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8}}>ยังไม่มีเป้าสำหรับ {mLabel(selMonth)}</div>
      :<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div style={{fontWeight:500,fontSize:13,color:"var(--dim)"}}>เป้ารายเซลส์ • ใต้เกจแยกตามร้านลูกค้า (Top {TOP_N} + อื่นๆ)</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,color:"var(--dim)"}}>
            <span>สไตล์:</span>
            <div style={{display:"inline-flex",border:"1px solid var(--line)",borderRadius:99,overflow:"hidden"}}>
              {GAUGE_VARIANTS.map(o=>(
                <button key={o.id} onClick={()=>setVariant(o.id)} style={{padding:"4px 12px",border:"none",background:variant===o.id?"var(--text)":"transparent",color:variant===o.id?"var(--bg)":"var(--dim)",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
        {monthTargets.map(t=>{
          const actual=actualMap[t.salesName]||0;
          const allCusts=actualByCustomer[t.salesName]||[];
          const top=allCusts.slice(0,TOP_N);
          const rest=allCusts.slice(TOP_N);
          const restAmt=rest.reduce((s,x)=>s+x.amount,0);
          const segments=[...top,...(restAmt>0?[{customerId:"__others__",name:"อื่นๆ ("+rest.length+" ร้าน)",amount:restAmt,isOther:true}]:[])];
          return<SalesGaugeCard key={t.id} t={t} actual={actual} segments={segments} variant={variant} canE={canE} onEdit={()=>openEdit(t)} onDel={()=>delTarget(t.id)}/>;
        })}
        </div>
      </>
    }
  </div>;
}

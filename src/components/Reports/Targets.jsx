import { useState } from "react";
import { fmt } from "../../utils/helpers.js";
import { IB } from "../../utils/constants.js";
import CustomSelect from "../ui/CustomSelect.jsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MONTHS_TH=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const mLabel=m=>{const[y,mo]=m.split("-");return MONTHS_TH[+mo]+" "+(+y+543);};

export default function TargetsReport({targets,setTargets,sales,contacts,users,canE}){
  const now=new Date();
  const def=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  const[selMonth,setSelMonth]=useState(def);
  const[adding,setAdding]=useState(false);
  const[form,setForm]=useState({salesName:"",target:""});

  const salesUsers=users.filter(u=>u.role==="Sales"&&u.salesName);
  const custSalesMap={};contacts.forEach(c=>{if(c.type==="customer"&&c.salesPerson)custSalesMap[c.id]=c.salesPerson;});

  const monthSales=sales.filter(s=>(s.date||"").startsWith(selMonth));
  const actualMap={};
  monthSales.forEach(so=>{
    const sp=custSalesMap[so.customerId];
    if(sp){const sub=so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0);actualMap[sp]=(actualMap[sp]||0)+sub;}
  });

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
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
        {monthTargets.map(t=>{
          const actual=actualMap[t.salesName]||0;
          const rawPct=t.target>0?actual/t.target*100:0;
          const barPct=Math.min(Math.round(rawPct),100);
          const over=actual>=t.target;
          return<div key={t.id} style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10,padding:16,position:"relative"}}>
            {over&&<span style={{position:"absolute",top:12,right:12,fontSize:11,fontWeight:700,background:"rgba(52,199,89,0.12)",color:"var(--green)",borderRadius:6,padding:"2px 8px"}}>ทำได้แล้ว!</span>}
            <div style={{fontWeight:600,fontSize:15,marginBottom:2,paddingRight:28}}>{t.salesName}</div>
            <div style={{fontSize:12,color:"var(--faint)",marginBottom:14}}>{mLabel(t.month)}</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--dim)",marginBottom:4}}>
              <span>ยอดจริง</span><span style={{fontWeight:500,color:"var(--text)"}}>{"฿"+fmt(actual)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--dim)",marginBottom:8}}>
              <span>เป้าหมาย</span><span style={{fontWeight:500}}>{"฿"+fmt(t.target)}</span>
            </div>
            <div style={{background:"var(--hover)",borderRadius:6,height:12,overflow:"hidden",marginBottom:4}}>
              <div style={{background:over?"var(--green)":"var(--blue)",height:12,width:barPct+"%",borderRadius:6}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <span style={{fontSize:13,fontWeight:700,color:over?"var(--green)":"var(--blue)"}}>{Math.round(rawPct)+"%"}</span>
              {canE&&<div style={{display:"flex",gap:8}}>
                <button onClick={()=>openEdit(t)} style={{fontSize:11,color:"var(--blue)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>แก้ไข</button>
                <button onClick={()=>delTarget(t.id)} style={{fontSize:11,color:"var(--red)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>ลบ</button>
              </div>}
            </div>
          </div>;
        })}
      </div>
    }
  </div>;
}

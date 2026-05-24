import { useState, useMemo } from "react";
import { fmt } from "../../utils/helpers.js";
import { IB } from "../../utils/constants.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MONTHS_TH=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const mLabel=m=>{const[y,mo]=m.split("-");return MONTHS_TH[+mo]+" "+(+y+543);};
const getPrev=m=>{const[y,mo]=m.split("-").map(Number);const d=new Date(y,mo-2,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");};
const COLORS=["#34c759","#007aff","#ff9500","#af52de","#ff3b30","#5ac8fa","#ffcc00","#ff2d55","#64d2ff","#30d158","#bf5af2","#ff6482"];

function Delta({a,b}){
  if(b===0&&a===0)return<span style={{color:"var(--faint)",fontSize:12}}>-</span>;
  if(b===0)return<span style={{fontSize:13,fontWeight:600,color:"var(--green)"}}>ใหม่</span>;
  const p=(a-b)/b*100;const up=p>=0;
  return<span style={{fontSize:13,fontWeight:600,color:up?"var(--green)":"var(--red)"}}>{(up?"+":"")+Math.round(p)+"%"}</span>;
}

const TIP_STYLE={background:"var(--panel)",border:"1px solid var(--line)",borderRadius:8,fontSize:12};
function Tip({active,payload,label}){
  if(!active||!payload?.length)return null;
  const items=payload.filter(p=>p.value>0);
  if(!items.length)return null;
  const total=items.reduce((s,p)=>s+p.value,0);
  return<div style={{...TIP_STYLE,padding:"8px 12px"}}>
    <div style={{fontWeight:600,marginBottom:4}}>{label}</div>
    {items.map(p=><div key={p.dataKey} style={{color:p.color}}>{p.name+": ฿"+fmt(p.value)}</div>)}
    {items.length>1&&<div style={{borderTop:"1px solid var(--line)",marginTop:4,paddingTop:4,fontWeight:600}}>{"รวม: ฿"+fmt(total)}</div>}
  </div>;
}

export default function CompareReport({products,sales,cats}){
  const now=new Date();
  const def=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  const[selMonth,setSelMonth]=useState(def);
  const prevMonth=getPrev(selMonth);

  const prodMap=useMemo(()=>{const m={};products.forEach(p=>m[p.id]=p);return m;},[products]);
  const catMap=useMemo(()=>{const m={};(cats||[]).forEach(c=>m[c.id]=c.name);return m;},[cats]);

  const calc=m=>{
    const sos=sales.filter(s=>(s.date||"").startsWith(m));
    let revenue=0;
    sos.forEach(so=>{revenue+=so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0);});
    return{revenue,count:sos.length};
  };

  const curr=calc(selMonth);const prev=calc(prevMonth);

  const rows=[
    {label:"จำนวน SO (รายการ)",a:curr.count,b:prev.count,currency:false},
    {label:"ยอดขาย",a:curr.revenue,b:prev.revenue,currency:true},
  ];

  const{chartData,catKeys}=useMemo(()=>{
    const allCats={};
    [prevMonth,selMonth].forEach(m=>{
      sales.filter(s=>(s.date||"").startsWith(m)).forEach(so=>so.items.forEach(i=>{
        const pr=prodMap[i.productId];if(!pr)return;
        const catName=catMap[pr.categoryId]||"ไม่ระบุ";
        allCats[catName]=(allCats[catName]||0)+i.qty*i.price;
      }));
    });
    const catKeys=Object.entries(allCats).sort((a,b)=>b[1]-a[1]).map(([n])=>n);
    const buildRow=(m,label)=>{
      const row={name:label};
      catKeys.forEach(c=>row[c]=0);
      sales.filter(s=>(s.date||"").startsWith(m)).forEach(so=>so.items.forEach(i=>{
        const pr=prodMap[i.productId];if(!pr)return;
        const catName=catMap[pr.categoryId]||"ไม่ระบุ";
        row[catName]=(row[catName]||0)+i.qty*i.price;
      }));
      return row;
    };
    return{chartData:[buildRow(prevMonth,mLabel(prevMonth)),buildRow(selMonth,mLabel(selMonth))],catKeys};
  },[sales,prodMap,catMap,prevMonth,selMonth]);

  return<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div style={{fontWeight:600,fontSize:15}}>เปรียบเทียบรายเดือน</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,color:"var(--dim)"}}>เดือนที่เลือก:</span>
        <input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{...IB,width:"auto",padding:"6px 10px"}}/>
      </div>
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8,overflow:"hidden",fontSize:13}}>
        <thead>
          <tr style={{background:"var(--bg)"}}>
            <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"var(--dim)",borderBottom:"1px solid var(--line)"}}>รายการ</th>
            <th style={{padding:"10px 14px",textAlign:"right",fontWeight:400,color:"var(--faint)",borderBottom:"1px solid var(--line)"}}>{mLabel(prevMonth)}<span style={{fontSize:11,marginLeft:4}}>(เดือนก่อน)</span></th>
            <th style={{padding:"10px 14px",textAlign:"right",fontWeight:600,color:"var(--text)",borderBottom:"1px solid var(--line)"}}>{mLabel(selMonth)}<span style={{fontSize:11,fontWeight:400,color:"var(--faint)",marginLeft:4}}>(เดือนที่เลือก)</span></th>
            <th style={{padding:"10px 14px",textAlign:"right",fontWeight:600,color:"var(--dim)",borderBottom:"1px solid var(--line)"}}>เปลี่ยนแปลง</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=><tr key={r.label} style={{borderBottom:"0.5px solid var(--line)"}}>
            <td style={{padding:"12px 14px",color:"var(--dim)"}}>{r.label}</td>
            <td style={{padding:"12px 14px",textAlign:"right",color:"var(--faint)"}}>{r.currency?"฿"+fmt(r.b):r.b}</td>
            <td style={{padding:"12px 14px",textAlign:"right",fontWeight:600}}>{r.currency?"฿"+fmt(r.a):r.a}</td>
            <td style={{padding:"12px 14px",textAlign:"right"}}><Delta a={r.a} b={r.b}/></td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <div style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8,padding:"1rem",marginTop:16}}>
      <div style={{fontWeight:500,fontSize:13,color:"var(--dim)",marginBottom:8}}>ยอดขายแบ่งตามหมวดสินค้า</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{top:5,right:20,left:10,bottom:5}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/>
          <XAxis dataKey="name" tick={{fontSize:12,fill:"var(--dim)"}}/>
          <YAxis tick={{fontSize:11,fill:"var(--dim)"}} tickFormatter={v=>v>=1000?Math.round(v/1000)+"k":v}/>
          <Tooltip content={<Tip/>}/>
          <Legend wrapperStyle={{fontSize:12}}/>
          {catKeys.map((cat,i)=><Bar key={cat} dataKey={cat} stackId="cat" fill={COLORS[i%COLORS.length]}/>)}
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div style={{marginTop:10,fontSize:12,color:"var(--faint)"}}>* ยอดขาย = ราคาขาย×จำนวน−ส่วนลด</div>
  </div>;
}

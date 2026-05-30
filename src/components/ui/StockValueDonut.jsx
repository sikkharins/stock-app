// StockValueDonut.jsx — interactive stock-value breakdown
// Drop into: src/components/ui/StockValueDonut.jsx
// Usage in Dashboard.jsx:
//   import StockValueDonut from "./ui/StockValueDonut.jsx";
//   <StockValueDonut products={products} cats={cats} pN={pN} />
//
// No new dependencies. Reads stock value = stock × cost, grouped by category & brand.

import { useState, useEffect, useRef } from "react";

const fmt = (n) => Math.round(n).toLocaleString("en-US");

// Palette — reuse your STOCK colors or these
const COLORS = ["#3b82f6","#34d399","#f59e0b","#ef4444","#a78bfa","#ec4899","#f97316","#6b7280","#14b8a6","#eab308"];

function polar(cx, cy, r, deg){ const a=(deg-90)*Math.PI/180; return [cx+r*Math.cos(a), cy+r*Math.sin(a)]; }
function arcPath(cx, cy, rO, rI, a0, a1){
  const [sx,sy]=polar(cx,cy,rO,a1), [ex,ey]=polar(cx,cy,rO,a0);
  const [ix,iy]=polar(cx,cy,rI,a0), [jx,jy]=polar(cx,cy,rI,a1);
  const large=(a1-a0)>180?1:0;
  return `M ${sx} ${sy} A ${rO} ${rO} 0 ${large} 0 ${ex} ${ey} L ${ix} ${iy} A ${rI} ${rI} 0 ${large} 1 ${jx} ${jy} Z`;
}
function useCountUp(target, dur, dep){
  const [v,setV]=useState(0);
  useEffect(()=>{ let raf,t0; const ease=t=>1-Math.pow(1-t,3);
    const step=ts=>{ if(!t0)t0=ts; const p=Math.min(1,(ts-t0)/dur); setV(target*ease(p)); if(p<1)raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf);
  },[target,dep]); return v;
}

// Build grouped breakdown from real products
function buildData(products, cats, mode){
  const groups = {};
  products.forEach(p=>{
    const val = (p.stock||0) * (p.price||0);
    if (val<=0) return;
    let key, name;
    if (mode==="brand"){ key=p.brand||"ไม่ระบุ"; name=key; }
    else { const c=cats.find(c=>c.id===p.categoryId); key=String(p.categoryId||"0"); name=c?c.name:"อื่นๆ"; }
    if (!groups[key]) groups[key]={ key, name, value:0 };
    groups[key].value += val;
  });
  let arr = Object.values(groups).sort((a,b)=>b.value-a.value);
  // collapse tail into "อื่นๆ" if many
  if (arr.length>8){
    const head=arr.slice(0,7), tail=arr.slice(7);
    const sum=tail.reduce((s,x)=>s+x.value,0);
    arr=[...head, { key:"__other", name:`อื่นๆ (${tail.length} รายการ)`, value:sum }];
  }
  return arr.map((d,i)=>({ ...d, color:COLORS[i%COLORS.length] }));
}

// Build brand → subcategory breakdown (exported for Products page)
export function buildBrandSubData(products, cats){
  const brands = {};
  products.forEach(p=>{
    const val = (p.stock||0) * (p.price||0);
    if (val<=0) return;
    const brand = p.brand || "ไม่ระบุ";
    if (!brands[brand]) brands[brand] = { name: brand, total: 0, subs: {} };
    brands[brand].total += val;
    // find subcategory name
    let subName = "ไม่ระบุ";
    const cat = cats.find(c => c.id === p.categoryId);
    if (cat && cat.subs) {
      const sub = cat.subs.find(s => s.id === p.subcategoryId);
      if (sub) subName = cat.name + " › " + sub.name;
      else subName = cat.name;
    } else if (cat) { subName = cat.name; }
    const subKey = String(p.categoryId||0) + "-" + String(p.subcategoryId||0);
    if (!brands[brand].subs[subKey]) brands[brand].subs[subKey] = { name: subName, value: 0, items: 0 };
    brands[brand].subs[subKey].value += val;
    brands[brand].subs[subKey].items += 1;
  });
  return Object.values(brands).sort((a,b) => b.total - a.total).map((b,i) => ({
    ...b, color: COLORS[i % COLORS.length],
    subs: Object.values(b.subs).sort((a,b) => b.value - a.value)
  }));
}

export default function StockValueDonut({ products, cats, theme="dark" }){
  const [mode,setMode]=useState("cat");
  const [active,setActive]=useState(null);
  const [pinned,setPinned]=useState(null);
  const pillRef=useRef(null), segRef=useRef(null);

  const data = buildData(products, cats, mode);
  const TOTAL = data.reduce((s,d)=>s+d.value,0) || 1;
  const pctOf = v => v/TOTAL*100;

  useEffect(()=>{
    const seg=segRef.current; if(!seg)return;
    const btns=[...seg.querySelectorAll("button")];
    const b=btns[mode==="cat"?0:1], pill=pillRef.current;
    if(b&&pill){ pill.style.left=b.offsetLeft+"px"; pill.style.width=b.offsetWidth+"px"; }
  },[mode]);
  useEffect(()=>{ setActive(null); setPinned(null); },[mode]);
  useEffect(()=>{ const h=e=>{ if(e.key==="Escape"){setPinned(null);setActive(null);} };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[]);

  const CX=200,CY=200,RO=170,RI=112,GAP=2;
  const [prog,setProg]=useState(0);
  useEffect(()=>{ let raf,t0; const ease=t=>1-Math.pow(1-t,4); setProg(0);
    const step=ts=>{ if(!t0)t0=ts; const p=Math.min(1,(ts-t0)/1100); setProg(ease(p)); if(p<1)raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf); },[mode]);

  let acc=0;
  const segs=data.map(d=>{ const span=pctOf(d.value)/100*360; const s={...d,a0:acc,a1:acc+span,mid:acc+span/2}; acc+=span; return s; });
  const focusKey=pinned||active;
  const focused=focusKey?segs.find(s=>s.key===focusKey):null;
  const centerVal=useCountUp(focused?focused.value:TOTAL,700,(focused?focused.key:"all")+mode);
  const onPin=k=>setPinned(p=>p===k?null:k);
  const maxV=Math.max(...data.map(d=>d.value),1);

  const DARK={ panel:"#141821", panelGrad:"#0f1218", panel2:"#1a1f2a", line:"#222835", line2:"#2e3543", text:"#eef1f6", dim:"#9aa3b2", faint:"#5e6677", cyan:"#22d3ee", track:"rgba(255,255,255,0.04)", onAccent:"#04141c" };
  const LIGHT={ panel:"#ffffff", panelGrad:"#f7f8fa", panel2:"#f2f4f7", line:"#e5e7eb", line2:"#d4d8e0", text:"#1d1d1f", dim:"#6e6e73", faint:"#9aa0a8", cyan:"#0071e3", track:"rgba(0,0,0,0.05)", onAccent:"#ffffff" };
  const C = theme==="light" ? LIGHT : DARK;
  const accentGrad = theme==="light" ? "linear-gradient(135deg,#0a84ff,#5ac8fa)" : `linear-gradient(135deg,${C.cyan},#3b82f6)`;

  return (
    <div style={{background:`linear-gradient(180deg,${C.panel},${C.panelGrad})`,border:`1px solid ${C.line}`,borderRadius:18,padding:"22px 24px",color:C.text,fontFamily:"'Inter','Noto Sans Thai',system-ui,sans-serif",boxShadow:theme==="light"?"0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.04)":"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:700,letterSpacing:"-0.01em"}}>สัดส่วนมูลค่าสต็อก</div>
        <div style={{marginLeft:"auto"}}>
          <div ref={segRef} style={{display:"flex",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:10,padding:3,position:"relative"}}>
            <div ref={pillRef} style={{position:"absolute",top:3,bottom:3,borderRadius:7,background:accentGrad,transition:"left .35s cubic-bezier(.34,1.56,.64,1),width .35s",zIndex:0}}/>
            <button onClick={()=>setMode("cat")} style={{position:"relative",zIndex:1,padding:"6px 14px",border:0,background:"transparent",color:mode==="cat"?C.onAccent:C.dim,font:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer",borderRadius:7}}>ตามหมวด</button>
            <button onClick={()=>setMode("brand")} style={{position:"relative",zIndex:1,padding:"6px 14px",border:0,background:"transparent",color:mode==="brand"?C.onAccent:C.dim,font:"inherit",fontSize:12.5,fontWeight:600,cursor:"pointer",borderRadius:7}}>ตามยี่ห้อ</button>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"340px 1fr",gap:28,alignItems:"center"}} className="svd-row">
        <div style={{position:"relative",width:340,height:340,margin:"0 auto"}}>
          <svg viewBox="0 0 400 400" style={{display:"block",width:"100%",height:"100%",overflow:"visible"}}>
            <defs>{segs.map(s=>(<filter key={s.key} id={"svdg-"+s.key} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>))}</defs>
            <circle cx={CX} cy={CY} r={(RO+RI)/2} fill="none" stroke={C.track} strokeWidth={RO-RI}/>
            {segs.map(s=>{
              const reveal=Math.max(0,Math.min(1,(prog*360-s.a0)/(s.a1-s.a0))); if(reveal<=0)return null;
              const a1=s.a0+(s.a1-s.a0)*reveal, isActive=focusKey===s.key, isDim=focusKey&&!isActive;
              const [mx,my]=polar(0,0,isActive?14:0,s.mid);
              return <path key={s.key} d={arcPath(CX,CY,RO,RI,s.a0+GAP/2,Math.max(s.a0+GAP/2,a1-GAP/2))} fill={s.color}
                style={{cursor:"pointer",transition:"transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s,filter .25s",transform:`translate(${mx}px,${my}px)`,opacity:isDim?0.32:1,filter:isActive?`url(#svdg-${s.key})`:"none"}}
                onMouseEnter={()=>setActive(s.key)} onMouseLeave={()=>setActive(null)} onClick={()=>onPin(s.key)}/>;
            })}
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none",textAlign:"center"}}>
            <div style={{fontSize:11,color:C.faint,letterSpacing:"0.14em",textTransform:"uppercase",fontWeight:600}}>{focused?(pinned?"📌 ":"")+focused.name:"รวมทั้งหมด"}</div>
            <div style={{fontSize:30,fontWeight:700,letterSpacing:"-0.03em",marginTop:4,fontVariantNumeric:"tabular-nums"}}><span style={{color:C.cyan,fontSize:17}}>฿</span>{fmt(centerVal)}</div>
            {focused
              ? <div style={{fontSize:13,fontWeight:600,marginTop:6,padding:"2px 10px",borderRadius:99,background:C.panel2,border:`1px solid ${focused.color}55`,color:focused.color}}>{pctOf(focused.value).toFixed(1)}%</div>
              : <div style={{fontSize:12.5,color:C.dim,marginTop:6}}>{data.length} {mode==="cat"?"หมวด":"ยี่ห้อ"}</div>}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          {data.map(d=>{
            const isActive=focusKey===d.key,isDim=focusKey&&!isActive;
            return <div key={d.key} onMouseEnter={()=>setActive(d.key)} onMouseLeave={()=>setActive(null)} onClick={()=>onPin(d.key)}
              style={{display:"grid",gridTemplateColumns:"14px 1fr auto auto",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:10,cursor:"pointer",border:`1px solid ${isActive?C.line2:"transparent"}`,background:isActive?C.panel2:"transparent",opacity:isDim?0.4:1,transition:"all .18s",color:d.color}}>
              <span style={{width:12,height:12,borderRadius:4,background:d.color,boxShadow:isActive?`0 0 14px 1px ${d.color}`:"none",transition:"box-shadow .25s"}}/>
              <span style={{fontSize:13.5,fontWeight:500,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.name}</span>
              <span style={{fontSize:12.5,color:C.dim,textAlign:"right",minWidth:52,fontVariantNumeric:"tabular-nums"}}>{pctOf(d.value).toFixed(1)}%</span>
              <span style={{fontSize:13.5,fontWeight:600,color:C.text,textAlign:"right",minWidth:110,fontVariantNumeric:"tabular-nums"}}>฿{fmt(d.value)}</span>
              <span style={{gridColumn:"2 / 5",height:3,background:C.panel2,borderRadius:99,overflow:"hidden",marginTop:2}}>
                <i style={{display:"block",height:"100%",borderRadius:99,width:(d.value/maxV*100)+"%",background:d.color,transition:"width .8s cubic-bezier(.22,1,.36,1)"}}/>
              </span>
            </div>;
          })}
        </div>
      </div>

    </div>
  );
}

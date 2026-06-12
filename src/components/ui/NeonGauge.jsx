// NeonGauge — port ของ design จาก Sales Target Gauge.html (Claude Design)
// 3 variants: ClassicTicks / GradientSweep / Segmented — share geometry
// viewBox 480×296 และ math เหมือนกัน ขอ ID เฉพาะ instance (uid) เพื่อกัน filter ชนกัน

const VB={w:480,h:296,cx:240,cy:252};

const THEMES={
  // เพิ่ม saturation / ลด lightness ของ reference: pink ลึก, yellow→amber, cyan ลึก, green jade
  reference:[[0.00,[235,40,110]],[0.34,[255,170,30]],[0.62,[40,170,240]],[1.00,[40,210,125]]],
  cyan:[[0.00,[10,55,80]],[0.45,[28,130,180]],[1.00,[70,210,240]]],
  traffic:[[0.00,[230,45,60]],[0.50,[245,175,40]],[1.00,[55,210,120]]],
};

const lerp=(a,b,t)=>a+(b-a)*t;

export function colorAt(theme,t){
  const stops=THEMES[theme]||THEMES.reference;
  t=Math.max(0,Math.min(1,t));
  for(let i=0;i<stops.length-1;i++){
    const[s0,c0]=stops[i],[s1,c1]=stops[i+1];
    if(t>=s0&&t<=s1){
      const k=(t-s0)/(s1-s0||1);
      return"rgb("+Math.round(lerp(c0[0],c1[0],k))+","+Math.round(lerp(c0[1],c1[1],k))+","+Math.round(lerp(c0[2],c1[2],k))+")";
    }
  }
  const last=stops[stops.length-1][1];
  return"rgb("+last[0]+","+last[1]+","+last[2]+")";
}

// fraction 0..1 → จุดบน top semicircle
function polar(r,f){
  if(!Number.isFinite(f))f=0;
  const theta=Math.PI*(1-f);
  return{x:VB.cx+r*Math.cos(theta),y:VB.cy-r*Math.sin(theta)};
}

function arcPath(r,f0,f1){
  const a=polar(r,f0),b=polar(r,f1);
  const large=(f1-f0)>0.5?1:0;
  return"M "+a.x+" "+a.y+" A "+r+" "+r+" 0 "+large+" 1 "+b.x+" "+b.y;
}

function NeonDefs({uid,glow,theme}){
  const std=(glow/100)*5.2+0.4;
  const stops=THEMES[theme]||THEMES.reference;
  return<defs>
    <filter id={uid+"-neon"} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation={std} result="b1"/>
      <feGaussianBlur stdDeviation={std*2.3} result="b2"/>
      <feMerge>
        <feMergeNode in="b2"/>
        <feMergeNode in="b1"/>
        <feMergeNode in="b1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id={uid+"-soft"} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation={std*1.4} result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id={uid+"-grad"} x1="0%" y1="0%" x2="100%" y2="0%">
      {stops.map(([s,c],i)=><stop key={i} offset={(s*100)+"%"} stopColor={"rgb("+c[0]+","+c[1]+","+c[2]+")"}/>)}
    </linearGradient>
  </defs>;
}

function CenterReadout({value,sublabel,color,glow,big}){
  return<g style={{filter:"drop-shadow(0 0 "+(glow/100*14+2)+"px "+color+")"}}>
    <text x={VB.cx} y={VB.cy-(big?26:18)} textAnchor="middle"
      fontSize={big?76:64} fontWeight="600" fill={color}
      fontFamily="inherit" letterSpacing="-1">
      {Math.round(value)}<tspan fontSize={big?34:28} dy="-2" fill={color} opacity="0.85">%</tspan>
    </text>
    {sublabel?<text x={VB.cx} y={VB.cy+(big?16:14)} textAnchor="middle"
      fontSize="16" fontWeight="500" fill="#aeb7c2"
      fontFamily="inherit" letterSpacing="0.5"
      style={{textTransform:"uppercase"}}>{sublabel}</text>:null}
  </g>;
}

function TargetMarker({f,r,glow}){
  const tip=polar(r-6,f);
  const theta=180*(1-f);
  const labelPt=polar(r+20,f);
  return<g style={{filter:"drop-shadow(0 0 "+(glow/100*8+2)+"px #ffffff)"}}>
    <g transform={"translate("+tip.x+","+tip.y+") rotate("+(-theta+90)+")"}>
      <path d="M 0 0 L 7 -12 L -7 -12 Z" fill="#ffffff"/>
    </g>
    <text x={labelPt.x} y={labelPt.y} textAnchor="middle"
      dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#ffffff"
      fontFamily="inherit" letterSpacing="0.5"
      style={{textTransform:"uppercase"}}>GOAL</text>
  </g>;
}

// GhostMarker — chevron + label "เดือนก่อน" สีซีดเพื่อเทียบ % กับเดือนปัจจุบัน
function GhostMarker({f,r}){
  if(!Number.isFinite(f))return null;
  const cf=Math.max(0,Math.min(1,f));
  const tip=polar(r-4,cf);
  const theta=180*(1-cf);
  const labelPt=polar(r+18,cf);
  return<g pointerEvents="none" opacity="0.5">
    <g transform={"translate("+tip.x+","+tip.y+") rotate("+(-theta+90)+")"}>
      <path d="M 0 0 L 5 -9 L -5 -9 Z" fill="#aeb7c2"/>
    </g>
    <text x={labelPt.x} y={labelPt.y} textAnchor="middle"
      dominantBaseline="middle" fontSize="9" fontWeight="500" fill="#aeb7c2"
      fontFamily="inherit" letterSpacing="0.5"
      style={{textTransform:"uppercase"}}>เดือนก่อน</text>
  </g>;
}

function ClassicGauge({uid,value,target,glow,theme,sublabel,showTarget,ghostValue}){
  const ticks=[];
  for(let i=0;i<=100;i++){
    const f=i/100;
    const major=i%10===0;
    const med=i%5===0;
    const oR=major?192:med?188:184;
    const iR=major?162:med?170:174;
    const a=polar(oR,f),b=polar(iR,f);
    ticks.push(<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
      stroke={colorAt(theme,f)} strokeWidth={major?3:med?2.4:1.6}
      strokeLinecap="round" opacity={major?1:med?0.92:0.7}/>);
  }
  const labels=[];
  for(let i=0;i<=100;i+=10){
    const f=i/100;
    const p=polar(214,f);
    const rot=(f-0.5)*156;
    labels.push(<text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
      fontSize="17" fontWeight="500" fill={colorAt(theme,f)}
      fontFamily="inherit"
      transform={"rotate("+rot+" "+p.x+" "+p.y+")"}>{i}</text>);
  }
  const vf=value/100;
  const pt=polar(150,vf);
  const ptheta=180*(1-vf);
  const vcolor=colorAt(theme,vf);
  const over=value>=target;
  const flash=useMilestone(value);
  return<svg viewBox={"0 0 "+VB.w+" "+VB.h} width="100%" style={Object.assign({display:"block"},over?{animation:"pulse-"+uid+" 1.6s ease-in-out infinite"}:{})}>
    <PulseStyle over={over} uid={uid} color={vcolor} glow={glow}/>
    <NeonDefs uid={uid} glow={glow} theme={theme}/>
    <g filter={"url(#"+uid+"-neon)"}>{ticks}</g>
    <g style={{filter:"drop-shadow(0 0 "+(glow/100*6)+"px currentColor)"}}>{labels}</g>
    <g filter={"url(#"+uid+"-soft)"}>
      <g transform={"translate("+pt.x+","+pt.y+") rotate("+(-ptheta+90)+")"} fill={vcolor}>
        <path d="M 0 -13 L 11 6 L -11 6 Z"/>
      </g>
    </g>
    {Number.isFinite(ghostValue)&&<GhostMarker f={ghostValue/100} r={200}/>}
    {showTarget&&<TargetMarker f={target/100} r={200} glow={glow}/>}
    <CenterReadout value={value} sublabel={sublabel} color={vcolor} glow={glow} big/>
    {flash&&flash.kind==="ring"&&<MilestoneRing key={flash.ts} color={vcolor}/>}
    {flash&&flash.kind==="confetti"&&<MilestoneConfetti key={flash.ts} theme={theme}/>}
  </svg>;
}

function SweepGauge({uid,value,target,glow,theme,sublabel,showTarget,ghostValue}){
  const R=184,W=24;
  const vf=value/100;
  const tip=polar(R,vf);
  const vcolor=colorAt(theme,vf);
  const fullLen=Math.PI*R;
  const litLen=fullLen*vf;
  const over=value>=target;
  const flash=useMilestone(value);
  return<svg viewBox={"0 0 "+VB.w+" "+VB.h} width="100%" style={Object.assign({display:"block"},over?{animation:"pulse-"+uid+" 1.6s ease-in-out infinite"}:{})}>
    <PulseStyle over={over} uid={uid} color={vcolor} glow={glow}/>
    <NeonDefs uid={uid} glow={glow} theme={theme}/>
    <path d={arcPath(R,0,1)} fill="none" stroke="#1d2530" strokeWidth={W} strokeLinecap="round"/>
    <path d={arcPath(R,0,1)} fill="none" stroke="#2a3340" strokeWidth={W-12} strokeLinecap="round" opacity="0.5"/>
    <g filter={"url(#"+uid+"-neon)"}>
      <path d={arcPath(R,0,1)} fill="none" stroke={"url(#"+uid+"-grad)"}
        strokeWidth={W} strokeLinecap="round"
        strokeDasharray={litLen+" "+fullLen}/>
    </g>
    <g filter={"url(#"+uid+"-neon)"}>
      <circle cx={tip.x} cy={tip.y} r="9" fill="#0a0d12" stroke={vcolor} strokeWidth="4"/>
    </g>
    <text x={polar(R,0).x-4} y={polar(R,0).y+22} textAnchor="middle"
      fontSize="14" fill="#5c6675" fontFamily="inherit">0</text>
    <text x={polar(R,1).x+4} y={polar(R,1).y+22} textAnchor="middle"
      fontSize="14" fill="#5c6675" fontFamily="inherit">100</text>
    {Number.isFinite(ghostValue)&&<GhostMarker f={ghostValue/100} r={R+W/2+6}/>}
    {showTarget&&<TargetMarker f={target/100} r={R+W/2+6} glow={glow}/>}
    <CenterReadout value={value} sublabel={sublabel} color={vcolor} glow={glow} big/>
    {flash&&flash.kind==="ring"&&<MilestoneRing key={flash.ts} color={vcolor}/>}
    {flash&&flash.kind==="confetti"&&<MilestoneConfetti key={flash.ts} theme={theme}/>}
  </svg>;
}

function SegmentGauge({uid,value,target,glow,theme,sublabel,showTarget,ghostValue}){
  const R=182,W=26;
  const N=40;
  const gap=0.0035;
  const seg=1/N;
  const litCount=(value/100)*N;
  const segs=[];
  for(let i=0;i<N;i++){
    const f0=i*seg+gap,f1=(i+1)*seg-gap;
    const mid=(i+0.5)/N;
    const on=i<litCount;
    const col=colorAt(theme,mid);
    segs.push(<path key={i} d={arcPath(R,f0,f1)} fill="none"
      stroke={on?col:"#1b222c"} strokeWidth={W} strokeLinecap="butt"
      opacity={on?1:0.85}/>);
  }
  const litSegs=segs.filter((_,i)=>i<litCount);
  const vf=value/100;
  const vcolor=colorAt(theme,vf);
  const over=value>=target;
  const flash=useMilestone(value);
  return<svg viewBox={"0 0 "+VB.w+" "+VB.h} width="100%" style={Object.assign({display:"block"},over?{animation:"pulse-"+uid+" 1.6s ease-in-out infinite"}:{})}>
    <PulseStyle over={over} uid={uid} color={vcolor} glow={glow}/>
    <NeonDefs uid={uid} glow={glow} theme={theme}/>
    {segs}
    <g filter={"url(#"+uid+"-neon)"}>{litSegs}</g>
    <text x={polar(R,0).x-4} y={polar(R,0).y+24} textAnchor="middle"
      fontSize="14" fill="#5c6675" fontFamily="inherit">0</text>
    <text x={polar(R,1).x+4} y={polar(R,1).y+24} textAnchor="middle"
      fontSize="14" fill="#5c6675" fontFamily="inherit">100</text>
    {Number.isFinite(ghostValue)&&<GhostMarker f={ghostValue/100} r={R+W/2+6}/>}
    {showTarget&&<TargetMarker f={target/100} r={R+W/2+6} glow={glow}/>}
    <CenterReadout value={value} sublabel={sublabel} color={vcolor} glow={glow} big/>
    {flash&&flash.kind==="ring"&&<MilestoneRing key={flash.ts} color={vcolor}/>}
    {flash&&flash.kind==="confetti"&&<MilestoneConfetti key={flash.ts} theme={theme}/>}
  </svg>;
}

const VARIANT_MAP={classic:ClassicGauge,sweep:SweepGauge,segment:SegmentGauge};
const FLAME_RADIUS={classic:178,sweep:184,segment:182};

export const GAUGE_VARIANTS=[
  {id:"classic",label:"Classic"},
  {id:"sweep",label:"Sweep"},
  {id:"segment",label:"Segment"},
];

// heatTier — 0 ปกติ, 1 ร้อนแรง (≥t1), 2 ไฟลุก (≥t2)
export function heatTier(value,t1=50,t2=75){
  if(value<t1)return 0;
  if(value<t2)return 1;
  return 2;
}

// tier ดูจาก t1/t2 → style ขอบ + เงาเพิ่มที่ panel การ์ด
export function heatCardStyle(tier){
  if(tier===2)return{borderColor:"rgba(255,140,60,0.35)",boxShadow:"0 0 40px rgba(255,90,30,0.12)"};
  if(tier===1)return{borderColor:"rgba(255,190,90,0.20)"};
  return{};
}

// HeatBadge — pill "ร้อนแรง" / "ไฟลุก!" ตาม tier (ใส่ใน header การ์ด)
function injectHeatPulseCSS(){
  if(typeof document==="undefined")return;
  if(document.getElementById("heatpulse-css"))return;
  const s=document.createElement("style");
  s.id="heatpulse-css";
  s.textContent="@keyframes heatpulse{0%,100%{box-shadow:0 0 16px rgba(255,110,30,0.55) inset,0 0 12px rgba(255,90,30,0.45)}50%{box-shadow:0 0 22px rgba(255,140,40,0.85) inset,0 0 20px rgba(255,110,30,0.7)}}";
  document.head.appendChild(s);
}
export function HeatBadge({tier}){
  useEffect(()=>{injectHeatPulseCSS();},[]);
  if(!tier)return null;
  const hot=tier===2;
  return<span style={{
    fontSize:11,fontWeight:700,letterSpacing:0.8,
    padding:"3px 9px",borderRadius:999,
    color:hot?"#ffe08a":"#ffd27a",
    background:hot?"rgba(255,120,40,0.16)":"rgba(255,180,80,0.12)",
    textTransform:"uppercase",
    boxShadow:hot?"0 0 16px rgba(255,110,30,0.6) inset,0 0 14px rgba(255,90,30,0.5)":"0 0 12px rgba(255,170,60,0.35) inset,0 0 8px rgba(255,170,60,0.25)",
    animation:hot?"heatpulse 1.1s ease-in-out infinite":undefined,
    display:"inline-flex",alignItems:"center",gap:4,
  }}>{hot?"ไฟลุก! 🔥":"ร้อนแรง 🔥"}</span>;
}

// FlameCanvas — canvas particle overlay ของลิ้นไฟ + สายฟ้า (port จาก v2 design)
// vf 0..1 ตำแหน่งบน arc, heat 0..1 ความแรง
function polarVB(r,f){
  if(!Number.isFinite(f))f=0;
  const theta=Math.PI*(1-f);
  return{x:VB.cx+r*Math.cos(theta),y:VB.cy-r*Math.sin(theta)};
}
function heatOf(value,t1,t2){
  if(value<t1)return 0;
  if(value<t2)return 0.34;
  return 0.6+(value-t2)/Math.max(1,100-t2)*0.4;
}
function FlameCanvas({value,theme,t1=50,t2=75,radius=180}){
  const ref=useRef(null);
  const env=useRef({parts:[],bolts:[],W:0,H:0,dpr:1,tier:0,value,theme,t1,t2,radius});
  Object.assign(env.current,{value,theme,t1,t2,radius});
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");
    const e=env.current;
    let stopped=false;
    const resize=()=>{
      const r=canvas.getBoundingClientRect();
      const dpr=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.max(1,Math.round(r.width*dpr));
      canvas.height=Math.max(1,Math.round(r.height*dpr));
      e.W=r.width;e.H=r.height;e.dpr=dpr;
    };
    const ro=new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const spawn=(f,heat)=>{
      const p=polarVB(e.radius,f);
      const m=colorAt(e.theme,f).match(/\d+/g);
      e.parts.push({
        x:p.x+(Math.random()-0.5)*6,
        y:p.y+(Math.random()-0.5)*3,
        vx:(Math.random()-0.5)*7,
        vy:-(24+heat*70+Math.random()*26),
        life:0,max:0.5+Math.random()*0.4+heat*0.3,
        w:(3.2+Math.random()*2)*(0.7+heat),
        h:10+Math.random()*8+heat*(16+Math.random()*34),
        ph:Math.random()*6.28,sw:3+Math.random()*3,
        r:+m[0],g:+m[1],b:+m[2],
      });
    };
    const spark=(f)=>{
      const p=polarVB(e.radius,f);
      e.parts.push({spark:true,x:p.x,y:p.y,
        vx:(Math.random()-0.5)*70,vy:-(70+Math.random()*130),
        life:0,max:0.5+Math.random()*0.5,size:1.5});
    };
    const jag=(A,B,segs,amp)=>{
      const dx=B.x-A.x,dy=B.y-A.y;
      const len=Math.hypot(dx,dy)||1;
      const nx=-dy/len,ny=dx/len;
      const pts=[];
      for(let i=0;i<=segs;i++){
        const t=i/segs;
        const win=Math.sin(t*Math.PI);
        const off=(i===0||i===segs)?0:(Math.random()-0.5)*amp*(0.45+win);
        pts.push({x:A.x+dx*t+nx*off,y:A.y+dy*t+ny*off});
      }
      return pts;
    };
    const spawnBolt=()=>{
      const vf=e.value/100;
      let fa=vf*(0.05+0.9*Math.random());
      let fb=vf*(0.05+0.9*Math.random());
      if(Math.abs(fa-fb)<0.14)fb=Math.min(vf,fa+0.2+Math.random()*0.22);
      const A=polarVB(e.radius+6,fa),B=polarVB(e.radius+6,fb);
      const segs=9+Math.floor(Math.random()*6);
      const main=jag(A,B,segs,16+Math.random()*14);
      const lift=26+Math.random()*34;
      for(let i=1;i<main.length-1;i++){main[i].y-=lift*Math.sin((i/segs)*Math.PI);}
      const branches=[];
      const nb=1+Math.floor(Math.random()*2);
      for(let b=0;b<nb;b++){
        const idx=1+Math.floor(Math.random()*(main.length-2));
        const root=main[idx];
        const end={x:root.x+(Math.random()-0.5)*52,y:root.y-18-Math.random()*34};
        branches.push(jag(root,end,4+Math.floor(Math.random()*3),12));
      }
      e.bolts.push({main,branches,life:0,max:0.18+Math.random()*0.16});
    };
    let last=performance.now();
    const tick=()=>{
      if(stopped)return;
      const now=performance.now();
      let dt=(now-last)/1000;last=now;
      if(dt>0.05)dt=0.05;
      const {W,H}=e;
      if(W&&H){
        const sx=W/VB.w,sy=H/VB.h;
        ctx.setTransform(e.dpr,0,0,e.dpr,0,0);
        ctx.clearRect(0,0,W,H);
        const vf=e.value/100;
        const heat=heatOf(e.value,e.t1,e.t2);
        const tier=e.value<e.t1?0:e.value<e.t2?1:2;
        // threshold-crossing burst
        if(tier>e.tier&&tier>0){
          const n=tier===2?28:16;
          for(let i=0;i<n;i++)spawn(vf*(0.1+0.9*Math.random()),heat+0.2);
          if(tier===2)for(let i=0;i<8;i++)spark(vf*Math.random());
        }
        e.tier=tier;
        // steady emission
        if(heat>0&&vf>0){
          let count=heat*46*vf*dt;
          while(count>0){
            if(count<1&&Math.random()>count)break;
            count--;
            spawn(vf*(0.1+0.9*Math.random()),heat);
          }
          if(heat>0.62&&Math.random()<heat*dt*14)spark(vf*(0.35+0.65*Math.random()));
        }
        // update + draw (additive)
        ctx.globalCompositeOperation="lighter";
        const parts=e.parts;
        if(parts.length>150)parts.splice(0,parts.length-150);
        const ts=now/1000;
        for(let i=parts.length-1;i>=0;i--){
          const p=parts[i];
          p.life+=dt;
          if(p.life>=p.max){parts.splice(i,1);continue;}
          const k=p.life/p.max;
          p.x+=p.vx*dt;p.y+=p.vy*dt;
          p.vy*=0.992;
          const cx=p.x*sx,cy=p.y*sy;
          if(p.spark){
            p.vy+=150*dt;
            const a=(1-k)*0.8;
            ctx.globalAlpha=a;
            ctx.fillStyle="#ffe7b0";
            ctx.beginPath();ctx.arc(cx,cy,1.5*sx,0,7);ctx.fill();
            continue;
          }
          const envV=Math.sin(Math.min(1,k*1.2)*Math.PI);
          const a=envV*(1-k*0.25);
          const hh=p.h*(0.5+envV)*sy;
          const ww=p.w*(0.5+0.6*envV)*sx;
          const sway=Math.sin(ts*p.sw+p.ph)*ww*0.9;
          const tipX=cx+sway,tipY=cy-hh;
          let g=ctx.createLinearGradient(cx,cy,tipX,tipY);
          g.addColorStop(0,"rgba(255,238,200,"+(a*0.8)+")");
          g.addColorStop(0.14,"rgba(255,190,80,"+(a*0.72)+")");
          g.addColorStop(0.42,"rgba("+p.r+","+p.g+","+p.b+","+(a*0.6)+")");
          g.addColorStop(0.8,"rgba("+p.r+","+p.g+","+p.b+","+(a*0.28)+")");
          g.addColorStop(1,"rgba("+p.r+","+p.g+","+p.b+",0)");
          ctx.fillStyle=g;
          ctx.beginPath();
          ctx.moveTo(cx-ww,cy);
          ctx.quadraticCurveTo(cx-ww*0.85,cy-hh*0.55,tipX,tipY);
          ctx.quadraticCurveTo(cx+ww*0.85,cy-hh*0.55,cx+ww,cy);
          ctx.quadraticCurveTo(cx,cy+ww*0.5,cx-ww,cy);
          ctx.closePath();
          ctx.fill();
          // inner hot core
          const hw=ww*0.5,hk=hh*0.45;
          const tipX2=cx+sway*0.6,tipY2=cy-hk;
          let gc=ctx.createLinearGradient(cx,cy,tipX2,tipY2);
          gc.addColorStop(0,"rgba(255,250,228,"+(a*0.7)+")");
          gc.addColorStop(0.55,"rgba(255,212,120,"+(a*0.4)+")");
          gc.addColorStop(1,"rgba(255,200,110,0)");
          ctx.fillStyle=gc;
          ctx.beginPath();
          ctx.moveTo(cx-hw,cy);
          ctx.quadraticCurveTo(cx-hw*0.8,cy-hk*0.55,tipX2,tipY2);
          ctx.quadraticCurveTo(cx+hw*0.8,cy-hk*0.55,cx+hw,cy);
          ctx.quadraticCurveTo(cx,cy+hw*0.5,cx-hw,cy);
          ctx.closePath();
          ctx.fill();
        }
        // lightning ที่ tier 2 — ยิ่งใกล้ 100% ยิ่งถี่
        if(tier===2){
          const rate=3.2+(e.value-e.t2)/Math.max(1,100-e.t2)*5;
          if(Math.random()<rate*dt+0.02){
            spawnBolt();
            if(Math.random()<0.45)spawnBolt();
          }
        }
        ctx.globalAlpha=1;
        const bolts=e.bolts;
        for(let i=bolts.length-1;i>=0;i--){
          const bo=bolts[i];
          bo.life+=dt;
          if(bo.life>=bo.max){bolts.splice(i,1);continue;}
          const bk=bo.life/bo.max;
          const fl=Math.random()<0.82?1:0.35;
          const a=(1-bk)*fl;
          const strokeAll=(lw,style,blur)=>{
            ctx.lineWidth=lw;ctx.strokeStyle=style;
            ctx.lineJoin="round";ctx.lineCap="round";
            ctx.shadowBlur=blur;ctx.shadowColor="rgba(120,205,255,"+a+")";
            ctx.beginPath();
            const m=bo.main;
            ctx.moveTo(m[0].x*sx,m[0].y*sy);
            for(let j=1;j<m.length;j++)ctx.lineTo(m[j].x*sx,m[j].y*sy);
            for(const br of bo.branches){
              ctx.moveTo(br[0].x*sx,br[0].y*sy);
              for(let j=1;j<br.length;j++)ctx.lineTo(br[j].x*sx,br[j].y*sy);
            }
            ctx.stroke();
          };
          strokeAll(11*sx,"rgba(80,170,255,"+(a*0.4)+")",20);
          strokeAll(5*sx,"rgba(150,220,255,"+(a*0.85)+")",10);
          strokeAll(2.2*sx,"rgba(248,253,255,"+a+")",2);
          const fn=bo.main[Math.floor(bo.main.length/2)];
          ctx.shadowBlur=14*sx;ctx.shadowColor="rgba(150,220,255,"+a+")";
          ctx.fillStyle="rgba(255,255,255,"+(a*0.9)+")";
          ctx.beginPath();ctx.arc(fn.x*sx,fn.y*sy,2.4*sx,0,7);ctx.fill();
        }
        ctx.shadowBlur=0;
        ctx.globalAlpha=1;
        ctx.globalCompositeOperation="source-over";
      }
    };
    const iv=setInterval(tick,33);
    return()=>{stopped=true;clearInterval(iv);ro.disconnect();};
  },[]);
  return<canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:3,mixBlendMode:"screen"}}/>;
}

// useEased — spring physics (Hooke + damping): พุ่งเลย target → เด้งกลับ → settle.
// stiff ดึงเข้า target, damp ลดความเร็ว (1-damp = friction factor).
// ใช้ setTimeout เพื่อทำงานต่อใน tab background ได้ (เผื่อ admin เปิดทิ้งไว้)
import { useState, useRef, useEffect, useMemo } from "react";
export function useEased(target,enabled=true){
  const safeTarget=Number.isFinite(target)?target:0;
  const[v,setV]=useState(enabled?0:safeTarget);
  const ref=useRef({pos:enabled?0:safeTarget,vel:0});
  const timer=useRef(0);
  useEffect(()=>{
    clearTimeout(timer.current);
    const stiff=0.14, damp=0.30;
    const step=()=>{
      const{pos,vel}=ref.current;
      const force=(safeTarget-pos)*stiff;
      const newVel=(vel+force)*(1-damp);
      const newPos=pos+newVel;
      if(Math.abs(newVel)<0.04&&Math.abs(safeTarget-newPos)<0.08){
        ref.current={pos:safeTarget,vel:0};
        setV(safeTarget);
        return;
      }
      ref.current={pos:newPos,vel:newVel};
      setV(newPos);
      timer.current=setTimeout(step,16);
    };
    timer.current=setTimeout(step,16);
    return()=>clearTimeout(timer.current);
  },[safeTarget]);
  return v;
}

// useRev — "คันเร่ง" สำหรับ gauge: กดค้าง → spring ขึ้นไปแตะ maxRev (= % ที่ทำได้)
// ปล่อย → spring ลงสู่ 0. คืน value (ค่าที่แสดง, clamp ≥0), holding, handlers (ติด div ครอบ)
// อนุญาต overshoot ด้านบน (สนุก), clamp ด้านล่างไม่ให้ติดลบ
export function useRev(maxRev){
  const[holding,setHolding]=useState(false);
  const safeMax=Math.min(100,Math.max(0,Number.isFinite(maxRev)?maxRev:0));
  const target=holding?safeMax:0;
  const raw=useEased(target,true);
  const value=Math.max(0,raw);
  const stop=()=>setHolding(false);
  const handlers={
    onPointerDown:(e)=>{e.preventDefault();setHolding(true);},
    onPointerUp:stop,
    onPointerCancel:stop,
    onPointerLeave:stop,
    style:{touchAction:"none",cursor:holding?"grabbing":"grab",userSelect:"none"},
  };
  return{value,holding,handlers};
}

// useMilestone — track crossings ของ 50/75/100 → return flash state {kind, value, ts}
// ใช้ lastValRef เพื่อจับเฉพาะ "เพิ่งข้าม" (ไม่ใช่ค่าสูงตั้งแต่แรก)
// re-arm อัตโนมัติเมื่อตกต่ำกว่า threshold-8
function useMilestone(value){
  const lastValRef=useRef(value);
  const firedRef=useRef(new Set());
  const[flash,setFlash]=useState(null);
  useEffect(()=>{
    for(const m of [100,75,50]){
      if(value>=m && lastValRef.current<m && !firedRef.current.has(m)){
        firedRef.current.add(m);
        const ts=Date.now();
        const kind=m===100?"confetti":"ring";
        setFlash({kind,value:m,ts});
        const dur=m===100?1600:1000;
        setTimeout(()=>setFlash(f=>(f&&f.ts===ts)?null:f),dur);
        break;
      }
    }
    [50,75,100].forEach(m=>{if(value<m-8)firedRef.current.delete(m);});
    lastValRef.current=value;
  },[value]);
  return flash;
}

// Ring flash สำหรับ milestone 50% และ 75% — วงแหวนขยายออก + จาง
function MilestoneRing({color}){
  return<g pointerEvents="none">
    <circle cx={VB.cx} cy={VB.cy} r="110" fill="none" stroke={color||"#ffffff"} strokeWidth="5" opacity="0.9">
      <animate attributeName="r" from="110" to="250" dur="0.95s" fill="freeze"/>
      <animate attributeName="opacity" values="0.9;0.5;0" dur="0.95s" fill="freeze"/>
      <animate attributeName="stroke-width" values="6;3;0.5" dur="0.95s" fill="freeze"/>
    </circle>
  </g>;
}

// Confetti สำหรับ 100% — จุดสีกระจายขึ้นแล้วร่วงหายไป
function MilestoneConfetti({theme}){
  const COUNT=28;
  const dots=useMemo(()=>{
    const arr=[];
    for(let i=0;i<COUNT;i++){
      const angle=Math.PI*(0.08+Math.random()*0.84); // semicircle ด้านบน
      const dist=110+Math.random()*150;
      arr.push({
        i,
        color:colorAt(theme,Math.random()),
        delay:Math.random()*0.18,
        dur:1.2+Math.random()*0.5,
        endX:VB.cx+Math.cos(-angle)*dist,
        endY:VB.cy-Math.sin(angle)*dist,
        size:2.5+Math.random()*3.5,
      });
    }
    return arr;
  },[theme]);
  return<g pointerEvents="none">
    {dots.map(d=>(
      <circle key={d.i} cx={VB.cx} cy={VB.cy} r={d.size} fill={d.color}>
        <animate attributeName="cx" from={VB.cx} to={d.endX} dur={d.dur+"s"} begin={d.delay+"s"} fill="freeze"/>
        <animate attributeName="cy" from={VB.cy} to={d.endY} dur={d.dur+"s"} begin={d.delay+"s"} fill="freeze"/>
        <animate attributeName="opacity" values="1;1;0" dur={d.dur+"s"} begin={d.delay+"s"} fill="freeze"/>
        <animate attributeName="r" values={d.size+";"+(d.size*1.2)+";0.5"} dur={d.dur+"s"} begin={d.delay+"s"} fill="freeze"/>
      </circle>
    ))}
  </g>;
}

// pulse style สำหรับเกจที่ over goal — ใส่ keyframes scoped ด้วย uid
function PulseStyle({over,uid,color,glow}){
  if(!over)return null;
  const base=(glow/100)*6+3;
  const peak=base*4.2;
  const keyName="pulse-"+uid;
  return<style>{"@keyframes "+keyName+"{0%,100%{filter:drop-shadow(0 0 "+base+"px "+color+")}50%{filter:drop-shadow(0 0 "+peak+"px "+color+")}}"}</style>;
}

export default function NeonGauge({variant="classic",uid,value,target=100,glow=80,theme="reference",sublabel,showTarget=true,ghostValue,flames=false,heatT1=50,heatT2=75}){
  const Comp=VARIANT_MAP[variant]||ClassicGauge;
  const gaugeEl=<Comp uid={uid||("g-"+(variant||"x"))} value={value} target={target} glow={glow} theme={theme} sublabel={sublabel} showTarget={showTarget} ghostValue={ghostValue}/>;
  if(!flames)return gaugeEl;
  const radius=FLAME_RADIUS[variant]||178;
  return<div style={{position:"relative",display:"block"}}>
    {gaugeEl}
    <FlameCanvas value={value} theme={theme} t1={heatT1} t2={heatT2} radius={radius}/>
  </div>;
}

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

function ClassicGauge({uid,value,target,glow,theme,sublabel,showTarget}){
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
  return<svg viewBox={"0 0 "+VB.w+" "+VB.h} width="100%" style={{display:"block"}}>
    <NeonDefs uid={uid} glow={glow} theme={theme}/>
    <g filter={"url(#"+uid+"-neon)"}>{ticks}</g>
    <g style={{filter:"drop-shadow(0 0 "+(glow/100*6)+"px currentColor)"}}>{labels}</g>
    <g filter={"url(#"+uid+"-soft)"}>
      <g transform={"translate("+pt.x+","+pt.y+") rotate("+(-ptheta+90)+")"} fill={vcolor}>
        <path d="M 0 -13 L 11 6 L -11 6 Z"/>
      </g>
    </g>
    {showTarget&&<TargetMarker f={target/100} r={200} glow={glow}/>}
    <CenterReadout value={value} sublabel={sublabel} color={vcolor} glow={glow} big/>
  </svg>;
}

function SweepGauge({uid,value,target,glow,theme,sublabel,showTarget}){
  const R=184,W=24;
  const vf=value/100;
  const tip=polar(R,vf);
  const vcolor=colorAt(theme,vf);
  const fullLen=Math.PI*R;
  const litLen=fullLen*vf;
  return<svg viewBox={"0 0 "+VB.w+" "+VB.h} width="100%" style={{display:"block"}}>
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
    {showTarget&&<TargetMarker f={target/100} r={R+W/2+6} glow={glow}/>}
    <CenterReadout value={value} sublabel={sublabel} color={vcolor} glow={glow} big/>
  </svg>;
}

function SegmentGauge({uid,value,target,glow,theme,sublabel,showTarget}){
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
  return<svg viewBox={"0 0 "+VB.w+" "+VB.h} width="100%" style={{display:"block"}}>
    <NeonDefs uid={uid} glow={glow} theme={theme}/>
    {segs}
    <g filter={"url(#"+uid+"-neon)"}>{litSegs}</g>
    <text x={polar(R,0).x-4} y={polar(R,0).y+24} textAnchor="middle"
      fontSize="14" fill="#5c6675" fontFamily="inherit">0</text>
    <text x={polar(R,1).x+4} y={polar(R,1).y+24} textAnchor="middle"
      fontSize="14" fill="#5c6675" fontFamily="inherit">100</text>
    {showTarget&&<TargetMarker f={target/100} r={R+W/2+6} glow={glow}/>}
    <CenterReadout value={value} sublabel={sublabel} color={vcolor} glow={glow} big/>
  </svg>;
}

const VARIANT_MAP={classic:ClassicGauge,sweep:SweepGauge,segment:SegmentGauge};

export const GAUGE_VARIANTS=[
  {id:"classic",label:"Classic"},
  {id:"sweep",label:"Sweep"},
  {id:"segment",label:"Segment"},
];

// useEased — count-up + smooth slider, ใช้ setTimeout (เผื่อ tab background)
import { useState, useRef, useEffect } from "react";
export function useEased(target,enabled=true){
  const[v,setV]=useState(enabled?0:target);
  const ref=useRef(enabled?0:target);
  const timer=useRef(0);
  useEffect(()=>{
    clearTimeout(timer.current);
    const step=()=>{
      const cur=ref.current,d=target-cur;
      if(Math.abs(d)<0.08){ref.current=target;setV(target);return;}
      ref.current=cur+d*0.11;
      setV(ref.current);
      timer.current=setTimeout(step,16);
    };
    timer.current=setTimeout(step,16);
    return()=>clearTimeout(timer.current);
  },[target]);
  return v;
}

export default function NeonGauge({variant="classic",uid,value,target=100,glow=80,theme="reference",sublabel,showTarget=true}){
  const Comp=VARIANT_MAP[variant]||ClassicGauge;
  return<Comp uid={uid||("g-"+(variant||"x"))} value={value} target={target} glow={glow} theme={theme} sublabel={sublabel} showTarget={showTarget}/>;
}

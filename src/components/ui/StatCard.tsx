import type { ReactNode } from "react";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
  icon?: ReactNode;
  accentBg?: string;
}

export default function StatCard({ label, value, sub, color, icon, accentBg }: StatCardProps) {
  return <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"18px 20px",boxShadow:"var(--shadow)",position:"relative",overflow:"hidden"}}>
    <div style={{display:"flex",alignItems:"center",gap:9,color:"var(--dim)",fontSize:13}}>
      {icon&&<span style={{width:28,height:28,borderRadius:8,background:accentBg||"var(--blue-bg)",color:color||"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{icon}</span>}
      <span>{label}</span>
    </div>
    <div className="num" style={{fontSize:28,fontWeight:600,letterSpacing:"-0.025em",margin:"12px 0 4px",color:color||"var(--text)"}}>{value}</div>
    {sub&&<div style={{fontSize:13,color:"var(--dim)",marginTop:4}}>{sub}</div>}
  </div>;
}

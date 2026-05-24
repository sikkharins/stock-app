export default function Btn({onClick,children,variant,size}){
  const base={fontSize:13,padding:"6px 13px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontWeight:500,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",border:"1px solid var(--line)",background:"var(--bg2)",color:"var(--text)"};
  if(variant==="pri")Object.assign(base,{background:"var(--blue)",color:"#fff",borderColor:"var(--blue)"});
  else if(variant==="ghost")Object.assign(base,{background:"transparent",borderColor:"transparent",color:"var(--blue)"});
  if(size==="sm")Object.assign(base,{padding:"4px 10px",fontSize:12});
  else if(size==="lg")Object.assign(base,{padding:"8px 18px",fontSize:14});
  return <button onClick={onClick} style={base}>{children}</button>;
}

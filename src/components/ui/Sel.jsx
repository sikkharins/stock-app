export default function Sel({value,onChange,children}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",fontSize:13,padding:"7px 10px",borderRadius:7,fontFamily:"inherit",width:"auto"}}>{children}</select>;
}

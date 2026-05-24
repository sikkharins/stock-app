export default function SB({value,onChange,placeholder}){
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)",fontSize:13,padding:"7px 12px",borderRadius:7,width:190,boxSizing:"border-box",fontFamily:"inherit"}}/>;
}

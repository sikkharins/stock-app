import type { ReactNode } from "react";

interface ModalProps {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function Modal({ title, children, onClose, wide }: ModalProps) {
  return <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:100,paddingTop:40,overflowY:"auto"}}>
    <div className="modal-box" style={{background:"var(--panel)",borderRadius:14,border:"1px solid var(--line)",padding:"1.5rem",width:wide?"min(760px,96%)":"min(580px,94%)",maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box",boxShadow:"0 32px 80px rgba(0,0,0,0.25)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontWeight:600,fontSize:15,color:"var(--text)"}}>{title}</span>
        <span onClick={onClose} style={{cursor:"pointer",color:"var(--dim)",fontSize:26,lineHeight:1,padding:"4px 6px"}}>×</span>
      </div>
      {children}
    </div>
  </div>;
}

interface MBtnsProps {
  onCancel: () => void;
  onSave?: () => void;
  saveLabel?: string;
  disabled?: boolean;
  saveColor?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function MBtns({ onCancel, onSave, saveLabel, disabled, saveColor, secondaryLabel, onSecondary }: MBtnsProps) {
  const saveBg = disabled ? "var(--hover2)" : (saveColor || "var(--blue)");
  return <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,marginTop:16}}>
    {onSecondary&&<button onClick={onSecondary} style={{padding:"6px 13px",borderRadius:7,border:"1px solid var(--line)",cursor:"pointer",background:"var(--bg2)",color:"var(--text)",fontFamily:"inherit",fontSize:13,fontWeight:500}}>{secondaryLabel||"บันทึกร่าง"}</button>}
    <div style={{display:"flex",gap:10,marginLeft:"auto"}}>
      <button onClick={onCancel} style={{padding:"6px 13px",borderRadius:7,border:"1px solid var(--line)",cursor:"pointer",background:"var(--bg2)",color:"var(--text)",fontFamily:"inherit",fontSize:13,fontWeight:500}}>ยกเลิก</button>
      {onSave&&<button onClick={onSave} disabled={disabled} style={{padding:"6px 13px",borderRadius:7,border:"none",cursor:disabled?"not-allowed":"pointer",background:saveBg,color:disabled?"var(--dim)":"#fff",fontFamily:"inherit",fontSize:13,fontWeight:500,opacity:disabled?0.6:1}}>{saveLabel||"บันทึก"}</button>}
    </div>
  </div>;
}

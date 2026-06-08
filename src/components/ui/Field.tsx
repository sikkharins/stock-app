import type { ReactNode } from "react";

interface FieldProps {
  label: ReactNode;
  req?: boolean;
  children: ReactNode;
}

export default function Field({ label, req, children }: FieldProps) {
  return <div>
    <div style={{fontSize:11.5,fontWeight:500,color:"var(--dim)",marginBottom:4}}>
      {label}{req&&<span style={{color:"var(--red)",marginLeft:2}}>*</span>}
    </div>
    {children}
  </div>;
}

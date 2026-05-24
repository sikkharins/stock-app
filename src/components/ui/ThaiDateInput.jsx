import { useRef } from "react";
import { toBE } from "../../utils/helpers.js";

export default function ThaiDateInput({ value, onChange, style }) {
  const ref = useRef(null);
  const display = value ? toBE(value) : "วว/ดด/ปปปป";
  return (
    <div style={{ position: "relative", ...style }}>
      <div
        onClick={() => ref.current?.showPicker?.() || ref.current?.click()}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 7,
          padding: "7px 12px", paddingRight: 32, fontSize: 13, color: value ? "var(--text)" : "var(--faint)",
          fontFamily: "inherit", cursor: "pointer",
        }}
      >
        {display}
      </div>
      <svg style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <input
        ref={ref}
        type="date"
        value={value || ""}
        onChange={onChange}
        style={{
          position: "absolute", inset: 0, opacity: 0, cursor: "pointer",
          width: "100%", height: "100%",
        }}
      />
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

export default function CustomSelect({ value, onChange, options, style, disabled, searchable }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, up: false });
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target) && (!dropRef.current || !dropRef.current.contains(e.target))) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") { setOpen(false); setSearch(""); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  useEffect(() => {
    if (open && searchable && inputRef.current) inputRef.current.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const update = () => {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = spaceBelow < 180;
      setPos({ top: up ? rect.top : rect.bottom + 2, left: rect.left, width: rect.width, up });
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = spaceBelow < 180;
      setPos({ top: up ? rect.top : rect.bottom + 2, left: rect.left, width: rect.width, up });
    }
    if (open) setSearch("");
    setOpen(!open);
  };

  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return options;
    const s = search.toLowerCase();
    return options.filter(o => {
      const lbl = typeof o === "string" ? o : o.label;
      const st = typeof o === "object" && o.searchText ? o.searchText : "";
      return lbl.toLowerCase().includes(s) || st.toLowerCase().includes(s);
    });
  }, [options, search, searchable]);

  const label = options.find(o => (typeof o === "string" ? o : o.value) === value);
  const displayLabel = label ? (typeof label === "string" ? label : label.label) : value || "เลือก...";

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <div
        onClick={handleOpen}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 7,
          padding: "7px 12px", paddingRight: 28, fontSize: 13, color: disabled ? "var(--faint)" : "var(--text)",
          fontFamily: "inherit", cursor: disabled ? "default" : "pointer",
          display: "flex", alignItems: "center",
          ...(style?.width ? { width: style.width } : {}),
        }}
      >
        {displayLabel}
        <svg style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="8" viewBox="0 0 12 8">
          <path d="M1 1l5 5 5-5" stroke="var(--dim)" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && createPortal(
        <div ref={dropRef} style={{
          position: "fixed",
          ...(pos.up ? { bottom: window.innerHeight - pos.top + 2 } : { top: pos.top }),
          left: pos.left, width: pos.width,
          background: "var(--bg2)", border: "1px solid var(--line)",
          borderRadius: 7, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 99999,
          maxHeight: 300, display: "flex", flexDirection: "column",
        }}>
          {searchable && <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="พิมพ์ค้นหา..."
              onMouseDown={e => e.stopPropagation()}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 5, padding: "6px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" }}
            />
          </div>}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {searchable && filteredOptions.length === 0 && <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--dim)", textAlign: "center" }}>ไม่พบรายการ</div>}
            {filteredOptions.map((o, i) => {
              const val = typeof o === "string" ? o : o.value;
              const lbl = typeof o === "string" ? o : o.label;
              const active = val === value;
              return (
                <div
                  key={val + "-" + i}
                  onMouseDown={(e) => { e.preventDefault(); onChange(val); setOpen(false); setSearch(""); }}
                  style={{
                    padding: "7px 12px", fontSize: 13, cursor: "pointer",
                    color: "var(--text)", fontFamily: "inherit",
                    background: active ? "var(--blue-bg)" : "transparent",
                    borderRadius: i === 0 && !searchable ? "7px 7px 0 0" : i === filteredOptions.length - 1 ? "0 0 7px 7px" : 0,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = active ? "var(--blue-bg)" : "transparent"; }}
                >
                  {lbl}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

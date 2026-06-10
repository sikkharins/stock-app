import { useEffect, type ReactNode } from "react";

interface SlideOverProps {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
}

export default function SlideOver({
  title,
  children,
  onClose,
  footer,
  width = 520,
}: SlideOverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-slideover-backdrop
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 110,
        animation: "slideover-fade 200ms var(--ease-out, ease-out)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: `min(${width}px, 100vw)`,
          background: "var(--panel)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "var(--shadow-card-hi, 0 12px 28px rgba(0,0,0,0.2))",
          display: "flex",
          flexDirection: "column",
          animation: "slideover-in 240ms var(--ease-out, ease-out)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{title}</div>
          <button
            aria-label="close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--dim)",
              fontSize: 24,
              lineHeight: 1,
              padding: "2px 6px",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>{children}</div>
        {footer && (
          <div
            style={{
              borderTop: "1px solid var(--line)",
              padding: "12px 20px",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexShrink: 0,
              background: "var(--panel)",
            }}
          >
            {footer}
          </div>
        )}
        <style>{`
          @keyframes slideover-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes slideover-fade { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    </div>
  );
}

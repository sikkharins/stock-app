const SHIMMER_CSS = `
@keyframes sk-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

const shimmerBg = {
  background: "linear-gradient(90deg, var(--hover) 25%, var(--hover2,rgba(120,120,128,0.12)) 50%, var(--hover) 75%)",
  backgroundSize: "800px 100%",
  animation: "sk-shimmer 1.6s ease-in-out infinite",
};

function Box({ w, h, r = 6, style }) {
  return <div style={{ width: w || "100%", height: h || 14, borderRadius: r, ...shimmerBg, ...style }} />;
}

function StatCardSk() {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}>
      <Box w={80} h={11} r={4} style={{ marginBottom: 10 }} />
      <Box w={56} h={24} r={6} />
    </div>
  );
}

function ProductCardSk() {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box w={120} h={14} r={4} />
        <Box w={48} h={18} r={99} />
      </div>
      <Box w={80} h={11} r={4} />
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <Box w={50} h={11} r={4} />
          <Box w={70} h={14} r={4} />
        </div>
        <Box h={6} r={4} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Box w={90} h={13} r={4} />
        <Box w={70} h={13} r={4} />
      </div>
    </div>
  );
}

function NavItemSk({ w = 110 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 10px" }}>
      <Box w={18} h={18} r={4} />
      <Box w={w} h={13} r={4} />
    </div>
  );
}

export default function AppSkeleton() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gridTemplateRows: "52px 1fr", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
        {/* Sidebar */}
        <aside style={{ gridRow: "1 / span 2", background: "var(--sidebar-bg)", borderRight: "1px solid var(--line)", padding: "14px 12px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 18px" }}>
            <Box w={32} h={32} r={8} />
            <Box w={100} h={14} r={4} />
          </div>
          <div style={{ padding: "14px 10px 6px" }}><Box w={70} h={10} r={4} /></div>
          <NavItemSk w={90} />
          <NavItemSk w={110} />
          <NavItemSk w={80} />
          <NavItemSk w={100} />
          <NavItemSk w={70} />
          <NavItemSk w={95} />
          <div style={{ padding: "14px 10px 6px" }}><Box w={60} h={10} r={4} /></div>
          <NavItemSk w={85} />
          <NavItemSk w={105} />
          <NavItemSk w={75} />
          <div style={{ marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--line)" }}>
              <Box w={28} h={28} r={99} />
              <div style={{ flex: 1 }}>
                <Box w={80} h={12} r={4} style={{ marginBottom: 4 }} />
                <Box w={50} h={10} r={4} />
              </div>
            </div>
          </div>
        </aside>

        {/* Topbar */}
        <header style={{ gridColumn: 2, display: "flex", alignItems: "center", padding: "0 24px", gap: 14, borderBottom: "0.5px solid var(--line)", background: "var(--topbar-bg)" }}>
          <Box w={120} h={13} r={4} />
          <div style={{ flex: 1 }} />
          <Box w={180} h={30} r={8} />
          <Box w={28} h={28} r={99} />
        </header>

        {/* Content */}
        <main style={{ gridColumn: 2, padding: "20px 24px", overflowY: "auto" }}>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 16 }}>
            <StatCardSk />
            <StatCardSk />
            <StatCardSk />
            <StatCardSk />
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 }}>
            <Box w={240} h={34} r={8} />
            <div style={{ display: "flex", gap: 8 }}>
              <Box w={100} h={32} r={7} />
              <Box w={100} h={32} r={7} />
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <Box w={70} h={28} r={99} />
            <Box w={60} h={28} r={99} />
            <Box w={80} h={28} r={99} />
            <Box w={55} h={28} r={99} />
          </div>

          {/* Product cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
            {Array.from({ length: 8 }, (_, i) => <ProductCardSk key={i} />)}
          </div>
        </main>
      </div>
    </>
  );
}

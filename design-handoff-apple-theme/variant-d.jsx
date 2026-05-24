// Variation D — APPLE
// Soft, generous, Apple-like aesthetic. SF Pro stack, system-blue accent,
// gentle borders, translucent top bar, rounded 10–12px corners.
// Supports both light and dark modes via the `theme` prop.

const VD_CSS = `
.vd-root{
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Inter','Noto Sans Thai',system-ui,sans-serif;
  font-size:13px; line-height:1.4; -webkit-font-smoothing:antialiased; letter-spacing:-0.005em;
  width:100%; height:100%; display:grid;
  grid-template-columns:240px 1fr; grid-template-rows:52px 1fr;
}
.vd-num{font-variant-numeric:tabular-nums; font-feature-settings:'tnum','ss01';}

/* ── Light ── */
.vd-root.light{
  --bg:#f5f5f7; --bg2:#ffffff; --panel:#ffffff; --hover:#f5f5f7; --hover2:#ebebed;
  --line:#e5e5ea; --line2:#d2d2d7; --shadow:0 1px 0 rgba(0,0,0,0.04),0 0 0 0.5px rgba(0,0,0,0.06);
  --text:#1d1d1f; --dim:#6e6e73; --faint:#86868b;
  --blue:#0071e3; --blue-bg:rgba(0,113,227,0.08); --blue-hover:#0077ed;
  --green:#34c759; --orange:#ff9500; --red:#ff3b30; --yellow:#ffcc00; --teal:#5ac8fa; --purple:#af52de; --pink:#ff2d55;
  --topbar-bg:rgba(245,245,247,0.78); --sidebar-bg:#f5f5f7;
  background:var(--bg); color:var(--text);
}
/* ── Dark ── */
.vd-root.dark{
  --bg:#1c1c1e; --bg2:#2c2c2e; --panel:#2c2c2e; --hover:#3a3a3c; --hover2:#48484a;
  --line:#38383a; --line2:#48484a; --shadow:0 0 0 0.5px rgba(255,255,255,0.06);
  --text:#f5f5f7; --dim:#98989d; --faint:#6c6c70;
  --blue:#0a84ff; --blue-bg:rgba(10,132,255,0.16); --blue-hover:#409cff;
  --green:#30d158; --orange:#ff9f0a; --red:#ff453a; --yellow:#ffd60a; --teal:#64d2ff; --purple:#bf5af2; --pink:#ff375f;
  --topbar-bg:rgba(28,28,30,0.78); --sidebar-bg:#1c1c1e;
  background:var(--bg); color:var(--text);
}

/* ── Sidebar ── */
.vd-sidebar{grid-row:1 / span 2; background:var(--sidebar-bg); border-right:1px solid var(--line); padding:14px 12px; display:flex; flex-direction:column;}
.vd-brand{display:flex; align-items:center; gap:10px; padding:6px 10px 18px;}
.vd-brand .logo{width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#0a84ff,#5ac8fa); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:13px; letter-spacing:-0.04em; box-shadow:0 1px 2px rgba(0,0,0,0.06);}
.vd-brand .nm{font-weight:600; font-size:14px; letter-spacing:-0.015em;}
.vd-brand .sub{font-size:11px; color:var(--dim); margin-top:1px;}

.vd-nav{display:flex; flex-direction:column; gap:1px; flex:1;}
.vd-sect{padding:14px 10px 6px; font-size:11px; color:var(--faint); font-weight:600; letter-spacing:0.01em; text-transform:none;}
.vd-item{display:flex; align-items:center; gap:11px; padding:7px 10px; border-radius:7px; color:var(--text); cursor:pointer; font-size:13.5px; font-weight:400;}
.vd-item:hover{background:var(--hover);}
.vd-item.active{background:var(--blue-bg); color:var(--blue);}
.vd-item.active .ico{color:var(--blue);}
.vd-item .ico{width:18px; height:18px; display:flex; align-items:center; justify-content:center; color:var(--dim); font-size:14px;}
.vd-item .lab{flex:1;}
.vd-item .bdg{background:var(--bg2); border:1px solid var(--line); color:var(--dim); font-size:11px; padding:0 6px; border-radius:99px; font-weight:500; min-width:18px; text-align:center;}
.vd-item.active .bdg{background:var(--blue); color:#fff; border-color:var(--blue);}

.vd-userbox{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--bg2); border:1px solid var(--line); margin-top:8px;}
.vd-userbox .av{width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#ff9500,#ff2d55); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:12px;}
.vd-userbox .nm{font-size:13px; font-weight:500;}
.vd-userbox .ro{font-size:11px; color:var(--dim);}
.vd-userbox .opt{color:var(--dim); cursor:pointer;}

/* ── Top bar (translucent) ── */
.vd-topbar{grid-column:2; display:flex; align-items:center; padding:0 24px; gap:14px; border-bottom:0.5px solid var(--line); background:var(--topbar-bg); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px);}
.vd-crumb{display:flex; align-items:center; gap:6px; font-size:13px; color:var(--dim);}
.vd-crumb .cur{color:var(--text); font-weight:600;}
.vd-search{flex:1; max-width:440px; margin-left:18px; display:flex; align-items:center; gap:9px; padding:6px 12px; background:var(--bg2); border:1px solid var(--line); border-radius:8px; color:var(--dim); font-size:13px;}
.vd-search:focus-within{border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-bg);}
.vd-search .kbd{margin-left:auto; font-size:11px; color:var(--dim);}
.vd-actions{display:flex; align-items:center; gap:6px;}
.vd-iconbtn{width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--dim); cursor:pointer; position:relative; font-size:15px;}
.vd-iconbtn:hover{background:var(--hover);}
.vd-iconbtn .dot{position:absolute; top:6px; right:7px; width:7px; height:7px; border-radius:50%; background:var(--red); box-shadow:0 0 0 2px var(--topbar-bg);}
.vd-newbtn{display:flex; align-items:center; gap:6px; padding:6px 13px; background:var(--blue); color:#fff; border:0; border-radius:7px; font-weight:500; font-size:13px; cursor:pointer; font-family:inherit;}
.vd-newbtn:hover{background:var(--blue-hover);}

/* ── Main ── */
.vd-main{grid-column:2; overflow:auto; padding:28px 32px 60px; display:flex; flex-direction:column; gap:24px;}
.vd-pgh{display:flex; align-items:end; justify-content:space-between; gap:24px;}
.vd-pgh h1{margin:0; font-size:28px; font-weight:600; letter-spacing:-0.025em; line-height:1.1;}
.vd-pgh .meta{color:var(--dim); font-size:14px; margin-top:6px;}
.vd-segctl{display:flex; background:var(--bg2); border:1px solid var(--line); border-radius:8px; padding:2px;}
.vd-segctl button{padding:5px 12px; border:0; background:transparent; color:var(--text); border-radius:6px; font-size:12.5px; font-weight:500; cursor:pointer; font-family:inherit;}
.vd-segctl button.on{background:var(--blue); color:#fff;}
.vd-segctl button:not(.on):hover{background:var(--hover);}

/* ── Stat cards ── */
.vd-stats{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.vd-stat{background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px 20px; box-shadow:var(--shadow); position:relative; overflow:hidden;}
.vd-stat .k{display:flex; align-items:center; gap:9px; color:var(--dim); font-size:13px;}
.vd-stat .k .ico{width:28px; height:28px; border-radius:8px; background:var(--accent-bg,var(--blue-bg)); color:var(--accent,var(--blue)); display:flex; align-items:center; justify-content:center; font-size:14px;}
.vd-stat .v{font-size:28px; font-weight:600; letter-spacing:-0.025em; margin:12px 0 4px;}
.vd-stat .d{font-size:13px; color:var(--green); display:flex; align-items:center; gap:5px;}
.vd-stat .spark{position:absolute; right:18px; bottom:16px; width:60px; height:24px; opacity:0.6;}

/* ── Panels ── */
.vd-cols{display:grid; grid-template-columns:1.5fr 1fr; gap:18px;}
.vd-cols2{display:grid; grid-template-columns:1fr 1fr; gap:18px;}
.vd-panel{background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); overflow:hidden;}
.vd-ph{padding:14px 18px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line);}
.vd-ph .t{font-size:15px; font-weight:600; letter-spacing:-0.01em;}
.vd-ph .sub{font-size:12px; color:var(--dim); margin-top:2px;}
.vd-ph .a{color:var(--blue); font-size:13px; font-weight:500; cursor:pointer;}

/* ── List rows ── */
.vd-list{padding:6px;}
.vd-row{display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; cursor:default;}
.vd-row:hover{background:var(--hover);}
.vd-row .av{width:34px; height:34px; border-radius:8px; background:var(--hover); display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; font-weight:600;}
.vd-row .mn{flex:1; min-width:0;}
.vd-row .mn .nm{font-size:13.5px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.vd-row .mn .meta{font-size:11.5px; color:var(--dim); margin-top:2px;}
.vd-row .val{text-align:right; font-size:13.5px; font-weight:600;}
.vd-row .val .sub{font-size:11.5px; color:var(--dim); font-weight:400; margin-top:2px;}

/* ── Pills ── */
.vd-pill{display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:99px; font-size:11.5px; font-weight:500;}
.vd-pill .dot{width:5px; height:5px; border-radius:50%; background:currentColor;}
.vd-pill.green{background:rgba(52,199,89,0.12); color:var(--green);}
.vd-pill.orange{background:rgba(255,149,0,0.14); color:var(--orange);}
.vd-pill.red{background:rgba(255,59,48,0.12); color:var(--red);}
.vd-pill.blue{background:var(--blue-bg); color:var(--blue);}
.vd-pill.purple{background:rgba(175,82,222,0.12); color:var(--purple);}
.vd-pill.neutral{background:var(--hover); color:var(--dim);}

/* ── Progress bars ── */
.vd-progress{height:5px; background:var(--hover); border-radius:99px; overflow:hidden; margin-top:6px;}
.vd-progress i{display:block; height:100%; background:var(--blue); border-radius:99px;}
.vd-progress.green i{background:var(--green);}
.vd-progress.red i{background:var(--red);}
.vd-progress.orange i{background:var(--orange);}

/* ── Targets ── */
.vd-target{padding:12px; border-radius:8px;}
.vd-target:hover{background:var(--hover);}
.vd-target .top{display:flex; align-items:center; justify-content:space-between;}
.vd-target .top .nm{display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:500;}
.vd-target .top .nm .av{width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--teal)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;}
.vd-target .top .pct{font-size:14px; font-weight:600;}
.vd-target .bot{display:flex; align-items:center; justify-content:space-between; font-size:11.5px; color:var(--dim); margin-top:6px;}

/* ── Chart ── */
.vd-chart{padding:18px 20px;}
.vd-chartrow{display:flex; align-items:end; gap:20px; height:160px; padding-bottom:14px; border-bottom:1px solid var(--line);}
.vd-bar{flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; min-width:0;}
.vd-bar .bars{display:flex; gap:3px; align-items:end; width:100%; max-width:48px; height:100%;}
.vd-bar .bars .s{flex:1; background:linear-gradient(180deg,var(--blue),#4fa3ff); border-radius:4px 4px 0 0; min-height:2px;}
.vd-bar .bars .p{flex:1; background:var(--line2); border-radius:4px 4px 0 0; min-height:2px;}
.vd-bar .m{font-size:12px; color:var(--dim);}

/* ── Quick actions ── */
.vd-quicks{display:grid; grid-template-columns:repeat(4,1fr); gap:12px;}
.vd-quick{display:flex; align-items:center; gap:12px; padding:14px 16px; background:var(--panel); border:1px solid var(--line); border-radius:12px; cursor:pointer; box-shadow:var(--shadow); transition:transform .12s;}
.vd-quick:hover{transform:translateY(-1px); border-color:var(--line2);}
.vd-quick .qi{width:36px; height:36px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px;}
.vd-quick .qm{font-size:13.5px; font-weight:600;}
.vd-quick .qs{font-size:11.5px; color:var(--dim);}
`;

function VariantD({ lang = 'TH', theme = 'light', activeNav = 'dashboard' }) {
  const { STATS, LOW_STOCK, RECENT_PO, RECENT_LOG, TARGETS, MONTHLY, NAV } = window.TS;
  const t = (th, en) => (lang === 'TH' ? th : en);
  const accents = ['blue','green','orange','purple'];
  const accentMap = {
    blue:   { bg:'var(--blue-bg)',                  col:'var(--blue)' },
    green:  { bg:'rgba(52,199,89,0.12)',            col:'var(--green)' },
    orange: { bg:'rgba(255,149,0,0.14)',            col:'var(--orange)' },
    purple: { bg:'rgba(175,82,222,0.12)',           col:'var(--purple)' },
  };
  const icons = ['▤','✦','↗','◑'];
  return (
    <div className={'vd-root ' + theme}>
      <style>{VD_CSS}</style>

      <aside className="vd-sidebar">
        <div className="vd-brand">
          <div className="logo">TS</div>
          <div>
            <div className="nm">Stock</div>
            <div className="sub">{t('สำนักงานใหญ่','Nakhon Sawan')}</div>
          </div>
        </div>

        <nav className="vd-nav">
          <div className="vd-sect">{t('พื้นที่ทำงาน','Workspace')}</div>
          {NAV.slice(0, 5).map((n, i) => (
            <div key={i} className={'vd-item' + (n.id === activeNav ? ' active' : '')}>
              <span className="ico">{n.icon}</span>
              <span className="lab">{t(n.labelTH, n.labelEN)}</span>
              {n.badge && <span className="bdg">{n.badge}</span>}
            </div>
          ))}
          <div className="vd-sect">{t('การจัดการ','Manage')}</div>
          {NAV.slice(5).map((n, i) => (
            <div key={i} className={'vd-item' + (n.id === activeNav ? ' active' : '')}>
              <span className="ico">{n.icon}</span>
              <span className="lab">{t(n.labelTH, n.labelEN)}</span>
              {n.badge && <span className="bdg">{n.badge}</span>}
            </div>
          ))}
          <div className="vd-sect">{t('ระบบ','System')}</div>
          <div className="vd-item"><span className="ico">⚙</span><span className="lab">{t('ผู้ใช้และสิทธิ์','Users & roles')}</span></div>
          <div className="vd-item"><span className="ico">⤓</span><span className="lab">{t('สำรองข้อมูล','Backup & export')}</span></div>
        </nav>

        <div className="vd-userbox">
          <div className="av">A</div>
          <div style={{ flex:1 }}>
            <div className="nm">admin</div>
            <div className="ro">{t('ผู้ดูแลระบบ','Administrator')}</div>
          </div>
          <span className="opt">⋯</span>
        </div>
      </aside>

      <header className="vd-topbar">
        <div className="vd-crumb">
          <span>Workspace</span>
          <span>›</span>
          <span className="cur">{t('แดชบอร์ด','Dashboard')}</span>
        </div>
        <div className="vd-search">
          <span style={{ fontSize:14 }}>⌕</span>
          <span style={{ flex:1 }}>{t('ค้นหาสินค้า, ใบสั่ง, ลูกค้า...','Search products, orders, customers…')}</span>
          <span className="kbd">⌘K</span>
        </div>
        <div className="vd-actions">
          <div className="vd-iconbtn" title="alerts">⌥<div className="dot"></div></div>
          <div className="vd-iconbtn" title="settings">⚙</div>
          <button className="vd-newbtn">+ {t('สร้างเอกสาร','New')}</button>
        </div>
      </header>

      <main className="vd-main">
        <div className="vd-pgh">
          <div>
            <h1>{t('สวัสดี, admin','Good afternoon, admin')}</h1>
            <div className="meta">{t('ภาพรวมการดำเนินงาน · พฤหัสบดี 15 พ.ค. 2569','Operational overview · Thursday, May 15')}</div>
          </div>
          <div className="vd-segctl">
            <button>{t('วันนี้','Today')}</button>
            <button className="on">{t('สัปดาห์','Week')}</button>
            <button>{t('เดือน','Month')}</button>
            <button>{t('ปี','Year')}</button>
          </div>
        </div>

        <div className="vd-stats">
          {STATS.map((s, i) => {
            const a = accentMap[accents[i]];
            return (
              <div key={s.key} className="vd-stat" style={{ '--accent-bg':a.bg, '--accent':a.col }}>
                <div className="k">
                  <span className="ico">{icons[i]}</span>
                  <span>{t(s.labelTH, s.labelEN)}</span>
                </div>
                <div className="v vd-num">{s.value}</div>
                <div className="d">↗ {s.delta}</div>
                <svg className="spark" viewBox="0 0 60 24" preserveAspectRatio="none">
                  <polyline points="0,18 8,14 16,16 24,9 32,11 40,5 48,7 60,2" fill="none" stroke={a.col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            );
          })}
        </div>

        <div className="vd-quicks">
          <div className="vd-quick">
            <div className="qi" style={{ background:'var(--blue-bg)', color:'var(--blue)' }}>⤴</div>
            <div><div className="qm">{t('ใบสั่งขาย','New sales order')}</div><div className="qs">SO · {t('ขายสินค้า','Sell goods')}</div></div>
          </div>
          <div className="vd-quick">
            <div className="qi" style={{ background:'rgba(52,199,89,0.12)', color:'var(--green)' }}>⤵</div>
            <div><div className="qm">{t('ใบสั่งซื้อ','New purchase order')}</div><div className="qs">PO · {t('สั่งซื้อ','Order in')}</div></div>
          </div>
          <div className="vd-quick">
            <div className="qi" style={{ background:'rgba(255,149,0,0.14)', color:'var(--orange)' }}>⊟</div>
            <div><div className="qm">{t('ใบเสนอราคา','New quotation')}</div><div className="qs">QT · {t('เสนอราคาลูกค้า','Quote a customer')}</div></div>
          </div>
          <div className="vd-quick">
            <div className="qi" style={{ background:'rgba(175,82,222,0.12)', color:'var(--purple)' }}>◰</div>
            <div><div className="qm">{t('เพิ่มสินค้า','Add product')}</div><div className="qs">{t('สร้างรายการใหม่','New SKU')}</div></div>
          </div>
        </div>

        <div className="vd-cols">
          <div className="vd-panel">
            <div className="vd-ph">
              <div>
                <div className="t">{t('ยอดขายเทียบยอดซื้อ','Sales vs. purchases')}</div>
                <div className="sub">{t('6 เดือนล่าสุด · ฿ × 1,000','Last 6 months · ฿ × 1,000')}</div>
              </div>
              <span className="a">{t('ดูรายงานเต็ม','See report')}</span>
            </div>
            <div className="vd-chart">
              <div className="vd-chartrow">
                {MONTHLY.map((m) => {
                  const max = 1400;
                  return (
                    <div key={m.m} className="vd-bar">
                      <div className="bars">
                        <div className="s" style={{ height:(m.sales / max * 100) + '%' }}></div>
                        <div className="p" style={{ height:(m.purchase / max * 100) + '%' }}></div>
                      </div>
                      <div className="m">{m.m}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:18, paddingTop:14, fontSize:12, color:'var(--dim)' }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><i style={{ width:10, height:10, borderRadius:3, background:'linear-gradient(180deg,var(--blue),#4fa3ff)' }}></i>{t('ยอดขาย','Sales')}</span>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><i style={{ width:10, height:10, borderRadius:3, background:'var(--line2)' }}></i>{t('สั่งซื้อ','Purchases')}</span>
                <span className="vd-num" style={{ marginLeft:'auto', color:'var(--green)', fontWeight:600 }}>↗ +18.4% MoM</span>
              </div>
            </div>
          </div>

          <div className="vd-panel">
            <div className="vd-ph">
              <div>
                <div className="t">{t('เป้ายอดขายเดือนนี้','Sales targets')}</div>
                <div className="sub">{t('พฤษภาคม 2569','May 2026')}</div>
              </div>
              <span className="a">→</span>
            </div>
            <div className="vd-list" style={{ padding:'4px 8px' }}>
              {TARGETS.map((tg) => {
                const over = tg.pct >= 100;
                const warn = tg.pct < 75;
                return (
                  <div key={tg.name} className="vd-target">
                    <div className="top">
                      <div className="nm">
                        <div className="av">{tg.nameEN[0]}</div>
                        <span>{t(tg.name, tg.nameEN)}</span>
                        {over && <span className="vd-pill green"><span className="dot"></span>{t('ทำได้แล้ว','Achieved')}</span>}
                      </div>
                      <span className="pct vd-num" style={{ color: over ? 'var(--green)' : warn ? 'var(--orange)' : 'var(--text)' }}>{tg.pct.toFixed(0)}%</span>
                    </div>
                    <div className={'vd-progress ' + (over ? 'green' : warn ? 'orange' : '')}>
                      <i style={{ width:Math.min(100, tg.pct) + '%' }}></i>
                    </div>
                    <div className="bot">
                      <span className="vd-num">฿ {tg.achieved.toLocaleString()}</span>
                      <span>{t('เป้า','of')} <span className="vd-num">฿ {tg.target.toLocaleString()}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="vd-cols2">
          <div className="vd-panel">
            <div className="vd-ph">
              <div>
                <div className="t">{t('สินค้าใกล้หมด','Low stock')}</div>
                <div className="sub">{t('5 รายการ · 1 หมดสต็อก','5 items · 1 out of stock')}</div>
              </div>
              <span className="a">{t('สร้าง PO ทั้งหมด','Reorder all')}</span>
            </div>
            <div className="vd-list">
              {LOW_STOCK.map((p) => {
                const crit = p.stock === 0;
                const pct = Math.min(100, (p.stock / p.min) * 100);
                return (
                  <div key={p.code} className="vd-row">
                    <div className="av" style={{ background:crit ? 'rgba(255,59,48,0.12)' : 'rgba(255,149,0,0.14)', color:crit ? 'var(--red)' : 'var(--orange)' }}>{p.brand[0]}</div>
                    <div className="mn">
                      <div className="nm">{p.name}</div>
                      <div className="meta">{p.code} · {p.brand}</div>
                      <div className={'vd-progress ' + (crit ? 'red' : 'orange')} style={{ marginTop:5, maxWidth:140 }}>
                        <i style={{ width:pct + '%' }}></i>
                      </div>
                    </div>
                    <div className="val">
                      <span className={'vd-pill ' + (crit ? 'red' : 'orange')}><span className="dot"></span>{p.stock} / {p.min}</span>
                      <div className="sub">{crit ? t('หมดสต็อก','Out') : t('ต่ำกว่าขั้นต่ำ','Low')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="vd-panel">
            <div className="vd-ph">
              <div>
                <div className="t">{t('กิจกรรมสต็อก','Stock activity')}</div>
                <div className="sub">{t('วันนี้ · 6 รายการ','Today · 6 events')}</div>
              </div>
              <span className="a">→</span>
            </div>
            <div className="vd-list">
              {RECENT_LOG.slice(0, 5).map((l, i) => {
                const isIn = l.type === 'in';
                const isOut = l.type === 'out';
                const cls = isIn ? 'green' : isOut ? 'blue' : 'orange';
                const lab = isIn ? t('รับเข้า','Received') : isOut ? t('ตัดสต็อก','Issued') : t('ปรับ','Adjusted');
                const sign = isIn ? '+' : '−';
                const ic = isIn ? '↓' : isOut ? '↑' : '⟳';
                return (
                  <div key={i} className="vd-row">
                    <div className="av" style={{ background:isIn ? 'rgba(52,199,89,0.12)' : isOut ? 'var(--blue-bg)' : 'rgba(255,149,0,0.14)', color:isIn ? 'var(--green)' : isOut ? 'var(--blue)' : 'var(--orange)' }}>{ic}</div>
                    <div className="mn">
                      <div className="nm">{l.product}</div>
                      <div className="meta"><span className={'vd-pill ' + cls} style={{ padding:'1px 6px', fontSize:11 }}>{lab}</span> · {l.ref} · @{l.user}</div>
                    </div>
                    <div className="val">
                      <span className="vd-num" style={{ color:isIn ? 'var(--green)' : 'var(--red)' }}>{sign}{l.qty}</span>
                      <div className="sub">{l.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="vd-panel">
          <div className="vd-ph">
            <div>
              <div className="t">{t('ใบสั่งซื้อล่าสุด','Recent purchase orders')}</div>
              <div className="sub">4 of 23</div>
            </div>
            <span className="a">{t('ดูทั้งหมด','See all')}</span>
          </div>
          <div className="vd-list">
            {RECENT_PO.map((p) => (
              <div key={p.num} className="vd-row">
                <div className="av" style={{ background:'var(--blue-bg)', color:'var(--blue)', fontSize:11 }}>PO</div>
                <div className="mn">
                  <div className="nm">{p.num}</div>
                  <div className="meta">{p.supplier} · {p.date}</div>
                </div>
                <div className="val">
                  <span className="vd-num">{p.amount}</span>
                  <div className="sub">
                    <span className={'vd-pill ' + (p.status === 'received' ? 'green' : 'orange')} style={{ padding:'1px 7px', fontSize:11 }}>
                      <span className="dot"></span>{p.status === 'received' ? t('รับแล้ว','Received') : t('รอดำเนินการ','Pending')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

window.VariantD = VariantD;

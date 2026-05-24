// Apple Shell — shared sidebar + topbar wrapper for Products / Sales / Reports
// Same design tokens as variant-d.jsx. Used by apple-pages.jsx.

const AS_CSS = `
.as-root{
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Inter','Noto Sans Thai',system-ui,sans-serif;
  font-size:13px; line-height:1.4; -webkit-font-smoothing:antialiased; letter-spacing:-0.005em;
  width:100%; height:100%; display:grid;
  grid-template-columns:240px 1fr; grid-template-rows:52px 1fr;
}
.as-num{font-variant-numeric:tabular-nums; font-feature-settings:'tnum';}

.as-root.light{
  --bg:#f5f5f7; --bg2:#ffffff; --panel:#ffffff; --hover:#f5f5f7; --hover2:#ebebed;
  --line:#e5e5ea; --line2:#d2d2d7; --shadow:0 1px 0 rgba(0,0,0,0.04),0 0 0 0.5px rgba(0,0,0,0.06);
  --text:#1d1d1f; --dim:#6e6e73; --faint:#86868b;
  --blue:#0071e3; --blue-bg:rgba(0,113,227,0.08); --blue-hover:#0077ed;
  --green:#34c759; --orange:#ff9500; --red:#ff3b30; --yellow:#ffcc00; --teal:#5ac8fa; --purple:#af52de; --pink:#ff2d55;
  --topbar-bg:rgba(245,245,247,0.78); --sidebar-bg:#f5f5f7;
  --rowhover:rgba(0,0,0,0.03);
  background:var(--bg); color:var(--text);
}
.as-root.dark{
  --bg:#1c1c1e; --bg2:#2c2c2e; --panel:#2c2c2e; --hover:#3a3a3c; --hover2:#48484a;
  --line:#38383a; --line2:#48484a; --shadow:0 0 0 0.5px rgba(255,255,255,0.06);
  --text:#f5f5f7; --dim:#98989d; --faint:#6c6c70;
  --blue:#0a84ff; --blue-bg:rgba(10,132,255,0.16); --blue-hover:#409cff;
  --green:#30d158; --orange:#ff9f0a; --red:#ff453a; --yellow:#ffd60a; --teal:#64d2ff; --purple:#bf5af2; --pink:#ff375f;
  --topbar-bg:rgba(28,28,30,0.78); --sidebar-bg:#1c1c1e;
  --rowhover:rgba(255,255,255,0.05);
  background:var(--bg); color:var(--text);
}

/* Sidebar */
.as-sidebar{grid-row:1 / span 2; background:var(--sidebar-bg); border-right:1px solid var(--line); padding:14px 12px; display:flex; flex-direction:column;}
.as-brand{display:flex; align-items:center; gap:10px; padding:6px 10px 18px;}
.as-brand .logo{width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#0a84ff,#5ac8fa); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:13px; letter-spacing:-0.04em;}
.as-brand .nm{font-weight:600; font-size:14px; letter-spacing:-0.015em;}
.as-brand .sub{font-size:11px; color:var(--dim); margin-top:1px;}
.as-nav{display:flex; flex-direction:column; gap:1px; flex:1;}
.as-sect{padding:14px 10px 6px; font-size:11px; color:var(--faint); font-weight:600;}
.as-item{display:flex; align-items:center; gap:11px; padding:7px 10px; border-radius:7px; color:var(--text); cursor:pointer; font-size:13.5px;}
.as-item:hover{background:var(--hover);}
.as-item.active{background:var(--blue-bg); color:var(--blue);}
.as-item.active .ico{color:var(--blue);}
.as-item .ico{width:18px; color:var(--dim); font-size:14px; display:flex; justify-content:center;}
.as-item .lab{flex:1;}
.as-item .bdg{background:var(--bg2); border:1px solid var(--line); color:var(--dim); font-size:11px; padding:0 6px; border-radius:99px; min-width:18px; text-align:center;}
.as-item.active .bdg{background:var(--blue); color:#fff; border-color:var(--blue);}
.as-userbox{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--bg2); border:1px solid var(--line);}
.as-userbox .av{width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#ff9500,#ff2d55); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:12px;}
.as-userbox .nm{font-size:13px; font-weight:500;}
.as-userbox .ro{font-size:11px; color:var(--dim);}

/* Top bar */
.as-topbar{grid-column:2; display:flex; align-items:center; padding:0 24px; gap:14px; border-bottom:0.5px solid var(--line); background:var(--topbar-bg); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px);}
.as-crumb{display:flex; align-items:center; gap:6px; font-size:13px; color:var(--dim);}
.as-crumb .cur{color:var(--text); font-weight:600;}
.as-search{flex:1; max-width:440px; margin-left:18px; display:flex; align-items:center; gap:9px; padding:6px 12px; background:var(--bg2); border:1px solid var(--line); border-radius:8px; color:var(--dim);}
.as-search .kbd{margin-left:auto; font-size:11px;}
.as-actions{display:flex; align-items:center; gap:6px;}
.as-iconbtn{width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--dim); cursor:pointer; position:relative; font-size:15px;}
.as-iconbtn:hover{background:var(--hover);}
.as-iconbtn .dot{position:absolute; top:6px; right:7px; width:7px; height:7px; border-radius:50%; background:var(--red); box-shadow:0 0 0 2px var(--topbar-bg);}
.as-newbtn{display:flex; align-items:center; gap:6px; padding:6px 13px; background:var(--blue); color:#fff; border:0; border-radius:7px; font-weight:500; font-size:13px; cursor:pointer; font-family:inherit;}
.as-newbtn:hover{background:var(--blue-hover);}

/* Main */
.as-main{grid-column:2; overflow:auto; padding:28px 32px 60px; display:flex; flex-direction:column; gap:22px;}
.as-pgh{display:flex; align-items:end; justify-content:space-between; gap:24px;}
.as-pgh h1{margin:0; font-size:28px; font-weight:600; letter-spacing:-0.025em; line-height:1.1;}
.as-pgh .meta{color:var(--dim); font-size:14px; margin-top:6px;}

/* Common building blocks */
.as-segctl{display:flex; background:var(--bg2); border:1px solid var(--line); border-radius:8px; padding:2px;}
.as-segctl button{padding:5px 14px; border:0; background:transparent; color:var(--text); border-radius:6px; font-size:12.5px; font-weight:500; cursor:pointer; font-family:inherit;}
.as-segctl button.on{background:var(--blue); color:#fff;}
.as-segctl button:not(.on):hover{background:var(--hover);}

.as-panel{background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); overflow:hidden;}
.as-ph{padding:14px 18px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line);}
.as-ph .t{font-size:15px; font-weight:600; letter-spacing:-0.01em;}
.as-ph .sub{font-size:12px; color:var(--dim); margin-top:2px;}
.as-ph .a{color:var(--blue); font-size:13px; font-weight:500; cursor:pointer;}

.as-pill{display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:99px; font-size:11.5px; font-weight:500;}
.as-pill .dot{width:5px; height:5px; border-radius:50%; background:currentColor;}
.as-pill.green{background:rgba(52,199,89,0.12); color:var(--green);}
.as-pill.orange{background:rgba(255,149,0,0.14); color:var(--orange);}
.as-pill.red{background:rgba(255,59,48,0.12); color:var(--red);}
.as-pill.blue{background:var(--blue-bg); color:var(--blue);}
.as-pill.purple{background:rgba(175,82,222,0.12); color:var(--purple)}
.as-pill.neutral{background:var(--hover); color:var(--dim);}
.as-pill.gray{background:var(--hover); color:var(--dim);}

.as-btn{display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:7px; border:1px solid var(--line); background:var(--bg2); color:var(--text); font:inherit; font-size:13px; font-weight:500; cursor:pointer;}
.as-btn:hover{background:var(--hover);}
.as-btn.pri{background:var(--blue); color:#fff; border-color:var(--blue);}
.as-btn.pri:hover{background:var(--blue-hover);}
.as-btn.sm{padding:4px 10px; font-size:12px;}
.as-btn.ghost{background:transparent; border-color:transparent; color:var(--blue);}
.as-btn.ghost:hover{background:var(--hover);}

/* Table */
.as-tbl{width:100%; border-collapse:collapse;}
.as-tbl th{font-weight:500; font-size:11.5px; color:var(--faint); padding:10px 16px; text-align:left; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid var(--line); background:var(--bg);}
.as-tbl td{padding:11px 16px; border-bottom:1px solid var(--line); font-size:13px; vertical-align:middle;}
.as-tbl tr:last-child td{border-bottom:0;}
.as-tbl tr.row:hover td{background:var(--rowhover);}
.as-tbl tr.row{cursor:default;}

/* Search input */
.as-input{background:var(--bg2); border:1px solid var(--line); color:var(--text); font:inherit; font-size:13px; padding:7px 12px; border-radius:7px;}
.as-input:focus{outline:0; border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-bg);}

/* Toolbar above tables */
.as-toolbar{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.as-chip{display:inline-flex; align-items:center; gap:6px; padding:4px 11px; border-radius:99px; border:1px solid var(--line); background:var(--bg2); color:var(--text); font-size:12.5px; font-weight:500; cursor:pointer;}
.as-chip:hover{background:var(--hover);}
.as-chip.on{background:var(--blue-bg); color:var(--blue); border-color:transparent;}
.as-chip .cnt{font-size:11px; background:var(--hover); padding:0 6px; border-radius:99px; color:var(--dim); min-width:18px; text-align:center;}
.as-chip.on .cnt{background:var(--blue); color:#fff;}

/* Tabs (sub navigation) */
.as-tabs{display:flex; gap:0; border-bottom:1px solid var(--line); padding:0 18px;}
.as-tabs button{padding:11px 16px; border:0; background:transparent; color:var(--dim); font:inherit; font-size:13.5px; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px;}
.as-tabs button.on{color:var(--blue); border-bottom-color:var(--blue);}
.as-tabs button:hover:not(.on){color:var(--text);}
`;

function AppleShell({ lang = 'TH', theme = 'light', activeNav = 'dashboard', crumb, ctaLabel, search, badge, children }) {
  const { NAV } = window.TS;
  const t = (th, en) => (lang === 'TH' ? th : en);
  return (
    <div className={'as-root ' + theme}>
      <style>{AS_CSS}</style>

      <aside className="as-sidebar">
        <div className="as-brand">
          <div className="logo">TS</div>
          <div>
            <div className="nm">Stock</div>
            <div className="sub">{t('สำนักงานใหญ่','Nakhon Sawan')}</div>
          </div>
        </div>

        <nav className="as-nav">
          <div className="as-sect">{t('พื้นที่ทำงาน','Workspace')}</div>
          {NAV.slice(0, 5).map((n) => (
            <div key={n.id} className={'as-item' + (n.id === activeNav ? ' active' : '')}>
              <span className="ico">{n.icon}</span>
              <span className="lab">{t(n.labelTH, n.labelEN)}</span>
              {n.badge && <span className="bdg">{n.badge}</span>}
            </div>
          ))}
          <div className="as-sect">{t('การจัดการ','Manage')}</div>
          {NAV.slice(5).map((n) => (
            <div key={n.id} className={'as-item' + (n.id === activeNav ? ' active' : '')}>
              <span className="ico">{n.icon}</span>
              <span className="lab">{t(n.labelTH, n.labelEN)}</span>
            </div>
          ))}
          <div className="as-sect">{t('ระบบ','System')}</div>
          <div className="as-item"><span className="ico">⚙</span><span className="lab">{t('ผู้ใช้และสิทธิ์','Users & roles')}</span></div>
          <div className="as-item"><span className="ico">⤓</span><span className="lab">{t('สำรองข้อมูล','Backup & export')}</span></div>
        </nav>

        <div className="as-userbox">
          <div className="av">A</div>
          <div style={{ flex:1 }}>
            <div className="nm">admin</div>
            <div className="ro">{t('ผู้ดูแลระบบ','Administrator')}</div>
          </div>
          <span style={{ color:'var(--dim)' }}>⋯</span>
        </div>
      </aside>

      <header className="as-topbar">
        <div className="as-crumb">
          <span>Workspace</span>
          <span>›</span>
          <span className="cur">{crumb || t('แดชบอร์ด','Dashboard')}</span>
        </div>
        <div className="as-search">
          <span style={{ fontSize:14 }}>⌕</span>
          <span style={{ flex:1 }}>{search || t('ค้นหา...','Search...')}</span>
          <span className="kbd">⌘K</span>
        </div>
        <div className="as-actions">
          <div className="as-iconbtn">⌥{badge && <div className="dot"></div>}</div>
          <div className="as-iconbtn">⚙</div>
          <button className="as-newbtn">+ {ctaLabel || t('สร้าง','New')}</button>
        </div>
      </header>

      <main className="as-main">
        {children}
      </main>
    </div>
  );
}

window.AppleShell = AppleShell;

// Apple Reports Page — 6 sub-tabs, Overview shown active

const AR_CSS = `
.ar-kpi{display:grid; grid-template-columns:repeat(4, 1fr); gap:14px;}
.ar-kpi .card{background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px 18px; box-shadow:var(--shadow); position:relative; overflow:hidden;}
.ar-kpi .card .lab{font-size:11.5px; color:var(--dim); display:flex; align-items:center; gap:6px;}
.ar-kpi .card .lab .ico{width:22px; height:22px; border-radius:6px; background:var(--blue-bg); color:var(--blue); display:flex; align-items:center; justify-content:center; font-size:12px;}
.ar-kpi .card .v{font-size:26px; font-weight:600; letter-spacing:-0.025em; margin:10px 0 4px;}
.ar-kpi .card .d{font-size:12px; color:var(--green);}

/* Bar chart (sales vs purchase) */
.ar-bigchart{display:grid; grid-template-columns:1fr 1fr; height:240px; gap:0;}
.ar-bigchart .ax{padding:18px 12px 18px 24px; display:flex; flex-direction:column; justify-content:space-between; color:var(--faint); font-size:11px; font-variant-numeric:tabular-nums;}
.ar-bars{flex:1; display:flex; align-items:end; gap:18px; padding:18px 24px; border-left:1px solid var(--line); position:relative;}
.ar-bars::before,.ar-bars::after{content:''; position:absolute; left:0; right:0; height:1px; background:var(--line);}
.ar-bars::before{top:33%;}
.ar-bars::after{top:66%;}
.ar-mb{flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%;}
.ar-mb .bars{display:flex; gap:3px; align-items:end; width:100%; max-width:42px; height:100%;}
.ar-mb .bars .s{flex:1; background:linear-gradient(180deg,var(--blue),#4fa3ff); border-radius:4px 4px 0 0; min-height:2px; position:relative;}
.ar-mb .bars .p{flex:1; background:var(--line2); border-radius:4px 4px 0 0; min-height:2px;}
.ar-mb .m{font-size:11.5px; color:var(--dim); font-weight:500;}

.ar-bigchart-wrap{position:relative; padding:18px 22px;}
.ar-bigchart-row{display:grid; grid-template-columns:56px 1fr; height:200px; gap:0;}
.ar-bigchart-row .yax{display:flex; flex-direction:column; justify-content:space-between; padding:6px 8px 6px 0; align-items:end; color:var(--faint); font-size:10.5px; font-variant-numeric:tabular-nums;}
.ar-bigchart-row .plot{flex:1; display:flex; align-items:end; gap:14px; padding:6px 8px 6px 0; border-left:1px solid var(--line); padding-left:14px; position:relative;}

.ar-bigchart-row .plot::before,.ar-bigchart-row .plot::after{content:''; position:absolute; left:14px; right:8px; height:1px; background:var(--line);}
.ar-bigchart-row .plot::before{top:33%;}
.ar-bigchart-row .plot::after{top:66%;}
.ar-bigchart-row .plot .gline{position:absolute; left:14px; right:8px; top:0; height:1px; background:var(--line);}

.ar-top-prod{padding:10px 12px;}
.ar-top-row{display:flex; align-items:center; gap:12px; padding:9px 10px; border-radius:8px;}
.ar-top-row:hover{background:var(--rowhover);}
.ar-top-row .rk{width:22px; height:22px; border-radius:50%; background:var(--bg); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:var(--dim);}
.ar-top-row.gold .rk{background:linear-gradient(135deg,#ffd60a,#ff9500); color:#fff; border-color:transparent;}
.ar-top-row.silver .rk{background:var(--hover2); color:var(--text); border-color:transparent;}
.ar-top-row.bronze .rk{background:linear-gradient(135deg,#ff9500,#ff3b30); color:#fff; border-color:transparent;}
.ar-top-row .mn{flex:1;}
.ar-top-row .mn .nm{font-size:13px; font-weight:500;}
.ar-top-row .mn .meta{font-size:11px; color:var(--dim); margin-top:2px;}
.ar-top-row .mn .bar{height:4px; margin-top:5px; background:var(--hover); border-radius:99px; overflow:hidden;}
.ar-top-row .mn .bar i{display:block; height:100%; background:var(--blue); border-radius:99px;}
.ar-top-row .val{text-align:right; font-weight:600; font-size:13px;}
.ar-top-row .val .sub{font-size:11px; color:var(--dim); font-weight:400;}

.ar-spcards{display:grid; grid-template-columns:repeat(2,1fr); gap:10px; padding:14px;}
.ar-sp{background:var(--bg); border:1px solid var(--line); border-radius:9px; padding:11px 13px;}
.ar-sp .top{display:flex; align-items:center; gap:9px; margin-bottom:8px;}
.ar-sp .top .av{width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--teal)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600;}
.ar-sp .top .nm{font-size:13px; font-weight:600;}
.ar-sp .top .sub{font-size:11px; color:var(--dim);}
.ar-sp .pct{margin-left:auto; font-size:14px; font-weight:600;}
.ar-sp .bar{height:5px; background:var(--hover); border-radius:99px; overflow:hidden;}
.ar-sp .bar i{display:block; height:100%; background:var(--blue); border-radius:99px;}
.ar-sp .bar i.ok{background:linear-gradient(90deg,var(--green),var(--teal));}
.ar-sp .bar i.warn{background:var(--orange);}
.ar-sp .nums{display:flex; justify-content:space-between; font-size:11px; color:var(--dim); margin-top:6px; font-variant-numeric:tabular-nums;}
.ar-sp .nums b{color:var(--text); font-weight:500;}
`;

function AppleReports({ lang = 'TH', theme = 'light' }) {
  const { MONTHLY, TARGETS } = window.TS;
  const t = (th, en) => (lang === 'TH' ? th : en);

  // Extend monthly data with 6 months synthesized + last 6 from existing
  const months = [
    { m: 'Nov 25', sales: 720,  purchase: 510 },
    { m: 'Dec 25', sales: 880,  purchase: 620 },
    { m: 'Jan 26', sales: 940,  purchase: 710 },
    { m: 'Feb 26', sales: 760,  purchase: 540 },
    { m: 'Mar 26', sales: 1120, purchase: 880 },
    { m: 'Apr 26', sales: 1340, purchase: 920 },
    { m: 'May 26', sales: 1210, purchase: 880 },
  ];
  const max = Math.max(...months.map((m) => Math.max(m.sales, m.purchase)));

  const topProducts = [
    { rank: 1, name: 'Samsung QLED TV 55"',     code: 'P002', units: 38, revenue: 1098200, pct: 100 },
    { rank: 2, name: 'LG OLED TV 65"',           code: 'P006', units: 14, revenue: 768600,  pct: 70 },
    { rank: 3, name: 'Daikin Inverter 12000BTU', code: 'P004', units: 32, revenue: 592000,  pct: 54 },
    { rank: 4, name: 'LG 2-Door Fridge 14Q',     code: 'P001', units: 41, revenue: 528900,  pct: 48 },
    { rank: 5, name: 'Mitsubishi 18000BTU',      code: 'P007', units: 18, revenue: 448200,  pct: 41 },
  ];

  return (
    <AppleShell lang={lang} theme={theme} activeNav="reports"
      crumb={t('รายงาน','Reports')} ctaLabel={t('ส่งออก','Export PDF')}
      search={t('ค้นหา...','Search…')} badge>
      <style>{AR_CSS}</style>

      <div className="as-pgh">
        <div>
          <h1>{t('รายงาน','Reports')}</h1>
          <div className="meta">
            {t('ภาพรวมและรายงานทางการเงิน · พฤษภาคม 2569','Operational and financial reports · May 2026')}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="as-input" defaultValue="thisMonth">
            <option value="thisMonth">{t('เดือนนี้','This month')}</option>
            <option>{t('ไตรมาส','Quarter')}</option>
            <option>{t('ปี','Year-to-date')}</option>
          </select>
          <button className="as-btn">⤓ {t('ส่งออก CSV','CSV')}</button>
          <button className="as-btn pri">🖨 {t('พิมพ์','Print')}</button>
        </div>
      </div>

      <div className="as-panel" style={{ padding:0 }}>
        <div className="as-tabs">
          <button className="on">{t('ภาพรวม','Overview')}</button>
          <button>{t('เปรียบเทียบเดือน','Compare')}</button>
          <button>{t('เป้ายอดขาย','Targets')}</button>
          <button>{t('สรุป VAT ตัวแทน','VAT Rep')}</button>
          <button>{t('Audit Log','Audit log')}</button>
          <button>{t('ประวัติราคา','Price history')}</button>
        </div>

        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:18 }}>
          <div className="ar-kpi">
            <div className="card">
              <div className="lab"><span className="ico">↗</span>{t('ยอดขาย YTD','Sales YTD')}</div>
              <div className="v as-num">฿ 6.97M</div>
              <div className="d">↗ +24.1% YoY</div>
            </div>
            <div className="card">
              <div className="lab"><span className="ico" style={{ background:'rgba(52,199,89,0.12)', color:'var(--green)' }}>💎</span>{t('กำไรขั้นต้น YTD','Gross profit YTD')}</div>
              <div className="v as-num">฿ 1.71M</div>
              <div className="d">{t('อัตรากำไร','margin')} 24.6%</div>
            </div>
            <div className="card">
              <div className="lab"><span className="ico" style={{ background:'rgba(255,149,0,0.14)', color:'var(--orange)' }}>⊟</span>{t('จำนวนใบสั่ง','Order count')}</div>
              <div className="v as-num">312</div>
              <div className="d" style={{ color:'var(--dim)' }}>{t('เฉลี่ย','avg')} <span className="as-num">฿ 22.3K</span>/SO</div>
            </div>
            <div className="card">
              <div className="lab"><span className="ico" style={{ background:'rgba(175,82,222,0.12)', color:'var(--purple)' }}>◰</span>{t('SKU ที่ขายดี','Top SKUs')}</div>
              <div className="v as-num">38</div>
              <div className="d" style={{ color:'var(--dim)' }}>{t('คิดเป็น','of')} 80% {t('ของยอดขาย','of revenue')}</div>
            </div>
          </div>

          <div className="as-panel" style={{ boxShadow:'none' }}>
            <div className="as-ph">
              <div>
                <div className="t">{t('ยอดขายเทียบยอดซื้อ','Sales vs. purchases')}</div>
                <div className="sub">{t('7 เดือนล่าสุด · ฿ × 1,000','Last 7 months · ฿ × 1,000')}</div>
              </div>
              <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--dim)' }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><i style={{ width:10, height:10, borderRadius:3, background:'linear-gradient(180deg,var(--blue),#4fa3ff)' }}></i>{t('ยอดขาย','Sales')}</span>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}><i style={{ width:10, height:10, borderRadius:3, background:'var(--line2)' }}></i>{t('สั่งซื้อ','Purchases')}</span>
              </div>
            </div>
            <div className="ar-bigchart-wrap">
              <div className="ar-bigchart-row">
                <div className="yax">
                  <span>1.5M</span>
                  <span>1.0M</span>
                  <span>500K</span>
                  <span>0</span>
                </div>
                <div className="plot">
                  {months.map((m) => (
                    <div key={m.m} className="ar-mb">
                      <div className="bars">
                        <div className="s" style={{ height:(m.sales / max * 100) + '%' }}></div>
                        <div className="p" style={{ height:(m.purchase / max * 100) + '%' }}></div>
                      </div>
                      <div className="m">{m.m}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:18 }}>
            <div className="as-panel" style={{ boxShadow:'none' }}>
              <div className="as-ph">
                <div>
                  <div className="t">🏆 {t('สินค้าขายดี Top 5','Top 5 products')}</div>
                  <div className="sub">{t('ตามยอดขายเดือนนี้','By revenue · this month')}</div>
                </div>
                <span className="a">→</span>
              </div>
              <div className="ar-top-prod">
                {topProducts.map((p) => (
                  <div key={p.code} className={'ar-top-row ' + (p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : '')}>
                    <div className="rk">{p.rank}</div>
                    <div className="mn">
                      <div className="nm">{p.name}</div>
                      <div className="meta"><span className="as-num">{p.code}</span> · <span className="as-num">{p.units}</span> {t('เครื่อง','units')}</div>
                      <div className="bar"><i style={{ width:p.pct + '%' }}></i></div>
                    </div>
                    <div className="val">
                      <div className="as-num">฿ {(p.revenue/1000).toFixed(1)}K</div>
                      <div className="sub">{p.pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="as-panel" style={{ boxShadow:'none' }}>
              <div className="as-ph">
                <div>
                  <div className="t">{t('เป้าพนักงานขาย','Salesperson targets')}</div>
                  <div className="sub">{t('พฤษภาคม 2569','May 2026')}</div>
                </div>
                <span className="a">→</span>
              </div>
              <div className="ar-spcards">
                {TARGETS.map((tg) => {
                  const over = tg.pct >= 100;
                  const warn = tg.pct < 75;
                  return (
                    <div key={tg.name} className="ar-sp">
                      <div className="top">
                        <div className="av">{tg.nameEN[0]}</div>
                        <div>
                          <div className="nm">{t(tg.name, tg.nameEN)}</div>
                          <div className="sub">{t('Sales','Sales')}</div>
                        </div>
                        <span className="pct as-num" style={{ color: over ? 'var(--green)' : warn ? 'var(--orange)' : 'var(--text)' }}>
                          {tg.pct.toFixed(0)}%{over && ' 🎉'}
                        </span>
                      </div>
                      <div className="bar">
                        <i className={over ? 'ok' : warn ? 'warn' : ''} style={{ width:Math.min(100, tg.pct) + '%' }}></i>
                      </div>
                      <div className="nums">
                        <span><b className="as-num">฿ {(tg.achieved/1000).toFixed(0)}K</b></span>
                        <span>{t('เป้า','of')} <b className="as-num">฿ {(tg.target/1000).toFixed(0)}K</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Compact preview cards for other tabs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            <div className="as-panel" style={{ padding:'14px 16px', boxShadow:'none' }}>
              <div style={{ fontSize:12.5, color:'var(--dim)', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>🧾 {t('สรุป VAT รายตัวแทน','VAT by representative')}</div>
              <div style={{ fontSize:22, fontWeight:600, letterSpacing:'-0.02em', marginTop:8 }} className="as-num">฿ 487,200</div>
              <div style={{ fontSize:11.5, color:'var(--dim)', marginTop:4 }}>
                <b style={{ color:'var(--text)' }}>3</b> {t('ตัวแทนหลัก','representatives')} · <b style={{ color:'var(--text)' }}>28</b> SO · YTD
              </div>
            </div>
            <div className="as-panel" style={{ padding:'14px 16px', boxShadow:'none' }}>
              <div style={{ fontSize:12.5, color:'var(--dim)', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>📋 Audit Log</div>
              <div style={{ fontSize:22, fontWeight:600, letterSpacing:'-0.02em', marginTop:8 }} className="as-num">1,284 <span style={{ fontSize:12, color:'var(--dim)', fontWeight:400 }}>{t('การกระทำ','actions')}</span></div>
              <div style={{ fontSize:11.5, color:'var(--dim)', marginTop:4 }}>
                {t('วันนี้','today')} <b style={{ color:'var(--text)' }} className="as-num">42</b> · {t('ผู้ใช้','users')} <b style={{ color:'var(--text)' }} className="as-num">4</b>
              </div>
            </div>
            <div className="as-panel" style={{ padding:'14px 16px', boxShadow:'none' }}>
              <div style={{ fontSize:12.5, color:'var(--dim)', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>📈 {t('ประวัติราคา','Price history')}</div>
              <div style={{ fontSize:22, fontWeight:600, letterSpacing:'-0.02em', marginTop:8 }} className="as-num">23 <span style={{ fontSize:12, color:'var(--dim)', fontWeight:400 }}>{t('การเปลี่ยนแปลง','changes')}</span></div>
              <div style={{ fontSize:11.5, color:'var(--dim)', marginTop:4 }}>
                {t('ราคาขาย','price')} <b style={{ color:'var(--text)' }} className="as-num">14</b> · {t('ต้นทุน','cost')} <b style={{ color:'var(--text)' }} className="as-num">9</b> · {t('30 วัน','30d')}
              </div>
            </div>
          </div>

        </div>
      </div>

    </AppleShell>
  );
}

window.AppleReports = AppleReports;

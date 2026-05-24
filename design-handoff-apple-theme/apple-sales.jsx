// Apple Sales Page — SO list + create-SO modal preview

const ASA_CSS = `
/* Theme tokens (mirrored from apple-shell so siblings of <AppleShell> also resolve them) */
.asa-root.light{
  --bg:#f5f5f7; --bg2:#ffffff; --panel:#ffffff; --hover:#f5f5f7; --hover2:#ebebed;
  --line:#e5e5ea; --line2:#d2d2d7;
  --text:#1d1d1f; --dim:#6e6e73; --faint:#86868b;
  --blue:#0071e3; --blue-bg:rgba(0,113,227,0.08); --blue-hover:#0077ed;
  --green:#34c759; --orange:#ff9500; --red:#ff3b30; --teal:#5ac8fa; --purple:#af52de;
  color:var(--text);
}
.asa-root.dark{
  --bg:#1c1c1e; --bg2:#2c2c2e; --panel:#2c2c2e; --hover:#3a3a3c; --hover2:#48484a;
  --line:#38383a; --line2:#48484a;
  --text:#f5f5f7; --dim:#98989d; --faint:#6c6c70;
  --blue:#0a84ff; --blue-bg:rgba(10,132,255,0.16); --blue-hover:#409cff;
  --green:#30d158; --orange:#ff9f0a; --red:#ff453a; --teal:#64d2ff; --purple:#bf5af2;
  color:var(--text);
}

.asa-tabs{display:flex; gap:0; border-bottom:1px solid var(--line); padding:0 18px;}
.asa-tabs button{padding:11px 16px; border:0; background:transparent; color:var(--dim); font:inherit; font-size:13.5px; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px;}
.asa-tabs button.on{color:var(--blue); border-bottom-color:var(--blue);}
.asa-tabs button .ct{margin-left:6px; font-size:11px; padding:1px 7px; background:var(--hover); color:var(--dim); border-radius:99px; font-weight:600;}
.asa-tabs button.on .ct{background:var(--blue); color:#fff;}

.asa-statrow{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.asa-stat{background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px 18px; box-shadow:var(--shadow);}
.asa-stat .lab{font-size:12px; color:var(--dim);}
.asa-stat .v{font-size:24px; font-weight:600; letter-spacing:-0.02em; margin-top:6px;}
.asa-stat .d{font-size:12px; color:var(--green); margin-top:3px;}

.asa-cust{display:flex; align-items:center; gap:10px;}
.asa-cust .av{width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--teal)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; flex-shrink:0;}
.asa-cust .nm{font-weight:500;}
.asa-cust .sub{font-size:11px; color:var(--dim);}

.asa-num-cell{font-family:'JetBrains Mono',ui-monospace,monospace; font-size:12px; color:var(--blue); font-weight:600;}

/* Backdrop scrim — dims + slightly blurs the page so the modal pops */
.asa-backdrop{position:absolute; inset:0; background:rgba(0,0,0,0.45); backdrop-filter:blur(6px) saturate(140%); -webkit-backdrop-filter:blur(6px) saturate(140%); z-index:4;}
.asa-root.light .asa-backdrop{background:rgba(0,0,0,0.28);}

/* Floating create-SO modal */
.asa-modalwrap{position:absolute; right:32px; bottom:28px; z-index:5; pointer-events:none;}
.asa-modal{width:460px; background:var(--panel); border:1px solid var(--line2); border-radius:14px; box-shadow:0 32px 80px rgba(0,0,0,0.45),0 0 0 0.5px rgba(0,0,0,0.06); overflow:hidden; pointer-events:auto;}
.asa-root.dark .asa-modal{box-shadow:0 32px 80px rgba(0,0,0,0.7),0 0 0 0.5px rgba(255,255,255,0.08);}
.asa-modal-h{display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid var(--line); background:var(--panel);}
.asa-modal-h .t{font-size:15px; font-weight:600; letter-spacing:-0.01em; color:var(--text);}
.asa-modal-h .x{color:var(--dim); cursor:pointer; font-size:14px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px;}
.asa-modal-h .x:hover{background:var(--hover);}
.asa-modal-b{padding:14px 18px; display:flex; flex-direction:column; gap:12px; max-height:520px; overflow:auto; background:var(--panel);}
.asa-modal-f{padding:12px 18px; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:flex-end; background:var(--bg);}

.asa-field{display:flex; flex-direction:column; gap:5px;}
.asa-field label{font-size:11.5px; color:var(--dim); font-weight:500;}
.asa-field input,.asa-field select{background:var(--bg2); border:1px solid var(--line); color:var(--text); font:inherit; font-size:13px; padding:7px 10px; border-radius:7px; width:100%; box-sizing:border-box;}
.asa-field input:focus,.asa-field select:focus{outline:0; border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-bg);}
.asa-tworow{display:grid; grid-template-columns:1fr 1fr; gap:10px;}

.asa-item{background:var(--bg); border:1px solid var(--line); border-radius:9px; padding:10px 12px; color:var(--text);}
.asa-item .row1{display:flex; gap:8px; align-items:start; margin-bottom:8px;}
.asa-item .pp{flex:1; background:var(--bg2); border:1px solid var(--line); border-radius:7px; padding:7px 10px; font-size:12.5px; display:flex; justify-content:space-between; align-items:center; color:var(--text);}
.asa-item .pp .ms{font-size:11px; color:var(--dim);}
.asa-item .pp .ms b{color:var(--green);}
.asa-item .pp .ms.warn b{color:var(--red);}
.asa-item .rm{color:var(--red); cursor:pointer; font-size:18px; padding:4px 6px;}

.asa-add-item{display:inline-flex; align-items:center; gap:5px; padding:6px 10px; border-radius:7px; border:1px dashed var(--line2); background:transparent; color:var(--blue); font-size:12px; cursor:pointer; font:inherit;}

.asa-payseg{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
.asa-payseg label{display:flex; align-items:center; gap:8px; padding:9px 12px; border:1.5px solid var(--line); border-radius:9px; cursor:pointer; font-size:13px; font-weight:500; color:var(--text);}
.asa-payseg label.on{border-color:var(--blue); background:var(--blue-bg); color:var(--blue);}
.asa-chips{display:flex; gap:5px; flex-wrap:wrap;}
.asa-chips .c{padding:4px 11px; border-radius:99px; border:1.5px solid var(--line); background:var(--bg2); font-size:11.5px; cursor:pointer; font-weight:500; color:var(--text);}
.asa-chips .c.on{border-color:var(--blue); background:var(--blue-bg); color:var(--blue);}

.asa-totals{background:var(--bg); border-radius:9px; padding:10px 14px; border:1px solid var(--line);}
.asa-totals .r{display:flex; justify-content:space-between; font-size:12.5px; padding:3px 0; color:var(--dim);}
.asa-totals .r .v{color:var(--text); font-weight:500;}
.asa-totals .r.total{border-top:1px solid var(--line); margin-top:6px; padding-top:8px; font-size:14.5px;}
.asa-totals .r.total .lab{font-weight:600; color:var(--text);}
.asa-totals .r.total .v{color:var(--blue); font-weight:600; font-size:16px;}
.asa-totals .r.disc .v{color:var(--green);}

.asa-vatrep{background:var(--blue-bg); border:1px solid transparent; border-radius:9px; padding:10px 12px;}
.asa-vatrep .top{display:flex; align-items:center; gap:8px;}
.asa-vatrep .top input{accent-color:var(--blue);}
.asa-vatrep .top .lab{font-size:12.5px; font-weight:600; color:var(--blue);}
`;

function AppleSales({ lang = 'TH', theme = 'light' }) {
  const { SALES } = window.TS;
  const t = (th, en) => (lang === 'TH' ? th : en);

  // Stats
  const totalMTD = SALES.reduce((s, x) => s + x.amount, 0);
  const pending = SALES.filter((s) => s.status === 'pending_delivery').length;
  const completed = SALES.filter((s) => s.status === 'completed').length;
  const cashCount = SALES.filter((s) => s.pay === 'cash').length;
  const creditCount = SALES.filter((s) => s.pay === 'credit').length;

  return (
    <div className={'asa-root ' + theme} style={{ width:'100%', height:'100%', position:'relative' }}>
    <AppleShell lang={lang} theme={theme} activeNav="sales"
      crumb={t('การขาย','Sales')} ctaLabel={t('สร้างใบสั่งขาย','New sales order')}
      search={t('ค้นหา SO, QT, ลูกค้า...','Search SO, QT, customer…')} badge>
      <style>{ASA_CSS}</style>

      <div className="as-pgh">
        <div>
          <h1>{t('การขาย','Sales')}</h1>
          <div className="meta">
            {t('ใบสั่งขาย (SO) และใบเสนอราคา (QT) ทั้งหมด','All sales orders & quotations')}
          </div>
        </div>
        <div className="as-segctl">
          <button>{t('สัปดาห์','Week')}</button>
          <button className="on">{t('เดือน','Month')}</button>
          <button>{t('ปี','Year')}</button>
        </div>
      </div>

      <div className="asa-statrow">
        <div className="asa-stat">
          <div className="lab">{t('ยอดขายเดือนนี้','Sales this month')}</div>
          <div className="v as-num">฿ {totalMTD.toLocaleString()}</div>
          <div className="d">↗ +18.4% MoM</div>
        </div>
        <div className="asa-stat">
          <div className="lab">{t('จำนวนใบสั่ง','Order count')}</div>
          <div className="v as-num">{SALES.length}</div>
          <div className="d" style={{ color:'var(--dim)' }}>{completed} {t('ปิดแล้ว','closed')} · {pending} {t('รอส่ง','pending')}</div>
        </div>
        <div className="asa-stat">
          <div className="lab">{t('เงินสด vs เครดิต','Cash vs credit')}</div>
          <div className="v as-num">{cashCount} <span style={{ fontSize:14, color:'var(--dim)', fontWeight:400 }}>: {creditCount}</span></div>
          <div className="d" style={{ color:'var(--dim)' }}>{t('เงินสด','cash')} : {t('เครดิต','credit')}</div>
        </div>
        <div className="asa-stat">
          <div className="lab">{t('ใบเสนอราคารอตอบ','QTs awaiting')}</div>
          <div className="v as-num">7</div>
          <div className="d" style={{ color:'var(--orange)' }}>⚠ 2 {t('หมดอายุภายใน 3 วัน','expire ≤ 3d')}</div>
        </div>
      </div>

      <div className="as-panel" style={{ padding:0 }}>
        <div className="asa-tabs">
          <button className="on">{t('ใบสั่งขาย (SO)','Sales Orders')} <span className="ct">{SALES.length}</span></button>
          <button>{t('ใบเสนอราคา (QT)','Quotations')} <span className="ct">12</span></button>
          <button>{t('สรุปรายเดือน','Monthly summary')}</button>
          <button>{t('ตามพนักงาน','Per salesperson')}</button>
        </div>

        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--line)' }}>
          <div className="as-toolbar">
            <div className="as-chip on"><span>{t('ทั้งหมด','All')}</span><span className="cnt as-num">{SALES.length}</span></div>
            <div className="as-chip"><span style={{ color:'var(--orange)' }}>●</span><span>{t('รอส่งสินค้า','Pending')}</span><span className="cnt as-num">{pending}</span></div>
            <div className="as-chip"><span style={{ color:'var(--green)' }}>●</span><span>{t('ส่งแล้ว','Completed')}</span><span className="cnt as-num">{completed}</span></div>
            <div className="as-chip"><span>💵</span><span>{t('เงินสด','Cash')}</span><span className="cnt as-num">{cashCount}</span></div>
            <div className="as-chip"><span>🗓</span><span>{t('เครดิต','Credit')}</span><span className="cnt as-num">{creditCount}</span></div>
            <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              <input className="as-input" placeholder={t('ค้นหา SO...','Filter SOs…')} style={{ width:200 }} />
              <button className="as-btn">⤓ {t('ส่งออก','Export')}</button>
            </div>
          </div>
        </div>

        <table className="as-tbl">
          <thead>
            <tr>
              <th style={{ width:140 }}>SO Number</th>
              <th>{t('ลูกค้า','Customer')}</th>
              <th>{t('พนักงาน','Salesperson')}</th>
              <th style={{ width:80, textAlign:'center' }}>{t('รายการ','Items')}</th>
              <th style={{ width:130, textAlign:'right' }}>{t('ยอดสุทธิ','Amount')}</th>
              <th style={{ width:100 }}>{t('การชำระ','Payment')}</th>
              <th style={{ width:120 }}>{t('สถานะ','Status')}</th>
              <th style={{ width:80, textAlign:'right' }}>{t('วันที่','Date')}</th>
              <th style={{ width:40 }}></th>
            </tr>
          </thead>
          <tbody>
            {SALES.map((s) => (
              <tr key={s.num} className="row">
                <td><span className="asa-num-cell">{s.num}</span></td>
                <td>
                  <div className="asa-cust">
                    <div className="av">{s.customer.charAt(0)}</div>
                    <div>
                      <div className="nm">{s.customer}</div>
                      <div className="sub">{s.vat && 'VAT 7% · '}{s.pay === 'cash' ? t('เงินสด','cash') : t('เครดิต','credit')}</div>
                    </div>
                  </div>
                </td>
                <td>{s.sp}</td>
                <td style={{ textAlign:'center' }}><span className="as-pill neutral as-num">{s.items}</span></td>
                <td style={{ textAlign:'right', fontWeight:600 }} className="as-num">฿ {s.amount.toLocaleString()}</td>
                <td>
                  {s.pay === 'cash'
                    ? <span className="as-pill green"><span className="dot"></span>{t('เงินสด','Cash')}</span>
                    : <span className="as-pill blue"><span className="dot"></span>{t('เครดิต','Credit')}</span>}
                </td>
                <td>
                  {s.status === 'completed'
                    ? <span className="as-pill green"><span className="dot"></span>{t('ส่งแล้ว','Completed')}</span>
                    : <span className="as-pill orange"><span className="dot"></span>{t('รอส่งสินค้า','Pending')}</span>}
                </td>
                <td style={{ textAlign:'right', color:'var(--dim)' }} className="as-num">{s.date}</td>
                <td style={{ textAlign:'right' }}><span style={{ color:'var(--dim)', cursor:'pointer' }}>⋯</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', color:'var(--dim)', fontSize:12.5, padding:'0 4px' }}>
        <span><b className="as-num" style={{ color:'var(--text)' }}>{SALES.length}</b> {t('รายการทั้งหมด','total')} · {t('แสดง','showing')} 1–{SALES.length}</span>
        <span>{t('สำรองข้อมูลล่าสุด','Last backup')} 14:00 · auto-save <b style={{ color:'var(--green)' }}>ON</b></span>
      </div>

      </AppleShell>

      {/* Backdrop scrim — dims the page behind the create-SO modal */}
      <div className="asa-backdrop"></div>

      {/* Floating "Create SO" modal — shown statically to preview the flow */}
      <div className="asa-modalwrap">
        <div className="asa-modal">
          <div className="asa-modal-h">
            <div className="t">+ {t('สร้างใบสั่งขายใหม่','New sales order')}</div>
            <div className="x">✕</div>
          </div>
          <div className="asa-modal-b">

            <div className="asa-tworow">
              <div className="asa-field">
                <label>{t('ลูกค้า','Customer')} <span style={{ color:'var(--red)' }}>*</span></label>
                <select defaultValue="3">
                  <option value="3">เชียงใหม่บิลเดอร์ — สมชาย</option>
                </select>
              </div>
              <div className="asa-field">
                <label>{t('วันที่','Date')}</label>
                <input type="date" defaultValue="2026-05-15" />
              </div>
            </div>

            <div className="asa-item">
              <div className="row1">
                <div className="pp">
                  <span><b>P001</b> · ตู้เย็น LG 2 ประตู 14 คิว</span>
                  <span className="ms">{t('คงเหลือ','avail')} <b>8</b></span>
                </div>
                <span className="rm">✕</span>
              </div>
              <div className="asa-tworow">
                <div className="asa-field">
                  <label>{t('จำนวน','Qty')}</label>
                  <input type="number" defaultValue="2" />
                </div>
                <div className="asa-field">
                  <label>{t('ราคา (฿)','Price (฿)')}</label>
                  <input type="number" defaultValue="12900" />
                </div>
              </div>
            </div>

            <div className="asa-item" style={{ borderColor:'var(--orange)' }}>
              <div className="row1">
                <div className="pp">
                  <span><b>P004</b> · แอร์ Daikin อินเวอร์เตอร์ 12000 BTU</span>
                  <span className="ms warn">{t('คงเหลือ','avail')} <b>6</b></span>
                </div>
                <span className="rm">✕</span>
              </div>
              <div className="asa-tworow">
                <div className="asa-field">
                  <label>{t('จำนวน','Qty')}</label>
                  <input type="number" defaultValue="1" />
                </div>
                <div className="asa-field">
                  <label>{t('ราคา (฿)','Price (฿)')}</label>
                  <input type="number" defaultValue="18500" />
                </div>
              </div>
            </div>

            <button className="asa-add-item">+ {t('เพิ่มสินค้า','Add item')}</button>

            <div>
              <div className="asa-payseg" style={{ marginBottom:10 }}>
                <label className="on"><input type="radio" name="pp" defaultChecked />💵 {t('เงินสด','Cash')}</label>
                <label><input type="radio" name="pp" />🗓 {t('เครดิต','Credit')}</label>
              </div>

              <div className="asa-field" style={{ marginBottom:10 }}>
                <label>{t('ส่วนลดเงินสด','Cash discount')}</label>
                <div className="asa-chips">
                  <span className="c">{t('ไม่ลด','None')}</span>
                  <span className="c on">1%</span>
                  <span className="c">2%</span>
                  <span className="c">3%</span>
                  <span className="c">5%</span>
                </div>
              </div>

              <div className="asa-totals">
                <div className="r"><span>{t('ยอดรวม','Subtotal')}</span><span className="v as-num">฿ 44,300</span></div>
                <div className="r disc"><span>{t('ส่วนลด 1%','Discount 1%')}</span><span className="v as-num">−฿ 443</span></div>
                <div className="r"><span>✓ VAT 7%</span><span className="v as-num">฿ 2,867</span></div>
                <div className="r total"><span className="lab">{t('ยอดสุทธิ','Net total')}</span><span className="v as-num">฿ 43,857</span></div>
              </div>
            </div>

            <div className="asa-vatrep">
              <div className="top">
                <input type="checkbox" defaultChecked />
                <span className="lab">🧾 {t('ออก VAT ให้ตัวแทน','Issue VAT to representative')}</span>
              </div>
              <div className="asa-field" style={{ marginTop:8 }}>
                <select defaultValue="1">
                  <option value="1">นายสมศักดิ์ วิชาการ · 1100100100001</option>
                </select>
              </div>
            </div>
          </div>
          <div className="asa-modal-f">
            <button className="as-btn">{t('ยกเลิก','Cancel')}</button>
            <button className="as-btn pri">✓ {t('บันทึก SO','Save SO')}</button>
          </div>
        </div>
      </div>

    </div>
  );
}

window.AppleSales = AppleSales;

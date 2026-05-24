// Apple Products Page — brand-grouped product cards with stock status filters

const AP_CSS = `
.ap-toolbar-row{display:flex; gap:10px; align-items:center; flex-wrap:wrap;}
.ap-search{flex:1; min-width:240px; max-width:380px; position:relative;}
.ap-search .as-input{padding-left:34px; width:100%; box-sizing:border-box;}
.ap-search .ico{position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--dim); font-size:14px; pointer-events:none;}

.ap-brandgrp{margin-bottom:0;}
.ap-brandhead{display:flex; align-items:center; gap:12px; padding:0 4px 14px; margin-top:8px;}
.ap-brandhead .nm{font-size:18px; font-weight:600; letter-spacing:-0.015em;}
.ap-brandhead .ct{font-size:12px; color:var(--dim); background:var(--bg2); border:1px solid var(--line); padding:2px 9px; border-radius:99px; font-weight:500;}
.ap-brandhead .ln{flex:1; height:1px; background:var(--line);}
.ap-brandhead .agg{font-size:12px; color:var(--dim);}
.ap-brandhead .agg b{color:var(--text); font-weight:600;}

.ap-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px;}

.ap-card{background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px; box-shadow:var(--shadow); transition:border-color .12s;}
.ap-card:hover{border-color:var(--line2);}
.ap-card .top{display:flex; gap:10px; align-items:flex-start;}
.ap-card .thumb{width:42px; height:42px; border-radius:9px; background:var(--bg); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; color:var(--dim); font-size:18px; flex-shrink:0;}
.ap-card .top .info{flex:1; min-width:0;}
.ap-card .top .info .cd{font-size:11px; color:var(--faint); font-family:'JetBrains Mono',ui-monospace,monospace;}
.ap-card .top .info .nm{font-size:13.5px; font-weight:600; line-height:1.3; margin-top:2px;}
.ap-card .meta-row{display:flex; flex-wrap:wrap; gap:5px; align-items:center;}
.ap-card .meta-row .tag{font-size:11px; padding:2px 8px; border-radius:99px; background:var(--bg); color:var(--dim); border:1px solid var(--line); font-weight:500;}
.ap-card .meta-row .tag.size{background:var(--blue-bg); color:var(--blue); border-color:transparent;}

.ap-card .stockrow{display:flex; justify-content:space-between; align-items:end; font-size:12px;}
.ap-card .stockrow .lab{color:var(--dim); font-size:11.5px;}
.ap-card .stockrow .val{font-weight:600;}
.ap-card .stockrow .val b{font-size:18px; font-weight:600; letter-spacing:-0.01em;}
.ap-card .stockrow .val .min{color:var(--dim); font-weight:400; font-size:11.5px;}
.ap-card .stockbar{height:5px; background:var(--hover); border-radius:99px; overflow:hidden;}
.ap-card .stockbar i{display:block; height:100%; background:var(--green); border-radius:99px;}
.ap-card .stockbar i.red{background:var(--red);}
.ap-card .stockbar i.orange{background:var(--orange);}

.ap-card .pricerow{display:flex; justify-content:space-between; align-items:end; padding-top:8px; border-top:1px solid var(--line); margin-top:auto;}
.ap-card .pricerow .price{font-size:18px; font-weight:600; letter-spacing:-0.015em;}
.ap-card .pricerow .cost{font-size:11.5px; color:var(--dim);}
.ap-card .pricerow .cost b{color:var(--text); font-weight:500;}

.ap-card .actions{display:flex; gap:6px;}
.ap-card .actions button{flex:1;}

.ap-card .dist{font-size:11px; color:var(--dim); display:flex; align-items:center; gap:5px;}
`;

function AppleProducts({ lang = 'TH', theme = 'light' }) {
  const { PRODUCTS, BRANDS, CATS, stockStatus } = window.TS;
  const t = (th, en) => (lang === 'TH' ? th : en);

  // Filters
  const [stat, setStat] = React.useState('');

  // group by brand
  const byBrand = {};
  PRODUCTS.forEach((p) => {
    const ss = stockStatus(p.daysLastSold);
    if (stat && ss.key !== stat) return;
    if (!byBrand[p.brand]) byBrand[p.brand] = [];
    byBrand[p.brand].push({ ...p, ss });
  });

  const brandOrder = BRANDS.filter((b) => byBrand[b]);
  const totalCount = Object.values(byBrand).reduce((s, l) => s + l.length, 0);
  const totalValue = Object.values(byBrand).flat().reduce((s, p) => s + p.stock * p.cost, 0);

  const catIcon = (catId) => (CATS.find((c) => c.id === catId) || {}).icon || '◰';
  const catName = (catId) => {
    const c = CATS.find((cc) => cc.id === catId);
    return c ? t(c.name, c.nameEN) : '';
  };

  const filters = [
    { key: '',       label: t('ทั้งหมด','All'),   icon: '◯',  color: 'var(--dim)' },
    { key: 'active', label: 'Active', icon: '🟢', color: 'var(--green)' },
    { key: 'slow',   label: 'Slow',   icon: '🟡', color: 'var(--orange)' },
    { key: 'dead',   label: 'Dead',   icon: '🔴', color: 'var(--red)' },
    { key: 'fossil', label: 'Fossil', icon: '⚫', color: 'var(--faint)' },
  ];

  return (
    <AppleShell lang={lang} theme={theme} activeNav="products"
      crumb={t('สินค้า','Products')} ctaLabel={t('เพิ่มสินค้า','Add product')}
      search={t('ค้นหาสินค้า, รหัส, ยี่ห้อ...','Search products, SKU, brand…')} badge>
      <style>{AP_CSS}</style>

      <div className="as-pgh">
        <div>
          <h1>{t('สินค้า','Products')}</h1>
          <div className="meta">
            <b style={{ color:'var(--text)', fontWeight:600 }} className="as-num">{totalCount}</b> {t('รายการ','items')} ·
            {' '}<b style={{ color:'var(--text)', fontWeight:600 }} className="as-num">{BRANDS.length}</b> {t('ยี่ห้อ','brands')} ·
            {' '}{t('มูลค่าสต็อก','stock value')} <b style={{ color:'var(--text)', fontWeight:600 }} className="as-num">฿ {(totalValue/1000).toFixed(1)}K</b>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="as-btn">⚙ {t('จัดการหมวด','Manage categories')}</button>
          <button className="as-btn">⤓ {t('ส่งออก CSV','Export CSV')}</button>
        </div>
      </div>

      <div className="as-toolbar ap-toolbar-row">
        <div className="ap-search">
          <span className="ico">⌕</span>
          <input className="as-input" placeholder={t('ค้นหาชื่อ, รหัส, ยี่ห้อ...','Search by name, SKU, brand…')} />
        </div>
        <select className="as-input" style={{ minWidth:130 }} defaultValue="">
          <option value="">{t('ทุกยี่ห้อ','All brands')}</option>
          {BRANDS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select className="as-input" style={{ minWidth:130 }} defaultValue="">
          <option value="">{t('ทุกหมวด','All categories')}</option>
          {CATS.map((c) => <option key={c.id}>{t(c.name, c.nameEN)}</option>)}
        </select>
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          {filters.map((f) => {
            const count = f.key === '' ? PRODUCTS.length : PRODUCTS.filter((p) => stockStatus(p.daysLastSold).key === f.key).length;
            return (
              <div key={f.key} className={'as-chip' + (stat === f.key ? ' on' : '')} onClick={() => setStat(f.key)}>
                <span>{f.icon}</span>
                <span>{f.label}</span>
                <span className="cnt as-num">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {brandOrder.map((brand) => {
        const items = byBrand[brand];
        const brandValue = items.reduce((s, p) => s + p.stock * p.cost, 0);
        return (
          <div key={brand} className="ap-brandgrp">
            <div className="ap-brandhead">
              <div className="nm">{brand}</div>
              <div className="ct">{items.length} {t('รายการ','SKUs')}</div>
              <div className="ln"></div>
              <div className="agg">
                {t('สต็อกรวม','total stock')} <b className="as-num">{items.reduce((s, p) => s + p.stock, 0)}</b>
                {' · '}{t('มูลค่า','value')} <b className="as-num">฿ {(brandValue/1000).toFixed(1)}K</b>
              </div>
            </div>

            <div className="ap-grid">
              {items.map((p) => {
                const crit = p.stock === 0;
                const low = p.stock <= p.minStock;
                const pct = p.minStock > 0 ? Math.min(100, (p.stock / p.minStock) * 100) : 100;
                const stockCls = crit ? 'red' : low ? 'orange' : '';
                return (
                  <div key={p.id} className="ap-card">
                    <div className="top">
                      <div className="thumb">{catIcon(p.catId)}</div>
                      <div className="info">
                        <div className="cd">{p.code}</div>
                        <div className="nm">{lang === 'TH' ? p.nameT : p.name}</div>
                      </div>
                    </div>

                    <div className="meta-row">
                      <span className={'as-pill ' + (p.ss.key === 'active' ? 'green' : p.ss.key === 'slow' ? 'orange' : p.ss.key === 'dead' ? 'red' : 'gray')}>
                        <span className="dot"></span>{p.ss.label}
                      </span>
                      <span className="tag">{catName(p.catId)}</span>
                      {p.size && <span className="tag size">{p.size}</span>}
                    </div>

                    <div>
                      <div className="stockrow" style={{ marginBottom:5 }}>
                        <span className="lab">{t('สต็อก','Stock')}</span>
                        <span className="val">
                          <b className="as-num" style={{ color:crit ? 'var(--red)' : low ? 'var(--orange)' : 'var(--text)' }}>{p.stock}</b>
                          <span className="min as-num"> / {p.minStock} {t('เครื่อง','pcs')}</span>
                        </span>
                      </div>
                      <div className="stockbar"><i className={stockCls} style={{ width:pct + '%' }}></i></div>
                    </div>

                    <div className="pricerow">
                      <div>
                        <div className="cost">{t('ราคาขาย','Price')}</div>
                        <div className="price as-num">฿ {p.price.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div className="cost">{t('ต้นทุน','Cost')}</div>
                        <div className="cost"><b className="as-num">฿ {p.cost.toLocaleString()}</b></div>
                      </div>
                    </div>

                    {p.distributor && (
                      <div className="dist">
                        <span>🏭</span><span>{p.distributor}</span>
                      </div>
                    )}

                    <div className="actions">
                      <button className="as-btn sm">✏ {t('แก้ไข','Edit')}</button>
                      <button className="as-btn sm">🔧 {t('สต็อก','Adjust')}</button>
                      <button className="as-btn sm" style={{ flex:'none', padding:'4px 8px' }}>⋯</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </AppleShell>
  );
}

window.AppleProducts = AppleProducts;

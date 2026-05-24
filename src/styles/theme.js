export const THEME_CSS = `
:root[data-theme="light"]{
  color-scheme:light;
  --bg:#f5f5f7;
  --bg2:#ffffff;
  --panel:#ffffff;
  --hover:#f5f5f7;
  --hover2:#ebebed;
  --line:#e5e5ea;
  --line2:#d2d2d7;
  --shadow:0 1px 0 rgba(0,0,0,0.04),0 0 0 0.5px rgba(0,0,0,0.06);
  --text:#1d1d1f;
  --dim:#6e6e73;
  --faint:#86868b;
  --blue:#0071e3;
  --blue-bg:rgba(0,113,227,0.08);
  --blue-hover:#0077ed;
  --green:#34c759;
  --orange:#ff9500;
  --red:#ff3b30;
  --yellow:#ffcc00;
  --teal:#5ac8fa;
  --purple:#af52de;
  --pink:#ff2d55;
  --topbar-bg:rgba(245,245,247,0.78);
  --sidebar-bg:#f5f5f7;
  --rowhover:rgba(0,0,0,0.03);
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --bg:#1c1c1e;
  --bg2:#2c2c2e;
  --panel:#2c2c2e;
  --hover:#3a3a3c;
  --hover2:#48484a;
  --line:#38383a;
  --line2:#48484a;
  --shadow:0 0 0 0.5px rgba(255,255,255,0.06);
  --text:#f5f5f7;
  --dim:#98989d;
  --faint:#6c6c70;
  --blue:#0a84ff;
  --blue-bg:rgba(10,132,255,0.16);
  --blue-hover:#409cff;
  --green:#30d158;
  --orange:#ff9f0a;
  --red:#ff453a;
  --yellow:#ffd60a;
  --teal:#64d2ff;
  --purple:#bf5af2;
  --pink:#ff375f;
  --topbar-bg:rgba(28,28,30,0.78);
  --sidebar-bg:#1c1c1e;
  --rowhover:rgba(255,255,255,0.05);
}
body{
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display',
              'Inter','Noto Sans Thai',system-ui,sans-serif;
  font-size:13px;
  line-height:1.4;
  letter-spacing:-0.005em;
  -webkit-font-smoothing:antialiased;
  color:var(--text);
  background:var(--bg);
  margin:0;
}
.num{font-variant-numeric:tabular-nums;font-feature-settings:'tnum';}
select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2398989d' fill='none' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px!important;}
select option{background:var(--bg2);color:var(--text);}

@media print{
  :root{
    --bg:#fff!important;--bg2:#fff!important;--panel:#fff!important;
    --text:#000!important;--dim:#555!important;--faint:#888!important;
    --line:#ccc!important;--line2:#aaa!important;
    --shadow:none!important;
  }
}
`;

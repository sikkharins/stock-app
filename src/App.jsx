import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { ALL_TABS, TAB_LABELS, IB } from "./utils/constants.js";
import { getNotifs, mkAudit, nowStr, todayStr } from "./utils/helpers.js";
import { loadData, saveData, loadAllFromSupabase, saveAllToSupabase, subscribeRealtime, unsubscribeRealtime } from "./utils/storage.js";
import { signIn, signOut, getSession, getProfile, getAllProfiles, migrateUsers } from "./utils/auth.js";
import { initProducts, initContacts, initPOs, initSales, initCats, initBrands, initUsers, initQuotes, initTargets } from "./data/initData.js";
import { THEME_CSS } from "./styles/theme.js";
import Field from "./components/ui/Field.jsx";
import Badge from "./components/ui/Badge.jsx";
import GlobalSearch from "./components/ui/GlobalSearch.jsx";
import AppSkeleton from "./components/ui/Skeleton.jsx";

const DashPage = lazy(() => import("./components/Dashboard.jsx"));
const ProdPage = lazy(() => import("./components/Products.jsx"));
const LogPage = lazy(() => import("./components/StockLog.jsx"));
const POPage = lazy(() => import("./components/PurchaseOrders.jsx"));
const SalesPage = lazy(() => import("./components/Sales.jsx"));
const PromosPage = lazy(() => import("./components/Promotions.jsx"));
const FinPage = lazy(() => import("./components/Finance.jsx"));
const RepPage = lazy(() => import("./components/Reports/ReportsPage.jsx"));
const ContactPage = lazy(() => import("./components/Contacts.jsx"));
const UserPage = lazy(() => import("./components/Users.jsx"));
const DefectivePage = lazy(() => import("./components/DefectiveProducts.jsx"));
const BackupManager = lazy(() => import("./components/BackupManager.jsx"));
const AISOBot = lazy(() => import("./components/AISOBot.jsx"));

const NAV_ICONS={dashboard:"◇",products:"▤",stock_log:"⟳",purchase:"↓",sales:"↗",promos:"★",finance:"$",reports:"◑",suppliers:"⚙",customers:"♡",defective:"⚠",users:"⚙"};
const NAV_SECTIONS=[
  {label:{th:"พื้นที่ทำงาน",en:"Workspace"},tabs:["dashboard","products","stock_log","purchase","sales","promos"]},
  {label:{th:"การจัดการ",en:"Manage"},tabs:["finance","reports","defective","suppliers","customers"]},
  {label:{th:"ระบบ",en:"System"},tabs:["users"]},
];

function LoginScreen({users,onLogin}){
  const[un,setUn]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[loading,setLoading]=useState(false);
  const go=async()=>{
    if(!un||!pw)return;
    setLoading(true);setErr("");
    try{
      const{user}=await signIn(un,pw);
      const profile=await getProfile(user.id);
      onLogin(profile);
    }catch(e){
      setErr("Username หรือ Password ไม่ถูกต้อง");
    }
    setLoading(false);
  };
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}><div style={{background:"var(--panel)",borderRadius:16,border:"1px solid var(--line)",padding:"2.5rem 2rem",width:"min(400px,94%)",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
    <div style={{textAlign:"center",marginBottom:24}}><div style={{marginBottom:12,display:"inline-block",background:"#fff",borderRadius:16,padding:10}}><img src="/logo.jpg" style={{width:110,display:"block",borderRadius:8}} alt="TS Electronics"/></div><div style={{fontSize:13,color:"var(--dim)"}}>กรุณาเข้าสู่ระบบ</div></div>
    <div style={{marginBottom:14}}><Field label="Username"><input value={un} onChange={e=>{setUn(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field></div>
    <div style={{marginBottom:20}}><Field label="Password"><input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} style={{...IB,background:"var(--bg2)",border:"1px solid var(--line)",color:"var(--text)"}}/></Field></div>
    {err&&<div style={{fontSize:13,color:"var(--red)",marginBottom:12,textAlign:"center"}}>{err}</div>}
    <button onClick={go} disabled={loading} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:loading?"var(--dim)":"var(--blue)",color:"#fff",fontWeight:500,fontSize:14,cursor:loading?"default":"pointer",fontFamily:"inherit"}}>{loading?"กำลังเข้าสู่ระบบ...":"เข้าสู่ระบบ"}</button>
    {users.length>0&&<div style={{marginTop:20,padding:12,background:"var(--bg)",borderRadius:8,fontSize:12,color:"var(--dim)"}}>
      <div style={{fontWeight:500,marginBottom:6}}>บัญชี:</div>
      {users.map(u=><div key={u.id} style={{marginBottom:3}}>{u.username+" — "}<Badge status={u.role}/></div>)}
    </div>}
  </div></div>;
}

export default function App(){
  const[tab,setTab]=useState("dashboard");const[lang,setLang]=useState("th");const[cu,setCu]=useState(null);
  const[theme,setTheme]=useState(()=>{const s=localStorage.getItem("v3_theme");if(s)return s;return window.matchMedia?.("(prefers-color-scheme:dark)").matches?"dark":"light";});
  const[products,setProducts]=useState(initProducts);const[contacts,setContacts]=useState(initContacts);
  const[pos,setPOs]=useState(initPOs);const[sales,setSales]=useState(initSales);
  const[logs,setLogs]=useState([]);const[payments,setPayments]=useState([]);
  const[quotes,setQuotes]=useState(initQuotes);const[targets,setTargets]=useState(initTargets);
  const[audit,setAudit]=useState([]);const[priceHist,setPriceHist]=useState([]);
  const[cheques,setCheques]=useState([]);const[bankAccs,setBankAccs]=useState([{id:1,name:"บัญชี 1",bank:"กสิกรไทย",accNo:""},{id:2,name:"บัญชี 2",bank:"ไทยพาณิชย์",accNo:""},{id:3,name:"บัญชี 3",bank:"TTB",accNo:""}]);const[bankTxns,setBankTxns]=useState([]);
  const[cnotes,setCNotes]=useState([]);
  const[billings,setBillings]=useState([]);
  const[defectives,setDefectives]=useState([]);
  const[supCNotes,setSupCNotes]=useState([]);
  const[promos,setPromos]=useState([]);
  const[cats,setCats]=useState(initCats);const[brands,setBrands]=useState(initBrands);
  const[users,setUsers]=useState(initUsers);const[search,setSearch]=useState("");const[modal,setModal]=useState(null);
  const[actLogs,setActLogs]=useState([]);const[sess,setSess]=useState(null);
  const[loaded,setLoaded]=useState(false);const[saving,setSaving]=useState(false);const[showNotif,setShowNotif]=useState(false);const[showBackup,setShowBackup]=useState(false);const[quickCreate,setQuickCreate]=useState(null);const[fabOpen,setFabOpen]=useState(false);
  // Draggable FAB (AssistiveTouch style)
  const fabRef=useRef(null);const fabDrag=useRef({dragging:false,startX:0,startY:0,startLeft:0,startTop:0,moved:false});
  const [fabPos,setFabPos]=useState(()=>{try{const s=JSON.parse(localStorage.getItem("fab_pos"));const sz=44;if(s&&s.x!=null&&s.x>=0&&s.y>=0&&s.x<=window.innerWidth-sz&&s.y<=window.innerHeight-sz)return s;}catch{}return{x:null,y:null};});
  const [fabTouched,setFabTouched]=useState(false);
  const fabIdleTimer=useRef(null);
  const resetFabIdle=useCallback(()=>{setFabTouched(true);clearTimeout(fabIdleTimer.current);fabIdleTimer.current=setTimeout(()=>setFabTouched(false),3000);},[]);
  const onFabPointerDown=useCallback((e)=>{const t=e.touches?e.touches[0]:e;const el=fabRef.current;if(!el)return;const r=el.getBoundingClientRect();fabDrag.current={dragging:true,startX:t.clientX,startY:t.clientY,startLeft:r.left,startTop:r.top,moved:false};resetFabIdle();},[resetFabIdle]);
  const onFabPointerMove=useCallback((e)=>{const d=fabDrag.current;if(!d.dragging)return;const t=e.touches?e.touches[0]:e;const dx=t.clientX-d.startX,dy=t.clientY-d.startY;if(Math.abs(dx)>5||Math.abs(dy)>5)d.moved=true;if(!d.moved)return;e.preventDefault();const sz=44;const nx=Math.max(0,Math.min(window.innerWidth-sz,d.startLeft+dx));const ny=Math.max(0,Math.min(window.innerHeight-sz,d.startTop+dy));setFabPos({x:nx,y:ny});},[]);
  const onFabPointerUp=useCallback(()=>{const d=fabDrag.current;d.dragging=false;if(d.moved&&fabPos.x!=null){const sz=44;const snapX=fabPos.x<window.innerWidth/2?8:window.innerWidth-sz-8;const snapped={x:snapX,y:fabPos.y};setFabPos(snapped);localStorage.setItem("fab_pos",JSON.stringify(snapped));}resetFabIdle();},[fabPos,resetFabIdle]);
  useEffect(()=>{window.addEventListener("mousemove",onFabPointerMove);window.addEventListener("mouseup",onFabPointerUp);window.addEventListener("touchmove",onFabPointerMove,{passive:false});window.addEventListener("touchend",onFabPointerUp);return()=>{window.removeEventListener("mousemove",onFabPointerMove);window.removeEventListener("mouseup",onFabPointerUp);window.removeEventListener("touchmove",onFabPointerMove);window.removeEventListener("touchend",onFabPointerUp);};},[onFabPointerMove,onFabPointerUp]);
  const[pullY,setPullY]=useState(0);const[refreshing,setRefreshing]=useState(false);const pullStart=useRef(null);const mainRef=useRef(null);
  const doRefresh=useCallback(async()=>{setRefreshing(true);try{const sbData=await loadAllFromSupabase();if(sbData)applyData(sbData,false);}catch(e){console.warn("Refresh error:",e.message);}setRefreshing(false);setPullY(0);},[]);
  const onTouchStart=useCallback(e=>{if(mainRef.current&&mainRef.current.scrollTop<=0)pullStart.current=e.touches[0].clientY;else pullStart.current=null;},[]);
  const onTouchMove=useCallback(e=>{if(pullStart.current===null||refreshing)return;const dy=e.touches[0].clientY-pullStart.current;if(dy>0&&mainRef.current&&mainRef.current.scrollTop<=0){setPullY(Math.min(dy*0.4,80));if(dy>10)e.preventDefault();}else setPullY(0);},{refreshing});
  const onTouchEnd=useCallback(()=>{if(pullY>=60&&!refreshing)doRefresh();else setPullY(0);pullStart.current=null;},[pullY,refreshing,doRefresh]);
  const[sideOpen,setSideOpen]=useState(false);
  const realtimeSkipRef=useRef(new Set());
  const cuRef=useRef(cu);
  useEffect(()=>{cuRef.current=cu;},[cu]);

  // Back button handler — prevent accidental app close (AssistiveTouch style)
  const backToastTimer=useRef(null);const[backToast,setBackToast]=useState(false);
  const backStateRef=useRef({fabOpen,sideOpen,showNotif,showBackup,tab,backToast});
  useEffect(()=>{backStateRef.current={fabOpen,sideOpen,showNotif,showBackup,tab,backToast};},[fabOpen,sideOpen,showNotif,showBackup,tab,backToast]);
  const lastBackRef=useRef(0);
  useEffect(()=>{
    history.pushState({app:true},"");
    const onBack=()=>{
      const now=Date.now();if(now-lastBackRef.current<80){history.pushState({app:true},"");return;}
      lastBackRef.current=now;
      const s=backStateRef.current;
      if(s.fabOpen){setFabOpen(false);history.pushState({app:true},"");return;}
      if(s.sideOpen){setSideOpen(false);history.pushState({app:true},"");return;}
      if(s.showNotif){setShowNotif(false);history.pushState({app:true},"");return;}
      if(s.showBackup){setShowBackup(false);history.pushState({app:true},"");return;}
      if(s.tab!=="dashboard"){setTab("dashboard");history.pushState({app:true},"");return;}
      if(!s.backToast){setBackToast(true);history.pushState({app:true},"");clearTimeout(backToastTimer.current);backToastTimer.current=setTimeout(()=>setBackToast(false),500);}
    };
    window.addEventListener("popstate",onBack);
    return()=>{window.removeEventListener("popstate",onBack);clearTimeout(backToastTimer.current);};
  },[]);

  const RT_SETTERS=useRef(null);
  const getSetters=useCallback(()=>{
    if(!RT_SETTERS.current)RT_SETTERS.current={products:setProducts,contacts:setContacts,pos:setPOs,sales:setSales,cats:setCats,brands:setBrands,logs:setLogs,payments:setPayments,activity:setActLogs,quotes:setQuotes,targets:setTargets,audit:setAudit,pricehist:setPriceHist,cheques:setCheques,bankaccs:setBankAccs,banktxns:setBankTxns,cnotes:setCNotes,billings:setBillings,defectives:setDefectives,supcnotes:setSupCNotes,promos:setPromos};
    return RT_SETTERS.current;
  },[]);

  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("v3_theme",theme);const mt=document.querySelector('meta[name="theme-color"]');if(mt)mt.setAttribute('content',theme==='dark'?'#1c1c1e':'#0071e3');},[theme]);

  useEffect(()=>{
    if(!cu)return;
    const setters=getSetters();
    subscribeRealtime(cu.id,(sbKey,data)=>{
      const setter=setters[sbKey];
      if(setter){realtimeSkipRef.current.add(sbKey);setter(data);}
    });
    return()=>{unsubscribeRealtime();RT_SETTERS.current=null;};
  },[cu,getSetters]);

  const pN=p=>lang==="th"?(p.nameT||p.name):p.name;
  const cN=c=>lang==="th"?(c.nameT||c.name):c.name;
  const lowStock=products.filter(p=>p.minStock>0&&p.stock<=p.minStock);
  const gP=k=>{if(!cu)return{access:false};let p=(cu.perms||{})[k];if(!p){if(cu.role==="Admin")return{access:true,read:true,create:true,edit:true,delete:true,approve:true};return{access:false};}let r;if(typeof p==="string"){if(p==="edit")r={access:true,read:true,create:true,edit:true,delete:true};else if(p==="view")r={access:true,read:true};else return{access:false};}else r=p;if(cu.role==="Admin")return{...r,approve:true};return r;};
  const canA=k=>!!gP(k).access;const canE=k=>!!gP(k).edit;const canC=k=>!!gP(k).create;const canApv=k=>!!gP(k).approve;
  const getCN=id=>{const c=cats.find(x=>x.id===+id);return c?c.name:"-";};
  const addLog=log=>setLogs(p=>[log,...p]);
  const oM=n=>setModal(n);const cM=()=>setModal(null);
  const addA=(a,d)=>setAudit(p=>[mkAudit(a,d,cu?.username),...p].slice(0,500));
  const addPH=(pid,f,o,n)=>setPriceHist(p=>[{id:Date.now(),date:nowStr(),productId:pid,field:f,oldVal:o,newVal:n,user:cu?.username},...p].slice(0,500));
  const notifs=getNotifs(products,sales,pos,payments,quotes);

  const applyData=(d,fallbackLS)=>{
    const g=(sbKey,lsKey,fb)=>{const v=d?.[sbKey];const raw=(v!=null)?v:fallbackLS?loadData(lsKey,fb):fb;return Array.isArray(fb)?(Array.isArray(raw)?raw:fb):raw;};
    const rawP=g("products","v3_products",initProducts);const seenP=new Set();setProducts(rawP.filter(p=>{if(seenP.has(p.id))return false;seenP.add(p.id);return true;}));
    setContacts(g("contacts","v3_contacts",initContacts));
    setPOs(g("pos","v3_pos",initPOs));
    setSales(g("sales","v3_sales",initSales));
    setCats(g("cats","v3_cats",initCats));
    setBrands(g("brands","v3_brands",initBrands));
    const rawLogs=g("logs","v3_logs",[]).filter(l=>l.qtyBefore!==undefined);
    const seen=new Set();setLogs(rawLogs.filter(l=>{const k=l.date+"|"+l.type+"|"+l.productId+"|"+l.ref+"|"+l.qty;if(seen.has(k))return false;seen.add(k);return true;}));
    setPayments(g("payments","v3_payments",[]));
    setActLogs(g("activity","v3_activity",[]));
    setQuotes(g("quotes","v3_quotes",initQuotes));
    setTargets(g("targets","v3_targets",initTargets));
    setAudit(g("audit","v3_audit",[]));
    setPriceHist(g("pricehist","v3_pricehist",[]));
    setCheques(g("cheques","v3_cheques",[]));
    setBankAccs(prev=>{const saved=g("bankaccs","v3_bankaccs",null);return saved||prev;});
    setBankTxns(g("banktxns","v3_banktxns",[]));
    setCNotes(g("cnotes","v3_cnotes",[]));
    setBillings(g("billings","v3_billings",[]));
    setSupCNotes(g("supcnotes","v3_supcnotes",[]));
    setPromos(g("promos","v3_promos",[]));
    setDefectives(g("defectives","v3_defectives",[]).map(d=>{
      if(d.status==="cn_created"||d.status==="cn_used")return{...d,custStatus:d.status,status:d.custStatus||"pending_inspection"};
      return d;
    }));
  };

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const sbData=await loadAllFromSupabase();
        if(!cancelled)applyData(sbData,true);

        let profiles=[];
        try{profiles=await getAllProfiles();}catch(e){console.warn("Profile load:",e.message);}

        if(profiles.length===0){
          const appUsers=sbData?.users||loadData("v3_users",initUsers);
          const appContacts=sbData?.contacts||loadData("v3_contacts",initContacts);
          if(appUsers&&appUsers.length>0){
            console.log("Migrating users to Supabase Auth...");
            const results=await migrateUsers(appUsers,appContacts);
            console.log("Migration results:",results);
            try{profiles=await getAllProfiles();}catch(e){}
          }
        }

        if(!cancelled&&profiles.length>0)setUsers(profiles);

        const session=await getSession();
        if(session&&!cancelled){
          const profile=profiles.find(p=>p.id===session.user.id);
          if(profile)handleLogin(profile);
        }
      }catch(e){
        console.warn("Load error:",e.message);
        if(!cancelled)applyData(null,true);
      }
      if(!cancelled)setLoaded(true);
    })();
    return()=>{cancelled=true;};
  },[]);

  const pendingSaveRef=useRef(null);
  useEffect(()=>{if(!loaded)return;
    const allEntries=[["v3_products",products],["v3_contacts",contacts],["v3_pos",pos],["v3_sales",sales],["v3_cats",cats],["v3_brands",brands],["v3_logs",logs],["v3_payments",payments],["v3_activity",actLogs],["v3_quotes",quotes],["v3_targets",targets],["v3_audit",audit],["v3_pricehist",priceHist],["v3_cheques",cheques],["v3_bankaccs",bankAccs],["v3_banktxns",bankTxns],["v3_cnotes",cnotes],["v3_billings",billings],["v3_defectives",defectives],["v3_supcnotes",supCNotes],["v3_promos",promos]];
    pendingSaveRef.current=allEntries;
    setSaving(true);const tm=setTimeout(()=>{
    const skipped=new Set(realtimeSkipRef.current);realtimeSkipRef.current.clear();
    allEntries.forEach(([k,v])=>saveData(k,v));
    const entries=skipped.size>0?allEntries.filter(([k])=>!skipped.has(k.replace("v3_",""))):allEntries;
    if(entries.length>0)saveAllToSupabase(entries,cuRef.current?.id).catch(e=>console.warn("Supabase save error:",e.message));
    pendingSaveRef.current=null;
    setSaving(false);
  },800);return()=>clearTimeout(tm);},[products,contacts,pos,sales,cats,brands,logs,payments,actLogs,quotes,targets,audit,priceHist,cheques,bankAccs,bankTxns,cnotes,billings,defectives,supCNotes,promos,loaded]);

  useEffect(()=>{
    const flush=()=>{if(pendingSaveRef.current){pendingSaveRef.current.forEach(([k,v])=>saveData(k,v));}};
    window.addEventListener("beforeunload",flush);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flush();});
    return()=>{window.removeEventListener("beforeunload",flush);};
  },[]);

  useEffect(()=>{
    if(!cu)return;
    const u=users.find(x=>x.id===cu.id);
    if(u)setCu(u);
  },[users]);

  const handleTab=nt=>{setTab(nt);setSearch("");setSideOpen(false);setSess(s=>{if(!s)return s;const now=Date.now();const hist=[...s.tabHistory];if(hist.length>0){const last=hist[hist.length-1];hist[hist.length-1]={...last,endTime:now,duration:Math.floor((now-last.enterTime)/1000)};}hist.push({tab:nt,enterTime:now,endTime:null,duration:null});return{...s,tabHistory:hist};});};
  const handleLogin=user=>{const ft=[...ALL_TABS,"users"].find(tb=>{const p=user.perms[tb];return p&&(typeof p==="string"?p!=="none":p.access);})||"dashboard";const now=Date.now();setCu(user);setTab(ft);setSess({userId:user.id,username:user.username,role:user.role,salesName:user.salesName||"",supplierName:user.supplierName||"",loginTime:now,loginTimeStr:nowStr(),logoutTime:null,logoutTimeStr:null,totalDuration:null,tabHistory:[{tab:ft,enterTime:now,endTime:null,duration:null}]});};
  const handleLogout=()=>{if(sess){const now=Date.now();const hist=[...sess.tabHistory];if(hist.length>0){const last=hist[hist.length-1];hist[hist.length-1]={...last,endTime:now,duration:Math.floor((now-last.enterTime)/1000)};}setActLogs(p=>[{...sess,logoutTime:now,logoutTimeStr:nowStr(),totalDuration:Math.floor((now-sess.loginTime)/1000),tabHistory:hist},...p].slice(0,200));}signOut().catch(()=>{});setSess(null);setCu(null);};

  if(!loaded)return <><style>{THEME_CSS}</style><AppSkeleton/></>;
  if(!cu)return <><style>{THEME_CSS}</style><LoginScreen users={users} onLogin={handleLogin}/></>;

  const visTabs=[...ALL_TABS.filter(tb=>canA(tb)),...(canA("users")?["users"]:[])];
  const isSup=!!cu.supplierName;const supN=cu.supplierName||"";
  const sh={pN,cN,lang,products,setProducts,contacts,setContacts,pos,setPOs,sales,setSales,logs,setLogs,addLog,payments,setPayments,quotes,setQuotes,targets,setTargets,audit,addA,priceHist,addPH,cats,setCats,brands,setBrands,users,setUsers,search,setSearch,modal,oM,cM,lowStock,canE,canC,canA,canApv,getCN,cu,isSup,supN,actLogs,sess,notifs,cheques,setCheques,bankAccs,setBankAccs,bankTxns,setBankTxns,cnotes,setCNotes,defectives,setDefectives,billings,setBillings,supCNotes,setSupCNotes,promos,setPromos,handleTab,quickCreate,clearQuickCreate:()=>setQuickCreate(null)};
  const curLabel=TAB_LABELS[tab]?TAB_LABELS[tab][lang]:tab;

  return <>
    <style>{THEME_CSS+"\n@keyframes ptr-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}\n@keyframes fab-pop{0%{opacity:0;transform:translateY(8px) scale(0.9)}100%{opacity:1;transform:translateY(0) scale(1)}}\n"}</style>
    <div className="app-shell" style={{display:"grid",gridTemplateColumns:"240px 1fr",gridTemplateRows:"52px 1fr",minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>

      {/* Sidebar */}
      <aside className={`app-sidebar${sideOpen?" open":""}`} style={{gridRow:"1 / span 2",background:"var(--sidebar-bg)",borderRight:"1px solid var(--line)",padding:"14px 12px",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px 18px"}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#0a84ff,#5ac8fa)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,letterSpacing:"-0.04em",flexShrink:0}}>TS</div>
          <div>
            <div style={{fontWeight:600,fontSize:14,letterSpacing:"-0.015em"}}>TS Electronic</div>
          </div>
        </div>

        <nav style={{display:"flex",flexDirection:"column",gap:1,flex:1}}>
          {NAV_SECTIONS.map((sec,si)=>{
            const secTabs=sec.tabs.filter(t=>visTabs.includes(t));
            if(!secTabs.length)return null;
            return <div key={si}>
              <div style={{padding:"14px 10px 6px",fontSize:11,color:"var(--faint)",fontWeight:600}}>{sec.label[lang]||sec.label.th}</div>
              {secTabs.map(tb=>{
                const active=tab===tb;
                const badge=tb==="purchase"?pos.filter(p=>p.status==="pending_approval").length:tb==="sales"?sales.filter(s=>s.status==="pending_delivery"||s.status==="pending_special_approval").length:0;
                return <div key={tb} onClick={()=>handleTab(tb)} style={{display:"flex",alignItems:"center",gap:11,padding:"7px 10px",borderRadius:7,cursor:"pointer",fontSize:13.5,fontWeight:active?500:400,background:active?"var(--blue-bg)":"transparent",color:active?"var(--blue)":"var(--text)"}}>
                  <span style={{width:18,display:"flex",justifyContent:"center",color:active?"var(--blue)":"var(--dim)",fontSize:14}}>{NAV_ICONS[tb]||"·"}</span>
                  <span style={{flex:1}}>{TAB_LABELS[tb]?TAB_LABELS[tb][lang]:tb}</span>
                  {badge>0&&<span style={{background:active?"var(--blue)":"var(--bg2)",border:active?"none":"1px solid var(--line)",color:active?"#fff":"var(--dim)",fontSize:11,padding:"0 6px",borderRadius:99,minWidth:18,textAlign:"center"}}>{badge}</span>}
                </div>;
              })}
            </div>;
          })}
        </nav>

        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:"var(--bg2)",border:"1px solid var(--line)",marginTop:8}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,var(--orange),var(--pink))",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:12,flexShrink:0}}>{(cu.username||"?")[0].toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cu.roleTitle?(cu.staffName||cu.username):cu.username}</div>
            <div style={{fontSize:11,color:"var(--dim)"}}>{cu.roleTitle?(cu.supplierName+" · "+cu.roleTitle):cu.role}</div>
          </div>
          <span onClick={handleLogout} style={{color:"var(--dim)",cursor:"pointer",fontSize:14,flexShrink:0}} title="ออกจากระบบ">⏻</span>
        </div>
      </aside>

      {/* Topbar */}
      <header className="app-topbar" style={{gridColumn:2,display:"flex",alignItems:"center",padding:"0 24px",gap:14,borderBottom:"0.5px solid var(--line)",background:"var(--topbar-bg)",backdropFilter:"saturate(180%) blur(20px)",WebkitBackdropFilter:"saturate(180%) blur(20px)",position:"relative",zIndex:10}}>
        <button className="sidebar-toggle" onClick={()=>setSideOpen(!sideOpen)} style={{display:"none",background:"none",border:"none",color:"var(--text)",fontSize:18,cursor:"pointer",padding:4}}>☰</button>
        <div className="topbar-breadcrumb" style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"var(--dim)"}}>
          <span>{lang==="th"?"พื้นที่ทำงาน":"Workspace"}</span>
          <span>›</span>
          <span style={{color:"var(--text)",fontWeight:600}}>{curLabel}</span>
        </div>
        <div style={{flex:1,maxWidth:440,marginLeft:18}}>
          <GlobalSearch products={products} sales={sales} quotes={quotes} pos={pos} contacts={contacts} pN={pN} cN={cN} cu={cu} canA={canA} onNavigate={(t,s)=>{handleTab(t);setSearch(s);}}/>
        </div>
        <div className="topbar-actions" style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
          <button onClick={async()=>{setSaving(true);try{const d=await loadAllFromSupabase();applyData(d,false);}catch(e){console.warn("Reload error:",e.message);}setSaving(false);}} style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--dim)",cursor:"pointer",background:"none",border:"none",fontSize:15}} title="โหลดข้อมูลใหม่">↻</button>
          {saving?<span style={{fontSize:11,color:"var(--dim)"}}>⟳</span>:<span style={{fontSize:11,color:"var(--green)"}}>✓</span>}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowNotif(!showNotif)} style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--dim)",cursor:"pointer",background:"none",border:"none",fontSize:15}}>N{notifs.length>0&&<span style={{position:"absolute",top:4,right:5,width:7,height:7,borderRadius:"50%",background:"var(--red)"}}/>}</button>
            {showNotif&&<div className="notif-dropdown" style={{position:"absolute",right:0,top:38,width:340,maxHeight:380,overflowY:"auto",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",zIndex:200}}>
              <div style={{padding:"10px 14px",fontWeight:600,fontSize:13,borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between",color:"var(--text)"}}><span>{"แจ้งเตือน ("+notifs.length+")"}</span><span onClick={()=>setShowNotif(false)} style={{cursor:"pointer",color:"var(--dim)",fontSize:18}}>×</span></div>
              {notifs.length===0&&<div style={{padding:"2rem",textAlign:"center",color:"var(--dim)",fontSize:13}}>ไม่มีการแจ้งเตือน ✓</div>}
              {notifs.map((n,i)=><div key={i} style={{padding:"8px 14px",borderBottom:"1px solid var(--line)",fontSize:12,display:"flex",gap:8}}><span>{n.icon}</span><span style={{color:n.type==="danger"?"var(--red)":"var(--text)"}}>{n.msg}</span></div>)}
            </div>}
          </div>
          <button onClick={()=>setTheme(t=>t==="light"?"dark":"light")} style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--dim)",cursor:"pointer",background:"none",border:"none",fontSize:15}} title="Toggle theme">{theme==="light"?"D":"L"}</button>
          {cu.role==="Admin"&&<button onClick={()=>setShowBackup(true)} style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--dim)",cursor:"pointer",background:"none",border:"none",fontSize:15}} title="Backup">B</button>}
          <button onClick={()=>setLang(lang==="en"?"th":"en")} style={{padding:"4px 10px",borderRadius:7,border:"1px solid var(--line)",background:"var(--bg2)",color:"var(--text)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{lang==="en"?"ไทย":"EN"}</button>
        </div>
      </header>

      {/* Main content */}
      <main ref={mainRef} className="app-main" style={{gridColumn:2,overflow:"auto",padding:"28px 32px 60px"}} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {(pullY>0||refreshing)&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",height:refreshing?40:pullY,overflow:"hidden",transition:refreshing?"none":"height 0.15s ease",marginBottom:8}}>
          <div style={{width:28,height:28,borderRadius:"50%",border:"2.5px solid var(--line)",borderTopColor:pullY>=60||refreshing?"var(--blue)":"var(--line)",animation:refreshing?"ptr-spin 0.7s linear infinite":"none",transform:refreshing?"none":"rotate("+Math.min(pullY/60*360,360)+"deg)",transition:"transform 0.05s linear",opacity:Math.min(pullY/30,1)}}/>
        </div>}
        {!canA(tab)?<div style={{padding:"3rem",textAlign:"center",color:"var(--dim)"}}>ไม่มีสิทธิ์</div>:
        <Suspense fallback={<div style={{display:"flex",flexDirection:"column",gap:12,padding:"8px 0"}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>{[0,1,2,3].map(i=><div key={i} style={{height:68,borderRadius:10,background:"var(--hover)",animation:"sk-shimmer 1.6s ease-in-out infinite",backgroundImage:"linear-gradient(90deg,var(--hover) 25%,rgba(120,120,128,0.12) 50%,var(--hover) 75%)",backgroundSize:"800px 100%"}}/>)}</div><div style={{height:34,borderRadius:8,width:240,background:"var(--hover)",animation:"sk-shimmer 1.6s ease-in-out infinite",backgroundImage:"linear-gradient(90deg,var(--hover) 25%,rgba(120,120,128,0.12) 50%,var(--hover) 75%)",backgroundSize:"800px 100%"}}/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>{[0,1,2,3,4,5].map(i=><div key={i} style={{height:160,borderRadius:12,background:"var(--hover)",animation:"sk-shimmer 1.6s ease-in-out infinite",backgroundImage:"linear-gradient(90deg,var(--hover) 25%,rgba(120,120,128,0.12) 50%,var(--hover) 75%)",backgroundSize:"800px 100%"}}/>)}</div></div>}>
          {tab==="dashboard"&&<DashPage sh={sh}/>}
          {tab==="products"&&<ProdPage sh={sh}/>}
          {tab==="stock_log"&&<LogPage sh={sh}/>}
          {tab==="purchase"&&<POPage sh={sh}/>}
          {tab==="sales"&&<SalesPage sh={sh}/>}
          {tab==="promos"&&<PromosPage sh={sh}/>}
          {tab==="finance"&&<FinPage sh={sh}/>}
          {tab==="reports"&&<RepPage sh={sh}/>}
          {tab==="suppliers"&&<ContactPage key="s" sh={sh} ft="supplier"/>}
          {tab==="customers"&&<ContactPage key="c" sh={sh} ft="customer"/>}
          {tab==="defective"&&<DefectivePage sh={sh}/>}
          {tab==="users"&&<UserPage sh={sh}/>}
        </Suspense>}
      </main>
    </div>

    {/* Mobile sidebar overlay */}
    {sideOpen&&<div className="sidebar-backdrop" onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:90}}/>}

    {showBackup&&<Suspense fallback={null}><BackupManager onClose={()=>setShowBackup(false)} cu={cu} products={products} contacts={contacts} pos={pos} sales={sales} quotes={quotes} cats={cats} brands={brands} users={users} logs={logs} payments={payments} actLogs={actLogs} targets={targets} audit={audit} priceHist={priceHist} setProducts={setProducts} setContacts={setContacts} setPOs={setPOs} setSales={setSales} setQuotes={setQuotes} setCats={setCats} setBrands={setBrands} setUsers={setUsers} setLogs={setLogs} setPayments={setPayments} setActLogs={setActLogs} setTargets={setTargets} setAudit={setAudit} setPriceHist={setPriceHist}/></Suspense>}

    {(()=>{
      const acts=[
        canC("sales")&&{label:"สร้างใบขาย",icon:"📦",tab:"sales",mk:"addSO"},
        canC("products")&&{label:"เพิ่มสินค้า",icon:"📋",tab:"products",mk:"product"},
        canC("purchase")&&!isSup&&{label:"สร้าง PO",icon:"🛒",tab:"purchase",mk:"addPO"},
        canC("quotes")&&{label:"ใบเสนอราคา",icon:"📄",tab:"quotes",mk:"addQT"},
      ].filter(Boolean);
      if(!acts.length)return null;
      const doAct=a=>{handleTab(a.tab);setQuickCreate(a.mk);setFabOpen(false);};
      const fabStyle=fabPos.x!=null?{position:"fixed",left:fabPos.x,top:fabPos.y,zIndex:9995}:{position:"fixed",bottom:88,right:16,zIndex:9995};
      const isRight=fabPos.x!=null?fabPos.x>window.innerWidth/2:true;
      const menuAlign=isRight?{right:0,alignItems:"flex-end"}:{left:0,alignItems:"flex-start"};
      return <>
        {fabOpen&&<div onClick={()=>setFabOpen(false)} style={{position:"fixed",inset:0,zIndex:9990}}/>}
        <div ref={fabRef} style={{...fabStyle,transition:"opacity 0.4s"}}>
          {fabOpen&&<div style={{position:"absolute",bottom:52,...menuAlign,display:"flex",flexDirection:"column",gap:6}}>
            {acts.map((a,i)=><button key={i} onClick={()=>doAct(a)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(30,30,30,0.75)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",boxShadow:"0 4px 20px rgba(0,0,0,0.3)",color:"rgba(255,255,255,0.85)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",animation:`fab-pop 0.2s ${i*0.04}s both`}}>
              <span style={{fontSize:15}}>{a.icon}</span>{a.label}
            </button>)}
          </div>}
          <button onMouseDown={onFabPointerDown} onTouchStart={onFabPointerDown} onClick={()=>{if(!fabDrag.current.moved)setFabOpen(o=>!o);}} style={{width:44,height:44,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(40,40,40,0.6)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",color:"rgba(255,255,255,0.7)",fontSize:24,fontWeight:300,cursor:"grab",boxShadow:"0 2px 12px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",transition:"transform 0.25s",transform:fabOpen?"rotate(45deg)":"none",touchAction:"none"}}>+</button>
        </div>
      </>;
    })()}

    {canA("ai_bot")&&<Suspense fallback={null}><AISOBot sh={sh} onCreateSO={(data)=>{
      const yr=new Date().getFullYear();
      const mx=sales.reduce((m,s)=>{const mt=s.soNum.match(/^SO-(\d+)-(\d+)$/);return mt&&+mt[1]===yr?Math.max(m,+mt[2]):m;},0);
      const sn="SO-"+yr+"-"+String(mx+1).padStart(3,"0");
      const items=(data.items||[]).map(i=>({productId:+i.productId,qty:+i.qty,price:+i.price}));
      const sub=items.reduce((s,i)=>s+i.qty*i.price,0);
      const disc=data.payType==="cash"?Math.round(sub*(data.discPct||1)/100*100)/100:0;
      const vatAmt=data.includeVat!==false?Math.round((sub-disc)*7/107*100)/100:0;
      setSales(p=>[...p,{id:Date.now(),soNum:sn,status:"pending_delivery",fromQuote:"",customerId:+data.customerId,date:todayStr(),items,origPrices:items.map(i=>+i.price),includeVat:data.includeVat!==false,vatAmount:vatAmt,payType:data.payType||"cash",discountAmt:disc,discPct:data.payType==="cash"?(data.discPct||1):0,extraDiscPct:0,creditDays:data.payType==="credit"?(data.creditDays||45):0,useVatRep:false,vatRepName:"",vatRepAddress:"",vatRepIdCard:"",note:"สร้างโดย AI Bot"}]);
      addA("สร้าง SO (AI Bot)",sn);
    }} onCreatePO={(data)=>{
      const yr=new Date().getFullYear();
      const mx=pos.reduce((m,p)=>{const mt=p.poNum.match(/^PO-(\d+)-(\d+)$/);return mt&&+mt[1]===yr?Math.max(m,+mt[2]):m;},0);
      const pn="PO-"+yr+"-"+String(mx+1).padStart(3,"0");
      const items=(data.items||[]).map(i=>({productId:+i.productId,qty:+i.qty,cost:+i.cost}));
      setPOs(p=>[...p,{id:Date.now(),poNum:pn,supplierId:+data.supplierId,date:todayStr(),deliveryDate:"",status:"draft",items,note:data.note||"สร้างโดย AI Bot",createdBy:cu?.username||"",approval:null,approvalHistory:[],rejectionReason:""}]);
      addA("สร้าง PO (AI Bot)",pn);
    }} onCreateQuote={(data)=>{
      const yr=new Date().getFullYear();
      const mx=quotes.reduce((m,q)=>{const mt=q.qtNum.match(/^QT-(\d+)-(\d+)$/);return mt&&+mt[1]===yr?Math.max(m,+mt[2]):m;},0);
      const qn="QT-"+yr+"-"+String(mx+1).padStart(3,"0");
      const items=(data.items||[]).map(i=>({productId:+i.productId,qty:+i.qty,price:+i.price}));
      const vd=new Date();vd.setDate(vd.getDate()+(data.validDays||30));
      setQuotes(p=>[...p,{id:Date.now(),qtNum:qn,status:"draft",convertedTo:"",customerId:+data.customerId,date:todayStr(),validUntil:vd.toISOString().slice(0,10),items,includeVat:data.includeVat!==false,payType:data.payType||"cash",discPct:data.payType==="cash"?(data.discPct||1):0,creditDays:data.payType==="credit"?(data.creditDays||45):0,note:"สร้างโดย AI Bot"}]);
      addA("สร้าง QT (AI Bot)",qn);
    }} onUpdateProducts={(updates)=>{
      setProducts(prev=>prev.map(p=>{
        const u=updates.find(x=>+x.productId===p.id);
        if(!u)return p;
        const c=u.changes||{};const up={...p};
        if(c.price!=null){addPH(p.id,"price",p.price,+c.price);up.price=+c.price;}
        if(c.cost!=null){addPH(p.id,"cost",p.cost||0,+c.cost);up.cost=+c.cost;}
        if(c.stock!=null)up.stock=+c.stock;
        if(c.minStock!=null)up.minStock=+c.minStock;
        if(c.name!=null)up.name=c.name;
        if(c.nameT!=null)up.nameT=c.nameT;
        return up;
      }));
      addA("แก้ไขสินค้า (AI Bot)",updates.length+" รายการ");
    }}/></Suspense>}

    {backToast&&<div style={{position:"fixed",bottom:40,left:"50%",transform:"translateX(-50%)",background:"rgba(30,30,30,0.85)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",color:"rgba(255,255,255,0.9)",padding:"10px 24px",borderRadius:20,fontSize:13,fontWeight:500,zIndex:99999,boxShadow:"0 4px 16px rgba(0,0,0,0.3)",fontFamily:"inherit",animation:"fab-pop 0.2s both"}}>กดอีกครั้งเพื่อออก</div>}
  </>;
}

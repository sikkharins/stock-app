import { useState, useMemo, useEffect } from "react";
import { IB, STOCK_STATUS, BRAND_COLORS } from "../utils/constants.js";
import { fmt, mkLog, getSS, toBE, fmtD, DEFAULT_SPLIT_PARTS, partCubicM } from "../utils/helpers.js";
import { diffFields } from "../utils/auditDiff.ts";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import SB from "./ui/SearchBar.jsx";
import Btn from "./ui/Btn.jsx";
import Sel from "./ui/Sel.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import CatMgr from "./CategoryManager.jsx";
import StatCard from "./ui/StatCard.jsx";
import { buildBrandSubData } from "./ui/StockValueDonut.jsx";
import ExcelImport from "./ExcelImport.jsx";
import { stockValueSeries, lowStockSeries, reservedSeries, newProductsSeries, salesCountByProduct, daysOfStock, salesTrend, needsAttention } from "../utils/productStats.ts";
import BrandChipRow from "./ui/BrandChipRow.tsx";
import { brandColor } from "../utils/brandColors.ts";
import ProductsTable from "./ProductsTable.tsx";
import SlideOver from "./ui/SlideOver.tsx";

export default function ProdPage({sh}){
  const{pN,cN,canE,canD,products,setProducts,cats,setCats,brands,contacts,search,setSearch,modal,oM,cM,getCN,addLog,cu,sales,logs,pos,isSup,supN,addA,addPH,priceHist}=sh;
  const ed=canE("products");const cd=canD("products");
  const baseP=isSup?products.filter(p=>p.distributor===supN):products;
  const[fBrand,setFBrand]=useState("");const[fCat,setFCat]=useState("");const[fStat,setFStat]=useState("");const[fAttn,setFAttn]=useState(false);const[bsExpanded,setBsExpanded]=useState({});const[showBreakdown,setShowBreakdown]=useState(false);
  const[detailPr,setDetailPr]=useState(null);const[sortBy,setSortBy]=useState(()=>{const s=localStorage.getItem("productSort");return s&&s!=="brand"?s:"name";});
  const[view,setView]=useState(()=>localStorage.getItem("productView")||"card");
  useEffect(()=>{localStorage.setItem("productView",view);},[view]);
  const[density,setDensity]=useState(()=>localStorage.getItem("productTableDensity")||"comfortable");
  useEffect(()=>{localStorage.setItem("productTableDensity",density);},[density]);
  useEffect(()=>{localStorage.setItem("productSort",sortBy);},[sortBy]);
  // Derived data needed by filter/sort (reservedMap, salesByProd) must be
  // declared BEFORE `filtered`/`sorted` to avoid TDZ ReferenceError —
  // useMemo factories execute in source order during render.
  const reservedMap=useMemo(()=>{const m={};sales.filter(so=>so.status==="pending_delivery"||so.status==="out_for_delivery").forEach(so=>(so.items||[]).forEach(i=>{m[i.productId]=(m[i.productId]||0)+i.qty;}));return m;},[sales]);
  const salesByProd=useMemo(()=>salesCountByProduct(sales,new Date()),[sales]);
  const filtered=useMemo(()=>baseP.filter(pr=>{
    if(fBrand&&pr.brand!==fBrand)return false;
    if(fCat&&pr.categoryId!==+fCat)return false;
    if(fStat&&getSS(pr.id,sales).key!==fStat)return false;
    if(fAttn){const sc=salesByProd[pr.id]||{d7:0,d30:0};const res=reservedMap[pr.id]||0;if(!needsAttention(pr,sc.d30,res))return false;}
    if(search&&!((pN(pr)||"").toLowerCase().includes(search.toLowerCase())||(pr.code||"").toLowerCase().includes(search.toLowerCase())||(pr.brand||"").toLowerCase().includes(search.toLowerCase())))return false;
    return true;
  }),[baseP,fBrand,fCat,fStat,fAttn,search,sales,pN,salesByProd,reservedMap]);
  const sorted=useMemo(()=>{const arr=[...filtered];if(sortBy==="name")arr.sort((a,b)=>pN(a).localeCompare(pN(b)));else if(sortBy==="price_asc")arr.sort((a,b)=>a.price-b.price);else if(sortBy==="price_desc")arr.sort((a,b)=>b.price-a.price);else if(sortBy==="stock_asc")arr.sort((a,b)=>a.stock-b.stock);else if(sortBy==="stock_desc")arr.sort((a,b)=>b.stock-a.stock);else if(sortBy==="last_sold")arr.sort((a,b)=>(getSS(a.id,sales).days??9999)-(getSS(b.id,sales).days??9999));else if(sortBy==="sold_30d_desc")arr.sort((a,b)=>((salesByProd[b.id]||{d30:0}).d30)-((salesByProd[a.id]||{d30:0}).d30));return arr;},[filtered,sortBy,salesByProd]);
  const PAGE=20;const[showCount,setShowCount]=useState(PAGE);
  useEffect(()=>{setShowCount(PAGE);},[fBrand,fCat,fStat,fAttn,search,sortBy]);
  const visible=useMemo(()=>sorted.slice(0,showCount),[sorted,showCount]);
  const hasMore=showCount<sorted.length;
  const emptyF={code:"",name:"",nameT:"",brand:brands[0]||"",categoryId:"",subcategoryId:"",size:"",distributor:"",price:"",cost:"",stock:"",minStock:"",unit:"เครื่อง",discontinued:false};
  const[form,setForm]=useState(emptyF);const[formErrors,setFormErrors]=useState([]);
  useEffect(()=>{if(sh.quickCreate==="product"&&ed){setFormErrors([]);setForm(emptyF);oM("product");sh.clearQuickCreate();}},[sh.quickCreate]);
  const[adjPr,setAdjPr]=useState(null);const[adjForm,setAdjForm]=useState({type:"adjust_in",qty:"",note:""});const[confirmDel,setConfirmDel]=useState(null);
  useEffect(()=>{if(sh.pendingAdjust!=null){const pr=products.find(p=>String(p.id)===String(sh.pendingAdjust));if(pr&&ed){setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}sh.clearPendingAdjust();}},[sh.pendingAdjust]);
  const[sel,setSel]=useState(new Set());const[bulkMode,setBulkMode]=useState(false);const[bulkAct,setBulkAct]=useState(null);
  const[bkPriceF,setBkPriceF]=useState({mode:"set",value:"",pct:""});const[bkStockF,setBkStockF]=useState({type:"adjust_in",qty:"",note:""});const[bkCatF,setBkCatF]=useState({categoryId:"",subcategoryId:""});const[bkMinF,setBkMinF]=useState("");const[bkDistF,setBkDistF]=useState("");
  const setF=(k,v)=>setForm(f=>{const n={...f,[k]:v};if(k==="categoryId")n.subcategoryId="";return n;});
  // Set a dimension AND auto-update cubicM when all 3 dims are positive.
  const setDim=(k,v)=>setForm(f=>{const n={...f,[k]:v};const w=+(k==="widthCm"?v:n.widthCm)||0;const l=+(k==="lengthCm"?v:n.lengthCm)||0;const h=+(k==="heightCm"?v:n.heightCm)||0;if(w>0&&l>0&&h>0)n.cubicM=Math.round(w*l*h/1e6*1000)/1000;return n;});
  const toggleSel=id=>setSel(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n;});
  const selAll=()=>setSel(new Set(sorted.map(p=>p.id)));const selNone=()=>setSel(new Set());
  const selProds=useMemo(()=>products.filter(p=>sel.has(p.id)),[products,sel]);
  const stats=useMemo(()=>{const total=baseP.length;const stockVal=baseP.reduce((s,p)=>s+(p.stock||0)*(p.price||0),0);const low=baseP.filter(p=>p.minStock>0&&p.stock<=p.minStock).length;const totalRes=Object.values(reservedMap).reduce((s,v)=>s+v,0);return{total,stockVal,low,totalRes};},[baseP,reservedMap]);
  const brandCounts=useMemo(()=>{const m={};baseP.forEach(p=>{m[p.brand]=(m[p.brand]||0)+1;});return m;},[baseP]);
  // Most-recent price change per product within last 30 days (for "ลดจาก ฿X" indicator).
  const priceCuts=useMemo(()=>{const out={};if(!priceHist||!priceHist.length)return out;const cutoff=Date.now()-30*86400000;for(const h of priceHist){if(h.field!=="price")continue;const t=new Date(h.date).getTime();if(isNaN(t)||t<cutoff)continue;if(out[h.productId])continue;out[h.productId]=h;}return out;},[priceHist]);
  const series=useMemo(()=>{const ref=new Date();return{total:newProductsSeries(logs||[],30,ref),stockVal:stockValueSeries(baseP,logs||[],30,ref),low:lowStockSeries(baseP,logs||[],30,ref),res:reservedSeries(sales,30,ref)};},[baseP,logs,sales]);
  const deltas=useMemo(()=>{const sumTail=(arr,n)=>arr.slice(-n).reduce((s,v)=>s+v,0);const newCnt=sumTail(series.total,7);const stockNow=series.stockVal[series.stockVal.length-1]||0;const stock7=series.stockVal[series.stockVal.length-8]??stockNow;const stockDelta=stockNow-stock7;return{total:newCnt>0?{text:"+"+newCnt+" สัปดาห์นี้",positive:true}:null,stockVal:stockDelta!==0?{text:(stockDelta>0?"+":"")+"฿"+fmt(Math.round(stockDelta))+" 7 วัน",positive:stockDelta>0}:null};},[series]);
  const saveProd=()=>{const errs=[];if(!form.code)errs.push("ยังไม่กรอกรหัสสินค้า");if(!form.brand)errs.push("ยังไม่เลือกยี่ห้อ");if(!form.name)errs.push("ยังไม่กรอกชื่อสินค้า");
    if(form.splitEnabled){const parts=form.splitParts||[];if(parts.length<2)errs.push("ขายแยกส่วน: ต้องมีอย่างน้อย 2 ส่วน");const sum=parts.reduce((s,p)=>s+(+p.priceRatio||0),0);if(Math.abs(sum-1)>0.001)errs.push("ขายแยกส่วน: ผลรวมสัดส่วนต้องเท่ากับ 1 (ปัจจุบัน "+sum.toFixed(3)+")");if(parts.some(p=>!p.key||!p.name))errs.push("ขายแยกส่วน: ทุกส่วนต้องมี key และชื่อ");const keys=parts.map(p=>String(p.key||"").trim());if(new Set(keys).size!==keys.length)errs.push("ขายแยกส่วน: key แต่ละส่วนต้องไม่ซ้ำกัน");}
    if(errs.length){setFormErrors(errs);return;}setFormErrors([]);const item={...form,id:form.id||Date.now(),categoryId:+form.categoryId,subcategoryId:+form.subcategoryId,price:+form.price,cost:+form.cost,stock:+form.stock,minStock:+form.minStock};if(form.id){const b=products.find(x=>x.id===form.id);if(b){if(b.price!==item.price)addPH(item.id,"price",b.price,item.price);if(b.cost!==item.cost)addPH(item.id,"cost",b.cost,item.cost);if(b.stock!==item.stock){const d=item.stock-b.stock;addLog(mkLog(item.id,d>0?"adjust_in":"adjust_out",Math.abs(d),b.stock,item.stock,"Edit","แก้ไข",cu.username));}{const _money=n=>"฿"+fmt(n);const _catName=id=>{const c=cats.find(x=>x.id===+id);return c?c.name:(id?"#"+id:"—");};const _prodDefs=[{key:"name",label:"ชื่อ"},{key:"brand",label:"ยี่ห้อ"},{key:"price",label:"ราคาขาย",fmt:_money},{key:"cost",label:"ต้นทุน",fmt:_money},{key:"minStock",label:"ขั้นต่ำ"},{key:"categoryId",label:"หมวด",fmt:_catName},{key:"distributor",label:"ผู้จัดจำหน่าย"}];addA("แก้ไขสินค้า",item.code,diffFields(b,item,_prodDefs));}}}else addA("เพิ่มสินค้า",item.code);setProducts(p=>form.id?p.map(x=>x.id===form.id?item:x):[...p,item]);cM();};
  const saveAdj=()=>{if(!adjPr||!adjForm.qty||+adjForm.qty<=0)return;const q=+adjForm.qty,b=adjPr.stock,a=adjForm.type==="adjust_in"?b+q:Math.max(0,b-q);setProducts(p=>p.map(x=>x.id===adjPr.id?{...x,stock:a}:x));addLog(mkLog(adjPr.id,adjForm.type,q,b,a,"Manual",adjForm.note,cu.username));addA("ปรับสต็อก",adjPr.code);cM();setAdjPr(null);};
  const del=id=>{const pr=products.find(p=>p.id===id);if(pr)addA("ลบสินค้า",pr.code);setProducts(p=>p.filter(x=>x.id!==id));};
  const doBulkPrice=()=>{if(selProds.length===0)return;const calc=p=>{if(bkPriceF.mode==="set")return+bkPriceF.value;if(bkPriceF.mode==="pct_up")return Math.round(p.price*(1+(+bkPriceF.pct)/100));return Math.max(0,Math.round(p.price*(1-(+bkPriceF.pct)/100)));};selProds.forEach(p=>{const nv=calc(p);if(nv!==p.price)addPH(p.id,"price",p.price,nv);});setProducts(prev=>prev.map(p=>{if(!sel.has(p.id))return p;return{...p,price:calc(p)};}));addA("ปรับราคา (กลุ่ม)",sel.size+" รายการ"+(bkPriceF.mode==="set"?" → ฿"+bkPriceF.value:bkPriceF.mode==="pct_up"?" +"+bkPriceF.pct+"%":" -"+bkPriceF.pct+"%"));setBulkAct(null);selNone();setBulkMode(false);};
  const doBulkStock=()=>{const q=+bkStockF.qty;if(!q||q<=0||selProds.length===0)return;selProds.forEach(p=>{const b=p.stock;const a=bkStockF.type==="adjust_in"?b+q:Math.max(0,b-q);addLog(mkLog(p.id,bkStockF.type,q,b,a,"Bulk",bkStockF.note,cu.username));});setProducts(prev=>prev.map(p=>{if(!sel.has(p.id))return p;const b=p.stock;const a=bkStockF.type==="adjust_in"?b+q:Math.max(0,b-q);return{...p,stock:a};}));addA("ปรับสต็อก (กลุ่ม)",sel.size+" รายการ "+(bkStockF.type==="adjust_in"?"+":"-")+q);setBulkAct(null);selNone();setBulkMode(false);};
  const doBulkCategory=()=>{if(!bkCatF.categoryId||selProds.length===0)return;const cid=+bkCatF.categoryId;const sid=+bkCatF.subcategoryId||0;setProducts(prev=>prev.map(p=>{if(!sel.has(p.id))return p;return{...p,categoryId:cid,subcategoryId:sid};}));const catName=(cats.find(c=>c.id===cid)||{}).name||cid;addA("เปลี่ยนหมวด (กลุ่ม)",sel.size+" รายการ → "+catName);setBulkAct(null);selNone();setBulkMode(false);};
  const doBulkMinStock=()=>{const v=+bkMinF;if(bkMinF===""||v<0||selProds.length===0)return;setProducts(prev=>prev.map(p=>{if(!sel.has(p.id))return p;return{...p,minStock:v};}));addA("เปลี่ยน minStock (กลุ่ม)",sel.size+" รายการ → "+v);setBulkAct(null);selNone();setBulkMode(false);};
  const doBulkDist=()=>{if(selProds.length===0)return;setProducts(prev=>prev.map(p=>{if(!sel.has(p.id))return p;return{...p,distributor:bkDistF};}));addA("เปลี่ยนผู้จัดจำหน่าย (กลุ่ม)",sel.size+" รายการ → "+(bkDistF||"ไม่ระบุ"));setBulkAct(null);selNone();setBulkMode(false);};
  const doBulkDelete=()=>{if(selProds.length===0)return;const codes=selProds.map(p=>p.code).join(", ");setProducts(prev=>prev.filter(p=>!sel.has(p.id)));addA("ลบสินค้า (กลุ่ม)",sel.size+" รายการ: "+codes.slice(0,100));setBulkAct(null);selNone();setBulkMode(false);};
  const fCO=form.categoryId?cats.find(c=>c.id===+form.categoryId):null;
  const sups=contacts.filter(c=>c.type==="supplier");
  const hasFilter=fBrand||fCat||fStat||search;
  const renderCard=(pr)=>{
    const ss=getSS(pr.id,sales);
    const isLow=pr.minStock>0&&pr.stock<=pr.minStock;
    const pct=pr.minStock>0?Math.min(100,Math.round(pr.stock/pr.minStock*100)):100;
    const res=reservedMap[pr.id]||0;
    const isSel=sel.has(pr.id);
    const isOOS=pr.stock===0&&!pr.discontinued;
    const bc=brandColor(pr.brand||"");
    const hasDims=pr.widthCm&&pr.lengthCm&&pr.heightCm;
    const handleMove=e=>{
      const el=e.currentTarget;const rect=el.getBoundingClientRect();
      const x=e.clientX-rect.left;const y=e.clientY-rect.top;
      const xp=x/rect.width;const yp=y/rect.height;
      const rx=((yp-0.5)*-5).toFixed(2);const ry=((xp-0.5)*5).toFixed(2);
      el.style.transform=`perspective(900px) translateY(-4px) scale(1.012) rotateX(${rx}deg) rotateY(${ry}deg)`;
      el.style.setProperty("--mx",x+"px");el.style.setProperty("--my",y+"px");
    };
    return <div key={pr.id} onClick={()=>bulkMode?toggleSel(pr.id):setDetailPr(pr)} onMouseMove={handleMove} onMouseEnter={e=>{const el=e.currentTarget;el.style.transform="perspective(900px) translateY(-4px) scale(1.012)";el.style.boxShadow=`0 4px 8px rgba(0,0,0,0.08), 0 24px 48px ${bc.alpha(0.45)}, 0 0 0 1px ${bc.alpha(0.4)}`;el.style.borderColor=bc.alpha(0.55);const a=el.querySelector("[data-card-actions]");if(a)a.style.opacity="1";const w=el.querySelector("[data-watermark]");if(w)w.style.opacity="0.16";const sp=el.querySelector("[data-spotlight]");if(sp)sp.style.opacity="1";const st=el.querySelector("[data-stripe]");if(st){st.style.width="9px";st.style.boxShadow=`inset -1px 0 8px ${ss.color}, 0 0 14px ${ss.color}99`;}const rv=el.querySelector("[data-reveal]");if(rv){rv.style.maxHeight="80px";rv.style.opacity="1";rv.style.marginTop="6px";}}} onMouseLeave={e=>{const el=e.currentTarget;el.style.transform="perspective(900px) translateY(0) scale(1) rotateX(0deg) rotateY(0deg)";el.style.boxShadow="var(--shadow-card)";el.style.borderColor=isOOS?"var(--red)":isLow?"var(--orange)":"var(--line)";const a=el.querySelector("[data-card-actions]");if(a)a.style.opacity="0";const w=el.querySelector("[data-watermark]");if(w)w.style.opacity="0.08";const sp=el.querySelector("[data-spotlight]");if(sp)sp.style.opacity="0";const st=el.querySelector("[data-stripe]");if(st){st.style.width="6px";st.style.boxShadow=`inset -1px 0 6px ${ss.color}66, 0 0 8px ${ss.color}40`;}const rv=el.querySelector("[data-reveal]");if(rv){rv.style.maxHeight="0";rv.style.opacity="0";rv.style.marginTop="0";}}} style={{position:"relative",background:isSel&&bulkMode?"var(--blue-bg)":"var(--panel)",border:"1px solid "+(isSel&&bulkMode?"var(--blue)":isOOS?"var(--red)":isLow?"var(--orange)":"var(--line)"),borderRadius:"var(--radius-card,14px)",padding:"16px 18px 16px 24px",display:"flex",flexDirection:"column",gap:10,cursor:"pointer",boxShadow:"var(--shadow-card)",transition:"transform 180ms var(--ease-out,ease-out),box-shadow 220ms var(--ease-out,ease-out),border-color 180ms var(--ease-out,ease-out),background 120ms var(--ease-out,ease-out)",overflow:"hidden",transformStyle:"preserve-3d"}}>
      {/* Status stripe — colored bar at left edge with inner glow */}
      <div data-stripe aria-hidden="true" style={{position:"absolute",left:0,top:0,bottom:0,width:6,background:`linear-gradient(180deg, ${ss.color}, ${ss.color}cc)`,boxShadow:`inset -1px 0 6px ${ss.color}66, 0 0 8px ${ss.color}40`,transition:"width 200ms var(--ease-out,ease-out), box-shadow 200ms var(--ease-out,ease-out)"}}/>
      {/* Spotlight — radial gradient follows cursor */}
      <div data-spotlight aria-hidden="true" style={{position:"absolute",inset:0,pointerEvents:"none",borderRadius:"var(--radius-card,14px)",background:`radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), ${bc.alpha(0.22)}, transparent 65%)`,opacity:0,transition:"opacity 200ms var(--ease-out,ease-out)",zIndex:0}}/>
      {/* Brand watermark — bigger, more visible initials at bottom-right */}
      <div data-watermark aria-hidden="true" style={{position:"absolute",right:-10,bottom:-22,fontSize:88,fontWeight:900,letterSpacing:"-0.04em",color:bc.base,opacity:0.08,pointerEvents:"none",userSelect:"none",lineHeight:0.9,fontFamily:"system-ui,sans-serif",transform:"rotate(-6deg)",transition:"opacity 200ms var(--ease-out,ease-out)"}}>{(pr.brand||"").slice(0,4).toUpperCase()}</div>
      {isOOS&&<div style={{position:"absolute",top:14,right:-32,transform:"rotate(35deg)",background:"var(--red)",color:"#fff",fontSize:10,fontWeight:700,letterSpacing:"0.08em",padding:"3px 38px",boxShadow:"0 1px 3px rgba(0,0,0,0.25)",zIndex:2,pointerEvents:"none"}}>หมดสต็อก</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
          {bulkMode&&ed&&<input type="checkbox" checked={isSel} onChange={()=>toggleSel(pr.id)} onClick={e=>e.stopPropagation()} style={{width:16,height:16,accentColor:"var(--blue)",cursor:"pointer",flexShrink:0}}/>}
          <div style={{fontFamily:"var(--mono,monospace)",fontSize:11,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pr.code}</div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
          <span onClick={e=>{e.stopPropagation();setFBrand(fBrand===pr.brand?"":pr.brand);}} title={fBrand===pr.brand?"คลิกเพื่อล้างตัวกรอง":"กรองยี่ห้อ "+pr.brand} style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:999,background:fBrand===pr.brand?"var(--blue-bg)":"var(--hover)",color:fBrand===pr.brand?"var(--blue)":"var(--dim)",cursor:"pointer"}}>{pr.brand}</span>
          <span title={ss.label} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,padding:"2px 7px",borderRadius:999,background:ss.bg,color:ss.color,fontWeight:700}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:ss.color,display:"inline-block"}}/>
            {ss.icon}
          </span>
        </div>
      </div>
      {(()=>{
        const full=pN(pr)||"";
        const sp=full.indexOf(" ");
        const modelCode=sp===-1?full:full.slice(0,sp);
        const descriptor=sp===-1?"":full.slice(sp+1);
        return <div style={{minHeight:"2.6em",textDecoration:pr.discontinued?"line-through":"none"}}>
          <div style={{fontFamily:"var(--mono, ui-monospace, Consolas, monospace)",fontSize:17,fontWeight:800,letterSpacing:"-0.015em",lineHeight:1.15,backgroundImage:`linear-gradient(135deg, ${bc.text} 0%, ${bc.text} 40%, var(--text) 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",color:bc.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:pr.discontinued?0.5:1}}>{modelCode}</div>
          {descriptor&&<div style={{fontSize:12,color:"var(--dim)",fontWeight:500,marginTop:2,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{descriptor}</div>}
        </div>;
      })()}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <span onClick={e=>{e.stopPropagation();const cidStr=String(pr.categoryId);setFCat(fCat===cidStr?"":cidStr);}} title={fCat===String(pr.categoryId)?"คลิกเพื่อล้างตัวกรอง":"กรองหมวด "+getCN(pr.categoryId)} style={{fontSize:11,background:fCat===String(pr.categoryId)?"var(--blue-bg)":"var(--hover)",borderRadius:4,padding:"2px 8px",color:fCat===String(pr.categoryId)?"var(--blue)":"var(--dim)",cursor:"pointer",fontWeight:fCat===String(pr.categoryId)?600:400}}>{getCN(pr.categoryId)}</span>
        {pr.size&&<span style={{fontSize:11,background:"var(--blue-bg)",borderRadius:4,padding:"2px 8px",color:"var(--blue)",fontWeight:500}}>{pr.size}</span>}
        {pr.discontinued&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:"rgba(255,149,0,0.18)",color:"var(--orange)",fontWeight:600,border:"1px solid var(--orange)"}}>เลิกจำหน่าย</span>}
        {res>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:"rgba(0,122,255,0.12)",color:"var(--blue)",fontWeight:600}}>{"จอง "+res}</span>}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div style={{display:"flex",flexDirection:"column",gap:1}}>
            <span style={{fontSize:10,color:"var(--dim)",textTransform:"uppercase",letterSpacing:"0.05em"}}>สต็อก</span>
            {((pr.defectiveStock||0)>0||res>0)&&<div style={{display:"flex",gap:6,fontSize:10}}>{(pr.defectiveStock||0)>0&&<span style={{color:"var(--orange)"}}>{"ชำรุด "+pr.defectiveStock}</span>}{res>0&&<span style={{color:"var(--blue)"}}>{"พร้อม "+(pr.stock-res)}</span>}</div>}
          </div>
          {(()=>{const critical=isLow||pr.stock<=0;const stockColor=critical?"var(--red)":"var(--green)";const glowRgba=critical?"rgba(255,59,48,0.55)":"rgba(52,199,89,0.5)";return <div style={{display:"flex",alignItems:"baseline",gap:7}}>
            <span aria-hidden="true" style={{width:9,height:9,borderRadius:"50%",background:stockColor,boxShadow:`0 0 10px ${glowRgba}`,alignSelf:"center"}}/>
            <strong className="num" style={{color:stockColor,fontSize:24,fontWeight:800,letterSpacing:"-0.025em",lineHeight:1}}>{pr.stock}</strong>
            <span style={{color:"var(--dim)",fontSize:11,fontWeight:500}}>{"/ "+pr.minStock+" "+pr.unit}</span>
          </div>;})()}
        </div>
        {(()=>{if(pr.stock<=0)return null;const sc=salesByProd[pr.id]||{d7:0,d30:0};const days=daysOfStock(pr.stock,sc.d30);if(days===null||days===Infinity||days>=60)return null;const urgent=days<14;return <div style={{fontSize:11,color:urgent?"var(--red)":"var(--orange)",fontWeight:600,marginTop:6,display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:10}}>{urgent?"⚠":"⏱"}</span>หมดใน ~{Math.max(1,Math.round(days))} วัน</div>;})()}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div>
          <div style={{fontSize:10,color:"var(--dim)",textTransform:"uppercase",letterSpacing:"0.05em"}}>ราคาขาย</div>
          <div style={{display:"flex",alignItems:"baseline",gap:2,marginTop:1}}>
            <span style={{fontSize:14,color:"var(--dim)",fontWeight:500,alignSelf:"flex-start",marginTop:4}}>฿</span>
            <strong className="num" style={{color:"var(--text)",fontSize:26,fontWeight:800,letterSpacing:"-0.025em",lineHeight:1}}>{fmt(pr.price)}</strong>
          </div>
          {(()=>{const cut=priceCuts[pr.id];if(!cut||cut.newVal!==pr.price||!(cut.newVal<cut.oldVal))return null;const pct=Math.round((1-cut.newVal/cut.oldVal)*100);return <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,fontSize:10}}><span className="num" style={{color:"var(--faint)",textDecoration:"line-through"}}>{"฿"+fmt(cut.oldVal)}</span><span style={{padding:"1px 5px",borderRadius:4,background:"rgba(255,59,48,0.14)",color:"var(--red)",fontWeight:700}}>{"-"+pct+"%"}</span></div>;})()}
        </div>
        {ss.days!=null&&<div style={{fontSize:11,color:"var(--faint)"}}>ขายล่าสุด {ss.days}d</div>}
      </div>
      {ed&&<div data-card-actions onClick={e=>e.stopPropagation()} style={{display:"flex",gap:6,paddingTop:6,borderTop:"0.5px solid var(--line)",opacity:0,transition:"opacity 120ms var(--ease-out,ease-out)"}}>
        <button onClick={()=>{setFormErrors([]);setForm({...pr,categoryId:String(pr.categoryId),subcategoryId:String(pr.subcategoryId),price:String(pr.price),cost:String(pr.cost),stock:String(pr.stock),minStock:String(pr.minStock)});oM("product");}} style={{flex:1,fontSize:12,padding:"5px 0",borderRadius:6,border:"1px solid var(--blue)",cursor:"pointer",background:"var(--blue-bg)",color:"var(--blue)",fontFamily:"inherit"}}>แก้ไข</button>
        <button onClick={()=>{setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}} style={{flex:1,fontSize:12,padding:"5px 0",borderRadius:6,border:"1px solid var(--orange)",cursor:"pointer",background:"rgba(255,149,0,0.14)",color:"var(--orange)",fontFamily:"inherit"}}>สต็อก</button>
        {cd&&<button onClick={()=>setConfirmDel(pr)} style={{flex:1,fontSize:12,padding:"5px 0",borderRadius:6,border:"1px solid var(--red)",cursor:"pointer",background:"rgba(255,59,48,0.12)",color:"var(--red)",fontFamily:"inherit"}}>ลบ</button>}
      </div>}
      {/* Hover-reveal: distributor + dimensions (collapsed by default) */}
      <div data-reveal style={{maxHeight:0,opacity:0,overflow:"hidden",transition:"max-height 220ms var(--ease-out,ease-out), opacity 180ms var(--ease-out,ease-out), margin-top 180ms var(--ease-out,ease-out)",fontSize:11,color:"var(--dim)",display:"flex",flexDirection:"column",gap:3}}>
        {pr.distributor&&<div><span style={{color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:9,marginRight:5}}>จำหน่ายโดย</span>{pr.distributor}</div>}
        {pr.splitEnabled&&(pr.splitParts||[]).length>0&&<div><span style={{color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:9,marginRight:5}}>แยกส่วน</span>{(pr.splitParts||[]).map(pt=>`${pt.name} ${pt.widthCm&&pt.lengthCm&&pt.heightCm?`${pt.widthCm}×${pt.lengthCm}×${pt.heightCm}`:"—"}`).join(" · ")} cm</div>}
        {!pr.splitEnabled&&hasDims&&<div><span style={{color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:9,marginRight:5}}>ขนาด</span><span className="num">{pr.widthCm+"×"+pr.lengthCm+"×"+pr.heightCm}</span> cm{pr.noLayDown&&<span style={{color:"var(--orange)",marginLeft:6,fontWeight:600}}>· ห้ามนอน</span>}</div>}
        {!pr.splitEnabled&&!hasDims&&pr.sizeClass&&<div><span style={{color:"var(--faint)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:9,marginRight:5}}>กลุ่มขนาด</span>{pr.sizeClass}</div>}
      </div>
      {(()=>{const sc=salesByProd[pr.id]||{d7:0,d30:0};const anySold=sc.d7>0||sc.d30>0;const trend=salesTrend(sc.d7,sc.d30);const trendInfo=trend==="up"?{icon:"↑",color:"var(--green)"}:trend==="down"?{icon:"↓",color:"var(--orange)"}:null;return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:11,color:"var(--dim)",paddingTop:6,borderTop:"0.5px dashed var(--line)"}}>
        <span style={{textTransform:"uppercase",letterSpacing:"0.04em",fontSize:10,display:"flex",alignItems:"center",gap:4}}>
          ขายไป
          {trendInfo&&<span title={trend==="up"?"ขายเร็วขึ้น":"ขายช้าลง"} style={{color:trendInfo.color,fontSize:13,fontWeight:700,lineHeight:1}}>{trendInfo.icon}</span>}
        </span>
        <span style={{display:"flex",gap:10,alignItems:"baseline",color:anySold?"var(--text)":"var(--faint)"}}>
          <span><strong className="num" style={{fontSize:13,fontWeight:700,color:sc.d7>0?"var(--blue)":"var(--faint)"}}>{sc.d7}</strong><span style={{color:"var(--faint)",marginLeft:3}}>{pr.unit+"/7วัน"}</span></span>
          <span style={{color:"var(--line2)"}}>·</span>
          <span><strong className="num" style={{fontSize:13,fontWeight:700,color:sc.d30>0?"var(--text)":"var(--faint)"}}>{sc.d30}</strong><span style={{color:"var(--faint)",marginLeft:3}}>{pr.unit+"/30วัน"}</span></span>
        </span>
      </div>;})()}
    </div>;
  };
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:18}}>
      <StatCard label="สินค้าทั้งหมด" value={stats.total} animatedValue={stats.total} format={n=>Math.round(n)} color="var(--blue)" sparkline={series.total} delta={deltas.total||undefined}/>
      <StatCard label="มูลค่าสต็อก" value={"฿"+fmt(stats.stockVal)} animatedValue={stats.stockVal} format={n=>"฿"+fmt(Math.round(n))} color="var(--green)" sparkline={series.stockVal} delta={deltas.stockVal||undefined}/>
      <StatCard label="สต็อกต่ำ" value={stats.low} animatedValue={stats.low} format={n=>Math.round(n)} color={stats.low>0?"var(--red)":"var(--dim)"} sparkline={series.low}/>
      <StatCard label="จองอยู่" value={stats.totalRes+" ชิ้น"} animatedValue={stats.totalRes} format={n=>Math.round(n)+" ชิ้น"} color="var(--orange)" sparkline={series.res}/>
    </div>
    {/* Brand × Subcategory Breakdown */}
    <div style={{marginBottom:16}}>
      <button onClick={()=>setShowBreakdown(v=>!v)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,border:"1px solid var(--line)",background:"var(--panel)",color:"var(--text)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
        <span style={{transition:"transform .2s",transform:showBreakdown?"rotate(90deg)":"rotate(0deg)",display:"inline-block"}}>▶</span>
        มูลค่าสต็อกแยกยี่ห้อ × หมวดย่อย
      </button>
      {showBreakdown&&(()=>{
        const brandData=buildBrandSubData(baseP,cats);
        const grandTotal=brandData.reduce((s,b)=>s+b.total,0)||1;
        return <div style={{marginTop:10,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:16}}>
          {brandData.map(b=>{
            const isOpen=bsExpanded[b.name];
            const pct=(b.total/grandTotal*100).toFixed(1);
            return <div key={b.name}>
              <div onClick={()=>setBsExpanded(prev=>({...prev,[b.name]:!prev[b.name]}))} style={{display:"grid",gridTemplateColumns:"20px 1fr auto auto",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",background:isOpen?"var(--hover)":"transparent",border:isOpen?"1px solid var(--line)":"1px solid transparent",transition:"all .15s"}}>
                <span style={{fontSize:12,color:"var(--dim)",transition:"transform .2s",transform:isOpen?"rotate(90deg)":"rotate(0deg)",display:"inline-block"}}>▶</span>
                <span style={{fontSize:13.5,fontWeight:600}}>{b.name}</span>
                <span style={{fontSize:12,color:"var(--dim)",fontVariantNumeric:"tabular-nums"}}>{pct}%</span>
                <span style={{fontSize:13.5,fontWeight:700,color:b.color,fontVariantNumeric:"tabular-nums",minWidth:100,textAlign:"right"}}>{"฿"+fmt(b.total)}</span>
              </div>
              {isOpen&&<div style={{paddingLeft:32,paddingRight:12,paddingBottom:6}}>
                {b.subs.map(sub=>{
                  const subPct=(sub.value/b.total*100).toFixed(1);
                  return <div key={sub.name} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",alignItems:"center",gap:10,padding:"6px 8px",borderBottom:"1px solid var(--line)"}}>
                    <span style={{fontSize:12.5}}>{sub.name}</span>
                    <span style={{fontSize:11,color:"var(--dim)"}}>{sub.items+" รายการ"}</span>
                    <span style={{fontSize:11,color:"var(--dim)",fontVariantNumeric:"tabular-nums"}}>{subPct}%</span>
                    <span style={{fontSize:12.5,fontWeight:600,fontVariantNumeric:"tabular-nums",minWidth:90,textAlign:"right"}}>{"฿"+fmt(sub.value)}</span>
                  </div>;
                })}
              </div>}
            </div>;
          })}
        </div>;
      })()}
    </div>
    <div style={{position:"sticky",top:0,zIndex:20,background:"var(--bg)",margin:"0 -16px",padding:"10px 16px",borderBottom:"1px solid var(--line)",marginBottom:10,backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
        <div style={{minWidth:220,flex:"1 1 220px",maxWidth:360}}><SB value={search} onChange={setSearch} placeholder="ค้นหาสินค้า..."/></div>
        <CustomSelect value={fCat} onChange={setFCat} options={[{value:"",label:"ทุกหมวด"},...cats.map(c=>({value:String(c.id),label:c.name}))]} style={{width:"auto",minWidth:120}}/>
        <CustomSelect value={sortBy} onChange={setSortBy} options={[{value:"name",label:"ชื่อ"},{value:"price_asc",label:"ราคา ↑"},{value:"price_desc",label:"ราคา ↓"},{value:"stock_asc",label:"สต็อก ↑"},{value:"stock_desc",label:"สต็อก ↓"},{value:"last_sold",label:"ขายล่าสุด"},{value:"sold_30d_desc",label:"ขายดี 30 วัน"}]} style={{width:"auto",minWidth:140}}/>
        <div style={{display:"flex",gap:0,border:"1px solid var(--line)",borderRadius:7,overflow:"hidden"}}>
          {[["card","▤"],["table","▦"]].map(([k,ic])=>(
            <button key={k} onClick={()=>setView(k)} title={k==="card"?"การ์ด":"ตาราง"} style={{padding:"6px 11px",border:"none",background:view===k?"var(--blue-bg)":"transparent",color:view===k?"var(--blue)":"var(--dim)",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:500}}>{ic}</button>
          ))}
        </div>
        {view==="table"&&(
          <div style={{display:"flex",gap:0,border:"1px solid var(--line)",borderRadius:7,overflow:"hidden"}}>
            {[["comfortable","≡"],["compact","☰"]].map(([k,ic])=>(
              <button key={k} onClick={()=>setDensity(k)} title={k==="comfortable"?"comfortable":"compact"} style={{padding:"6px 10px",border:"none",background:density===k?"var(--hover2)":"transparent",color:"var(--text)",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>{ic}</button>
            ))}
          </div>
        )}
        {ed&&<div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><Btn onClick={()=>oM("manageCats")}>{"จัดการหมวด"}</Btn><Btn onClick={()=>oM("excelImport")}>{"นำเข้า Excel"}</Btn><Btn onClick={()=>{setFormErrors([]);setForm(emptyF);oM("product");}}>{"+ เพิ่มสินค้า"}</Btn><Btn variant={bulkMode?"pri":undefined} onClick={()=>{if(bulkMode){selNone();setBulkMode(false);}else setBulkMode(true);}}>{bulkMode?"ยกเลิกเลือก":"เลือกหลายรายการ"}</Btn>{bulkMode&&<><Btn size="sm" onClick={selAll}>{"เลือกทั้งหมด ("+sorted.length+")"}</Btn>{sel.size>0&&<Btn size="sm" onClick={selNone}>{"ล้าง"}</Btn>}</>}</div>}
      </div>
      <BrandChipRow brands={brands.filter(b=>(brandCounts[b]||0)>0)} counts={brandCounts} value={fBrand} onChange={setFBrand}/>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
      {(()=>{const cnt=baseP.filter(pr=>{const sc=salesByProd[pr.id]||{d7:0,d30:0};const res=reservedMap[pr.id]||0;return needsAttention(pr,sc.d30,res);}).length;const shouldPulse=cnt>0&&!fAttn;return <div onClick={()=>setFAttn(v=>!v)} className={shouldPulse?"attn-pulse":""} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:99,background:fAttn?"rgba(255,59,48,0.14)":"var(--bg)",border:"1.5px solid "+(fAttn?"var(--red)":cnt>0?"var(--red)":"var(--line)"),cursor:"pointer",fontSize:12,fontWeight:600,color:fAttn?"var(--red)":cnt>0?"var(--red)":"var(--dim)",transition:"background 150ms var(--ease-out,ease-out)"}}><span>⚠</span><span>ต้องดูแล</span><span style={{background:fAttn?"rgba(255,59,48,0.22)":cnt>0?"rgba(255,59,48,0.14)":"var(--line)",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:700}}>{cnt}</span></div>;})()}
      {STOCK_STATUS.map(s=>{const cnt=baseP.filter(pr=>getSS(pr.id,sales).key===s.key).length;return <div key={s.key} onClick={()=>setFStat(fStat===s.key?"":s.key)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:99,background:fStat===s.key?s.bg:"var(--bg)",border:"1.5px solid "+(fStat===s.key?s.color:"var(--line)"),cursor:"pointer",fontSize:12,fontWeight:500,color:fStat===s.key?s.color:"var(--dim)"}}><span>{s.icon}</span><span>{s.label}</span><span style={{background:fStat===s.key?s.color+"22":"var(--line)",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:700}}>{cnt}</span></div>;})}
    </div>
    {sorted.length===0&&<div style={{textAlign:"center",padding:"3rem 1rem"}}><div style={{fontSize:48,marginBottom:8}}>{hasFilter?"":""}
</div><div style={{color:"var(--dim)",fontSize:14,marginBottom:4}}>{hasFilter?"ไม่พบสินค้าที่ตรงกับเงื่อนไข":"ยังไม่มีสินค้า"}</div>{hasFilter&&<div style={{color:"var(--faint)",fontSize:12}}>ลองเปลี่ยนตัวกรอง หรือล้างการค้นหา</div>}{!hasFilter&&ed&&<button onClick={()=>{setFormErrors([]);setForm(emptyF);oM("product");}} style={{marginTop:12,padding:"8px 20px",borderRadius:8,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>+ เพิ่มสินค้าแรก</button>}</div>}
    <div style={{paddingBottom:bulkMode&&sel.size>0?70:0}}>
    {view==="card"?(
      <div className="product-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>{visible.map(pr=>renderCard(pr))}</div>
    ):(
      <ProductsTable
        products={visible}
        sales={sales}
        pN={pN}
        getCN={getCN}
        onRowClick={pr=>setDetailPr(pr)}
        onEdit={pr=>{setFormErrors([]);setForm({...pr,categoryId:String(pr.categoryId),subcategoryId:String(pr.subcategoryId),price:String(pr.price),cost:String(pr.cost),stock:String(pr.stock),minStock:String(pr.minStock)});oM("product");}}
        onAdjust={pr=>{setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}}
        onDelete={pr=>setConfirmDel(pr)}
        ed={ed}
        cd={cd}
        bulkMode={bulkMode}
        selected={sel}
        onToggleSelect={toggleSel}
        sortBy={sortBy}
        onSortChange={setSortBy}
        density={density}
      />
    )}
    <style>{`
      @media (hover: none) { [data-card-actions] { opacity: 1 !important; } }
      @keyframes attn-breathe {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.0); }
        50%      { box-shadow: 0 0 0 6px rgba(255,59,48,0.15); }
      }
      .attn-pulse { animation: attn-breathe 2.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .attn-pulse { animation: none !important; } }
    `}</style>
    {hasMore&&<div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:12,color:"var(--dim)",marginBottom:8}}>{"แสดง "+visible.length+" / "+sorted.length+" รายการ"}</div><button onClick={()=>setShowCount(c=>c+PAGE)} style={{padding:"8px 24px",borderRadius:8,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:"inherit"}}>{"โหลดเพิ่ม "+Math.min(PAGE,sorted.length-showCount)+" รายการ"}</button></div>}
    </div>
    {bulkMode&&sel.size>0&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:"var(--panel)",borderTop:"1.5px solid var(--line)",padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",boxShadow:"0 -4px 20px rgba(0,0,0,0.15)"}}>
      <span style={{fontWeight:600,fontSize:13,color:"var(--blue)",marginRight:4}}>{"เลือก "+sel.size+" รายการ"}</span>
      <Btn size="sm" onClick={()=>{setBkPriceF({mode:"set",value:"",pct:""});setBulkAct("price");}}>{"ปรับราคา"}</Btn>
      <Btn size="sm" onClick={()=>{setBkStockF({type:"adjust_in",qty:"",note:""});setBulkAct("stock");}}>{"ปรับ stock"}</Btn>
      <Btn size="sm" onClick={()=>{setBkCatF({categoryId:"",subcategoryId:""});setBulkAct("category");}}>{"เปลี่ยนหมวด"}</Btn>
      <Btn size="sm" onClick={()=>{setBkMinF("");setBulkAct("minStock");}}>{"เปลี่ยน minStock"}</Btn>
      <Btn size="sm" onClick={()=>{setBkDistF("");setBulkAct("dist");}}>{"เปลี่ยนผู้จัดจำหน่าย"}</Btn>
      {cd&&<button onClick={()=>setBulkAct("delete")} style={{fontSize:12,padding:"4px 10px",borderRadius:7,border:"1px solid var(--red)",cursor:"pointer",background:"rgba(255,59,48,0.12)",color:"var(--red)",fontFamily:"inherit",fontWeight:500}}>{"ลบ"}</button>}
      <div style={{marginLeft:"auto"}}><Btn size="sm" onClick={()=>{selNone();setBulkMode(false);}}>{"ยกเลิก"}</Btn></div>
    </div>}
    {confirmDel&&<Modal title="ยืนยันลบ" onClose={()=>setConfirmDel(null)}><div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบ "+confirmDel.brand+" — "+pN(confirmDel)+" ถาวร"}</div><MBtns onCancel={()=>setConfirmDel(null)} onSave={()=>{del(confirmDel.id);setConfirmDel(null);}} saveLabel="ลบ"/></Modal>}
    {modal==="adjust"&&adjPr&&ed&&<Modal title={"ปรับสต็อก — "+pN(adjPr)} onClose={cM}>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"var(--dim)"}}>ปัจจุบัน</span><span style={{fontWeight:700,fontSize:18}}>{adjPr.stock+" "+adjPr.unit}</span></div>
      <div style={{display:"grid",gap:12}}>
        <Field label="ประเภท"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["adjust_in","เพิ่ม"],["adjust_out","ลด"]].map(v=><label key={v[0]} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1.5px solid "+(adjForm.type===v[0]?"var(--green)":"var(--line)"),cursor:"pointer",background:adjForm.type===v[0]?"rgba(52,199,89,0.12)":"var(--panel)"}}><input type="radio" name="at" checked={adjForm.type===v[0]} onChange={()=>setAdjForm(f=>({...f,type:v[0]}))}/><span style={{fontWeight:500,color:adjForm.type===v[0]?"var(--green)":"var(--text)"}}>{v[1]}</span></label>)}</div></Field>
        <Field label="จำนวน"><input type="number" min="1" value={adjForm.qty} onChange={e=>setAdjForm(f=>({...f,qty:e.target.value}))} style={IB}/></Field>
        <Field label="หมายเหตุ"><input value={adjForm.note} onChange={e=>setAdjForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
      </div><MBtns onCancel={cM} onSave={saveAdj}/>
    </Modal>}
    {modal==="product"&&ed&&<Modal title={form.id?"แก้ไขสินค้า":"เพิ่มสินค้าใหม่"} onClose={cM}>
      <div className="form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="รหัส"><input value={form.code} onChange={e=>setF("code",e.target.value)} style={IB}/></Field>
        <Field label="ยี่ห้อ"><CustomSelect value={form.brand} onChange={v=>setF("brand",v)} options={[{value:"",label:"เลือก..."},...brands.map(b=>({value:b,label:b}))]}/></Field>
        <Field label="ชื่อ EN"><input value={form.name} onChange={e=>setF("name",e.target.value)} style={IB}/></Field>
        <Field label="ชื่อ TH"><input value={form.nameT} onChange={e=>setF("nameT",e.target.value)} style={IB}/></Field>
        <Field label="หมวด"><CustomSelect value={form.categoryId} onChange={v=>setF("categoryId",v)} options={[{value:"",label:"เลือก..."},...cats.map(c=>({value:String(c.id),label:c.name}))]}/></Field>
        <Field label="หมวดย่อย"><CustomSelect value={form.subcategoryId} onChange={v=>setF("subcategoryId",v)} options={[{value:"",label:"เลือก..."},...(fCO?fCO.subs:[]).map(s=>({value:String(s.id),label:s.name}))]} disabled={!fCO}/></Field>
        <Field label="ขนาด"><input value={form.size} onChange={e=>setF("size",e.target.value)} style={IB}/></Field>
        <Field label="ผู้จัดจำหน่าย"><CustomSelect value={form.distributor} onChange={v=>setF("distributor",v)} options={[{value:"",label:"ไม่ระบุ"},...sups.map(s=>({value:s.name,label:s.name}))]}/></Field>
        <Field label="ราคาขาย"><input type="number" value={form.price} onChange={e=>setF("price",e.target.value)} style={IB}/></Field>
        <Field label="ต้นทุน"><input type="number" value={form.cost} onChange={e=>setF("cost",e.target.value)} style={IB}/></Field>
        <Field label="สต็อก"><input type="number" value={form.stock} onChange={e=>setF("stock",e.target.value)} style={IB}/></Field>
        <Field label="ขั้นต่ำ"><input type="number" value={form.minStock} onChange={e=>setF("minStock",e.target.value)} style={IB}/></Field>
        <Field label="กลุ่มขนาด (จัดส่ง)"><CustomSelect value={form.sizeClass||"M"} onChange={v=>setF("sizeClass",v)} options={[{value:"S",label:"S — เล็ก (~0.05 m³)"},{value:"M",label:"M — กลาง (~0.30 m³)"},{value:"L",label:"L — ใหญ่ (~1.00 m³)"},{value:"XL",label:"XL — ใหญ่มาก (~2.50 m³)"}]}/></Field>
        {!form.splitEnabled&&<Field label="ปริมาตร m³ (override)"><input type="number" step="0.01" value={form.cubicM??""} onChange={e=>setF("cubicM",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="เว้นไว้ = ใช้ตามกลุ่ม"/></Field>}
        {!form.splitEnabled&&<div style={{gridColumn:"1/-1",background:"var(--hover)",border:"1px solid var(--line)",borderRadius:8,padding:"10px 12px",marginTop:4}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:8}}>ขนาดกล่อง (cm) — สำหรับจัดวางบนรถ</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <Field label="กว้าง W"><input type="number" step="0.1" value={form.widthCm??""} onChange={e=>setDim("widthCm",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="60"/></Field>
            <Field label="ยาว L"><input type="number" step="0.1" value={form.lengthCm??""} onChange={e=>setDim("lengthCm",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="80"/></Field>
            <Field label="สูง H"><input type="number" step="0.1" value={form.heightCm??""} onChange={e=>setDim("heightCm",e.target.value===""?undefined:parseFloat(e.target.value))} style={IB} placeholder="175"/></Field>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
            <input type="checkbox" checked={!!form.noLayDown} onChange={e=>setF("noLayDown",e.target.checked)}/>
            ห้ามนอน (ต้องวางตั้งเท่านั้น เช่น ตู้เย็น ตู้กดน้ำ)
          </label>
          {(()=>{const w=+form.widthCm||0,l=+form.lengthCm||0,h=+form.heightCm||0,v=w>0&&l>0&&h>0?(w*l*h)/1e6:null;return <div style={{fontSize:11,color:v!=null?"var(--green)":"var(--faint)",marginTop:6,fontWeight:v!=null?500:400}}>{v!=null?`คำนวณได้: ${v.toFixed(3)} m³ (${w}×${l}×${h}/1,000,000) — ใช้แทนกลุ่มขนาดอัตโนมัติ`:`กรอกครบทั้ง 3 ค่า → ใช้คำนวณปริมาตรอัตโนมัติ (W×L×H/1,000,000)`}</div>;})()}
        </div>}
        {/* Split-parts (sold as set, e.g., AC = hot+cold coils) */}
        <div style={{gridColumn:"1/-1",background:"var(--hover)",border:"1px solid var(--line)",borderRadius:8,padding:"10px 12px",marginTop:4}}>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,color:"var(--dim)",cursor:"pointer",marginBottom:form.splitEnabled?8:0}}>
            <input type="checkbox" checked={!!form.splitEnabled} onChange={e=>{const enabled=e.target.checked;setF("splitEnabled",enabled);if(enabled&&!(form.splitParts||[]).length)setF("splitParts",DEFAULT_SPLIT_PARTS.map(p=>({...p})));}}/>
            ขายแยกส่วน (เช่น แอร์ คอยล์ร้อน + คอยล์เย็น)
          </label>
          {form.splitEnabled&&<>
            <div style={{fontSize:11,color:"var(--faint)",marginBottom:8}}>สินค้าจะนับสต็อก/ส่งเป็น 1 ชุด แต่ใน SO/ใบเสร็จและรายการจัดของแสดงแยกแต่ละส่วน</div>
            <div style={{display:"grid",gridTemplateColumns:"100px 1fr 100px 40px",gap:8,fontSize:11,color:"var(--dim)",marginBottom:4,paddingLeft:4}}>
              <span>key</span><span>ชื่อส่วน</span><span style={{textAlign:"right"}}>ratio</span><span></span>
            </div>
            {(form.splitParts||[]).map((p,i)=>{
              const upd=(k,v)=>setF("splitParts",(form.splitParts||[]).map((x,xi)=>xi===i?{...x,[k]:v}:x));
              const num=e=>e.target.value===""?undefined:parseFloat(e.target.value);
              return (
              <div key={i} style={{border:"1px solid var(--line)",borderRadius:6,padding:8,marginBottom:6,background:"var(--bg)"}}>
                <div style={{display:"grid",gridTemplateColumns:"100px 1fr 100px 40px",gap:8}}>
                  <input value={p.key||""} onChange={e=>upd("key",e.target.value)} style={IB} placeholder="hot"/>
                  <input value={p.name||""} onChange={e=>upd("name",e.target.value)} style={IB} placeholder="คอยล์ร้อน"/>
                  <input type="number" step="0.01" min="0" max="1" value={p.priceRatio??""} onChange={e=>upd("priceRatio",e.target.value===""?0:parseFloat(e.target.value))} style={{...IB,textAlign:"right"}} placeholder="0.6"/>
                  <button type="button" onClick={()=>setF("splitParts",(form.splitParts||[]).filter((_,xi)=>xi!==i))} style={{padding:"6px 0",borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>×</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,marginTop:6,alignItems:"center"}}>
                  <input type="number" step="0.1" value={p.widthCm??""} onChange={e=>upd("widthCm",num(e))} style={IB} placeholder="กว้าง W"/>
                  <input type="number" step="0.1" value={p.lengthCm??""} onChange={e=>upd("lengthCm",num(e))} style={IB} placeholder="ยาว L"/>
                  <input type="number" step="0.1" value={p.heightCm??""} onChange={e=>upd("heightCm",num(e))} style={IB} placeholder="สูง H"/>
                  <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--dim)",whiteSpace:"nowrap",cursor:"pointer"}}>
                    <input type="checkbox" checked={!!p.noLayDown} onChange={e=>upd("noLayDown",e.target.checked)}/>ห้ามนอน
                  </label>
                </div>
                {(()=>{const v=partCubicM(p)||null;return <div style={{fontSize:11,color:v!=null?"var(--green)":"var(--faint)",marginTop:5,fontWeight:v!=null?500:400}}>{v!=null?`ปริมาตร: ${v.toFixed(3)} m³ (${p.widthCm}×${p.lengthCm}×${p.heightCm}/1,000,000)`:"กรอกครบ 3 ค่า → คำนวณปริมาตรส่วนนี้"}</div>;})()}
              </div>
              );
            })}
            <button type="button" onClick={()=>setF("splitParts",[...(form.splitParts||[]),{key:"",name:"",priceRatio:0}])} style={{marginTop:4,padding:"5px 10px",borderRadius:5,border:"1px dashed var(--blue)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>+ เพิ่มส่วน</button>
            {(() => {const sum=(form.splitParts||[]).reduce((s,p)=>s+(+p.priceRatio||0),0);const ok=Math.abs(sum-1)<=0.001;return <div style={{fontSize:11,color:ok?"var(--green)":"var(--orange)",marginTop:6,fontWeight:500}}>ผลรวมสัดส่วน: {sum.toFixed(3)} {ok?"✓":"(ต้อง = 1)"}</div>;})()}
            {(() => {const tot=(form.splitParts||[]).reduce((s,p)=>s+partCubicM(p),0);return tot>0?<div style={{fontSize:11,color:"var(--green)",marginTop:3,fontWeight:500}}>ปริมาตรรวมทั้งชุด: {tot.toFixed(3)} m³</div>:null;})()}
          </>}
        </div>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,marginTop:12,padding:"10px 14px",borderRadius:8,border:"1px solid "+(form.discontinued?"var(--orange)":"var(--line)"),background:form.discontinued?"rgba(255,149,0,0.08)":"var(--bg)",cursor:"pointer"}}>
        <input type="checkbox" checked={!!form.discontinued} onChange={e=>setF("discontinued",e.target.checked)} style={{accentColor:"var(--orange)"}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:form.discontinued?"var(--orange)":"var(--text)"}}>เลิกจำหน่ายแล้ว</div>
          <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>จะไม่แสดงใน SO/PO/ใบเสนอราคา แต่ยังบันทึกของชำรุดได้</div>
        </div>
      </label>
      {formErrors.length>0&&<div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"10px 14px",marginTop:12}}><div style={{fontSize:12,fontWeight:600,color:"var(--red)",marginBottom:4}}>กรุณากรอกข้อมูลให้ครบ:</div>{formErrors.map((e,i)=><div key={i} style={{fontSize:12,color:"var(--red)",marginBottom:2}}>{"• "+e}</div>)}</div>}
      <MBtns onCancel={cM} onSave={saveProd}/>
    </Modal>}
    {modal==="manageCats"&&<CatMgr cats={cats} setCats={setCats} onClose={cM}/>}
    {modal==="excelImport"&&<ExcelImport onClose={cM} cats={cats} brands={brands} contacts={contacts} products={products} onImport={(newItems,updateItems)=>{const allItems=[...newItems,...(updateItems||[])];const newBrands=new Set();allItems.forEach(it=>{if(it.brand&&!brands.includes(it.brand))newBrands.add(it.brand);});if(newBrands.size)sh.setBrands(b=>[...b,...newBrands]);if(newItems.length)setProducts(p=>[...p,...newItems]);if(updateItems?.length)setProducts(p=>p.map(x=>{const u=updateItems.find(ui=>ui.id===x.id);return u?{...x,...u}:x;}));addA("นำเข้า Excel",(newItems.length?" เพิ่ม "+newItems.length:"")+(updateItems?.length?" อัพเดท "+updateItems.length:""));}}/>}

    {bulkAct==="price"&&<Modal title={"ปรับราคา — "+sel.size+" รายการ"} onClose={()=>setBulkAct(null)}>
      <div style={{marginBottom:12,fontSize:12,color:"var(--dim)"}}>{selProds.slice(0,5).map(p=>pN(p)).join(", ")+(sel.size>5?" ...":"")}</div>
      <div style={{display:"grid",gap:12}}>
        <Field label="รูปแบบ"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[["set","กำหนดราคา"],["pct_up","เพิ่ม %"],["pct_down","ลด %"]].map(v=><label key={v[0]} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1.5px solid "+(bkPriceF.mode===v[0]?"var(--blue)":"var(--line)"),cursor:"pointer",background:bkPriceF.mode===v[0]?"var(--blue-bg)":"var(--panel)"}}><input type="radio" name="bkpm" checked={bkPriceF.mode===v[0]} onChange={()=>setBkPriceF(f=>({...f,mode:v[0]}))}/><span style={{fontWeight:500,fontSize:12,color:bkPriceF.mode===v[0]?"var(--blue)":"var(--text)"}}>{v[1]}</span></label>)}</div></Field>
        {bkPriceF.mode==="set"?<Field label="ราคาใหม่ (บาท)"><input type="number" min="0" value={bkPriceF.value} onChange={e=>setBkPriceF(f=>({...f,value:e.target.value}))} style={IB}/></Field>:<Field label="เปอร์เซ็นต์ (%)"><input type="number" min="0" max="100" value={bkPriceF.pct} onChange={e=>setBkPriceF(f=>({...f,pct:e.target.value}))} style={IB}/></Field>}
      </div>
      {(bkPriceF.value||bkPriceF.pct)&&<div style={{marginTop:12,background:"var(--bg)",borderRadius:8,padding:12,maxHeight:150,overflowY:"auto"}}><div style={{fontSize:11,color:"var(--dim)",marginBottom:6}}>ตัวอย่าง</div>{selProds.slice(0,5).map(p=>{const nv=bkPriceF.mode==="set"?+bkPriceF.value:bkPriceF.mode==="pct_up"?Math.round(p.price*(1+(+bkPriceF.pct)/100)):Math.max(0,Math.round(p.price*(1-(+bkPriceF.pct)/100)));return <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}><span>{pN(p)}</span><span>{"฿"+fmt(p.price)+" → ฿"+fmt(Math.max(0,nv))}</span></div>;})}</div>}
      <MBtns onCancel={()=>setBulkAct(null)} onSave={doBulkPrice} saveLabel={"ปรับราคา "+sel.size+" รายการ"} disabled={bkPriceF.mode==="set"?!bkPriceF.value:!bkPriceF.pct}/>
    </Modal>}

    {bulkAct==="stock"&&<Modal title={"ปรับ stock — "+sel.size+" รายการ"} onClose={()=>setBulkAct(null)}>
      <div style={{marginBottom:12,fontSize:12,color:"var(--dim)"}}>{selProds.slice(0,5).map(p=>pN(p)).join(", ")+(sel.size>5?" ...":"")}</div>
      <div style={{display:"grid",gap:12}}>
        <Field label="ประเภท"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["adjust_in","เพิ่ม"],["adjust_out","ลด"]].map(v=><label key={v[0]} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1.5px solid "+(bkStockF.type===v[0]?"var(--green)":"var(--line)"),cursor:"pointer",background:bkStockF.type===v[0]?"rgba(52,199,89,0.12)":"var(--panel)"}}><input type="radio" name="bkst" checked={bkStockF.type===v[0]} onChange={()=>setBkStockF(f=>({...f,type:v[0]}))}/><span style={{fontWeight:500,color:bkStockF.type===v[0]?"var(--green)":"var(--text)"}}>{v[1]}</span></label>)}</div></Field>
        <Field label="จำนวน"><input type="number" min="1" value={bkStockF.qty} onChange={e=>setBkStockF(f=>({...f,qty:e.target.value}))} style={IB}/></Field>
        <Field label="หมายเหตุ"><input value={bkStockF.note} onChange={e=>setBkStockF(f=>({...f,note:e.target.value}))} style={IB}/></Field>
      </div>
      <MBtns onCancel={()=>setBulkAct(null)} onSave={doBulkStock} saveLabel={"ปรับ stock "+sel.size+" รายการ"} disabled={!bkStockF.qty||+bkStockF.qty<=0}/>
    </Modal>}

    {bulkAct==="category"&&<Modal title={"เปลี่ยนหมวด — "+sel.size+" รายการ"} onClose={()=>setBulkAct(null)}>
      <div style={{marginBottom:12,fontSize:12,color:"var(--dim)"}}>{selProds.slice(0,5).map(p=>pN(p)).join(", ")+(sel.size>5?" ...":"")}</div>
      <div style={{display:"grid",gap:12}}>
        <Field label="หมวดหมู่"><CustomSelect value={bkCatF.categoryId} onChange={v=>setBkCatF({categoryId:v,subcategoryId:""})} options={[{value:"",label:"เลือก..."},...cats.map(c=>({value:String(c.id),label:c.name}))]}/></Field>
        <Field label="หมวดย่อย"><CustomSelect value={bkCatF.subcategoryId} onChange={v=>setBkCatF(f=>({...f,subcategoryId:v}))} options={[{value:"",label:"เลือก..."},...(bkCatF.categoryId?((cats.find(c=>c.id===+bkCatF.categoryId)||{}).subs||[]):[]).map(s=>({value:String(s.id),label:s.name}))]} disabled={!bkCatF.categoryId}/></Field>
      </div>
      <MBtns onCancel={()=>setBulkAct(null)} onSave={doBulkCategory} saveLabel={"เปลี่ยน "+sel.size+" รายการ"} disabled={!bkCatF.categoryId}/>
    </Modal>}

    {bulkAct==="minStock"&&<Modal title={"เปลี่ยน minStock — "+sel.size+" รายการ"} onClose={()=>setBulkAct(null)}>
      <div style={{marginBottom:12,fontSize:12,color:"var(--dim)"}}>{selProds.slice(0,5).map(p=>pN(p)).join(", ")+(sel.size>5?" ...":"")}</div>
      <Field label="ขั้นต่ำใหม่"><input type="number" min="0" value={bkMinF} onChange={e=>setBkMinF(e.target.value)} style={IB}/></Field>
      <div style={{marginTop:8,fontSize:11,color:"var(--faint)"}}>{bkMinF==="0"?"* ตั้ง 0 = ไม่เตือนสต็อกต่ำ":""}</div>
      <MBtns onCancel={()=>setBulkAct(null)} onSave={doBulkMinStock} saveLabel={"ตั้งค่า "+sel.size+" รายการ"} disabled={bkMinF===""||+bkMinF<0}/>
    </Modal>}

    {bulkAct==="dist"&&<Modal title={"เปลี่ยนผู้จัดจำหน่าย — "+sel.size+" รายการ"} onClose={()=>setBulkAct(null)}>
      <div style={{marginBottom:12,fontSize:12,color:"var(--dim)"}}>{selProds.slice(0,5).map(p=>pN(p)).join(", ")+(sel.size>5?" ...":"")}</div>
      <Field label="ผู้จัดจำหน่าย"><CustomSelect value={bkDistF} onChange={v=>setBkDistF(v)} options={[{value:"",label:"ไม่ระบุ"},...sups.map(s=>({value:s.name,label:s.name}))]}/></Field>
      <MBtns onCancel={()=>setBulkAct(null)} onSave={doBulkDist} saveLabel={"เปลี่ยน "+sel.size+" รายการ"}/>
    </Modal>}

    {bulkAct==="delete"&&<Modal title={"ยืนยันลบ — "+sel.size+" รายการ"} onClose={()=>setBulkAct(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:"var(--red)"}}>{"จะลบสินค้า "+sel.size+" รายการถาวร"}</div>
      <div style={{maxHeight:200,overflowY:"auto",marginBottom:12}}>{selProds.map(p=><div key={p.id} style={{fontSize:12,padding:"4px 0",borderBottom:"0.5px solid var(--line)"}}>{p.brand+" — "+pN(p)+" ("+p.code+")"}</div>)}</div>
      <MBtns onCancel={()=>setBulkAct(null)} onSave={doBulkDelete} saveLabel={"ลบ "+sel.size+" รายการ"}/>
    </Modal>}

    {detailPr&&(()=>{
      const pr=products.find(x=>x.id===detailPr.id)||detailPr;
      const ss=getSS(pr.id,sales);const isLow=pr.minStock>0&&pr.stock<=pr.minStock;
      const custMap={};contacts.filter(c=>c.type==="customer").forEach(c=>custMap[c.id]=c);
      const supMap={};contacts.filter(c=>c.type==="supplier").forEach(c=>supMap[c.id]=c);

      const movements=[];
      (logs||[]).filter(l=>l.productId===pr.id).forEach(l=>{
        const so=l.type==="out"&&l.ref?sales.find(s=>s.soNum===l.ref):null;
        const po=l.type==="in"&&l.ref&&l.ref.startsWith("PO")?(pos||[]).find(p=>p.poNum===l.ref):null;
        movements.push({
          date:l.date,type:l.type,qty:l.qty,before:l.qtyBefore,after:l.qtyAfter,ref:l.ref,note:l.note,user:l.user,
          custName:so&&so.customerId&&custMap[so.customerId]?cN(custMap[so.customerId]):null,
          supName:po&&po.supplierId&&supMap[po.supplierId]?cN(supMap[po.supplierId]):null,
          soItems:so?so.items.filter(i=>i.productId===pr.id):[],
        });
      });

      const soList=sales.filter(s=>s.status!=="draft"&&(s.items||[]).some(i=>i.productId===pr.id)).map(so=>{
        const it=so.items.find(i=>i.productId===pr.id);
        const cust=custMap[so.customerId];
        return{...so,qty:it?it.qty:0,price:it?it.price:0,custName:cust?cN(cust):"-"};
      }).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

      const typeLabel=t=>({in:"รับเข้า",out:"ขายออก",adjust_in:"ปรับเพิ่ม",adjust_out:"ปรับลด"}[t]||t);
      const typeColor=t=>({in:"var(--green)",out:"var(--blue)",adjust_in:"var(--orange)",adjust_out:"var(--red)"}[t]||"var(--dim)");
      const typeBg=t=>({in:"rgba(52,199,89,0.12)",out:"rgba(0,122,255,0.12)",adjust_in:"rgba(255,149,0,0.12)",adjust_out:"rgba(255,59,48,0.12)"}[t]||"var(--hover)");

      const TH={padding:"7px 10px",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)",fontSize:11,textAlign:"left"};
      const TD={padding:"7px 10px",fontSize:12,borderBottom:"0.5px solid var(--line)"};

      const dRes=reservedMap[pr.id]||0;
      const catObj=cats.find(c=>c.id===pr.categoryId);const subObj=catObj?(catObj.subs||[]).find(s=>s.id===pr.subcategoryId):null;
      return<SlideOver title={pr.brand+" — "+pN(pr)} onClose={()=>setDetailPr(null)} width={560} footer={ed?<>
        <button onClick={()=>{setFormErrors([]);setForm({...pr,categoryId:String(pr.categoryId),subcategoryId:String(pr.subcategoryId),price:String(pr.price),cost:String(pr.cost),stock:String(pr.stock),minStock:String(pr.minStock)});oM("product");}} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}>แก้ไข</button>
        <button onClick={()=>{setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.14)",color:"var(--orange)",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}>ปรับสต็อก</button>
        {cd&&<button onClick={()=>setConfirmDel(pr)} style={{padding:"7px 14px",borderRadius:7,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}>ลบ</button>}
      </>:undefined}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
          <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--dim)",marginBottom:2}}>สต็อกปัจจุบัน</div>
            <div style={{fontSize:22,fontWeight:700,color:isLow?"var(--red)":"var(--green)"}}>{pr.stock}<span style={{fontSize:12,fontWeight:400,color:"var(--dim)"}}>{" "+pr.unit}</span></div>
            {(pr.defectiveStock||0)>0&&<div style={{fontSize:11,color:"var(--orange)",marginTop:2}}>{"ชำรุด: "+pr.defectiveStock+" "+pr.unit}</div>}
          </div>
          <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--dim)",marginBottom:2}}>จองอยู่ / พร้อมขาย</div>
            <div style={{fontSize:18,fontWeight:600,color:dRes>0?"var(--orange)":"var(--dim)"}}>{dRes>0?<><span style={{color:"var(--orange)"}}>{dRes}</span><span style={{color:"var(--dim)",fontSize:13}}>{" / "}</span><span style={{color:"var(--green)"}}>{pr.stock-dRes}</span></>:<span style={{color:"var(--dim)"}}>-</span>}</div>
          </div>
          <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--dim)",marginBottom:2}}>ราคาขาย</div>
            <div style={{fontSize:18,fontWeight:600,color:"var(--blue)"}}>{"฿"+fmt(pr.price)}</div>
          </div>
          <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--dim)",marginBottom:2}}>ต้นทุน</div>
            <div style={{fontSize:18,fontWeight:600}}>{"฿"+fmt(pr.cost)}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,background:ss.bg,color:ss.color,fontWeight:600}}>{ss.icon+" "+ss.label}</span>
          <span style={{fontSize:11,color:"var(--faint)"}}>{ss.days!=null?ss.days+" วันที่แล้ว":"ยังไม่เคยขาย"}</span>
          {catObj&&<span style={{fontSize:11,background:"var(--hover)",borderRadius:4,padding:"2px 8px",color:"var(--dim)"}}>{catObj.name}{subObj?" › "+subObj.name:""}</span>}
          {pr.size&&<span style={{fontSize:11,background:"var(--blue-bg)",borderRadius:4,padding:"2px 8px",color:"var(--blue)",fontWeight:500}}>{pr.size}</span>}
          {pr.distributor&&<span style={{fontSize:11,color:"var(--dim)"}}>{pr.distributor}</span>}
        </div>
        {soList.length>0&&<>
          <div style={{fontWeight:600,fontSize:13,margin:"16px 0 8px",color:"var(--text)"}}>{"ประวัติการขาย ("+soList.length+" รายการ)"}</div>
          <div style={{overflowX:"auto",border:"1px solid var(--line)",borderRadius:8,marginBottom:16}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"var(--bg)"}}>
                {["วันที่","SO No.","ลูกค้า","จำนวน","ราคา/หน่วย","รวม","สถานะ"].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>{soList.slice(0,50).map(so=><tr key={so.id} style={{borderBottom:"0.5px solid var(--line)"}}>
                <td style={{...TD,color:"var(--faint)",fontSize:11}}>{toBE(so.date)}</td>
                <td style={{...TD,fontWeight:500}}>{so.soNum}</td>
                <td style={TD}>{so.custName}</td>
                <td style={TD}>{so.qty+" "+pr.unit}</td>
                <td style={TD}>{"฿"+fmt(so.price)}</td>
                <td style={{...TD,fontWeight:600}}>{"฿"+fmt(so.qty*so.price)}</td>
                <td style={TD}><span style={{fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:600,background:so.status==="completed"?"rgba(52,199,89,0.12)":so.status==="cancelled"?"rgba(255,59,48,0.12)":"rgba(255,149,0,0.12)",color:so.status==="completed"?"var(--green)":so.status==="cancelled"?"var(--red)":"var(--orange)"}}>{so.status==="completed"?"เสร็จ":so.status==="cancelled"?"ยกเลิก":so.status==="pending_delivery"?"รอส่ง":so.status==="out_for_delivery"?"เตรียมส่ง":"รอ"}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}

        {movements.length>0&&<>
          <div style={{fontWeight:600,fontSize:13,margin:"0 0 8px",color:"var(--text)"}}>{"ประวัติเคลื่อนไหวสต็อก ("+movements.length+" รายการ)"}</div>
          <div style={{overflowX:"auto",border:"1px solid var(--line)",borderRadius:8}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"var(--bg)"}}>
                {["วันที่","ประเภท","อ้างอิง","รายละเอียด","จำนวน","ก่อน","หลัง","ผู้ทำ"].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>{movements.slice(0,50).map((m,i)=><tr key={i} style={{borderBottom:"0.5px solid var(--line)"}}>
                <td style={{...TD,color:"var(--faint)",fontSize:11,whiteSpace:"nowrap"}}>{fmtD(m.date)}</td>
                <td style={TD}><span style={{fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:600,background:typeBg(m.type),color:typeColor(m.type)}}>{typeLabel(m.type)}</span></td>
                <td style={{...TD,fontWeight:500}}>{m.ref||"-"}</td>
                <td style={{...TD,color:"var(--dim)"}}>{m.custName||m.supName||m.note||"-"}</td>
                <td style={{...TD,fontWeight:600,color:typeColor(m.type)}}>{(m.type==="out"||m.type==="adjust_out"?"-":"+")+m.qty}</td>
                <td style={{...TD,color:"var(--faint)"}}>{m.before}</td>
                <td style={{...TD,fontWeight:500}}>{m.after}</td>
                <td style={{...TD,color:"var(--faint)",fontSize:11}}>{m.user}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}

        {soList.length===0&&movements.length===0&&<div style={{textAlign:"center",color:"var(--faint)",padding:"2rem"}}>ยังไม่มีประวัติ</div>}
      </SlideOver>;
    })()}
  </div>;
}

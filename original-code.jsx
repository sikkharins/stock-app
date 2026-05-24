import { useState, useEffect, useRef } from "react";

const ALL_TABS=["dashboard","products","stock_log","purchase","sales","finance","reports","suppliers","customers"];
const TAB_LABELS={dashboard:{en:"Dashboard",th:"แดชบอร์ด"},products:{en:"Products",th:"สินค้า"},stock_log:{en:"Stock Log",th:"ประวัติสต็อก"},purchase:{en:"Purchase Orders",th:"ใบสั่งซื้อ"},sales:{en:"Sales",th:"การขาย"},finance:{en:"Finance",th:"การเงิน"},reports:{en:"Reports",th:"รายงาน"},suppliers:{en:"Suppliers",th:"ซัพพลายเออร์"},customers:{en:"Customers",th:"ลูกค้า"},users:{en:"Users",th:"จัดการ User"}};
const MOVE_TYPES={in:{label:"รับเข้า (IN)",color:"#1D9E75",bg:"#e6f7f1"},out:{label:"จ่ายออก (OUT)",color:"#cc4444",bg:"#fdecea"},adjust_in:{label:"ปรับเพิ่ม",color:"#1565c0",bg:"#e8f0fe"},adjust_out:{label:"ปรับลด",color:"#b06000",bg:"#fff3e0"}};
const BRAND_COLORS=["#fef3f0","#f0f4ff","#f0faf4","#fffbf0","#f5f0ff","#f0fbff","#fff5f5","#f0fff8"];
const STOCK_STATUS=[{key:"active",label:"Active",color:"#1D9E75",bg:"#e6f7f1",icon:"🟢",maxDays:7},{key:"slow",label:"Slow",color:"#b06000",bg:"#fff3e0",icon:"🟡",maxDays:30},{key:"dead",label:"Dead",color:"#cc4444",bg:"#fdecea",icon:"🔴",maxDays:90},{key:"fossil",label:"Fossil",color:"#666",bg:"#e8e8e8",icon:"⚫",maxDays:180}];
const DASH_WIDGETS=[{key:"products",label:"สินค้า"},{key:"stock_value",label:"มูลค่าสต็อก"},{key:"sales_total",label:"ยอดขาย"},{key:"profit",label:"กำไร"},{key:"low_stock",label:"สต็อกต่ำ"},{key:"recent_po",label:"PO ล่าสุด"},{key:"recent_log",label:"สต็อกล่าสุด"}];
const ALL_WIDGET_KEYS=DASH_WIDGETS.map(w=>w.key);
const DISC_OPTS=[0,1,2,3,5];
const CREDIT_OPTS=[7,15,30,45,60,90];
const initBrands=["LG","Samsung","Hitachi","Toshiba","Daikin","Mitsubishi Electric","Panasonic"];
const initCats=[{id:1,name:"ตู้เย็น",subs:[{id:11,name:"ประตูเดียว"},{id:12,name:"2 ประตู"},{id:13,name:"หลายประตู"},{id:14,name:"Side by Side"}]},{id:2,name:"ทีวี",subs:[{id:21,name:"LED"},{id:22,name:"OLED"},{id:23,name:"QLED"},{id:24,name:"Smart TV"}]},{id:3,name:"เครื่องซักผ้า",subs:[{id:31,name:"ฝาบน"},{id:32,name:"ฝาหน้า"},{id:33,name:"ฝาบน อินเวอร์เตอร์"}]},{id:4,name:"แอร์",subs:[{id:41,name:"แบบแยกส่วน"},{id:42,name:"แบบหน้าต่าง"},{id:43,name:"อินเวอร์เตอร์"}]}];
const initProducts=[{id:1,code:"P001",name:"LG 2-Door Fridge 14Q",nameT:"ตู้เย็น LG 2 ประตู 14 คิว",brand:"LG",categoryId:1,subcategoryId:12,size:"14 คิว",price:12900,cost:9500,stock:8,minStock:3,unit:"เครื่อง",distributor:"Bangkok Supply Co."},{id:2,code:"P002",name:"Samsung 55in QLED TV",nameT:"ทีวี Samsung QLED 55 นิ้ว",brand:"Samsung",categoryId:2,subcategoryId:23,size:"55 นิ้ว",price:28900,cost:22000,stock:5,minStock:2,unit:"เครื่อง",distributor:"Siam Industrial"},{id:3,code:"P003",name:"Hitachi Top-Load 15kg",nameT:"เครื่องซักผ้า Hitachi ฝาบน 15กก.",brand:"Hitachi",categoryId:3,subcategoryId:31,size:"15 กก.",price:9500,cost:7200,stock:12,minStock:4,unit:"เครื่อง",distributor:"Bangkok Supply Co."},{id:4,code:"P004",name:"Daikin Inverter 12000BTU",nameT:"แอร์ Daikin อินเวอร์เตอร์ 12000 BTU",brand:"Daikin",categoryId:4,subcategoryId:43,size:"12000 BTU",price:18500,cost:14000,stock:6,minStock:2,unit:"เครื่อง",distributor:""},{id:5,code:"P005",name:"Toshiba 1-Door Fridge 6.4Q",nameT:"ตู้เย็น Toshiba ประตูเดียว 6.4 คิว",brand:"Toshiba",categoryId:1,subcategoryId:11,size:"6.4 คิว",price:5490,cost:3900,stock:2,minStock:3,unit:"เครื่อง",distributor:"Siam Industrial"}];
const initContacts=[{id:1,type:"supplier",name:"Bangkok Supply Co.",nameT:"บริษัท แบงค็อก ซัพพลาย",phone:"02-111-2222",email:"info@bkksupply.th",address:"",taxId:"",vatReps:[]},{id:2,type:"supplier",name:"Siam Industrial",nameT:"สยามอุตสาหกรรม",phone:"02-333-4444",email:"sales@siamind.th",address:"",taxId:"",vatReps:[]},{id:3,type:"customer",name:"Chiang Mai Builder",nameT:"เชียงใหม่บิลเดอร์",phone:"053-555-666",email:"cm@builder.th",address:"123 ถ.นิมมาน เชียงใหม่ 50200",taxId:"0105558123456",salesPerson:"สมชาย",vatReps:[{id:1,name:"นายสมศักดิ์ วิชาการ",address:"55/2 ถ.ห้วยแก้ว เชียงใหม่ 50200",idCard:"1100100100001"},{id:2,name:"นางสมศรี รักดี",address:"99 ถ.ช้างคลาน เชียงใหม่ 50100",idCard:"1100200200002"}]},{id:4,type:"customer",name:"Pattaya Construct",nameT:"พัทยาคอนสตรัค",phone:"038-777-888",email:"info@pattayac.th",address:"88 ถ.พัทยาสาย 2 ชลบุรี 20150",taxId:"0105559654321",salesPerson:"สมหญิง",vatReps:[{id:3,name:"นายประเสริฐ มั่นคง",address:"22/1 ถ.สุขุมวิท ชลบุรี 20000",idCard:"1200300300003"}]}];
const initPOs=[{id:1,poNum:"PO-2025-001",supplierId:1,date:"2025-01-10",status:"received",items:[{productId:1,qty:5,cost:9500}]},{id:2,poNum:"PO-2025-002",supplierId:2,date:"2025-02-15",status:"pending",items:[{productId:3,qty:10,cost:7200}]}];
const initSales=[{id:1,soNum:"SO-2025-001",customerId:3,date:"2025-01-20",status:"completed",items:[{productId:1,qty:2,price:12900}],includeVat:true,vatAmount:1691,payType:"cash",discountAmt:258,discPct:1,creditDays:0,fromQuote:"",useVatRep:true,vatRepName:"นายสมศักดิ์ วิชาการ",vatRepAddress:"55/2 ถ.ห้วยแก้ว เชียงใหม่ 50200",vatRepIdCard:"1100100100001"},{id:2,soNum:"SO-2025-002",customerId:4,date:"2025-02-10",status:"pending_delivery",items:[{productId:2,qty:1,price:28900}],includeVat:true,vatAmount:1891,payType:"credit",discountAmt:0,discPct:0,creditDays:45,fromQuote:"",useVatRep:false,vatRepName:"",vatRepAddress:"",vatRepIdCard:""}];
const initQuotes=[{id:1,qtNum:"QT-2025-001",customerId:3,date:"2025-01-15",validUntil:"2025-02-15",status:"converted",items:[{productId:1,qty:2,price:12900}],includeVat:true,payType:"cash",note:"ส่งของภายใน 7 วัน",discPct:1,creditDays:0,convertedTo:"SO-2025-001"}];
const initTargets=[{id:1,salesName:"สมชาย",month:"2025-01",target:100000},{id:2,salesName:"สมหญิง",month:"2025-01",target:120000}];
const _mkSP=()=>({dashboard:{access:true,read:true,create:false,edit:false,delete:false},products:{access:true,read:true,create:false,edit:false,delete:false},stock_log:{access:false,read:false,create:false,edit:false,delete:false},purchase:{access:false,read:false,create:false,edit:false,delete:false},sales:{access:true,read:true,create:true,edit:false,delete:false},finance:{access:false,read:false,create:false,edit:false,delete:false},reports:{access:false,read:false,create:false,edit:false,delete:false},suppliers:{access:false,read:false,create:false,edit:false,delete:false},customers:{access:true,read:true,create:false,edit:false,delete:false},users:{access:false,read:false,create:false,edit:false,delete:false}});
const _mkSupP=()=>({dashboard:{access:true,read:true,create:false,edit:false,delete:false},products:{access:true,read:true,create:false,edit:false,delete:false},stock_log:{access:true,read:true,create:false,edit:false,delete:false},purchase:{access:true,read:true,create:false,edit:false,delete:false},sales:{access:false,read:false,create:false,edit:false,delete:false},finance:{access:false,read:false,create:false,edit:false,delete:false},reports:{access:false,read:false,create:false,edit:false,delete:false},suppliers:{access:false,read:false,create:false,edit:false,delete:false},customers:{access:false,read:false,create:false,edit:false,delete:false},users:{access:false,read:false,create:false,edit:false,delete:false}});
const initUsers=[{id:1,username:"admin",password:"admin123",role:"Admin",perms:{dashboard:"edit",products:"edit",stock_log:"view",purchase:"edit",sales:"edit",finance:"edit",reports:"edit",suppliers:"edit",customers:"edit",users:"edit"}},{id:2,username:"manager",password:"manager123",role:"Manager",perms:{dashboard:"view",products:"view",stock_log:"view",purchase:"view",sales:"view",finance:"view",reports:"view",suppliers:"view",customers:"view",users:"none"}},{id:3,username:"warehouse",password:"warehouse123",role:"Warehouse",perms:{dashboard:"view",products:"edit",stock_log:"view",purchase:"edit",sales:"none",finance:"none",reports:"none",suppliers:"view",customers:"none",users:"none"}},{id:4,username:"accountant",password:"accountant123",role:"Accountant",perms:{dashboard:"view",products:"none",stock_log:"view",purchase:"none",sales:"none",finance:"edit",reports:"view",suppliers:"none",customers:"none",users:"none"}},{id:5,username:"somchai",password:"1234",role:"Sales",salesName:"สมชาย",perms:_mkSP()},{id:6,username:"somying",password:"1234",role:"Sales",salesName:"สมหญิง",perms:_mkSP()},{id:7,username:"wichai",password:"1234",role:"Sales",salesName:"วิชัย",perms:_mkSP()},{id:8,username:"pimjai",password:"1234",role:"Sales",salesName:"พิมพ์ใจ",perms:_mkSP()},{id:9,username:"bkksupply",password:"supplier1",role:"Supplier",supplierName:"Bangkok Supply Co.",perms:_mkSupP()},{id:10,username:"siamind",password:"supplier2",role:"Supplier",supplierName:"Siam Industrial",perms:_mkSupP()}];

const fmt=n=>Number(n).toLocaleString("th-TH");
const todayStr=()=>new Date().toISOString().split("T")[0];
const nowStr=()=>new Date().toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"});
const toBE=d=>{if(!d)return"-";const p=(d||"").split("-");if(p.length!==3)return d;return p[2]+"/"+p[1]+"/"+(+p[0]+543);};
const IB={width:"100%",boxSizing:"border-box",background:"#f5f5f0",border:"1.5px solid #aaa",borderRadius:6,padding:"8px 10px",fontSize:13,color:"#111"};
const mkLog=(pid,type,qty,before,after,ref,note,user)=>({id:Date.now()+Math.random(),date:nowStr(),productId:+pid,type,qty:+qty,qtyBefore:+before,qtyAfter:+after,ref:ref||"-",note:note||"",user:user||"system"});
const mkAudit=(action,detail,user)=>({id:Date.now()+Math.random(),date:nowStr(),action,detail,user:user||"system"});
const AddDue=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().split("T")[0];};
const fmtDur=s=>{if(!s||s<0)return"-";if(s<60)return s+"วิ";const m=Math.floor(s/60);if(m<60)return m+"น.";return Math.floor(m/60)+"ชม. "+(m%60)+"น.";};

function getSS(pid,sales){
  let last=null;
  (sales||[]).filter(s=>s.status==="completed").forEach(so=>(so.items||[]).forEach(i=>{if(i.productId===pid){const d=new Date(so.date).getTime();if(!last||d>last)last=d;}}));
  if(!last)return{key:"fossil",label:"Fossil",color:"#666",bg:"#e8e8e8",icon:"⚫",days:null};
  const days=Math.floor((Date.now()-last)/864e5);
  return{...(STOCK_STATUS.find(s=>days<=s.maxDays)||STOCK_STATUS[3]),days};
}
function getNotifs(products,sales,pos,payments,quotes){
  const n=[];const now=new Date();
  (products||[]).filter(p=>p.stock<=p.minStock).forEach(p=>n.push({type:"warning",icon:"⚠️",msg:p.brand+" — "+(p.nameT||p.name)+" สต็อกต่ำ (เหลือ "+p.stock+")"}));
  (pos||[]).filter(po=>po.status==="pending").forEach(po=>{const d=Math.floor((now-new Date(po.date))/864e5);if(d>14)n.push({type:"warning",icon:"📦",msg:po.poNum+" ค้าง "+d+" วัน"});});
  (quotes||[]).filter(q=>q.status==="sent"&&q.validUntil).forEach(q=>{const d=Math.floor((new Date(q.validUntil)-now)/864e5);if(d<0)n.push({type:"danger",icon:"📋",msg:q.qtNum+" หมดอายุ"});else if(d<=3)n.push({type:"warning",icon:"📋",msg:q.qtNum+" หมดอายุใน "+d+"d"});});
  return n;
}

function Field({label,children}){return <div><div style={{fontSize:12,fontWeight:500,color:"#333",marginBottom:4}}>{label}</div>{children}</div>;}
function Badge({status}){const m={pending:["#FAC775","#633806"],pending_delivery:["#B5D4F4","#0C447C"],received:["#C0DD97","#27500A"],cancelled:["#F7C1C1","#791F1F"],completed:["#C0DD97","#27500A"],supplier:["#CECBF6","#3C3489"],customer:["#9FE1CB","#085041"],Admin:["#F4C2F4","#6B0E8A"],Manager:["#C2DCF4","#0E3A6B"],Sales:["#C2F4D8","#0E6B38"],Warehouse:["#F4E6C2","#6B4B0E"],Accountant:["#E8E8E8","#444"],Supplier:["#FFE0CC","#8B4000"],Staff:["#E8E8E8","#444"]};const c=m[status]||["#D3D1C7","#444"];return <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:c[0],color:c[1],fontWeight:500}}>{status}</span>;}
function StatCard({label,value,sub,color}){return <div style={{background:"#f5f5f0",borderRadius:8,padding:"1rem"}}><div style={{fontSize:12,color:"#666",marginBottom:6}}>{label}</div><div style={{fontSize:22,fontWeight:500,color:color||"#111"}}>{value}</div>{sub&&<div style={{fontSize:12,color:"#666",marginTop:4}}>{sub}</div>}</div>;}
function SB({value,onChange,placeholder}){return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...IB,width:190}}/>;}
function Btn({onClick,children}){return <button onClick={onClick} style={{fontSize:13,padding:"7px 14px",borderRadius:6,border:"0.5px solid #ccc",cursor:"pointer",background:"transparent",color:"#111",whiteSpace:"nowrap"}}>{children}</button>;}
function Sel({value,onChange,children}){return <select value={value} onChange={e=>onChange(e.target.value)} style={{...IB,width:"auto",padding:"7px 10px"}}>{children}</select>;}
function Modal({title,children,onClose,wide}){return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:100,paddingTop:40,overflowY:"auto"}}><div style={{background:"#fff",borderRadius:12,border:"1.5px solid #bbb",padding:"1.5rem",width:wide?"min(760px,96%)":"min(580px,94%)",maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box",boxShadow:"0 8px 32px rgba(0,0,0,0.22)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontWeight:600,fontSize:15}}>{title}</span><span onClick={onClose} style={{cursor:"pointer",color:"#888",fontSize:22}}>{"×"}</span></div>{children}</div></div>;}
function MBtns({onCancel,onSave,saveLabel}){return <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:10}}><button onClick={onCancel} style={{padding:"7px 14px",borderRadius:6,border:"0.5px solid #ccc",cursor:"pointer",background:"transparent",color:"#666"}}>ยกเลิก</button>{onSave&&<button onClick={onSave} style={{padding:"7px 14px",borderRadius:6,border:"0.5px solid #ccc",cursor:"pointer",background:"#f5f5f0",fontWeight:500}}>{saveLabel||"บันทึก"}</button>}</div>;}
function SimpleBar({label,value,max,color}){const pct=max>0?Math.round(value/max*100):0;return <div style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:"#666"}}>{label}</span><span style={{fontWeight:500}}>{"฿"+fmt(value)}</span></div><div style={{background:"#e8e8e4",borderRadius:4,height:10}}><div style={{background:color||"#1D9E75",borderRadius:4,height:10,width:pct+"%"}}/></div></div>;}
function VatRepBox({n,a,onChange,ro}){
  return <div style={{background:"#f0f4ff",border:"1.5px solid #c5d0f5",borderRadius:8,padding:"12px 14px",marginBottom:8}}>
    <div style={{fontSize:12,fontWeight:600,color:"#1565c0",marginBottom:8}}>{"🧾 ตัวแทนรับ VAT"}</div>
    {ro?<div style={{fontSize:13}}><div style={{fontWeight:500,marginBottom:4}}>{n||<span style={{color:"#999",fontStyle:"italic"}}>ไม่มีตัวแทน</span>}</div>{a&&<div style={{fontSize:12,color:"#555"}}>{a}</div>}</div>
    :<div style={{display:"grid",gap:8}}><Field label="ชื่อตัวแทน"><input value={n||""} onChange={e=>onChange("vatRepName",e.target.value)} style={IB} placeholder="ชื่อ-นามสกุล"/></Field><Field label="ที่อยู่ตัวแทน"><textarea value={a||""} onChange={e=>onChange("vatRepAddress",e.target.value)} style={{...IB,height:56,resize:"vertical"}} placeholder="ที่อยู่สำหรับออก VAT"/></Field></div>}
  </div>;
}

function ProductPicker({value,onChange,products,pName,avail,unit}){
  const[q,setQ]=useState("");const[open,setOpen]=useState(false);const ref=useRef(null);
  const sel=value?products.find(p=>p.id===+value):null;
  const fl=products.filter(p=>{if(!q)return true;const s=q.toLowerCase();return pName(p).toLowerCase().includes(s)||p.brand.toLowerCase().includes(s)||p.code.toLowerCase().includes(s);}).slice(0,30);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const dv=open?q:(sel?sel.brand+" — "+pName(sel):"");
  return <div ref={ref} style={{position:"relative"}}>
    <input value={dv} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>{setQ("");setOpen(true);}} placeholder="ค้นหาสินค้า (ชื่อ/ยี่ห้อ/รหัส)..." style={{...IB,background:sel?"#f0f4ff":"#f5f5f0"}}/>
    {sel&&!open&&<div style={{fontSize:11,color:"#666",marginTop:3,display:"flex",gap:8}}><span style={{color:"#888"}}>{sel.code}</span><span style={{color:avail===0?"#cc4444":"#1D9E75",fontWeight:600}}>{"พร้อมขาย: "+avail+" "+unit}</span><span>{"฿"+fmt(sel.price)}</span></div>}
    {open&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1.5px solid #aaa",borderRadius:8,zIndex:200,maxHeight:240,overflowY:"auto",boxShadow:"0 6px 20px rgba(0,0,0,0.15)",marginTop:2}}>
      {q&&fl.length===0&&<div style={{padding:"12px 14px",color:"#999",fontSize:13}}>{"ไม่พบสินค้า"}</div>}
      {fl.map(pr=>{const isOut=pr.stock===0;const isLow=pr.stock<=pr.minStock;const isSel=value&&+value===pr.id;
        return <div key={pr.id} onClick={()=>{onChange(pr.id);setOpen(false);setQ("");}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:"0.5px solid #f0f0ec",background:isSel?"#e8f0fe":isOut?"#fff8f8":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div><div style={{fontSize:13,fontWeight:isSel?600:500,color:isOut?"#cc4444":"#111"}}>{pr.brand+" — "+pName(pr)}</div><div style={{fontSize:11,color:"#888",marginTop:1}}>{pr.code+(pr.size?" · "+pr.size:"")}</div></div>
          <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:12,fontWeight:600,color:isOut?"#cc4444":isLow?"#b06000":"#1D9E75"}}>{isOut?"🚫 หมด":isLow?"⚠ "+pr.stock:"✅ "+pr.stock}</div><div style={{fontSize:11,color:"#1565c0",fontWeight:500}}>{"฿"+fmt(pr.price)}</div></div>
        </div>;
      })}
    </div>}
  </div>;
}

function LoginScreen({users,onLogin}){
  const[un,setUn]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");
  const go=()=>{const u=users.find(u=>u.username===un&&u.password===pw);u?onLogin(u):setErr("Username หรือ Password ไม่ถูกต้อง");};
  return <div style={{minHeight:600,display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0"}}><div style={{background:"#fff",borderRadius:16,border:"1.5px solid #ddd",padding:"2.5rem 2rem",width:"min(380px,94%)",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
    <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:32,marginBottom:8}}>📦</div><div style={{fontWeight:600,fontSize:20,marginBottom:4}}>Stock & Order System</div><div style={{fontSize:13,color:"#666"}}>กรุณาเข้าสู่ระบบ</div></div>
    <div style={{marginBottom:14}}><Field label="Username"><input value={un} onChange={e=>{setUn(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} style={IB}/></Field></div>
    <div style={{marginBottom:20}}><Field label="Password"><input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} style={IB}/></Field></div>
    {err&&<div style={{fontSize:13,color:"#cc4444",marginBottom:12,textAlign:"center"}}>{err}</div>}
    <button onClick={go} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer"}}>เข้าสู่ระบบ</button>
    <div style={{marginTop:20,padding:12,background:"#f8f8f6",borderRadius:8,fontSize:12,color:"#666"}}><div style={{fontWeight:500,marginBottom:6}}>บัญชีทดสอบ:</div>{users.map(u=><div key={u.id} style={{marginBottom:3}}>{u.username+" / "+u.password+" — "}<Badge status={u.role}/></div>)}</div>
  </div></div>;
}

export default function App(){
  const[tab,setTab]=useState("dashboard");const[lang,setLang]=useState("th");const[cu,setCu]=useState(null);
  const[products,setProducts]=useState(initProducts);const[contacts,setContacts]=useState(initContacts);
  const[pos,setPOs]=useState(initPOs);const[sales,setSales]=useState(initSales);
  const[logs,setLogs]=useState([]);const[payments,setPayments]=useState([]);
  const[quotes,setQuotes]=useState(initQuotes);const[targets,setTargets]=useState(initTargets);
  const[audit,setAudit]=useState([]);const[priceHist,setPriceHist]=useState([]);
  const[cats,setCats]=useState(initCats);const[brands,setBrands]=useState(initBrands);
  const[users,setUsers]=useState(initUsers);const[search,setSearch]=useState("");const[modal,setModal]=useState(null);
  const[actLogs,setActLogs]=useState([]);const[sess,setSess]=useState(null);
  const[loaded,setLoaded]=useState(false);const[saving,setSaving]=useState(false);const[showNotif,setShowNotif]=useState(false);

  const pN=p=>lang==="th"?(p.nameT||p.name):p.name;
  const cN=c=>lang==="th"?(c.nameT||c.name):c.name;
  const lowStock=products.filter(p=>p.stock<=p.minStock);
  const gP=k=>{if(!cu)return{access:false};let p=cu.perms[k];if(!p)return{access:false};if(typeof p==="string"){if(p==="edit")return{access:true,read:true,create:true,edit:true,delete:true};if(p==="view")return{access:true,read:true};return{access:false};}return p;};
  const canA=k=>!!gP(k).access;const canE=k=>!!gP(k).edit;const canC=k=>!!gP(k).create;
  const getCN=id=>{const c=cats.find(x=>x.id===+id);return c?c.name:"-";};
  const addLog=log=>setLogs(p=>[log,...p]);
  const oM=n=>setModal(n);const cM=()=>setModal(null);
  const addA=(a,d)=>setAudit(p=>[mkAudit(a,d,cu?.username),...p].slice(0,500));
  const addPH=(pid,f,o,n)=>setPriceHist(p=>[{id:Date.now(),date:nowStr(),productId:pid,field:f,oldVal:o,newVal:n,user:cu?.username},...p].slice(0,500));
  const notifs=getNotifs(products,sales,pos,payments,quotes);

  useEffect(()=>{(async()=>{try{const ld=async(k,fb)=>{try{const r=await window.storage.get(k);return r?JSON.parse(r.value):fb;}catch{return fb;}};
  const r=await Promise.all([ld("v3_products",initProducts),ld("v3_contacts",initContacts),ld("v3_pos",initPOs),ld("v3_sales",initSales),ld("v3_cats",initCats),ld("v3_brands",initBrands),ld("v3_users",initUsers),ld("v3_logs",[]),ld("v3_payments",[]),ld("v3_activity",[]),ld("v3_quotes",initQuotes),ld("v3_targets",initTargets),ld("v3_audit",[]),ld("v3_pricehist",[])]);
  setProducts(r[0]);setContacts(r[1]);setPOs(r[2]);setSales(r[3]);setCats(r[4]);setBrands(r[5]);setUsers(r[6]);setLogs(r[7]);setPayments(r[8]);setActLogs(r[9]);setQuotes(r[10]);setTargets(r[11]);setAudit(r[12]);setPriceHist(r[13]);
  }catch(e){}finally{setLoaded(true);}})();},[]);

  useEffect(()=>{if(!loaded)return;setSaving(true);const tm=setTimeout(async()=>{try{await Promise.all([window.storage.set("v3_products",JSON.stringify(products)),window.storage.set("v3_contacts",JSON.stringify(contacts)),window.storage.set("v3_pos",JSON.stringify(pos)),window.storage.set("v3_sales",JSON.stringify(sales)),window.storage.set("v3_cats",JSON.stringify(cats)),window.storage.set("v3_brands",JSON.stringify(brands)),window.storage.set("v3_users",JSON.stringify(users)),window.storage.set("v3_logs",JSON.stringify(logs)),window.storage.set("v3_payments",JSON.stringify(payments)),window.storage.set("v3_activity",JSON.stringify(actLogs)),window.storage.set("v3_quotes",JSON.stringify(quotes)),window.storage.set("v3_targets",JSON.stringify(targets)),window.storage.set("v3_audit",JSON.stringify(audit)),window.storage.set("v3_pricehist",JSON.stringify(priceHist))]);}catch(e){}finally{setSaving(false);}},800);return()=>clearTimeout(tm);},[products,contacts,pos,sales,cats,brands,users,logs,payments,actLogs,quotes,targets,audit,priceHist,loaded]);
  useEffect(()=>{if(cu){const u=users.find(x=>x.id===cu.id);if(u)setCu(u);}},[users]);

  const handleTab=nt=>{setTab(nt);setSearch("");};
  const handleLogin=user=>{setCu(user);const first=[...ALL_TABS,"users"].find(tb=>{const p=user.perms[tb];return p&&(typeof p==="string"?p!=="none":p.access);});setTab(first||"dashboard");};
  const handleLogout=()=>{setCu(null);};

  if(!loaded)return <div style={{padding:"2rem",textAlign:"center"}}>กำลังโหลด...</div>;
  if(!cu)return <LoginScreen users={users} onLogin={handleLogin}/>;

  const visTabs=[...ALL_TABS.filter(tb=>canA(tb)),...(canA("users")?["users"]:[])];
  const isSup=!!cu.supplierName;const supN=cu.supplierName||"";
  const sh={pN,cN,lang,products,setProducts,contacts,setContacts,pos,setPOs,sales,setSales,logs,setLogs,addLog,payments,setPayments,quotes,setQuotes,targets,setTargets,audit,addA,priceHist,addPH,cats,setCats,brands,setBrands,users,setUsers,search,setSearch,modal,oM,cM,lowStock,canE,canC,canA,getCN,cu,isSup,supN,actLogs,sess,notifs};

  return <div style={{fontFamily:"system-ui,sans-serif",color:"#111",minHeight:640}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.75rem 1.25rem",borderBottom:"0.5px solid #ddd",background:"#fff",flexWrap:"wrap",gap:8}}>
      <span style={{fontWeight:600,fontSize:17}}>{"📦 Stock & Order"}</span>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        {saving?<span style={{fontSize:11,color:"#666"}}>บันทึก...</span>:<span style={{fontSize:11,color:"#1D9E75"}}>✓</span>}
        <div style={{position:"relative"}}>
          <button onClick={()=>setShowNotif(!showNotif)} style={{fontSize:16,padding:"2px 8px",borderRadius:6,border:"0.5px solid #ccc",background:"transparent",cursor:"pointer"}}>{"🔔"}{notifs.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#cc4444",color:"#fff",fontSize:9,fontWeight:700,borderRadius:99,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{notifs.length}</span>}</button>
          {showNotif&&<div style={{position:"absolute",right:0,top:32,width:340,maxHeight:380,overflowY:"auto",background:"#fff",border:"1px solid #ddd",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",zIndex:200}}>
            <div style={{padding:"8px 14px",fontWeight:600,fontSize:13,borderBottom:"1px solid #eee",display:"flex",justifyContent:"space-between"}}><span>{"🔔 แจ้งเตือน ("+notifs.length+")"}</span><span onClick={()=>setShowNotif(false)} style={{cursor:"pointer",color:"#999",fontSize:18}}>{"×"}</span></div>
            {notifs.length===0&&<div style={{padding:"2rem",textAlign:"center",color:"#666",fontSize:13}}>{"ไม่มีการแจ้งเตือน ✓"}</div>}
            {notifs.map((n,i)=><div key={i} style={{padding:"8px 14px",borderBottom:"0.5px solid #f5f5f0",fontSize:12,display:"flex",gap:8,background:n.type==="danger"?"#fff5f5":""}}><span>{n.icon}</span><span style={{color:n.type==="danger"?"#cc4444":"#333"}}>{n.msg}</span></div>)}
          </div>}
        </div>
        <span style={{fontSize:13,color:"#666"}}>{cu.username}</span>
        <Badge status={cu.role}/>
        <button onClick={()=>setLang(lang==="en"?"th":"en")} style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:"0.5px solid #ccc",background:"transparent",cursor:"pointer"}}>{lang==="en"?"ไทย":"EN"}</button>
        <button onClick={handleLogout} style={{fontSize:12,padding:"3px 10px",borderRadius:6,border:"0.5px solid #f99",background:"transparent",cursor:"pointer",color:"#cc4444"}}>ออก</button>
      </div>
    </div>
    <div style={{display:"flex",borderBottom:"0.5px solid #ddd",background:"#fff",overflowX:"auto"}}>
      {visTabs.map(tb=><button key={tb} onClick={()=>handleTab(tb)} style={{padding:"10px 15px",fontSize:13,fontWeight:tab===tb?500:400,border:"none",borderBottom:tab===tb?"2px solid #111":"2px solid transparent",background:"transparent",cursor:"pointer",color:tab===tb?"#111":"#666",whiteSpace:"nowrap"}}>{TAB_LABELS[tb]?TAB_LABELS[tb][lang]:tb}</button>)}
    </div>
    {!canA(tab)?<div style={{padding:"3rem",textAlign:"center",color:"#666"}}>ไม่มีสิทธิ์</div>:
    <div style={{padding:"1rem 1.25rem"}}>
      {tab==="dashboard"&&<DashPage sh={sh}/>}
      {tab==="products"&&<ProdPage sh={sh}/>}
      {tab==="stock_log"&&<LogPage sh={sh}/>}
      {tab==="purchase"&&<POPage sh={sh}/>}
      {tab==="sales"&&<SalesPage sh={sh}/>}
      {tab==="finance"&&<FinPage sh={sh}/>}
      {tab==="reports"&&<RepPage sh={sh}/>}
      {tab==="suppliers"&&<ContactPage key="s" sh={sh} ft="supplier"/>}
      {tab==="customers"&&<ContactPage key="c" sh={sh} ft="customer"/>}
      {tab==="users"&&<UserPage sh={sh}/>}
    </div>}
  </div>;
}

function DashPage({sh}){
  const{pN,products,lowStock,sales,pos,contacts,logs,isSup,supN,cu,targets}=sh;
  const isSales=!!cu.salesName;
  const myCI=isSales?contacts.filter(c=>c.type==="customer"&&c.salesPerson===cu.salesName).map(c=>c.id):null;
  const myP=isSup?products.filter(p=>p.distributor===supN):products;
  const myLS=isSup?myP.filter(p=>p.stock<=p.minStock):lowStock;
  const myS=isSales?sales.filter(so=>myCI.includes(so.customerId)):sales;
  const myTS=myP.reduce((s,p)=>s+p.stock*p.cost,0);
  const mySales=myS.reduce((s,so)=>s+so.items.reduce((a,i)=>a+i.qty*i.price,0),0);
  const profit=myS.reduce((s,so)=>s+so.items.reduce((a,i)=>{const p=products.find(x=>x.id===i.productId);return a+i.qty*(i.price-(p?p.cost:0));},0),0);
  return <div>
    {isSales&&<div style={{background:"#f0e6ff",border:"1px solid #d4c0f0",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#6B0E8A"}}>{"👤 เซลส์: "+cu.salesName}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:"1.5rem"}}>
      <StatCard label="สินค้า" value={myP.length} sub={myLS.length+" ต่ำกว่าขั้นต่ำ"}/>
      <StatCard label="มูลค่าสต็อก" value={"฿"+fmt(myTS)}/>
      <StatCard label="ยอดขายรวม" value={"฿"+fmt(mySales)} color="#1D9E75"/>
      <StatCard label="กำไร" value={"฿"+fmt(profit)} color={profit>=0?"#1D9E75":"#cc4444"}/>
    </div>
    {myLS.length>0&&<div style={{background:"#fffbf0",border:"0.5px solid #f5c07a",borderRadius:8,padding:"0.75rem 1rem",marginBottom:"1.5rem"}}><div style={{fontWeight:500,fontSize:13,color:"#b06000",marginBottom:6}}>แจ้งเตือนสต็อกต่ำ</div>{myLS.map(p=><div key={p.id} style={{fontSize:13,color:"#b06000",display:"flex",justifyContent:"space-between"}}><span>{p.brand+" — "+pN(p)}</span><span>{"เหลือ "+p.stock+" "+p.unit}</span></div>)}</div>}
  </div>;
}

function LogPage({sh}){
  const{pN,products,logs,search,setSearch}=sh;
  const[fType,setFType]=useState("");
  const filtered=logs.filter(l=>{if(fType&&l.type!==fType)return false;if(search){const s=search.toLowerCase();const pr=products.find(x=>x.id===l.productId);if(!(l.ref.toLowerCase().includes(s)||(pr?pN(pr).toLowerCase().includes(s):false)))return false;}return true;});
  return <div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}><SB value={search} onChange={setSearch} placeholder="ค้นหา..."/><Sel value={fType} onChange={setFType}><option value="">ทุกประเภท</option>{Object.entries(MOVE_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</Sel></div>
    {filtered.length===0&&<div style={{textAlign:"center",color:"#666",padding:"2rem"}}>ยังไม่มีประวัติ</div>}
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid #ccc",background:"#f5f5f0"}}>{["วันที่","ประเภท","สินค้า","ก่อน","เคลื่อนไหว","หลัง","อ้างอิง","ผู้บันทึก"].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"#666",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(l=>{const pr=products.find(x=>x.id===l.productId);const mt=MOVE_TYPES[l.type]||{label:l.type,color:"#666",bg:"#eee"};const isIn=l.type==="in"||l.type==="adjust_in";return <tr key={l.id} style={{borderBottom:"0.5px solid #eee"}}><td style={{padding:"8px",color:"#666",fontSize:11}}>{l.date}</td><td style={{padding:"8px"}}><span style={{background:mt.bg,color:mt.color,borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600}}>{mt.label}</span></td><td style={{padding:"8px",fontWeight:500}}>{pr?pr.brand+" — "+pN(pr):"-"}</td><td style={{padding:"8px",color:"#666"}}>{l.qtyBefore}</td><td style={{padding:"8px",fontWeight:700,color:isIn?"#1D9E75":"#cc4444"}}>{(isIn?"+":"-")+Math.abs(l.qty)}</td><td style={{padding:"8px",fontWeight:500}}>{l.qtyAfter}</td><td style={{padding:"8px",color:"#378ADD",fontSize:12}}>{l.ref}</td><td style={{padding:"8px",color:"#666",fontSize:12}}>{l.user}</td></tr>;})}</tbody></table></div>
  </div>;
}

function ProdPage({sh}){
  const{pN,canE,products,setProducts,cats,setCats,brands,contacts,search,setSearch,modal,oM,cM,getCN,addLog,cu,sales,isSup,supN,addA,addPH}=sh;
  const ed=canE("products");
  const baseP=isSup?products.filter(p=>p.distributor===supN):products;
  const[fBrand,setFBrand]=useState("");const[fCat,setFCat]=useState("");const[fStat,setFStat]=useState("");
  const filtered=baseP.filter(pr=>{if(fBrand&&pr.brand!==fBrand)return false;if(fCat&&pr.categoryId!==+fCat)return false;if(fStat&&getSS(pr.id,sales).key!==fStat)return false;if(search&&!(pN(pr).toLowerCase().includes(search.toLowerCase())||pr.code.toLowerCase().includes(search.toLowerCase())||pr.brand.toLowerCase().includes(search.toLowerCase())))return false;return true;});
  const emptyF={code:"",name:"",nameT:"",brand:brands[0]||"",categoryId:"",subcategoryId:"",size:"",distributor:"",price:"",cost:"",stock:"",minStock:"",unit:"เครื่อง"};
  const[form,setForm]=useState(emptyF);const[adjPr,setAdjPr]=useState(null);const[adjForm,setAdjForm]=useState({type:"adjust_in",qty:"",note:""});const[confirmDel,setConfirmDel]=useState(null);
  const setF=(k,v)=>setForm(f=>{const n={...f,[k]:v};if(k==="categoryId")n.subcategoryId="";return n;});
  const reservedMap={};sales.filter(so=>so.status==="pending_delivery").forEach(so=>(so.items||[]).forEach(i=>{reservedMap[i.productId]=(reservedMap[i.productId]||0)+i.qty;}));
  const saveProd=()=>{if(!form.name||!form.code||!form.brand)return;const item={...form,id:form.id||Date.now(),categoryId:+form.categoryId,subcategoryId:+form.subcategoryId,price:+form.price,cost:+form.cost,stock:+form.stock,minStock:+form.minStock};if(form.id){const b=products.find(x=>x.id===form.id);if(b){if(b.price!==item.price)addPH(item.id,"price",b.price,item.price);if(b.cost!==item.cost)addPH(item.id,"cost",b.cost,item.cost);if(b.stock!==item.stock){const d=item.stock-b.stock;addLog(mkLog(item.id,d>0?"adjust_in":"adjust_out",Math.abs(d),b.stock,item.stock,"Edit","แก้ไข",cu.username));}addA("แก้ไขสินค้า",item.code);}}else addA("เพิ่มสินค้า",item.code);setProducts(p=>form.id?p.map(x=>x.id===form.id?item:x):[...p,item]);cM();};
  const saveAdj=()=>{if(!adjPr||!adjForm.qty||+adjForm.qty<=0)return;const q=+adjForm.qty,b=adjPr.stock,a=adjForm.type==="adjust_in"?b+q:Math.max(0,b-q);setProducts(p=>p.map(x=>x.id===adjPr.id?{...x,stock:a}:x));addLog(mkLog(adjPr.id,adjForm.type,q,b,a,"Manual",adjForm.note,cu.username));addA("ปรับสต็อก",adjPr.code);cM();setAdjPr(null);};
  const del=id=>{const pr=products.find(p=>p.id===id);if(pr)addA("ลบสินค้า",pr.code);setProducts(p=>p.filter(x=>x.id!==id));};
  const bG={};filtered.forEach(pr=>{if(!bG[pr.brand])bG[pr.brand]=[];bG[pr.brand].push(pr);});
  const bK=Object.keys(bG).sort();
  const fCO=form.categoryId?cats.find(c=>c.id===+form.categoryId):null;
  const sups=contacts.filter(c=>c.type==="supplier");
  return <div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
      {STOCK_STATUS.map(s=>{const cnt=baseP.filter(pr=>getSS(pr.id,sales).key===s.key).length;return <div key={s.key} onClick={()=>setFStat(fStat===s.key?"":s.key)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:99,background:fStat===s.key?s.bg:"#f5f5f0",border:"1.5px solid "+(fStat===s.key?s.color:"#ddd"),cursor:"pointer",fontSize:12,fontWeight:500,color:fStat===s.key?s.color:"#666"}}><span>{s.icon}</span><span>{s.label}</span><span style={{background:fStat===s.key?s.color+"22":"#e0e0e0",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:700}}>{cnt}</span></div>;})}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
      <SB value={search} onChange={setSearch} placeholder="ค้นหาสินค้า..."/>
      <Sel value={fBrand} onChange={setFBrand}><option value="">ทุกยี่ห้อ</option>{brands.map(b=><option key={b} value={b}>{b}</option>)}</Sel>
      <Sel value={fCat} onChange={setFCat}><option value="">ทุกหมวด</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Sel>
      {ed&&<div style={{marginLeft:"auto",display:"flex",gap:8}}><Btn onClick={()=>oM("manageCats")}>{"⚙ จัดการหมวด"}</Btn><Btn onClick={()=>{setForm(emptyF);oM("product");}}>{"+ เพิ่มสินค้า"}</Btn></div>}
    </div>
    {bK.length===0&&<div style={{textAlign:"center",color:"#666",padding:"2rem"}}>ไม่พบสินค้า</div>}
    {bK.map((brand,bi)=>{
      const prods=bG[brand];
      return <div key={brand} style={{marginBottom:28,background:BRAND_COLORS[bi%BRAND_COLORS.length],borderRadius:14,padding:"16px 16px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{fontWeight:700,fontSize:16}}>{brand}</div><div style={{height:1,flex:1,background:"rgba(0,0,0,0.1)"}}/><span style={{fontSize:12,color:"#666",background:"rgba(255,255,255,0.7)",borderRadius:99,padding:"2px 10px"}}>{prods.length+" รายการ"}</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {prods.map(pr=>{
            const ss=getSS(pr.id,sales);const res=reservedMap[pr.id]||0;const isLow=pr.stock<=pr.minStock;const pct=pr.minStock>0?Math.min(100,Math.round(pr.stock/pr.minStock*100)):100;
            return <div key={pr.id} style={{background:"rgba(255,255,255,0.85)",border:"1px solid "+(isLow?"#f5c07a":"rgba(0,0,0,0.08)"),borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:11,color:"#666"}}>{pr.code}</div><div style={{fontWeight:600,fontSize:14}}>{pN(pr)}</div></div>{isLow&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:"#FAC775",color:"#633806",fontWeight:600}}>{"⚠ สต็อกต่ำ"}</span>}</div>
              <div style={{display:"flex",gap:6}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:ss.bg,color:ss.color,fontWeight:600}}>{ss.icon+" "+ss.label}</span><span style={{fontSize:10,color:"#999"}}>{ss.days!=null?ss.days+" วัน":"ยังไม่เคยขาย"}</span></div>
              <div style={{display:"flex",gap:6}}><span style={{fontSize:11,background:"rgba(0,0,0,0.06)",borderRadius:4,padding:"2px 8px",color:"#666"}}>{getCN(pr.categoryId)}</span>{pr.size&&<span style={{fontSize:11,background:"#e8f4fd",borderRadius:4,padding:"2px 8px",color:"#1565c0",fontWeight:500}}>{pr.size}</span>}</div>
              <div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#666"}}>สต็อก</span><span><strong style={{color:isLow?"#cc4444":"#1D9E75",fontSize:15}}>{pr.stock}</strong><span style={{color:"#666"}}>{" / "+pr.minStock+" "+pr.unit}</span></span></div><div style={{background:"rgba(0,0,0,0.08)",borderRadius:4,height:6}}><div style={{background:isLow?"#cc4444":"#1D9E75",borderRadius:4,height:6,width:pct+"%"}}/></div></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><div><span style={{color:"#666",fontSize:11}}>ราคาขาย </span><strong style={{color:"#1565c0"}}>{"฿"+fmt(pr.price)}</strong></div><div><span style={{color:"#666",fontSize:11}}>ต้นทุน </span><strong>{"฿"+fmt(pr.cost)}</strong></div></div>
              {pr.distributor&&<div style={{fontSize:11,color:"#666"}}>{"🏭 "+pr.distributor}</div>}
              {ed&&<div style={{display:"flex",gap:6,paddingTop:4,borderTop:"0.5px solid rgba(0,0,0,0.08)"}}>
                <button onClick={()=>{setForm({...pr,categoryId:String(pr.categoryId),subcategoryId:String(pr.subcategoryId),price:String(pr.price),cost:String(pr.cost),stock:String(pr.stock),minStock:String(pr.minStock)});oM("product");}} style={{flex:1,fontSize:12,padding:"5px 0",borderRadius:6,border:"1px solid #c5d0f5",cursor:"pointer",background:"#f0f4ff",color:"#1565c0"}}>{"✏ แก้ไข"}</button>
                <button onClick={()=>{setAdjPr(pr);setAdjForm({type:"adjust_in",qty:"",note:""});oM("adjust");}} style={{flex:1,fontSize:12,padding:"5px 0",borderRadius:6,border:"1px solid #f5c07a",cursor:"pointer",background:"#fff8f0",color:"#b06000"}}>{"🔧 สต็อก"}</button>
                <button onClick={()=>setConfirmDel(pr)} style={{fontSize:12,padding:"5px 8px",borderRadius:6,border:"1px solid #f5a0a0",cursor:"pointer",background:"#fdecea",color:"#cc4444"}}>{"🗑"}</button>
              </div>}
            </div>;
          })}
        </div>
      </div>;
    })}
    {confirmDel&&<Modal title="🗑 ยืนยันลบ" onClose={()=>setConfirmDel(null)}><div style={{background:"#fdecea",border:"1px solid #f5a0a0",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"#cc4444"}}>{"จะลบ "+confirmDel.brand+" — "+pN(confirmDel)+" ถาวร"}</div><MBtns onCancel={()=>setConfirmDel(null)} onSave={()=>{del(confirmDel.id);setConfirmDel(null);}} saveLabel="🗑 ลบ"/></Modal>}
    {modal==="adjust"&&adjPr&&ed&&<Modal title={"🔧 ปรับสต็อก — "+pN(adjPr)} onClose={cM}>
      <div style={{background:"#f8f8f5",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#666"}}>ปัจจุบัน</span><span style={{fontWeight:700,fontSize:18}}>{adjPr.stock+" "+adjPr.unit}</span></div>
      <div style={{display:"grid",gap:12}}>
        <Field label="ประเภท"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["adjust_in","➕ เพิ่ม"],["adjust_out","➖ ลด"]].map(v=><label key={v[0]} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1.5px solid "+(adjForm.type===v[0]?"#1D9E75":"#ddd"),cursor:"pointer",background:adjForm.type===v[0]?"#e6f7f1":"#fff"}}><input type="radio" name="at" checked={adjForm.type===v[0]} onChange={()=>setAdjForm(f=>({...f,type:v[0]}))}/><span style={{fontWeight:500,color:adjForm.type===v[0]?"#1D9E75":"#333"}}>{v[1]}</span></label>)}</div></Field>
        <Field label="จำนวน"><input type="number" min="1" value={adjForm.qty} onChange={e=>setAdjForm(f=>({...f,qty:e.target.value}))} style={IB}/></Field>
        <Field label="หมายเหตุ"><input value={adjForm.note} onChange={e=>setAdjForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
      </div><MBtns onCancel={cM} onSave={saveAdj}/>
    </Modal>}
    {modal==="product"&&ed&&<Modal title={form.id?"แก้ไขสินค้า":"เพิ่มสินค้าใหม่"} onClose={cM}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="รหัส"><input value={form.code} onChange={e=>setF("code",e.target.value)} style={IB}/></Field>
        <Field label="ยี่ห้อ"><select value={form.brand} onChange={e=>setF("brand",e.target.value)} style={IB}><option value="">เลือก...</option>{brands.map(b=><option key={b} value={b}>{b}</option>)}</select></Field>
        <Field label="ชื่อ EN"><input value={form.name} onChange={e=>setF("name",e.target.value)} style={IB}/></Field>
        <Field label="ชื่อ TH"><input value={form.nameT} onChange={e=>setF("nameT",e.target.value)} style={IB}/></Field>
        <Field label="หมวด"><select value={form.categoryId} onChange={e=>setF("categoryId",e.target.value)} style={IB}><option value="">เลือก...</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="หมวดย่อย"><select value={form.subcategoryId} onChange={e=>setF("subcategoryId",e.target.value)} style={IB} disabled={!fCO}><option value="">เลือก...</option>{fCO&&fCO.subs.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="ขนาด"><input value={form.size} onChange={e=>setF("size",e.target.value)} style={IB}/></Field>
        <Field label="ผู้จัดจำหน่าย"><select value={form.distributor} onChange={e=>setF("distributor",e.target.value)} style={IB}><option value="">ไม่ระบุ</option>{sups.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></Field>
        <Field label="ราคาขาย"><input type="number" value={form.price} onChange={e=>setF("price",e.target.value)} style={IB}/></Field>
        <Field label="ต้นทุน"><input type="number" value={form.cost} onChange={e=>setF("cost",e.target.value)} style={IB}/></Field>
        <Field label="สต็อก"><input type="number" value={form.stock} onChange={e=>setF("stock",e.target.value)} style={IB}/></Field>
        <Field label="ขั้นต่ำ"><input type="number" value={form.minStock} onChange={e=>setF("minStock",e.target.value)} style={IB}/></Field>
      </div><MBtns onCancel={cM} onSave={saveProd}/>
    </Modal>}
    {modal==="manageCats"&&<CatMgr cats={cats} setCats={setCats} onClose={cM}/>}
  </div>;
}

function CatMgr({cats,setCats,onClose}){
  const[newName,setNewName]=useState("");const[editId,setEditId]=useState(null);const[editName,setEditName]=useState("");
  const[newSubs,setNewSubs]=useState({});const[editSubId,setEditSubId]=useState(null);const[editSubName,setEditSubName]=useState("");
  const addCat=()=>{const n=newName.trim();if(!n)return;setCats(p=>[...p,{id:Date.now(),name:n,subs:[]}]);setNewName("");};
  const saveCat=id=>{const n=editName.trim();if(!n)return;setCats(p=>p.map(c=>c.id===id?{...c,name:n}:c));setEditId(null);};
  const delCat=id=>setCats(p=>p.filter(c=>c.id!==id));
  const addSub=cid=>{const n=(newSubs[cid]||"").trim();if(!n)return;setCats(p=>p.map(c=>c.id===cid?{...c,subs:[...c.subs,{id:Date.now(),name:n}]}:c));setNewSubs(p=>({...p,[cid]:""}));};
  const delSub=(cid,sid)=>setCats(p=>p.map(c=>c.id===cid?{...c,subs:c.subs.filter(s=>s.id!==sid)}:c));
  const saveSub=(cid,sid)=>{const n=editSubName.trim();if(!n)return;setCats(p=>p.map(c=>c.id===cid?{...c,subs:c.subs.map(s=>s.id===sid?{...s,name:n}:s)}:c));setEditSubId(null);};

  return <Modal title="⚙ จัดการหมวดสินค้า" onClose={onClose} wide>
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()} placeholder="ชื่อหมวดใหม่..." style={{...IB,flex:1}}/>
      <button onClick={addCat} style={{padding:"8px 16px",borderRadius:6,border:"none",background:"#1D9E75",color:"#fff",fontWeight:600,cursor:"pointer"}}>{"+ เพิ่มหมวด"}</button>
    </div>
    {cats.length===0&&<div style={{textAlign:"center",color:"#999",padding:"2rem"}}>ยังไม่มีหมวด</div>}
    {cats.map(cat=>{
      const isEdit=editId===cat.id;
      return <div key={cat.id} style={{border:"1.5px solid #e0e0dc",borderRadius:10,marginBottom:12,overflow:"hidden"}}>
        <div style={{background:"#f5f5f0",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          {isEdit
            ? <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                <input value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveCat(cat.id)} style={{...IB,flex:1,padding:"5px 8px"}} autoFocus/>
                <button onClick={()=>saveCat(cat.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#1D9E75",color:"#fff",cursor:"pointer",fontSize:12}}>บันทึก</button>
                <button onClick={()=>setEditId(null)} style={{padding:"5px 10px",borderRadius:6,border:"1px solid #ccc",background:"transparent",cursor:"pointer",fontSize:12}}>ยกเลิก</button>
              </div>
            : <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                <span style={{fontWeight:600,fontSize:14,flex:1}}>{"📁 "+cat.name}</span>
                <span style={{fontSize:11,color:"#999"}}>{cat.subs.length+" หมวดย่อย"}</span>
                <button onClick={()=>{setEditId(cat.id);setEditName(cat.name);}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #c5d0f5",background:"#f0f4ff",color:"#1565c0",cursor:"pointer",fontSize:12}}>{"✏"}</button>
                <button onClick={()=>delCat(cat.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #f5a0a0",background:"#fdecea",color:"#cc4444",cursor:"pointer",fontSize:12}}>{"🗑"}</button>
              </div>
          }
        </div>
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {cat.subs.map(sub=>{
              const isES=editSubId===sub.id;
              return <div key={sub.id} style={{display:"flex",alignItems:"center",gap:4,background:"#fff",border:"1px solid "+(isES?"#1D9E75":"#ddd"),borderRadius:6,padding:"4px 8px"}}>
                {isES
                  ? <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <input value={editSubName} onChange={e=>setEditSubName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSub(cat.id,sub.id)} style={{...IB,width:120,padding:"3px 6px",fontSize:12}} autoFocus/>
                      <button onClick={()=>saveSub(cat.id,sub.id)} style={{padding:"2px 8px",borderRadius:4,border:"none",background:"#1D9E75",color:"#fff",cursor:"pointer",fontSize:11}}>{"✓"}</button>
                      <button onClick={()=>setEditSubId(null)} style={{padding:"2px 6px",borderRadius:4,border:"1px solid #ccc",background:"transparent",cursor:"pointer",fontSize:11}}>{"✗"}</button>
                    </div>
                  : <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:13}}>{sub.name}</span>
                      <button onClick={()=>{setEditSubId(sub.id);setEditSubName(sub.name);}} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:"#378ADD",cursor:"pointer",fontSize:12}}>{"✏"}</button>
                      <button onClick={()=>delSub(cat.id,sub.id)} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:"#cc4444",cursor:"pointer",fontSize:14}}>{"×"}</button>
                    </div>
                }
              </div>;
            })}
          </div>
          <div style={{display:"flex",gap:6}}>
            <input value={newSubs[cat.id]||""} onChange={e=>setNewSubs(p=>({...p,[cat.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addSub(cat.id)} placeholder="เพิ่มหมวดย่อย..." style={{...IB,flex:1,padding:"5px 8px",fontSize:12}}/>
            <button onClick={()=>addSub(cat.id)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#378ADD",color:"#fff",cursor:"pointer",fontSize:12}}>{"+ เพิ่ม"}</button>
          </div>
        </div>
      </div>;
    })}
    <MBtns onCancel={onClose}/>
  </Modal>;
}

function POPage({sh}){
  const{pN,cN,canE,pos,setPOs,products,setProducts,contacts,search,setSearch,modal,oM,cM,addLog,cu,isSup,supN,addA}=sh;
  const ed=canE("purchase");const sups=contacts.filter(c=>c.type==="supplier");
  const basePOs=isSup?pos.filter(po=>po.supplierId===(contacts.find(c=>c.type==="supplier"&&c.name===supN)||{}).id):pos;
  const filtered=[...basePOs].reverse().filter(po=>{const sup=contacts.find(c=>c.id===po.supplierId);return po.poNum.toLowerCase().includes(search.toLowerCase())||(sup?cN(sup).toLowerCase().includes(search.toLowerCase()):false);});
  const ef={supplierId:"",date:todayStr(),items:[{productId:"",qty:1,cost:0}]};
  const[form,setForm]=useState(ef);const[confirmPO,setConfirmPO]=useState(null);
  const poTot=po=>(po.items||[]).reduce((s,i)=>s+i.qty*i.cost,0);
  const addItem=()=>setForm(f=>({...f,items:[...f.items,{productId:"",qty:1,cost:0}]}));
  const rmItem=idx=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const setIt=(idx,k,v)=>setForm(f=>{const its=[...f.items];its[idx]={...its[idx],[k]:v};if(k==="productId"){const p=products.find(x=>x.id===+v);if(p)its[idx].cost=p.cost;}return{...f,items:its};});
  const savePO=()=>{if(!form.supplierId||form.items.some(i=>!i.productId))return;const pn="PO-"+new Date().getFullYear()+"-"+String(pos.length+1).padStart(3,"0");setPOs(p=>[...p,{id:Date.now(),poNum:pn,supplierId:+form.supplierId,date:form.date,status:"pending",items:form.items.map(i=>({productId:+i.productId,qty:+i.qty,cost:+i.cost}))}]);addA("สร้าง PO",pn);cM();};
  const receive=id=>{setPOs(p=>p.map(po=>{if(po.id!==id||po.status!=="pending")return po;setProducts(pp=>pp.map(pr=>{const it=po.items.find(i=>i.productId===pr.id);if(it)addLog(mkLog(pr.id,"in",it.qty,pr.stock,pr.stock+it.qty,po.poNum,"รับของ PO",cu.username));return it?{...pr,stock:pr.stock+it.qty}:pr;}));addA("รับของ PO",po.poNum);return{...po,status:"received"};}));};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><SB value={search} onChange={setSearch} placeholder="ค้นหา PO..."/>{ed&&!isSup&&<Btn onClick={()=>{setForm(ef);oM("addPO");}}>{"+ สร้าง PO"}</Btn>}</div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid #ccc"}}>{["PO No.","Supplier","วันที่","รวม","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px 6px",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(po=>{const sup=contacts.find(c=>c.id===po.supplierId);return <tr key={po.id} style={{borderBottom:"0.5px solid #eee"}}><td style={{padding:"8px 6px",fontWeight:500}}>{po.poNum}</td><td style={{padding:"8px 6px"}}>{sup?cN(sup):"-"}</td><td style={{padding:"8px 6px",color:"#666"}}>{toBE(po.date)}</td><td style={{padding:"8px 6px"}}>{"฿"+fmt(poTot(po))}</td><td style={{padding:"8px 6px"}}><Badge status={po.status}/></td><td style={{padding:"8px 6px"}}>{ed&&po.status==="pending"&&<span onClick={()=>{setConfirmPO(po);oM("confirmR");}} style={{cursor:"pointer",color:"#1D9E75",fontSize:12}}>รับของ</span>}</td></tr>;})}</tbody></table></div>
    {modal==="addPO"&&ed&&<Modal title="สร้าง PO ใหม่" onClose={cM}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><Field label="ซัพพลายเออร์"><select value={form.supplierId} onChange={e=>setForm(f=>({...f,supplierId:e.target.value}))} style={IB}><option value="">เลือก...</option>{sups.map(s=><option key={s.id} value={s.id}>{cN(s)}</option>)}</select></Field><Field label="วันที่"><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={IB}/></Field></div>
    {form.items.map((item,idx)=><div key={idx} style={{marginBottom:10,padding:"10px",background:"#f9f9f7",borderRadius:8,border:"1px solid #e0e0dc"}}><div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,alignItems:"center"}}><select value={item.productId} onChange={e=>setIt(idx,"productId",e.target.value)} style={IB}><option value="">เลือกสินค้า...</option>{products.map(pr=><option key={pr.id} value={pr.id}>{pr.brand+" — "+pN(pr)}</option>)}</select><input type="number" min="1" value={item.qty} onChange={e=>setIt(idx,"qty",e.target.value)} style={IB}/><input type="number" min="0" value={item.cost} onChange={e=>setIt(idx,"cost",e.target.value)} style={IB}/><span onClick={()=>rmItem(idx)} style={{cursor:"pointer",color:"#cc4444",fontSize:20}}>{"×"}</span></div></div>)}
    <button onClick={addItem} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:"0.5px solid #ccc",cursor:"pointer",background:"transparent",marginBottom:12}}>{"+ เพิ่ม"}</button>
    <MBtns onCancel={cM} onSave={savePO} saveLabel="สร้าง PO"/></Modal>}
    {modal==="confirmR"&&confirmPO&&<Modal title={"✅ รับของ — "+confirmPO.poNum} onClose={cM}><div style={{background:"#e6f7f1",border:"1px solid #a8dfc7",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}><strong>ยืนยันแล้วสต็อกจะเพิ่มทันที</strong></div><MBtns onCancel={cM} onSave={()=>{receive(confirmPO.id);setConfirmPO(null);cM();}} saveLabel="✅ ยืนยัน"/></Modal>}
  </div>;
}

function SalesPage({sh}){
  const{pN,cN,canC,sales,setSales,products,setProducts,contacts,search,setSearch,modal,oM,cM,addLog,cu,addA}=sh;
  const ed=canC("sales");const isSU=cu.salesName||"";
  const custs=contacts.filter(c=>c.type==="customer"&&(!isSU||c.salesPerson===isSU));
  const myCI=isSU?custs.map(c=>c.id):null;
  const filtered=[...sales].reverse().filter(so=>{if(myCI&&!myCI.includes(so.customerId))return false;return so.soNum.toLowerCase().includes(search.toLowerCase());});

  const ef={customerId:"",date:todayStr(),items:[{productId:"",qty:1,price:0}],useVatRep:false,vatRepId:""};
  const[form,setForm]=useState(ef);const[viewSO,setViewSO]=useState(null);const[confirmSO,setConfirmSO]=useState(null);const[delSO,setDelSO]=useState(null);const[editSO,setEditSO]=useState(null);
  const[incVat,setIncVat]=useState(true);const[payType,setPayType]=useState("cash");const[discPct,setDiscPct]=useState(1);const[creditDays,setCreditDays]=useState(45);

  const soTot=so=>(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
  const addItem=()=>setForm(f=>({...f,items:[...f.items,{productId:"",qty:1,price:0}]}));
  const rmItem=idx=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const setIt=(idx,k,v)=>setForm(f=>{const its=[...f.items];its[idx]={...its[idx],[k]:v};if(k==="productId"){const p=products.find(x=>x.id===+v);if(p)its[idx].price=p.price;}return{...f,items:its};});
  const setCust=cid=>setForm(f=>({...f,customerId:cid,useVatRep:false,vatRepId:""}));
  const curCust=form.customerId?contacts.find(c=>c.id===+form.customerId):null;
  const curVatReps=(curCust&&curCust.vatReps)||[];

  const getAvail=(pid,exId)=>{const pr=products.find(x=>x.id===+pid);if(!pr)return 0;const pq=sales.filter(so=>so.status==="pending_delivery"&&so.id!==(exId||0)).reduce((s,so)=>{const it=so.items.find(i=>i.productId===+pid);return s+(it?it.qty:0);},0);return Math.max(0,pr.stock-pq);};
  const doSave=(soId)=>{
    const items=form.items.map(i=>({productId:+i.productId,qty:+i.qty,price:+i.price}));
    const sub=items.reduce((s,i)=>s+i.qty*i.price,0);const disc=payType==="cash"?Math.round(sub*discPct/100*100)/100:0;const vatAmt=incVat?Math.round((sub-disc)*7/107*100)/100:0;
    const selRep=form.useVatRep&&form.vatRepId?curVatReps.find(r=>r.id===+form.vatRepId):null;
    const soBase={customerId:+form.customerId,date:form.date,items,includeVat:incVat,vatAmount:vatAmt,payType,discountAmt:disc,discPct:payType==="cash"?discPct:0,creditDays:payType==="credit"?creditDays:0,useVatRep:!!form.useVatRep,vatRepName:selRep?selRep.name:"",vatRepAddress:selRep?selRep.address:"",vatRepIdCard:selRep?selRep.idCard:""};
    if(soId){setSales(p=>p.map(s=>s.id===soId?{...s,...soBase}:s));addA("แก้ไข SO",editSO?.soNum||"");setEditSO(null);}
    else{const sn="SO-"+new Date().getFullYear()+"-"+String(sales.length+1).padStart(3,"0");setSales(p=>[...p,{id:Date.now(),soNum:sn,status:"pending_delivery",fromQuote:"",...soBase}]);addA("สร้าง SO",sn);}
    cM();
  };
  const trySubmit=(soId)=>{if(!form.customerId||form.items.some(i=>!i.productId))return;const exId=soId||0;if(form.items.some(it=>it.productId&&+it.qty>getAvail(it.productId,exId)))return;doSave(soId);};
  const confirmDel=id=>{addA("ลบ SO",sales.find(s=>s.id===id)?.soNum||"");setSales(p=>p.filter(s=>s.id!==id));};
  const confirmDelivery=id=>{setSales(p=>p.map(so=>{if(so.id!==id||so.status!=="pending_delivery")return so;setProducts(pp=>pp.map(pr=>{const it=so.items.find(i=>i.productId===pr.id);if(it)addLog(mkLog(pr.id,"out",it.qty,pr.stock,Math.max(0,pr.stock-it.qty),so.soNum,"จัดส่ง",cu.username));return it?{...pr,stock:Math.max(0,pr.stock-it.qty)}:pr;}));addA("จัดส่ง SO",so.soNum);return{...so,status:"completed"};}));};
  const openEdit=so=>{
    const cust=contacts.find(c=>c.id===so.customerId);
    const reps=(cust&&cust.vatReps)||[];
    const matchRep=so.useVatRep&&so.vatRepName?reps.find(r=>r.name===so.vatRepName):null;
    setForm({customerId:String(so.customerId),date:so.date,items:so.items.map(i=>({productId:String(i.productId),qty:i.qty,price:i.price})),useVatRep:!!so.useVatRep,vatRepId:matchRep?String(matchRep.id):""});
    setIncVat(so.includeVat!==false);setPayType(so.payType||"cash");setDiscPct(so.discPct||1);setCreditDays(so.creditDays||45);setEditSO(so);oM("editSO");
  };

  const renderItems=(exId)=>form.items.map((item,idx)=>{
    const sel=item.productId?products.find(x=>x.id===+item.productId):null;
    const avail=item.productId?getAvail(item.productId,exId):0;
    const over=sel&&+item.qty>avail;
    return <div key={idx} style={{marginBottom:10,padding:"10px 12px",background:"#f9f9f7",borderRadius:8,border:"1.5px solid "+(over?"#f5c07a":"#e0e0dc")}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"start",marginBottom:8}}>
        <ProductPicker value={item.productId} onChange={v=>setIt(idx,"productId",v)} products={products} pName={pN} avail={avail} unit={sel?sel.unit:""}/>
        <span onClick={()=>rmItem(idx)} style={{cursor:"pointer",color:"#cc4444",fontSize:20,paddingTop:6}}>{"×"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Field label="จำนวน"><input type="number" min="1" value={item.qty} onChange={e=>setIt(idx,"qty",e.target.value)} style={{...IB,borderColor:over?"#f5c07a":"#aaa"}}/></Field>
        <Field label="ราคา (฿)"><input type="number" min="0" value={item.price} onChange={e=>setIt(idx,"price",e.target.value)} style={IB}/></Field>
      </div>
      {over&&<div style={{marginTop:6,fontSize:12,color:"#cc4444",fontWeight:500}}>{"⚠ เกินสต็อก (ขาด "+(+item.qty-avail)+")"}</div>}
    </div>;
  });

  const renderForm=(soId)=>{
    const exId=soId||0;const hasOver=form.items.some(it=>it.productId&&+it.qty>getAvail(it.productId,exId));
    const sub=form.items.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0);const disc=payType==="cash"?Math.round(sub*discPct/100*100)/100:0;const after=sub-disc;const vatAmt=incVat?Math.round(after*7/107*100)/100:0;
    return <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Field label="ลูกค้า"><select value={form.customerId} onChange={e=>setCust(e.target.value)} style={IB}><option value="">เลือก...</option>{custs.map(c=><option key={c.id} value={c.id}>{cN(c)}</option>)}</select></Field>
        <Field label="วันที่"><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={IB}/></Field>
      </div>
      {renderItems(exId)}
      <button onClick={addItem} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:"0.5px solid #ccc",cursor:"pointer",background:"transparent",marginBottom:12}}>{"+ เพิ่ม"}</button>
      <div style={{background:"#f8f8f5",borderRadius:8,padding:"12px 14px",marginBottom:12,fontSize:13}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>{[["cash","💵 เงินสด"],["credit","🗓 เครดิต"]].map(v=><label key={v[0]} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(payType===v[0]?"#1D9E75":"#ddd"),cursor:"pointer",background:payType===v[0]?"#e6f7f1":"#fff"}}><input type="radio" name="pt" checked={payType===v[0]} onChange={()=>setPayType(v[0])}/><span style={{fontWeight:500,color:payType===v[0]?"#1D9E75":"#333"}}>{v[1]}</span></label>)}</div>
        {payType==="cash"&&<div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:500,marginBottom:6}}>ส่วนลด</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{DISC_OPTS.map(d=><button key={d} onClick={()=>setDiscPct(d)} style={{padding:"5px 14px",borderRadius:99,border:"1.5px solid "+(discPct===d?"#1D9E75":"#ddd"),background:discPct===d?"#e6f7f1":"#fff",color:discPct===d?"#1D9E75":"#666",cursor:"pointer",fontSize:12}}>{d===0?"ไม่ลด":d+"%"}</button>)}</div></div>}
        {payType==="credit"&&<div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:500,marginBottom:6}}>วันเครดิต</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CREDIT_OPTS.map(d=><button key={d} onClick={()=>setCreditDays(d)} style={{padding:"5px 14px",borderRadius:99,border:"1.5px solid "+(creditDays===d?"#378ADD":"#ddd"),background:creditDays===d?"#e8f0fe":"#fff",color:creditDays===d?"#378ADD":"#666",cursor:"pointer",fontSize:12}}>{d+" วัน"}</button>)}</div></div>}
        <div style={{borderTop:"1px solid #e0e0dc",paddingTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",color:"#666",marginBottom:4}}><span>ยอดรวม</span><span>{"฿"+fmt(sub)}</span></div>
          {payType==="cash"&&disc>0&&<div style={{display:"flex",justifyContent:"space-between",color:"#1D9E75",marginBottom:4}}><span>{"ส่วนลด "+discPct+"%"}</span><span>{"-฿"+fmt(disc)}</span></div>}
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,marginBottom:6}}><input type="checkbox" checked={incVat} onChange={e=>setIncVat(e.target.checked)}/>VAT 7%</label>
          {incVat&&<div style={{display:"flex",justifyContent:"space-between",color:"#b06000",marginBottom:4,fontSize:12}}><span>VAT</span><span>{"฿"+fmt(vatAmt)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,borderTop:"1px solid #ddd",paddingTop:8}}><span>ยอดสุทธิ</span><span style={{color:"#1D9E75"}}>{"฿"+fmt(after)}</span></div>
        </div>
      </div>
      <div style={{background:"#f0f4ff",border:"1.5px solid #c5d0f5",borderRadius:8,padding:"12px 14px",marginBottom:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:form.useVatRep?10:0}}>
          <input type="checkbox" checked={!!form.useVatRep} onChange={e=>setForm(f=>({...f,useVatRep:e.target.checked,vatRepId:e.target.checked?f.vatRepId:""}))}/>
          <span style={{fontSize:13,fontWeight:600,color:"#1565c0"}}>{"🧾 ออก VAT ให้ตัวแทน"}</span>
        </label>
        {form.useVatRep&&(curVatReps.length>0
          ? <div>
              <select value={form.vatRepId} onChange={e=>setForm(f=>({...f,vatRepId:e.target.value}))} style={{...IB,marginBottom:8}}>
                <option value="">{"-- เลือกตัวแทน --"}</option>
                {curVatReps.map(r=><option key={r.id} value={r.id}>{r.name+" ("+r.idCard+")"}</option>)}
              </select>
              {form.vatRepId&&(()=>{const r=curVatReps.find(x=>x.id===+form.vatRepId);return r?<div style={{background:"#fff",borderRadius:6,padding:"8px 10px",fontSize:12,border:"1px solid #dfe6f5"}}>
                <div style={{fontWeight:500}}>{r.name}</div>
                <div style={{color:"#666",marginTop:2}}>{r.address}</div>
                <div style={{color:"#888",marginTop:2}}>{"บัตร ปชช: "+r.idCard}</div>
              </div>:null;})()}
            </div>
          : <div style={{fontSize:12,color:"#b06000",background:"#fff8f0",borderRadius:6,padding:"8px 10px"}}>{"⚠ ลูกค้ารายนี้ยังไม่มีตัวแทน VAT — กรุณาเพิ่มในหน้า ลูกค้า ก่อน"}</div>
        )}
      </div>
      {hasOver&&<div style={{background:"#fdecea",border:"1.5px solid #f5a0a0",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:13,color:"#cc4444",fontWeight:500}}>{"🚫 สินค้าบางรายการเกินสต็อก — กรุณาแก้ไขจำนวน"}</div>}
      <MBtns onCancel={()=>{setEditSO(null);cM();}} onSave={hasOver?null:()=>trySubmit(soId)} saveLabel={soId?"💾 บันทึก":"สร้างใบขาย"}/>
    </div>;
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <SB value={search} onChange={setSearch} placeholder="ค้นหา SO..."/>
      {ed&&<Btn onClick={()=>{setForm(ef);setIncVat(true);setPayType("cash");setDiscPct(1);setCreditDays(45);oM("addSO");}}>{"+ สร้างใบขาย"}</Btn>}
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid #ccc"}}>{["SO No.","ลูกค้า","วันที่","รวม","VAT Rep","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px 6px",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(so=>{const cust=contacts.find(c=>c.id===so.customerId);return <tr key={so.id} style={{borderBottom:"0.5px solid #eee"}}>
      <td style={{padding:"8px 6px",fontWeight:500}}>{so.soNum}</td>
      <td style={{padding:"8px 6px"}}>{cust?cN(cust):"-"}</td>
      <td style={{padding:"8px 6px",color:"#666"}}>{toBE(so.date)}</td>
      <td style={{padding:"8px 6px"}}>{"฿"+fmt(soTot(so))}</td>
      <td style={{padding:"8px 6px"}}>{so.useVatRep&&so.vatRepName?<span style={{fontSize:11,background:"#f0f4ff",color:"#1565c0",borderRadius:4,padding:"2px 8px"}}>{"🧾 "+so.vatRepName}</span>:<span style={{color:"#bbb"}}>{"—"}</span>}</td>
      <td style={{padding:"8px 6px"}}><Badge status={so.status}/></td>
      <td style={{padding:"8px 6px",whiteSpace:"nowrap"}}>
        <span onClick={()=>{setViewSO(so);oM("viewSO");}} style={{cursor:"pointer",color:"#378ADD",fontSize:12,marginRight:6}}>ดู</span>
        {ed&&so.status==="pending_delivery"&&<span onClick={()=>openEdit(so)} style={{cursor:"pointer",color:"#b06000",fontSize:12,marginRight:6}}>{"✏"}</span>}
        {ed&&so.status==="pending_delivery"&&<span onClick={()=>{setConfirmSO(so);oM("confirmD");}} style={{cursor:"pointer",color:"#1D9E75",fontSize:12,marginRight:6}}>{"✓ ส่ง"}</span>}
        {ed&&so.status!=="completed"&&<span onClick={()=>setDelSO(so)} style={{cursor:"pointer",color:"#cc4444",fontSize:12}}>{"🗑"}</span>}
      </td>
    </tr>;})}</tbody></table></div>

    {modal==="addSO"&&ed&&<Modal title="สร้างใบขายใหม่" onClose={cM}>{renderForm(null)}</Modal>}
    {modal==="editSO"&&editSO&&ed&&<Modal title={"✏ แก้ไข — "+editSO.soNum} onClose={()=>{setEditSO(null);cM();}}>{renderForm(editSO.id)}</Modal>}
    {modal==="confirmD"&&confirmSO&&<Modal title={"🚚 ยืนยันจัดส่ง — "+confirmSO.soNum} onClose={cM}><div style={{background:"#e6f7f1",border:"1px solid #a8dfc7",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}><strong>ยืนยันแล้วสต็อกจะถูกตัดทันที</strong></div><MBtns onCancel={cM} onSave={()=>{confirmDelivery(confirmSO.id);setConfirmSO(null);cM();}} saveLabel="✅ ยืนยัน"/></Modal>}
    {modal==="viewSO"&&viewSO&&<Modal title={viewSO.soNum} onClose={cM}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span>{contacts.find(c=>c.id===viewSO.customerId)?cN(contacts.find(c=>c.id===viewSO.customerId)):"-"}</span><Badge status={viewSO.status}/></div>
      {viewSO.useVatRep&&viewSO.vatRepName?<div style={{background:"#f0f4ff",border:"1.5px solid #c5d0f5",borderRadius:8,padding:"10px 14px",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:600,color:"#1565c0",marginBottom:6}}>{"🧾 ตัวแทนรับ VAT"}</div>
        <div style={{fontWeight:500,fontSize:13}}>{viewSO.vatRepName}</div>
        {viewSO.vatRepAddress&&<div style={{fontSize:12,color:"#555",marginTop:2}}>{viewSO.vatRepAddress}</div>}
        {viewSO.vatRepIdCard&&<div style={{fontSize:12,color:"#888",marginTop:2}}>{"บัตร ปชช: "+viewSO.vatRepIdCard}</div>}
      </div>:<div style={{background:"#f8f8f5",borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#999"}}>{"ไม่ออก VAT ให้ตัวแทน"}</div>}
      <table style={{width:"100%",borderCollapse:"collapse",marginTop:10}}><thead><tr style={{borderBottom:"0.5px solid #ccc"}}>{["สินค้า","Qty","ราคา","รวม"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{viewSO.items.map((it,i)=>{const pr=products.find(x=>x.id===it.productId);return <tr key={i} style={{borderBottom:"0.5px solid #eee"}}><td style={{padding:"6px 8px"}}>{pr?pN(pr):"-"}</td><td style={{padding:"6px 8px"}}>{it.qty}</td><td style={{padding:"6px 8px"}}>{"฿"+fmt(it.price)}</td><td style={{padding:"6px 8px",fontWeight:500}}>{"฿"+fmt(it.qty*it.price)}</td></tr>;})}</tbody></table>
      <div style={{textAlign:"right",fontWeight:700,marginTop:10}}>{"ยอดสุทธิ: ฿"+fmt(soTot(viewSO)-(viewSO.discountAmt||0))}</div>
      <MBtns onCancel={cM}/>
    </Modal>}
    {delSO&&<Modal title="🗑 ยืนยันลบ" onClose={()=>setDelSO(null)}><div style={{background:"#fdecea",border:"1px solid #f5a0a0",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"#cc4444"}}>{"จะลบ "+delSO.soNum+" ถาวร"}</div><MBtns onCancel={()=>setDelSO(null)} onSave={()=>{confirmDel(delSO.id);setDelSO(null);}} saveLabel="🗑 ลบ"/></Modal>}
  </div>;
}

function FinPage({sh}){
  const{cN,contacts,pos,sales,payments,setPayments,canE,modal,oM,cM}=sh;
  const ed=canE("finance");const[sub,setSub]=useState("ap");const[payForm,setPayForm]=useState({refId:"",type:"",amount:"",method:"โอนเงิน",date:todayStr(),note:""});const[fSt,setFSt]=useState("all");
  const apList=pos.filter(po=>po.status==="received").map(po=>{const sup=contacts.find(c=>c.id===po.supplierId);const total=po.items.reduce((s,i)=>s+i.qty*i.cost,0);const paid=payments.filter(p=>p.refId===po.poNum&&p.type==="ap").reduce((s,p)=>s+(+p.amount||0),0);const rem=total-paid;return{...po,supName:sup?cN(sup):"-",total,paid,remaining:rem,status2:paid===0?"unpaid":rem<=0?"paid":"partial"};});
  const arList=sales.filter(so=>so.status==="completed").map(so=>{const cust=contacts.find(c=>c.id===so.customerId);const tot=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const paid=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);const rem=tot-paid;return{...so,custName:cust?cN(cust):"-",total:tot,paid,remaining:rem,status2:paid===0?"unpaid":rem<=0?"paid":"partial"};});
  const list=sub==="ap"?apList:arList;const filtered=list.filter(i=>fSt==="all"||i.status2===fSt);
  const totalUnpaid=filtered.filter(i=>i.status2!=="paid").reduce((s,i)=>s+Math.max(0,i.remaining),0);
  const openPay=item=>{setPayForm({refId:sub==="ap"?item.poNum:item.soNum,type:sub,amount:Math.max(0,item.remaining).toFixed(2),method:"โอนเงิน",date:todayStr(),note:""});oM("addPay");};
  const savePay=()=>{if(!payForm.amount||+payForm.amount<=0)return;setPayments(p=>[...p,{id:Date.now(),...payForm,amount:+payForm.amount}]);cM();};
  const stB=s=>s==="paid"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"#C0DD97",color:"#27500A"}}>ชำระแล้ว</span>:s==="partial"?<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"#B5D4F4",color:"#0C447C"}}>บางส่วน</span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"#FAC775",color:"#633806"}}>รอชำระ</span>;
  return <div>
    <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid #eee"}}>{[["ap","🏭 จ่ายซัพพลายเออร์"],["ar","🧾 เก็บเงินลูกค้า"]].map(v=><button key={v[0]} onClick={()=>{setSub(v[0]);setFSt("all");}} style={{padding:"10px 20px",fontSize:13,fontWeight:sub===v[0]?600:400,border:"none",borderBottom:sub===v[0]?"2px solid #111":"2px solid transparent",marginBottom:"-2px",background:"transparent",cursor:"pointer",color:sub===v[0]?"#111":"#666"}}>{v[1]}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}><StatCard label="รายการ" value={list.length}/><StatCard label={sub==="ap"?"ค้างจ่าย":"ค้างรับ"} value={"฿"+fmt(totalUnpaid)} color={totalUnpaid>0?"#cc4444":"#1D9E75"}/></div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>{[["all","ทั้งหมด"],["unpaid","รอชำระ"],["partial","บางส่วน"],["paid","ชำระแล้ว"]].map(v=><button key={v[0]} onClick={()=>setFSt(v[0])} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(fSt===v[0]?"#111":"#ddd"),background:fSt===v[0]?"#111":"transparent",color:fSt===v[0]?"#fff":"#666",cursor:"pointer"}}>{v[1]}</button>)}</div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid #ccc",background:"#f5f5f0"}}>{(sub==="ap"?["PO","ซัพพลายเออร์"]:["SO","ลูกค้า"]).concat(["ยอด","ชำระแล้ว","ค้าง","สถานะ",""]).map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"#666",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.map(it=><tr key={it.id} style={{borderBottom:"0.5px solid #eee"}}><td style={{padding:"8px",fontWeight:500,color:"#378ADD"}}>{sub==="ap"?it.poNum:it.soNum}</td><td style={{padding:"8px"}}>{sub==="ap"?it.supName:it.custName}</td><td style={{padding:"8px"}}>{"฿"+fmt(it.total)}</td><td style={{padding:"8px",color:"#1D9E75"}}>{"฿"+fmt(it.paid)}</td><td style={{padding:"8px",color:it.remaining>0?"#cc4444":"#1D9E75",fontWeight:600}}>{"฿"+fmt(Math.max(0,it.remaining))}</td><td style={{padding:"8px"}}>{stB(it.status2)}</td><td style={{padding:"8px"}}>{ed&&it.status2!=="paid"&&<span onClick={()=>openPay(it)} style={{cursor:"pointer",color:"#1D9E75",fontSize:12,fontWeight:500}}>{sub==="ap"?"+ จ่าย":"+ รับ"}</span>}</td></tr>)}</tbody></table></div>
    {modal==="addPay"&&ed&&<Modal title={(sub==="ap"?"💳 จ่าย — ":"💰 รับ — ")+payForm.refId} onClose={cM}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Field label="จำนวน (฿)"><input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field><Field label="วันที่"><input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={IB}/></Field><Field label="วิธี"><select value={payForm.method} onChange={e=>setPayForm(f=>({...f,method:e.target.value}))} style={IB}>{["โอนเงิน","เงินสด","เช็ค","บัตรเครดิต"].map(m=><option key={m} value={m}>{m}</option>)}</select></Field><Field label="หมายเหตุ"><input value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} style={IB}/></Field></div><MBtns onCancel={cM} onSave={savePay}/></Modal>}
  </div>;
}

function RepPage({sh}){
  const{products,sales,pos,pN,cN,contacts,targets,setTargets,audit,priceHist,users,canE}=sh;
  const[sub,setSub]=useState("overview");
  return <div><div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid #eee",overflowX:"auto"}}>{[["overview","📊 ภาพรวม"],["audit","🔒 Audit"],["prices","💲 ราคา"]].map(v=><button key={v[0]} onClick={()=>setSub(v[0])} style={{padding:"10px 16px",fontSize:13,fontWeight:sub===v[0]?600:400,border:"none",borderBottom:sub===v[0]?"2px solid #111":"2px solid transparent",marginBottom:"-2px",background:"transparent",cursor:"pointer",color:sub===v[0]?"#111":"#666",whiteSpace:"nowrap"}}>{v[1]}</button>)}</div>
  {sub==="overview"&&<RepOverview products={products} sales={sales} pos={pos} pN={pN}/>}
  {sub==="audit"&&<AuditTab audit={audit}/>}
  {sub==="prices"&&<PriceTab priceHist={priceHist} products={products} pN={pN}/>}
  </div>;
}
function RepOverview({products,sales,pos,pN}){
  const mL=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const getLast=n=>{const r=[];const now=new Date();for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);r.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));}return r;};
  const keys=getLast(6);
  const data=keys.map(k=>{const s=sales.filter(x=>(x.date||"").startsWith(k)).reduce((a,so)=>a+so.items.reduce((b,i)=>b+i.qty*i.price,0),0);const p=pos.filter(x=>(x.date||"").startsWith(k)&&x.status!=="cancelled").reduce((a,po)=>a+po.items.reduce((b,i)=>b+i.qty*i.cost,0),0);return{month:mL[+k.split("-")[1]-1]+" "+k.slice(2),sales:s,purchase:p};});
  const maxVal=Math.max(...data.map(d=>Math.max(d.sales,d.purchase)),1);
  return <div><div style={{fontWeight:600,fontSize:15,marginBottom:16}}>รายงานรายเดือน</div><div style={{background:"#fff",border:"0.5px solid #eee",borderRadius:8,padding:"1rem"}}>{data.map(d=><div key={d.month} style={{marginBottom:10}}><div style={{fontSize:12,fontWeight:500,color:"#666",marginBottom:4}}>{d.month}</div><SimpleBar label="Sales" value={d.sales} max={maxVal} color="#1D9E75"/><SimpleBar label="Purchase" value={d.purchase} max={maxVal} color="#378ADD"/></div>)}</div></div>;
}
function AuditTab({audit}){
  const[fU,setFU]=useState("");const us=[...new Set(audit.map(l=>l.user))];const fl=fU?audit.filter(l=>l.user===fU):audit;
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontWeight:600,fontSize:14}}>{"🔒 Audit Log"}</span><select value={fU} onChange={e=>setFU(e.target.value)} style={{...IB,width:"auto",padding:"6px 10px"}}><option value="">ทุก User</option>{us.map(u=><option key={u} value={u}>{u}</option>)}</select></div>{fl.length===0&&<div style={{textAlign:"center",color:"#666",padding:"2rem"}}>ยังไม่มี</div>}<div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid #ccc",background:"#f5f5f0"}}>{["วันที่","ผู้ใช้","การกระทำ","รายละเอียด"].map(h=><th key={h} style={{padding:"8px",textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{fl.slice(0,100).map(l=><tr key={l.id} style={{borderBottom:"0.5px solid #eee"}}><td style={{padding:"8px",color:"#666",fontSize:11}}>{l.date}</td><td style={{padding:"8px",fontWeight:500}}>{l.user}</td><td style={{padding:"8px"}}><span style={{background:"#e8f0fe",color:"#1565c0",borderRadius:4,padding:"2px 8px",fontSize:11}}>{l.action}</span></td><td style={{padding:"8px"}}>{l.detail}</td></tr>)}</tbody></table></div></div>;
}
function PriceTab({priceHist,products,pN}){
  const[fP,setFP]=useState("");const fl=fP?priceHist.filter(p=>p.productId===+fP):priceHist;
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontWeight:600,fontSize:14}}>{"💲 ประวัติราคา"}</span><select value={fP} onChange={e=>setFP(e.target.value)} style={{...IB,width:"auto",padding:"6px 10px"}}><option value="">ทุกสินค้า</option>{products.map(pr=><option key={pr.id} value={pr.id}>{pr.brand+" — "+pN(pr)}</option>)}</select></div>{fl.length===0&&<div style={{textAlign:"center",color:"#666",padding:"2rem"}}>ยังไม่มี</div>}<div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"1px solid #ccc",background:"#f5f5f0"}}>{["วันที่","สินค้า","ช่อง","เดิม","ใหม่","เปลี่ยน","ผู้แก้"].map(h=><th key={h} style={{padding:"8px",textAlign:"left",fontWeight:500,color:"#666"}}>{h}</th>)}</tr></thead><tbody>{fl.slice(0,100).map(p=>{const pr=products.find(x=>x.id===p.productId);const d=p.newVal-p.oldVal;return <tr key={p.id} style={{borderBottom:"0.5px solid #eee"}}><td style={{padding:"8px",color:"#666",fontSize:11}}>{p.date}</td><td style={{padding:"8px",fontWeight:500}}>{pr?pr.brand+" — "+pN(pr):"-"}</td><td style={{padding:"8px"}}>{p.field==="price"?"ราคาขาย":"ต้นทุน"}</td><td style={{padding:"8px"}}>{"฿"+fmt(p.oldVal)}</td><td style={{padding:"8px",fontWeight:600}}>{"฿"+fmt(p.newVal)}</td><td style={{padding:"8px",fontWeight:600,color:d>0?"#cc4444":"#1D9E75"}}>{(d>0?"+":"")+"฿"+fmt(d)}</td><td style={{padding:"8px",color:"#666"}}>{p.user}</td></tr>;})}</tbody></table></div></div>;
}

function ContactPage({sh,ft}){
  const{cN,canE,contacts,setContacts,search,setSearch,modal,oM,cM,cu,users}=sh;
  const SS=(users||[]).filter(u=>u.salesName).map(u=>u.salesName);
  const isC=ft==="customer";const tk=isC?"customers":"suppliers";const ed=canE(tk);
  const sf=isC&&cu.salesName;
  const ef={type:ft,name:"",nameT:"",phone:"",email:"",address:"",taxId:"",salesPerson:"",vatReps:[]};
  const[form,setForm]=useState(ef);const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const[newVR,setNewVR]=useState({name:"",address:"",idCard:""});
  const addVR=()=>{const n=newVR.name.trim();if(!n)return;setForm(f=>({...f,vatReps:[...f.vatReps,{id:Date.now(),name:n,address:newVR.address.trim(),idCard:newVR.idCard.trim()}]}));setNewVR({name:"",address:"",idCard:""});};
  const delVR=id=>setForm(f=>({...f,vatReps:f.vatReps.filter(r=>r.id!==id)}));
  const mk="c_"+ft;const title=isC?"ลูกค้า":"ซัพพลายเออร์";
  const filtered=(contacts||[]).filter(c=>{if(!c||c.type!==ft)return false;if(sf&&c.salesPerson!==cu.salesName)return false;if(search){const s=search.toLowerCase();if(!((cN(c)||"").toLowerCase().includes(s)||(c.email||"").toLowerCase().includes(s)))return false;}return true;});
  const save=()=>{if(!form.name)return;const item={...form,id:form.id||Date.now()};setContacts(p=>form.id?p.map(c=>c.id===form.id?item:c):[...p,item]);cM();};
  const del=id=>setContacts(p=>p.filter(c=>c.id!==id));
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:8,flexWrap:"wrap"}}><SB value={search} onChange={setSearch} placeholder={"ค้นหา"+title+"..."}/>{ed&&<Btn onClick={()=>{setForm({...ef});oM(mk);}}>{"+ เพิ่ม"+title}</Btn>}</div>
    {filtered.length===0&&<div style={{textAlign:"center",color:"#666",padding:"2rem"}}>{"ยังไม่มี"+title}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>{filtered.map(c=><div key={c.id} style={{background:"#fff",border:"0.5px solid #eee",borderRadius:12,padding:"1rem 1.25rem"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontWeight:600,fontSize:14}}>{cN(c)}</div><Badge status={c.type}/></div><div style={{fontSize:12,color:"#666",marginBottom:2}}>{"📞 "+(c.phone||"-")}</div><div style={{fontSize:12,color:"#378ADD",marginBottom:6}}>{"✉ "+(c.email||"-")}</div>{isC&&c.salesPerson&&<div style={{fontSize:12,marginBottom:6}}><span style={{background:"#f0e6ff",color:"#6B0E8A",borderRadius:99,padding:"2px 10px",fontWeight:500,fontSize:11}}>{"👤 "+c.salesPerson}</span></div>}{isC&&c.vatReps&&c.vatReps.length>0&&<div style={{background:"#f0f4ff",border:"1px solid #c5d0f5",borderRadius:6,padding:"6px 10px",marginBottom:8,fontSize:12}}><div style={{color:"#1565c0",fontWeight:500,marginBottom:4}}>{"🧾 ตัวแทน VAT ("+c.vatReps.length+")"}</div>{c.vatReps.map(r=><div key={r.id} style={{marginBottom:3}}><span style={{fontWeight:500}}>{r.name}</span><span style={{color:"#888",marginLeft:6}}>{r.idCard}</span></div>)}</div>}{ed&&<div style={{display:"flex",gap:10}}><span onClick={()=>{setForm({vatReps:[],address:"",taxId:"",salesPerson:"",...c});oM(mk);}} style={{cursor:"pointer",color:"#378ADD",fontSize:12}}>แก้ไข</span><span onClick={()=>del(c.id)} style={{cursor:"pointer",color:"#cc4444",fontSize:12}}>ลบ</span></div>}</div>)}</div>
    {modal===mk&&ed&&<Modal title={(form.id?"แก้ไข":"เพิ่ม")+title} onClose={cM} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="ชื่อ EN"><input value={form.name||""} onChange={e=>setF("name",e.target.value)} style={IB}/></Field>
        <Field label="ชื่อ TH"><input value={form.nameT||""} onChange={e=>setF("nameT",e.target.value)} style={IB}/></Field>
        <Field label="โทร"><input value={form.phone||""} onChange={e=>setF("phone",e.target.value)} style={IB}/></Field>
        <Field label="Email"><input value={form.email||""} onChange={e=>setF("email",e.target.value)} style={IB}/></Field>
        {isC&&<div style={{gridColumn:"1/-1"}}><Field label="เซลส์"><select value={form.salesPerson||""} onChange={e=>setF("salesPerson",e.target.value)} style={IB}><option value="">ไม่ระบุ</option>{SS.map(s=><option key={s} value={s}>{s}</option>)}</select></Field></div>}
        {isC&&<div style={{gridColumn:"1/-1"}}><Field label="Tax ID"><input value={form.taxId||""} onChange={e=>setF("taxId",e.target.value)} style={IB}/></Field></div>}
        {isC&&<div style={{gridColumn:"1/-1"}}><Field label="ที่อยู่"><textarea value={form.address||""} onChange={e=>setF("address",e.target.value)} style={{...IB,height:56,resize:"vertical"}}/></Field></div>}
        {isC&&<div style={{gridColumn:"1/-1"}}>
          <div style={{fontSize:12,fontWeight:600,color:"#1565c0",background:"#f0f4ff",border:"1px solid #c5d0f5",borderRadius:8,padding:"8px 12px",marginBottom:8}}>{"🧾 ตัวแทนรับ VAT ("+(form.vatReps||[]).length+" คน)"}</div>
          {(form.vatReps||[]).map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#fff",border:"1px solid #dfe6f5",borderRadius:6,marginBottom:6}}>
            <div style={{flex:1,fontSize:12}}><div style={{fontWeight:500}}>{r.name}</div><div style={{color:"#666"}}>{r.address}</div><div style={{color:"#888"}}>{"บัตร ปชช: "+r.idCard}</div></div>
            <button onClick={()=>delVR(r.id)} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #f5a0a0",background:"#fdecea",color:"#cc4444",cursor:"pointer",fontSize:12}}>{"×"}</button>
          </div>)}
          <div style={{background:"#fafafa",border:"1px dashed #c5d0f5",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:11,fontWeight:500,color:"#1565c0",marginBottom:6}}>เพิ่มตัวแทนใหม่</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Field label="ชื่อ"><input value={newVR.name} onChange={e=>setNewVR(p=>({...p,name:e.target.value}))} style={IB} placeholder="ชื่อ-นามสกุล"/></Field>
              <Field label="เลขบัตร ปชช."><input value={newVR.idCard} onChange={e=>setNewVR(p=>({...p,idCard:e.target.value}))} style={IB} placeholder="13 หลัก"/></Field>
            </div>
            <Field label="ที่อยู่"><textarea value={newVR.address} onChange={e=>setNewVR(p=>({...p,address:e.target.value}))} style={{...IB,height:50,resize:"vertical"}} placeholder="ที่อยู่สำหรับออก VAT"/></Field>
            <button onClick={addVR} style={{marginTop:8,padding:"6px 14px",borderRadius:6,border:"none",background:"#1565c0",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:500}}>{"+ เพิ่มตัวแทน"}</button>
          </div>
        </div>}
      </div>
      <MBtns onCancel={cM} onSave={save}/>
    </Modal>}
  </div>;
}

function UserPage({sh}){
  const{users,setUsers,modal,oM,cM,contacts}=sh;
  const[confirmDel,setConfirmDel]=useState(null);
  const del=id=>setUsers(p=>p.filter(u=>u.id!==id));
  const PT=["dashboard","products","stock_log","purchase","sales","finance","reports","suppliers","customers"];
  const PK=["access","read","create","edit","delete"];const PL={access:"เข้าถึง",read:"ดู",create:"สร้าง",edit:"แก้ไข",delete:"ลบ"};const PC={access:"#6B0E8A",read:"#378ADD",create:"#1D9E75",edit:"#b06000",delete:"#cc4444"};
  const migrateP=perms=>{const r={};for(const[k,v]of Object.entries(perms||{})){if(typeof v==="string")r[k]=v==="edit"?{access:true,read:true,create:true,edit:true,delete:true}:v==="view"?{access:true,read:true,create:false,edit:false,delete:false}:{access:false,read:false,create:false,edit:false,delete:false};else r[k]=v||{access:false};}return r;};
  const mkE=()=>{const perms={};[...PT,"users"].forEach(t=>perms[t]={access:false,read:false,create:false,edit:false,delete:false});return{username:"",password:"",role:"Staff",salesName:"",supplierName:"",dashboardWidgets:[...ALL_WIDGET_KEYS],perms};};
  const[form,setForm]=useState(mkE());
  const toggleP=(tab,key)=>setForm(f=>{const cur={...(f.perms[tab]||{})};cur[key]=!cur[key];if(key==="access"&&!cur[key])PK.forEach(k=>cur[k]=false);if(key!=="access"&&cur[key])cur.access=true;if((key==="create"||key==="edit"||key==="delete")&&cur[key])cur.read=true;return{...f,perms:{...f.perms,[tab]:cur}};});
  const setAll=level=>setForm(f=>{const perms={};[...PT,"users"].forEach(t=>{perms[t]=level==="all"?{access:true,read:true,create:true,edit:true,delete:true}:level==="view"?{access:true,read:true,create:false,edit:false,delete:false}:{access:false,read:false,create:false,edit:false,delete:false};});return{...f,perms};});
  const save=()=>{if(!form.username||!form.password)return;const item={...form,id:form.id||Date.now()};setUsers(p=>form.id?p.map(u=>u.id===form.id?item:u):[...p,item]);cM();};
  const getP=(u,tab)=>{const p=u.perms[tab];if(!p)return{};if(typeof p==="string")return p==="edit"?{access:true,read:true,create:true,edit:true,delete:true}:p==="view"?{access:true,read:true}:{};return p;};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontWeight:600,fontSize:15}}>จัดการ User</div><Btn onClick={()=>{setForm(mkE());oM("user");}}>{"+ เพิ่ม User"}</Btn></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>{users.map(u=><div key={u.id} style={{background:"#fff",border:"0.5px solid #eee",borderRadius:12,padding:"1rem"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div><div style={{fontWeight:600,fontSize:14}}>{u.username}</div><div style={{fontSize:12,color:"#666"}}>{"pw: "+u.password}</div>{u.salesName&&<div style={{fontSize:11,color:"#6B0E8A",marginTop:2}}>{"👤 "+u.salesName}</div>}{u.supplierName&&<div style={{fontSize:11,color:"#8B4000",marginTop:2}}>{"🏭 "+u.supplierName}</div>}</div><Badge status={u.role}/></div><div style={{display:"flex",gap:10}}><span onClick={()=>{setForm({...u,perms:migrateP(u.perms),dashboardWidgets:u.dashboardWidgets||[...ALL_WIDGET_KEYS]});oM("user");}} style={{cursor:"pointer",color:"#378ADD",fontSize:12}}>แก้ไข</span>{u.id!==1&&<span onClick={()=>setConfirmDel(u)} style={{cursor:"pointer",color:"#cc4444",fontSize:12}}>ลบ</span>}</div></div>)}</div>
    {modal==="user"&&<Modal title={form.id?"แก้ไข User":"เพิ่ม User"} onClose={cM} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}><Field label="Username"><input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} style={IB}/></Field><Field label="Password"><input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={IB}/></Field><Field label="Role"><input value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={IB}/></Field><Field label="ชื่อเซลส์"><input value={form.salesName||""} onChange={e=>setForm(f=>({...f,salesName:e.target.value}))} style={IB}/></Field></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontWeight:500,fontSize:13}}>สิทธิ์</div><div style={{display:"flex",gap:6}}><button onClick={()=>setAll("all")} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid #1D9E75",color:"#1D9E75",background:"transparent",cursor:"pointer"}}>ทั้งหมด</button><button onClick={()=>setAll("view")} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid #378ADD",color:"#378ADD",background:"transparent",cursor:"pointer"}}>ดูอย่างเดียว</button><button onClick={()=>setAll("none")} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid #cc4444",color:"#cc4444",background:"transparent",cursor:"pointer"}}>ปิด</button></div></div>
      <div style={{overflowX:"auto",border:"1px solid #ddd",borderRadius:8}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid #ddd",background:"#f8f8f5"}}><th style={{padding:"10px 8px",textAlign:"left",fontWeight:600,minWidth:100}}>เมนู</th>{PK.map(k=><th key={k} style={{padding:"10px 4px",textAlign:"center",fontWeight:600,color:PC[k],fontSize:11,minWidth:50}}>{PL[k]}</th>)}</tr></thead><tbody>{[...PT,"users"].map(tab=>{const p=form.perms[tab]||{};return <tr key={tab} style={{borderBottom:"0.5px solid #eee",background:p.access?"":"#fafafa"}}><td style={{padding:"8px",fontWeight:500,color:p.access?"#111":"#999"}}>{TAB_LABELS[tab]?TAB_LABELS[tab].th:tab}</td>{PK.map(k=><td key={k} style={{padding:"6px 4px",textAlign:"center"}}><label style={{cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,background:p[k]?PC[k]+"18":"#f5f5f0",border:"1.5px solid "+(p[k]?PC[k]:"#ddd")}}><input type="checkbox" checked={!!p[k]} onChange={()=>toggleP(tab,k)} style={{display:"none"}}/>{p[k]&&<span style={{color:PC[k],fontWeight:700,fontSize:13}}>{"✓"}</span>}</label></td>)}</tr>;})}</tbody></table></div>
      <MBtns onCancel={cM} onSave={save}/>
    </Modal>}
    {confirmDel&&<Modal title="🗑 ยืนยันลบ" onClose={()=>setConfirmDel(null)}><div style={{background:"#fdecea",border:"1px solid #f5a0a0",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"#cc4444"}}>{"จะลบ "+confirmDel.username+" ถาวร"}</div><MBtns onCancel={()=>setConfirmDel(null)} onSave={()=>{del(confirmDel.id);setConfirmDel(null);}} saveLabel="🗑 ลบ"/></Modal>}
  </div>;
}

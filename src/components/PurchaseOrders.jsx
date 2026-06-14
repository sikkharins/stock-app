import { useState, useMemo, useEffect } from "react";
import { IB } from "../utils/constants.js";
import { fmt, toBE, todayStr, mkLog, nowStr, fmtD, nextDocNum, shipmentTotals, poStatusFromShipments, buildDropshipShipmentSO } from "../utils/helpers.js";
import { printDoc } from "./PrintDocument.jsx";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Badge from "./ui/Badge.jsx";
import StatCard from "./ui/StatCard.jsx";
import SB from "./ui/SearchBar.jsx";
import Btn from "./ui/Btn.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";

const STATUS_TABS=[
  {key:"all",label:"ทั้งหมด"},
  {key:"draft",label:"Draft"},
  {key:"pending_approval",label:"รออนุมัติ"},
  {key:"approved",label:"อนุมัติแล้ว"},
  {key:"partial",label:"ส่งบางส่วน"},
  {key:"pending",label:"(เก่า)"},
  {key:"received",label:"รับแล้ว"},
  {key:"cancelled",label:"ยกเลิก"},
];

export default function POPage({sh}){
  const{pN,cN,canE,pos,setPOs,sales,setSales,products,setProducts,contacts,search,setSearch,modal,oM,cM,addLog,cu,isSup,supN,addA,payments,setPayments,setBankTxns,setCheques}=sh;
  const ed=canE("purchase");
  const isAdmin=cu?.role==="Admin";
  const sups=contacts.filter(c=>c.type==="supplier");
  const custs=contacts.filter(c=>c.type==="customer");

  const purchasePerm=cu?.perms?.purchase;
  const canApprovePO=typeof purchasePerm==="object"?!!purchasePerm?.approve:(isAdmin);

  const [statusFilter,setStatusFilter]=useState("all");
  const basePOs=isSup?pos.filter(po=>po.supplierId===(contacts.find(c=>c.type==="supplier"&&c.name===supN)||{}).id):pos;
  const counts=useMemo(()=>{const c={};basePOs.forEach(po=>{c[po.status]=(c[po.status]||0)+1;});return c;},[basePOs]);
  const filtered=useMemo(()=>[...basePOs].reverse().filter(po=>{
    const sup=contacts.find(c=>c.id===po.supplierId);
    const s=(search||"").toLowerCase();
    const ms=po.poNum.toLowerCase().includes(s)||(sup?(cN(sup)||"").toLowerCase().includes(s):false);
    const mst=statusFilter==="all"||po.status===statusFilter;
    return ms&&mst;
  }),[basePOs,search,contacts,statusFilter,cN]);

  const ef={supplierId:"",date:todayStr(),deliveryDate:"",creditDays:0,items:[{productId:"",qty:1,cost:0}],note:"",dropShip:false,dropShipCustomerId:""};
  const[form,setForm]=useState(ef);
  useEffect(()=>{if(sh.quickCreate==="addPO"&&ed&&!isSup){setForm(ef);oM("addPO");sh.clearQuickCreate();}},[sh.quickCreate]);
  const[viewPO,setViewPO]=useState(null);
  const[appModal,setAppModal]=useState(null);
  const[appComment,setAppComment]=useState("");
  const[confirmCancel,setConfirmCancel]=useState(null);const[editPO,setEditPO]=useState(null);const[warnMsg,setWarnMsg]=useState(null);const[confirmDelPO,setConfirmDelPO]=useState(null);
  const[shipModal,setShipModal]=useState(null);const[shipForm,setShipForm]=useState([]);const[confirmClose,setConfirmClose]=useState(null);

  const poTot=po=>(po.items||[]).reduce((s,i)=>s+i.qty*i.cost,0);
  const stats=useMemo(()=>{const pa=basePOs.filter(p=>p.status==="pending_approval").length;const recv=basePOs.filter(p=>p.status==="received").length;const totAmt=basePOs.reduce((s,po)=>s+poTot(po),0);return{total:basePOs.length,pa,recv,totAmt};},[basePOs]);
  const addItem=()=>setForm(f=>({...f,items:[...f.items,{productId:"",qty:1,cost:0}]}));
  const rmItem=idx=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const setIt=(idx,k,v)=>setForm(f=>{const its=[...f.items];its[idx]={...its[idx],[k]:v};if(k==="productId"){const p=products.find(x=>x.id===+v);if(p)its[idx].cost=p.cost;}return{...f,items:its};});

  const savePO=()=>{
    if(!form.supplierId||form.items.some(i=>!i.productId))return;
    if(form.dropShip&&!form.dropShipCustomerId){setWarnMsg("กรุณาเลือกลูกค้าปลายทางสำหรับส่งนอกสถานที่");return;}
    const pn=nextDocNum("PO",pos,"poNum");
    setPOs(p=>[...p,{id:Date.now(),poNum:pn,supplierId:+form.supplierId,date:form.date,deliveryDate:form.deliveryDate||"",creditDays:+form.creditDays||0,status:"draft",items:form.items.map(i=>{const pr=products.find(x=>x.id===+i.productId);return{productId:+i.productId,qty:+i.qty,cost:+i.cost,sellPrice:pr?pr.price:0};}),note:form.note||"",createdBy:cu?.username||"",approval:null,approvalHistory:[],rejectionReason:"",dropShip:!!form.dropShip,dropShipCustomerId:form.dropShip?+form.dropShipCustomerId:null,linkedSO:""}]);
    addA("สร้าง PO (Draft)",pn);cM();
  };

  const submitForApproval=po=>{
    setPOs(p=>p.map(x=>x.id===po.id?{...x,status:"pending_approval"}:x));
    addA("ส่งขออนุมัติ PO",po.poNum);
  };

  const doApprove=()=>{
    if(!appModal)return;
    const{po,action}=appModal;
    const entry={approver:cu.username,approverName:cu.username,date:nowStr(),comment:appComment,signature:cu.signature||null};
    if(action==="approve"){
      if(po.dropShip&&!po.dropShipCustomerId){setWarnMsg("PO นี้เป็น drop-ship แต่ไม่มีลูกค้าปลายทาง — กรุณาแก้ไข PO ก่อนอนุมัติ");setAppModal(null);setAppComment("");return;}
      setPOs(p=>p.map(x=>x.id!==po.id?x:{...x,status:"approved",approval:entry,approvalHistory:[...(x.approvalHistory||[]),{action:"approved",...entry}]}));
      addA("อนุมัติ PO",po.poNum);
      // Drop-ship SO is no longer auto-created here — it's created per actual
      // shipment via "บันทึกการส่ง" (recordShipment), so a PO can be shipped
      // in partial rounds (backorder) until fully delivered.
    }else if(action==="reject"){
      setPOs(p=>p.map(x=>x.id!==po.id?x:{...x,status:"draft",rejectionReason:appComment,approvalHistory:[...(x.approvalHistory||[]),{action:"rejected",...entry}]}));
      addA("ปฏิเสธ PO",po.poNum+(appComment?" — "+appComment:""));
    }
    setAppModal(null);setAppComment("");cM();
  };

  const receive=po=>{
    if(po.status!=="approved"&&po.status!=="pending")return;
    if(po.dropShip){setWarnMsg("PO ส่งนอกสถานที่ ไม่ต้องรับของ — ใช้ปุ่มจัดส่งที่ SO แทน");return;}
    for(const it of po.items){const pr=products.find(p=>p.id===it.productId);if(pr)addLog(mkLog(pr.id,"in",it.qty,pr.stock,pr.stock+it.qty,po.poNum,"รับของ PO",cu.username));}
    setProducts(pp=>pp.map(pr=>{const it=po.items.find(i=>i.productId===pr.id);return it?{...pr,stock:pr.stock+it.qty}:pr;}));
    addA("รับของ PO",po.poNum);
    setPOs(p=>p.map(x=>x.id===po.id?{...x,status:"received"}:x));
    setAppModal(null);cM();
  };

  // All SO numbers linked to a PO — legacy single linkedSO + new per-shipment SOs.
  const linkedSONums=po=>[...(po.linkedSO?[po.linkedSO]:[]),...((po.shipments||[]).map(s=>s.soNum))];

  // Open "บันทึกการส่ง" — prefill each line with its remaining (un-shipped) qty.
  const openRecordShip=po=>{
    const roll=shipmentTotals(po);
    setShipForm(po.items.map(it=>{const r=roll.find(x=>x.productId===+it.productId);return{productId:+it.productId,qty:r?r.remaining:0};}));
    setShipModal(po);oM("recordShip");
  };

  // Record one partial shipment: create a right-sized SO, append the shipment,
  // and recompute PO status (approved → partial → received).
  const recordShipment=()=>{
    const po=shipModal;if(!po)return;
    const shipped=shipForm.filter(s=>+s.qty>0).map(s=>({productId:+s.productId,qty:+s.qty}));
    if(!shipped.length){setWarnMsg("กรุณาระบุจำนวนที่ส่งอย่างน้อย 1 รายการ");return;}
    const roll=shipmentTotals(po);
    for(const s of shipped){const r=roll.find(x=>x.productId===s.productId);if(r&&s.qty>r.remaining){setWarnMsg("จำนวนที่ส่งเกินยอดคงเหลือของบางรายการ");return;}}
    const roundNo=(po.shipments||[]).length+1;
    const so=buildDropshipShipmentSO(po,shipped,{sales,products,contacts},roundNo);
    setSales(p=>[...p,so]);
    const shipment={id:Date.now(),date:todayStr(),by:cu?.username||"",soNum:so.soNum,items:shipped,delivered:false};
    setPOs(p=>p.map(x=>{if(x.id!==po.id)return x;const shipments=[...(x.shipments||[]),shipment];return{...x,shipments,status:poStatusFromShipments({...x,shipments})};}));
    addA("บันทึกการส่ง (ส่งนอกสถานที่)",so.soNum+" ← "+po.poNum);
    setShipModal(null);cM();
  };

  // Close a partially-shipped PO when the supplier won't ship the remainder.
  // Only allowed when no shipment is still awaiting delivery.
  const closePartialPO=po=>{
    if((po.shipments||[]).some(s=>!s.delivered)){setWarnMsg("ยังมี SO ที่รอจัดส่ง — จัดส่งให้ครบก่อนจึงปิดรับได้");setConfirmClose(null);return;}
    setPOs(p=>p.map(x=>x.id===po.id?{...x,status:"received"}:x));
    addA("ปิดรับ PO (ส่งไม่ครบ)",po.poNum);setConfirmClose(null);cM();
  };

  const cancelPO=po=>{
    const soNums=linkedSONums(po);
    if(soNums.length){
      const done=sales.find(s=>soNums.includes(s.soNum)&&s.status==="completed");
      if(done){setWarnMsg("ไม่สามารถยกเลิก PO นี้ได้ — SO "+done.soNum+" จัดส่งแล้ว");setConfirmCancel(null);return;}
      setSales(p=>p.filter(s=>!soNums.includes(s.soNum)));addA("ลบ SO อัตโนมัติ (ยกเลิก PO)",soNums.join(", "));
    }
    setPOs(p=>p.map(x=>x.id===po.id?{...x,status:"cancelled"}:x));
    addA("ยกเลิก PO",po.poNum);setConfirmCancel(null);cM();
  };

  const deletePO=po=>{
    const soNums=linkedSONums(po);
    if(soNums.length){setSales(p=>p.filter(s=>!soNums.includes(s.soNum)));addA("ลบ SO (พร้อม PO)",soNums.join(", "));}
    const poPays=payments.filter(p=>p.refId===po.poNum&&p.type==="ap");
    if(poPays.length){
      setPayments(prev=>prev.filter(p=>!(p.refId===po.poNum&&p.type==="ap")));
      setBankTxns(prev=>prev.filter(t=>!poPays.some(p=>t.refId===p.refId&&Math.abs(t.amount-p.amount)<0.01&&t.date===p.date&&t.type==="out")));
      setCheques(prev=>prev.filter(c=>!poPays.some(p=>p.method==="เช็ค"&&p.chequeNo&&c.chequeNo===p.chequeNo&&c.refId===p.refId)));
    }
    setPOs(p=>p.filter(x=>x.id!==po.id));
    addA("ลบ PO (Admin)",po.poNum);setConfirmDelPO(null);cM();
  };

  const openEditPO=po=>{
    setForm({supplierId:String(po.supplierId),date:po.date,deliveryDate:po.deliveryDate||"",creditDays:po.creditDays||0,items:po.items.map(i=>({productId:String(i.productId),qty:i.qty,cost:i.cost})),note:po.note||"",dropShip:!!po.dropShip,dropShipCustomerId:po.dropShipCustomerId?String(po.dropShipCustomerId):""});
    setEditPO(po);oM("editPO");
  };
  const updatePO=()=>{
    if(!form.supplierId||form.items.some(i=>!i.productId))return;
    if(form.dropShip&&!form.dropShipCustomerId){setWarnMsg("กรุณาเลือกลูกค้าปลายทางสำหรับส่งนอกสถานที่");return;}
    const base={supplierId:+form.supplierId,date:form.date,deliveryDate:form.deliveryDate||"",creditDays:+form.creditDays||0,items:form.items.map(i=>{const pr=products.find(x=>x.id===+i.productId);return{productId:+i.productId,qty:+i.qty,cost:+i.cost,sellPrice:pr?pr.price:0};}),note:form.note||"",dropShip:!!form.dropShip,dropShipCustomerId:form.dropShip?+form.dropShipCustomerId:null};
    setPOs(p=>p.map(x=>x.id===editPO.id?{...x,...base}:x));
    addA("แก้ไข PO",editPO.poNum);setEditPO(null);cM();
  };

  const openApproval=(po,action)=>{setAppModal({po,action});setAppComment("");oM("appModal");};

  const canApproveThis=po=>canApprovePO&&po.status==="pending_approval"&&(isAdmin||cu?.role==="SalesManager"||po.createdBy!==cu?.username);

  const AB={padding:"4px 10px",fontSize:11,borderRadius:6,cursor:"pointer",marginRight:4,fontFamily:"inherit"};
  // Normal edit: draft + ownership/editor.
  const canEditDraftPO=po=>!isSup&&po.status==="draft"&&(po.createdBy===cu?.username||ed);
  // Admin bypass: PO ที่รับของแล้ว — stock NOT auto-adjusted (warning in form + distinct button).
  const canAdminEditReceivedPO=po=>!isSup&&isAdmin&&po.status==="received";
  const rowActions=po=>{
    const a=[];
    a.push(<button key="v" onClick={()=>{setViewPO(po);oM("viewPO");}} style={{...AB,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)"}}>ดู</button>);
    if(canEditDraftPO(po))
      a.push(<button key="edit" onClick={()=>openEditPO(po)} style={{...AB,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.12)",color:"var(--orange)"}}>แก้ไข</button>);
    if(canAdminEditReceivedPO(po))
      a.push(<button key="edit-admin" onClick={()=>openEditPO(po)} title="แก้ไข PO ที่รับของแล้ว — สต็อกไม่ปรับอัตโนมัติ" style={{...AB,border:"1px solid var(--purple)",background:"rgba(175,82,222,0.12)",color:"var(--purple)"}}>แก้ไข (admin)</button>);
    if(po.status==="draft"&&(po.createdBy===cu?.username||ed)&&!isSup)
      a.push(<button key="sub" onClick={()=>submitForApproval(po)} style={{...AB,border:"1px solid var(--orange)",background:"rgba(255,149,0,0.12)",color:"var(--orange)"}}>ส่งขออนุมัติ</button>);
    if(canApproveThis(po)){
      a.push(<button key="app" onClick={()=>openApproval(po,"approve")} style={{...AB,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>อนุมัติ</button>);
      a.push(<button key="rej" onClick={()=>openApproval(po,"reject")} style={{...AB,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)"}}>ปฏิเสธ</button>);
    }
    if((po.status==="approved"||po.status==="pending")&&ed&&!isSup&&!po.dropShip)
      a.push(<button key="rec" onClick={()=>openApproval(po,"receive")} style={{...AB,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>รับของ</button>);
    // Legacy drop-ship (auto-SO already created): keep the old static badge.
    if(po.dropShip&&po.linkedSO&&po.status==="approved")
      a.push(<span key="ds" style={{...AB,border:"1px solid var(--blue)",background:"rgba(10,132,255,0.08)",color:"var(--blue)",cursor:"default"}}>{"รอจัดส่ง SO"}</span>);
    // New drop-ship flow: record partial shipments / close the backorder.
    if(po.dropShip&&!po.linkedSO&&ed&&!isSup&&(po.status==="approved"||po.status==="partial")){
      const remain=shipmentTotals(po).reduce((s,r)=>s+r.remaining,0);
      const pending=(po.shipments||[]).some(s=>!s.delivered);
      if(remain>0)
        a.push(<button key="ship" onClick={()=>openRecordShip(po)} style={{...AB,border:"1px solid var(--green)",background:"rgba(52,199,89,0.12)",color:"var(--green)"}}>บันทึกการส่ง</button>);
      if(po.status==="partial"&&!pending&&remain>0)
        a.push(<button key="close" onClick={()=>setConfirmClose(po)} style={{...AB,border:"1px solid var(--dim)",background:"var(--hover)",color:"var(--dim)"}}>ปิดรับ</button>);
    }
    if((isAdmin||(po.status==="draft"&&po.createdBy===cu?.username))&&!["received","cancelled"].includes(po.status)&&!isSup)
      a.push(<button key="can" onClick={()=>setConfirmCancel(po)} style={{...AB,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)"}}>ยกเลิก</button>);
    if(isAdmin&&!isSup)
      a.push(<button key="del" onClick={()=>setConfirmDelPO(po)} style={{...AB,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",marginRight:0}}>ลบ</button>);
    return a;
  };

  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
      <StatCard label="PO ทั้งหมด" value={stats.total} color="var(--blue)" accentBg="var(--blue-bg)"/>
      <StatCard label="รออนุมัติ" value={stats.pa} color="var(--orange)" accentBg="rgba(255,149,0,0.14)"/>
      <StatCard label="รับแล้ว" value={stats.recv} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
      <StatCard label="มูลค่ารวม" value={"฿"+fmt(stats.totAmt)} color="var(--green)" accentBg="rgba(52,199,89,0.12)"/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <SB value={search} onChange={setSearch} placeholder="ค้นหา PO..."/>
      {ed&&!isSup&&<Btn onClick={()=>{setForm(ef);oM("addPO");}}>{"+ สร้าง PO"}</Btn>}
    </div>

    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {STATUS_TABS.filter(t=>t.key==="all"||counts[t.key]>0).map(t=>{
        const cnt=t.key==="all"?basePOs.length:(counts[t.key]||0);
        const active=statusFilter===t.key;
        return <button key={t.key} onClick={()=>setStatusFilter(t.key)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:"1.5px solid "+(active?"var(--blue)":"var(--line)"),background:active?"var(--blue)":"transparent",color:active?"#fff":"var(--dim)",fontWeight:active?600:400}}>
          {t.label}{cnt>0&&<span style={{marginLeft:4,background:active?"rgba(255,255,255,0.3)":"var(--hover)",color:active?"#fff":"var(--faint)",borderRadius:99,padding:"0 5px",fontSize:10}}>{cnt}</span>}
        </button>;
      })}
    </div>

    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
        <thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["PO No.","Supplier","วันที่","รวม","สถานะ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px 6px",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(po=>{
          const sup=contacts.find(c=>c.id===po.supplierId);
          const wasRejected=(po.approvalHistory||[]).some(h=>h.action==="rejected")&&po.status==="draft";
          return <tr key={po.id} style={{borderBottom:"0.5px solid var(--line)",background:wasRejected?"rgba(255,149,0,0.14)":""}}>
            <td style={{padding:"8px 6px",fontWeight:500}}>
              {po.poNum}
              {wasRejected&&<span style={{marginLeft:6,fontSize:10,color:"var(--red)",background:"rgba(255,59,48,0.12)",borderRadius:4,padding:"1px 5px"}}>ถูกปฏิเสธ</span>}
              {po.dropShip&&<span style={{marginLeft:6,fontSize:10,color:"var(--blue)",background:"rgba(10,132,255,0.12)",borderRadius:4,padding:"1px 6px",fontWeight:500}}>{"ส่งนอกสถานที่"}</span>}
              {linkedSONums(po).map(sn=><span key={sn} onClick={e=>{e.stopPropagation();sh.handleTab("sales");sh.setSearch(sn);}} style={{marginLeft:4,fontSize:10,color:"var(--green)",background:"rgba(52,199,89,0.12)",borderRadius:4,padding:"1px 6px",fontWeight:500,cursor:"pointer"}}>{"→ "+sn}</span>)}
            </td>
            <td style={{padding:"8px 6px"}}>{sup?cN(sup):"-"}</td>
            <td style={{padding:"8px 6px",color:"var(--dim)"}}>{toBE(po.date)}</td>
            <td style={{padding:"8px 6px"}}>{"฿"+fmt(poTot(po))}</td>
            <td style={{padding:"8px 6px"}}>
              <Badge status={po.status}/>
              {po.status==="pending_approval"&&<div style={{fontSize:10,color:"var(--orange)",marginTop:2}}>รอผู้มีสิทธิ์อนุมัติ</div>}
            </td>
            <td style={{padding:"8px 6px",whiteSpace:"nowrap"}}>{rowActions(po)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {(modal==="addPO"||modal==="editPO")&&ed&&!isSup&&<Modal title={editPO?"แก้ไข — "+editPO.poNum:"สร้าง PO ใหม่"} onClose={()=>{setEditPO(null);cM();}}>
      <div className="form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Field label="ซัพพลายเออร์"><CustomSelect searchable value={form.supplierId} onChange={v=>setForm(f=>({...f,supplierId:v}))} options={[{value:"",label:"เลือก..."},...sups.map(s=>({value:String(s.id),label:cN(s)}))]}/></Field>
        <Field label="วันที่"><ThaiDateInput value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></Field>
        <Field label="วันกำหนดส่ง"><ThaiDateInput value={form.deliveryDate||""} onChange={e=>setForm(f=>({...f,deliveryDate:e.target.value}))}/></Field>
        <Field label="เครดิต (วันจ่าย)"><select value={form.creditDays||0} onChange={e=>setForm(f=>({...f,creditDays:+e.target.value}))} style={{width:"100%",boxSizing:"border-box",background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:7,padding:"7px 12px",fontSize:13,color:"var(--text)",fontFamily:"inherit"}}><option value={0}>จ่ายทันที</option><option value={30}>30 วัน</option><option value={45}>45 วัน</option><option value={60}>60 วัน</option><option value={90}>90 วัน</option></select></Field>
        <div style={{gridColumn:"1/-1"}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(form.dropShip?"var(--blue)":"var(--line)"),background:form.dropShip?"rgba(10,132,255,0.08)":"var(--hover)"}}>
            <input type="checkbox" checked={!!form.dropShip} onChange={e=>setForm(f=>({...f,dropShip:e.target.checked,dropShipCustomerId:e.target.checked?f.dropShipCustomerId:""}))}/>
            <span style={{fontSize:13,fontWeight:form.dropShip?600:400,color:form.dropShip?"var(--blue)":"var(--dim)"}}>{"ส่งนอกสถานที่ (Drop Ship)"}</span>
          </label>
        </div>
        {form.dropShip&&<div style={{gridColumn:"1/-1"}}><Field label="ลูกค้าที่รับของ"><CustomSelect searchable value={form.dropShipCustomerId} onChange={v=>setForm(f=>({...f,dropShipCustomerId:v}))} options={[{value:"",label:"เลือกลูกค้า..."},...custs.map(c=>({value:String(c.id),label:cN(c)}))]}/></Field></div>}
        {form.dropShip&&<div style={{gridColumn:"1/-1",background:"rgba(10,132,255,0.08)",border:"1px solid var(--blue)",borderRadius:6,padding:"8px 12px",fontSize:12,color:"var(--blue)"}}>{"เมื่ออนุมัติแล้ว → ใช้ปุ่ม “บันทึกการส่ง” สร้างใบขาย (SO) ตามจำนวนที่ส่งจริงแต่ละรอบ (รองรับส่งบางส่วน/ค้างไว้)"}</div>}
      </div>
      {form.items.map((item,idx)=><div key={idx} style={{marginBottom:10,padding:"10px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
        <div className="item-form-row" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,alignItems:"center"}}>
          <CustomSelect searchable value={item.productId} onChange={v=>setIt(idx,"productId",v)} options={[{value:"",label:"เลือกสินค้า..."},...(()=>{const sup=contacts.find(c=>c.id===+form.supplierId);const lb=sup&&sup.linkedBrands&&sup.linkedBrands.length>0?sup.linkedBrands:null;const base=lb?products.filter(pr=>lb.includes(pr.brand)):products;return base.filter(pr=>!pr.discontinued||+item.productId===pr.id).map(pr=>({value:String(pr.id),label:pr.brand+" — "+pN(pr),searchText:pr.code||""}));})()]}/>
          <input type="number" min="1" placeholder="Qty" value={item.qty} onChange={e=>setIt(idx,"qty",e.target.value)} style={IB}/>
          <input type="number" min="0" placeholder="ราคา/หน่วย" value={item.cost} onChange={e=>setIt(idx,"cost",e.target.value)} style={IB}/>
          <span onClick={()=>rmItem(idx)} style={{cursor:"pointer",color:"var(--red)",fontSize:20}}>{"×"}</span>
        </div>
      </div>)}
      <button onClick={addItem} style={{fontSize:12,padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--line)",cursor:"pointer",background:"transparent",marginBottom:12}}>{"+ เพิ่ม"}</button>
      <Field label="หมายเหตุ"><textarea value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={{...IB,height:56,resize:"vertical"}} placeholder="หมายเหตุ / เงื่อนไข..."/></Field>
      {!editPO&&<div style={{background:"rgba(255,149,0,0.14)",border:"1px solid var(--orange)",borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:12,color:"var(--orange)"}}>
        {"PO จะบันทึกเป็น Draft — กด \"ส่งขออนุมัติ\" ในตารางเพื่อเริ่มขั้นตอนการอนุมัติ"}
      </div>}
      {editPO&&editPO.status==="received"&&<div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:12,color:"var(--red)",fontWeight:500}}>
        {"⚠ PO นี้รับของแล้ว — แก้ไขจะไม่ปรับสต็อกอัตโนมัติ ต้องปรับ stock log เองถ้าจำนวน/รายการเปลี่ยน"}
      </div>}
      <MBtns onCancel={()=>{setEditPO(null);cM();}} onSave={editPO?updatePO:savePO} saveLabel={editPO?"บันทึก":"บันทึก Draft"}/>
    </Modal>}

    {modal==="viewPO"&&viewPO&&<Modal title={viewPO.poNum} onClose={cM} wide>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{(()=>{const s=contacts.find(c=>c.id===viewPO.supplierId);return s?cN(s):"-";})()}</div>
          <div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>{"วันที่: "+toBE(viewPO.date)+" · สร้างโดย: "+(viewPO.createdBy||"-")}</div>
          {viewPO.deliveryDate&&<div style={{fontSize:12,color:"var(--blue)",marginTop:2}}>{"กำหนดส่ง: "+toBE(viewPO.deliveryDate)}</div>}
        </div>
        <Badge status={viewPO.status}/>
      </div>
      {viewPO.dropShip&&<div style={{background:"rgba(10,132,255,0.08)",border:"1px solid var(--blue)",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12}}>
        <div style={{fontWeight:600,color:"var(--blue)",marginBottom:4}}>{"ส่งนอกสถานที่ (Drop Ship)"}</div>
        <div style={{color:"var(--dim)"}}>{"ลูกค้าที่รับของ: "}<span style={{fontWeight:500,color:"var(--text)"}}>{(()=>{const c=contacts.find(x=>x.id===viewPO.dropShipCustomerId);return c?cN(c):"-";})()}</span></div>
        {linkedSONums(viewPO).length>0&&<div style={{marginTop:4}}>{"SO: "}{linkedSONums(viewPO).map((sn,i)=><span key={sn}>{i>0?", ":""}<span onClick={()=>{cM();sh.handleTab("sales");sh.setSearch(sn);}} style={{color:"var(--green)",fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>{sn}</span></span>)}</div>}
      </div>}

      {viewPO.shipments&&viewPO.shipments.length>0&&<div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>{"การส่ง (ส่งบางส่วน)"}</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:8}}>
          <thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["สินค้า","สั่ง","ส่งแล้ว","รับแล้ว","คงเหลือ"].map(h=><th key={h} style={{padding:"4px 6px",textAlign:"left",fontWeight:500,color:"var(--dim)"}}>{h}</th>)}</tr></thead>
          <tbody>{shipmentTotals(viewPO).map(r=>{const pr=products.find(x=>+x.id===r.productId);return <tr key={r.productId} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"4px 6px"}}>{pr?pN(pr):r.productId}</td><td style={{padding:"4px 6px"}}>{r.ordered}</td><td style={{padding:"4px 6px"}}>{r.committed}</td><td style={{padding:"4px 6px",color:"var(--green)"}}>{r.received}</td><td style={{padding:"4px 6px",color:r.remaining>0?"var(--orange)":"var(--dim)"}}>{r.remaining}</td></tr>;})}</tbody>
        </table>
        {viewPO.shipments.map((s,i)=><div key={s.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,padding:"5px 0",borderTop:i>0?"0.5px solid var(--line)":"none"}}>
          <span>{"รอบ "+(i+1)+" · "+toBE(s.date)+" · "}<span onClick={()=>{cM();sh.handleTab("sales");sh.setSearch(s.soNum);}} style={{color:"var(--green)",fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>{s.soNum}</span>{" · "+(s.items||[]).reduce((a,it)=>a+it.qty,0)+" ชิ้น"}</span>
          <span style={{fontSize:10,padding:"1px 8px",borderRadius:99,background:s.delivered?"rgba(52,199,89,0.12)":"var(--blue-bg)",color:s.delivered?"var(--green)":"var(--blue)",fontWeight:500}}>{s.delivered?"จัดส่งแล้ว":"รอจัดส่ง"}</span>
        </div>)}
      </div>}

      {viewPO.rejectionReason&&viewPO.status==="draft"&&<div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:12,color:"var(--red)"}}>{"ถูกปฏิเสธ: "+viewPO.rejectionReason}</div>}

      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}>
        <thead><tr style={{borderBottom:"0.5px solid var(--line)"}}>{["สินค้า","Qty","ต้นทุน/หน่วย","รวม"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
        <tbody>{viewPO.items.map((it,i)=>{const pr=products.find(x=>x.id===it.productId);return <tr key={i} style={{borderBottom:"0.5px solid var(--line)"}}><td style={{padding:"6px 8px"}}>{pr?pN(pr):"-"}</td><td style={{padding:"6px 8px"}}>{it.qty}</td><td style={{padding:"6px 8px"}}>{"฿"+fmt(it.cost)}</td><td style={{padding:"6px 8px",fontWeight:500}}>{"฿"+fmt(it.qty*it.cost)}</td></tr>;})}
        </tbody>
      </table>
      <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15}}><span>ยอดรวม</span><span style={{color:"var(--green)"}}>{"฿"+fmt(poTot(viewPO))}</span></div>
        <div style={{fontSize:12,color:"var(--dim)",marginTop:4}}>{viewPO.items.length+" รายการ · "+viewPO.items.reduce((s,i)=>s+i.qty,0)+" ชิ้น"}</div>
      </div>
      {viewPO.note&&<div style={{fontSize:12,color:"var(--dim)",marginBottom:12,padding:"8px 10px",background:"var(--panel)",borderRadius:6,border:"0.5px solid var(--line)"}}>{viewPO.note}</div>}

      {viewPO.approval&&<div style={{marginBottom:16,padding:"10px 14px",background:"rgba(52,199,89,0.08)",border:"1px solid var(--green)",borderRadius:8}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <span style={{fontSize:16}}>{"OK"}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:500}}>{"อนุมัติโดย: "+viewPO.approval.approverName}</div>
            <div style={{fontSize:11,color:"var(--dim)"}}>{fmtD(viewPO.approval.date)}</div>
            {viewPO.approval.comment&&<div style={{fontSize:11,color:"var(--dim)",marginTop:2,fontStyle:"italic"}}>{"\""+viewPO.approval.comment+"\""}</div>}
            {viewPO.approval.signature&&<img src={viewPO.approval.signature} alt="sig" style={{height:40,marginTop:4,border:"1px solid var(--line)",borderRadius:4}}/>}
          </div>
        </div>
      </div>}

      {(viewPO.approvalHistory||[]).filter(h=>h.action==="rejected").length>0&&<div style={{marginBottom:16}}>
        <div style={{fontWeight:500,fontSize:13,marginBottom:6}}>ประวัติการปฏิเสธ</div>
        {(viewPO.approvalHistory||[]).filter(h=>h.action==="rejected").map((h,i)=><div key={i} style={{padding:"8px 12px",background:"rgba(255,59,48,0.08)",borderRadius:8,border:"1px solid var(--red)",marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:500,color:"var(--red)"}}>{"ปฏิเสธโดย "+h.approverName+" · "+fmtD(h.date)}</div>
          {h.comment&&<div style={{fontSize:11,color:"var(--dim)",marginTop:2,fontStyle:"italic"}}>{"\""+h.comment+"\""}</div>}
        </div>)}
      </div>}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
        {canEditDraftPO(viewPO)&&
          <button onClick={()=>{cM();openEditPO(viewPO);}} style={{padding:"8px 18px",background:"var(--orange)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"แก้ไข"}</button>}
        {canAdminEditReceivedPO(viewPO)&&
          <button onClick={()=>{cM();openEditPO(viewPO);}} title="แก้ไข PO ที่รับของแล้ว — สต็อกไม่ปรับอัตโนมัติ" style={{padding:"8px 18px",background:"var(--purple)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"แก้ไข (admin)"}</button>}
        <button onClick={()=>printDoc("po",viewPO,products,contacts)} style={{padding:"8px 18px",background:"var(--text)",color:"var(--bg)",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"พิมพ์ / PDF"}</button>
        {viewPO.status==="draft"&&(viewPO.createdBy===cu?.username||ed)&&!isSup&&
          <button onClick={()=>{submitForApproval(viewPO);cM();}} style={{padding:"8px 18px",background:"var(--orange)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"ส่งขออนุมัติ"}</button>}
        {canApproveThis(viewPO)&&<>
          <button onClick={()=>{setViewPO(null);openApproval(viewPO,"approve");}} style={{padding:"8px 18px",background:"var(--green)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"อนุมัติ"}</button>
          <button onClick={()=>{setViewPO(null);openApproval(viewPO,"reject");}} style={{padding:"8px 18px",background:"var(--red)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"ปฏิเสธ"}</button>
        </>}
        {(viewPO.status==="approved"||viewPO.status==="pending")&&ed&&!isSup&&!viewPO.dropShip&&
          <button onClick={()=>{setViewPO(null);openApproval(viewPO,"receive");}} style={{padding:"8px 18px",background:"var(--blue)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"รับของ"}</button>}
        {viewPO.dropShip&&!viewPO.linkedSO&&ed&&!isSup&&(viewPO.status==="approved"||viewPO.status==="partial")&&shipmentTotals(viewPO).reduce((s,r)=>s+r.remaining,0)>0&&
          <button onClick={()=>{const po=viewPO;setViewPO(null);openRecordShip(po);}} style={{padding:"8px 18px",background:"var(--green)",color:"#fff",border:"none",borderRadius:7,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{"บันทึกการส่ง"}</button>}
      </div>
      <MBtns onCancel={cM}/>
    </Modal>}

    {modal==="appModal"&&appModal&&<Modal title={
      appModal.action==="approve"?"อนุมัติ PO":
      appModal.action==="reject"?"ปฏิเสธ PO":
      "ยืนยันรับของ"
    } onClose={()=>{setAppModal(null);cM();}}>
      {appModal.action!=="receive"?<>
        <div style={{fontWeight:500,fontSize:13,marginBottom:4}}>{appModal.po.poNum} · ฿{fmt(poTot(appModal.po))}</div>
        {appModal.action==="approve"&&appModal.po.createdBy&&<div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>{"สร้างโดย: "+appModal.po.createdBy}</div>}
        {(()=>{const sup=contacts.find(c=>c.id===appModal.po.supplierId);return sup?<div style={{fontSize:12,color:"var(--dim)",marginBottom:8}}>{"ซัพพลายเออร์: "+cN(sup)}</div>:null;})()}
        <div style={{overflowX:"auto",marginBottom:12,border:"1px solid var(--line)",borderRadius:8}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"var(--bg)"}}>
              {["สินค้า","จำนวน","ราคา/หน่วย","รวม"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)"}}>{h}</th>)}
            </tr></thead>
            <tbody>{(appModal.po.items||[]).map((it,i)=>{const pr=products.find(x=>x.id===it.productId);return<tr key={i} style={{borderBottom:"0.5px solid var(--line)"}}>
              <td style={{padding:"6px 10px",fontWeight:500}}>{pr?pr.brand+" — "+pN(pr):"-"}</td>
              <td style={{padding:"6px 10px"}}>{it.qty}</td>
              <td style={{padding:"6px 10px"}}>{"฿"+fmt(it.cost)}</td>
              <td style={{padding:"6px 10px",fontWeight:600}}>{"฿"+fmt(it.qty*it.cost)}</td>
            </tr>;})}
            <tr style={{background:"var(--bg)",fontWeight:600}}>
              <td colSpan={3} style={{padding:"6px 10px",textAlign:"right",color:"var(--dim)"}}>รวมทั้งหมด</td>
              <td style={{padding:"6px 10px"}}>{"฿"+fmt(poTot(appModal.po))}</td>
            </tr></tbody>
          </table>
        </div>
        {cu?.signature?<div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:"var(--dim)",marginBottom:4}}>ลายเซ็นต์ของคุณ:</div>
          <img src={cu.signature} alt="sig" style={{height:50,border:"1px solid var(--line)",borderRadius:6,maxWidth:180}}/>
        </div>:<div style={{background:"rgba(255,149,0,0.14)",border:"1px solid var(--orange)",borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:12,color:"var(--orange)"}}>{"ยังไม่มีลายเซ็นต์ — ไปที่ จัดการ User เพื่ออัปโหลด"}</div>}
        <Field label={appModal.action==="reject"?"เหตุผลการปฏิเสธ (จำเป็น)":"ความคิดเห็น (ถ้ามี)"}>
          <textarea value={appComment} onChange={e=>setAppComment(e.target.value)} style={{...IB,height:70,resize:"vertical"}} placeholder={appModal.action==="reject"?"ระบุเหตุผล...":"(ไม่จำเป็น)"}/>
        </Field>
        <MBtns onCancel={()=>{setAppModal(null);cM();}} onSave={doApprove} saveLabel={appModal.action==="reject"?"ยืนยันปฏิเสธ":"ยืนยันอนุมัติ"}/>
      </>:<>
        <div style={{background:"rgba(52,199,89,0.12)",border:"1px solid var(--green)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}>
          <strong>ยืนยันรับของ — สต็อกจะเพิ่มทันที</strong>
          <div style={{marginTop:4,fontSize:12,color:"var(--dim)"}}>{appModal.po.poNum} · ฿{fmt(poTot(appModal.po))}</div>
        </div>
        <MBtns onCancel={()=>{setAppModal(null);cM();}} onSave={()=>receive(appModal.po)} saveLabel="ยืนยันรับของ"/>
      </>}
    </Modal>}

    {modal==="recordShip"&&shipModal&&<Modal title={"บันทึกการส่ง — "+shipModal.poNum} onClose={()=>{setShipModal(null);cM();}}>
      <div style={{fontSize:12,color:"var(--dim)",marginBottom:10}}>{"ใส่จำนวนที่ส่งจริงรอบนี้ (ค่าเริ่มต้น = คงเหลือ) — ระบบจะสร้าง SO ตามจำนวนนี้ ส่วนที่เหลือค้างไว้รอรอบถัดไป"}</div>
      {(()=>{const roll=shipmentTotals(shipModal);return shipModal.items.map((it,idx)=>{const pr=products.find(x=>+x.id===+it.productId);const r=roll.find(x=>x.productId===+it.productId);const remain=r?r.remaining:0;const sf=shipForm.find(x=>x.productId===+it.productId);return <div key={idx} style={{marginBottom:8,padding:"8px 12px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pr?(pr.brand+" — "+pN(pr)):it.productId}</div>
            <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>{"สั่ง "+it.qty+" · ส่งแล้ว "+(r?r.committed:0)+" · คงเหลือ "+remain}</div>
          </div>
          <input type="number" min="0" max={remain} value={sf?sf.qty:0} onChange={e=>{const v=e.target.value;setShipForm(f=>f.map(x=>x.productId===+it.productId?{...x,qty:v}:x));}} style={{...IB,width:80,flex:"none"}}/>
        </div>
      </div>;});})()}
      <MBtns onCancel={()=>{setShipModal(null);cM();}} onSave={recordShipment} saveLabel="สร้าง SO + บันทึกการส่ง"/>
    </Modal>}

    {confirmClose&&<Modal title="ปิดรับ PO" onClose={()=>setConfirmClose(null)}>
      <div style={{background:"rgba(255,149,0,0.12)",border:"1px solid var(--orange)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--orange)"}}>{"ปิดรับ "+confirmClose.poNum+" โดยไม่รอส่วนที่เหลือ? PO จะถูกตั้งเป็น “รับแล้ว” ตามจำนวนที่ส่งจริง"}</div>
      <MBtns onCancel={()=>setConfirmClose(null)} onSave={()=>closePartialPO(confirmClose)} saveLabel="ปิดรับ"/>
    </Modal>}

    {confirmCancel&&<Modal title="ยกเลิก PO" onClose={()=>setConfirmCancel(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--red)"}}>{"ยืนยันยกเลิก "+confirmCancel.poNum+"?"}</div>
      <MBtns onCancel={()=>setConfirmCancel(null)} onSave={()=>cancelPO(confirmCancel)} saveLabel="ยกเลิก PO"/>
    </Modal>}

    {confirmDelPO&&<Modal title="ยืนยันลบ PO" onClose={()=>setConfirmDelPO(null)}>
      <div style={{background:"rgba(255,59,48,0.12)",border:"1px solid var(--red)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:13,color:"var(--red)"}}>
        {"จะลบ "+confirmDelPO.poNum+" ถาวร"}
        {linkedSONums(confirmDelPO).length>0&&<div style={{marginTop:6,fontWeight:600}}>{"SO ที่เชื่อมโยง ("+linkedSONums(confirmDelPO).join(", ")+") จะถูกลบด้วย"}</div>}
      </div>
      <MBtns onCancel={()=>setConfirmDelPO(null)} onSave={()=>deletePO(confirmDelPO)} saveLabel="ลบถาวร"/>
    </Modal>}

    {warnMsg&&<Modal title="แจ้งเตือน" onClose={()=>setWarnMsg(null)}>
      <div style={{background:"rgba(255,149,0,0.12)",border:"1px solid var(--orange)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:14,color:"var(--orange)",fontWeight:500}}>{warnMsg}</div>
      <button onClick={()=>setWarnMsg(null)} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:"var(--blue)",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>ตกลง</button>
    </Modal>}
  </div>;
}

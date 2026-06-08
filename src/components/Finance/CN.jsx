import { useState, useMemo } from "react";
import { IB } from "../../utils/constants.js";
import { fmt, todayStr, toBE, mkLog, round2 } from "../../utils/helpers.js";
import { Modal, MBtns } from "../ui/Modal.jsx";
import StatCard from "../ui/StatCard.jsx";
import Field from "../ui/Field.jsx";
import CustomSelect from "../ui/CustomSelect.jsx";
import ThaiDateInput from "../ui/ThaiDateInput.jsx";
import { CN_TYPES } from "./constants.js";

// ใบลดหนี้ลูกค้า (Customer Credit Notes) — sub-tab of Finance
// Extracted from Finance.jsx in 2026-06-08 as part of incremental Finance split (Strategy C, รอบ 4)
// Cross-tab deps received from parent:
// - setViewSO: cross-tab nav (SO link in list + viewCN modal)
// - setViewBill: cross-tab nav ("ใช้แล้ว" badge → opens viewBill modal in parent)
// - setSub: cross-tab nav (navigate to billing)
// - setWarnMsg: validation errors in saveCN
// - cnTot: helper (needs sales+discount, kept in parent)
// - cN: contact-name helper
export default function CN({sh, setViewSO, setViewBill, setSub, setWarnMsg, search, setSearch, cN, cnTot}){
  const{pN,contacts,sales,payments,products,setProducts,canE,canD,modal,oM,cM,cnotes,setCNotes,addLog,defectives,setDefectives,cu,billings}=sh;
  const ed=canE("finance");const cd=canD("finance");

  const[cnFilter,setCnFilter]=useState("all");
  const[viewCN,setViewCN]=useState(null);
  const[cnForm,setCnForm]=useState({type:"return",customerId:"",soNum:"",date:todayStr(),items:[],amount:"",reason:"",note:""});

  const cnList=useMemo(()=>{let cl=cnFilter==="all"?cnotes:cnotes.filter(c=>c.type===cnFilter);if(search){const q=search.toLowerCase();cl=cl.filter(cn=>{const cu2=contacts.find(c=>c.id===cn.customerId);return(cn.cnNum||"").toLowerCase().includes(q)||(cu2?cN(cu2):"").toLowerCase().includes(q)||(cn.soNum||"").toLowerCase().includes(q);});}return[...cl].reverse();},[cnotes,cnFilter,search,contacts,cN]);

  const openNewCN=()=>{setCnForm({type:"return",customerId:"",soNum:"",date:todayStr(),items:[],amount:"",reason:"",note:""});oM("addCN");};
  const openEditCN=cn=>{
    const items=cn.items||[];let adjItems=items;
    if(cn.type==="return"&&cn.soNum){
      const so=sales.find(s=>s.soNum===cn.soNum);
      if(so){const sub=(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const d=so.discountAmt||0;const r=sub>0?(sub-d)/sub:1;adjItems=items.map(it=>{const si=(so.items||[]).find(x=>x.productId===it.productId);return{...it,price:si?round2(si.price*r):it.price};});}
    }
    setCnForm({...cn,amount:String(cn.type==="promo"?cn.amount:""),items:adjItems});oM("addCN");
  };
  const delCN=cn=>{
    if(!confirm("ยืนยันลบใบลดหนี้ "+cn.cnNum+" ?"))return;
    if(cn.type==="return"&&cn.items){
      for(const it of cn.items){const pr=products.find(p=>p.id===it.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===it.productId?{...p,stock:p.stock-it.qty}:p));addLog(mkLog(it.productId,"cn_cancel",it.qty,bef,Math.max(0,bef-it.qty),cn.cnNum,"ยกเลิก CN",cu?.username));}
    }
    if(cn.type==="defective"&&cn.defectiveId)setDefectives(p=>p.map(d=>d.id===cn.defectiveId?{...d,custStatus:"pending"}:d));
    setCNotes(p=>p.filter(c=>c.id!==cn.id));
  };

  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}} className="stat-grid-4">
      <StatCard label="ใบลดหนี้ทั้งหมด" value={cnotes.length}/>
      <StatCard label="คืนสินค้า" value={cnotes.filter(c=>c.type==="return").length} color="var(--blue)" accentBg="var(--blue-bg)"/>
      <StatCard label="สินค้าชำรุด" value={cnotes.filter(c=>c.type==="defective").length} color="var(--orange)" accentBg="rgba(255,149,0,0.14)"/>
      <StatCard label="ยอดรวม CN" value={"฿"+fmt(cnotes.reduce((s,c)=>s+cnTot(c),0))} color="var(--red)" accentBg="rgba(255,59,48,0.12)"/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[{key:"all",label:"ทั้งหมด"},...CN_TYPES].map(v=><button key={v.key} onClick={()=>setCnFilter(v.key)} style={{fontSize:12,padding:"5px 12px",borderRadius:99,border:"1px solid "+(cnFilter===v.key?"var(--text)":"var(--line)"),background:cnFilter===v.key?"var(--text)":"transparent",color:cnFilter===v.key?"var(--bg)":"var(--dim)",cursor:"pointer"}}>{v.label}</button>)}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{...IB,width:160,padding:"5px 10px",fontSize:12}}/>{ed&&<button onClick={openNewCN} style={{padding:"6px 14px",fontSize:12,borderRadius:7,border:"none",background:"var(--blue)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบลดหนี้</button>}</div>
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:"0.5px solid var(--line)",background:"var(--bg)"}}>{["เลขที่ CN","ประเภท","ลูกค้า","อ้างอิง SO","วันที่","ยอด","สถานะ","หมายเหตุ",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"8px",fontWeight:500,color:"var(--dim)",fontSize:12}}>{h}</th>)}</tr></thead>
    <tbody>{cnList.length===0?<tr><td colSpan={9} style={{padding:"3rem 2rem",textAlign:"center"}}><div style={{color:"var(--dim)",fontSize:28,marginBottom:6}}>---</div><div style={{color:"var(--faint)",fontSize:13,marginBottom:10}}>ยังไม่มีใบลดหนี้</div>{ed&&<button onClick={openNewCN} style={{padding:"6px 16px",fontSize:12,borderRadius:7,border:"1px solid var(--blue)",background:"var(--blue-bg)",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>+ สร้างใบลดหนี้แรก</button>}</td></tr>:cnList.map(cn=>{
      const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];
      const cust=contacts.find(c=>c.id===cn.customerId);
      const tot=cnTot(cn);
      const usedBill=billings.find(b=>(b.cnIds||[]).includes(cn.id));
      return<tr key={cn.id} style={{borderBottom:"0.5px solid var(--line)"}}>
        <td style={{padding:"8px",fontWeight:500,color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setViewCN(cn)}>{cn.cnNum}</td>
        <td style={{padding:"8px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:tp.bg,color:tp.color}}>{tp.label}</span></td>
        <td style={{padding:"8px"}}>{cust?cN(cust):"—"}</td>
        <td style={{padding:"8px",fontSize:12}}>{cn.soNum?<span style={{color:"var(--blue)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const so=sales.find(s=>s.soNum===cn.soNum);if(so){const cu2=contacts.find(c=>c.id===so.customerId);const tot2=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const pd=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cu2?cN(cu2):"—",total:tot2,paid:pd,remaining:tot2-pd});}}}>{cn.soNum}</span>:"—"}</td>
        <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{toBE(cn.date)}</td>
        <td style={{padding:"8px",fontWeight:600,color:"var(--red)"}}>{"฿"+fmt(tot)}</td>
        <td style={{padding:"8px"}}>{usedBill?<span style={{fontSize:11}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>ใช้แล้ว</span><span style={{marginLeft:6,color:"var(--blue)",fontWeight:500,cursor:"pointer"}} onClick={()=>{setSub("billing");setViewBill(usedBill);}}>{usedBill.billNum}</span></span>:<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่ได้ใช้</span>}</td>
        <td style={{padding:"8px",color:"var(--dim)",fontSize:12}}>{cn.reason||cn.note||"—"}</td>
        <td style={{padding:"8px"}}>{ed&&<><button onClick={()=>openEditCN(cn)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"var(--hover)",color:"var(--dim)",cursor:"pointer",fontFamily:"inherit",marginRight:4}}>แก้ไข</button>{!usedBill&&<button onClick={()=>delCN(cn)} style={{padding:"3px 8px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบ</button>}</>}</td>
      </tr>;
    })}</tbody></table></div>

    {viewCN&&(()=>{const cn=viewCN;const tp=CN_TYPES.find(t=>t.key===cn.type)||CN_TYPES[0];const cust=contacts.find(c=>c.id===cn.customerId);const tot=cnTot(cn);const usedBill=billings.find(b=>(b.cnIds||[]).includes(cn.id));const df=cn.defectiveId?defectives.find(d=>d.id===cn.defectiveId):null;
      const cnSO=cn.soNum?sales.find(s=>s.soNum===cn.soNum):null;const cnSOSub=cnSO?(cnSO.items||[]).reduce((s,i)=>s+i.qty*i.price,0):0;const cnDiscR=cnSO&&cnSO.discountAmt>0&&cnSOSub>0?(cnSOSub-cnSO.discountAmt)/cnSOSub:1;const adjP=(it)=>{if(cnDiscR===1)return it.price;const si=cnSO?(cnSO.items||[]).find(x=>x.productId===it.productId):null;return si?round2(si.price*cnDiscR):it.price;};
      return<Modal title={"รายละเอียดใบลดหนี้ — "+cn.cnNum} onClose={()=>setViewCN(null)} wide>
        <div className="detail-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)"}}>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>เลขที่</span><div style={{fontWeight:600,color:"var(--blue)"}}>{cn.cnNum}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ประเภท</span><div><span style={{fontSize:12,padding:"2px 10px",borderRadius:99,background:tp.bg,color:tp.color,fontWeight:500}}>{tp.label}</span></div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>วันที่</span><div style={{fontWeight:500}}>{toBE(cn.date)}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>ลูกค้า</span><div style={{fontWeight:600}}>{cust?cN(cust):"—"}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>อ้างอิง SO</span><div>{cn.soNum?<span style={{color:"var(--blue)",fontWeight:500,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{const so=sales.find(s=>s.soNum===cn.soNum);if(so){const cu3=contacts.find(c=>c.id===so.customerId);const tot3=so.items.reduce((s,i)=>s+i.qty*i.price,0)-(so.discountAmt||0);const pd3=payments.filter(p=>p.refId===so.soNum&&p.type==="ar").reduce((s,p)=>s+(+p.amount||0),0);setViewSO({...so,custName:cu3?cN(cu3):"—",total:tot3,paid:pd3,remaining:tot3-pd3});setViewCN(null);}}}>{cn.soNum}</span>:<span style={{fontWeight:500}}>—</span>}</div></div>
          <div><span style={{fontSize:11,color:"var(--dim)"}}>สถานะ</span><div>{usedBill?<span style={{fontSize:12}}><span style={{padding:"2px 8px",borderRadius:99,background:"rgba(52,199,89,0.12)",color:"var(--green)",fontWeight:500}}>ใช้แล้ว</span><span style={{marginLeft:6,color:"var(--blue)",fontWeight:500}}>{usedBill.billNum}</span></span>:<span style={{fontSize:12,padding:"2px 8px",borderRadius:99,background:"rgba(255,149,0,0.14)",color:"var(--orange)"}}>ยังไม่ได้ใช้</span>}</div></div>
        </div>

        {df&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>ข้อมูลสินค้าชำรุด</div>
          <div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",marginBottom:14,fontSize:13}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
              <div><span style={{color:"var(--dim)"}}>รหัส:</span> <b style={{color:"var(--blue)"}}>{df.code}</b></div>
              <div><span style={{color:"var(--dim)"}}>สินค้า:</span> <b>{(()=>{const pr=products.find(p=>p.id===df.productId);return pr?pN(pr):"—";})()}</b></div>
              <div><span style={{color:"var(--dim)"}}>S/N:</span> <span style={{fontFamily:"monospace"}}>{df.serialNo||"—"}</span></div>
              <div><span style={{color:"var(--dim)"}}>อาการ:</span> {df.symptom||"—"}</div>
            </div>
          </div>
        </>}

        {(cn.items||[]).length>0&&<>
          <div style={{fontSize:12,fontWeight:600,color:"var(--dim)",marginBottom:6}}>รายการสินค้า ({cn.items.length})</div>
          <div style={{border:"1px solid var(--line)",borderRadius:8,marginBottom:14,overflow:"hidden"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr style={{background:"var(--bg)",borderBottom:"1px solid var(--line)"}}>{["#","สินค้า","จำนวน","ราคา/หน่วย","รวม"].map((h,i)=><th key={i} style={{padding:"6px 12px",textAlign:i>=2?"right":"left",fontWeight:500,color:"var(--dim)",fontSize:11}}>{h}</th>)}</tr></thead>
            <tbody>{cn.items.map((it,i)=>{const pr=products.find(p=>p.id===it.productId);const ap=adjP(it);return<tr key={i} style={{borderBottom:"1px solid var(--line)"}}>
              <td style={{padding:"6px 12px",color:"var(--dim)"}}>{i+1}</td>
              <td style={{padding:"6px 12px",fontWeight:500}}>{pr?pN(pr):"—"}</td>
              <td style={{padding:"6px 12px",textAlign:"right"}}>{it.qty+" ชิ้น"}</td>
              <td style={{padding:"6px 12px",textAlign:"right"}}>{"฿"+fmt(ap)}</td>
              <td style={{padding:"6px 12px",textAlign:"right",fontWeight:600}}>{"฿"+fmt(it.qty*ap)}</td>
            </tr>;})}</tbody></table>
          </div>
        </>}

        <div style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700}}><span>ยอดรวม CN</span><span style={{color:"var(--red)"}}>{"฿"+fmt(tot)}</span></div>
        </div>

        {(cn.reason||cn.note)&&<div style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--line)",fontSize:13}}>
          {cn.reason&&<div><span style={{color:"var(--dim)"}}>เหตุผล:</span> {cn.reason}</div>}
          {cn.note&&<div style={{marginTop:cn.reason?4:0}}><span style={{color:"var(--dim)"}}>หมายเหตุ:</span> {cn.note}</div>}
        </div>}
      </Modal>;
    })()}

    {modal==="addCN"&&ed&&(()=>{
      const isEdit=!!cnForm.id;
      const custSOs=cnForm.customerId?sales.filter(so=>so.customerId===cnForm.customerId&&so.status==="completed"):[];
      const selSO=custSOs.find(so=>so.soNum===cnForm.soNum);
      const soItems=selSO?(selSO.items||[]):[];
      const soSub=soItems.reduce((s,i)=>s+i.qty*i.price,0);
      const soDiscAmt=selSO?.discountAmt||0;
      const discRatio=soSub>0?(soSub-soDiscAmt)/soSub:1;
      const discPrice=p=>round2(p*discRatio);
      const cnItemTotal=(cnForm.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
      const nextCN=()=>{const yr=new Date().getFullYear()+543;const nums=cnotes.filter(c=>c.cnNum?.startsWith("CN-"+yr)).map(c=>+c.cnNum.split("-")[2]||0);return"CN-"+yr+"-"+String(Math.max(0,...nums)+1).padStart(3,"0");};
      const addCnItem=()=>setCnForm(f=>({...f,items:[...f.items,{productId:"",qty:1,price:0}]}));
      const updCnItem=(idx,k,v)=>setCnForm(f=>({...f,items:f.items.map((it,i)=>i===idx?{...it,[k]:v}:it)}));
      const rmCnItem=idx=>setCnForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
      const loadSOItems=soNum=>{const so=custSOs.find(x=>x.soNum===soNum);if(so){const sub=(so.items||[]).reduce((s,i)=>s+i.qty*i.price,0);const d=so.discountAmt||0;const r=sub>0?(sub-d)/sub:1;setCnForm(f=>({...f,soNum,items:(so.items||[]).map(i=>({productId:i.productId,qty:i.qty,price:round2(i.price*r)}))}));}else setCnForm(f=>({...f,soNum,items:[]}));};
      const saveCN=()=>{
        if(cnForm.type==="defective"&&!cnForm.defectiveId)return;
        if(cnForm.type!=="defective"&&!cnForm.customerId)return;
        if(cnForm.type==="return"&&(!cnForm.soNum||(cnForm.items||[]).length===0))return;
        if(cnForm.type==="promo"&&(!cnForm.amount||+cnForm.amount<=0))return;
        for(const it of(cnForm.items||[])){if(!it.productId||it.qty<=0)return;}
        if(cnForm.type==="defective"||cnForm.type==="return"){
          const refSoNum=cnForm.soNum||(cnForm.defectiveId?defectives.find(d=>d.id===cnForm.defectiveId)?.soNum:null);
          if(refSoNum){
            const refSo=sales.find(s=>s.soNum===refSoNum);
            if(refSo){
              const refSoSub=(refSo.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
              const soTotal=refSoSub-(refSo.discountAmt||0);
              const cnItems=(cnForm.items||[]).reduce((s,i)=>s+i.qty*i.price,0);
              if(cnItems>soTotal+0.01){setWarnMsg("ยอด CN (฿"+fmt(cnItems)+") เกินยอด SO ต้นฉบับ (฿"+fmt(soTotal)+")");return;}
              for(const ci of(cnForm.items||[])){const si=(refSo.items||[]).find(x=>x.productId===ci.productId);if(!si){setWarnMsg("สินค้าไม่อยู่ใน SO ต้นฉบับ");return;}if(ci.qty>si.qty){setWarnMsg("จำนวน CN ("+ci.qty+") เกินจำนวนใน SO ("+si.qty+")");return;}}
            }
          }
        }
        const ts=Date.now();
        if(isEdit){
          const orig=cnotes.find(c=>c.id===cnForm.id);
          if(orig&&orig.type==="return"){
            for(const oi of(orig.items||[])){
              const ni=(cnForm.items||[]).find(x=>x.productId===oi.productId);
              const diff=oi.qty-(ni?ni.qty:0);
              if(diff!==0){const pr=products.find(p=>p.id===oi.productId);const bef=pr?pr.stock:0;const aft=bef-diff;setProducts(ps=>ps.map(p=>p.id===oi.productId?{...p,stock:aft}:p));addLog(mkLog(oi.productId,"cn_edit",Math.abs(diff),bef,aft,orig.cnNum,diff>0?"แก้ไข CN ลดจำนวน":"แก้ไข CN เพิ่มจำนวน",cu?.username));}
            }
            for(const ni of(cnForm.items||[])){
              if(!(orig.items||[]).find(x=>x.productId===ni.productId)){const pr=products.find(p=>p.id===ni.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===ni.productId?{...p,stock:p.stock+ni.qty}:p));addLog(mkLog(ni.productId,"cn_edit",ni.qty,bef,bef+ni.qty,orig.cnNum,"แก้ไข CN เพิ่มสินค้า",cu?.username));}
            }
          }
          setCNotes(p=>p.map(c=>c.id===cnForm.id?{...cnForm,amount:cnForm.type==="promo"?+cnForm.amount:0}:c));
        }else{
          const cn={id:ts,cnNum:nextCN(),...cnForm,amount:cnForm.type==="promo"?+cnForm.amount:0};
          setCNotes(p=>[...p,cn]);
          if(cnForm.type==="return"){
            for(const it of cnForm.items){const pr=products.find(p=>p.id===it.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===it.productId?{...p,stock:p.stock+it.qty}:p));addLog(mkLog(it.productId,"cn_return",it.qty,bef,bef+it.qty,cn.cnNum,"CN คืนสินค้า ref "+cnForm.soNum,cu?.username));}
          }
          if(cnForm.type==="defective"&&cnForm.defectiveId){
            setDefectives(p=>p.map(d=>d.id===cnForm.defectiveId?{...d,custStatus:"cn_created"}:d));
          }
        }
        cM();
      };
      return<Modal title={isEdit?"แก้ไขใบลดหนี้":"สร้างใบลดหนี้"} onClose={cM} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <Field label="ประเภท"><CustomSelect value={cnForm.type} onChange={v=>setCnForm(f=>({...f,type:v,items:[],soNum:"",amount:"",customerId:"",defectiveId:""}))} options={CN_TYPES.map(t=>({value:t.key,label:t.label}))}/></Field>
          <Field label="วันที่"><ThaiDateInput value={cnForm.date} onChange={e=>setCnForm(f=>({...f,date:e.target.value}))}/></Field>
          {cnForm.type==="defective"?<Field label="รายการชำรุด"><CustomSelect value={String(cnForm.defectiveId||"")} onChange={v=>{const df=defectives.find(d=>d.id===+v);if(df){const pr=products.find(p=>p.id===df.productId);setCnForm(f=>({...f,defectiveId:+v,customerId:df.customerId,soNum:df.soNum||"",items:[{productId:df.productId,qty:1,price:pr?pr.price:0}]}));}else{setCnForm(f=>({...f,defectiveId:"",customerId:"",soNum:"",items:[]}));}}} options={[{value:"",label:"— เลือกรายการชำรุด —"},...defectives.map(d=>{const pr=products.find(p=>p.id===d.productId);const cu2=contacts.find(c=>c.id===d.customerId);return{value:String(d.id),label:d.code+" — "+(pr?pN(pr):"")+" ("+(cu2?cN(cu2):"")+")"};})]} /></Field>:<>
          <Field label="ลูกค้า"><CustomSelect searchable value={cnForm.customerId} onChange={v=>setCnForm(f=>({...f,customerId:v,soNum:"",items:[]}))} options={[{value:"",label:"— เลือกลูกค้า —"},...contacts.filter(c=>c.type==="customer").map(c=>({value:c.id,label:cN(c)}))]}/></Field>
          {cnForm.type==="return"&&<Field label="อ้างอิง SO"><CustomSelect value={cnForm.soNum} onChange={v=>loadSOItems(v)} options={[{value:"",label:"— เลือก SO —"},...custSOs.map(so=>({value:so.soNum,label:so.soNum}))]}/></Field>}
          </>}
        </div>

        {cnForm.type==="defective"&&cnForm.defectiveId&&(()=>{const df=defectives.find(d=>d.id===cnForm.defectiveId);const pr=df?products.find(p=>p.id===df.productId):null;const cu2=df?contacts.find(c=>c.id===df.customerId):null;return<div style={{background:"var(--bg2)",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
            <div><span style={{color:"var(--dim)"}}>ลูกค้า:</span> <b>{cu2?cN(cu2):"-"}</b></div>
            <div><span style={{color:"var(--dim)"}}>SO:</span> <span style={{color:"var(--blue)"}}>{df?.soNum||"—"}</span></div>
            <div><span style={{color:"var(--dim)"}}>สินค้า:</span> {pr?pN(pr):"-"}</div>
            <div><span style={{color:"var(--dim)"}}>S/N:</span> <span style={{fontFamily:"monospace"}}>{df?.serialNo||"—"}</span></div>
            <div style={{gridColumn:"1/-1"}}><span style={{color:"var(--dim)"}}>อาการ:</span> {df?.symptom||"-"}</div>
          </div>
          {cnForm.items.length>0&&<div style={{fontSize:13,fontWeight:600,marginTop:6,color:"var(--red)"}}>{"ยอดรวม: ฿"+fmt(cnItemTotal)}</div>}
        </div>;})()}

        {cnForm.type==="return"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>รายการสินค้า</div>
            <button onClick={addCnItem} style={{padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--line)",background:"transparent",color:"var(--blue)",cursor:"pointer",fontFamily:"inherit"}}>+ เพิ่มรายการ</button>
          </div>
          {(cnForm.items||[]).map((it,i)=>{const soMax=it.productId?soItems.find(x=>x.productId===it.productId)?.qty||0:0;return<div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,marginBottom:6,alignItems:"end"}}>
            <Field label={i===0?"สินค้า":""}><CustomSelect value={it.productId?String(it.productId):""} onChange={v=>{const p=products.find(x=>x.id===+v);updCnItem(i,"productId",+v);if(p){const si=soItems.find(x=>x.productId===+v);updCnItem(i,"price",si?discPrice(si.price):p.price);if(si)updCnItem(i,"qty",Math.min(it.qty,si.qty));}}} options={[{value:"",label:"— เลือก —"},...(soItems.length>0?(()=>{const opts=soItems.map(si=>{const p=products.find(x=>x.id===si.productId);return{value:String(si.productId),label:p?pN(p)+"  ("+si.qty+")":"—"};});if(it.productId&&!opts.find(o=>o.value===String(it.productId))){const ep=products.find(x=>x.id===it.productId);opts.unshift({value:String(it.productId),label:ep?pN(ep):"—"});}return opts.filter((v,idx,a)=>a.findIndex(x=>x.value===v.value)===idx);})():products.map(p=>({value:String(p.id),label:pN(p),searchText:(p.code||"")+" "+(p.brand||"")})))]}/></Field>
            <Field label={i===0?"จำนวน"+(soMax?" (สูงสุด "+soMax+")":""):""}><input type="number" min="1" max={soMax||undefined} value={it.qty} onChange={e=>{const v=Math.max(1,+e.target.value);updCnItem(i,"qty",soMax?Math.min(v,soMax):v);}} style={{...IB,borderColor:soMax&&it.qty>soMax?"var(--red)":""}}/></Field>
            <Field label={i===0?"ราคา/หน่วย":""}><input type="number" value={it.price} onChange={e=>updCnItem(i,"price",+e.target.value)} style={IB}/></Field>
            <button onClick={()=>rmCnItem(i)} style={{padding:"6px 8px",fontSize:11,color:"var(--red)",background:"none",border:"none",cursor:"pointer",marginBottom:2}}>ลบ</button>
          </div>;})}
          {cnForm.items.length>0&&<div style={{fontSize:13,fontWeight:600,marginTop:6,color:"var(--red)"}}>{"ยอดรวม: ฿"+fmt(cnItemTotal)}{soDiscAmt>0&&<span style={{fontSize:11,color:"var(--dim)",fontWeight:400,marginLeft:8}}>{"(หลังส่วนลด "+((selSO?.discPct||0)||Math.round(soDiscAmt/soSub*10000)/100)+"% จาก SO)"}</span>}</div>}
        </>}

        {cnForm.type==="promo"&&<Field label="จำนวนเงิน (฿)"><input type="number" value={cnForm.amount} onChange={e=>setCnForm(f=>({...f,amount:e.target.value}))} style={IB}/></Field>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
          <Field label="เหตุผล"><input value={cnForm.reason||""} onChange={e=>setCnForm(f=>({...f,reason:e.target.value}))} style={IB} placeholder={cnForm.type==="promo"?"เช่น โปรส่งท้ายปี":"เหตุผลการคืน"}/></Field>
          <Field label="หมายเหตุ"><input value={cnForm.note||""} onChange={e=>setCnForm(f=>({...f,note:e.target.value}))} style={IB}/></Field>
        </div>
        {isEdit&&cd&&<div style={{marginTop:12,textAlign:"right"}}><button onClick={()=>{
          const orig=cnotes.find(c=>c.id===cnForm.id);
          if(orig&&orig.type==="return"&&orig.items){for(const it of orig.items){const pr=products.find(p=>p.id===it.productId);const bef=pr?pr.stock:0;setProducts(ps=>ps.map(p=>p.id===it.productId?{...p,stock:p.stock-it.qty}:p));addLog(mkLog(it.productId,"cn_cancel",it.qty,bef,Math.max(0,bef-it.qty),orig.cnNum,"ยกเลิก CN",cu?.username));}}
          setCNotes(p=>p.filter(c=>c.id!==cnForm.id));cM();
        }} style={{padding:"4px 12px",fontSize:11,borderRadius:6,border:"1px solid var(--red)",background:"rgba(255,59,48,0.12)",color:"var(--red)",cursor:"pointer",fontFamily:"inherit"}}>ลบใบลดหนี้</button></div>}
        <MBtns onCancel={cM} onSave={saveCN}/>
      </Modal>;
    })()}
  </>;
}

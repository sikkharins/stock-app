import { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import { fmt, todayStr, toBE } from "../utils/helpers.js";
import { Modal, MBtns } from "./ui/Modal.jsx";
import Field from "./ui/Field.jsx";
import CustomSelect from "./ui/CustomSelect.jsx";
import ThaiDateInput from "./ui/ThaiDateInput.jsx";

const MEASURE_OPTS=[{value:"amount",label:"ยอดเงิน (บาท)"},{value:"qty",label:"จำนวนสินค้า (ชิ้น)"}];
const REWARD_OPTS=[{value:"product",label:"แถมสินค้า"},{value:"percent",label:"ส่วนลด %"},{value:"fixed",label:"ส่วนลดยอดสุทธิ (บาท)"}];
const emptyTier=()=>({id:Date.now()+Math.random(),threshold:"",rewardType:"percent",rewardValue:"",rewardProductId:""});
const emptyForm=()=>({name:"",startDate:todayStr(),endDate:"",brands:[],categoryIds:[],measureBy:"amount",mode:"per_so",tiers:[emptyTier()],active:true});

function statusOf(p){
  const today=todayStr();
  if(!p.active)return{label:"ปิดใช้งาน",color:"var(--faint)",bg:"var(--hover)"};
  if(p.endDate&&p.endDate<today)return{label:"หมดอายุ",color:"var(--red)",bg:"rgba(255,59,48,0.12)"};
  if(p.startDate>today)return{label:"กำหนดการ",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"};
  return{label:"ใช้งานอยู่",color:"var(--green)",bg:"rgba(52,199,89,0.12)"};
}

export default function PromosPage({sh}){
  const{promos,setPromos,products,brands,cats,getCN,canE,canC,canD,modal,oM,cM,pN}=sh;
  const ed=canE("promos");const cr=canC("promos");const cd=canD("promos");
  const[form,setForm]=useState(emptyForm());
  const[isEdit,setIsEdit]=useState(false);
  const[delId,setDelId]=useState(null);
  const[filterStatus,setFilterStatus]=useState("all");

  const list=useMemo(()=>{
    let arr=[...promos].sort((a,b)=>(b.id||0)-(a.id||0));
    if(filterStatus!=="all")arr=arr.filter(p=>{
      const s=statusOf(p);
      if(filterStatus==="active")return s.label==="ใช้งานอยู่";
      if(filterStatus==="expired")return s.label==="หมดอายุ";
      if(filterStatus==="inactive")return s.label==="ปิดใช้งาน";
      if(filterStatus==="scheduled")return s.label==="กำหนดการ";
      return true;
    });
    return arr;
  },[promos,filterStatus]);

  const openNew=()=>{setForm(emptyForm());setIsEdit(false);oM("promoForm");};
  const openEdit=p=>{
    setForm({id:p.id,name:p.name,startDate:p.startDate||"",endDate:p.endDate||"",brands:p.brands||[],categoryIds:p.categoryIds||[],measureBy:p.measureBy||"amount",mode:p.mode||"per_so",tiers:(p.tiers||[]).map(t=>({...t})),active:p.active!==false});
    setIsEdit(true);oM("promoForm");
  };
  const askDel=id=>{setDelId(id);oM("promoDel");};
  const confirmDel=()=>{setPromos(p=>p.filter(x=>x.id!==delId));cM();};

  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));

  const toggleBrand=b=>{
    setForm(f=>{
      const has=f.brands.includes(b);
      return{...f,brands:has?f.brands.filter(x=>x!==b):[...f.brands,b]};
    });
  };
  const toggleCat=id=>{
    setForm(f=>{
      const has=f.categoryIds.includes(id);
      return{...f,categoryIds:has?f.categoryIds.filter(x=>x!==id):[...f.categoryIds,id]};
    });
  };

  const addTier=()=>setForm(f=>({...f,tiers:[...f.tiers,emptyTier()]}));
  const removeTier=tid=>setForm(f=>({...f,tiers:f.tiers.filter(t=>t.id!==tid)}));
  const setTier=(tid,k,v)=>setForm(f=>({...f,tiers:f.tiers.map(t=>t.id===tid?{...t,[k]:v}:t)}));

  const save=()=>{
    if(!form.name||!form.startDate||form.tiers.length===0)return;
    const d={name:form.name,startDate:form.startDate,endDate:form.endDate||"",brands:form.brands,categoryIds:form.categoryIds,measureBy:form.measureBy,mode:form.mode||"per_so",tiers:form.tiers.map(t=>({id:t.id,threshold:+t.threshold||0,rewardType:t.rewardType,rewardValue:t.rewardType==="product"?0:+(t.rewardValue)||0,rewardProductId:t.rewardType==="product"?+t.rewardProductId||0:0})),active:form.active};
    if(isEdit){setPromos(p=>p.map(x=>x.id===form.id?{...x,...d}:x));}
    else{setPromos(p=>[...p,{id:Date.now(),...d}]);}
    cM();
  };

  const toggleActive=(id,val)=>{setPromos(p=>p.map(x=>x.id===id?{...x,active:val}:x));};

  const rewardLabel=(t)=>{
    if(t.rewardType==="percent")return "ลด "+t.rewardValue+"%";
    if(t.rewardType==="fixed")return "ลด ฿"+fmt(t.rewardValue);
    if(t.rewardType==="product"){const pr=products.find(p=>p.id===t.rewardProductId);return "แถม "+(pr?pN(pr):"-");}
    return"-";
  };

  const chip={display:"inline-block",fontSize:11,fontWeight:500,borderRadius:5,padding:"2px 8px",marginRight:4,marginBottom:3};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div style={{fontWeight:600,fontSize:16}}>โปรโมชั่น</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <CustomSelect value={filterStatus} onChange={v=>setFilterStatus(v)} options={[{value:"all",label:"ทั้งหมด"},{value:"active",label:"ใช้งานอยู่"},{value:"scheduled",label:"กำหนดการ"},{value:"expired",label:"หมดอายุ"},{value:"inactive",label:"ปิดใช้งาน"}]} style={{width:140}}/>
        {cr&&<button onClick={openNew} style={{padding:"7px 16px",borderRadius:7,border:"none",background:"var(--text)",color:"var(--bg)",fontSize:13,fontWeight:500,cursor:"pointer"}}>+ สร้างโปรโมชั่น</button>}
      </div>
    </div>

    {list.length===0?<div style={{textAlign:"center",color:"var(--faint)",padding:"3rem",background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10}}>ยังไม่มีโปรโมชั่น</div>
    :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
      {list.map(p=>{
        const st=statusOf(p);
        return <div key={p.id} style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:10,padding:16,position:"relative"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{fontWeight:600,fontSize:15,flex:1,paddingRight:8}}>{p.name}</div>
            <span style={{...chip,color:st.color,background:st.bg,flexShrink:0}}>{st.label}</span>
          </div>

          <div style={{fontSize:12,color:"var(--dim)",marginBottom:10}}>
            {toBE(p.startDate)} — {p.endDate?toBE(p.endDate):"ไม่จำกัด"}
          </div>

          {(p.brands||[]).length>0&&<div style={{marginBottom:6}}>
            <span style={{fontSize:11,color:"var(--faint)"}}>ยี่ห้อ: </span>
            {p.brands.map(b=><span key={b} style={{...chip,color:"var(--blue)",background:"var(--blue-bg)"}}>{b}</span>)}
          </div>}
          {(p.categoryIds||[]).length>0&&<div style={{marginBottom:6}}>
            <span style={{fontSize:11,color:"var(--faint)"}}>หมวด: </span>
            {p.categoryIds.map(id=><span key={id} style={{...chip,color:"var(--orange)",background:"rgba(255,149,0,0.14)"}}>{getCN(id)}</span>)}
          </div>}

          <div style={{fontSize:12,color:"var(--dim)",marginBottom:4,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span>วัดผลด้วย: {p.measureBy==="amount"?"ยอดเงิน":"จำนวน"}</span>
            <span style={{padding:"1px 7px",borderRadius:99,fontSize:10,fontWeight:600,color:(p.mode||"per_so")==="accumulate"?"var(--purple)":"var(--blue)",background:(p.mode||"per_so")==="accumulate"?"rgba(175,82,222,0.14)":"var(--blue-bg)"}}>{(p.mode||"per_so")==="accumulate"?"สะสม":"ต่อใบ"}</span>
          </div>

          <div style={{fontSize:12,marginTop:8,borderTop:"1px solid var(--line)",paddingTop:8}}>
            <div style={{fontWeight:500,color:"var(--dim)",marginBottom:4}}>ขั้นรางวัล ({(p.tiers||[]).length})</div>
            {(p.tiers||[]).map((t,i)=><div key={t.id||i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text)",marginBottom:2}}>
              <span>≥ {p.measureBy==="amount"?"฿"+fmt(t.threshold):fmt(t.threshold)+" ชิ้น"}</span>
              <span style={{fontWeight:500}}>{rewardLabel(t)}</span>
            </div>)}
          </div>

          {ed&&<div style={{display:"flex",gap:10,marginTop:10,paddingTop:8,borderTop:"1px solid var(--line)"}}>
            <button onClick={()=>openEdit(p)} style={{fontSize:12,color:"var(--blue)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>แก้ไข</button>
            <button onClick={()=>toggleActive(p.id,!p.active)} style={{fontSize:12,color:p.active?"var(--orange)":"var(--green)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>{p.active?"ปิดใช้งาน":"เปิดใช้งาน"}</button>
            {cd&&<button onClick={()=>askDel(p.id)} style={{fontSize:12,color:"var(--red)",background:"transparent",border:"none",cursor:"pointer",padding:0}}>ลบ</button>}
          </div>}
        </div>;
      })}
    </div>}

    {modal==="promoForm"&&<Modal title={isEdit?"แก้ไขโปรโมชั่น":"สร้างโปรโมชั่นใหม่"} onClose={cM} wide>
      <div style={{display:"grid",gap:14}}>
        <Field label="ชื่อโปรโมชั่น" req><input value={form.name} onChange={e=>setF("name",e.target.value)} style={IB} placeholder="เช่น โปรซื้อครบลด"/></Field>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="วันเริ่มต้น" req><ThaiDateInput value={form.startDate} onChange={e=>setF("startDate",e.target.value)}/></Field>
          <Field label="วันสิ้นสุด"><ThaiDateInput value={form.endDate} onChange={e=>setF("endDate",e.target.value)}/></Field>
        </div>

        <Field label="วัดผลด้วย"><CustomSelect value={form.measureBy} onChange={v=>setF("measureBy",v)} options={MEASURE_OPTS}/></Field>

        <div>
          <div style={{fontSize:11.5,fontWeight:500,color:"var(--dim)",marginBottom:6}}>รูปแบบการนับยอด</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{k:"per_so",lbl:"ต่อใบ SO",hint:"ลูกค้าต้องซื้อครบในใบเดียว"},{k:"accumulate",lbl:"สะสมข้าม SO",hint:"ผูกกับลูกค้า นับจาก SO ที่จัดส่ง/รอส่ง"}].map(opt=>{
              const sel=form.mode===opt.k;
              return <label key={opt.k} style={{display:"flex",flexDirection:"column",gap:4,padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(sel?"var(--blue)":"var(--line)"),background:sel?"var(--blue-bg)":"var(--panel)",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="radio" name="promo_mode" checked={sel} onChange={()=>setF("mode",opt.k)}/>
                  <span style={{fontWeight:500,color:sel?"var(--blue)":"var(--text)",fontSize:13}}>{opt.lbl}</span>
                </div>
                <span style={{fontSize:11,color:"var(--dim)",paddingLeft:22}}>{opt.hint}</span>
              </label>;
            })}
          </div>
        </div>

        <div>
          <div style={{fontSize:11.5,fontWeight:500,color:"var(--dim)",marginBottom:6}}>ยี่ห้อที่เข้าร่วม <span style={{fontWeight:400,color:"var(--faint)"}}>(ว่าง = ทุกยี่ห้อ)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:120,overflowY:"auto",padding:4}}>
            {brands.map(b=>{
              const sel=form.brands.includes(b);
              return <span key={b} onClick={()=>toggleBrand(b)} style={{...chip,cursor:"pointer",color:sel?"var(--blue)":"var(--dim)",background:sel?"var(--blue-bg)":"var(--hover)",border:sel?"1px solid var(--blue)":"1px solid transparent",padding:"4px 10px",fontSize:12}}>{b}</span>;
            })}
          </div>
        </div>

        <div>
          <div style={{fontSize:11.5,fontWeight:500,color:"var(--dim)",marginBottom:6}}>หมวดสินค้าที่เข้าร่วม <span style={{fontWeight:400,color:"var(--faint)"}}>(ว่าง = ทุกหมวด)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:120,overflowY:"auto",padding:4}}>
            {cats.map(c=>{
              const sel=form.categoryIds.includes(c.id);
              return <span key={c.id} onClick={()=>toggleCat(c.id)} style={{...chip,cursor:"pointer",color:sel?"var(--orange)":"var(--dim)",background:sel?"rgba(255,149,0,0.14)":"var(--hover)",border:sel?"1px solid var(--orange)":"1px solid transparent",padding:"4px 10px",fontSize:12}}>{c.name}</span>;
            })}
          </div>
        </div>

        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11.5,fontWeight:500,color:"var(--dim)"}}>ขั้นรางวัล</div>
            <button onClick={addTier} style={{fontSize:12,color:"var(--blue)",background:"transparent",border:"none",cursor:"pointer"}}>+ เพิ่มขั้น</button>
          </div>
          {form.tiers.map((t,i)=><div key={t.id} style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:12,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:"var(--dim)"}}>ขั้นที่ {i+1}</span>
              {form.tiers.length>1&&<button onClick={()=>removeTier(t.id)} style={{fontSize:11,color:"var(--red)",background:"transparent",border:"none",cursor:"pointer"}}>ลบ</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label={form.measureBy==="amount"?"ยอดขั้นต่ำ (บาท)":"จำนวนขั้นต่ำ (ชิ้น)"}>
                <input type="number" value={t.threshold} onChange={e=>setTier(t.id,"threshold",e.target.value)} style={IB} placeholder="0"/>
              </Field>
              <Field label="ประเภทรางวัล">
                <CustomSelect value={t.rewardType} onChange={v=>setTier(t.id,"rewardType",v)} options={REWARD_OPTS}/>
              </Field>
            </div>
            <div style={{marginTop:10}}>
              {t.rewardType==="percent"&&<Field label="ส่วนลด (%)"><input type="number" value={t.rewardValue} onChange={e=>setTier(t.id,"rewardValue",e.target.value)} style={IB} placeholder="เช่น 10"/></Field>}
              {t.rewardType==="fixed"&&<Field label="ส่วนลด (บาท)"><input type="number" value={t.rewardValue} onChange={e=>setTier(t.id,"rewardValue",e.target.value)} style={IB} placeholder="เช่น 500"/></Field>}
              {t.rewardType==="product"&&<Field label="สินค้าแถม">
                <CustomSelect searchable value={String(t.rewardProductId||"")} onChange={v=>setTier(t.id,"rewardProductId",v)} options={[{value:"",label:"— เลือกสินค้า —"},...products.map(p=>({value:String(p.id),label:pN(p)+" ("+p.brand+")",searchText:p.code||""}))]}/>              </Field>}
            </div>
          </div>)}
        </div>

        <Field label="สถานะ">
          <CustomSelect value={form.active?"1":"0"} onChange={v=>setF("active",v==="1")} options={[{value:"1",label:"เปิดใช้งาน"},{value:"0",label:"ปิดใช้งาน"}]}/>
        </Field>
      </div>
      <MBtns onCancel={cM} onSave={save} saveLabel={isEdit?"บันทึก":"สร้างโปรโมชั่น"} disabled={!form.name||!form.startDate}/>
    </Modal>}

    {modal==="promoDel"&&<Modal title="ยืนยันลบโปรโมชั่น" onClose={cM}>
      <div style={{fontSize:13,color:"var(--dim)",marginBottom:8}}>คุณต้องการลบโปรโมชั่นนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</div>
      <MBtns onCancel={cM} onSave={confirmDel} saveLabel="ลบ"/>
    </Modal>}
  </div>;
}

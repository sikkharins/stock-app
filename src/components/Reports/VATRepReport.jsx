import { useState } from "react";
import { fmt, toBE } from "../../utils/helpers.js";
import { dlCSV } from "../../utils/csv.js";
import CustomSelect from "../ui/CustomSelect.jsx";

const MONTHS_TH=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const mLabel=m=>{if(!m)return"-";const[y,mo]=m.split("-");return MONTHS_TH[+mo]+" "+(+y+543);};

export default function VATRepReport({sales,contacts}){
  const now=new Date();
  const[selYear,setSelYear]=useState(now.getFullYear());
  const[expanded,setExpanded]=useState({});

  const custMap={};contacts.forEach(c=>custMap[c.id]=c);

  const vatSales=sales.filter(s=>s.status!=="draft"&&s.useVatRep&&s.vatRepName&&s.vatRepName.trim()&&(s.date||"").startsWith(String(selYear)));

  const groups={};
  vatSales.forEach(so=>{
    const rep=so.vatRepName;
    if(!groups[rep])groups[rep]={name:rep,items:[]};
    const sub=so.items.reduce((a,i)=>a+i.qty*i.price,0)-(so.discountAmt||0);
    const vat=so.includeVat?(so.vatAmount||0):0;
    const preVat=sub-vat;
    groups[rep].items.push({...so,sub,preVat,vat});
  });

  const groupArr=Object.values(groups).sort((a,b)=>{
    const at=a.items.reduce((s,i)=>s+i.sub,0);
    const bt=b.items.reduce((s,i)=>s+i.sub,0);
    return bt-at;
  });

  const toggle=name=>setExpanded(e=>({...e,[name]:!e[name]}));

  const exportCSV=()=>{
    const hdr=["ตัวแทน","SO No.","ลูกค้า","วันที่","ก่อน VAT","VAT 7%","ยอดสุทธิ"];
    const rows=[];
    groupArr.forEach(g=>g.items.forEach(so=>{const cust=custMap[so.customerId];rows.push([g.name,so.soNum,cust?cust.nameT||cust.name:"-",toBE(so.date),so.preVat,so.vat,so.sub]);}));
    dlCSV("vat-rep-"+(selYear+543)+".csv",[hdr,...rows]);
  };

  const TH={padding:"6px 10px",fontWeight:500,color:"var(--dim)",borderBottom:"1px solid var(--line)",fontSize:12};
  const TD={padding:"6px 10px",fontSize:12,borderBottom:"0.5px solid var(--line)"};

  return<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div style={{fontWeight:600,fontSize:15}}>รายงานตัวแทนรับ VAT รายปี</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:13,color:"var(--dim)"}}>ปี พ.ศ.:</span>
        <CustomSelect value={String(selYear)} onChange={v=>setSelYear(+v)} options={[0,1,2,3].map(i=>{const y=now.getFullYear()-i;return{value:String(y),label:String(y+543)};})} style={{width:"auto",minWidth:100}}/>
        {groupArr.length>0&&<button onClick={exportCSV} style={{padding:"6px 14px",borderRadius:6,border:"0.5px solid var(--line)",background:"var(--bg)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Export CSV</button>}
      </div>
    </div>

    {groupArr.length===0
      ?<div style={{textAlign:"center",color:"var(--faint)",padding:"3rem",background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8}}>ไม่มีข้อมูลตัวแทน VAT สำหรับปี {selYear+543}</div>
      :groupArr.map(g=>{
        const totalSub=g.items.reduce((s,i)=>s+i.sub,0);
        const totalPreVat=g.items.reduce((s,i)=>s+i.preVat,0);
        const totalVat=g.items.reduce((s,i)=>s+i.vat,0);
        const isOpen=expanded[g.name];

        const byMonth={};
        g.items.forEach(so=>{const m=(so.date||"").slice(0,7);if(!byMonth[m])byMonth[m]=[];byMonth[m].push(so);});

        return<div key={g.name} style={{background:"var(--panel)",border:"0.5px solid var(--line)",borderRadius:8,marginBottom:12,overflow:"hidden"}}>
          <div onClick={()=>toggle(g.name)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",cursor:"pointer",background:isOpen?"var(--bg)":"var(--panel)",userSelect:"none"}}>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{g.name}</div>
              <div style={{fontSize:12,color:"var(--faint)",marginTop:2}}>{g.items.length+" รายการ"}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:600}}>{"฿"+fmt(totalSub)}</div>
              <div style={{fontSize:11,color:"var(--orange)"}}>{"VAT: ฿"+fmt(totalVat)}</div>
            </div>
            <span style={{fontSize:14,color:"var(--faint)",marginLeft:16}}>{isOpen?"▲":"▼"}</span>
          </div>

          {isOpen&&<div style={{borderTop:"1px solid var(--line)",padding:"12px 16px"}}>
            {Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([m,sos])=>{
              const mPre=sos.reduce((s,i)=>s+i.preVat,0);
              const mVat=sos.reduce((s,i)=>s+i.vat,0);
              const mSub=sos.reduce((s,i)=>s+i.sub,0);
              return<div key={m} style={{marginBottom:20}}>
                <div style={{fontWeight:500,fontSize:12,color:"var(--text)",marginBottom:6,padding:"4px 8px",background:"var(--hover)",borderRadius:4}}>{mLabel(m)}</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"var(--bg)"}}>
                        <th style={{...TH,textAlign:"left"}}>SO No.</th>
                        <th style={{...TH,textAlign:"left"}}>ลูกค้า</th>
                        <th style={{...TH,textAlign:"left"}}>วันที่</th>
                        <th style={{...TH,textAlign:"right"}}>ก่อน VAT</th>
                        <th style={{...TH,textAlign:"right"}}>VAT 7%</th>
                        <th style={{...TH,textAlign:"right"}}>ยอดสุทธิ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sos.map(so=>{
                        const cust=custMap[so.customerId];
                        return<tr key={so.id}>
                          <td style={{...TD,fontWeight:500}}>{so.soNum}</td>
                          <td style={{...TD,color:"var(--dim)"}}>{cust?cust.nameT||cust.name:"-"}</td>
                          <td style={{...TD,color:"var(--faint)"}}>{toBE(so.date)}</td>
                          <td style={{...TD,textAlign:"right"}}>{"฿"+fmt(so.preVat)}</td>
                          <td style={{...TD,textAlign:"right",color:"var(--orange)"}}>{"฿"+fmt(so.vat)}</td>
                          <td style={{...TD,textAlign:"right",fontWeight:500}}>{"฿"+fmt(so.sub)}</td>
                        </tr>;
                      })}
                      <tr style={{background:"var(--bg)",fontWeight:600}}>
                        <td colSpan={3} style={{...TD,fontSize:11,color:"var(--dim)"}}>รวม{mLabel(m)}</td>
                        <td style={{...TD,textAlign:"right"}}>{"฿"+fmt(mPre)}</td>
                        <td style={{...TD,textAlign:"right",color:"var(--orange)"}}>{"฿"+fmt(mVat)}</td>
                        <td style={{...TD,textAlign:"right"}}>{"฿"+fmt(mSub)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>;
            })}
            <div style={{display:"flex",justifyContent:"flex-end",gap:20,padding:"10px 0 0",borderTop:"1px solid var(--line)",fontWeight:600,fontSize:13,flexWrap:"wrap"}}>
              <span style={{color:"var(--dim)"}}>{"รวมก่อน VAT: ฿"+fmt(totalPreVat)}</span>
              <span style={{color:"var(--orange)"}}>{"VAT รวม: ฿"+fmt(totalVat)}</span>
              <span>{"ยอดสุทธิรวม: ฿"+fmt(totalSub)}</span>
            </div>
          </div>}
        </div>;
      })
    }
  </div>;
}

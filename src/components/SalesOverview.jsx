import { useState, useMemo } from "react";
import { IB } from "../utils/constants.js";
import { dlCSV } from "../utils/csv.js";
import CustomSelect from "./ui/CustomSelect.jsx";

const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const Q_MONTHS = { "1":[0,1,2], "2":[3,4,5], "3":[6,7,8], "4":[9,10,11] };
const fmtC = n => Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtN = n => Number(n||0).toLocaleString("th-TH");

export default function SalesOverview({sh}){
  const{sales,products,contacts,brands,cu,lang}=sh;
  const isSales=cu.role!=="Admin"&&!!cu.salesName;

  const now=new Date();
  const curYear=now.getFullYear();
  const curQ=Math.ceil((now.getMonth()+1)/3);
  const[year,setYear]=useState(String(curYear));
  const[quarter,setQuarter]=useState(String(curQ));
  const[salesFilter,setSalesFilter]=useState(isSales?cu.salesName:"all");
  const[brandFilter,setBrandFilter]=useState("all");

  // Build product map
  const prodMap=useMemo(()=>{const m={};products.forEach(p=>{m[p.id]=p;});return m;},[products]);
  // Build contact map
  const contMap=useMemo(()=>{const m={};contacts.forEach(c=>{m[c.id]=c;});return m;},[contacts]);

  // Available years from sales data
  const years=useMemo(()=>{
    const s=new Set();
    sales.forEach(so=>{if(so.date)s.add(so.date.split("-")[0]);});
    s.add(String(curYear));
    return [...s].sort().reverse();
  },[sales,curYear]);

  // Available salespersons
  const salesPersons=useMemo(()=>{
    const s=new Set();
    contacts.filter(c=>c.type==="customer"&&c.salesPerson).forEach(c=>s.add(c.salesPerson));
    return [...s].sort();
  },[contacts]);

  // Active month indices based on quarter
  const activeMonths=useMemo(()=>{
    if(quarter==="all")return [0,1,2,3,4,5,6,7,8,9,10,11];
    return Q_MONTHS[quarter]||[0,1,2];
  },[quarter]);

  // Compute pivot data
  const{rows,grandTotals,totalAmount,totalSO,totalCustomers}=useMemo(()=>{
    const yr=+year;
    // Filter sales
    const filtered=sales.filter(so=>{
      if(!so.date)return false;
      if(so.status==="cancelled")return false;
      const[y]=so.date.split("-");
      if(+y!==yr)return false;
      if(quarter!=="all"){
        const m=+so.date.split("-")[1];
        const qMonths=Q_MONTHS[quarter];
        if(!qMonths||!qMonths.includes(m-1))return false;
      }
      return true;
    });

    // Build customer→brand→month aggregation
    const agg={};// key: `${customerId}|${brand}` → { months: {0:amt,...}, total }
    const custSet=new Set();

    filtered.forEach(so=>{
      const cust=contMap[so.customerId];
      if(!cust)return;
      // Filter by salesperson
      const sp=cust.salesPerson||"";
      if(isSales&&sp!==cu.salesName)return;
      if(!isSales&&salesFilter!=="all"&&sp!==salesFilter)return;

      const month=+so.date.split("-")[1]-1;// 0-based
      custSet.add(so.customerId);

      so.items.forEach(item=>{
        const pr=prodMap[item.productId];
        if(!pr)return;
        const brand=pr.brand||"-";
        if(brandFilter!=="all"&&brand!==brandFilter)return;
        const amt=(item.qty||0)*(item.price||0);
        const key=so.customerId+"|"+brand;
        if(!agg[key])agg[key]={customerId:so.customerId,brand,months:{},total:0};
        agg[key].months[month]=(agg[key].months[month]||0)+amt;
        agg[key].total+=amt;
      });
    });

    // Convert to rows sorted by customer name then brand
    const rowArr=Object.values(agg).sort((a,b)=>{
      const na=(contMap[a.customerId]?.nameT||contMap[a.customerId]?.name||"").toLowerCase();
      const nb=(contMap[b.customerId]?.nameT||contMap[b.customerId]?.name||"").toLowerCase();
      if(na!==nb)return na<nb?-1:1;
      return a.brand<b.brand?-1:1;
    });

    // Grand totals per month
    const gt={};
    let ta=0;
    rowArr.forEach(r=>{
      ta+=r.total;
      activeMonths.forEach(m=>{gt[m]=(gt[m]||0)+(r.months[m]||0);});
    });

    return{rows:rowArr,grandTotals:gt,totalAmount:ta,totalSO:filtered.length,totalCustomers:custSet.size};
  },[sales,products,contacts,year,quarter,salesFilter,brandFilter,prodMap,contMap,activeMonths,isSales,cu.salesName]);

  // Group rows by customer for rowspan display
  const grouped=useMemo(()=>{
    const g=[];
    let prev=null;
    rows.forEach(r=>{
      if(prev&&prev.customerId===r.customerId){
        g[g.length-1].items.push(r);
      }else{
        g.push({customerId:r.customerId,items:[r]});
      }
      prev=r;
    });
    return g;
  },[rows]);

  // Export CSV
  const exportCSV=()=>{
    const mLabels=lang==="th"?MONTHS_TH:MONTHS_EN;
    const hdr=["ลูกค้า","เซลส์","ยี่ห้อ",...activeMonths.map(m=>mLabels[m]),"รวม"];
    const csvRows=rows.map(r=>{
      const c=contMap[r.customerId];
      return[
        c?.nameT||c?.name||"-",
        c?.salesPerson||"-",
        r.brand,
        ...activeMonths.map(m=>r.months[m]?fmtC(r.months[m]):""),
        fmtC(r.total)
      ];
    });
    // Grand total row
    csvRows.push(["รวมทั้งหมด","","", ...activeMonths.map(m=>grandTotals[m]?fmtC(grandTotals[m]):""), fmtC(totalAmount)]);
    dlCSV(`sales-overview-${year}-Q${quarter}.csv`,[hdr,...csvRows]);
  };

  const mLabels=lang==="th"?MONTHS_TH:MONTHS_EN;

  const CS={padding:"7px 10px",textAlign:"right",fontSize:12,borderBottom:"0.5px solid var(--line)",whiteSpace:"nowrap"};
  const HS={...CS,fontWeight:600,color:"var(--dim)",background:"var(--bg)",position:"sticky",top:0,zIndex:1};

  return <div>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <div>
        <h2 style={{margin:0,fontSize:18,fontWeight:700}}>{lang==="th"?"ภาพรวมเซลส์":"Sales Overview"}</h2>
        <div style={{fontSize:12,color:"var(--dim)",marginTop:3}}>{lang==="th"?"ยอดซื้อแยกตามลูกค้า / ยี่ห้อ / เดือน":"Customer purchases by brand / month"}</div>
      </div>
      {rows.length>0&&<button onClick={exportCSV} style={{padding:"7px 16px",borderRadius:7,border:"0.5px solid var(--line)",background:"var(--bg)",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"var(--text)"}}>Export CSV</button>}
    </div>

    {/* Filters */}
    <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div style={{minWidth:100}}>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:4,fontWeight:500}}>{lang==="th"?"ปี":"Year"}</div>
        <CustomSelect value={year} onChange={v=>setYear(v)} options={years.map(y=>({value:y,label:String(+y+543)}))}/>
      </div>
      <div style={{minWidth:120}}>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:4,fontWeight:500}}>{lang==="th"?"ไตรมาส":"Quarter"}</div>
        <CustomSelect value={quarter} onChange={v=>setQuarter(v)} options={[
          {value:"all",label:lang==="th"?"ทั้งปี":"All Year"},
          {value:"1",label:"Q1 ("+MONTHS_TH[0]+"-"+MONTHS_TH[2]+")"},
          {value:"2",label:"Q2 ("+MONTHS_TH[3]+"-"+MONTHS_TH[5]+")"},
          {value:"3",label:"Q3 ("+MONTHS_TH[6]+"-"+MONTHS_TH[8]+")"},
          {value:"4",label:"Q4 ("+MONTHS_TH[9]+"-"+MONTHS_TH[11]+")"},
        ]}/>
      </div>
      {!isSales&&<div style={{minWidth:160}}>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:4,fontWeight:500}}>{lang==="th"?"เซลส์":"Salesperson"}</div>
        <CustomSelect value={salesFilter} onChange={v=>setSalesFilter(v)} options={[{value:"all",label:lang==="th"?"ทุกเซลส์":"All"}, ...salesPersons.map(s=>({value:s,label:s}))]}/>
      </div>}
      <div style={{minWidth:140}}>
        <div style={{fontSize:11,color:"var(--dim)",marginBottom:4,fontWeight:500}}>{lang==="th"?"ยี่ห้อ":"Brand"}</div>
        <CustomSelect searchable value={brandFilter} onChange={v=>setBrandFilter(v)} options={[{value:"all",label:lang==="th"?"ทุกยี่ห้อ":"All"}, ...(brands||[]).map(b=>({value:b,label:b}))]}/>
      </div>
    </div>

    {/* Summary cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10,marginBottom:20}}>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--dim)",fontWeight:500}}>{lang==="th"?"ยอดรวม":"Total Amount"}</div>
        <div style={{fontSize:18,fontWeight:700,marginTop:4,color:"var(--green)"}}>{"฿"+fmtC(totalAmount)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--dim)",fontWeight:500}}>{lang==="th"?"จำนวน SO":"Total SO"}</div>
        <div style={{fontSize:18,fontWeight:700,marginTop:4}}>{fmtN(totalSO)}</div>
      </div>
      <div style={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--dim)",fontWeight:500}}>{lang==="th"?"จำนวนลูกค้า":"Customers"}</div>
        <div style={{fontSize:18,fontWeight:700,marginTop:4}}>{fmtN(totalCustomers)}</div>
      </div>
    </div>

    {/* Data table */}
    {rows.length===0
      ?<div style={{textAlign:"center",color:"var(--dim)",padding:"3rem",fontSize:14}}>{lang==="th"?"ไม่มีข้อมูล":"No data"}</div>
      :<div style={{overflowX:"auto",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={{...HS,textAlign:"left",minWidth:140}}>{lang==="th"?"ลูกค้า":"Customer"}</th>
              {!isSales&&<th style={{...HS,textAlign:"left",minWidth:80}}>{lang==="th"?"เซลส์":"Sales"}</th>}
              <th style={{...HS,textAlign:"left",minWidth:90}}>{lang==="th"?"ยี่ห้อ":"Brand"}</th>
              {activeMonths.map(m=><th key={m} style={{...HS,minWidth:80}}>{mLabels[m]}</th>)}
              <th style={{...HS,minWidth:100,color:"var(--text)"}}>{lang==="th"?"รวม":"Total"}</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(g=>{
              const c=contMap[g.customerId];
              const custName=c?.nameT||c?.name||"-";
              const sp=c?.salesPerson||"-";
              const custTotal=g.items.reduce((s,r)=>s+r.total,0);
              return g.items.map((r,ri)=><tr key={g.customerId+"-"+r.brand} style={{background:ri===0?"transparent":"transparent"}}>
                {ri===0&&<td rowSpan={g.items.length} style={{...CS,textAlign:"left",fontWeight:600,verticalAlign:"top",borderRight:"0.5px solid var(--line)"}}>{custName}</td>}
                {ri===0&&!isSales&&<td rowSpan={g.items.length} style={{...CS,textAlign:"left",color:"var(--dim)",verticalAlign:"top",borderRight:"0.5px solid var(--line)"}}>{sp}</td>}
                <td style={{...CS,textAlign:"left",color:"var(--blue)"}}>{r.brand}</td>
                {activeMonths.map(m=><td key={m} style={{...CS,color:r.months[m]?"var(--text)":"var(--faint)"}}>{r.months[m]?fmtC(r.months[m]):"-"}</td>)}
                <td style={{...CS,fontWeight:600}}>{fmtC(r.total)}</td>
              </tr>);
            })}
            {/* Grand total row */}
            <tr style={{borderTop:"2px solid var(--text)"}}>
              <td colSpan={isSales?2:3} style={{...CS,textAlign:"left",fontWeight:700,fontSize:13}}>{lang==="th"?"รวมทั้งหมด":"Grand Total"}</td>
              {activeMonths.map(m=><td key={m} style={{...CS,fontWeight:700,fontSize:13}}>{grandTotals[m]?fmtC(grandTotals[m]):"-"}</td>)}
              <td style={{...CS,fontWeight:700,fontSize:14,color:"var(--green)"}}>{fmtC(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    }
  </div>;
}

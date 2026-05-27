import { STOCK_STATUS } from "./constants.js";

export const fmt = n => Number(n).toLocaleString("th-TH");
export const todayStr = () => {const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
export const nowStr = () => {const d=new Date();return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+(d.getFullYear()+543)+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");};
export const toBE = d => {if(!d)return"-";const p=(d||"").split("-");if(p.length!==3)return d;return p[2]+"/"+p[1]+"/"+(+p[0]+543);};
export const fmtD = s => {if(!s||s==="-")return"-";if(s.includes("-")&&s.split("-").length===3)return toBE(s);const[datePart,timePart]=(s+" ").split(" ");const dp=datePart.split("/");if(dp.length===3){let y=+dp[2];if(y<100)y+=2500;dp[0]=dp[0].padStart(2,"0");dp[1]=dp[1].padStart(2,"0");return dp[0]+"/"+dp[1]+"/"+y+(timePart.trim()?" "+timePart.trim():"");}return s;};
export const mkLog = (pid,type,qty,before,after,ref,note,user) => ({id:Date.now()+Math.random(),date:nowStr(),productId:+pid,type,qty:+qty,qtyBefore:+before,qtyAfter:+after,ref:ref||"-",note:note||"",user:user||"system"});
export const mkAudit = (action,detail,user) => ({id:Date.now()+Math.random(),date:nowStr(),action,detail,user:user||"system"});
export const AddDue = (d,n) => {const p=(d||"").split("-");if(p.length!==3)return d;const x=new Date(+p[0],+p[1]-1,+p[2]);x.setDate(x.getDate()+n);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");};
export const fmtDur = s => {if(!s||s<0)return"-";if(s<60)return s+"วิ";const m=Math.floor(s/60);if(m<60)return m+"น.";return Math.floor(m/60)+"ชม. "+(m%60)+"น.";};
export const getSS = (pid,sales) => {
  let last = null;
  (sales||[]).filter(s=>s.status==="completed").forEach(so=>(so.items||[]).forEach(i=>{if(i.productId===pid){const d=new Date(so.date).getTime();if(!last||d>last)last=d;}}));
  if(!last)return{key:"fossil",label:"Fossil",color:"#666",bg:"#e8e8e8",icon:"F",days:null};
  const days = Math.floor((Date.now()-last)/864e5);
  return{...(STOCK_STATUS.find(s=>days<=s.maxDays)||STOCK_STATUS[3]),days};
};
export const getNotifs = (products,sales,pos,payments,quotes) => {
  const n=[];const now=new Date();
  (products||[]).filter(p=>p.minStock>0&&p.stock<=p.minStock).forEach(p=>n.push({type:"warning",icon:"!",msg:p.brand+" — "+(p.nameT||p.name)+" สต็อกต่ำ (เหลือ "+p.stock+")"}));
  (pos||[]).forEach(po=>{
    const d=Math.floor((now-new Date(po.date))/864e5);
    if(po.status==="pending"&&d>14)n.push({type:"warning",icon:"PO",msg:po.poNum+" ค้าง "+d+" วัน"});
    else if(po.status==="pending_approval")n.push({type:"info",icon:"!",msg:po.poNum+" รอการอนุมัติ"});
    else if(po.status==="approved"&&d>14)n.push({type:"warning",icon:"PO",msg:po.poNum+" อนุมัติแล้ว ค้าง "+d+" วัน"});
  });
  (quotes||[]).filter(q=>q.status==="sent"&&q.validUntil).forEach(q=>{const d=Math.floor((new Date(q.validUntil)-now)/864e5);if(d<0)n.push({type:"danger",icon:"QT",msg:q.qtNum+" หมดอายุ"});else if(d<=3)n.push({type:"warning",icon:"QT",msg:q.qtNum+" หมดอายุใน "+d+"d"});});
  return n;
};

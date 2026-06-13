const LABELS={pending:"รอดำเนินการ",pending_delivery:"รอส่ง",out_for_delivery:"เตรียมส่ง",received:"รับแล้ว",cancelled:"ยกเลิก",completed:"ส่งแล้ว",draft:"Draft",pending_approval:"รออนุมัติ",approved:"อนุมัติแล้ว",pending_special_approval:"รออนุมัติพิเศษ"};
const M={
  pending:["rgba(255,149,0,0.14)","var(--orange)"],
  pending_delivery:["var(--blue-bg)","var(--blue)"],
  out_for_delivery:["rgba(255,149,0,0.14)","var(--orange)"],
  received:["rgba(52,199,89,0.12)","var(--green)"],
  cancelled:["rgba(255,59,48,0.12)","var(--red)"],
  completed:["rgba(52,199,89,0.12)","var(--green)"],
  draft:["var(--hover)","var(--dim)"],
  pending_approval:["rgba(255,149,0,0.14)","var(--orange)"],
  pending_special_approval:["rgba(175,82,222,0.12)","var(--purple)"],
  approved:["rgba(52,199,89,0.12)","var(--green)"],
  supplier:["rgba(175,82,222,0.12)","var(--purple)"],
  customer:["rgba(52,199,89,0.12)","var(--green)"],
  Admin:["rgba(175,82,222,0.12)","var(--purple)"],
  Manager:["var(--blue-bg)","var(--blue)"],
  Sales:["rgba(52,199,89,0.12)","var(--green)"],
  Warehouse:["rgba(255,149,0,0.14)","var(--orange)"],
  Accountant:["var(--hover)","var(--dim)"],
  Supplier:["rgba(255,149,0,0.14)","var(--orange)"],
  Staff:["var(--hover)","var(--dim)"],
};
export default function Badge({status}){
  const c=M[status]||["var(--hover)","var(--dim)"];
  return <span style={{fontSize:11.5,padding:"2px 8px",borderRadius:99,background:c[0],color:c[1],fontWeight:500}}>{LABELS[status]||status}</span>;
}

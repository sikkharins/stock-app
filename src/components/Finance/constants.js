// Finance-specific constants — shared between Finance.jsx and its sub-components
// (Cheque, Bank, etc.) Extracted from inline definitions during Strategy C incremental split.

export const CHQ_ST = [
  {key:"pending",label:"รอขึ้นเงิน",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},
  {key:"deposited",label:"นำฝากแล้ว",color:"var(--blue)",bg:"var(--blue-bg)"},
  {key:"cleared",label:"เคลียร์แล้ว",color:"var(--green)",bg:"rgba(52,199,89,0.12)"},
  {key:"bounced",label:"เด้ง",color:"var(--red)",bg:"rgba(255,59,48,0.12)"},
];

export const THAI_BANKS = [
  {value:"ธนาคารกรุงเทพ (Bangkok Bank)",label:"ธนาคารกรุงเทพ (BBL)",color:"#1e3a7b",icon:"/icons/banks/bbl.png"},
  {value:"ธนาคารกสิกรไทย (KBank)",label:"ธนาคารกสิกรไทย (KBank)",color:"#138f2d",icon:"/icons/banks/kbank.png"},
  {value:"ธนาคารกรุงไทย (Krungthai)",label:"ธนาคารกรุงไทย (KTB)",color:"#1ba5e1",icon:"/icons/banks/ktb.png"},
  {value:"ธนาคารไทยพาณิชย์ (SCB)",label:"ธนาคารไทยพาณิชย์ (SCB)",color:"#4e2a82",icon:"/icons/banks/scb.png"},
  {value:"ธนาคารกรุงศรีอยุธยา (Krungsri)",label:"ธนาคารกรุงศรีอยุธยา (BAY)",color:"#fec43b",icon:"/icons/banks/bay.png"},
  {value:"ธนาคารทหารไทยธนชาต (ttb)",label:"ธนาคารทหารไทยธนชาต (ttb)",color:"#fc4f1f",icon:"/icons/banks/ttb.png"},
  {value:"ธนาคารซีไอเอ็มบีไทย (CIMB)",label:"ธนาคารซีไอเอ็มบีไทย (CIMB)",color:"#7b0046",icon:"/icons/banks/cimb.png"},
  {value:"ธนาคารยูโอบี (UOB)",label:"ธนาคารยูโอบี (UOB)",color:"#0b3979",icon:"/icons/banks/uob.png"},
  {value:"ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)",label:"ธ.ก.ส. (BAAC)",color:"#4b9b1d",icon:"/icons/banks/baac.png"},
  {value:"ธนาคารออมสิน",label:"ธนาคารออมสิน (GSB)",color:"#eb198d",icon:"/icons/banks/gsb.png"},
];

export const BANK_OPTS = [{value:"",label:"เลือกธนาคาร"},...THAI_BANKS];

export const CN_TYPES = [
  {key:"return",label:"คืนสินค้า",color:"var(--blue)",bg:"var(--blue-bg)"},
  {key:"defective",label:"สินค้าชำรุด",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},
  {key:"promo",label:"โปรโมชั่น",color:"var(--purple)",bg:"rgba(175,82,222,0.14)"},
];

// Bank account permissions — used by Bank tab, Cheque clear modal, and addPay (AR/AP)
export const DEF_PERMS = {receive:true, clearCheque:true, payEPP:true, transferOut:true};
export const hasPerm = (acc, key) => {
  const p = acc.perms;
  if (!p) return true;
  if (key === "payEPP") return p.payEPP !== undefined ? !!p.payEPP : p.payOnline !== undefined ? !!p.payOnline : true;
  if (key === "transferOut") return p.transferOut !== undefined ? !!p.transferOut : true;
  return p[key] !== undefined ? !!p[key] : true;
};

// Auto-tag flow definitions — UI consumes this for the tagSettings modal in Bank tab
export const FLOW_DEFS = [
  {key:"ar_cash",                label:"รับเงินสดจาก SO",            direction:"in"},
  {key:"ar_bank",                label:"ลูกค้าโอนเงินจ่าย SO",       direction:"in"},
  {key:"ar_cheque",              label:"รับเช็คจาก SO (เคลีย)",      direction:"in"},
  {key:"ar_batch",               label:"รวมหลาย SO (batch)",         direction:"in"},
  {key:"ap_cash",                label:"จ่ายซัพด้วยเงินสด",          direction:"out"},
  {key:"ap_bank",                label:"โอนเงินจ่ายซัพ",             direction:"out"},
  {key:"ap_epp",                 label:"จ่ายซัพ EPP",                direction:"out"},
  {key:"ap_cheque",              label:"จ่ายเช็คซัพ (เคลีย)",        direction:"out"},
  {key:"ap_batch",               label:"รวมหลาย PO (batch AP)",      direction:"out"},
  {key:"transfer_depositToBank", label:"ฝากเงินสดเข้าธนาคาร",       direction:"both"},
  {key:"transfer_withdrawFromBank", label:"ถอนเงินจากธนาคาร",       direction:"both"},
  {key:"transfer_interAccount",  label:"โอนระหว่างบัญชี",            direction:"both"},
  {key:"withdraw",               label:"ถอนเงินสด (modal เก่า)",     direction:"out"},
  {key:"adjust_over",            label:"ปรับยอด (เกิน)",             direction:"in"},
  {key:"adjust_short",           label:"ปรับยอด (ขาด)",              direction:"out"},
];

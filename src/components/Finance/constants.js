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

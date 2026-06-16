export const ALL_TABS = ["dashboard","products","stock_log","stock_count","purchase","sales","promos","events","finance","reports","sales_overview","financial_calendar","suppliers","customers","defective","delivery_planning","ai_bot"];
export const TAB_LABELS = {dashboard:{en:"Dashboard",th:"แดชบอร์ด"},products:{en:"Products",th:"สินค้า"},stock_log:{en:"Stock Log",th:"ประวัติสต็อก"},stock_count:{en:"AI Count",th:"ตรวจนับ AI"},purchase:{en:"Purchase Orders",th:"ใบสั่งซื้อ"},sales:{en:"Sales",th:"การขาย"},finance:{en:"Finance",th:"การเงิน"},reports:{en:"Reports",th:"รายงาน"},suppliers:{en:"Suppliers",th:"ซัพพลายเออร์"},customers:{en:"Customers",th:"ลูกค้า"},users:{en:"Users",th:"จัดการ User"},defective:{en:"Defective",th:"สินค้าชำรุด"},promos:{en:"Promotions",th:"โปรโมชั่น"},events:{en:"Events",th:"งานอีเวนต์"},sales_overview:{en:"Sales Overview",th:"ภาพรวมเซลส์"},financial_calendar:{en:"Cash Flow",th:"ปฏิทินการเงิน"},delivery_planning:{en:"Delivery Planning",th:"วางแผนจัดส่ง"},ai_bot:{en:"AI Bot",th:"AI Bot"}};
export const MOVE_TYPES = {in:{label:"รับเข้า (IN)",color:"var(--green)",bg:"rgba(52,199,89,0.12)"},out:{label:"จ่ายออก (OUT)",color:"var(--red)",bg:"rgba(255,59,48,0.12)"},adjust_in:{label:"ปรับเพิ่ม",color:"var(--blue)",bg:"var(--blue-bg)"},adjust_out:{label:"ปรับลด",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},cn_return:{label:"CN คืนสินค้า",color:"var(--green)",bg:"rgba(52,199,89,0.12)"},cn_cancel:{label:"ยกเลิก CN",color:"var(--red)",bg:"rgba(255,59,48,0.12)"},cn_edit:{label:"แก้ไข CN",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"},cn_defective:{label:"CN สินค้าชำรุด",color:"var(--orange)",bg:"rgba(255,149,0,0.14)"}};
export const BRAND_COLORS = ["transparent","transparent","transparent","transparent","transparent","transparent","transparent","transparent"];
export const STOCK_STATUS = [{key:"active",label:"Active",color:"var(--green)",bg:"rgba(52,199,89,0.12)",icon:"A",maxDays:7},{key:"slow",label:"Slow",color:"var(--orange)",bg:"rgba(255,149,0,0.14)",icon:"S",maxDays:30},{key:"dead",label:"Dead",color:"var(--red)",bg:"rgba(255,59,48,0.12)",icon:"D",maxDays:90},{key:"fossil",label:"Fossil",color:"var(--faint)",bg:"var(--hover)",icon:"F",maxDays:180}];
export const DASH_WIDGETS = [{key:"products",label:"การ์ดสินค้า"},{key:"sales_total",label:"การ์ดยอดขาย"},{key:"profit",label:"การ์ดกำไร"},{key:"stock_value",label:"มูลค่าสต็อก (donut)"},{key:"sales_chart",label:"กราฟยอดขาย vs ซื้อ"},{key:"sales_target",label:"เป้ายอดขาย (เกจ)"},{key:"low_stock",label:"สต็อกต่ำ"},{key:"top_products",label:"สินค้าขายดี Top 5"},{key:"recent_so",label:"การขายล่าสุด"},{key:"recent_po",label:"PO ล่าสุด"},{key:"recent_log",label:"สต็อกล่าสุด"}];
export const ALL_WIDGET_KEYS = DASH_WIDGETS.map(w => w.key);

// Sections สำหรับ reorder บน Dashboard — stats รวม 3 การ์ด, ที่เหลือ 1 widget = 1 section
export const DASH_SECTIONS = [
  {key:"stats",label:"การ์ดสถิติ",widgetKeys:["products","sales_total","profit"]},
  {key:"stock_value",label:"มูลค่าสต็อก",widgetKeys:["stock_value"]},
  {key:"sales_chart",label:"กราฟยอดขาย vs ซื้อ",widgetKeys:["sales_chart"]},
  {key:"sales_target",label:"เป้ายอดขาย (เกจ)",widgetKeys:["sales_target"]},
  {key:"low_stock",label:"แจ้งเตือนสต็อกต่ำ",widgetKeys:["low_stock"]},
  {key:"top_products",label:"สินค้าขายดี Top 5",widgetKeys:["top_products"]},
  {key:"recent_so",label:"การขายล่าสุด",widgetKeys:["recent_so"]},
  {key:"recent_po",label:"PO ล่าสุด",widgetKeys:["recent_po"]},
  {key:"recent_log",label:"สต็อกล่าสุด",widgetKeys:["recent_log"]},
];
export const ALL_SECTION_KEYS = DASH_SECTIONS.map(s => s.key);
export const DISC_OPTS = [0,1];
export const CREDIT_OPTS = [45,60,90];
export const IB = {width:"100%",boxSizing:"border-box",background:"var(--bg2)",border:"1px solid var(--line)",borderRadius:7,padding:"7px 12px",fontSize:13,color:"var(--text)",fontFamily:"inherit"};

const _mkSP = () => ({dashboard:{access:true,read:true,create:false,edit:false,delete:false},products:{access:true,read:true,create:false,edit:false,delete:false},stock_log:{access:false,read:false,create:false,edit:false,delete:false},purchase:{access:false,read:false,create:false,edit:false,delete:false},sales:{access:true,read:true,create:true,edit:false,delete:false},finance:{access:false,read:false,create:false,edit:false,delete:false},reports:{access:false,read:false,create:false,edit:false,delete:false},suppliers:{access:false,read:false,create:false,edit:false,delete:false},customers:{access:true,read:true,create:false,edit:false,delete:false},users:{access:false,read:false,create:false,edit:false,delete:false}});
const _mkSupP = () => ({dashboard:{access:true,read:true,create:false,edit:false,delete:false},products:{access:true,read:true,create:false,edit:false,delete:false},stock_log:{access:true,read:true,create:false,edit:false,delete:false},purchase:{access:true,read:true,create:false,edit:false,delete:false},sales:{access:false,read:false,create:false,edit:false,delete:false},finance:{access:false,read:false,create:false,edit:false,delete:false},reports:{access:false,read:false,create:false,edit:false,delete:false},suppliers:{access:false,read:false,create:false,edit:false,delete:false},customers:{access:false,read:false,create:false,edit:false,delete:false},users:{access:false,read:false,create:false,edit:false,delete:false}});

export const initBrands = ["LG","Samsung","Hitachi","Toshiba","Daikin","Mitsubishi Electric","Panasonic"];
export const initCats = [{id:1,name:"ตู้เย็น",subs:[{id:11,name:"ประตูเดียว"},{id:12,name:"2 ประตู"},{id:13,name:"หลายประตู"},{id:14,name:"Side by Side"}]},{id:2,name:"ทีวี",subs:[{id:21,name:"LED"},{id:22,name:"OLED"},{id:23,name:"QLED"},{id:24,name:"Smart TV"}]},{id:3,name:"เครื่องซักผ้า",subs:[{id:31,name:"ฝาบน"},{id:32,name:"ฝาหน้า"},{id:33,name:"ฝาบน อินเวอร์เตอร์"}]},{id:4,name:"แอร์",subs:[{id:41,name:"แบบแยกส่วน"},{id:42,name:"แบบหน้าต่าง"},{id:43,name:"อินเวอร์เตอร์"}]}];
export const initProducts = [{id:1,code:"P001",name:"LG 2-Door Fridge 14Q",nameT:"ตู้เย็น LG 2 ประตู 14 คิว",brand:"LG",categoryId:1,subcategoryId:12,size:"14 คิว",price:12900,cost:9500,stock:8,minStock:3,unit:"เครื่อง",distributor:"Bangkok Supply Co."},{id:2,code:"P002",name:"Samsung 55in QLED TV",nameT:"ทีวี Samsung QLED 55 นิ้ว",brand:"Samsung",categoryId:2,subcategoryId:23,size:"55 นิ้ว",price:28900,cost:22000,stock:5,minStock:2,unit:"เครื่อง",distributor:"Siam Industrial"},{id:3,code:"P003",name:"Hitachi Top-Load 15kg",nameT:"เครื่องซักผ้า Hitachi ฝาบน 15กก.",brand:"Hitachi",categoryId:3,subcategoryId:31,size:"15 กก.",price:9500,cost:7200,stock:12,minStock:4,unit:"เครื่อง",distributor:"Bangkok Supply Co."},{id:4,code:"P004",name:"Daikin Inverter 12000BTU",nameT:"แอร์ Daikin อินเวอร์เตอร์ 12000 BTU",brand:"Daikin",categoryId:4,subcategoryId:43,size:"12000 BTU",price:18500,cost:14000,stock:6,minStock:2,unit:"เครื่อง",distributor:""},{id:5,code:"P005",name:"Toshiba 1-Door Fridge 6.4Q",nameT:"ตู้เย็น Toshiba ประตูเดียว 6.4 คิว",brand:"Toshiba",categoryId:1,subcategoryId:11,size:"6.4 คิว",price:5490,cost:3900,stock:2,minStock:3,unit:"เครื่อง",distributor:"Siam Industrial"}];
const _mkStaffP=(dash,slog,rep)=>({dashboard:{access:dash,read:dash,create:false,edit:false,delete:false},products:{access:true,read:true,create:false,edit:false,delete:false},stock_log:{access:slog,read:slog,create:false,edit:false,delete:false},purchase:{access:true,read:true,create:false,edit:false,delete:false},sales:{access:false,read:false,create:false,edit:false,delete:false},finance:{access:false,read:false,create:false,edit:false,delete:false},reports:{access:rep,read:rep,create:false,edit:false,delete:false},suppliers:{access:false,read:false,create:false,edit:false,delete:false},customers:{access:false,read:false,create:false,edit:false,delete:false},users:{access:false,read:false,create:false,edit:false,delete:false}});
export const initContacts = [{id:1,type:"supplier",name:"Bangkok Supply Co.",nameT:"บริษัท แบงค็อก ซัพพลาย",phone:"02-111-2222",email:"info@bkksupply.th",address:"",taxId:"",vatReps:[],staff:[{id:101,name:"สมชาย บีเคเค",roleTitle:"Sales",phone:"081-111-2222",email:"somchai@bkksupply.th",lineId:"somchai_bkk",username:"bkk_somchai",password:"staff1",dashboardWidgets:["products","stock_value","recent_po","recent_log"],perms:_mkStaffP(false,false,false)},{id:102,name:"สมศักดิ์ บีเคเค",roleTitle:"Manager",phone:"081-333-4444",email:"manager@bkksupply.th",lineId:"mgr_bkk",username:"bkk_manager",password:"staff2",dashboardWidgets:["products","stock_value","recent_po","recent_log"],perms:_mkStaffP(true,true,true)}]},{id:2,type:"supplier",name:"Siam Industrial",nameT:"สยามอุตสาหกรรม",phone:"02-333-4444",email:"sales@siamind.th",address:"",taxId:"",vatReps:[],staff:[]},{id:3,type:"customer",name:"Chiang Mai Builder",nameT:"เชียงใหม่บิลเดอร์",phone:"053-555-666",email:"cm@builder.th",address:"123 ถ.นิมมาน เชียงใหม่ 50200",taxId:"0105558123456",salesPerson:"สมชาย",vatReps:[{id:1,name:"นายสมศักดิ์ วิชาการ",address:"55/2 ถ.ห้วยแก้ว เชียงใหม่ 50200",idCard:"1100100100001"},{id:2,name:"นางสมศรี รักดี",address:"99 ถ.ช้างคลาน เชียงใหม่ 50100",idCard:"1100200200002"}]},{id:4,type:"customer",name:"Pattaya Construct",nameT:"พัทยาคอนสตรัค",phone:"038-777-888",email:"info@pattayac.th",address:"88 ถ.พัทยาสาย 2 ชลบุรี 20150",taxId:"0105559654321",salesPerson:"สมหญิง",vatReps:[{id:3,name:"นายประเสริฐ มั่นคง",address:"22/1 ถ.สุขุมวิท ชลบุรี 20000",idCard:"1200300300003"}]}];
export const initPOs = [];
export const initSales = [];
export const initQuotes = [];
export const initTargets = [{id:1,salesName:"สมชาย",month:"2025-01",target:100000},{id:2,salesName:"สมหญิง",month:"2025-01",target:120000}];
const _wAll=["products","stock_value","sales_total","profit","low_stock","recent_po","recent_log"];
const _wWH=["products","stock_value","low_stock","recent_po","recent_log"];
const _wAC=["sales_total","profit"];
const _wSP=["products","sales_total","profit","low_stock"];
const _wSup=["products","stock_value","recent_po","recent_log"];
export const initUsers = [{id:1,username:"admin",password:"admin123",role:"Admin",dashboardWidgets:_wAll,perms:{dashboard:"edit",products:"edit",stock_log:"view",purchase:"edit",sales:"edit",finance:"edit",reports:"edit",suppliers:"edit",customers:"edit",defective:"edit",users:"edit"}},{id:2,username:"manager",password:"manager123",role:"Manager",dashboardWidgets:_wAll,perms:{dashboard:"view",products:"view",stock_log:"view",purchase:"view",sales:"view",finance:"view",reports:"view",suppliers:"view",customers:"view",defective:"view",users:"none"}},{id:3,username:"warehouse",password:"warehouse123",role:"Warehouse",dashboardWidgets:_wWH,perms:{dashboard:"view",products:"edit",stock_log:"view",purchase:"edit",sales:"none",finance:"none",reports:"none",suppliers:"view",customers:"none",defective:"edit",users:"none"}},{id:4,username:"accountant",password:"accountant123",role:"Accountant",dashboardWidgets:_wAC,perms:{dashboard:"view",products:"none",stock_log:"view",purchase:"none",sales:"none",finance:"edit",reports:"view",suppliers:"none",customers:"none",users:"none"}},{id:5,username:"somchai",password:"123456",role:"Sales",salesName:"สมชาย",dashboardWidgets:_wSP,perms:_mkSP()},{id:6,username:"somying",password:"123456",role:"Sales",salesName:"สมหญิง",dashboardWidgets:_wSP,perms:_mkSP()},{id:7,username:"wichai",password:"123456",role:"Sales",salesName:"วิชัย",dashboardWidgets:_wSP,perms:_mkSP()},{id:8,username:"pimjai",password:"123456",role:"Sales",salesName:"พิมพ์ใจ",dashboardWidgets:_wSP,perms:_mkSP()},{id:9,username:"bkksupply",password:"supplier1",role:"Supplier",supplierName:"Bangkok Supply Co.",dashboardWidgets:_wSup,perms:_mkSupP()},{id:10,username:"siamind",password:"supplier2",role:"Supplier",supplierName:"Siam Industrial",dashboardWidgets:_wSup,perms:_mkSupP()}];

export const initCashCats = [
  { id: 1, name: "ขาย", type: "in", subs: [
    { id: 11, name: "ขายสด (SO)" },
    { id: 12, name: "ขายเศษ" },
    { id: 13, name: "อื่นๆ" },
  ]},
  { id: 2, name: "ซื้อ", type: "out", subs: [
    { id: 21, name: "จ่ายซัพ (PO)" },
    { id: 22, name: "จ่ายซื้อจิปาถะ" },
  ]},
  { id: 3, name: "ค่าใช้จ่ายร้าน", type: "out", subs: [
    { id: 31, name: "ค่ากาแฟ/น้ำดื่ม" },
    { id: 32, name: "ค่าน้ำมัน/เดินทาง" },
    { id: 33, name: "ค่าทำความสะอาด" },
  ]},
  { id: 4, name: "ค่าสาธารณูปโภค", type: "out", subs: [
    { id: 41, name: "ค่าน้ำ" },
    { id: 42, name: "ค่าไฟ" },
    { id: 43, name: "ค่าโทรศัพท์/เน็ต" },
  ]},
  { id: 5, name: "ค่าสถานที่", type: "out", subs: [
    { id: 51, name: "ค่าเช่า" },
    { id: 52, name: "ค่าซ่อมแซม" },
  ]},
  { id: 6, name: "โอน/ถอน/ฝาก", type: "both", subs: [
    { id: 61, name: "ฝากเข้าธนาคาร" },
    { id: 62, name: "ถอนจากธนาคาร" },
    { id: 63, name: "โอนระหว่างบัญชี" },
  ]},
  { id: 7, name: "ปรับยอด", type: "both", subs: [
    { id: 71, name: "เกิน" },
    { id: 72, name: "ขาด" },
  ]},
  { id: 8, name: "อื่นๆ", type: "both", subs: [] },
];

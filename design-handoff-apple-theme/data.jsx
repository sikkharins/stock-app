// Shared sample data — TS Electronics (1992)
// Home appliance retailer (ตู้เย็น/ทีวี/เครื่องซักผ้า/แอร์)
// Based on real data from stock-app/src/data/initData.js — expanded for richer mocks

const COMPANY = {
  nameTH: 'หจก ที เอส อีเลคโทรนิค (1992) สำนักงานใหญ่',
  nameEN: 'TS Electronics (1992) Limited Partnership',
  addr: '99/29 Moo 15, Nong Kradon, Muang, Nakhon Sawan 60240',
  taxId: '0603535000224',
};

const BRANDS = ['LG', 'Samsung', 'Hitachi', 'Toshiba', 'Daikin', 'Mitsubishi Electric', 'Panasonic'];

const CATS = [
  { id: 1, name: 'ตู้เย็น',           nameEN: 'Refrigerators', icon: '❄' },
  { id: 2, name: 'ทีวี',               nameEN: 'TVs',           icon: '▢' },
  { id: 3, name: 'เครื่องซักผ้า',     nameEN: 'Washers',       icon: '◯' },
  { id: 4, name: 'แอร์',               nameEN: 'Air Cond.',     icon: '❅' },
];

const PRODUCTS = [
  { id: 1,  code: 'P001', name: 'LG 2-Door Fridge 14Q',         nameT: 'ตู้เย็น LG 2 ประตู 14 คิว',         brand: 'LG',                  catId: 1, size: '14 คิว',     price: 12900, cost: 9500,  stock: 8,  minStock: 3, daysLastSold: 3,  distributor: 'Bangkok Supply Co.' },
  { id: 2,  code: 'P002', name: 'Samsung QLED TV 55"',           nameT: 'ทีวี Samsung QLED 55 นิ้ว',           brand: 'Samsung',             catId: 2, size: '55"',         price: 28900, cost: 22000, stock: 5,  minStock: 2, daysLastSold: 1,  distributor: 'Siam Industrial' },
  { id: 3,  code: 'P003', name: 'Hitachi Top-Load 15kg',         nameT: 'เครื่องซักผ้า Hitachi ฝาบน 15 กก.',   brand: 'Hitachi',             catId: 3, size: '15 กก.',     price: 9500,  cost: 7200,  stock: 12, minStock: 4, daysLastSold: 5,  distributor: 'Bangkok Supply Co.' },
  { id: 4,  code: 'P004', name: 'Daikin Inverter 12000BTU',      nameT: 'แอร์ Daikin อินเวอร์เตอร์ 12000 BTU', brand: 'Daikin',              catId: 4, size: '12000 BTU',  price: 18500, cost: 14000, stock: 6,  minStock: 2, daysLastSold: 2,  distributor: 'Bangkok Supply Co.' },
  { id: 5,  code: 'P005', name: 'Toshiba 1-Door Fridge 6.4Q',    nameT: 'ตู้เย็น Toshiba ประตูเดียว 6.4 คิว',  brand: 'Toshiba',             catId: 1, size: '6.4 คิว',     price: 5490,  cost: 3900,  stock: 2,  minStock: 3, daysLastSold: 12, distributor: 'Siam Industrial' },
  { id: 6,  code: 'P006', name: 'LG OLED TV 65"',                nameT: 'ทีวี LG OLED 65 นิ้ว',                brand: 'LG',                  catId: 2, size: '65"',         price: 54900, cost: 42000, stock: 3,  minStock: 2, daysLastSold: 4,  distributor: 'Siam Industrial' },
  { id: 7,  code: 'P007', name: 'Mitsubishi Inverter 18000BTU',  nameT: 'แอร์ Mitsubishi อินเวอร์เตอร์ 18000', brand: 'Mitsubishi Electric', catId: 4, size: '18000 BTU',  price: 24900, cost: 19500, stock: 1,  minStock: 3, daysLastSold: 7,  distributor: 'Bangkok Supply Co.' },
  { id: 8,  code: 'P008', name: 'Panasonic Front-Load 10kg',     nameT: 'เครื่องซักผ้า Panasonic ฝาหน้า 10 กก.', brand: 'Panasonic',         catId: 3, size: '10 กก.',     price: 14900, cost: 11200, stock: 4,  minStock: 2, daysLastSold: 9,  distributor: 'Bangkok Supply Co.' },
  { id: 9,  code: 'P009', name: 'Samsung Side-by-Side 18.6Q',    nameT: 'ตู้เย็น Samsung Side-by-Side 18.6 คิว', brand: 'Samsung',           catId: 1, size: '18.6 คิว',    price: 34900, cost: 27000, stock: 0,  minStock: 2, daysLastSold: 35, distributor: 'Siam Industrial' },
  { id: 10, code: 'P010', name: 'Hitachi Smart TV 50"',          nameT: 'ทีวี Hitachi Smart TV 50 นิ้ว',       brand: 'Hitachi',             catId: 2, size: '50"',         price: 15900, cost: 12500, stock: 0,  minStock: 3, daysLastSold: 92, distributor: 'Bangkok Supply Co.' },
];

// Sales targets
const TARGETS = [
  { name: 'สมชาย',   nameEN: 'Somchai',  target: 400000, achieved: 318400, pct: 79.6 },
  { name: 'สมหญิง',  nameEN: 'Somying',  target: 350000, achieved: 287900, pct: 82.2 },
  { name: 'วิชัย',    nameEN: 'Wichai',   target: 300000, achieved: 412800, pct: 137.6 },
  { name: 'พิมพ์ใจ',  nameEN: 'Pimjai',   target: 280000, achieved: 192300, pct: 68.7 },
];

// Customers (real-style construction companies)
const CUSTOMERS = [
  { id: 1, name: 'Chiang Mai Builder',   nameT: 'เชียงใหม่บิลเดอร์',     salesPerson: 'สมชาย',  phone: '053-555-666', addr: 'ถ.นิมมาน เชียงใหม่ 50200', vatReps: 2 },
  { id: 2, name: 'Pattaya Construct',    nameT: 'พัทยาคอนสตรัค',         salesPerson: 'สมหญิง', phone: '038-777-888', addr: 'ถ.พัทยาสาย 2 ชลบุรี 20150', vatReps: 1 },
  { id: 3, name: 'Nakhon Home',          nameT: 'นครโฮม',                 salesPerson: 'วิชัย',   phone: '056-222-111', addr: 'ถ.มาตุลี นครสวรรค์ 60000',   vatReps: 0 },
  { id: 4, name: 'Phuket Resort Supply', nameT: 'ภูเก็ตรีสอร์ทซัพพลาย', salesPerson: 'พิมพ์ใจ', phone: '076-101-202', addr: 'ถ.วิชิตสงคราม ภูเก็ต 83000', vatReps: 1 },
  { id: 5, name: 'Khon Kaen Trading',    nameT: 'ขอนแก่นเทรดดิ้ง',       salesPerson: 'สมชาย',  phone: '043-303-404', addr: 'ถ.หน้าเมือง ขอนแก่น 40000',  vatReps: 0 },
];

const SUPPLIERS = [
  { id: 1, name: 'Bangkok Supply Co.', nameT: 'บริษัท แบงค็อก ซัพพลาย', phone: '02-111-2222' },
  { id: 2, name: 'Siam Industrial',     nameT: 'สยามอุตสาหกรรม',           phone: '02-333-4444' },
  { id: 3, name: 'Nakhon Trading',      nameT: 'นครสวรรค์เทรดดิ้ง',       phone: '056-505-606' },
];

// Stats — computed from real products
const STATS = [
  { key: 'products',    labelTH: 'รายการสินค้า', labelEN: 'Products',     value: '187',     delta: '+5 wk',    trend: 'up' },
  { key: 'stock_value', labelTH: 'มูลค่าสต็อก',  labelEN: 'Stock value',  value: '฿ 4.82M', delta: '+2.1%',    trend: 'up' },
  { key: 'sales_total', labelTH: 'ยอดขาย MTD',   labelEN: 'Sales MTD',    value: '฿ 1.21M', delta: '+18.4%',   trend: 'up' },
  { key: 'profit',      labelTH: 'กำไรขั้นต้น',  labelEN: 'Gross profit', value: '฿ 298K',  delta: '24.6%',    trend: 'up' },
];

// Low stock — derived
const LOW_STOCK = PRODUCTS.filter((p) => p.stock <= p.minStock).map((p) => ({
  code: p.code, name: p.nameT, brand: p.brand, stock: p.stock, min: p.minStock,
}));

// Recent purchase orders
const RECENT_PO = [
  { num: 'PO-2026-014', supplier: 'Bangkok Supply Co.', amount: '฿ 248,500', status: 'pending',  date: '14 พ.ค.', items: 4 },
  { num: 'PO-2026-013', supplier: 'Siam Industrial',     amount: '฿ 89,200',  status: 'received', date: '13 พ.ค.', items: 2 },
  { num: 'PO-2026-012', supplier: 'Bangkok Supply Co.', amount: '฿ 412,800', status: 'received', date: '12 พ.ค.', items: 6 },
  { num: 'PO-2026-011', supplier: 'Nakhon Trading',      amount: '฿ 56,400',  status: 'received', date: '10 พ.ค.', items: 3 },
];

// Sales orders
const SALES = [
  { num: 'SO-2026-089', customer: 'เชียงใหม่บิลเดอร์',   sp: 'สมชาย',   amount: 38790,  vat: true,  pay: 'cash',    status: 'completed',         date: '15 พ.ค.', items: 3 },
  { num: 'SO-2026-088', customer: 'พัทยาคอนสตรัค',       sp: 'สมหญิง',  amount: 28900,  vat: true,  pay: 'credit',  status: 'pending_delivery',  date: '14 พ.ค.', items: 1 },
  { num: 'SO-2026-087', customer: 'นครโฮม',               sp: 'วิชัย',    amount: 124500, vat: true,  pay: 'credit',  status: 'pending_delivery',  date: '14 พ.ค.', items: 5 },
  { num: 'SO-2026-086', customer: 'ภูเก็ตรีสอร์ทซัพพลาย', sp: 'พิมพ์ใจ', amount: 54900,  vat: true,  pay: 'cash',    status: 'completed',         date: '13 พ.ค.', items: 1 },
  { num: 'SO-2026-085', customer: 'ขอนแก่นเทรดดิ้ง',     sp: 'สมชาย',   amount: 12900,  vat: false, pay: 'cash',    status: 'completed',         date: '12 พ.ค.', items: 1 },
  { num: 'SO-2026-084', customer: 'เชียงใหม่บิลเดอร์',   sp: 'สมชาย',   amount: 89400,  vat: true,  pay: 'credit',  status: 'completed',         date: '11 พ.ค.', items: 4 },
  { num: 'SO-2026-083', customer: 'นครโฮม',               sp: 'วิชัย',    amount: 18500,  vat: true,  pay: 'cash',    status: 'completed',         date: '10 พ.ค.', items: 1 },
  { num: 'SO-2026-082', customer: 'พัทยาคอนสตรัค',       sp: 'สมหญิง',  amount: 67400,  vat: true,  pay: 'credit',  status: 'completed',         date: '09 พ.ค.', items: 3 },
];

// Stock log
const RECENT_LOG = [
  { type: 'out',         product: 'LG 2-Door Fridge 14Q',         qty: 3,  ref: 'SO-2026-089', user: 'somchai',   time: '14:22' },
  { type: 'in',          product: 'Hitachi Top-Load 15kg',        qty: 6,  ref: 'PO-2026-013', user: 'warehouse', time: '11:08' },
  { type: 'out',         product: 'Daikin Inverter 12000BTU',     qty: 2,  ref: 'SO-2026-088', user: 'somying',   time: '10:45' },
  { type: 'adjust_out',  product: 'Mitsubishi Inverter 18000',    qty: 1,  ref: 'ADJ-014',     user: 'admin',     time: '09:30' },
  { type: 'in',          product: 'Panasonic Front-Load 10kg',    qty: 4,  ref: 'PO-2026-012', user: 'warehouse', time: '09:12' },
  { type: 'out',         product: 'Samsung QLED TV 55"',          qty: 1,  ref: 'SO-2026-085', user: 'wichai',    time: '08:55' },
];

// Monthly chart — last 6 months (฿ thousands)
const MONTHLY = [
  { m: 'Dec', sales: 880,  purchase: 620 },
  { m: 'Jan', sales: 940,  purchase: 710 },
  { m: 'Feb', sales: 760,  purchase: 540 },
  { m: 'Mar', sales: 1120, purchase: 880 },
  { m: 'Apr', sales: 1340, purchase: 920 },
  { m: 'May', sales: 1210, purchase: 880 },
];

const NAV = [
  { id: 'dashboard',  icon: '▤', labelTH: 'แดชบอร์ด',    labelEN: 'Dashboard' },
  { id: 'products',   icon: '◰', labelTH: 'สินค้า',        labelEN: 'Products' },
  { id: 'stock_log',  icon: '⊟', labelTH: 'บันทึกสต็อก',  labelEN: 'Stock Log' },
  { id: 'purchase',   icon: '⇣', labelTH: 'ใบสั่งซื้อ',     labelEN: 'Purchase Orders', badge: 1 },
  { id: 'sales',      icon: '⇡', labelTH: 'การขาย',       labelEN: 'Sales',           badge: 2 },
  { id: 'finance',    icon: '₿', labelTH: 'การเงิน',       labelEN: 'Finance' },
  { id: 'reports',    icon: '◔', labelTH: 'รายงาน',       labelEN: 'Reports' },
  { id: 'suppliers',  icon: '◐', labelTH: 'ผู้จัดจำหน่าย',  labelEN: 'Suppliers' },
  { id: 'customers',  icon: '◑', labelTH: 'ลูกค้า',         labelEN: 'Customers' },
];

// Stock status helper (matches utils/helpers.js)
function stockStatus(daysLastSold) {
  if (daysLastSold == null) return { key:'never',  label:'ไม่เคยขาย', icon:'⚪', color:'#86868b' };
  if (daysLastSold <= 7)    return { key:'active', label:'Active',    icon:'🟢', color:'#34c759' };
  if (daysLastSold <= 30)   return { key:'slow',   label:'Slow',      icon:'🟡', color:'#ff9500' };
  if (daysLastSold <= 90)   return { key:'dead',   label:'Dead',      icon:'🔴', color:'#ff3b30' };
  return                           { key:'fossil', label:'Fossil',    icon:'⚫', color:'#86868b' };
}

window.TS = {
  COMPANY, BRANDS, CATS, PRODUCTS, TARGETS, CUSTOMERS, SUPPLIERS,
  STATS, LOW_STOCK, RECENT_PO, SALES, RECENT_LOG, MONTHLY, NAV,
  stockStatus,
};

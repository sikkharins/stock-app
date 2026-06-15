// Harness วัดความแม่นของ stock-count engine — ไม่เขียน stock, แค่ยิงรูป → print ผล (มีค่า API)
// รูปเดียว: node scripts/test-stock-count.mjs <img> [--model opus|sonnet|haiku] [--url <endpoint>]
// หลายมุม:  node scripts/test-stock-count.mjs <หน้า.jpg> <ข้าง.jpg> <บน.jpg> --angles หน้า,ข้าง,บน [--model ...] [--url ...]
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const args = process.argv.slice(2);
function takeFlag(name, def) {
  const i = args.indexOf(name);
  return i >= 0 ? { val: args[i + 1], idx: i + 1 } : { val: def, idx: -1 };
}
const { val: model, idx: mi } = takeFlag("--model", "opus");
const { val: url, idx: ui } = takeFlag("--url", "http://localhost:5173/api/stock-count");
const { val: anglesRaw, idx: ai } = takeFlag("--angles", "");
const angles = anglesRaw ? anglesRaw.split(",") : [];
const consumed = new Set([mi, ui, ai].filter((i) => i >= 0));
const imgPaths = args.filter((a, i) => !a.startsWith("--") && !consumed.has(i));

if (imgPaths.length === 0) {
  console.error("ใช้: node scripts/test-stock-count.mjs <img...> [--angles หน้า,ข้าง,บน] [--model opus|sonnet|haiku] [--url <endpoint>]");
  process.exit(1);
}

// catalog ตัวอย่าง — แก้เป็นสินค้าจริงเพื่อทดสอบการจับคู่
const catalog = [
  { id: 1, brand: "Toshiba", name: "ตู้เย็น 2 ประตู 6.4Q", unit: "เครื่อง", desc: "กล่องน้ำตาล" },
  { id: 2, brand: "Hatari", name: "พัดลม 16 นิ้ว", unit: "เครื่อง", desc: "กล่องขาว-ฟ้า" },
];

const images = [];
for (let k = 0; k < imgPaths.length; k++) {
  const buf = await readFile(imgPaths[k]);
  const resized = await sharp(buf)
    .rotate() // auto-orient ตาม EXIF
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  images.push({ base64: resized.toString("base64"), mediaType: "image/jpeg", angle: angles[k] || undefined });
}

console.error(`ยิง ${imgPaths.length} รูป (model=${model}${angles.length ? ", angles=" + angles.join("/") : ""}) -> ${url} ...`);
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ images, catalog, model }),
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));

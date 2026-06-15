// Harness วัดความแม่นของ stock-count engine — ไม่เขียน stock, แค่ยิงรูป → print ผล (มีค่า API)
// ใช้: node scripts/test-stock-count.mjs <image-path> [--model opus|sonnet|haiku] [--url <endpoint>]
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const args = process.argv.slice(2);
const imgPath = args.find((a) => !a.startsWith("--"));
const modelIdx = args.indexOf("--model");
const model = modelIdx >= 0 ? args[modelIdx + 1] : "opus";
const urlIdx = args.indexOf("--url");
const url = urlIdx >= 0 ? args[urlIdx + 1] : "http://localhost:5173/api/stock-count";

if (!imgPath) {
  console.error("ใช้: node scripts/test-stock-count.mjs <image-path> [--model opus|sonnet|haiku] [--url <endpoint>]");
  process.exit(1);
}

// catalog ตัวอย่าง — แก้เป็นสินค้าจริงเพื่อทดสอบการจับคู่
const catalog = [
  { id: 1, brand: "Toshiba", name: "ตู้เย็น 2 ประตู 6.4Q", unit: "เครื่อง", desc: "กล่องน้ำตาล" },
  { id: 2, brand: "Hatari", name: "พัดลม 16 นิ้ว", unit: "เครื่อง", desc: "กล่องขาว-ฟ้า" },
];

const input = await readFile(imgPath);
const resized = await sharp(input)
  .rotate() // auto-orient ตาม EXIF
  .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer();
const base64 = resized.toString("base64");

console.error(`ยิง ${imgPath} (model=${model}) -> ${url} ...`);
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ image: { base64, mediaType: "image/jpeg" }, catalog, model }),
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));

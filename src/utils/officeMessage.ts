// สร้างข้อความ LINE แจ้งเตือนเมื่อส่ง SO เข้าคิวพิมพ์ที่ออฟฟิศ
// ข้อความล้วน: ชื่อร้าน + รายการสินค้า (1 บรรทัด/รายการ) + ตัวแทนออก VAT (ถ้ามี) + เงื่อนไขชำระ

export interface OmItem { productId: number; qty: number; }
export interface OmSO {
  customerId: number;
  items: OmItem[];
  useVatRep?: boolean;
  vatRepName?: string | null;
  payType?: string;
  creditDays?: number;
}
export interface OmProduct { id: number; nameT?: string; name?: string; unit?: string; }
export interface OmContact { id: number; nameT?: string; name?: string; }

export function buildOfficeMessage(
  titleTH: string,
  docNum: string,
  so: OmSO,
  products: OmProduct[],
  contacts: OmContact[],
  maxLen = 4500
): string {
  const contact = contacts.find((c) => c.id === so.customerId);
  const customerName = (contact && (contact.nameT || contact.name)) || "-";
  const lines: string[] = [];
  lines.push(`${titleTH} ${docNum}`.trim());
  lines.push(`ร้าน: ${customerName}`);
  lines.push("รายการ:");
  (so.items || []).forEach((it) => {
    const pr = products.find((p) => p.id === it.productId);
    const name = (pr && (pr.nameT || pr.name)) || "-";
    const unit = (pr && pr.unit) || "";
    lines.push(`- ${name} x${it.qty}${unit ? " " + unit : ""}`);
  });
  if (so.useVatRep && so.vatRepName) {
    lines.push(`ออก VAT ในนาม: ${so.vatRepName}`);
  }
  lines.push(
    so.payType === "credit"
      ? `การชำระ: เครดิต ${so.creditDays || 0} วัน`
      : "การชำระ: เงินสด"
  );
  let out = lines.join("\n");
  if (out.length > maxLen) out = out.slice(0, maxLen - 1) + "…";
  return out;
}

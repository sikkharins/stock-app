export async function sendAIMessage(messages, context, settings = {}) {
  const res = await fetch("/api/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, model: settings.model, lang: settings.lang, customPrompt: settings.customPrompt, allowGeneralChat: settings.allowGeneralChat !== false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "AI request failed");
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return parseAIResponse(text);
}

const unescapeJsonStr = (s) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

// Extract the "message" string even when the JSON is malformed or truncated
// (e.g. response cut off by max_tokens, so the closing quote/brace are missing).
function extractMessageField(src) {
  // closing quote present (well-formed string, but JSON broke elsewhere)
  const full = src.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (full) return unescapeJsonStr(full[1]);
  // truncated mid-string: no closing quote — grab everything to the end
  const partial = src.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)$/);
  if (partial) return unescapeJsonStr(partial[1]);
  return null;
}

function parseAIResponse(text) {
  // 1) try ```json ... ``` block
  const codeMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (codeMatch) {
    try { return JSON.parse(codeMatch[1].trim()); } catch {}
  }
  // 2) try outermost { ... } (well-formed JSON)
  const braceMatch = text.match(/(\{[\s\S]*\})/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[1].trim()); } catch {}
  }
  // 3) JSON malformed or truncated — pull "message" straight from the text so
  //    we render markdown instead of dumping raw JSON to the user.
  if (/"(?:action|message)"\s*:/.test(text)) {
    const msg = extractMessageField(text);
    if (msg) {
      const spkMatch = text.match(/"speak"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const spk = spkMatch ? unescapeJsonStr(spkMatch[1]).replace(/\n/g, " ") : "";
      const actMatch = text.match(/"action"\s*:\s*"([^"]*)"/);
      const speakFallback = msg.replace(/[#*`|>_-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
      return { action: actMatch ? actMatch[1] : "info", message: msg, speak: spk || speakFallback };
    }
  }
  // 4) plain text fallback — never show raw JSON
  const clean = text.replace(/```json[\s\S]*?```/g, "").replace(/\{[\s\S]*\}/g, "").trim() || text;
  const shortSpeak = clean.length > 100 ? clean.slice(0, 100).replace(/[^\s]*$/, "").trim() + "ครับ" : clean;
  return { action: "chat", message: clean, speak: shortSpeak };
}

export function buildContext(products, contacts, sales, pN, cN, cu, pos, payments, quotes) {
  const prods = products.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: pN(p),
    price: p.price,
    cost: p.cost || 0,
    stock: p.stock,
    unit: p.unit || "เครื่อง",
    // ขนาดกล่อง (ซม.) — undefined จะถูกตัดออกจาก JSON เอง ทำให้ตัวที่ยังไม่กรอกไม่มี key นี้
    widthCm: p.widthCm,
    lengthCm: p.lengthCm,
    heightCm: p.heightCm,
    // สินค้าแยกส่วน: ขนาดจริงอยู่ที่แต่ละส่วน (ระดับสินค้าไม่ถูกใช้) — ส่งให้ AI เห็น/แก้ต่อส่วน
    splitParts: p.splitEnabled && Array.isArray(p.splitParts) && p.splitParts.length
      ? p.splitParts.map((pt) => ({ key: pt.key, name: pt.name, widthCm: pt.widthCm, lengthCm: pt.lengthCm, heightCm: pt.heightCm }))
      : undefined,
  }));

  const custs = contacts
    .filter((c) => c.type === "customer")
    .map((c) => ({
      id: c.id,
      name: cN(c),
      nameT: c.nameT || "",
      salesPerson: c.salesPerson || "",
      defaultCreditDays: c.defaultCreditDays || 45,
    }));

  const suppliers = contacts
    .filter((c) => c.type === "supplier")
    .map((c) => ({ id: c.id, name: cN(c), nameT: c.nameT || "" }));

  const allSOs = [...sales]
    .filter((so) => so.status !== "draft")
    .reverse()
    .map((so) => {
      const cust = contacts.find((c) => c.id === so.customerId);
      return {
        soNum: so.soNum,
        custName: cust ? cN(cust) : "-",
        customerId: so.customerId,
        items: (so.items || []).map((i) => {
          const p = products.find((x) => x.id === i.productId);
          return p ? `${p.brand} ${pN(p)} x${i.qty}` : `?x${i.qty}`;
        }).join(", "),
        total: (so.items || []).reduce((s, i) => s + i.qty * i.price, 0) - (so.discountAmt || 0),
        payType: so.payType === "credit" ? `เครดิต ${so.creditDays} วัน` : "เงินสด",
        status: so.status || "รอจัดส่ง",
        date: so.date,
      };
    });

  const allPOs = [...(pos || [])]
    .reverse()
    .map((po) => {
      const sup = contacts.find((c) => c.id === po.supplierId);
      return {
        poNum: po.poNum,
        supplierName: sup ? cN(sup) : "-",
        supplierId: po.supplierId,
        items: (po.items || []).map((i) => {
          const p = products.find((x) => x.id === i.productId);
          return p ? `${p.brand} ${pN(p)} x${i.qty}` : `?x${i.qty}`;
        }).join(", "),
        total: (po.items || []).reduce((s, i) => s + i.qty * (i.cost || 0), 0),
        status: po.status || "draft",
        date: po.date,
      };
    });

  const today = new Date().toISOString().slice(0, 10);
  const arList = (sales || []).filter(so => so.status === "completed" || so.status === "pending_delivery" || so.status === "out_for_delivery").map(so => {
    const paid = (payments || []).filter(p => p.refId === so.soNum && p.type === "ar").reduce((s, p) => s + p.amount, 0);
    const total = (so.items || []).reduce((s, i) => s + i.qty * i.price, 0) - (so.discountAmt || 0);
    const remaining = total - paid;
    if (remaining <= 0) return null;
    const days = so.payType === "credit" && so.creditDays > 0 ? so.creditDays : 7;
    const d = new Date(so.date); d.setDate(d.getDate() + days);
    const dueDate = d.toISOString().slice(0, 10);
    const cust = contacts.find(c => c.id === so.customerId);
    return { soNum: so.soNum, custName: cust ? cN(cust) : "-", total, paid, remaining, dueDate, overdue: dueDate < today };
  }).filter(Boolean);

  const apList = (pos || []).filter(po => po.status === "received").map(po => {
    const paid = (payments || []).filter(p => p.refId === po.poNum && p.type === "ap").reduce((s, p) => s + p.amount, 0);
    const total = (po.items || []).reduce((s, i) => s + i.qty * (i.cost || 0), 0);
    const remaining = total - paid;
    if (remaining <= 0) return null;
    const sup = contacts.find(c => c.id === po.supplierId);
    return { poNum: po.poNum, supplierName: sup ? cN(sup) : "-", total, paid, remaining };
  }).filter(Boolean);

  const allQuotes = [...(quotes || [])]
    .reverse()
    .slice(0, 20)
    .map((q) => {
      const cust = contacts.find(c => c.id === q.customerId);
      return { qtNum: q.qtNum, custName: cust ? cN(cust) : "-", status: q.status, date: q.date, total: (q.items || []).reduce((s, i) => s + i.qty * i.price, 0) };
    });

  const monthlySales = {};
  (sales || []).forEach(so => {
    if (!so.date) return;
    const month = so.date.slice(0, 7);
    const total = (so.items || []).reduce((s, i) => s + i.qty * i.price, 0) - (so.discountAmt || 0);
    if (!monthlySales[month]) monthlySales[month] = { revenue: 0, count: 0, cost: 0 };
    monthlySales[month].revenue += total;
    monthlySales[month].count += 1;
    (so.items || []).forEach(i => {
      const p = products.find(x => x.id === i.productId);
      monthlySales[month].cost += i.qty * (p?.cost || 0);
    });
  });

  const productSales = {};
  (sales || []).forEach(so => {
    (so.items || []).forEach(i => {
      const p = products.find(x => x.id === i.productId);
      const key = i.productId;
      if (!productSales[key]) productSales[key] = { name: p ? `${p.brand} ${pN(p)}` : "?", qty: 0, revenue: 0 };
      productSales[key].qty += i.qty;
      productSales[key].revenue += i.qty * i.price;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const customerSales = {};
  (sales || []).forEach(so => {
    const cust = contacts.find(c => c.id === so.customerId);
    const key = so.customerId;
    const total = (so.items || []).reduce((s, i) => s + i.qty * i.price, 0) - (so.discountAmt || 0);
    if (!customerSales[key]) customerSales[key] = { name: cust ? cN(cust) : "-", revenue: 0, count: 0 };
    customerSales[key].revenue += total;
    customerSales[key].count += 1;
  });
  const topCustomers = Object.values(customerSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const user = cu ? { username: cu.username, role: cu.role, name: cu.name || cu.username } : null;

  return { products: prods, customers: custs, suppliers, recentSOs: allSOs.slice(0, 10), allSOs, allPOs, arList, apList, allQuotes, monthlySales, topProducts, topCustomers, user };
}

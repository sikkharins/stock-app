import { describe, test, expect } from "vitest";
import {
  resolveModel, formatCatalog, buildSystemPrompt, buildRequestBody, STOCK_COUNT_SCHEMA,
  coercePile, parseStockCountResponse,
} from "./stock-count.js";

describe("resolveModel", () => {
  test("maps known keys", () => {
    expect(resolveModel("opus")).toBe("claude-opus-4-8");
    expect(resolveModel("sonnet")).toBe("claude-sonnet-4-6");
    expect(resolveModel("haiku")).toBe("claude-haiku-4-5");
  });
  test("unknown/missing → opus default", () => {
    expect(resolveModel("nope")).toBe("claude-opus-4-8");
    expect(resolveModel(undefined)).toBe("claude-opus-4-8");
  });
});

describe("formatCatalog", () => {
  test("formats id/brand/name/unit/desc, never stock or price", () => {
    const out = formatCatalog([
      { id: 7, brand: "Toshiba", name: "ตู้เย็น", unit: "เครื่อง", desc: "กล่องน้ำตาล", stock: 99, price: 8000 },
    ]);
    expect(out).toContain("[7]");
    expect(out).toContain("Toshiba");
    expect(out).toContain("ตู้เย็น");
    expect(out).toContain("หน่วย:เครื่อง");
    expect(out).toContain("ลักษณะ:กล่องน้ำตาล");
    expect(out).not.toContain("99");
    expect(out).not.toContain("8000");
  });
  test("empty catalog", () => {
    expect(formatCatalog([])).toBe("(catalog ว่าง)");
  });
});

describe("buildSystemPrompt", () => {
  test("รวม catalog text และกฎ 'ไม่รู้ยอดระบบ'", () => {
    const sp = buildSystemPrompt("[1] X — Y");
    expect(sp).toContain("[1] X — Y");
    expect(sp).toContain("ไม่รู้");
  });
});

describe("buildRequestBody", () => {
  test("single image: schema + adaptive thinking + image block", () => {
    const body = buildRequestBody({
      modelId: "claude-opus-4-8",
      images: [{ base64: "AAAA", mediaType: "image/jpeg" }],
      systemPrompt: "SP",
    });
    expect(body.model).toBe("claude-opus-4-8");
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config.effort).toBe("high");
    expect(body.output_config.format).toEqual({ type: "json_schema", schema: STOCK_COUNT_SCHEMA });
    expect(body.system).toBe("SP");
    const c = body.messages[0].content;
    expect(c[0]).toEqual({
      type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" },
    });
    expect(c[c.length - 1].type).toBe("text");
  });

  test("multi image: ใส่ label มุมก่อนแต่ละรูป + คำสั่งประกอบหลายมุม", () => {
    const body = buildRequestBody({
      modelId: "claude-sonnet-4-6",
      images: [
        { base64: "AAA", mediaType: "image/jpeg", angle: "หน้า" },
        { base64: "BBB", mediaType: "image/jpeg", angle: "ข้าง" },
      ],
      systemPrompt: "SP",
    });
    const c = body.messages[0].content;
    expect(c[0]).toEqual({ type: "text", text: "[มุมที่ 1: หน้า]" });
    expect(c[1].source.data).toBe("AAA");
    expect(c[2]).toEqual({ type: "text", text: "[มุมที่ 2: ข้าง]" });
    expect(c[3].source.data).toBe("BBB");
    expect(c[c.length - 1].text).toContain("หลายมุม");
  });
});

describe("coercePile", () => {
  test("normalize pile ปกติ (ปัด count เป็นจำนวนเต็ม)", () => {
    expect(coercePile({ productId: 5, guess: "g", count: 8.4, confidence: "high", note: "n" }))
      .toEqual({ productId: 5, guess: "g", count: 8, confidence: "high", note: "n" });
  });
  test("productId null + confidence แปลก → low + default note", () => {
    expect(coercePile({ productId: null, guess: "g", count: 3, confidence: "weird" }))
      .toEqual({ productId: null, guess: "g", count: 3, confidence: "low", note: "" });
  });
  test("count ไม่ใช่ตัวเลข → null (ถูกตัดทิ้ง)", () => {
    expect(coercePile({ guess: "g", count: "x", confidence: "high" })).toBeNull();
  });
});

describe("parseStockCountResponse", () => {
  test("ดึง piles จาก text block (ข้าม thinking block)", () => {
    const api = { stop_reason: "end_turn", content: [
      { type: "thinking", thinking: "..." },
      { type: "text", text: JSON.stringify({ piles: [
        { productId: 1, guess: "a", count: 4, confidence: "high" },
      ] }) },
    ] };
    expect(parseStockCountResponse(api)).toEqual({
      piles: [{ productId: 1, guess: "a", count: 4, confidence: "high", note: "" }],
    });
  });
  test("refusal → throw", () => {
    expect(() => parseStockCountResponse({ stop_reason: "refusal", content: [] })).toThrow(/refus/i);
  });
  test("ไม่มี text block → throw", () => {
    expect(() => parseStockCountResponse({ content: [{ type: "thinking", thinking: "x" }] })).toThrow();
  });
  test("JSON พัง → throw", () => {
    expect(() => parseStockCountResponse({ content: [{ type: "text", text: "not json" }] })).toThrow();
  });
  test("ไม่มี piles → array ว่าง", () => {
    expect(parseStockCountResponse({ content: [{ type: "text", text: "{}" }] })).toEqual({ piles: [] });
  });
});

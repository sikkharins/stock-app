import { describe, test, expect } from "vitest";
import { pickCaptureTargets, cctvSnapshotUrl } from "./cameraCapture";

const presets = [
  { token: "1", name: "ซ้าย" },
  { token: "2", name: "กลาง" },
  { token: "3", name: "ขวา" },
];

describe("pickCaptureTargets", () => {
  test("current → มุมปัจจุบัน (token null)", () => {
    expect(pickCaptureTargets({ mode: "current", presets })).toEqual([{ token: null, name: "มุมปัจจุบัน" }]);
  });

  test("zone → preset ของโซน (เรียงตามโซน) ใช้ชื่อจาก presets ปัจจุบัน", () => {
    const zone = { presets: [{ token: "3", name: "ขวา(เก่า)" }, { token: "1", name: "ซ้าย" }] };
    expect(pickCaptureTargets({ mode: "zone", zone, presets })).toEqual([
      { token: "3", name: "ขวา" },
      { token: "1", name: "ซ้าย" },
    ]);
  });

  test("zone: preset ที่ token หายจากกล้อง → กรองออก", () => {
    const zone = { presets: [{ token: "1", name: "ซ้าย" }, { token: "9", name: "หาย" }] };
    expect(pickCaptureTargets({ mode: "zone", zone, presets }).map((t) => t.token)).toEqual(["1"]);
  });

  test("zone ไม่มี preset → []", () => {
    expect(pickCaptureTargets({ mode: "zone", zone: { presets: [] }, presets })).toEqual([]);
    expect(pickCaptureTargets({ mode: "zone", zone: {}, presets })).toEqual([]);
  });

  test("manual → ตาม selectedTokens (เรียงตามที่เลือก), token แปลกปลอมถูกข้าม", () => {
    expect(pickCaptureTargets({ mode: "manual", selectedTokens: ["2", "9", "1"], presets })).toEqual([
      { token: "2", name: "กลาง" },
      { token: "1", name: "ซ้าย" },
    ]);
  });

  test("manual ไม่เลือกอะไร → []", () => {
    expect(pickCaptureTargets({ mode: "manual", selectedTokens: [], presets })).toEqual([]);
  });
});

describe("cctvSnapshotUrl", () => {
  test("ไม่มี token/t → /snapshot เฉย ๆ", () => {
    expect(cctvSnapshotUrl("http://localhost:8765")).toBe("http://localhost:8765/snapshot");
  });
  test("มี token → ใส่ preset (encode)", () => {
    expect(cctvSnapshotUrl("http://h:1", "a b")).toBe("http://h:1/snapshot?preset=a+b");
  });
  test("มี token + t → ใส่ทั้งคู่ (cache-bust)", () => {
    expect(cctvSnapshotUrl("http://h:1", "x", 99)).toBe("http://h:1/snapshot?preset=x&t=99");
  });
  test("ตัด trailing slash ของ base", () => {
    expect(cctvSnapshotUrl("http://h:1/", "x")).toBe("http://h:1/snapshot?preset=x");
  });
  test("token null + t → ไม่ใส่ preset", () => {
    expect(cctvSnapshotUrl("http://h:1", null, 5)).toBe("http://h:1/snapshot?t=5");
  });
});

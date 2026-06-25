import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StockToSales from "./StockToSales.jsx";

// smoke test: ยืนยันว่า component mount ได้จริง (import resolve, computeStockToSales รันใน React,
// JSX ถูก) และ label โครงสร้างหลักครบ — ไม่ผูกกับวันที่ปัจจุบัน
const products = [
  { id: 1, brand: "Sony", categoryId: 10, price: 100, stock: 10 },
  { id: 2, brand: "LG", categoryId: 10, price: 200, stock: 5 },
];
const cats = [{ id: 10, name: "ทีวี" }];
const sales: any[] = [];
const logs: any[] = [];

describe("StockToSales", () => {
  it("render ได้ไม่ crash + มีตัวเลือกงวดและ KPI รวม", () => {
    render(<StockToSales products={products} sales={sales} logs={logs} cats={cats} />);
    expect(screen.getByText("เดือน")).toBeTruthy();
    expect(screen.getByText("ไตรมาส")).toBeTruthy();
    expect(screen.getByText("ปี")).toBeTruthy();
    expect(screen.getByText(/รวมทั้งร้าน/)).toBeTruthy();
    expect(screen.getByText("ตามยี่ห้อ")).toBeTruthy();
    expect(screen.getByText("ตามหมวดสินค้า")).toBeTruthy();
    expect(screen.getByText("ตามหมวดสินค้า × ยี่ห้อ")).toBeTruthy();
  });
});

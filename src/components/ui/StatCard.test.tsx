import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "./StatCard";

describe("StatCard", () => {
  test("renders label and value", () => {
    render(<StatCard label="รายการทั้งหมด" value={42} />);
    expect(screen.getByText("รายการทั้งหมด")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("renders sub text when provided", () => {
    render(<StatCard label="ชำระแล้ว" value="฿15,200" sub="3 รายการ" />);
    expect(screen.getByText("3 รายการ")).toBeInTheDocument();
  });

  test("omits sub when not provided", () => {
    render(<StatCard label="ค้างจ่ายรวม" value="฿0" />);
    // No sub element means there's no extra text beyond label + value
    expect(screen.queryByText(/รายการ$/)).not.toBeInTheDocument();
  });

  test("renders icon when provided", () => {
    render(<StatCard label="รอเก็บเงิน" value={5} icon="$" />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  test("currency string value renders as-is", () => {
    // StatCard is dumb — it doesn't parse currency. Caller formats with fmt().
    render(<StatCard label="ยอดค้าง" value="฿1,234.50" />);
    expect(screen.getByText("฿1,234.50")).toBeInTheDocument();
  });
});

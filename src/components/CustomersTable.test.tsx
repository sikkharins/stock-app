import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomersTable from "./CustomersTable";

const customers = [
  { id: 1, name: "Alpha", salesPerson: "A", customerGroup: "regular" },
  { id: 2, name: "Beta", salesPerson: "B", customerGroup: "walkin" },
];

const sales = [
  {
    customerId: 1,
    date: "2026-06-05",
    status: "completed",
    items: [{ qty: 1, price: 1000 }],
    discountAmt: 0,
    payType: "cash",
    creditDays: 0,
    soNum: "S1",
  },
];

const TODAY = new Date("2026-06-10");

describe("CustomersTable", () => {
  test("renders rows for each customer", () => {
    render(
      <CustomersTable
        customers={customers}
        sales={sales}
        payments={[]}
        today={TODAY}
        cN={(c: any) => c.name}
        onRowClick={() => {}}
      />
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  test("row click fires onRowClick with customer", () => {
    const onClick = vi.fn();
    render(
      <CustomersTable
        customers={customers}
        sales={sales}
        payments={[]}
        today={TODAY}
        cN={(c: any) => c.name}
        onRowClick={onClick}
      />
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(onClick).toHaveBeenCalledWith(customers[0]);
  });

  test("default sort is name ascending (Alpha before Beta)", () => {
    render(
      <CustomersTable
        customers={[customers[1], customers[0]]}
        sales={sales}
        payments={[]}
        today={TODAY}
        cN={(c: any) => c.name}
        onRowClick={() => {}}
      />
    );
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alpha");
    expect(rows[2]).toHaveTextContent("Beta");
  });

  test("clicking the name header toggles to descending", () => {
    render(
      <CustomersTable
        customers={customers}
        sales={sales}
        payments={[]}
        today={TODAY}
        cN={(c: any) => c.name}
        onRowClick={() => {}}
      />
    );
    fireEvent.click(screen.getByText(/ชื่อ/));
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Beta");
    expect(rows[2]).toHaveTextContent("Alpha");
  });
});

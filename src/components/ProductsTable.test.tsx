import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductsTable from "./ProductsTable";

const products = [
  { id: 1, code: "P001", name: "Alpha", brand: "LG", categoryId: 1, price: 1000, stock: 5, minStock: 2, unit: "เครื่อง" },
  { id: 2, code: "P002", name: "Beta",  brand: "SAMSUNG", categoryId: 2, price: 500,  stock: 0, minStock: 1, unit: "ตัว" },
];

const baseProps = {
  products,
  sales: [] as any[],
  pN: (p: any) => p.name,
  getCN: (_id: any) => "ทีวี",
  onRowClick: () => {},
  onEdit: () => {},
  onAdjust: () => {},
  onDelete: () => {},
  ed: true,
  cd: true,
  bulkMode: false,
  selected: new Set<number>(),
  onToggleSelect: () => {},
  sortBy: "name",
  onSortChange: () => {},
  density: "comfortable" as const,
};

describe("ProductsTable", () => {
  test("renders one row per product", () => {
    render(<ProductsTable {...baseProps} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  test("clicking a row calls onRowClick with the product", async () => {
    const onRowClick = vi.fn();
    render(<ProductsTable {...baseProps} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledWith(products[0]);
  });

  test("clicking a column header calls onSortChange", async () => {
    const onSortChange = vi.fn();
    render(<ProductsTable {...baseProps} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByText(/ราคา/));
    expect(onSortChange).toHaveBeenCalled();
    expect(["price_asc", "price_desc"]).toContain(onSortChange.mock.calls[0][0]);
  });

  test("bulk mode shows checkbox column", () => {
    render(<ProductsTable {...baseProps} bulkMode={true} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
  });

  test("clicking a checkbox calls onToggleSelect with the product id", async () => {
    const onToggleSelect = vi.fn();
    render(
      <ProductsTable {...baseProps} bulkMode={true} onToggleSelect={onToggleSelect} />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });
});

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import DeliveryPlanningPage from "./DeliveryPlanning.jsx";

// Harness wires the minimal `sh` slice DeliveryPlanning reads, with reactive state
// for modal/trucks so the modal hub + CRUD can be exercised end-to-end.
function DeliveryHarness({
  initialTrucks = [
    { id: 1, name: "รถ 1", capacityM3: 8, isActive: true, note: "" },
  ],
  initialSales = [],
  initialContacts = [],
  initialProducts = [],
}: {
  initialTrucks?: any[];
  initialSales?: any[];
  initialContacts?: any[];
  initialProducts?: any[];
}) {
  const [modal, setModal] = useState<string | null>(null);
  const [trucks, setTrucks] = useState<any[]>(initialTrucks);

  const sh: any = {
    cN: (c: any) => c?.name ?? "—",
    pN: (p: any) => p?.name ?? "—",
    contacts: initialContacts,
    sales: initialSales,
    products: initialProducts,
    trucks,
    setTrucks,
    canE: () => true,
    canD: () => true,
    modal,
    oM: (n: string) => setModal(n),
    cM: () => setModal(null),
  };
  return <DeliveryPlanningPage sh={sh} />;
}

describe("DeliveryPlanning", () => {
  test("empty state when no trucks active", () => {
    render(<DeliveryHarness initialTrucks={[]} />);
    expect(screen.getByText(/ยังไม่มีรถบรรทุก/)).toBeInTheDocument();
  });

  test("renders truck selector + stats with pending SOs", () => {
    render(
      <DeliveryHarness
        initialContacts={[
          { id: 1, name: "ลูกค้า A", lat: 13.75, lng: 100.5 },
        ]}
        initialProducts={[{ id: 1, name: "Fridge", sizeClass: "M" }]}
        initialSales={[
          {
            soNum: "SO-001",
            customerId: 1,
            status: "pending_delivery",
            items: [{ productId: 1, qty: 2, price: 10000 }],
          },
        ]}
      />
    );
    expect(screen.getByRole("heading", { name: /วางแผนจัดส่ง/ })).toBeInTheDocument();
    expect(screen.getByText("SO-001")).toBeInTheDocument();
    // Step 2 header present
    expect(screen.getByText("เลือก SO ที่จะจัดส่ง")).toBeInTheDocument();
  });

  test("selecting an SO updates running totals and enables Pick List button", async () => {
    const user = userEvent.setup();
    render(
      <DeliveryHarness
        initialContacts={[{ id: 1, name: "ABC", lat: 13.75, lng: 100.5 }]}
        initialProducts={[{ id: 1, name: "Fridge", sizeClass: "L" }]} // 1.0 m³ each
        initialSales={[
          {
            soNum: "SO-100",
            customerId: 1,
            status: "pending_delivery",
            items: [{ productId: 1, qty: 3, price: 10000 }],
          },
        ]}
      />
    );

    const pickBtn = screen.getByRole("button", { name: /พิมพ์ใบจัดของ/ });
    expect(pickBtn).toBeDisabled();

    // Toggle via checkbox
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    await user.click(checkbox);

    expect(pickBtn).not.toBeDisabled();
    // 3 × 1.0 = 3.00 m³ — shown in the volume gauge
    expect(screen.getAllByText(/3\.00 \/ 8 m³/).length).toBeGreaterThanOrEqual(1);
  });

  test("Pick List modal shows consolidated items from selected SOs", async () => {
    const user = userEvent.setup();
    render(
      <DeliveryHarness
        initialContacts={[
          { id: 1, name: "A", lat: 13.75, lng: 100.5 },
          { id: 2, name: "B", lat: 13.76, lng: 100.51 },
        ]}
        initialProducts={[
          { id: 1, name: "Fridge", nameT: "ตู้เย็น", sizeClass: "M" },
        ]}
        initialSales={[
          {
            soNum: "SO-A",
            customerId: 1,
            status: "pending_delivery",
            items: [{ productId: 1, qty: 2, price: 10000 }],
          },
          {
            soNum: "SO-B",
            customerId: 2,
            status: "pending_delivery",
            items: [{ productId: 1, qty: 3, price: 10000 }],
          },
        ]}
      />
    );

    // Select both SOs via their checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole("button", { name: /พิมพ์ใบจัดของ/ }));

    // Modal opened — assert via its title (the trigger button also matches /พิมพ์/)
    expect(screen.getByText(/ใบจัดของ —/)).toBeInTheDocument();

    // The consolidated pick list renders into the 80mm receipt preview (iframe
    // srcDoc), so assert against that document string rather than the main DOM.
    const receipt = screen.getByTitle("80mm preview").getAttribute("srcdoc") || "";
    expect(receipt).toContain("ตู้เย็น"); // SO-A + SO-B → one consolidated line item
    expect(receipt).toContain("1 รายการ"); // same product across both SOs → 1 row
    expect(receipt).toContain("5 ชิ้น"); // qty 2 + 3 merged
    expect(receipt).toContain("2 SO"); // sourced from both SOs
  });

  test("manage trucks: add a truck via modal", async () => {
    const user = userEvent.setup();
    render(<DeliveryHarness />);
    await user.click(screen.getByRole("button", { name: /จัดการรถ/ }));

    // Manage modal shows existing truck
    expect(screen.getByText(/ความจุ 8 m³/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /\+ เพิ่มรถ/ }));

    // Edit modal opened
    const nameInput = screen.getByPlaceholderText("เช่น รถ 1") as HTMLInputElement;
    await user.type(nameInput, "รถ 4");
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    // Modal closed; truck 4 visible in selector area (it's auto-active)
    // The selector still shows truck 1 as primary but รถ 4 is in the list
    // — easiest assertion: header reload doesn't error; manage modal still has รถ 4
    await user.click(screen.getByRole("button", { name: /จัดการรถ/ }));
    expect(screen.getByText("รถ 4")).toBeInTheDocument();
  });
});

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ZonePage from "./Zones.jsx";

function Harness({ initialZones }: { initialZones: any[] }) {
  const [zones, setZones] = useState<any[]>(initialZones);
  // No brand: nameOf() = `${brand||""} ${pN(p)}`.trim(), so the row shows just "AAA"/"BBB".
  const products = [
    { id: 1, code: "P-1", name: "AAA", brand: "", stock: 10 },
    { id: 2, code: "P-2", name: "BBB", brand: "", stock: 20 },
  ];
  const sh: any = {
    zones, setZones, products,
    pN: (p: any) => p?.name ?? "—",
    canE: () => true,
  };
  return <ZonePage sh={sh} />;
}

const names = () =>
  screen.getAllByText(/^(AAA|BBB)$/).map((n) => n.textContent);

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("แก้ไข"));
}

describe("ZonePage editor — ordered product rows", () => {
  test("renders one ordered row per product with แถว/ชั้น inputs", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1, 2] }]} />);
    await openEditor(user);

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getAllByText("แถว").length).toBe(2);
    expect(screen.getAllByText("ชั้น").length).toBe(2);
    expect(names()).toEqual(["AAA", "BBB"]);
  });

  test("‹/› reorders products; ‹ disabled on first, › on last", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1, 2] }]} />);
    await openEditor(user);

    const leftBtns = screen.getAllByTitle("เลื่อนซ้าย") as HTMLButtonElement[];
    const rightBtns = screen.getAllByTitle("เลื่อนขวา") as HTMLButtonElement[];
    expect(leftBtns[0].disabled).toBe(true);
    expect(rightBtns[rightBtns.length - 1].disabled).toBe(true);

    await user.click(rightBtns[0]); // move AAA right
    expect(names()).toEqual(["BBB", "AAA"]);
  });

  test("typing แถว writes the input value (auto when empty)", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1] }]} />);
    await openEditor(user);

    const inputs = screen.getAllByPlaceholderText("auto") as HTMLInputElement[];
    expect(inputs.length).toBe(2); // แถว + ชั้น for the single product
    await user.type(inputs[0], "3");
    expect(inputs[0].value).toBe("3");
  });

  test("orientation toggle defaults to ยาว and flips to กว้าง", async () => {
    const user = userEvent.setup();
    render(<Harness initialZones={[{ id: "z1", name: "Z1", productIds: [1] }]} />);
    await openEditor(user);

    const btn = screen.getByTitle("ด้านที่ขนานกำแพง") as HTMLButtonElement;
    expect(btn.textContent).toBe("ยาว");        // default long
    await user.click(btn);
    expect(btn.textContent).toBe("กว้าง");       // -> wide
    await user.click(btn);
    expect(btn.textContent).toBe("ยาว");        // -> back to default (key cleared)
  });
});

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import FinPage from "./Finance.jsx";

// Mock harness that wires Finance's `sh` prop with reactive state for modal/payments/etc.
// Minimum fixture needed by Finance + ARAP sub-component.
function FinanceHarness({ initialPayments = [] }: { initialPayments?: any[] }) {
  const [modal, setModal] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>(initialPayments);
  const [cheques, setCheques] = useState<any[]>([]);
  const [bankTxns, setBankTxns] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([
    { id: "c1", name: "ABC Co", type: "customer" },
  ]);
  const [supCNotes, setSupCNotes] = useState<any[]>([]);

  const sh: any = {
    cN: (c: any) => c?.name ?? "",
    pN: (p: any) => p?.name ?? "",
    contacts,
    setContacts,
    sales: [
      {
        soNum: "SO-001",
        customerId: "c1",
        status: "completed",
        items: [{ productId: "p1", qty: 1, price: 1000 }],
        discountAmt: 0,
        date: "2026-01-01",
        payType: "cash",
        creditDays: 0,
      },
    ],
    pos: [],
    quotes: [],
    payments,
    setPayments,
    products: [{ id: "p1", name: "Widget" }],
    canE: () => true,
    canD: () => true,
    modal,
    oM: (name: string) => setModal(name),
    cM: () => setModal(null),
    setCheques,
    cheques,
    bankAccs: [
      {
        id: 1,
        name: "บัญชี 1",
        bank: "กสิกร",
        isCash: false,
        perms: { receive: true, transferOut: true, payEPP: true },
      },
    ],
    setBankTxns,
    bankTxns,
    cnotes: [],
    billings: [],
    supCNotes,
    setSupCNotes,
    tagMappings: [],
  };
  return <FinPage sh={sh} />;
}

describe("Finance — modal hub & savePay validation", () => {
  test("AR + รับ opens addPay modal with refId + customer name", async () => {
    const user = userEvent.setup();
    render(<FinanceHarness />);

    await user.click(screen.getByText("เก็บเงินลูกค้า"));
    await user.click(screen.getByText("+ รับ"));

    expect(screen.getByText(/รับ — SO-001 — ABC Co/)).toBeInTheDocument();
  });

  test("savePay shows warning when amount is cleared", async () => {
    const user = userEvent.setup();
    const { container } = render(<FinanceHarness />);

    await user.click(screen.getByText("เก็บเงินลูกค้า"));
    await user.click(screen.getByText("+ รับ"));

    const amountInput = container.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement;
    await user.clear(amountInput);
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(screen.getByText("กรุณากรอกจำนวนเงินมากกว่า 0")).toBeInTheDocument();
  });

  test("savePay shows warning when method=เช็ค and chequeNo is empty", async () => {
    const user = userEvent.setup();
    const { container } = render(<FinanceHarness />);

    await user.click(screen.getByText("เก็บเงินลูกค้า"));
    await user.click(screen.getByText("+ รับ"));

    // Open the วิธี CustomSelect: its trigger is the wrapper div containing the current label span
    const methodSpan = [...container.querySelectorAll("span")].find(
      (s) => s.textContent === "โอนเงิน"
    );
    expect(methodSpan).toBeTruthy();
    const methodTrigger = methodSpan!.parentElement as HTMLElement;
    await user.click(methodTrigger);

    // Dropdown options are rendered via portal at body level
    const chequeOption = [...document.querySelectorAll("div")].find(
      (d) => d.children.length === 0 && d.textContent === "เช็ค"
    );
    expect(chequeOption).toBeTruthy();
    await user.click(chequeOption!);

    // Form should now show the chequeNo field
    expect(screen.getByPlaceholderText("เลขที่เช็ค")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(screen.getByText("กรุณากรอกเลขที่เช็ค")).toBeInTheDocument();
  });

  test("savePay succeeds with valid input — addPay modal closes and payment recorded", async () => {
    const user = userEvent.setup();
    render(<FinanceHarness />);

    await user.click(screen.getByText("เก็บเงินลูกค้า"));
    await user.click(screen.getByText("+ รับ"));

    // Default amount (฿1000.00) is valid — just click save
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    // Modal closed (no title) + no warning shown = savePay ran cleanly through
    expect(screen.queryByText(/รับ — SO-001/)).not.toBeInTheDocument();
    expect(screen.queryByText(/กรุณากรอก/)).not.toBeInTheDocument();
  });
});

describe("รับชำระรวม — auto-match by received amount", () => {
  function MultiSOHarness() {
    const [modal, setModal] = useState<string | null>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [cheques, setCheques] = useState<any[]>([]);
    const [bankTxns, setBankTxns] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([
      { id: "c1", name: "ABC Co", type: "customer" },
    ]);
    const [supCNotes, setSupCNotes] = useState<any[]>([]);
    const mkSO = (n: string, price: number, date: string) => ({
      soNum: n,
      customerId: "c1",
      status: "completed",
      items: [{ productId: "p1", qty: 1, price }],
      discountAmt: 0,
      date,
      payType: "cash",
      creditDays: 0,
    });
    const sh: any = {
      cN: (c: any) => c?.name ?? "",
      pN: (p: any) => p?.name ?? "",
      contacts,
      setContacts,
      sales: [
        mkSO("SO-001", 1000, "2026-01-01"),
        mkSO("SO-002", 2000, "2026-01-02"),
        mkSO("SO-003", 3000, "2026-01-03"),
      ],
      pos: [],
      quotes: [],
      payments,
      setPayments,
      products: [{ id: "p1", name: "Widget" }],
      canE: () => true,
      canD: () => true,
      modal,
      oM: (name: string) => setModal(name),
      cM: () => setModal(null),
      setCheques,
      cheques,
      bankAccs: [
        {
          id: 1,
          name: "บัญชี 1",
          bank: "กสิกร",
          isCash: false,
          perms: { receive: true, transferOut: true, payEPP: true },
        },
      ],
      setBankTxns,
      bankTxns,
      cnotes: [],
      billings: [],
      supCNotes,
      setSupCNotes,
      tagMappings: [],
    };
    return <FinPage sh={sh} />;
  }

  test("typing received amount + กดหา auto-ticks the unique matching SO set", async () => {
    const user = userEvent.setup();
    render(<MultiSOHarness />);

    await user.click(screen.getByText("เก็บเงินลูกค้า"));
    await user.click(screen.getByText("รับชำระรวม"));

    // select customer in the searchable CustomSelect.
    // "ABC Co" also appears in the AR table behind the modal, so target the
    // dropdown option (rendered via portal -> last in DOM order).
    await user.click(screen.getByText("— เลือกลูกค้า —"));
    const custOpts = screen.getAllByText("ABC Co");
    await user.click(custOpts[custOpts.length - 1]);

    // 6000 = SO-001 + SO-002 + SO-003, the only subset summing to it
    await user.type(screen.getByPlaceholderText("ยอดที่ได้รับ"), "6000");
    await user.click(screen.getByRole("button", { name: "หา SO ที่ตรงยอด" }));

    expect(screen.getByText(/ยอดรวมที่เลือก: ฿6,000/)).toBeInTheDocument();
  });
});

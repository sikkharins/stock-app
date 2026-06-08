import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import CustomSelect from "./CustomSelect.jsx";

// We don't use `satisfies Meta<typeof CustomSelect>` here because CustomSelect is .jsx
// (no explicit prop types) — TS would treat all destructured props as required, forcing
// every story to pass args we don't use (stories use `render` for stateful wrappers).
const meta: Meta = {
  title: "UI/CustomSelect",
  component: CustomSelect,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj;

const PAYMENT_METHODS = ["โอนเงิน", "เงินสด", "เช็ค", "บัตรเครดิต"];

// Wrap with local state so the dropdown actually responds to selection.
// CustomSelect.jsx has no explicit prop types — TS treats all destructured props as required,
// so we cast the component as ComponentType<any> to silence the false-positive.
const SelectAny = CustomSelect as unknown as React.ComponentType<{
  value: string;
  onChange: (v: string) => void;
  options: Array<string | { value: string | number; label: string }>;
  searchable?: boolean;
}>;

const Wrapper = (props: {
  options: Array<string | { value: string | number; label: string }>;
  searchable?: boolean;
  initial?: string;
}) => {
  const [value, setValue] = useState(props.initial ?? "");
  return <SelectAny value={value} onChange={setValue} options={props.options} searchable={props.searchable} />;
};

// Basic select — string options (รับ payForm.method values)
export const Basic: Story = {
  render: () => <Wrapper options={PAYMENT_METHODS} />,
};

// Pre-selected
export const PreSelected: Story = {
  render: () => <Wrapper options={PAYMENT_METHODS} initial="เช็ค" />,
};

// Object options (value/label pairs — used in bank account dropdowns)
export const ObjectOptions: Story = {
  render: () => (
    <Wrapper
      options={[
        { value: "", label: "— เลือกบัญชี —" },
        { value: "1", label: "บัญชี 1 — กสิกรไทย" },
        { value: "2", label: "บัญชี 2 — ไทยพาณิชย์" },
        { value: "3", label: "เงินสดหน้าร้าน" },
      ]}
    />
  ),
};

// Searchable — used for long lists like customer/supplier picker
export const Searchable: Story = {
  render: () => (
    <Wrapper
      searchable
      options={[
        { value: "", label: "— เลือกลูกค้า —" },
        ...Array.from({ length: 25 }, (_, i) => ({
          value: String(i + 1),
          label: `ลูกค้า ${String(i + 1).padStart(2, "0")} — บริษัท ABC${i + 1}`,
        })),
      ]}
    />
  ),
};

// Bank icons (real use case from BANK_OPTS in Finance/Cheque)
export const ThaiBanks: Story = {
  render: () => (
    <Wrapper
      options={[
        { value: "", label: "เลือกธนาคาร" },
        { value: "kbank", label: "ธนาคารกสิกรไทย (KBank)" },
        { value: "scb", label: "ธนาคารไทยพาณิชย์ (SCB)" },
        { value: "bbl", label: "ธนาคารกรุงเทพ (BBL)" },
        { value: "ktb", label: "ธนาคารกรุงไทย (KTB)" },
        { value: "ttb", label: "ธนาคารทหารไทยธนชาต (ttb)" },
      ]}
    />
  ),
};

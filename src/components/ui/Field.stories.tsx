import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import Field from "./Field";
import { IB as IB_RAW } from "../../utils/constants.js";

// constants.js exports IB as plain object literal — cast to CSSProperties so style={IB} type-checks
const IB = IB_RAW as CSSProperties;

const meta = {
  title: "UI/Field",
  component: Field,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;
export default meta;

type Story = StoryObj<typeof meta>;

// Form-field wrapper used across all modals (addPay, addBill, addCN, ฯลฯ)
// Renders label above the child input, optionally with a red required-asterisk.

export const Default: Story = {
  args: {
    label: "ชื่อบัญชี",
    children: <input style={IB} placeholder="ระบุชื่อบัญชี" />,
  },
};

export const Required: Story = {
  args: {
    label: "เลขที่เช็ค",
    req: true,
    children: <input style={IB} placeholder="เลขที่เช็ค" />,
  },
};

export const WithNumberInput: Story = {
  args: {
    label: "ยอดเงิน (฿)",
    children: <input type="number" style={IB} defaultValue={1500} />,
  },
};

export const WithSelect: Story = {
  args: {
    label: "ธนาคาร",
    req: true,
    children: (
      <select style={IB}>
        <option>กสิกรไทย</option>
        <option>ไทยพาณิชย์</option>
        <option>กรุงเทพ</option>
      </select>
    ),
  },
};

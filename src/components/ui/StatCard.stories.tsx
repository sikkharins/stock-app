import type { Meta, StoryObj } from "@storybook/react-vite";
import StatCard from "./StatCard";

const meta = {
  title: "UI/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { label: "รายการทั้งหมด", value: 42 },
} satisfies Meta<typeof StatCard>;
export default meta;

type Story = StoryObj<typeof meta>;

// Default — dashboard stat (used everywhere in Finance, Dashboard, Reports tabs)
export const Default: Story = {};

// With sub-text — for context like "X paid" under the main number
export const WithSubText: Story = {
  args: { label: "ชำระแล้ว", value: "฿15,200", sub: "3 รายการ" },
};

// Currency formatted (caller formats with fmt())
export const Currency: Story = {
  args: { label: "ยอดค้าง", value: "฿1,234.50", color: "var(--red)" },
};

// With icon (uses accentBg for the icon background)
export const WithIcon: Story = {
  args: {
    label: "รอเก็บเงิน",
    value: 5,
    icon: "$",
    color: "var(--orange)",
    accentBg: "rgba(255,149,0,0.14)",
  },
};

// Colored value (used for status emphasis — green = paid, red = overdue, ฯลฯ)
export const GreenAccent: Story = {
  args: { label: "เกินกำหนด", value: 0, color: "var(--green)" },
};

export const RedAlert: Story = {
  args: { label: "ค้างจ่ายรวม", value: "฿85,000", color: "var(--red)" },
};

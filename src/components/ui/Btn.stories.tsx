import type { Meta, StoryObj } from "@storybook/react-vite";
import Btn from "./Btn";

const meta = {
  title: "UI/Btn",
  component: Btn,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { children: "บันทึก" },
} satisfies Meta<typeof Btn>;
export default meta;

type Story = StoryObj<typeof meta>;

// Standard secondary button (default variant)
export const Secondary: Story = { args: { children: "ยกเลิก" } };

// Primary — main CTA color (blue background)
export const Primary: Story = { args: { variant: "pri", children: "บันทึก" } };

// Ghost — text-only, used for inline actions
export const Ghost: Story = { args: { variant: "ghost", children: "ดูทั้งหมด →" } };

// Small size — used in table row actions
export const Small: Story = { args: { variant: "pri", size: "sm", children: "+ รับ" } };

// Large size — used in primary form actions on big pages
export const Large: Story = { args: { variant: "pri", size: "lg", children: "ยืนยันสั่งซื้อ" } };

// All variants × sizes for visual comparison
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {(["pri", undefined, "ghost"] as const).map((v) => (
        <div key={v ?? "default"} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 80, fontSize: 12, color: "var(--dim)" }}>
            {v ?? "default"}
          </span>
          <Btn variant={v} size="sm">Small</Btn>
          <Btn variant={v}>Default</Btn>
          <Btn variant={v} size="lg">Large</Btn>
        </div>
      ))}
    </div>
  ),
};

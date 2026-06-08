import type { Meta, StoryObj } from "@storybook/react-vite";
import Badge from "./Badge.jsx";

// Plain Meta (no `satisfies`) because Badge.jsx has no explicit prop types — TS would
// otherwise treat `status` as required for every story, including the render-only AllStatuses.
const meta: Meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

// Badge status pill — used across PO/SO/Quote tables. Status string maps to color + Thai label.

export const Pending: Story = { args: { status: "pending" } };
export const PendingDelivery: Story = { args: { status: "pending_delivery" } };
export const Received: Story = { args: { status: "received" } };
export const Completed: Story = { args: { status: "completed" } };
export const Cancelled: Story = { args: { status: "cancelled" } };
export const Draft: Story = { args: { status: "draft" } };
export const PendingApproval: Story = { args: { status: "pending_approval" } };
export const Approved: Story = { args: { status: "approved" } };
export const PendingSpecialApproval: Story = { args: { status: "pending_special_approval" } };

// Contact type badges (supplier/customer) + Role badges (Admin/Manager/Sales/ฯลฯ)
export const ContactSupplier: Story = { args: { status: "supplier" } };
export const ContactCustomer: Story = { args: { status: "customer" } };
export const RoleAdmin: Story = { args: { status: "Admin" } };
export const RoleSales: Story = { args: { status: "Sales" } };
export const RoleWarehouse: Story = { args: { status: "Warehouse" } };

// Unknown status falls back to the gray "dim" style and renders the raw status string
export const UnknownStatus: Story = { args: { status: "weird_status" } };

// All statuses side-by-side for visual review
export const AllStatuses: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 600 }}>
      {[
        "pending", "pending_delivery", "received", "completed", "cancelled",
        "draft", "pending_approval", "approved", "pending_special_approval",
        "supplier", "customer", "Admin", "Manager", "Sales", "Warehouse",
        "Accountant", "Supplier", "Staff",
      ].map((s) => <Badge key={s} status={s} />)}
    </div>
  ),
};

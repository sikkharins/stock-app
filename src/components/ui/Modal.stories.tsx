import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { Modal, MBtns } from "./Modal";
import Field from "./Field";
import { IB as IB_RAW } from "../../utils/constants.js";

const IB = IB_RAW as CSSProperties;

const meta = {
  title: "UI/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Modal>;
export default meta;

type Story = StoryObj<typeof meta>;

// Standard modal — used everywhere (addPay, viewSO, confirmDelPay, ฯลฯ)
export const Default: Story = {
  args: {
    title: "เพิ่มบัญชีธนาคาร",
    onClose: () => alert("close clicked"),
    children: (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="ชื่อบัญชี" req>
            <input style={IB} placeholder="เช่น บัญชี 3" />
          </Field>
          <Field label="ธนาคาร" req>
            <input style={IB} placeholder="กสิกรไทย" />
          </Field>
        </div>
        <MBtns onCancel={() => alert("cancel")} onSave={() => alert("save")} />
      </>
    ),
  },
};

// Wide variant — used for tables/lists inside modal (viewBill, batchPay, addCN)
export const Wide: Story = {
  args: {
    title: "รายละเอียดใบวางบิล — BL-2569-001",
    wide: true,
    onClose: () => alert("close"),
    children: (
      <div>
        <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 12 }}>
          เนื้อหา modal กว้าง — เหมาะกับ table/list/รายการสินค้า
        </p>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              {["#", "SO", "วันที่", "ยอด"].map((h) => (
                <th key={h} style={{ padding: 8, textAlign: "left", color: "var(--dim)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "0.5px solid var(--line)" }}>
              <td style={{ padding: 8 }}>1</td>
              <td style={{ padding: 8, color: "var(--blue)" }}>SO-2569-042</td>
              <td style={{ padding: 8, color: "var(--dim)" }}>15/06/2569</td>
              <td style={{ padding: 8, fontWeight: 600 }}>฿8,500</td>
            </tr>
          </tbody>
        </table>
        <MBtns onCancel={() => alert("cancel")} onSave={() => alert("save")} saveLabel="ยืนยัน" />
      </div>
    ),
  },
};

// MBtns alone — utility button pair (cancel + save) used inside all modals
export const ModalButtonsOnly: Story = {
  args: {
    title: "MBtns helper",
    onClose: () => {},
    children: (
      <>
        <p style={{ fontSize: 13 }}>MBtns: ปุ่ม ยกเลิก + บันทึก ที่ปลาย modal</p>
        <MBtns onCancel={() => alert("cancel")} onSave={() => alert("save")} />
      </>
    ),
  },
};

// Save button disabled (e.g., form invalid)
export const SaveDisabled: Story = {
  args: {
    title: "ตัวอย่าง disabled",
    onClose: () => {},
    children: (
      <>
        <p style={{ fontSize: 13 }}>ปุ่มบันทึกถูก disable เพราะ form ยังไม่ valid</p>
        <MBtns onCancel={() => {}} onSave={() => {}} disabled />
      </>
    ),
  },
};

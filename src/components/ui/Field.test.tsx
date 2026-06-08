import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Field from "./Field";

describe("Field", () => {
  test("renders label and child input together", () => {
    render(
      <Field label="ลูกค้า">
        <input placeholder="ค้นหา" />
      </Field>
    );
    expect(screen.getByText("ลูกค้า")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ค้นหา")).toBeInTheDocument();
  });

  test("shows red asterisk when req=true", () => {
    render(
      <Field label="ชื่อบัญชี" req>
        <input />
      </Field>
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  test("no asterisk when req is absent (default)", () => {
    render(
      <Field label="หมายเหตุ">
        <input />
      </Field>
    );
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  test("preserves child interactivity (user can type)", async () => {
    const user = userEvent.setup();
    render(
      <Field label="ยอดเงิน">
        <input placeholder="amt" />
      </Field>
    );
    const input = screen.getByPlaceholderText("amt") as HTMLInputElement;
    await user.type(input, "1500");
    expect(input.value).toBe("1500");
  });
});

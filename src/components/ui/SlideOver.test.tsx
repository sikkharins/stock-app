import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SlideOver from "./SlideOver";

describe("SlideOver", () => {
  test("renders title and children", () => {
    render(
      <SlideOver title="Detail" onClose={() => {}}>
        <p>body content</p>
      </SlideOver>
    );
    expect(screen.getByText("Detail")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  test("Esc key calls onClose", async () => {
    const onClose = vi.fn();
    render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("backdrop click calls onClose", () => {
    const onClose = vi.fn();
    render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    const backdrop = document.querySelector("[data-slideover-backdrop]");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    await userEvent.click(screen.getByLabelText("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("footer slot renders when provided", () => {
    render(
      <SlideOver title="t" onClose={() => {}} footer={<button>Save</button>}>
        x
      </SlideOver>
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  test("click inside panel does NOT call onClose", () => {
    const onClose = vi.fn();
    render(
      <SlideOver title="t" onClose={onClose}>
        <p data-testid="body">inside</p>
      </SlideOver>
    );
    fireEvent.click(screen.getByTestId("body"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("registers onClose to window.__slideoverClose for mobile back-button", () => {
    const onClose = vi.fn();
    delete (window as any).__slideoverClose;
    const { unmount } = render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    expect((window as any).__slideoverClose).toBe(onClose);
    unmount();
    expect((window as any).__slideoverClose).toBeUndefined();
  });

  test("restores previous __slideoverClose on unmount (nested registration safety)", () => {
    const prev = vi.fn();
    (window as any).__slideoverClose = prev;
    const onClose = vi.fn();
    const { unmount } = render(<SlideOver title="t" onClose={onClose}>x</SlideOver>);
    expect((window as any).__slideoverClose).toBe(onClose);
    unmount();
    expect((window as any).__slideoverClose).toBe(prev);
    delete (window as any).__slideoverClose;
  });
});

import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./useCountUp";

describe("useCountUp", () => {
  test("returns target immediately when instant=true", () => {
    const { result } = renderHook(() => useCountUp(100, 600, true));
    expect(result.current).toBe(100);
  });

  test("starts at 0 on first render with animation enabled", () => {
    const { result } = renderHook(() => useCountUp(100, 600));
    // Before any rAF tick, value is initial 0
    expect(result.current).toBe(0);
  });

  test("snaps to new target on subsequent changes (no re-animation)", () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 600, true), {
      initialProps: { t: 100 },
    });
    expect(result.current).toBe(100);
    act(() => rerender({ t: 250 }));
    expect(result.current).toBe(250);
  });

  test("treats durationMs=0 as instant", () => {
    const { result } = renderHook(() => useCountUp(42, 0));
    expect(result.current).toBe(42);
  });
});

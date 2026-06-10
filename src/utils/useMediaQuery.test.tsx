import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./useMediaQuery";

let listeners: Array<(e: { matches: boolean }) => void> = [];
let currentMatches = false;

beforeEach(() => {
  listeners = [];
  currentMatches = false;
  (window as any).matchMedia = (q: string) => ({
    matches: currentMatches,
    media: q,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners = listeners.filter((l) => l !== cb);
    },
  });
});

describe("useMediaQuery", () => {
  test("returns initial matches value", () => {
    currentMatches = true;
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(true);
  });

  test("updates when matchMedia fires change", () => {
    currentMatches = false;
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(false);
    act(() => listeners.forEach((l) => l({ matches: true })));
    expect(result.current).toBe(true);
  });

  test("returns false when matchMedia is undefined (SSR-safe)", () => {
    (window as any).matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toBe(false);
  });
});

import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import Sparkline from "./Sparkline";

describe("Sparkline", () => {
  test("renders an SVG", () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("renders a polyline with the right number of points", () => {
    const { container } = render(<Sparkline points={[1, 2, 3, 4, 5]} />);
    const poly = container.querySelector("polyline");
    expect(poly).toBeTruthy();
    const pts = (poly!.getAttribute("points") || "").trim().split(/\s+/);
    expect(pts).toHaveLength(5);
  });

  test("renders a flat line when fewer than 2 points", () => {
    const { container } = render(<Sparkline points={[42]} />);
    const poly = container.querySelector("polyline");
    expect(poly).toBeTruthy();
    const pts = (poly!.getAttribute("points") || "").trim().split(/\s+/);
    expect(pts).toHaveLength(2);
  });

  test("renders nothing when points is empty", () => {
    const { container } = render(<Sparkline points={[]} />);
    expect(container.querySelector("polyline")).toBeFalsy();
  });

  test("applies the color prop to stroke", () => {
    const { container } = render(<Sparkline points={[1, 2]} color="#ff0000" />);
    expect(container.querySelector("polyline")!.getAttribute("stroke")).toBe("#ff0000");
  });
});

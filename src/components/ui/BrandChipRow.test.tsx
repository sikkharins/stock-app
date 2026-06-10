import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BrandChipRow from "./BrandChipRow";

describe("BrandChipRow", () => {
  const brands = ["LG", "SAMSUNG", "HAIER"];
  const counts = { LG: 30, SAMSUNG: 12, HAIER: 5 };

  test("renders one chip per brand with its count", () => {
    render(
      <BrandChipRow brands={brands} counts={counts} value="" onChange={() => {}} />
    );
    expect(screen.getByText("LG")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("SAMSUNG")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  test("clicking a chip calls onChange with that brand", async () => {
    const onChange = vi.fn();
    render(
      <BrandChipRow brands={brands} counts={counts} value="" onChange={onChange} />
    );
    await userEvent.click(screen.getByText("SAMSUNG"));
    expect(onChange).toHaveBeenCalledWith("SAMSUNG");
  });

  test("clicking the active chip clears (calls onChange with empty string)", async () => {
    const onChange = vi.fn();
    render(
      <BrandChipRow brands={brands} counts={counts} value="LG" onChange={onChange} />
    );
    await userEvent.click(screen.getByText("LG"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  test("missing count defaults to 0", () => {
    render(
      <BrandChipRow brands={["UNKNOWN"]} counts={{}} value="" onChange={() => {}} />
    );
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

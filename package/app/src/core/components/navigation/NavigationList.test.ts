import { describe, expect, test } from "bun:test";
import {
  navigationRowClassName,
  navigationSectionHeaderClassName,
} from "./navigation";

describe("NavigationList shared density", () => {
  test("keeps sidebar item rows and section headers at 40px", () => {
    expect(navigationRowClassName.split(" ")).toContain("h-10");
    expect(navigationRowClassName.split(" ")).toContain("min-h-10");
    expect(navigationSectionHeaderClassName.split(" ")).toContain("h-10");
    expect(navigationSectionHeaderClassName.split(" ")).toContain("min-h-10");
  });
});

import { describe, expect, test } from "bun:test";
import type { ResumeRoute } from "@rezics/contract";
import { resumeRouteToHref } from "./resumeRoute";

describe("resumeRouteToHref", () => {
  test("node route preserves multi-link TOC disambiguation", () => {
    const route: ResumeRoute = {
      kind: "node",
      bookId: "b1",
      nodeId: "n1",
    };
    expect(resumeRouteToHref(route)).toBe("/book/b1/node/n1");
  });

  test("chapter route targets the chapter reader", () => {
    const route: ResumeRoute = {
      kind: "chapter",
      bookId: "b1",
      chapterId: "c1",
    };
    expect(resumeRouteToHref(route)).toBe("/book/b1/read/c1");
  });

  test("book route targets the book detail", () => {
    const route: ResumeRoute = { kind: "book", bookId: "b1" };
    expect(resumeRouteToHref(route)).toBe("/book/b1");
  });
});

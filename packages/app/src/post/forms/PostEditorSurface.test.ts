import { describe, expect, test } from "bun:test";
import { isPostEditorSurfaceSubmittable } from "../models/postEditorSurface";

describe("isPostEditorSurfaceSubmittable", () => {
  test("requires both title and body", () => {
    expect(
      isPostEditorSurfaceSubmittable({ title: "Title", body: "Body" }),
    ).toBeTrue();
    expect(
      isPostEditorSurfaceSubmittable({ title: "", body: "Body" }),
    ).toBeFalse();
    expect(
      isPostEditorSurfaceSubmittable({ title: "Title", body: "   " }),
    ).toBeFalse();
  });
});

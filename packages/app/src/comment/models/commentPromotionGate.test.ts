import { describe, expect, it } from "bun:test";
import { decidePromotionControls } from "./commentPromotionGate";

const base = {
  viewerCanPromote: true,
  isQuestionThread: true,
  hasSession: true,
  depth: 1,
};

describe("decidePromotionControls", () => {
  it("authorized viewer on a direct reply of a question thread sees both", () => {
    expect(decidePromotionControls(base)).toEqual({
      canPin: true,
      canAccept: true,
    });
  });

  it("hides all controls for an anonymous viewer (no session)", () => {
    expect(decidePromotionControls({ ...base, hasSession: false })).toEqual({
      canPin: false,
      canAccept: false,
    });
  });

  it("hides all controls when the viewer may not promote", () => {
    expect(
      decidePromotionControls({ ...base, viewerCanPromote: false }),
    ).toEqual({ canPin: false, canAccept: false });
  });

  it("hides accept on a non-question thread but keeps pin", () => {
    expect(
      decidePromotionControls({ ...base, isQuestionThread: false }),
    ).toEqual({ canPin: true, canAccept: false });
  });

  it("hides accept on a deep reply (depth > 1) but keeps pin", () => {
    expect(decidePromotionControls({ ...base, depth: 2 })).toEqual({
      canPin: true,
      canAccept: false,
    });
  });

  it("offers no pin on the root itself (depth 0)", () => {
    expect(decidePromotionControls({ ...base, depth: 0 })).toEqual({
      canPin: false,
      canAccept: false,
    });
  });
});

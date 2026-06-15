import { describe, expect, test } from "bun:test";
import { resolvePinboardPinnedPreview } from "./pinnedEntryPreview";

describe("resolvePinboardPinnedPreview", () => {
  test("uses image mode and suppresses text when an image exists", () => {
    expect(
      resolvePinboardPinnedPreview({
        imageUrl: " https://cdn.example.test/pinned.webp ",
        summary: "This should not render with an image.",
        description: "Nor should this.",
        subtitle: "Nor this.",
      }),
    ).toEqual({
      mode: "image",
      imageUrl: "https://cdn.example.test/pinned.webp",
    });
  });

  test("uses summary before longer fallback text", () => {
    expect(
      resolvePinboardPinnedPreview({
        summary: "Short summary",
        description: "Long description",
        subtitle: "Subtitle",
      }),
    ).toEqual({ mode: "text", text: "Short summary" });
  });

  test("falls back through description and subtitle for text mode", () => {
    expect(
      resolvePinboardPinnedPreview({
        summary: " ",
        description: "Description preview",
        subtitle: "Subtitle",
      }),
    ).toEqual({ mode: "text", text: "Description preview" });

    expect(
      resolvePinboardPinnedPreview({
        description: " ",
        subtitle: "Subtitle preview",
      }),
    ).toEqual({ mode: "text", text: "Subtitle preview" });
  });
});

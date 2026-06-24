import { describe, expect, it, mock } from "bun:test";

const ENV_MODULE = "../env";

describe("assertMediaUrl", () => {
  async function loadGuard(mediaPublicBaseUrl: string | undefined) {
    mock.module(ENV_MODULE, () => ({
      env: { MEDIA_PUBLIC_BASE_URL: mediaPublicBaseUrl },
    }));
    const { assertMediaUrl } = await import("./media-url.guard");
    return assertMediaUrl;
  }

  it("passes null and undefined", async () => {
    const guard = await loadGuard("https://media.example.com");
    expect(() => guard(null)).not.toThrow();
    expect(() => guard(undefined)).not.toThrow();
  });

  it("passes valid media URL", async () => {
    const guard = await loadGuard("https://media.example.com");
    expect(() =>
      guard("https://media.example.com/user1/abc.jpg"),
    ).not.toThrow();
  });

  it("passes when base has trailing slash", async () => {
    const guard = await loadGuard("https://media.example.com/");
    expect(() =>
      guard("https://media.example.com/user1/abc.jpg"),
    ).not.toThrow();
  });

  it("rejects URL from different origin", async () => {
    const guard = await loadGuard("https://media.example.com");
    expect(() => guard("https://evil.com/image.png")).toThrow(
      /Media URL must start with/,
    );
  });

  it("rejects URL that is a prefix attack", async () => {
    const guard = await loadGuard("https://media.example.com");
    expect(() => guard("https://media.example.com.evil.com/x.png")).toThrow(
      /Media URL must start with/,
    );
  });

  it("skips validation when MEDIA_PUBLIC_BASE_URL is unset", async () => {
    const guard = await loadGuard(undefined);
    expect(() => guard("https://anything.com/image.png")).not.toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { createPreviewApp } from "./app";

describe("createPreviewApp", () => {
  test("serves the health endpoint without starting a listener", async () => {
    const app = createPreviewApp();
    const response = await app.handle(
      new Request("http://preview.test/health"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

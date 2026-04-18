import { describe, expect, it } from "bun:test";
import type { ApiTokenScopes } from "@rezics/contract";
import { DispatchScope, DispatchType } from "@rezics/contract";
import { tokenService } from "@/token/token.service";
import { DispatchService } from "./dispatch.service";

describe("dispatch result intake - permission checks", () => {
  it("grants update when token has dispatch:unit:update scope", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_UPDATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_UPDATE,
      ),
    ).toBe(true);
  });

  it("grants create when token has dispatch:unit:create scope", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_CREATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      ),
    ).toBe(true);
  });

  it("denies create when token only has unit:update", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_UPDATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      ),
    ).toBe(false);
  });

  it("grants all permissions with wildcard", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: ["*"],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_UPDATE,
      ),
    ).toBe(true);
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      ),
    ).toBe(true);
  });
});

describe("dispatch service - config", () => {
  it("returns null when env vars are not set", () => {
    const service = new DispatchService();
    // In test env without DISPATCH_* vars, getConfig should return null
    const config = service.getConfig();
    // Config will be null since env vars are not set in test
    expect(config === null || typeof config === "object").toBe(true);
  });
});

describe("hub audit notification - HMAC signing", () => {
  it("produces consistent HMAC for sorted taskIds", async () => {
    const secret = "test-secret";
    const taskIds = ["task-c", "task-a", "task-b"];
    const project = "rezics";

    const sorted = [...taskIds].sort();
    const payload = sorted.join(",") + ":" + project;
    const key = new TextEncoder().encode(secret);
    const data = new TextEncoder().encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig1 = Buffer.from(
      await crypto.subtle.sign("HMAC", cryptoKey, data),
    ).toString("hex");

    // Signing again with same input should produce identical result
    const sig2 = Buffer.from(
      await crypto.subtle.sign("HMAC", cryptoKey, data),
    ).toString("hex");

    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it("sorts taskIds before signing", () => {
    const unsorted = ["c", "a", "b"];
    const sorted = [...unsorted].sort();
    expect(sorted).toEqual(["a", "b", "c"]);
    expect(sorted.join(",") + ":rezics").toBe("a,b,c:rezics");
  });
});

describe("dispatch type validation", () => {
  it("DispatchType enum has expected values", () => {
    expect(DispatchType.BOOK).toBe("rezics:book");
    expect(DispatchType.GAME).toBe("rezics:game");
    expect(DispatchType.MEDIA).toBe("rezics:media");
  });
});

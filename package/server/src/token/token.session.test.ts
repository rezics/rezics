import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ApiTokenScopes } from "@rezics/contract";
import { DispatchScope } from "@rezics/contract";
import { tokenService } from "./token.service";

/**
 * Unit tests for POST /token/session
 *
 * These test the route handler logic by mocking the token service and database.
 * Integration tests with a real database are out of scope here.
 */

// We test the core logic extracted from the route handler:
// 1. authenticateFromHeader → returns userId + scopes
// 2. hasScope check for dispatch:rezics-server-session
// 3. User lookup + session token signing

describe("token session - scope check", () => {
  it("grants access when token has dispatch:rezics-server-session scope", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.SESSION],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.SESSION,
      ),
    ).toBe(true);
  });

  it("grants access when token has wildcard scope", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: ["*"],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.SESSION,
      ),
    ).toBe(true);
  });

  it("denies access when token lacks dispatch domain", () => {
    const scopes: ApiTokenScopes = {
      book: ["read", "write"],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.SESSION,
      ),
    ).toBe(false);
  });

  it("denies access when token has dispatch domain but wrong permission", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_UPDATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.SESSION,
      ),
    ).toBe(false);
  });

  it("denies access when scopes are null", () => {
    expect(
      tokenService.hasScope(null, DispatchScope.DOMAIN, DispatchScope.SESSION),
    ).toBe(false);
  });

  it("denies access when scopes are undefined", () => {
    expect(
      tokenService.hasScope(
        undefined,
        DispatchScope.DOMAIN,
        DispatchScope.SESSION,
      ),
    ).toBe(false);
  });
});

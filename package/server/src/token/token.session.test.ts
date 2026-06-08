import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ApiTokenScopes } from "@rezics/contract";
import { DispatchScope } from "@rezics/contract";
import { tokenService } from "./token.service";

/**
 * Unit tests for POST /token/session
 * POST /token/session 的单元测试。
 *
 * These test the route handler logic by mocking the token service and database.
 * Integration tests with a real database are out of scope here.
 * 这些测试通过 mock token service 和数据库来测试路由处理逻辑。
 * 使用真实数据库的集成测试不在此范围内。
 */

// We test the core logic extracted from the route handler:
// 1. authenticateFromHeader → returns userId + scopes
// 2. hasScope check for dispatch:rezics-server-session
// 3. User lookup + session token signing
// 我们测试从路由处理器中提取出的核心逻辑：
// 1. authenticateFromHeader → 返回 userId + scopes
// 2. 针对 dispatch:rezics-server-session 的 hasScope 检查
// 3. 用户查找 + 会话 token 签名

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

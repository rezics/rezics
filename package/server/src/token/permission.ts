import type { ApiTokenScopes } from "@rezics/contract";
import { unitService } from "../unit/unit.service";
import { tokenService } from "./token.service";

export function hasPermissionToReadBook(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, "book", "read")) return true;
  return false;
}

export function hasPermissionToCreateBook(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, "book", "write")) return true;
  return false;
}

export async function hasPermissionToUpdateBook(
  scopes: ApiTokenScopes,
  opt?: { unitId?: string; userId?: string },
): Promise<boolean> {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, "book", "write")) return true;
  if (opt?.unitId) {
    const unit = await unitService.getByUnitId(opt.unitId);
    if (!unit || unit.userId !== opt.userId) {
      return false;
    }
  }
  return false;
}

export function hasPermissionToReadUser(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, "user", "read")) return true;
  return false;
}

export function hasPermissionToCreateUser(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, "user", "write")) return true;
  return false;
}

export function hasPermissionToUpdateUser(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, "user", "write")) return true;
  return false;
}

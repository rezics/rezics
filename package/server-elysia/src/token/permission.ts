import type {ApiTokenScopes} from '@package/contract';
import {tokenService} from './token.service';
import {unitService} from '../unit/unit.service';

export function hasPermissionToReadBook(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, 'book', 'read')) return true;
  return false;
}

export function hasPermissionToCreateBook(scopes: ApiTokenScopes): boolean {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, 'book', 'write')) return true;
  return false;
}

export async function hasPermissionToUpdateBook(
  scopes: ApiTokenScopes,
  opt?: {unitId?: string; userId?: string},
): Promise<boolean> {
  if (tokenService.hasAdminScope(scopes)) return true;
  if (tokenService.hasScope(scopes, 'book', 'write')) return true;
  if (opt?.unitId) {
    const unit = await unitService.getByUnitId(opt.unitId);
    if (!unit || unit.userId !== opt.userId) {
      return false;
    }
  }
  return false;
}

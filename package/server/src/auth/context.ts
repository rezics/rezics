import {Elysia} from 'elysia';
import type {
  AuthIdentityTokenClaims,
  RezicsSessionTokenClaims,
  TokenPermissionRole,
  UserDTO,
} from '@package/contract';
import {BasicAdminPermission} from '@package/contract';
import {verifyAuth, verifySessionToken} from '../user/util';
import {getMainSessionJwtContext, REZICS_SESSION_HEADER} from '../session/jwt';
import {userService} from '../user/service/user.service';
import {mapUserToDTO} from '../user/model/mapper';

function hasRole(roles: string[] | undefined, role: TokenPermissionRole): boolean {
  return Boolean(roles?.includes(role));
}

function matchesSnapshotRole(
  snapshotRole: TokenPermissionRole,
  persistedRoles: string[] | undefined,
): boolean {
  switch (snapshotRole) {
    case 'ROOT':
      return hasRole(persistedRoles, 'ROOT');
    case 'ADMIN':
      return hasRole(persistedRoles, 'ROOT') || hasRole(persistedRoles, 'ADMIN');
    case 'USER':
      return !hasRole(persistedRoles, 'BLOCKED');
    case 'BLOCKED':
      return hasRole(persistedRoles, 'BLOCKED');
    default:
      return false;
  }
}

export const identityContextPlugin = new Elysia().derive(async ctx => {
  const identity = await verifyAuth<AuthIdentityTokenClaims>(
    ctx.headers.authorization,
    ctx.set,
  );
  const unitId = identity.unitId || identity.sub;
  if (!unitId) {
    ctx.set.status = 401;
    throw new Error('Unauthorized: Missing identity unitId');
  }

  return {
    identity: {
      ...identity,
      unitId,
    },
  };
});

export const sessionContextPlugin = new Elysia()
  .use(identityContextPlugin)
  .derive(async ctx => {
    const session = (
      await verifySessionToken<RezicsSessionTokenClaims>(
        ctx.headers[REZICS_SESSION_HEADER],
        {
          ...getMainSessionJwtContext(),
        },
      )
    ).payload;

    if (session.unitId !== ctx.identity.unitId) {
      ctx.set.status = 401;
      throw new Error('Unauthorized: Identity and session token mismatch');
    }

    const persistedUser = await userService.getByUnitId(ctx.identity.unitId);
    const currentUser = mapUserToDTO(persistedUser);
    const persistedRoles = currentUser.permission?.role;

    if (!matchesSnapshotRole(session.permission.role, persistedRoles)) {
      ctx.set.status = 403;
      throw new Error('Forbidden: Persisted permissions no longer match session');
    }

    if (persistedRoles?.includes('BLOCKED')) {
      ctx.set.status = 403;
      throw new Error('Forbidden: User is blocked');
    }

    return {
      session,
      currentUser,
    };
  });

export function buildActorFromContext(input: {
  identity: {unitId: string};
  currentUser: UserDTO;
}): UserDTO {
  return {
    ...input.currentUser,
    unitId: input.identity.unitId,
  };
}

export function requireAdminSession(input: {
  session: RezicsSessionTokenClaims;
  currentUser: UserDTO;
  set: {status?: number};
}): void {
  if (
    input.session.permission.role !== 'ROOT' &&
    input.session.permission.role !== 'ADMIN'
  ) {
    input.set.status = 403;
    throw new Error('Forbidden: Admin role required');
  }

  if (!BasicAdminPermission(input.currentUser)) {
    input.set.status = 403;
    throw new Error('Forbidden: Persisted admin permission required');
  }
}

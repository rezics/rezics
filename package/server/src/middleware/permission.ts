import {Elysia} from 'elysia';
import type {
  AuthIdentityTokenClaims,
  RezicsSessionTokenClaims,
  TokenPermissionRole,
  UserDTO,
} from '@package/contract';
import {BasicAdminPermission} from '@package/contract';
import {userService} from '../user/service/user.service';
import {mapUserToDTO} from '../user/model/mapper';

/**
 * Type-declaration plugin that tells Elysia about globally-resolved token
 * context properties. The actual resolution is done by createTokenResolver
 * plugins at the app level; this plugin only provides the type information
 * so downstream guards can reference them with full inference.
 *
 * TODO Here need to have some problem, which needs to be fixed
 */
const tokenContext = new Elysia({name: 'ctx/tokenContext'}).derive(
  {as: 'scoped'},
  ({store: _, ...ctx}) =>
    ctx as unknown as {
      authIdentityToken: AuthIdentityTokenClaims | null;
      rezicsSessionToken: RezicsSessionTokenClaims | null;
    },
);

function hasRole(
  roles: string[] | undefined,
  role: TokenPermissionRole,
): boolean {
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
      return (
        hasRole(persistedRoles, 'ROOT') || hasRole(persistedRoles, 'ADMIN')
      );
    case 'USER':
      return !hasRole(persistedRoles, 'BLOCKED');
    case 'BLOCKED':
      return hasRole(persistedRoles, 'BLOCKED');
    default:
      return false;
  }
}

export const requireLogin = new Elysia({name: 'guard/requireLogin'})
  .use(tokenContext)
  .resolve({as: 'scoped'}, async ({authIdentityToken, set}) => {
    if (!authIdentityToken) {
      set.status = 401;
      throw new Error('Unauthorized: Missing identity token');
    }

    const unitId = authIdentityToken.unitId || authIdentityToken.sub;
    if (!unitId) {
      set.status = 401;
      throw new Error('Unauthorized: Missing identity unitId');
    }

    return {
      identity: {
        ...authIdentityToken,
        unitId,
      },
    };
  });

export const requireOwner = new Elysia({name: 'guard/requireOwner'})
  .use(tokenContext)
  .use(requireLogin)
  .resolve({as: 'scoped'}, async ({identity, rezicsSessionToken, set}) => {
    if (!identity) {
      set.status = 401;
      throw new Error('Unauthorized: Missing identity');
    }

    if (!rezicsSessionToken) {
      set.status = 401;
      throw new Error('Unauthorized: Missing session token');
    }

    if (rezicsSessionToken.unitId !== identity.unitId) {
      set.status = 401;
      throw new Error('Unauthorized: Identity and session token mismatch');
    }

    const persistedUser = await userService.getByUnitId(identity.unitId);
    const currentUser = mapUserToDTO(persistedUser);
    const persistedRoles = currentUser.permission?.role;

    if (
      !matchesSnapshotRole(rezicsSessionToken.permission.role, persistedRoles)
    ) {
      set.status = 403;
      throw new Error(
        'Forbidden: Persisted permissions no longer match session',
      );
    }

    if (persistedRoles?.includes('BLOCKED')) {
      set.status = 403;
      throw new Error('Forbidden: User is blocked');
    }

    return {
      identity,
      session: rezicsSessionToken,
      currentUser,
    };
  });

export const requireAdmin = new Elysia({name: 'guard/requireAdmin'})
  .use(requireOwner)
  .resolve({as: 'scoped'}, async ({identity, session, currentUser, set}) => {
    if (!session || !currentUser) {
      set.status = 401;
      throw new Error('Unauthorized: Missing session or user context');
    }

    if (
      session.permission.role !== 'ROOT' &&
      session.permission.role !== 'ADMIN'
    ) {
      set.status = 403;
      throw new Error('Forbidden: Admin role required');
    }

    if (!BasicAdminPermission(currentUser)) {
      set.status = 403;
      throw new Error('Forbidden: Persisted admin permission required');
    }

    return {identity, session, currentUser};
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
  set: {status?: number | string};
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

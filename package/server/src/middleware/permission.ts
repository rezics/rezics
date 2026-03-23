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

export const requireLogin = new Elysia({name: 'guard/requireLogin'}).resolve(
  {as: 'scoped'},
  async ({
    authIdentityToken,
    set,
  }: {
    authIdentityToken: AuthIdentityTokenClaims | null;
    set: {status?: number | string};
  }) => {
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
  },
);

export const requireOwner = new Elysia({name: 'guard/requireOwner'})
  .use(requireLogin)
  .resolve(
    {as: 'scoped'},
    async ({
      identity,
      rezicsSessionToken,
      set,
    }: {
      identity: AuthIdentityTokenClaims & {unitId: string};
      rezicsSessionToken: RezicsSessionTokenClaims | null;
      set: {status?: number | string};
    }) => {
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
    },
  );

export const requireAdmin = new Elysia({name: 'guard/requireAdmin'})
  .use(requireOwner)
  .resolve(
    {as: 'scoped'},
    async ({
      identity,
      session,
      currentUser,
      set,
    }: {
      identity: AuthIdentityTokenClaims & {unitId: string};
      session: RezicsSessionTokenClaims;
      currentUser: UserDTO;
      set: {status?: number | string};
    }) => {
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
    },
  );

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

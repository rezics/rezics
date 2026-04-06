import type {
  AuthIdentityTokenClaims,
  RezicsSessionTokenClaims,
  TokenPermissionRole,
  UserDTO,
} from "@rezics/contract";
import { BasicAdminPermission, TokenTransportHeader } from "@rezics/contract";
import { Elysia, status } from "elysia";
import { mapUserToDTO } from "../user/model/mapper";
import { userService } from "../user/service/user.service";

interface GlobalTokenContext {
  authIdentityToken: AuthIdentityTokenClaims | null;
  rezicsSessionToken: RezicsSessionTokenClaims | null;
  headers: Record<string, string | undefined>;
}

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
    case "ROOT":
      return hasRole(persistedRoles, "ROOT");
    case "ADMIN":
      return (
        hasRole(persistedRoles, "ROOT") || hasRole(persistedRoles, "ADMIN")
      );
    case "USER":
      return !hasRole(persistedRoles, "BLOCKED");
    case "BLOCKED":
      return hasRole(persistedRoles, "BLOCKED");
    default:
      return false;
  }
}

export const authMacro = new Elysia({ name: "macro/auth" })
  .macro("requireLogin", {
    async resolve(ctx) {
      const { authIdentityToken, headers } =
        ctx as unknown as GlobalTokenContext;

      if (!authIdentityToken) {
        const headerKey = TokenTransportHeader.AUTHORIZATION.toLowerCase();
        const hadHeader = !!headers[headerKey];
        return status(
          401,
          hadHeader
            ? "Unauthorized: Identity token is invalid or expired"
            : "Unauthorized: No authorization header provided",
        );
      }

      const unitId = authIdentityToken.unitId || authIdentityToken.sub;
      if (!unitId) {
        return status(401, "Unauthorized: Identity token missing unitId claim");
      }

      return {
        identity: {
          ...authIdentityToken,
          unitId,
        },
      };
    },
  })
  .macro("requireOwner", {
    requireLogin: true,
    async resolve(ctx) {
      const { identity, rezicsSessionToken, headers } = ctx as unknown as {
        identity: { unitId: string } & AuthIdentityTokenClaims;
        rezicsSessionToken: RezicsSessionTokenClaims | null;
        headers: Record<string, string | undefined>;
      };

      if (!rezicsSessionToken) {
        const headerKey = TokenTransportHeader.REZICS_SESSION.toLowerCase();
        const hadHeader = !!headers[headerKey];
        return status(
          401,
          hadHeader
            ? "Unauthorized: Session token is invalid or expired"
            : "Unauthorized: No session token header provided",
        );
      }

      if (rezicsSessionToken.unitId !== identity.unitId) {
        return status(401, "Unauthorized: Identity and session token mismatch");
      }

      const persistedUser = await userService.getByUnitId(identity.unitId);
      const currentUser = mapUserToDTO(persistedUser);
      const persistedRoles = currentUser.permission?.role;

      if (
        !matchesSnapshotRole(rezicsSessionToken.permission.role, persistedRoles)
      ) {
        return status(
          403,
          "Forbidden: Persisted permissions no longer match session",
        );
      }

      if (persistedRoles?.includes("BLOCKED")) {
        return status(403, "Forbidden: User is blocked");
      }

      return {
        identity,
        session: rezicsSessionToken,
        currentUser,
      };
    },
  })
  .macro("requireAdmin", {
    requireOwner: true,
    resolve(ctx) {
      const { session, currentUser } = ctx as unknown as {
        session: RezicsSessionTokenClaims;
        currentUser: UserDTO;
      };

      if (
        session.permission.role !== "ROOT" &&
        session.permission.role !== "ADMIN"
      ) {
        return status(403, "Forbidden: Admin role required");
      }

      if (!BasicAdminPermission(currentUser)) {
        return status(403, "Forbidden: Persisted admin permission required");
      }
    },
  })
  .macro("requireRoot", {
    requireOwner: true,
    resolve(ctx) {
      const { session } = ctx as unknown as {
        session: RezicsSessionTokenClaims;
      };

      if (session.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
    },
  });

export function buildActorFromContext(input: {
  identity: { unitId: string };
  currentUser: UserDTO;
}): UserDTO {
  return {
    ...input.currentUser,
    unitId: input.identity.unitId,
  };
}

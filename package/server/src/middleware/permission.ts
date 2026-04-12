import type { AuthIdentityTokenClaims, UserDTO } from "@rezics/contract";
import { BasicAdminPermission, TokenTransportHeader } from "@rezics/contract";
import { Elysia, status } from "elysia";
import { mapUserToDTO } from "../user/model/mapper";
import { userService } from "../user/service/user.service";
import { cacheUser, getOrFetchUser } from "./user-cache";

interface GlobalTokenContext {
  authIdentityToken: AuthIdentityTokenClaims | null;
  headers: Record<string, string | undefined>;
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
      const { identity } = ctx as unknown as {
        identity: { unitId: string } & AuthIdentityTokenClaims;
      };

      let currentUser = getOrFetchUser(identity.unitId);

      if (!currentUser) {
        const persistedUser = await userService
          .getByUnitId(identity.unitId)
          .catch(() => null);

        if (persistedUser) {
          currentUser = mapUserToDTO(persistedUser);
        } else {
          const newUser = await userService.provisionFromJwt({
            unitId: identity.unitId,
            slug: identity.slug,
            name: identity.name,
          });
          currentUser = mapUserToDTO(newUser);
        }

        cacheUser(identity.unitId, currentUser);
      }

      if (currentUser.permission?.role?.includes("BLOCKED")) {
        return status(403, "Forbidden: User is blocked");
      }

      return {
        identity,
        currentUser,
      };
    },
  })
  .macro("requireAdmin", {
    requireOwner: true,
    resolve(ctx) {
      const { currentUser } = ctx as unknown as {
        currentUser: UserDTO;
      };

      const roles = currentUser.permission?.role;
      if (!roles?.includes("ROOT") && !roles?.includes("ADMIN")) {
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
      const { currentUser } = ctx as unknown as {
        currentUser: UserDTO;
      };

      if (!currentUser.permission?.role?.includes("ROOT")) {
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

import {
  type RealmExtraAdminReadResponse,
  realmExtraAdminReadResponseSchema,
  realmExtraAppendBodySchema,
  realmExtraEntryPathParamsSchema,
  realmExtraListPathParamsSchema,
  type RealmExtraOkResponse,
  realmExtraOkResponseSchema,
  type RealmExtraReadResponse,
  realmExtraReadResponseSchema,
  realmExtraReorderBodySchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import {
  appendToList,
  readListAdmin,
  readListPublic,
  RealmExtraError,
  removeFromList,
  reorderList,
} from "./realm-extra.service";

function handleError(error: unknown): never {
  if (error instanceof RealmExtraError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const realmExtraApi = new Elysia()
  .use(authMacro)
  .get(
    "/realm/:realmId/extra/:key",
    async ({ params, headers }): Promise<RealmExtraReadResponse> => {
      const identity = await tryResolveIdentity(headers["authorization"]);
      const unitIds = await readListPublic(identity, params.realmId, params.key);
      return { realmId: params.realmId, key: params.key, unitIds };
    },
    {
      params: realmExtraListPathParamsSchema,
      response: realmExtraReadResponseSchema,
      detail: {
        summary: "Read a Realm.extra list (public, stale-filtered)",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .get(
    "/realm/:realmId/extra/:key/admin",
    async ({ params, identity }): Promise<RealmExtraAdminReadResponse> => {
      try {
        const { unitIds, staleIds } = await readListAdmin(
          identity,
          params.realmId,
          params.key,
        );
        return {
          realmId: params.realmId,
          key: params.key,
          unitIds,
          staleIds,
        };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: realmExtraListPathParamsSchema,
      response: realmExtraAdminReadResponseSchema,
      detail: {
        summary: "Read a Realm.extra list (admin, includes stale entries)",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .post(
    "/realm/:realmId/extra/:key/append",
    async ({ params, body, identity }): Promise<RealmExtraOkResponse> => {
      try {
        const { unitIds } = await appendToList(
          identity,
          params.realmId,
          params.key,
          body.unitId,
        );
        return { ok: true, unitIds };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: realmExtraListPathParamsSchema,
      body: realmExtraAppendBodySchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Append a unit to a Realm.extra list",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .post(
    "/realm/:realmId/extra/:key/reorder",
    async ({ params, body, identity }): Promise<RealmExtraOkResponse> => {
      try {
        const { unitIds } = await reorderList(
          identity,
          params.realmId,
          params.key,
          body.unitIds,
        );
        return { ok: true, unitIds };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: realmExtraListPathParamsSchema,
      body: realmExtraReorderBodySchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Reorder a Realm.extra list (must be a permutation)",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .delete(
    "/realm/:realmId/extra/:key/:unitId",
    async ({ params, identity }): Promise<RealmExtraOkResponse> => {
      try {
        const { unitIds } = await removeFromList(
          identity,
          params.realmId,
          params.key,
          params.unitId,
        );
        return { ok: true, unitIds };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: realmExtraEntryPathParamsSchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Remove a unit from a Realm.extra list",
        tags: ["Realm", "RealmExtra"],
      },
    },
  );

export type RealmExtraApi = typeof realmExtraApi;

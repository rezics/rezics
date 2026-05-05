import {
  type RealmExtraAdminReadResponse,
  realmExtraAdminReadResponseSchema,
  realmExtraAppendBodySchema,
  type RealmExtraOkResponse,
  realmExtraOkResponseSchema,
  type RealmExtraReadResponse,
  realmExtraReadResponseSchema,
  realmExtraReorderBodySchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import {
  appendToList,
  readListAdmin,
  readListPublic,
  RealmExtraError,
  removeFromList,
  reorderList,
  clearSingleExtraKey,
  setSingleExtraKey,
  setTagTreeExtra,
} from "./realm-extra.service";

// Param names match `realmApi`'s `:unitId` — memoirist rejects mismatched names at the same trie position.
const listParamsSchema = t.Object({
  unitId: t.String(),
  key: t.String(),
});

const entryParamsSchema = t.Object({
  unitId: t.String(),
  key: t.String(),
  contentUnitId: t.String(),
});

const singleValueBodySchema = t.Object({
  value: t.Any(),
});

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
    "/realm/:unitId/extra/:key",
    async ({ params, headers }): Promise<RealmExtraReadResponse> => {
      const identity = await tryResolveIdentity(headers["authorization"]);
      const unitIds = await readListPublic(identity, params.unitId, params.key);
      return { realmId: params.unitId, key: params.key, unitIds };
    },
    {
      params: listParamsSchema,
      response: realmExtraReadResponseSchema,
      detail: {
        summary: "Read a Realm.extra list (public, stale-filtered)",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .get(
    "/realm/:unitId/extra/:key/admin",
    async ({ params, identity }): Promise<RealmExtraAdminReadResponse> => {
      try {
        const { unitIds, staleIds } = await readListAdmin(
          identity,
          params.unitId,
          params.key,
        );
        return {
          realmId: params.unitId,
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
      params: listParamsSchema,
      response: realmExtraAdminReadResponseSchema,
      detail: {
        summary: "Read a Realm.extra list (admin, includes stale entries)",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .post(
    "/realm/:unitId/extra/:key/append",
    async ({ params, body, identity }): Promise<RealmExtraOkResponse> => {
      try {
        const { unitIds } = await appendToList(
          identity,
          params.unitId,
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
      params: listParamsSchema,
      body: realmExtraAppendBodySchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Append a unit to a Realm.extra list",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .post(
    "/realm/:unitId/extra/:key/reorder",
    async ({ params, body, identity }): Promise<RealmExtraOkResponse> => {
      try {
        const { unitIds } = await reorderList(
          identity,
          params.unitId,
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
      params: listParamsSchema,
      body: realmExtraReorderBodySchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Reorder a Realm.extra list (must be a permutation)",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .put(
    "/realm/:unitId/extra/:key",
    async ({ params, body, identity }): Promise<RealmExtraOkResponse> => {
      try {
        if (params.key === "tagTree") {
          await setTagTreeExtra(identity, params.unitId, body.value);
        } else {
          await setSingleExtraKey(
            identity,
            params.unitId,
            params.key,
            body.value,
          );
        }
        return { ok: true };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: listParamsSchema,
      body: singleValueBodySchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Set a single Realm.extra value",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .delete(
    "/realm/:unitId/extra/:key",
    async ({ params, identity }): Promise<RealmExtraOkResponse> => {
      try {
        await clearSingleExtraKey(identity, params.unitId, params.key);
        return { ok: true };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: listParamsSchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Clear a single Realm.extra value",
        tags: ["Realm", "RealmExtra"],
      },
    },
  )
  .delete(
    "/realm/:unitId/extra/:key/:contentUnitId",
    async ({ params, identity }): Promise<RealmExtraOkResponse> => {
      try {
        const { unitIds } = await removeFromList(
          identity,
          params.unitId,
          params.key,
          params.contentUnitId,
        );
        return { ok: true, unitIds };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: entryParamsSchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Remove a unit from a Realm.extra list",
        tags: ["Realm", "RealmExtra"],
      },
    },
  );

export type RealmExtraApi = typeof realmExtraApi;

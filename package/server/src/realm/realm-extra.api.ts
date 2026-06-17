import {
  type RealmExtraOkResponse,
  realmExtraOkResponseSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import { assertMediaUrl } from "../upload/media-url.guard";
import {
  clearSingleExtraKey,
  RealmExtraError,
  setSingleExtraKey,
} from "./realm-extra.service";

const paramsSchema = t.Object({
  unitId: t.String(),
  key: t.String(),
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
  .put(
    "/realm/:unitId/extra/:key",
    async ({ params, body, identity }): Promise<RealmExtraOkResponse> => {
      if (
        (params.key === "avatar" || params.key === "banner") &&
        body.value &&
        typeof body.value === "object" &&
        body.value.kind === "url"
      ) {
        assertMediaUrl(body.value.url);
      }
      try {
        await setSingleExtraKey(
          identity,
          params.unitId,
          params.key,
          body.value,
        );
        return { ok: true };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: paramsSchema,
      body: singleValueBodySchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Set a single Realm.extra profile/settings value",
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
      params: paramsSchema,
      response: realmExtraOkResponseSchema,
      detail: {
        summary: "Clear a single Realm.extra profile/settings value",
        tags: ["Realm", "RealmExtra"],
      },
    },
  );

export type RealmExtraApi = typeof realmExtraApi;

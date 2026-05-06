import type {
  RealmTagContextDTO,
  RealmTagContextReadResponse,
} from "@rezics/contract";
import {
  realmTagContextMaterializeResponseSchema,
  realmTagContextPathParamsSchema,
  realmTagContextReadResponseSchema,
  realmTagContextUpdateResponseSchema,
  updateRealmTagContextSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro } from "@/middleware";
import {
  mapRealmTagContextToDTO,
} from "./realm.mapper";
import {
  RealmTagContextError,
  realmTagContextService,
} from "./realm-tag-context.service";

function handleRealmTagContextError(error: unknown): never {
  if (error instanceof RealmTagContextError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const realmTagContextApi = new Elysia({
  prefix: "/realm-tag-context",
})
  .use(authMacro)
  .get(
    "/:realmUnitId/:tagUnitId",
    async ({ params }): Promise<RealmTagContextReadResponse> => {
      try {
        const row = await realmTagContextService.get(
          params.realmUnitId,
          params.tagUnitId,
        );
        return { context: row ? mapRealmTagContextToDTO(row) : null };
      } catch (error) {
        handleRealmTagContextError(error);
      }
    },
    {
      params: realmTagContextPathParamsSchema,
      response: realmTagContextReadResponseSchema,
      detail: {
        summary: "Read realm tag context",
        description:
          "Reads pair-level interpretation context for an existing realm and global tag.",
        tags: ["Realms", "Tags"],
      },
    },
  )
  .put(
    "/:realmUnitId/:tagUnitId",
    async ({ params, body, identity }): Promise<RealmTagContextDTO> => {
      try {
        const allowed = await realmTagContextService.canManageContext(
          identity,
          params.realmUnitId,
        );
        if (!allowed) {
          throw new RealmTagContextError(
            "FORBIDDEN",
            "Only realm moderators, realm owners, or platform admins may update realm tag contexts",
            403,
          );
        }

        const row = await realmTagContextService.upsert(
          params.realmUnitId,
          params.tagUnitId,
          body,
        );
        return mapRealmTagContextToDTO(row);
      } catch (error) {
        handleRealmTagContextError(error);
      }
    },
    {
      requireLogin: true,
      params: realmTagContextPathParamsSchema,
      body: updateRealmTagContextSchema,
      response: realmTagContextUpdateResponseSchema,
      detail: {
        summary: "Update realm tag context",
        description:
          "Upserts pair-level context metadata without creating RealmTagUnit rows.",
        tags: ["Realms", "Tags"],
      },
    },
  )
  .post(
    "/:realmUnitId/:tagUnitId/materialize",
    async ({ params, identity }): Promise<RealmTagContextDTO> => {
      try {
        const allowed = await realmTagContextService.canManageContext(
          identity,
          params.realmUnitId,
        );
        if (!allowed) {
          throw new RealmTagContextError(
            "FORBIDDEN",
            "Only realm moderators, realm owners, or platform admins may materialize realm tag contexts",
            403,
          );
        }

        const row = await realmTagContextService.materialize(
          identity.userId,
          params.realmUnitId,
          params.tagUnitId,
        );
        return mapRealmTagContextToDTO(row);
      } catch (error) {
        handleRealmTagContextError(error);
      }
    },
    {
      requireLogin: true,
      params: realmTagContextPathParamsSchema,
      response: realmTagContextMaterializeResponseSchema,
      detail: {
        summary: "Materialize realm tag context content",
        description:
          "Idempotently creates the optional content Unit for a realm/tag pair.",
        tags: ["Realms", "Tags"],
      },
    },
  );

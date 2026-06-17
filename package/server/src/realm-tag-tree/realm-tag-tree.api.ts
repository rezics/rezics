import type { RealmTagTreeReadResponse } from "@rezics/contract";
import {
  realmParamsSchema,
  realmTagTreeReadResponseSchema,
  updateRealmTagTreeSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro } from "@/middleware";
import {
  RealmTagTreeError,
  realmTagTreeService,
} from "./realm-tag-tree.service";

function handleRealmTagTreeError(error: unknown): never {
  if (error instanceof RealmTagTreeError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const realmTagTreeApi = new Elysia({ prefix: "/realm" })
  .use(authMacro)
  .get(
    "/:unitId/tag-tree",
    async ({ params }): Promise<RealmTagTreeReadResponse> => {
      try {
        return await realmTagTreeService.get(params.unitId);
      } catch (error) {
        handleRealmTagTreeError(error);
      }
    },
    {
      params: realmParamsSchema,
      response: realmTagTreeReadResponseSchema,
      detail: {
        summary: "Read realm tag tree",
        tags: ["Realm", "RealmTagTree"],
      },
    },
  )
  .put(
    "/:unitId/tag-tree",
    async ({ params, body, identity }): Promise<RealmTagTreeReadResponse> => {
      try {
        return await realmTagTreeService.update(
          identity,
          params.unitId,
          body.tree,
        );
      } catch (error) {
        handleRealmTagTreeError(error);
      }
    },
    {
      requireLogin: true,
      params: realmParamsSchema,
      body: updateRealmTagTreeSchema,
      response: realmTagTreeReadResponseSchema,
      detail: {
        summary: "Update realm tag tree",
        tags: ["Realm", "RealmTagTree"],
      },
    },
  );

export type RealmTagTreeApi = typeof realmTagTreeApi;

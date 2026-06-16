import type { RealmSidebar } from "@rezics/contract";
import { realmSidebarEnvelopeSchema } from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import {
  RealmSidebarError,
  realmSidebarService,
} from "./realm-sidebar.service";

const paramsSchema = t.Object({
  unitId: t.String(),
});

function handleError(error: unknown): never {
  if (error instanceof RealmSidebarError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const realmSidebarApi = new Elysia()
  .use(authMacro)
  .get(
    "/realm/:unitId/sidebar",
    async ({ params }): Promise<RealmSidebar> => {
      try {
        return await realmSidebarService.read(params.unitId);
      } catch (error) {
        handleError(error);
      }
    },
    {
      params: paramsSchema,
      response: realmSidebarEnvelopeSchema,
      detail: {
        summary: "Read realm sidebar",
        tags: ["Realm", "RealmSidebar"],
      },
    },
  )
  .put(
    "/realm/:unitId/sidebar",
    async ({ params, body, identity }): Promise<RealmSidebar> => {
      try {
        return await realmSidebarService.update({
          caller: identity,
          realmId: params.unitId,
          sidebar: body,
        });
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: paramsSchema,
      body: realmSidebarEnvelopeSchema,
      response: realmSidebarEnvelopeSchema,
      detail: {
        summary: "Update realm sidebar",
        tags: ["Realm", "RealmSidebar"],
      },
    },
  );

export type RealmSidebarApi = typeof realmSidebarApi;

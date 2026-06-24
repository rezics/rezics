import type { RealmDock } from "@rezics/contract";
import { realmDockEnvelopeSchema } from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import { RealmDockError, realmDockService } from "./realm-dock.service";

const paramsSchema = t.Object({
  unitId: t.String(),
});

function handleError(error: unknown): never {
  if (error instanceof RealmDockError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const realmDockApi = new Elysia()
  .use(authMacro)
  .get(
    "/realm/:unitId/dock",
    async ({ params }): Promise<RealmDock> => {
      try {
        return await realmDockService.read(params.unitId);
      } catch (error) {
        handleError(error);
      }
    },
    {
      params: paramsSchema,
      response: realmDockEnvelopeSchema,
      detail: {
        summary: "Read realm Dock",
        tags: ["Realm", "RealmDock"],
      },
    },
  )
  .put(
    "/realm/:unitId/dock",
    async ({ params, body, identity }): Promise<RealmDock> => {
      try {
        return await realmDockService.update({
          caller: identity,
          realmId: params.unitId,
          dock: body,
        });
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: paramsSchema,
      body: realmDockEnvelopeSchema,
      response: realmDockEnvelopeSchema,
      detail: {
        summary: "Update realm Dock",
        tags: ["Realm", "RealmDock"],
      },
    },
  );

export type RealmDockApi = typeof realmDockApi;

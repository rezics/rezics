import type { SubjectAttributionDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  linkSubjectAttributionSchema,
  subjectAttributionBySubjectQuerySchema,
  subjectAttributionByUnitQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { subjectAttributionService } from "./subject-attribution.service";

export const subjectAttributionApi = new Elysia({
  prefix: "/subject-attribution",
})
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity, set }): Promise<SubjectAttributionDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return subjectAttributionService.link(body);
    },
    {
      requireLogin: true,
      body: linkSubjectAttributionSchema,
      detail: {
        summary: "Link subject attribution",
        description:
          "Link an Entity subject to a Unit for character, faction, location, wiki-page, or other subject indexing.",
        tags: ["Subject Attribution"],
      },
    },
  )
  .get(
    "/by-unit/:unitId",
    async ({ params, query }): Promise<SubjectAttributionDTO[]> => {
      return subjectAttributionService.listByUnit(params.unitId, query);
    },
    {
      params: t.Object({ unitId: t.String() }),
      query: subjectAttributionByUnitQuerySchema,
      detail: {
        summary: "List subject attributions for a unit",
        tags: ["Subject Attribution"],
      },
    },
  )
  .get(
    "/by-subject/:entityId",
    async ({ params, query }): Promise<SubjectAttributionDTO[]> => {
      return subjectAttributionService.listBySubject(params.entityId, query);
    },
    {
      params: t.Object({ entityId: t.String() }),
      query: subjectAttributionBySubjectQuerySchema,
      detail: {
        summary: "List units for a subject Entity",
        tags: ["Subject Attribution"],
      },
    },
  )
  .delete(
    "/:unitId/:entityId/:role",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await subjectAttributionService.unlink(
        params.unitId,
        params.entityId,
        params.role,
      );
      return { message: "Subject attribution unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        entityId: t.String(),
        role: t.String(),
      }),
      detail: {
        summary: "Unlink subject attribution",
        description: "Unlink an Entity subject from a Unit by composite key.",
        tags: ["Subject Attribution"],
      },
    },
  );

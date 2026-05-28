import type {
  GameSystemRequirementDTO,
  RezicsSessionClaims,
} from "@rezics/contract";
import {
  createGameSystemRequirementSchema,
  gameSystemRequirementListFiltersSchema,
  gameSystemRequirementListResponseSchema,
  gameSystemRequirementParamsSchema,
  updateGameSystemRequirementSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { AppError } from "@/utils/errors";
import { mapGameSystemRequirementToDTO } from "./mapper";
import { gameSystemRequirementService } from "./service";

async function requireAdmin(identity: RezicsSessionClaims) {
  if (isAdminRole(identity) || (await verifyAdminFromDb(identity.userId))) {
    return;
  }
  throw new AppError(403, "Forbidden: admin permission required");
}

export const gameSystemRequirementApi = new Elysia({
  prefix: "/game-system-requirement",
})
  .use(authMacro)
  // @convention:root-list-ok
  .get(
    "/",
    async ({
      query,
    }): Promise<{ requirements: GameSystemRequirementDTO[] }> => {
      const rows = await gameSystemRequirementService.list(query);
      return { requirements: rows.map(mapGameSystemRequirementToDTO) };
    },
    {
      query: gameSystemRequirementListFiltersSchema,
      response: { 200: gameSystemRequirementListResponseSchema },
      detail: {
        summary: "List game system requirements",
        tags: ["Game System Requirement"],
      },
    },
  )
  .get(
    "/:id",
    async ({ params }): Promise<GameSystemRequirementDTO> => {
      const row = await gameSystemRequirementService.getById(params.id);
      if (!row) {
        throw new AppError(404, "GameSystemRequirement not found", {
          code: "game_system_requirement_not_found",
        });
      }
      return mapGameSystemRequirementToDTO(row);
    },
    {
      params: gameSystemRequirementParamsSchema,
      detail: {
        summary: "Get game system requirement",
        tags: ["Game System Requirement"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<GameSystemRequirementDTO> => {
      await requireAdmin(identity);
      const row = await gameSystemRequirementService.create(body);
      return mapGameSystemRequirementToDTO(row);
    },
    {
      requireLogin: true,
      body: createGameSystemRequirementSchema,
      detail: {
        summary: "Create game system requirement",
        tags: ["Game System Requirement"],
      },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, identity }): Promise<GameSystemRequirementDTO> => {
      await requireAdmin(identity);
      const row = await gameSystemRequirementService.update(params.id, body);
      return mapGameSystemRequirementToDTO(row);
    },
    {
      requireLogin: true,
      params: gameSystemRequirementParamsSchema,
      body: updateGameSystemRequirementSchema,
      detail: {
        summary: "Update game system requirement",
        tags: ["Game System Requirement"],
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, identity }): Promise<{ message: string }> => {
      await requireAdmin(identity);
      await gameSystemRequirementService.delete(params.id);
      return { message: "GameSystemRequirement deleted" };
    },
    {
      requireLogin: true,
      params: gameSystemRequirementParamsSchema,
      detail: {
        summary: "Delete game system requirement",
        tags: ["Game System Requirement"],
      },
    },
  );

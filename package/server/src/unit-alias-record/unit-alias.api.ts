import type { UnitAliasDTO } from "@rezics/contract";
import {
  castUnitAliasVoteSchema,
  createUnitAliasSchema,
  patchUnitAliasPinSchema,
  unitAliasListQuerySchema,
  unitAliasPathParamsSchema,
  updateUnitAliasSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { mapUnitAliasToDTO } from "./unit-alias.mapper";
import {
  ALIAS_VISIBILITY_THRESHOLD,
  unitAliasService,
} from "./unit-alias.service";

export const unitAliasApi = new Elysia({ prefix: "/unit-alias-record" })
  .use(authMacro)
  .get(
    "/",
    async ({ headers, query }) => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const result = await unitAliasService.list(query, identity);
      return {
        aliases: result.aliases.map((alias) =>
          mapUnitAliasToDTO(alias, {
            belowVisibilityThreshold:
              result.includeBelowThreshold &&
              alias.score <= ALIAS_VISIBILITY_THRESHOLD &&
              !alias.pinned,
          }),
        ),
        total: result.total,
      };
    },
    {
      query: unitAliasListQuerySchema,
      detail: {
        summary: "List Unit aliases",
        tags: ["Unit aliases"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<UnitAliasDTO> => {
      const alias = await unitAliasService.create(identity.userId, body);
      return mapUnitAliasToDTO(alias);
    },
    {
      requireLogin: true,
      body: createUnitAliasSchema,
      detail: {
        summary: "Create or upsert a Unit alias",
        description:
          "The server derives normalizedValue from value and de-duplicates by (unitId, normalizedValue).",
        tags: ["Unit aliases"],
      },
    },
  )
  .patch(
    "/:aliasId",
    async ({ params, body, identity }): Promise<UnitAliasDTO> => {
      const alias = await unitAliasService.update(
        params.aliasId,
        body,
        identity,
      );
      return mapUnitAliasToDTO(alias);
    },
    {
      requireLogin: true,
      params: unitAliasPathParamsSchema,
      body: updateUnitAliasSchema,
      detail: {
        summary: "Update a Unit alias",
        tags: ["Unit aliases"],
      },
    },
  )
  .patch(
    "/:aliasId/pin",
    async ({ params, body, identity }): Promise<UnitAliasDTO> => {
      const alias = await unitAliasService.setPin(
        params.aliasId,
        body,
        identity,
      );
      return mapUnitAliasToDTO(alias);
    },
    {
      requireLogin: true,
      params: unitAliasPathParamsSchema,
      body: patchUnitAliasPinSchema,
      detail: {
        summary: "Pin/unpin or reposition a Unit alias",
        tags: ["Unit aliases"],
      },
    },
  )
  .patch(
    "/:aliasId/hide",
    async ({ params, identity }): Promise<UnitAliasDTO> => {
      const alias = await unitAliasService.hide(params.aliasId, identity);
      return mapUnitAliasToDTO(alias);
    },
    {
      requireLogin: true,
      params: unitAliasPathParamsSchema,
      detail: {
        summary: "Hide a Unit alias",
        tags: ["Unit aliases"],
      },
    },
  )
  .delete(
    "/:aliasId",
    async ({ params, identity }): Promise<{ message: string }> => {
      await unitAliasService.delete(params.aliasId, identity);
      return { message: "Unit alias deleted" };
    },
    {
      requireLogin: true,
      params: unitAliasPathParamsSchema,
      detail: {
        summary: "Delete a Unit alias",
        tags: ["Unit aliases"],
      },
    },
  );

export const unitAliasVoteApi = new Elysia({ prefix: "/unit-alias-vote" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<UnitAliasDTO> => {
      const alias = await unitAliasService.castVote(
        identity.userId,
        body.aliasId,
        body.value,
      );
      return mapUnitAliasToDTO(alias);
    },
    {
      requireLogin: true,
      body: castUnitAliasVoteSchema,
      detail: {
        summary: "Cast a UnitAliasVote",
        description:
          "Upserts the caller's vote and recomputes UnitAlias.score/voteCount.",
        tags: ["Unit aliases"],
      },
    },
  );

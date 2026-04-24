import type {
  PinboardDetailResponse,
  PinboardEntryResponse,
  PinboardKey,
  PinboardListResponse,
  PinboardOkResponse,
  RezicsSessionClaims,
} from "@rezics/contract";
import {
  BasicAdminPermission,
  createPinboardEntryBodySchema,
  pinBodySchema,
  pinboardDetailQuerySchema,
  pinboardEntryPathParamsSchema,
  pinboardListPathParamsSchema,
  pinboardListQuerySchema,
  reorderBodySchema,
  updatePinboardEntryBodySchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { realmService } from "@/realm/realm.service";
import { AppError } from "@/utils/errors";
import { pinboardService } from "./pinboard.service";

const PINBOARD_WRITER_ROLES = new Set(["owner", "moderator"]);

async function assertPinboardWriter(
  realmUnitId: string,
  identity: RezicsSessionClaims,
): Promise<void> {
  if (BasicAdminPermission(identity.permission)) return;
  const member = await realmService.getMember(realmUnitId, identity.unitId);
  if (!member || !PINBOARD_WRITER_ROLES.has(member.roleKey)) {
    throw new AppError(
      403,
      "Forbidden: pinboard writes require owner, moderator, or global admin",
    );
  }
}

/** Admin-view reads (stale-id surfacing) require the same write permissions. */
async function canSeeAdminView(
  realmUnitId: string,
  identity: RezicsSessionClaims | null,
): Promise<boolean> {
  if (!identity) return false;
  if (BasicAdminPermission(identity.permission)) return true;
  const member = await realmService.getMember(realmUnitId, identity.unitId);
  return !!member && PINBOARD_WRITER_ROLES.has(member.roleKey);
}

export const pinboardApi = new Elysia({ prefix: "/realms" })
  .use(authMacro)
  .get(
    "/:realmUnitId/pinboards/:pinboardKey",
    async ({ params, query, headers }): Promise<PinboardListResponse> => {
      const adminViewRequested = query.adminView === true;
      let identity: RezicsSessionClaims | null = null;
      if (adminViewRequested) {
        const { tryResolveIdentity } = await import("@/middleware");
        identity = await tryResolveIdentity(headers["authorization"]);
        const allowed = await canSeeAdminView(params.realmUnitId, identity);
        if (!allowed) {
          throw new AppError(403, "Forbidden: adminView requires moderator");
        }
      }
      return pinboardService.readList({
        realmUnitId: params.realmUnitId,
        pinboardKey: params.pinboardKey as PinboardKey,
        language: query.language,
        adminView: adminViewRequested,
      });
    },
    {
      params: pinboardListPathParamsSchema,
      query: pinboardListQuerySchema,
      detail: {
        summary: "List pinboard entries",
        description:
          "List a realm's pinboard entries with language-resolved list fields. `adminView=true` exposes `staleIds` for moderator cleanup.",
        tags: ["Pinboard"],
      },
    },
  )
  .get(
    "/:realmUnitId/pinboards/:pinboardKey/:unitId",
    async ({ params, query }): Promise<PinboardDetailResponse> => {
      return pinboardService.readDetail({
        realmUnitId: params.realmUnitId,
        pinboardKey: params.pinboardKey as PinboardKey,
        unitId: params.unitId,
        language: query.language,
      });
    },
    {
      params: pinboardEntryPathParamsSchema,
      query: pinboardDetailQuerySchema,
      detail: {
        summary: "Get pinboard entry detail",
        description:
          "Returns a pinboard entry's resolved content (title/summary/body + supportedLanguages) in the best-matching language.",
        tags: ["Pinboard"],
      },
    },
  )
  .post(
    "/:realmUnitId/pinboards/:pinboardKey",
    async ({ params, body, identity }): Promise<PinboardEntryResponse> => {
      await assertPinboardWriter(params.realmUnitId, identity);
      const { unitId } = await pinboardService.createEntry(
        params.realmUnitId,
        params.pinboardKey as PinboardKey,
        body,
        identity.unitId,
      );
      const detail = await pinboardService.readDetail({
        realmUnitId: params.realmUnitId,
        pinboardKey: params.pinboardKey as PinboardKey,
        unitId,
      });
      return {
        unitId: detail.unitId,
        pinboardKey: detail.pinboardKey,
        realmUnitId: detail.realmUnitId,
        authorUserId: detail.authorUserId,
        title: detail.title,
        summary: detail.summary,
        language: detail.language,
        defaultLanguage: detail.defaultLanguage,
        supportedLanguages: detail.supportedLanguages,
        position: 0,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      };
    },
    {
      requireLogin: true,
      params: pinboardListPathParamsSchema,
      body: createPinboardEntryBodySchema,
      detail: {
        summary: "Create pinboard entry",
        description:
          "Create a multilingual pinboard entry and append it to the end of the list.",
        tags: ["Pinboard"],
      },
    },
  )
  .patch(
    "/:realmUnitId/pinboards/:pinboardKey/:unitId",
    async ({ params, body, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardWriter(params.realmUnitId, identity);
      await pinboardService.updateEntry(
        params.realmUnitId,
        params.pinboardKey as PinboardKey,
        params.unitId,
        body,
        identity.unitId,
      );
      return { ok: true, unitId: params.unitId };
    },
    {
      requireLogin: true,
      params: pinboardEntryPathParamsSchema,
      body: updatePinboardEntryBodySchema,
      detail: {
        summary: "Update pinboard entry",
        description:
          "Upsert/remove per-language translations on a pinboard entry. Default language cannot be removed.",
        tags: ["Pinboard"],
      },
    },
  )
  .delete(
    "/:realmUnitId/pinboards/:pinboardKey/:unitId",
    async ({ params, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardWriter(params.realmUnitId, identity);
      await pinboardService.deleteEntry(
        params.realmUnitId,
        params.pinboardKey as PinboardKey,
        params.unitId,
      );
      return { ok: true, unitId: params.unitId };
    },
    {
      requireLogin: true,
      params: pinboardEntryPathParamsSchema,
      detail: {
        summary: "Delete pinboard entry",
        description:
          "Soft-delete a pinboard entry and every sibling translation; remove its id from the list.",
        tags: ["Pinboard"],
      },
    },
  )
  .post(
    "/:realmUnitId/pinboards/:pinboardKey/:unitId/pin",
    async ({ params, body, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardWriter(params.realmUnitId, identity);
      const { postIds } = await pinboardService.pinExisting(
        params.realmUnitId,
        params.pinboardKey as PinboardKey,
        params.unitId,
        body?.position,
      );
      return { ok: true, unitId: params.unitId, postIds };
    },
    {
      requireLogin: true,
      params: pinboardEntryPathParamsSchema,
      body: pinBodySchema,
      detail: {
        summary: "Pin existing post",
        description:
          "Append or insert an existing post at an optional position. Idempotent; dedupes duplicates.",
        tags: ["Pinboard"],
      },
    },
  )
  .post(
    "/:realmUnitId/pinboards/:pinboardKey/:unitId/unpin",
    async ({ params, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardWriter(params.realmUnitId, identity);
      const { postIds } = await pinboardService.unpin(
        params.realmUnitId,
        params.pinboardKey as PinboardKey,
        params.unitId,
      );
      return { ok: true, unitId: params.unitId, postIds };
    },
    {
      requireLogin: true,
      params: pinboardEntryPathParamsSchema,
      detail: {
        summary: "Unpin post",
        description:
          "Remove a post id from the pinboard list without touching the underlying post.",
        tags: ["Pinboard"],
      },
    },
  )
  .post(
    "/:realmUnitId/pinboards/:pinboardKey/reorder",
    async ({ params, body, identity }): Promise<PinboardOkResponse> => {
      await assertPinboardWriter(params.realmUnitId, identity);
      const { postIds } = await pinboardService.reorder(
        params.realmUnitId,
        params.pinboardKey as PinboardKey,
        body.orderedUnitIds,
      );
      return { ok: true, postIds };
    },
    {
      requireLogin: true,
      params: pinboardListPathParamsSchema,
      body: reorderBodySchema,
      detail: {
        summary: "Reorder pinboard",
        description:
          "Replace the order of pinboard post ids. Must be a permutation of the current list or 409.",
        tags: ["Pinboard"],
      },
    },
  );

export default pinboardApi;

import type { SlugResolveResponse } from "@rezics/contract";
import {
  slugResolvePayloadSchema,
  slugResolveResponseSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { resolveScopeId } from "@/shared/slug-ref";

/**
 * Generic slug-to-unit resolution endpoint.
 *
 * Accepts either a named scope (`'user' | 'realm' | 'tag' | 'zone' |
 * 'entity'`) or an owner Unit id (UUID string) as the `scope` value.
 */
export const slugApi = new Elysia({ prefix: "/slug" }).post(
  "/resolve",
  async ({ body, set }) => {
    const slugScope = resolveScopeId(body.scope);
    if (!slugScope) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "Scope not found" } };
    }

    const unit = await prisma.unit.findUnique({
      where: { slugScope_slug: { slugScope, slug: body.slug } },
      select: { id: true, type: true },
    });

    if (!unit) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "Slug not found" } };
    }

    const response: SlugResolveResponse = {
      unitId: unit.id,
      type: unit.type as SlugResolveResponse["type"],
    };
    return response;
  },
  {
    body: slugResolvePayloadSchema,
    response: {
      200: slugResolveResponseSchema,
      404: t.Object({
        error: t.Object({ code: t.String(), message: t.String() }),
      }),
    },
    detail: {
      summary: "Resolve slug to unitId",
      description:
        "Resolve `{ scope, slug }` to a Unit. `scope` may be a named scope " +
        "('user' | 'realm' | 'tag' | 'zone' | 'entity') or an owner Unit id.",
      tags: ["Slug"],
    },
  },
);

export default slugApi;

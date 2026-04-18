import { validateSlug } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { auth } from "../auth/instance";
import { prisma } from "../auth/prisma";
import { provisionUserOnServer } from "../provisioning/provision";

async function getSessionUser(
  request: Request,
): Promise<{ id: string; name: string; emailVerified: boolean } | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
  };
}

export const identityApi = new Elysia({ prefix: "/identity" })
  .post(
    "/confirm",
    async ({ body, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return {
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        };
      }

      const { username, slug } = body;

      // Validate slug format
      const validation = validateSlug(slug);
      if (!validation.ok) {
        set.status = 400;
        return {
          error: {
            code: "INVALID_SLUG",
            message: `Invalid slug format: ${validation.reason}`,
          },
        };
      }

      // Check if UserProfile already exists
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
      });
      if (existingProfile) {
        set.status = 403;
        return {
          error: {
            code: "IDENTITY_ALREADY_SET",
            message: "Identity has already been confirmed",
          },
        };
      }

      // Create UserProfile + update User.name in a transaction
      try {
        await prisma.$transaction([
          prisma.userProfile.create({
            data: {
              userId: user.id,
              slug: validation.normalized,
            },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: { name: username },
          }),
        ]);
      } catch (error: unknown) {
        // Prisma unique constraint violation on slug
        if (
          error != null &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          set.status = 409;
          return {
            error: {
              code: "SLUG_TAKEN",
              message: "This slug is already taken",
            },
          };
        }
        throw error;
      }

      // If email is already verified, trigger provisioning
      if (user.emailVerified) {
        try {
          await provisionUserOnServer({
            unitId: user.id,
            slug: validation.normalized,
            name: username,
          });
        } catch (error) {
          // Log but don't roll back UserProfile creation
          console.error(
            "[identity/confirm] Provisioning failed after identity confirmation:",
            error,
          );
        }
      }

      return { ok: true, slug: validation.normalized };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        slug: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Confirm identity",
        description:
          "Set username and slug for the authenticated user. Creates a UserProfile row. Returns 409 on slug conflict, 400 on invalid format, 403 if identity already set.",
        tags: ["Identity"],
      },
    },
  )
  .get(
    "/check-slug",
    async ({ query, request, set }) => {
      const user = await getSessionUser(request);
      if (!user) {
        set.status = 401;
        return {
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        };
      }

      const { slug } = query;

      // Validate format first
      const validation = validateSlug(slug);
      if (!validation.ok) {
        return {
          available: false,
          reason: validation.reason,
        };
      }

      // Check uniqueness
      const existing = await prisma.userProfile.findUnique({
        where: { slug: validation.normalized },
        select: { userId: true },
      });

      return {
        available: !existing,
        reason: existing ? "taken" : undefined,
      };
    },
    {
      query: t.Object({
        slug: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: "Check slug availability",
        description:
          "Validate slug format and check uniqueness without creating records.",
        tags: ["Identity"],
      },
    },
  );

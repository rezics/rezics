import { render, templateRegistry } from "@rezics/email";
import { Elysia, t } from "elysia";
import { auth } from "../auth/instance";
import { createAuthMailer, getDefaultSender } from "../notification/mailer";

async function requireAdmin(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return "Unauthorized";
  if (
    (session.user as Record<string, unknown>).role !== "admin" &&
    (session.user as Record<string, unknown>).role !== "owner"
  ) {
    return "Forbidden: admin access required";
  }
  return null;
}

export const adminEmailApi = new Elysia({ prefix: "/admin/email" })
  .onBeforeHandle(async ({ request, set }) => {
    const error = await requireAdmin(request);
    if (error) {
      set.status = error === "Unauthorized" ? 401 : 403;
      return { error };
    }
    return undefined;
  })
  .get("/templates", () => {
    return templateRegistry.map((entry) => ({
      name: entry.name,
      description: entry.description,
      propSchema: entry.propSchema,
    }));
  })
  .post(
    "/preview",
    async ({ body, set }) => {
      const entry = templateRegistry.find((e) => e.name === body.template);
      if (!entry) {
        set.status = 400;
        return { error: `Unknown template: ${body.template}` };
      }

      const { html } = await render(entry.component, body.props as any);
      return { html };
    },
    {
      body: t.Object({
        template: t.String(),
        props: t.Record(t.String(), t.Any()),
      }),
    },
  )
  .post(
    "/send-test",
    async ({ body, set }) => {
      const entry = templateRegistry.find((e) => e.name === body.template);
      if (!entry) {
        set.status = 400;
        return { error: `Unknown template: ${body.template}` };
      }

      const { html, text } = await render(entry.component, body.props as any);
      const transport = createAuthMailer();

      await transport.sendOrThrow({
        from: getDefaultSender(),
        to: body.to,
        subject: `[Test] ${entry.description}`,
        html,
        text,
      });

      return { success: true, to: body.to };
    },
    {
      body: t.Object({
        template: t.String(),
        props: t.Record(t.String(), t.Any()),
        to: t.String(),
      }),
    },
  )
  .post("/smtp-test", async () => {
    const transport = createAuthMailer();

    try {
      const verified = await transport.verify();
      return { connected: verified };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

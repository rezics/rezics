import { Elysia, t } from "elysia";
import { render, templateRegistry } from "@rezics/email";
import { auth } from "../auth/instance";
import { env } from "../env";
import { createAuthMailer, isMailerConfigured } from "../notification/mailer";

async function requireAdmin(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return "Unauthorized";
  if ((session.user as Record<string, unknown>).role !== "admin" &&
      (session.user as Record<string, unknown>).role !== "owner") {
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
  })
  .get("/templates", () => {
    return templateRegistry.map((entry) => ({
      name: entry.name,
      description: entry.description,
      propSchema: entry.propSchema,
    }));
  })
  .post(
    "/send-test",
    async ({ body, set }) => {
      const entry = templateRegistry.find((e) => e.name === body.template);
      if (!entry) {
        set.status = 400;
        return { error: `Unknown template: ${body.template}` };
      }

      const { html, text } = await render(entry.component, body.props as any);

      if (!isMailerConfigured(env)) {
        set.status = 503;
        return { error: "SMTP is not configured" };
      }

      const transport = createAuthMailer(env);
      const from =
        env.AUTH_VERIFICATION_FROM_EMAIL ??
        env.AUTH_INVITATION_FROM_EMAIL ??
        "noreply@rezics.com";

      await transport.sendMail({
        from: env.SMTP_USER_NAME
          ? `${env.SMTP_USER_NAME} <${from}>`
          : from,
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
  .post("/smtp-test", async ({ set }) => {
    if (!isMailerConfigured(env)) {
      set.status = 503;
      return {
        connected: false,
        error: "SMTP is not configured (missing host, user, or password)",
      };
    }

    const transport = createAuthMailer(env);

    try {
      const verified = await transport.verify();
      return {
        connected: verified,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? "465",
      };
    } catch (err) {
      return {
        connected: false,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? "465",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

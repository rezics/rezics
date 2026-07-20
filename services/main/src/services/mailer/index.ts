import { Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import { getActiveObservability, observedFetch } from "@rezics/observability";

import { env } from "../config";

const { logger } = getActiveObservability();

export interface MailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

const CloudflareEmailResponse = Type.Object({
	success: Type.Optional(Type.Boolean()),
	errors: Type.Optional(
		Type.Array(
			Type.Object({
				code: Type.Optional(Type.Number()),
				message: Type.Optional(Type.String()),
			}),
		),
	),
	result: Type.Optional(
		Type.Union([
			Type.Object({
				delivered: Type.Optional(Type.Array(Type.String())),
				queued: Type.Optional(Type.Array(Type.String())),
				permanent_bounces: Type.Optional(Type.Array(Type.String())),
			}),
			Type.Null(),
		]),
	),
});

export async function sendMail(message: MailMessage) {
	if (env.EMAIL_MODE === "log") {
		logger.info("Email delivery accepted in log mode", {
			eventName: "email.delivery.logged",
		});
		return { status: "logged" as const };
	}
	const response = await observedFetch(
		{ dependency: "cloudflare-email", operation: "send" },
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ from: env.EMAIL_FROM, ...message }),
			signal: AbortSignal.timeout(10_000),
		},
	);
	const untrustedPayload: unknown = await response.json().catch(() => undefined);
	const payload = Check(CloudflareEmailResponse, untrustedPayload) ? untrustedPayload : {};
	const delivered = payload.result?.delivered?.includes(message.to) ?? false;
	const queued = payload.result?.queued?.includes(message.to) ?? false;
	if (!response.ok || !payload.success || (!delivered && !queued)) {
		const errors = payload.errors
			?.map(({ code, message }) => `${code ?? "unknown"}:${message ?? "unknown"}`)
			.join(", ");
		const bounced = payload.result?.permanent_bounces?.includes(message.to);
		throw new Error(
			`Cloudflare Email Sending failed (${response.status}): ${bounced ? "permanent bounce" : errors || "recipient was neither delivered nor queued"}`,
		);
	}
	return { status: delivered ? ("delivered" as const) : ("queued" as const) };
}

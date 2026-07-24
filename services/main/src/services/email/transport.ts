import { Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import { getActiveObservability, observedFetch } from "@rezics/observability";

import { env } from "../config";

const { logger } = getActiveObservability();

export interface MailMessage {
	readonly html: string;
	readonly subject: string;
	readonly text: string;
	readonly to: string;
}

export type MailAcceptance =
	| { readonly providerMessageId: null; readonly status: "logged" }
	| { readonly providerMessageId: string; readonly status: "delivered" | "queued" };

export class MailTransportError extends Error {
	readonly code: string;
	readonly retryable: boolean;

	constructor(input: {
		readonly cause?: unknown;
		readonly code: string;
		readonly message: string;
		readonly retryable: boolean;
	}) {
		super(input.message, { cause: input.cause });
		this.name = "MailTransportError";
		this.code = input.code;
		this.retryable = input.retryable;
	}
}

const CloudflareEmailResponse = Type.Object({
	success: Type.Boolean(),
	errors: Type.Array(
		Type.Object({
			code: Type.Optional(Type.Number()),
			message: Type.Optional(Type.String()),
		}),
	),
	result: Type.Union([
		Type.Object({
			delivered: Type.Array(Type.String()),
			message_id: Type.String({ minLength: 1 }),
			permanent_bounces: Type.Array(Type.String()),
			queued: Type.Array(Type.String()),
		}),
		Type.Null(),
	]),
});

type RequestEmail = (url: string, init: RequestInit) => Promise<Response>;

export interface CloudflareMailConfig {
	readonly accountId: string;
	readonly apiToken: string;
	readonly fromAddress: string;
	readonly fromName: string;
}

function retryableHttpStatus(status: number): boolean {
	return status === 429 || status >= 500;
}

function errorDetails(payload: typeof CloudflareEmailResponse.static): string {
	return (
		payload.errors
			.map(({ code, message }) => `${code ?? "unknown"}:${message ?? "unknown"}`)
			.join(", ") || "unknown Cloudflare Email Sending error"
	);
}

export async function sendCloudflareMail(
	config: CloudflareMailConfig,
	message: MailMessage,
	request: RequestEmail,
): Promise<Exclude<MailAcceptance, { status: "logged" }>> {
	let response: Response;
	try {
		response = await request(
			`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: { address: config.fromAddress, name: config.fromName },
					...message,
				}),
				signal: AbortSignal.timeout(10_000),
			},
		);
	} catch (cause) {
		throw new MailTransportError({
			cause,
			code: "CloudflareEmailNetworkFailure",
			message: "Cloudflare Email Sending request failed before a response was received",
			retryable: true,
		});
	}

	const untrustedPayload: unknown = await response.json().catch(() => undefined);
	if (!Check(CloudflareEmailResponse, untrustedPayload)) {
		throw new MailTransportError({
			code: "CloudflareEmailInvalidResponse",
			message: `Cloudflare Email Sending returned an invalid response (${response.status})`,
			retryable: retryableHttpStatus(response.status),
		});
	}
	const payload = untrustedPayload;
	const delivered = payload.result?.delivered.includes(message.to) ?? false;
	const queued = payload.result?.queued.includes(message.to) ?? false;
	const bounced = payload.result?.permanent_bounces.includes(message.to) ?? false;
	if (!response.ok || !payload.success || !payload.result || (!delivered && !queued)) {
		throw new MailTransportError({
			code: bounced ? "CloudflareEmailPermanentBounce" : "CloudflareEmailRejected",
			message: `Cloudflare Email Sending rejected the recipient (${response.status}): ${
				bounced ? "permanent bounce" : errorDetails(payload)
			}`,
			retryable: !bounced && retryableHttpStatus(response.status),
		});
	}
	return {
		providerMessageId: payload.result.message_id,
		status: delivered ? "delivered" : "queued",
	};
}

export async function sendMail(message: MailMessage): Promise<MailAcceptance> {
	if (env.EMAIL_MODE === "log") {
		logger.info("Email delivery accepted in log mode", {
			eventName: "email.delivery.logged",
		});
		return { providerMessageId: null, status: "logged" };
	}
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = env.CLOUDFLARE_EMAIL_API_TOKEN;
	if (!accountId || !apiToken)
		throw new MailTransportError({
			code: "CloudflareEmailConfigurationMissing",
			message: "Cloudflare Email Sending credentials are missing",
			retryable: false,
		});
	return sendCloudflareMail(
		{
			accountId,
			apiToken,
			fromAddress: env.EMAIL_FROM,
			fromName: env.EMAIL_FROM_NAME,
		},
		message,
		(url, init) =>
			observedFetch({ dependency: "cloudflare-email", operation: "send" }, url, init),
	);
}

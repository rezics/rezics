import { getActiveObservability } from "@rezics/observability";

import { env } from "../config";
import { renderClaimedEmail, InvalidEmailIntent } from "./content";
import { claimEmailBatch, type ClaimedEmail, markEmailAccepted, markEmailFailed } from "./outbox";
import { emailIntentDeliveryEnabled } from "./policy";
import { MailTransportError, sendMail } from "./transport";

const { logger } = getActiveObservability();
const LeaseDurationMilliseconds = 60_000;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function recordFailure(
	item: ClaimedEmail,
	input: {
		readonly code: string;
		readonly error: unknown;
		readonly retryable: boolean;
	},
): Promise<void> {
	const outcome = await markEmailFailed(item, {
		error: `${input.code}: ${errorMessage(input.error)}`,
		maxAttempts: env.EMAIL_DISPATCH_MAX_ATTEMPTS,
		now: new Date(),
		retryable: input.retryable,
	});
	logger.error("Email delivery attempt failed", {
		eventName:
			outcome === "retry_scheduled"
				? "email.delivery.retry_scheduled"
				: "email.delivery.failed",
		errorCode: input.code,
		error: input.error,
	});
}

async function processClaimedEmail(item: ClaimedEmail): Promise<void> {
	if (!emailIntentDeliveryEnabled(item.kind)) {
		await recordFailure(item, {
			code: "EmailIntentDisabled",
			error: new Error(`Delivery is disabled for ${item.kind} email intents`),
			retryable: false,
		});
		return;
	}

	let message: Awaited<ReturnType<typeof renderClaimedEmail>>;
	try {
		message = await renderClaimedEmail(item);
	} catch (error) {
		await recordFailure(item, {
			code:
				error instanceof InvalidEmailIntent ? "InvalidEmailIntent" : "EmailContentFailure",
			error,
			retryable: !(error instanceof InvalidEmailIntent),
		});
		return;
	}

	try {
		const acceptance = await sendMail(message);
		await markEmailAccepted(item, acceptance, new Date());
	} catch (error) {
		await recordFailure(item, {
			code: error instanceof MailTransportError ? error.code : "EmailDeliveryFailure",
			error,
			retryable: error instanceof MailTransportError ? error.retryable : true,
		});
	}
}

export async function dispatchEmailBatch(): Promise<number> {
	const claimed = await claimEmailBatch({
		batchSize: env.EMAIL_DISPATCH_BATCH_SIZE,
		leaseDurationMs: LeaseDurationMilliseconds,
		now: new Date(),
	});
	if (claimed.length === 0) return 0;
	const results = await Promise.allSettled(claimed.map(processClaimedEmail));
	for (const result of results)
		if (result.status === "rejected")
			logger.error("Email outbox processing stopped before recording an outcome", {
				eventName: "email.outbox.processing_failed",
				errorCode: "EmailOutboxProcessingFailed",
				error: result.reason,
			});
	return claimed.length;
}

import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class CatalogSourceUnavailable extends HTTPError.id(
	"CatalogSourceUnavailable",
	StatusCodes.SERVICE_UNAVAILABLE,
) {
	override readonly message = "The requested source observation is not available yet";
}

export class CatalogSourceRequestLimited extends HTTPError.id(
	"CatalogSourceRequestLimited",
	StatusCodes.TOO_MANY_REQUESTS,
) {
	override readonly message = "The source provider request budget is currently occupied";
}

/** @internal Only the operational admission function's known resource-limit error denotes source backpressure. */
export function isCatalogSourceAdmissionExhausted(cause:unknown):boolean {
	const seen=new Set<unknown>();
	for(let current=cause;current && typeof current==="object" && !seen.has(current) && seen.size<16;) {
		seen.add(current);
		if("code" in current && current.code==="53000" && "message" in current && typeof current.message==="string"
			&& /^operational admission exhausted for bucket \d{1,4}, lane (?:event-outbox|task-outbox|task-intent|receipt)$/u.test(current.message)) return true;
		current="cause" in current?current.cause:null;
	}
	return false;
}

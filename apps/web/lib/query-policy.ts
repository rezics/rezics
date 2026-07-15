import { StatusCodes } from "http-status-codes";
import { getErrorStatus } from "@/i18n/errors";

export function shouldRetry(attempt: number, error: unknown) {
	if (attempt >= 1) return false;
	const status = getErrorStatus(error);
	return status === undefined || status >= StatusCodes.INTERNAL_SERVER_ERROR;
}

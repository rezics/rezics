import type { ApiErrorCode } from "@rezics/openapi-tanstack-query";

import type { authClient } from "@/lib/auth-client";

type BetterAuthErrorCode = keyof typeof authClient.$ERROR_CODES;

export type ErrorTranslation = {
	readonly errors: {
		readonly unknown: string;
		readonly unknownWithCode: (code: string) => string;
	};
	readonly errorCodes: Readonly<Record<ApiErrorCode, string>>;
	readonly betterAuthErrorCodes: Readonly<Record<BetterAuthErrorCode, string>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function getErrorCode(error: unknown): string | undefined {
	if (!isRecord(error)) return undefined;
	const data = error.data;
	if (isRecord(data) && isRecord(data.error) && typeof data.error.code === "string")
		return data.error.code;
	return typeof error.code === "string" ? error.code : undefined;
}

export function getErrorStatus(error: unknown): number | undefined {
	if (!isRecord(error)) return undefined;
	const status = error.status;
	return Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599
		? Number(status)
		: undefined;
}

export const hasErrorCode = (error: unknown, ...codes: readonly ApiErrorCode[]): boolean => {
	const code = getErrorCode(error);
	return code !== undefined && codes.some((candidate) => candidate === code);
};

export const getErrorText = (
	t: ErrorTranslation,
	error: unknown,
	fallback = t.errors.unknown,
): string => {
	const code = getErrorCode(error);
	if (!code) return fallback;
	const errorCodes: Readonly<Record<string, string>> = t.errorCodes;
	const betterAuthErrorCodes: Readonly<Record<string, string>> = t.betterAuthErrorCodes;
	return errorCodes[code] ?? betterAuthErrorCodes[code] ?? t.errors.unknownWithCode(code);
};

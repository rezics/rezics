import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import { HTTPError } from "elysia";

import { AuthErrors } from "../auth/errors";
import { AuthorizationErrors } from "../authorization/errors";
import { DatabaseErrors } from "../database/errors";
import { PaginationErrors } from "../pagination/errors";
import { SearchErrors } from "../search/errors";
import { UnitErrors } from "../units/errors";
import { EntityErrors } from "../entities/errors";
import { FollowingErrors } from "../following/errors";
import { UnitResourceErrors } from "./unit-resources/errors";
import { CollectionErrors } from "./collections/errors";
import { ContentStructureErrors } from "./content-structure/errors";
import { DomainExtensionErrors } from "./domain-extensions/errors";
import { DockErrors } from "./docks/errors";
import { ReportErrors } from "./reports/errors";
import { FeedErrors } from "./feed/errors";
import { GovernanceErrors } from "./governance/errors";
import { HistoryErrors } from "./history/errors";
import { ImageAssetErrors } from "./image-assets/errors";
import { MessageErrors } from "./messages/errors";
import { NotificationErrors } from "./notifications/errors";
import { OwnershipClaimErrors } from "../ownership-claims/errors";
import { PollErrors } from "./polls/errors";
import { PostErrors } from "./posts/errors";
import { ProgressErrors } from "./progress/errors";
import { RealmErrors } from "./realms/errors";
import { ReviewErrors } from "./reviews/errors";
import { TagErrors } from "./tags/errors";
import { TokenErrors } from "./tokens/errors";
import { ApiQuotaPolicyErrors } from "./quota-policies/errors";
import { UserErrors } from "./users/errors";
import { CustomThemeErrors } from "./custom-themes/errors";

export class MalformedRequestBody extends HTTPError.id(
	"MalformedRequestBody",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Request body is malformed";
}

export class ValidationError extends HTTPError.id(
	"ValidationError",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Request validation failed";

	constructor(readonly details?: JsonValue) {
		super();
	}
}

export class InternalError extends HTTPError.id(
	"InternalError",
	StatusCodes.INTERNAL_SERVER_ERROR,
) {
	override readonly message = "Internal server error";

	constructor(override readonly cause?: unknown) {
		super();
	}
}

export const ApiErrors = [
	MalformedRequestBody,
	ValidationError,
	InternalError,
	...DatabaseErrors,
	...AuthErrors,
	...AuthorizationErrors,
	...UnitErrors,
	...EntityErrors,
	...FollowingErrors,
	...ImageAssetErrors,
	...TokenErrors,
	...ApiQuotaPolicyErrors,
	...TagErrors,
	...SearchErrors,
	...PaginationErrors,
	...UserErrors,
	...DomainExtensionErrors,
	...DockErrors,
	...PollErrors,
	...ProgressErrors,
	...ContentStructureErrors,
	...ReviewErrors,
	...GovernanceErrors,
	...ReportErrors,
	...PostErrors,
	...NotificationErrors,
	...OwnershipClaimErrors,
	...UnitResourceErrors,
	...MessageErrors,
	...CollectionErrors,
	...RealmErrors,
	...FeedErrors,
	...HistoryErrors,
	...CustomThemeErrors,
] as const;

export type ApiTypedError = InstanceType<(typeof ApiErrors)[number]>;
export type ApiErrorCode = ApiTypedError["type"];

type ApiErrorClass = (typeof ApiErrors)[number];
const getErrorType = (ErrorClass: ApiErrorClass): ApiErrorCode => ErrorClass.prototype.type;

export const ApiErrorRegistry: ReadonlyMap<ApiErrorCode, ApiErrorClass> = new Map(
	ApiErrors.map((ErrorClass) => [getErrorType(ErrorClass), ErrorClass] as const),
);

export const ApiErrorCodes: readonly ApiErrorCode[] = ApiErrors.map(getErrorType);

const apiErrorCodes: ReadonlySet<string> = new Set(ApiErrorCodes);
const apiErrorClasses: ReadonlySet<Function> = new Set(ApiErrors);

export const isApiErrorCode = (value: unknown): value is ApiErrorCode =>
	typeof value === "string" && apiErrorCodes.has(value);

export const isApiError = (value: unknown): value is ApiTypedError =>
	value instanceof Error && apiErrorClasses.has(value.constructor);

export const apiErrorRetryAfterSeconds = (error: ApiTypedError): number | undefined => {
	if (!("retryAfterSeconds" in error)) return undefined;
	const seconds = error.retryAfterSeconds;
	return typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0
		? seconds
		: undefined;
};

export type ApiErrorBody<Code extends ApiErrorCode = ApiErrorCode> = {
	readonly error: {
		readonly code: Code;
		readonly message: string;
		readonly details?: JsonValue;
	};
	readonly requestId: string;
};

export const toApiErrorBody = <E extends ApiTypedError>(
	error: E,
	requestId: string,
): ApiErrorBody<E["type"]> => ({
	error: {
		code: error.type,
		message: error.message,
		...("details" in error && error.details !== undefined ? { details: error.details } : {}),
	},
	requestId,
});

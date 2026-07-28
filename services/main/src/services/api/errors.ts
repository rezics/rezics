import { StatusCodes } from "http-status-codes";
import type { JsonValue } from "@rezics/portable-text";
import * as Data from "effect/Data";

import { AuthErrors } from "../auth/errors";
import { AuthorizationErrors } from "../authorization/errors";
import { PaginationErrors } from "../pagination/errors";
import { SearchErrors } from "../search/errors";
import { ScoreErrors } from "../scores/errors";
import { UnitErrors } from "../units/errors";
import { EntityErrors } from "../entities/errors";
import { FollowingErrors } from "../following/errors";
import { CatalogErrors } from "./catalog/errors";
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
import { PollErrors } from "./polls/errors";
import { PostErrors } from "./posts/errors";
import { ProgressErrors } from "./progress/errors";
import { RealmErrors } from "./realms/errors";
import { ReviewErrors } from "./reviews/errors";
import { TagErrors } from "./tags/errors";
import { TokenErrors } from "./tokens/errors";
import { UserErrors } from "./users/errors";

export class MalformedRequestBody extends Data.TaggedError("MalformedRequestBody") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = MalformedRequestBody.status;
	readonly message = "Request body is malformed";
}

export class ValidationError extends Data.TaggedError("ValidationError") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ValidationError.status;
	readonly message = "Request validation failed";

	constructor(readonly details?: JsonValue) {
		super();
	}
}

export class InternalError extends Data.TaggedError("InternalError") {
	static readonly status = StatusCodes.INTERNAL_SERVER_ERROR as const;
	readonly status = InternalError.status;
	readonly message = "Internal server error";

	constructor(readonly cause?: unknown) {
		super();
	}
}

export const ApiErrors = [
	MalformedRequestBody,
	ValidationError,
	InternalError,
	...AuthErrors,
	...AuthorizationErrors,
	...UnitErrors,
	...EntityErrors,
	...FollowingErrors,
	...ImageAssetErrors,
	...TokenErrors,
	...TagErrors,
	...SearchErrors,
	...ScoreErrors,
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
	...CatalogErrors,
	...MessageErrors,
	...CollectionErrors,
	...RealmErrors,
	...FeedErrors,
	...HistoryErrors,
] as const;

export type ApiTypedError = InstanceType<(typeof ApiErrors)[number]>;
export type ApiErrorCode = ApiTypedError["_tag"];

type ApiErrorClass = (typeof ApiErrors)[number];
export type ApiErrorRegistry = {
	[ErrorClass in ApiErrorClass as InstanceType<ErrorClass>["_tag"]]: ErrorClass;
};

const getErrorTag = (ErrorClass: ApiErrorClass): ApiErrorCode =>
	ErrorClass.prototype.name as ApiErrorCode;

export const ApiErrorRegistry = Object.fromEntries(
	ApiErrors.map((ErrorClass) => [getErrorTag(ErrorClass), ErrorClass]),
) as ApiErrorRegistry;

export const ApiErrorCodes: readonly ApiErrorCode[] = ApiErrors.map(getErrorTag);

const apiErrorCodes: ReadonlySet<string> = new Set(ApiErrorCodes);
const apiErrorClasses: ReadonlySet<Function> = new Set(ApiErrors);

export const isApiErrorCode = (value: unknown): value is ApiErrorCode =>
	typeof value === "string" && apiErrorCodes.has(value);

export const isApiError = (value: unknown): value is ApiTypedError =>
	value instanceof Error && apiErrorClasses.has(value.constructor);

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
): ApiErrorBody<E["_tag"]> => ({
	error: {
		code: error._tag,
		message: error.message,
		...("details" in error && error.details !== undefined ? { details: error.details } : {}),
	},
	requestId,
});

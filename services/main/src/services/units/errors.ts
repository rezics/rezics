import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class UnitNotFound extends Data.TaggedError("UnitNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitNotFound.status;
	readonly message: string;

	constructor(kind?: string) {
		super();
		this.message = kind ? `${kind} not found` : "Unit not found";
	}
}

export class UnitPermissionForbidden extends Data.TaggedError("UnitPermissionForbidden") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitPermissionForbidden.status;
	readonly message: string;
	readonly details: { readonly permission: string; readonly scope: string[] };

	constructor(permission: string, scope: readonly string[]) {
		super();
		this.message = `Unit permission required: ${permission}`;
		this.details = { permission, scope: [...scope] };
	}
}

export class UnitAccessRestricted extends Data.TaggedError("UnitAccessRestricted") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitAccessRestricted.status;
	readonly message = "Your access to this Unit scope is restricted";
}

export class UnitProtected extends Data.TaggedError("UnitProtected") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitProtected.status;
	readonly message: string;
	readonly details: { readonly scope: string[]; readonly mode: string };

	constructor(scope: readonly string[], mode: string) {
		super();
		this.message = `Unit scope is protected: ${scope.join("/") || "root"}`;
		this.details = { scope: [...scope], mode };
	}
}

export class UnitChanged extends Data.TaggedError("UnitChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitChanged.status;
	readonly message = "Unit has changed";
	readonly details: { readonly updatedAt: string };

	constructor(updatedAt: Date) {
		super();
		this.details = { updatedAt: updatedAt.toISOString() };
	}
}

export class UnitRevisionConflict extends Data.TaggedError("UnitRevisionConflict") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = UnitRevisionConflict.status;
	readonly message = "Unit revision has changed";
	readonly details: {
		readonly latestRevisionId: string | null;
		readonly conflictPaths: string[];
	};

	constructor(latestRevisionId: string | null, conflictPaths: readonly string[] = []) {
		super();
		this.details = { latestRevisionId, conflictPaths: [...conflictPaths] };
	}
}

export class UnitPrimaryLanguageMissing extends Data.TaggedError("UnitPrimaryLanguageMissing") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitPrimaryLanguageMissing.status;
	readonly message = "Primary language must have an existing Unit localization";
}

export class InvalidSlug extends Data.TaggedError("InvalidSlug") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidSlug.status;
	readonly message = "Slug must be a lowercase ASCII kebab label between 1 and 63 characters";
}

export class SlugTaken extends Data.TaggedError("SlugTaken") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = SlugTaken.status;
	readonly message = "Slug is already used in this Unit scope";
	readonly details: { readonly scopeUnitId: string | null; readonly slug: string };

	constructor(scopeUnitId: string | null, slug: string) {
		super();
		this.details = { scopeUnitId, slug };
	}
}

export class SlugScopeNotFound extends Data.TaggedError("SlugScopeNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SlugScopeNotFound.status;
	readonly message = "Slug scope Unit not found";
}

export class SlugScopeUnavailable extends Data.TaggedError("SlugScopeUnavailable") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = SlugScopeUnavailable.status;
	readonly message = "Unaddressed and deleted Units cannot be canonical slug scopes";
}

export class SlugScopeCycle extends Data.TaggedError("SlugScopeCycle") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = SlugScopeCycle.status;
	readonly message = "Moving this Unit would create a slug scope cycle";
}

export class SlugDepthExceeded extends Data.TaggedError("SlugDepthExceeded") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = SlugDepthExceeded.status;
	readonly message = "Unit slug path exceeds the maximum depth";
}

export class UnitAddressMutationForbidden extends Data.TaggedError("UnitAddressMutationForbidden") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitAddressMutationForbidden.status;
	readonly message = "This Unit address cannot be mutated by this operation";
}

export class SlugRedirectNotFound extends Data.TaggedError("SlugRedirectNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = SlugRedirectNotFound.status;
	readonly message = "Slug Redirect not found";
}

export class UnitSlugAddressNotFound extends Data.TaggedError("UnitSlugAddressNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UnitSlugAddressNotFound.status;
	readonly message = "Unit has no canonical slug address";
}

export const UnitErrors = [
	UnitNotFound,
	UnitPermissionForbidden,
	UnitAccessRestricted,
	UnitProtected,
	UnitChanged,
	UnitRevisionConflict,
	UnitPrimaryLanguageMissing,
	InvalidSlug,
	SlugTaken,
	SlugScopeNotFound,
	SlugScopeUnavailable,
	SlugScopeCycle,
	SlugDepthExceeded,
	UnitAddressMutationForbidden,
	SlugRedirectNotFound,
	UnitSlugAddressNotFound,
] as const;

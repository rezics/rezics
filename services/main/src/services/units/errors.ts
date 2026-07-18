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

export const UnitErrors = [
	UnitNotFound,
	UnitPermissionForbidden,
	UnitAccessRestricted,
	UnitProtected,
	UnitChanged,
	UnitRevisionConflict,
	UnitPrimaryLanguageMissing,
] as const;

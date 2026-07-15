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

export class UnitEditForbidden extends Data.TaggedError("UnitEditForbidden") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitEditForbidden.status;
	readonly message = "You cannot edit this unit";
}

export class UnitRestoreForbidden extends Data.TaggedError("UnitRestoreForbidden") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitRestoreForbidden.status;
	readonly message = "You cannot restore this unit";
}

export class UnitFieldLocked extends Data.TaggedError("UnitFieldLocked") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitFieldLocked.status;
	readonly message: string;
	readonly details: { readonly path: string };

	constructor(readonly path: string) {
		super();
		this.message = `Unit field is locked: ${path}`;
		this.details = { path };
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

export class UnitCoverKeyForbidden extends Data.TaggedError("UnitCoverKeyForbidden") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = UnitCoverKeyForbidden.status;
	readonly message = "Cover upload does not belong to this user";
}

export class UnitCoverIncomplete extends Data.TaggedError("UnitCoverIncomplete") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitCoverIncomplete.status;
	readonly message = "Cover upload has not been completed";
}

export class UnitCoverUnsupported extends Data.TaggedError("UnitCoverUnsupported") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitCoverUnsupported.status;
	readonly message = "Cover upload is not a supported image";
}

export class UnitCoverContentMismatch extends Data.TaggedError("UnitCoverContentMismatch") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitCoverContentMismatch.status;
	readonly message = "Cover upload content does not match its declared type";
}

export class UnitOriginalLanguageMissing extends Data.TaggedError("UnitOriginalLanguageMissing") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = UnitOriginalLanguageMissing.status;
	readonly message = "Original language must have an existing Unit localization";
}

export const UnitErrors = [
	UnitNotFound,
	UnitEditForbidden,
	UnitRestoreForbidden,
	UnitFieldLocked,
	UnitChanged,
	UnitRevisionConflict,
	UnitCoverKeyForbidden,
	UnitCoverIncomplete,
	UnitCoverUnsupported,
	UnitCoverContentMismatch,
	UnitOriginalLanguageMissing,
] as const;

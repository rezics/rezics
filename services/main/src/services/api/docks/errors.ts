import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class DockNotFound extends Data.TaggedError("DockNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = DockNotFound.status;
	readonly message = "Dock not found";
}

export class DockNotSupported extends Data.TaggedError("DockNotSupported") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = DockNotSupported.status;
	readonly message = "This Unit kind does not support the requested Dock kind";
}

export class DockDocumentInvalid extends Data.TaggedError("DockDocumentInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = DockDocumentInvalid.status;
	readonly message = "Dock document is invalid";
}

export class DockRevisionConflict extends Data.TaggedError("DockRevisionConflict")<{
	readonly latestRevisionId: string | null;
}> {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = DockRevisionConflict.status;
	readonly message = "Dock changed after the supplied base revision";
	readonly details: { readonly latestRevisionId: string | null };

	constructor(latestRevisionId: string | null) {
		super({ latestRevisionId });
		this.details = { latestRevisionId };
	}
}

export const DockErrors = [
	DockNotFound,
	DockNotSupported,
	DockDocumentInvalid,
	DockRevisionConflict,
] as const;

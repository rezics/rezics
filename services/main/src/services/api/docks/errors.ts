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
	readonly message = "This Unit kind does not support the requested Dock surface";
}

export class DockDocumentInvalid extends Data.TaggedError("DockDocumentInvalid") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = DockDocumentInvalid.status;
	readonly message = "Dock document is invalid";
}

export const DockErrors = [DockNotFound, DockNotSupported, DockDocumentInvalid] as const;

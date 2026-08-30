import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class DockNotFound extends HTTPError.id("DockNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Dock not found";
}

export class DockNotSupported extends HTTPError.id("DockNotSupported", StatusCodes.BAD_REQUEST) {
	override readonly message = "This Unit kind does not support the requested Dock kind";
}

export class DockDocumentInvalid extends HTTPError.id(
	"DockDocumentInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Dock document is invalid";
}

export class DockRevisionConflict extends HTTPError.id(
	"DockRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Dock changed after the supplied base revision";
	readonly latestRevisionId: string | null;
	readonly details: { readonly latestRevisionId: string | null };

	constructor(latestRevisionId: string | null) {
		super();
		this.latestRevisionId = latestRevisionId;
		this.details = { latestRevisionId };
	}
}

export const DockErrors = [
	DockNotFound,
	DockNotSupported,
	DockDocumentInvalid,
	DockRevisionConflict,
] as const;

import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class TagNotFound extends Data.TaggedError("TagNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagNotFound.status;
	readonly message = "Tag not found";
}

export class TagStructureNotFound extends Data.TaggedError("TagStructureNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagStructureNotFound.status;
	readonly message = "Tag structure not found";
}

export class TagStructureApplicationNotFound extends Data.TaggedError(
	"TagStructureApplicationNotFound",
) {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagStructureApplicationNotFound.status;
	readonly message = "Tag structure application not found";
}

export class InvalidTagStructure extends Data.TaggedError("InvalidTagStructure") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = InvalidTagStructure.status;
	readonly message = "Invalid Tag structure";
}

export class TagStructureChanged extends Data.TaggedError("TagStructureChanged") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = TagStructureChanged.status;
	readonly message = "Tag structure has changed";
	readonly details: { readonly updatedAt: string };

	constructor(updatedAt: Date) {
		super();
		this.details = { updatedAt: updatedAt.toISOString() };
	}
}

export class TagStructureDefinitionConflict extends Data.TaggedError(
	"TagStructureDefinitionConflict",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = TagStructureDefinitionConflict.status;
	readonly message = "Tag structure definition already exists";
	readonly details: { readonly structureId: string };

	constructor(structureId: string) {
		super();
		this.details = { structureId };
	}
}

export const TagErrors = [
	TagNotFound,
	TagStructureNotFound,
	TagStructureApplicationNotFound,
	InvalidTagStructure,
	TagStructureChanged,
	TagStructureDefinitionConflict,
] as const;

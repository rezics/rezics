import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class TagNotFound extends Data.TaggedError("TagNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagNotFound.status;
	readonly message = "Tag not found";
}

export class TagPathNotFound extends Data.TaggedError("TagPathNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagPathNotFound.status;
	readonly message = "Tag Path not found";
}

export class TagPathApplicationNotFound extends Data.TaggedError("TagPathApplicationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagPathApplicationNotFound.status;
	readonly message = "Tag Path application not found";
}

export class InvalidTagPath extends Data.TaggedError("InvalidTagPath") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = InvalidTagPath.status;
	readonly message = "Invalid Tag Path";
}

export class TagPathDefinitionConflict extends Data.TaggedError("TagPathDefinitionConflict") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = TagPathDefinitionConflict.status;
	readonly message = "Tag Path definition already exists";
	readonly details: { readonly pathId: string };

	constructor(pathId: string) {
		super();
		this.details = { pathId };
	}
}

export class TagPathMergeNotFound extends Data.TaggedError("TagPathMergeNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = TagPathMergeNotFound.status;
	readonly message = "Tag Path merge proposal not found";
}

export class InvalidTagPathMerge extends Data.TaggedError("InvalidTagPathMerge") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = InvalidTagPathMerge.status;
	readonly message = "Invalid Tag Path merge";
}

export const TagErrors = [
	TagNotFound,
	TagPathNotFound,
	TagPathApplicationNotFound,
	InvalidTagPath,
	TagPathDefinitionConflict,
	TagPathMergeNotFound,
	InvalidTagPathMerge,
] as const;

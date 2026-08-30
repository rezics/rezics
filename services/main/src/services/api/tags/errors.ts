import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class TagNotFound extends HTTPError.id("TagNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Tag not found";
}

export class TagPathNotFound extends HTTPError.id("TagPathNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Tag Path not found";
}

export class TagPathApplicationNotFound extends HTTPError.id(
	"TagPathApplicationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Tag Path application not found";
}

export class InvalidTagPath extends HTTPError.id(
	"InvalidTagPath",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Invalid Tag Path";
}

export class TagPathDefinitionConflict extends HTTPError.id(
	"TagPathDefinitionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Tag Path definition already exists";
	readonly details: { readonly pathId: string };

	constructor(pathId: string) {
		super();
		this.details = { pathId };
	}
}

export class TagPathMergeNotFound extends HTTPError.id(
	"TagPathMergeNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Tag Path merge proposal not found";
}

export class InvalidTagPathMerge extends HTTPError.id(
	"InvalidTagPathMerge",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Invalid Tag Path merge";
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

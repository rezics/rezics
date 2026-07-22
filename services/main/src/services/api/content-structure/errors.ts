import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";
export {
	ContentStructureInvalid,
	ContentStructureNotFound,
	ContentStructureRevisionConflict,
} from "../../content-structure/errors";
import {
	ContentStructureInvalid,
	ContentStructureNotFound,
	ContentStructureRevisionConflict,
} from "../../content-structure/errors";

export class BookNotFound extends Data.TaggedError("BookNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = BookNotFound.status;
	readonly message = "Book not found";
}

export class ContentStructureNodeNotFound extends Data.TaggedError("ContentStructureNodeNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ContentStructureNodeNotFound.status;
	readonly message = "Content Structure node not found";
}

export class ChapterNotFound extends Data.TaggedError("ChapterNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ChapterNotFound.status;
	readonly message = "Chapter not found";
}

export class ChapterLanguageNotFound extends Data.TaggedError("ChapterLanguageNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ChapterLanguageNotFound.status;
	readonly message = "Chapter language not found";
}

export const ContentStructureErrors = [
	ContentStructureInvalid,
	ContentStructureNotFound,
	ContentStructureRevisionConflict,
	BookNotFound,
	ContentStructureNodeNotFound,
	ChapterNotFound,
	ChapterLanguageNotFound,
] as const;

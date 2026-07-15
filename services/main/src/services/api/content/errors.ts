import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class BookNotFound extends Data.TaggedError("BookNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = BookNotFound.status;
	readonly message = "Book not found";
}

export class ContentNodeNotFound extends Data.TaggedError("ContentNodeNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ContentNodeNotFound.status;
	readonly message = "Content node not found";
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

export const ContentErrors = [
	BookNotFound,
	ContentNodeNotFound,
	ChapterNotFound,
	ChapterLanguageNotFound,
] as const;

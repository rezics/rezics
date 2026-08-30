import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";
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

export class BookNotFound extends HTTPError.id("BookNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Book not found";
}

export class MediaNotFound extends HTTPError.id("MediaNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Media not found";
}

export class ContentStructureNodeNotFound extends HTTPError.id(
	"ContentStructureNodeNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Content Structure node not found";
}

export class ChapterNotFound extends HTTPError.id("ChapterNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Chapter not found";
}

export class ChapterLanguageNotFound extends HTTPError.id(
	"ChapterLanguageNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Chapter language not found";
}

export const ContentStructureErrors = [
	ContentStructureInvalid,
	ContentStructureNotFound,
	ContentStructureRevisionConflict,
	BookNotFound,
	MediaNotFound,
	ContentStructureNodeNotFound,
	ChapterNotFound,
	ChapterLanguageNotFound,
] as const;

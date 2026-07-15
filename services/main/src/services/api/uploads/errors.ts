import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class UploadUnsupportedType extends Data.TaggedError("UploadUnsupportedType") {
	static readonly status = StatusCodes.UNSUPPORTED_MEDIA_TYPE as const;
	readonly status = UploadUnsupportedType.status;
	readonly message = "Unsupported upload type";
}

export class UploadNotFound extends Data.TaggedError("UploadNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = UploadNotFound.status;
	readonly message = "Uploaded object not found";
}

export class UploadInvalidSize extends Data.TaggedError("UploadInvalidSize") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = UploadInvalidSize.status;
	readonly message = "Uploaded object has invalid size";
}

export class UploadContentMismatch extends Data.TaggedError("UploadContentMismatch") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = UploadContentMismatch.status;
	readonly message = "Uploaded object content does not match its declared type";
}

export const UploadErrors = [
	UploadUnsupportedType,
	UploadNotFound,
	UploadInvalidSize,
	UploadContentMismatch,
] as const;

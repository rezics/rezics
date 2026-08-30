import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ReviewNotFound extends HTTPError.id("ReviewNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Review not found";
}

export const ReviewErrors = [ReviewNotFound] as const;

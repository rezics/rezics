import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class InvalidNotificationCursor extends HTTPError.id(
	"InvalidNotificationCursor",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Invalid notification cursor";
}

export class NotificationNotFound extends HTTPError.id(
	"NotificationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Notification not found";
}

export const NotificationErrors = [InvalidNotificationCursor, NotificationNotFound] as const;

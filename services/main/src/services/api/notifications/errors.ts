import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidNotificationCursor extends Data.TaggedError("InvalidNotificationCursor") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidNotificationCursor.status;
	readonly message = "Invalid notification cursor";
}

export class NotificationNotFound extends Data.TaggedError("NotificationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = NotificationNotFound.status;
	readonly message = "Notification not found";
}

export const NotificationErrors = [InvalidNotificationCursor, NotificationNotFound] as const;

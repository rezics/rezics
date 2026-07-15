import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class InvalidMessageCursor extends Data.TaggedError("InvalidMessageCursor") {
	static readonly status = StatusCodes.BAD_REQUEST as const;
	readonly status = InvalidMessageCursor.status;
	readonly message = "Invalid message cursor";
}

export class ConversationNotFound extends Data.TaggedError("ConversationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ConversationNotFound.status;
	readonly message = "Conversation not found";
}

export class ConversationParticipantsInvalid extends Data.TaggedError(
	"ConversationParticipantsInvalid",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ConversationParticipantsInvalid.status;
	readonly message = "A direct-message conversation requires two users";
}

export class DirectMessageBlocked extends Data.TaggedError("DirectMessageBlocked") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = DirectMessageBlocked.status;
	readonly message = "Direct messaging is blocked between these users";
}

export class MessageNotFound extends Data.TaggedError("MessageNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = MessageNotFound.status;
	readonly message: string;

	constructor(inConversation = false) {
		super();
		this.message = inConversation ? "Message not found in conversation" : "Message not found";
	}
}

export const MessageErrors = [
	InvalidMessageCursor,
	ConversationNotFound,
	ConversationParticipantsInvalid,
	DirectMessageBlocked,
	MessageNotFound,
] as const;

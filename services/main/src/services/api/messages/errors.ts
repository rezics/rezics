import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class InvalidMessageCursor extends HTTPError.id(
	"InvalidMessageCursor",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Invalid message cursor";
}

export class ConversationNotFound extends HTTPError.id(
	"ConversationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Conversation not found";
}

export class ConversationParticipantsInvalid extends HTTPError.id(
	"ConversationParticipantsInvalid",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A direct-message conversation requires two users";
}

export class DirectMessageBlocked extends HTTPError.id(
	"DirectMessageBlocked",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "Direct messaging is blocked between these users";
}

export class MessageNotFound extends HTTPError.id("MessageNotFound", StatusCodes.NOT_FOUND) {
	override readonly message: string;

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

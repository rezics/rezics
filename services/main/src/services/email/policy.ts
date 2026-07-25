import type { emailOutbox } from "../database/schema";

export type EmailIntentKind = (typeof emailOutbox.$inferSelect)["kind"];

/**
 * Account access and recovery emails are the only reviewed outbound email
 * surface. Notification email stays disabled until its preference,
 * unsubscribe, and content contracts are complete.
 */
export function emailIntentDeliveryEnabled(kind: EmailIntentKind): boolean {
	switch (kind) {
		case "reset_password":
		case "verify_email":
			return true;
		case "notification":
			return false;
	}
}

import { eq } from "drizzle-orm";
import { renderActionEmail, renderNotificationEmail, type RenderedEmail } from "@rezics/email";
import { toUiLocale, type UiLocale } from "@rezics/i18n";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import { database } from "../database";
import { notification, profile, profilePreference, users } from "../database/schema";
import { DefaultStoredUiLocale } from "../database/schema/contract-values";
import { getTranslation } from "../i18n";
import { notificationTranslationKey } from "../notifications/service";
import type { ClaimedEmail } from "./outbox";

export class InvalidEmailIntent extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidEmailIntent";
	}
}

export interface RenderedMailMessage extends RenderedEmail {
	readonly subject: string;
	readonly to: string;
}

function createFrame(
	t: {
		readonly layout: {
			readonly automatedMessage: string;
			readonly copyright: (values: { readonly year: number }) => string;
		};
	},
	year: number,
) {
	return {
		automatedMessage: t.layout.automatedMessage,
		brandName: verbatimTerms.rezics.value,
		copyright: t.layout.copyright({ year }),
	};
}

async function renderAuthenticationIntent(
	item: ClaimedEmail,
	locale: UiLocale,
	actionUrl: string,
	recipientEmail: string,
): Promise<RenderedMailMessage> {
	const { t } = await getTranslation("emails", [locale]);
	const copy = item.kind === "verify_email" ? t.verifyEmail : t.resetPassword;
	const rendered = await renderActionEmail({
		actionUrl,
		copy,
		frame: createFrame(t, new Date().getUTCFullYear()),
		locale,
	});
	return { ...rendered, subject: copy.subject, to: recipientEmail };
}

async function renderNotificationIntent(item: ClaimedEmail): Promise<RenderedMailMessage> {
	if (!item.notificationId)
		throw new InvalidEmailIntent("Notification email intent is missing its notification ID");
	const [row] = await database
		.select({
			email: users.email,
			interfaceLocale: profilePreference.interfaceLocale,
			kind: notification.kind,
			payload: notification.payload,
		})
		.from(notification)
		.innerJoin(profile, eq(profile.id, notification.recipientProfileId))
		.leftJoin(profilePreference, eq(profilePreference.profileId, profile.id))
		.innerJoin(users, eq(users.id, profile.authUserId))
		.where(eq(notification.id, item.notificationId))
		.limit(1);
	if (!row)
		throw new InvalidEmailIntent("Notification email intent has no deliverable recipient");
	const locale = toUiLocale(row.interfaceLocale ?? DefaultStoredUiLocale);
	const { t } = await getTranslation(["emails", "notifications"], [locale]);
	const copy = t.notifications[notificationTranslationKey(row.kind, row.payload)];
	const rendered = await renderNotificationEmail({
		body: copy.body,
		frame: createFrame(t.emails, new Date().getUTCFullYear()),
		locale,
		subject: copy.title,
	});
	return { ...rendered, subject: copy.title, to: row.email };
}

export function renderClaimedEmail(item: ClaimedEmail): Promise<RenderedMailMessage> {
	switch (item.kind) {
		case "notification":
			return renderNotificationIntent(item);
		case "reset_password":
		case "verify_email": {
			if (!item.actionUrl || !item.locale || !item.recipientEmail)
				throw new InvalidEmailIntent(
					"Authentication email intent is missing its recipient, locale, or action URL",
				);
			return renderAuthenticationIntent(
				item,
				toUiLocale(item.locale),
				item.actionUrl,
				item.recipientEmail,
			);
		}
	}
}

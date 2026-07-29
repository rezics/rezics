"use client";

import { Button, PageHeading } from "@rezics/ui";
import { ArrowLeft } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { RequireSession } from "@/features/auth/require-session";
import { ReceivedAccessInvitations } from "@/features/governance/unit-workflows";
import { useTranslation } from "@/i18n/client";
import { NotificationsHref } from "../routing/notification-routes";

export function AccessInvitationsPage() {
	const { t } = useTranslation(["notifications"]);
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
				<Button asChild className="w-fit" variant="quiet">
					<Link href={NotificationsHref}>
						<ArrowLeft aria-hidden className="rtl:rotate-180" />
						{t.notifications.center.backToNotifications}
					</Link>
				</Button>
				<PageHeading
					description={t.notifications.center.invitationsDescription}
					title={t.notifications.center.receivedInvitations}
				/>
				<ReceivedAccessInvitations />
			</main>
		</RequireSession>
	);
}

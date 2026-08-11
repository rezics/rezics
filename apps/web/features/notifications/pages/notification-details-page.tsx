"use client";

import { useGetApiNotificationsByNotificationId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { RequireSession } from "@/features/auth/require-session";
import { postHref } from "@/features/posts/url";
import { profileHref } from "@/features/profiles/profile-route";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { NotificationsHref } from "../routing/notification-routes";

function formatNotificationDate(value: string, locale: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(locale, {
				dateStyle: "long",
				timeStyle: "short",
			}).format(date);
}

export function NotificationDetailsPage({ notificationId }: { notificationId: string }) {
	return (
		<RequireSession>
			<NotificationDetailsContent notificationId={notificationId} />
		</RequireSession>
	);
}

function NotificationDetailsContent({ notificationId }: { notificationId: string }) {
	const { t, locale } = useTranslation(["notifications"]);
	const notification = useGetApiNotificationsByNotificationId({
		path: { notificationId },
	});
	if (notification.isPending) return <QueryPending />;
	if (notification.isError)
		return <QueryFailure error={notification.error} retry={() => void notification.refetch()} />;

	const item = notification.data;
	const subjectHref = item.subject ? publicUnitHref(item.subject.kind, item.subject) : undefined;
	const publicNoticePostId =
		item.context.type === "content_governance_action" ||
		item.context.type === "report_resolution" ||
		item.context.type === "account_enforcement_action"
			? item.context.publicNoticePostId
			: undefined;
	const actorLabel = item.actor?.name ?? t.notifications.center.detailsActorFallback;

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="quiet">
				<Link href={NotificationsHref}>
					<ArrowLeft aria-hidden className="rtl:rotate-180" />
					{t.notifications.center.backToNotifications}
				</Link>
			</Button>
			<PageHeading description={item.body} title={item.title} />

			<section className="grid gap-4 rounded-xl border border-border-weak p-5">
				<time className="text-muted-foreground text-sm" dateTime={item.createdAt}>
					{formatNotificationDate(item.createdAt, locale.current)}
				</time>
				<div className="flex flex-wrap gap-3">
					{subjectHref ? (
						<Button asChild variant="outline">
							<Link href={subjectHref}>
								<ExternalLink aria-hidden />
								{t.notifications.center.detailsOpenSubject}
							</Link>
						</Button>
					) : null}
					{item.actor ? (
						<Button asChild variant="outline">
							<Link href={profileHref(item.actor)}>
								<ExternalLink aria-hidden />
								{t.notifications.center.detailsOpenActor({ name: actorLabel })}
							</Link>
						</Button>
					) : null}
					{publicNoticePostId ? (
						<Button asChild variant="outline">
							<Link href={postHref(publicNoticePostId)}>
								<ExternalLink aria-hidden />
								{t.notifications.center.detailsOpenPublicNotice}
							</Link>
						</Button>
					) : null}
				</div>
				{!subjectHref && !item.actor && !publicNoticePostId ? (
					<p className="text-muted-foreground text-sm">
						{t.notifications.center.detailsTargetUnavailable}
					</p>
				) : null}
			</section>
		</main>
	);
}

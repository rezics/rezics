"use client";

import type { UiLocale } from "@rezics/i18n";
import type { GetApiUsersMeStatus200 } from "@rezics/openapi-tanstack-query";
import { useGetApiNotificationsUnreadCount } from "@rezics/openapi-tanstack-query";
import { Button, ChoiceSelect, Skeleton } from "@rezics/ui";
import { Bell, Plus } from "lucide-react";

import { normalizeUnreadCount } from "@/features/notifications/model/unread-count";
import { NotificationsHref } from "@/features/notifications/routing/notification-routes";
import { useTranslation } from "@/i18n/client";
import { AppLink } from "./app-link";
import type { ThemePreference } from "../hooks/use-theme-preference";
import { ThemePreferenceMenu } from "./theme-preference-menu";
import { UserMenu } from "./user-menu";

export interface HeaderLocaleSelection {
	label: string;
	value: UiLocale;
	options: readonly { value: UiLocale; label: string }[];
	onChange: (locale: UiLocale) => void;
	isPending: boolean;
}

export interface HeaderThemeSelection {
	preference: ThemePreference;
	onChange: (preference: ThemePreference) => void;
}

export function RestoringHeaderActions() {
	return (
		<div aria-hidden className="flex items-center gap-2">
			<Skeleton className="size-11 rounded-xl lg:h-9 lg:w-24" />
			<Skeleton className="size-11 rounded-full" />
			<Skeleton className="size-11 rounded-full" />
		</div>
	);
}

function CreateAction({ href, label }: { href: string; label: string }) {
	return (
		<Button
			variant="solid"
			asChild
			className="size-11 lg:h-9 lg:w-auto lg:px-3.5"
			size="icon-xl"
		>
			<AppLink aria-label={label} href={href} title={label}>
				<Plus aria-hidden data-icon="inline-start" />
				<span className="hidden lg:inline">{label}</span>
			</AppLink>
		</Button>
	);
}

function NotificationAction() {
	const { t } = useTranslation(["notifications"]);
	const unread = useGetApiNotificationsUnreadCount({
		query: { refetchInterval: 60_000 },
	});
	const count = normalizeUnreadCount(unread.data?.count);
	const badge = count > 99 ? "99+" : String(count);
	const label = count
		? t.notifications.center.headerUnreadLabel({ count })
		: t.notifications.center.headerLabel;

	return (
		<Button asChild className="relative size-11 p-0" size="icon-xl" variant="quiet">
			<AppLink aria-label={label} href={NotificationsHref} title={label}>
				<Bell aria-hidden />
				{count ? (
					<span
						aria-hidden
						className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 font-semibold text-[10px] text-destructive-foreground leading-none"
					>
						{badge}
					</span>
				) : null}
			</AppLink>
		</Button>
	);
}

export function SignedInHeaderActions({
	createLabel,
	profile,
	fallbackName,
	locale,
	theme,
}: {
	createLabel: string;
	profile?: GetApiUsersMeStatus200;
	fallbackName: string;
	locale: HeaderLocaleSelection;
	theme: HeaderThemeSelection;
}) {
	return (
		<>
			<CreateAction href="/create" label={createLabel} />
			<NotificationAction />
			<UserMenu
				fallbackName={fallbackName}
				locale={locale.value}
				localeChangePending={locale.isPending}
				onLocaleChange={locale.onChange}
				onThemePreferenceChange={theme.onChange}
				profile={profile}
				themePreference={theme.preference}
			/>
		</>
	);
}

export function SignedOutHeaderActions({
	loginLabel,
	locale,
	signupLabel,
	theme,
}: {
	loginLabel: string;
	locale: HeaderLocaleSelection;
	signupLabel: string;
	theme: HeaderThemeSelection;
}) {
	return (
		<>
			<Button asChild size="lg" variant="solid">
				<AppLink href="/register">{signupLabel}</AppLink>
			</Button>
			<Button asChild size="lg" variant="brand">
				<AppLink href="/login">{loginLabel}</AppLink>
			</Button>
			<div className="hidden xl:block">
				<ChoiceSelect
					ariaLabel={locale.label}
					className="min-w-0"
					onValueChange={([nextLocale]) => {
						if (nextLocale) locale.onChange(nextLocale);
					}}
					options={locale.options}
					placeholder={locale.label}
					size="lg"
					value={[locale.value]}
				/>
			</div>
			<ThemePreferenceMenu onChange={theme.onChange} preference={theme.preference} />
		</>
	);
}

"use client";

import type { UiLocale } from "@rezics/i18n";
import type { GetApiUsersMeStatus200 } from "@rezics/openapi-tanstack-query";
import { Button, ChoiceSelect } from "@rezics/ui";
import { Plus, UserRound } from "lucide-react";

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
	createLabel,
	loginLabel,
	locale,
	theme,
}: {
	createLabel: string;
	loginLabel: string;
	locale: HeaderLocaleSelection;
	theme: HeaderThemeSelection;
}) {
	return (
		<>
			<CreateAction href="/login?next=/create" label={createLabel} />
			<div className="hidden xl:block">
				<ChoiceSelect
					ariaLabel={locale.label}
					className="h-9 min-w-0 rounded-full px-2.5"
					onValueChange={([nextLocale]) => {
						if (nextLocale) locale.onChange(nextLocale);
					}}
					options={locale.options}
					placeholder={locale.label}
					value={[locale.value]}
				/>
			</div>
			<ThemePreferenceMenu onChange={theme.onChange} preference={theme.preference} />
			<Button
				asChild
				className="size-11 lg:h-9 lg:w-auto lg:px-3.5"
				size="icon-xl"
				variant="brand"
			>
				<AppLink aria-label={loginLabel} href="/login" title={loginLabel}>
					<UserRound aria-hidden data-icon="inline-start" />
					<span className="hidden lg:inline">{loginLabel}</span>
				</AppLink>
			</Button>
		</>
	);
}

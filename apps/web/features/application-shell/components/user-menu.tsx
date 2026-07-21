"use client";

import type { GetApiUsersMeStatus200 } from "@rezics/openapi-tanstack-query";
import { isUiLocale, type UiLocale } from "@rezics/i18n";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Button,
	Menu,
	MenuContent,
	MenuItem,
	MenuRadioGroup,
	MenuRadioItem,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	CircleUserRound,
	FileText,
	Languages,
	LogOut,
	Mail,
	Palette,
	Settings,
	SlidersHorizontal,
	UserRound,
	UserRoundPen,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { profileHref } from "@/features/profiles/profile-route";
import { useTranslation } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import type { ThemePreference } from "../hooks/use-theme-preference";
import { ThemePreferenceRadioGroup } from "./theme-preference-menu";

const NestedMenuPositioning = { placement: "right-start", gutter: -2 } as const;

function TrailingValue({ children }: { children: ReactNode }) {
	return <span className="ms-auto max-w-32 truncate text-muted-foreground">{children}</span>;
}

export function UserMenu({
	profile,
	fallbackName,
	locale,
	onLocaleChange,
	localeChangePending,
	themePreference,
	onThemePreferenceChange,
}: {
	profile?: GetApiUsersMeStatus200;
	fallbackName: string;
	locale: UiLocale;
	onLocaleChange: (locale: UiLocale) => void;
	localeChangePending: boolean;
	themePreference: ThemePreference;
	onThemePreferenceChange: (preference: ThemePreference) => void;
}) {
	const { t } = useTranslation(["locale", "nav", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const name = profile?.name?.trim() || fallbackName.trim() || t.ui.unnamed;
	const initial = Array.from(name)[0]?.toLocaleUpperCase(locale);
	const publicProfileHref = profile ? profileHref(profile) : "/settings/profile";
	const currentThemeLabel = t.locale.displayModes[themePreference];
	const currentLocaleLabel = locale === "zh-Hant" ? t.locale.zh : t.locale.en;

	return (
		<Menu positioning={{ placement: "bottom-end", gutter: 8 }}>
			<MenuTrigger asChild>
				<Button
					aria-label={t.nav.userMenu.label}
					className="size-11 rounded-full p-0"
					size="icon-xl"
					title={t.nav.userMenu.label}
					variant="ghost"
				>
					<Avatar size="lg">
						{profile?.avatar ? <AvatarImage alt="" src={profile.avatar.url} /> : null}
						<AvatarFallback>{initial ?? <UserRound aria-hidden />}</AvatarFallback>
					</Avatar>
				</Button>
			</MenuTrigger>

			<MenuContent className="w-[min(19rem,calc(100vw-1rem))] p-1.5">
				<MenuItem asChild className="gap-3 px-3 py-2.5" value="view-profile">
					<Link href={publicProfileHref}>
						<Avatar size="lg">
							{profile?.avatar ? (
								<AvatarImage alt="" src={profile.avatar.url} />
							) : null}
							<AvatarFallback>{initial ?? <UserRound aria-hidden />}</AvatarFallback>
						</Avatar>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium">{name}</span>
							<span className="block truncate text-muted-foreground text-xs">
								{profile?.slugAddress
									? `@${profile.slugAddress.slug}`
									: t.nav.userMenu.viewProfile}
							</span>
						</span>
					</Link>
				</MenuItem>

				{profile ? (
					<MenuItem asChild value="my-content">
						<Link href={profileHref(profile, "content")}>
							<FileText aria-hidden />
							{t.nav.userMenu.myContent}
						</Link>
					</MenuItem>
				) : (
					<MenuItem disabled value="my-content">
						<FileText aria-hidden />
						{t.nav.userMenu.myContent}
					</MenuItem>
				)}

				<MenuSeparator />

				<MenuSub positioning={NestedMenuPositioning}>
					<MenuSubTrigger>
						<Palette aria-hidden />
						<span>{t.locale.displayMode}</span>
						<TrailingValue>{currentThemeLabel}</TrailingValue>
					</MenuSubTrigger>
					<MenuSubContent className="w-64">
						<ThemePreferenceRadioGroup
							onChange={onThemePreferenceChange}
							preference={themePreference}
						/>
					</MenuSubContent>
				</MenuSub>

				<MenuSub positioning={NestedMenuPositioning}>
					<MenuSubTrigger>
						<Languages aria-hidden />
						<span>{t.locale.label}</span>
						<TrailingValue>{currentLocaleLabel}</TrailingValue>
					</MenuSubTrigger>
					<MenuSubContent className="w-56">
						<MenuRadioGroup
							heading={t.locale.label}
							onValueChange={({ value }) => {
								if (isUiLocale(value)) onLocaleChange(value);
							}}
							value={locale}
						>
							<MenuRadioItem
								closeOnSelect={false}
								disabled={localeChangePending}
								value="zh-Hant"
							>
								{t.locale.zh}
							</MenuRadioItem>
							<MenuRadioItem
								closeOnSelect={false}
								disabled={localeChangePending}
								value="en"
							>
								{t.locale.en}
							</MenuRadioItem>
						</MenuRadioGroup>
					</MenuSubContent>
				</MenuSub>

				<MenuSub positioning={NestedMenuPositioning}>
					<MenuSubTrigger>
						<Settings aria-hidden />
						<span>{t.nav.userMenu.settings}</span>
					</MenuSubTrigger>
					<MenuSubContent className="w-60">
						<MenuItem asChild value="profile-settings">
							<Link href="/settings/profile">
								<UserRoundPen aria-hidden />
								{t.nav.userMenu.profileSettings}
							</Link>
						</MenuItem>
						<MenuItem asChild value="preference-settings">
							<Link href="/settings/preferences">
								<SlidersHorizontal aria-hidden />
								{t.nav.userMenu.preferenceSettings}
							</Link>
						</MenuItem>
						<MenuItem asChild value="invitations">
							<Link href="/settings/invitations">
								<Mail aria-hidden />
								{t.nav.userMenu.invitations}
							</Link>
						</MenuItem>
						<MenuItem asChild value="account-settings">
							<Link href="/settings/account">
								<CircleUserRound aria-hidden />
								{t.nav.userMenu.accountSettings}
							</Link>
						</MenuItem>
					</MenuSubContent>
				</MenuSub>

				<MenuSeparator />

				<MenuItem
					onSelect={() => {
						void (async () => {
							await authClient.signOut();
							queryClient.clear();
							router.push("/");
							router.refresh();
						})();
					}}
					value="sign-out"
					variant="destructive"
				>
					<LogOut aria-hidden />
					{t.nav.userMenu.signOut}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

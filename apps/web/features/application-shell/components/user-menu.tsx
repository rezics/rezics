"use client";

import { isUiLocale, type UiLocale } from "@rezics/i18n";
import type { GetApiUsersMeStatus200 } from "@rezics/openapi-tanstack-query";
import {
	Button,
	type ButtonProps,
	cn,
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
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
	Separator,
	IdentityAvatar,
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	useIsMobile,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	ChevronRight,
	FileText,
	Languages,
	LogOut,
	Mail,
	Palette,
	Settings,
	ShieldCheck,
	UserRound,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { profileHref } from "@/features/profiles/profile-route";
import { AccessInvitationsHref } from "@/features/notifications/routing/notification-routes";
import { useTranslation } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import type { ThemePreference } from "../hooks/use-theme-preference";
import { ThemePreferenceRadioGroup, ThemePreferenceRadioList } from "./theme-preference-menu";

const NestedMenuPositioning = { placement: "right-start", gutter: -2 } as const;
const MobileMenuItemClassName = "min-h-12 w-full justify-start px-3 py-2.5 text-start";

type MobileUserMenuPage = "root" | "theme" | "locale";

interface UserMenuProps {
	profile?: GetApiUsersMeStatus200;
	fallbackName: string;
	locale: UiLocale;
	onLocaleChange: (locale: UiLocale) => void;
	localeChangePending: boolean;
	themePreference: ThemePreference;
	onThemePreferenceChange: (preference: ThemePreference) => void;
}

function TrailingValue({ children }: { children: ReactNode }) {
	return <span className="ms-auto max-w-32 truncate text-muted-foreground">{children}</span>;
}

function UserMenuTriggerButton({
	className,
	initial,
	profile,
	...props
}: Omit<ButtonProps, "children"> & {
	initial?: string;
	profile?: GetApiUsersMeStatus200;
}) {
	return (
		<Button className={cn("size-11 p-0", className)} pill size="icon-xl" {...props}>
			<IdentityAvatar
				avatar={profile?.avatar}
				fallback={initial ?? <UserRound aria-hidden />}
				size="lg"
			/>
		</Button>
	);
}

function useUserMenuModel({
	profile,
	fallbackName,
	locale,
	onLocaleChange,
	localeChangePending,
	themePreference,
	onThemePreferenceChange,
}: UserMenuProps) {
	const { t } = useTranslation(["locale", "nav", "ui"]);
	const router = useRouter();
	const queryClient = useQueryClient();
	const name = profile?.name?.trim() || fallbackName.trim() || t.ui.unnamed;
	const initial = Array.from(name)[0]?.toLocaleUpperCase(locale);
	const publicProfileHref = profile ? profileHref(profile) : "/settings/profile";
	const canManageStaff =
		profile?.platformCapabilities.includes("platform.grants.manage") ?? false;

	const signOut = async () => {
		await authClient.signOut();
		queryClient.clear();
		router.push("/");
		router.refresh();
	};

	return {
		canManageStaff,
		currentLocaleLabel: locale === "zh-Hant" ? t.locale.zh : t.locale.en,
		currentThemeLabel: t.locale.displayModes[themePreference],
		initial,
		locale,
		localeChangePending,
		name,
		onLocaleChange,
		onThemePreferenceChange,
		profile,
		publicProfileHref,
		signOut,
		t,
		themePreference,
	};
}

type UserMenuModel = ReturnType<typeof useUserMenuModel>;

function DesktopUserMenu({
	canManageStaff,
	currentLocaleLabel,
	currentThemeLabel,
	initial,
	locale,
	localeChangePending,
	name,
	onLocaleChange,
	onThemePreferenceChange,
	profile,
	publicProfileHref,
	signOut,
	t,
	themePreference,
}: UserMenuModel) {
	return (
		<Menu positioning={{ placement: "bottom-end", gutter: 8 }}>
			<MenuTrigger asChild>
				<UserMenuTriggerButton
					aria-label={t.nav.userMenu.label}
					initial={initial}
					profile={profile}
					title={t.nav.userMenu.label}
				/>
			</MenuTrigger>

			<MenuContent className="w-[min(19rem,calc(100vw-1rem))] p-1.5">
				<MenuItem asChild className="gap-3 px-3 py-2.5" value="view-profile">
					<Link href={publicProfileHref}>
						<IdentityAvatar
							avatar={profile?.avatar}
							fallback={initial ?? <UserRound aria-hidden />}
							size="lg"
						/>
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

				<MenuItem asChild value="settings">
					<Link href="/settings">
						<Settings aria-hidden />
						{t.nav.userMenu.settings}
					</Link>
				</MenuItem>
				{canManageStaff ? (
					<MenuItem asChild value="staff">
						<Link href="/staff">
							<ShieldCheck aria-hidden />
							{t.nav.userMenu.staff}
						</Link>
					</MenuItem>
				) : null}
				<MenuItem asChild value="invitations">
					<Link href={AccessInvitationsHref}>
						<Mail aria-hidden />
						{t.nav.userMenu.invitations}
					</Link>
				</MenuItem>

				<MenuSeparator />

				<MenuItem onSelect={() => void signOut()} value="sign-out" variant="destructive">
					<LogOut aria-hidden />
					{t.nav.userMenu.signOut}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

function MobileUserMenu(model: UserMenuModel) {
	const {
		canManageStaff,
		currentLocaleLabel,
		currentThemeLabel,
		initial,
		locale,
		localeChangePending,
		name,
		onLocaleChange,
		onThemePreferenceChange,
		profile,
		publicProfileHref,
		signOut,
		t,
		themePreference,
	} = model;
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<MobileUserMenuPage>("root");
	const rootFocusRef = useRef<HTMLAnchorElement>(null);
	const backButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		if (page === "root") rootFocusRef.current?.focus();
		else backButtonRef.current?.focus();
	}, [open, page]);

	const close = () => setOpen(false);
	const pageTitle = (() => {
		switch (page) {
			case "root":
				return t.nav.userMenu.label;
			case "theme":
				return t.locale.displayMode;
			case "locale":
				return t.locale.label;
		}
	})();

	return (
		<Sheet
			onOpenChange={({ open: nextOpen }) => {
				setOpen(nextOpen);
				if (!nextOpen) setPage("root");
			}}
			open={open}
		>
			<SheetTrigger asChild>
				<UserMenuTriggerButton
					aria-label={t.nav.userMenu.label}
					initial={initial}
					profile={profile}
					title={t.nav.userMenu.label}
				/>
			</SheetTrigger>
			<SheetContent
				className="max-h-[calc(100svh-3rem)] rounded-t-2xl"
				placement="bottom"
				showCloseButton={false}
			>
				<SheetHeader className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 border-border-weak border-b p-3">
					{page === "root" ? (
						<span aria-hidden className="size-11" />
					) : (
						<Button
							aria-label={t.nav.userMenu.back}
							className="size-11"
							onClick={() => setPage("root")}
							ref={backButtonRef}
							size="icon-xl"
							variant="quiet"
						>
							<ArrowLeft aria-hidden className="rtl:rotate-180" />
						</Button>
					)}
					<SheetTitle className="truncate text-center">{pageTitle}</SheetTitle>
					<SheetClose asChild>
						<Button
							aria-label={t.nav.userMenu.close}
							className="size-11"
							size="icon-xl"
							variant="quiet"
						>
							<X aria-hidden />
						</Button>
					</SheetClose>
					<SheetDescription className="sr-only">
						{t.nav.userMenu.description}
					</SheetDescription>
				</SheetHeader>

				<SheetBody className="p-2">
					{page === "root" ? (
						<div className="grid gap-1">
							<Button
								asChild
								className="h-auto min-w-0 justify-start gap-3 px-3 py-2.5 text-start"
								variant="quiet"
							>
								<Link href={publicProfileHref} onClick={close} ref={rootFocusRef}>
									<IdentityAvatar
										avatar={profile?.avatar}
										fallback={initial ?? <UserRound aria-hidden />}
										size="lg"
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">{name}</span>
										<span className="block truncate text-muted-foreground text-xs">
											{profile?.slugAddress
												? `@${profile.slugAddress.slug}`
												: t.nav.userMenu.viewProfile}
										</span>
									</span>
								</Link>
							</Button>

							{profile ? (
								<Button asChild className={MobileMenuItemClassName} variant="quiet">
									<Link href={profileHref(profile, "content")} onClick={close}>
										<FileText aria-hidden />
										{t.nav.userMenu.myContent}
									</Link>
								</Button>
							) : (
								<Button
									className={MobileMenuItemClassName}
									disabled
									variant="quiet"
								>
									<FileText aria-hidden />
									{t.nav.userMenu.myContent}
								</Button>
							)}

							<Separator className="my-1" />

							<Button
								className={MobileMenuItemClassName}
								onClick={() => setPage("theme")}
								variant="quiet"
							>
								<Palette aria-hidden />
								<span>{t.locale.displayMode}</span>
								<TrailingValue>{currentThemeLabel}</TrailingValue>
								<ChevronRight aria-hidden className="ms-1 rtl:rotate-180" />
							</Button>
							<Button
								className={MobileMenuItemClassName}
								onClick={() => setPage("locale")}
								variant="quiet"
							>
								<Languages aria-hidden />
								<span>{t.locale.label}</span>
								<TrailingValue>{currentLocaleLabel}</TrailingValue>
								<ChevronRight aria-hidden className="ms-1 rtl:rotate-180" />
							</Button>
							<Button asChild className={MobileMenuItemClassName} variant="quiet">
								<Link href="/settings" onClick={close}>
									<Settings aria-hidden />
									{t.nav.userMenu.settings}
								</Link>
							</Button>
							{canManageStaff ? (
								<Button asChild className={MobileMenuItemClassName} variant="quiet">
									<Link href="/staff" onClick={close}>
										<ShieldCheck aria-hidden />
										{t.nav.userMenu.staff}
									</Link>
								</Button>
							) : null}
							<Button asChild className={MobileMenuItemClassName} variant="quiet">
								<Link href={AccessInvitationsHref} onClick={close}>
									<Mail aria-hidden />
									{t.nav.userMenu.invitations}
								</Link>
							</Button>

							<Separator className="my-1" />

							<Button
								className={`${MobileMenuItemClassName} text-destructive hover:bg-destructive/10 hover:text-destructive`}
								onClick={() => {
									close();
									void signOut();
								}}
								variant="quiet"
							>
								<LogOut aria-hidden />
								{t.nav.userMenu.signOut}
							</Button>
						</div>
					) : null}

					{page === "theme" ? (
						<ThemePreferenceRadioList
							onChange={onThemePreferenceChange}
							preference={themePreference}
						/>
					) : null}

					{page === "locale" ? (
						<RadioGroup
							className="gap-1"
							onValueChange={({ value }) => {
								if (value && isUiLocale(value)) onLocaleChange(value);
							}}
							value={locale}
						>
							<RadioGroupLabel className="sr-only">{t.locale.label}</RadioGroupLabel>
							<RadioGroupItem
								className="min-h-12 rounded-lg px-3 py-2 transition-colors hover:bg-accent data-[state=checked]:bg-accent"
								disabled={localeChangePending}
								value="zh-Hant"
							>
								{t.locale.zh}
							</RadioGroupItem>
							<RadioGroupItem
								className="min-h-12 rounded-lg px-3 py-2 transition-colors hover:bg-accent data-[state=checked]:bg-accent"
								disabled={localeChangePending}
								value="en"
							>
								{t.locale.en}
							</RadioGroupItem>
						</RadioGroup>
					) : null}
				</SheetBody>
			</SheetContent>
		</Sheet>
	);
}

export function UserMenu(props: UserMenuProps) {
	const isMobile = useIsMobile();
	const model = useUserMenuModel(props);

	return isMobile ? <MobileUserMenu {...model} /> : <DesktopUserMenu {...model} />;
}

"use client";

import { Menu, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { SkipNavContent, SkipNavLink } from "../ui/skip-nav";
import { cn } from "../utils";
import { Button } from "./button";
import { ChoiceSelect } from "./choice-select";
import { Logo } from "./logo";

const DesktopSidebarPreferenceKey = "rezics-app-sidebar-state-v1";
const DesktopBreakpoint = "(min-width: 768px)";
const DesktopSidebarId = "app-sidebar-desktop";
const MobileSidebarId = "app-sidebar-mobile";

type DesktopSidebarState = "expanded" | "collapsed";

export type AppShellIcon = ElementType<{
	className?: string;
	"aria-hidden"?: boolean;
}>;

export interface AppShellNavigationItem {
	href: string;
	label: string;
	icon: AppShellIcon;
}

export interface AppShellAction {
	href: string;
	label: string;
	icon?: AppShellIcon;
	variant?: "brand" | "ghost";
}

export interface AppShellFollowingItem {
	id: string;
	href: string;
	label: string;
	kind: "zone" | "realm";
	imageUrl?: string | null;
	favorite?: boolean;
}

export interface AppShellFollowing {
	zonesLabel: string;
	realmsLabel: string;
	zonesEmptyLabel: string;
	realmsEmptyLabel: string;
	manageLabel: string;
	manageHref: string;
	loadingLabel: string;
	errorLabel: string;
	zonesLoading: boolean;
	realmsLoading: boolean;
	zonesError: boolean;
	realmsError: boolean;
	items: readonly AppShellFollowingItem[];
}

export interface AppShellSidebarLabels {
	title: string;
	description: string;
	open: string;
	close: string;
	expand: string;
	collapse: string;
}

function isCurrentPath(currentPath: string, href: string) {
	return href === "/" ? currentPath === href : currentPath.startsWith(href);
}

function parseDesktopSidebarState(value: string | null): DesktopSidebarState | null {
	return value === "expanded" || value === "collapsed" ? value : null;
}

function useDesktopSidebarState() {
	const [state, setState] = useState<DesktopSidebarState>("expanded");

	useEffect(() => {
		try {
			const storedState = parseDesktopSidebarState(
				window.localStorage.getItem(DesktopSidebarPreferenceKey),
			);
			if (storedState) setState(storedState);
		} catch {
			// Browsing remains usable when storage is unavailable.
		}

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== DesktopSidebarPreferenceKey) return;
			const storedState = parseDesktopSidebarState(event.newValue);
			if (storedState) setState(storedState);
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const toggle = useCallback(() => {
		setState((currentState) => {
			const nextState = currentState === "expanded" ? "collapsed" : "expanded";
			try {
				window.localStorage.setItem(DesktopSidebarPreferenceKey, nextState);
			} catch {
				// The in-memory preference still works for this visit.
			}
			return nextState;
		});
	}, []);

	return { state, toggle } as const;
}

function FollowingMark({
	item,
	fallbackLabel,
}: {
	item: AppShellFollowingItem;
	fallbackLabel: string;
}) {
	const fallback = (item.label || fallbackLabel).slice(0, 1).toUpperCase();
	return (
		<Avatar size="sm">
			{item.imageUrl ? <AvatarImage alt="" src={item.imageUrl} /> : null}
			<AvatarFallback>{fallback}</AvatarFallback>
		</Avatar>
	);
}

function FollowingGroup({
	emptyLabel,
	errorLabel,
	fallbackLabel,
	isLoading,
	isError,
	items,
	label,
	link,
	onNavigate,
}: {
	emptyLabel: string;
	errorLabel: string;
	fallbackLabel: string;
	isLoading: boolean;
	isError: boolean;
	items: readonly AppShellFollowingItem[];
	label: string;
	link: ElementType;
	onNavigate?: () => void;
}) {
	const Link = link;
	return (
		<section aria-busy={isLoading} aria-label={label} className="grid gap-1">
			<h2 className="px-3 pt-2 font-semibold text-muted-foreground text-xs">{label}</h2>
			{isLoading ? (
				<div aria-hidden className="grid gap-1 px-2 py-1">
					<Skeleton className="h-9 rounded-lg" />
					<Skeleton className="h-9 rounded-lg" />
				</div>
			) : items.length ? (
				items.map((item) => (
					<Link
						className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
						href={item.href}
						key={item.id}
						onClick={onNavigate}
					>
						<FollowingMark fallbackLabel={fallbackLabel} item={item} />
						<span className="min-w-0 flex-1 truncate">{item.label}</span>
						{item.favorite ? (
							<Star
								aria-hidden
								className="size-3 fill-current text-muted-foreground"
							/>
						) : null}
					</Link>
				))
			) : isError ? (
				<p className="px-3 py-2 text-destructive text-xs leading-5">{errorLabel}</p>
			) : (
				<p className="px-3 py-2 text-muted-foreground text-xs leading-5">{emptyLabel}</p>
			)}
		</section>
	);
}

function SidebarContents({
	brandName,
	currentPath,
	following,
	link,
	navigation,
	navigationLabel,
	onNavigate,
}: {
	brandName: string;
	currentPath: string;
	following?: AppShellFollowing;
	link: ElementType;
	navigation: readonly AppShellNavigationItem[];
	navigationLabel: string;
	onNavigate?: () => void;
}) {
	const Link = link;
	const zones = following?.items.filter((item) => item.kind === "zone") ?? [];
	const realms = following?.items.filter((item) => item.kind === "realm") ?? [];

	return (
		<ScrollArea className="min-h-0 flex-1" scrollFade>
			<nav aria-label={navigationLabel} className="grid gap-1 p-3">
				{navigation.map(({ href, label, icon: Icon }) => {
					const active = isCurrentPath(currentPath, href);
					return (
						<Link
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-3 font-medium text-muted-foreground text-sm transition-colors hover:bg-surface-hover hover:text-foreground",
								active && "bg-surface-selected text-foreground",
							)}
							href={href}
							key={href}
							onClick={onNavigate}
						>
							<Icon aria-hidden className="size-[1.15rem] shrink-0" />
							<span className="min-w-0 flex-1 truncate">{label}</span>
						</Link>
					);
				})}
			</nav>

			{following ? (
				<>
					<Separator className="mx-4 w-auto" />
					<p aria-live="polite" className="sr-only" role="status">
						{following.zonesLoading || following.realmsLoading
							? following.loadingLabel
							: null}
					</p>
					<div className="grid gap-2 px-3 py-2">
						<FollowingGroup
							emptyLabel={following.zonesEmptyLabel}
							errorLabel={following.errorLabel}
							fallbackLabel={brandName}
							isLoading={following.zonesLoading}
							isError={following.zonesError}
							items={zones}
							label={following.zonesLabel}
							link={link}
							onNavigate={onNavigate}
						/>
						<FollowingGroup
							emptyLabel={following.realmsEmptyLabel}
							errorLabel={following.errorLabel}
							fallbackLabel={brandName}
							isLoading={following.realmsLoading}
							isError={following.realmsError}
							items={realms}
							label={following.realmsLabel}
							link={link}
							onNavigate={onNavigate}
						/>
						<Link
							className="mt-1 flex min-h-9 items-center rounded-lg px-3 font-medium text-muted-foreground text-xs hover:bg-surface-hover hover:text-foreground"
							href={following.manageHref}
							onClick={onNavigate}
						>
							{following.manageLabel}
						</Link>
					</div>
				</>
			) : null}
		</ScrollArea>
	);
}

export function AppShell({
	children,
	brandName,
	navigation,
	navigationLabel,
	currentPath,
	link,
	search,
	sidebar,
	skipToContentLabel,
	locale,
	create,
	account,
	following,
	utilities,
}: {
	children: ReactNode;
	brandName: string;
	navigation: readonly AppShellNavigationItem[];
	navigationLabel: string;
	currentPath: string;
	link: ElementType;
	search: { href: string; label: string; placeholder: string };
	sidebar: AppShellSidebarLabels;
	skipToContentLabel: string;
	locale: {
		label: string;
		value: string;
		options: readonly { value: string; label: string }[];
		onChange: (value: string) => void | Promise<void>;
	};
	create?: AppShellAction;
	account: AppShellAction;
	following?: AppShellFollowing;
	utilities?: ReactNode;
}) {
	const Link = link;
	const CreateIcon = create?.icon;
	const AccountIcon = account.icon;
	const { state: desktopSidebarState, toggle: toggleDesktopSidebar } = useDesktopSidebarState();
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const desktopSidebarExpanded = desktopSidebarState === "expanded";

	useEffect(() => {
		const media = window.matchMedia(DesktopBreakpoint);
		const closeMobileSidebar = () => {
			if (media.matches) setMobileSidebarOpen(false);
		};
		media.addEventListener("change", closeMobileSidebar);
		return () => media.removeEventListener("change", closeMobileSidebar);
	}, []);

	return (
		<div className="min-h-svh bg-background" data-sidebar-state={desktopSidebarState}>
			<SkipNavLink id="main-content">{skipToContentLabel}</SkipNavLink>

			<header className="sticky top-0 z-50 h-16 border-b border-border-weak bg-background/96 backdrop-blur-xl">
				<div className="flex h-full">
					<div
						className={cn(
							"hidden shrink-0 items-center overflow-hidden border-e border-border-weak transition-[width] duration-200 ease-out md:flex motion-reduce:transition-none",
							desktopSidebarExpanded ? "w-64" : "w-8",
						)}
					>
						<Link
							aria-label={brandName}
							className={cn(
								"flex h-full min-w-0 items-center gap-2",
								desktopSidebarExpanded ? "px-5" : "justify-center",
							)}
							href="/"
							title={brandName}
						>
							<Logo
								alt=""
								aria-hidden="true"
								className={cn(
									"shrink-0",
									desktopSidebarExpanded ? "size-8" : "size-6",
								)}
							/>
							{desktopSidebarExpanded ? (
								<span className="truncate text-base font-black text-foreground tracking-[0.14em]">
									{brandName}
								</span>
							) : null}
						</Link>
					</div>

					<div className="flex shrink-0 items-center gap-1 border-e border-border-weak px-2 md:hidden">
						<Button
							aria-controls={MobileSidebarId}
							aria-expanded={mobileSidebarOpen}
							aria-label={sidebar.open}
							onClick={() => setMobileSidebarOpen(true)}
							size="icon-xl"
							variant="ghost"
						>
							<Menu aria-hidden />
						</Button>
						<Link
							aria-label={brandName}
							className="grid size-10 place-items-center"
							href="/"
						>
							<Logo alt="" aria-hidden="true" className="size-8" />
						</Link>
					</div>

					<div className="flex min-w-0 flex-1 items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-5">
						<form
							action={search.href}
							className="hidden min-w-40 max-w-xl flex-1 sm:block"
						>
							<InputGroup
								className="h-10 rounded-xl border-border-weak bg-surface-container shadow-none"
								size="lg"
							>
								<InputGroupAddon align="inline-start">
									<Search aria-hidden />
								</InputGroupAddon>
								<InputGroupInput
									aria-label={search.label}
									name="q"
									placeholder={search.placeholder}
									type="search"
								/>
								<Button className="sr-only" type="submit">
									{search.label}
								</Button>
							</InputGroup>
						</form>

						<Button
							aria-label={search.label}
							asChild
							className="size-11 sm:hidden"
							size="icon-xl"
							variant="ghost"
						>
							<Link href={search.href} title={search.label}>
								<Search aria-hidden />
							</Link>
						</Button>

						<div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
							{create ? (
								<Button
									asChild
									className="size-11 lg:h-9 lg:w-auto lg:px-3.5"
									size="icon-xl"
								>
									<Link
										aria-label={create.label}
										href={create.href}
										title={create.label}
									>
										{CreateIcon ? (
											<CreateIcon aria-hidden data-icon="inline-start" />
										) : null}
										<span className="hidden lg:inline">{create.label}</span>
									</Link>
								</Button>
							) : null}

							<div className="hidden xl:block">
								<ChoiceSelect
									ariaLabel={locale.label}
									className="h-9 min-w-28"
									onValueChange={([nextLocale]) => {
										if (nextLocale) void locale.onChange(nextLocale);
									}}
									options={locale.options}
									placeholder={locale.label}
									value={[locale.value]}
								/>
							</div>

							{utilities}

							<Button
								asChild
								className={cn(
									"size-11",
									account.variant === "brand" && "lg:h-9 lg:w-auto lg:px-3.5",
								)}
								size="icon-xl"
								variant={account.variant ?? "ghost"}
							>
								<Link
									aria-label={account.label}
									href={account.href}
									title={account.label}
								>
									{AccountIcon ? <AccountIcon aria-hidden /> : null}
									{account.variant === "brand" ? (
										<span className="hidden lg:inline">{account.label}</span>
									) : null}
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</header>

			<aside
				aria-label={sidebar.title}
				className={cn(
					"fixed inset-y-0 start-0 z-40 mt-16 hidden border-e border-border-weak bg-background transition-[width] duration-200 ease-out md:flex motion-reduce:transition-none",
					desktopSidebarExpanded ? "w-64" : "w-8",
				)}
				id={DesktopSidebarId}
			>
				{desktopSidebarExpanded ? (
					<SidebarContents
						brandName={brandName}
						currentPath={currentPath}
						following={following}
						link={link}
						navigation={navigation}
						navigationLabel={navigationLabel}
					/>
				) : null}
				<Button
					aria-controls={DesktopSidebarId}
					aria-expanded={desktopSidebarExpanded}
					aria-label={desktopSidebarExpanded ? sidebar.collapse : sidebar.expand}
					className="absolute -end-4 top-5 bg-background shadow-sm"
					onClick={toggleDesktopSidebar}
					pill
					size="icon-md"
					title={desktopSidebarExpanded ? sidebar.collapse : sidebar.expand}
					variant="outline"
				>
					<Menu aria-hidden />
				</Button>
			</aside>

			<Sheet onOpenChange={({ open }) => setMobileSidebarOpen(open)} open={mobileSidebarOpen}>
				<SheetContent
					className="max-w-80 p-0"
					id={MobileSidebarId}
					placement="left"
					showCloseButton={false}
				>
					<SheetHeader className="flex-row items-center gap-3 border-b border-border-weak p-4">
						<Logo alt="" aria-hidden="true" className="size-8 shrink-0" />
						<span className="truncate font-black text-base tracking-[0.14em]">
							{brandName}
						</span>
						<SheetTitle className="sr-only">{sidebar.title}</SheetTitle>
						<SheetDescription className="sr-only">
							{sidebar.description}
						</SheetDescription>
						<SheetClose asChild>
							<Button
								aria-label={sidebar.close}
								className="ms-auto"
								size="icon-md"
								variant="ghost"
							>
								<X aria-hidden />
							</Button>
						</SheetClose>
					</SheetHeader>
					<SidebarContents
						brandName={brandName}
						currentPath={currentPath}
						following={following}
						link={link}
						navigation={navigation}
						navigationLabel={navigationLabel}
						onNavigate={() => setMobileSidebarOpen(false)}
					/>
				</SheetContent>
			</Sheet>

			<SkipNavContent
				className={cn(
					"min-h-[calc(100svh-4rem)] transition-[margin-inline-start] duration-200 ease-out motion-reduce:transition-none",
					desktopSidebarExpanded ? "md:ms-64" : "md:ms-8",
				)}
				id="main-content"
			>
				{children}
			</SkipNavContent>
		</div>
	);
}

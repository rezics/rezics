"use client";

import { List, Menu, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
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
const FollowingAccordionPreferenceKey = "rezics-app-sidebar-following:v1";
const DesktopBreakpoint = "(min-width: 768px)";
const DesktopSidebarId = "app-sidebar-desktop";
const MobileSidebarId = "app-sidebar-mobile";
const SidebarRowClassName =
	"flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground";

type DesktopSidebarState = "expanded" | "collapsed";
export type AppShellFollowingGroupId = "zone" | "realm";

const FollowingGroupIds: readonly AppShellFollowingGroupId[] = ["zone", "realm"];

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
	imageUrl?: string | null;
	favorite?: boolean;
}

export interface AppShellFollowingGroup {
	id: AppShellFollowingGroupId;
	label: string;
	allLabel: string;
	allHref: string;
	emptyLabel: string;
	icon: AppShellIcon;
	isLoading: boolean;
	isError: boolean;
	items: readonly AppShellFollowingItem[];
}

export interface AppShellFollowing {
	groups: readonly AppShellFollowingGroup[];
	loadingLabel: string;
	errorLabel: string;
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

function isCurrentHref(currentPath: string, currentSearch: string, href: string) {
	const [targetPath, targetSearch] = href.split("?", 2);
	if (!targetPath) return false;
	if (targetSearch === undefined) return isCurrentPath(currentPath, targetPath);
	if (currentPath !== targetPath) return false;
	const currentParameters = new URLSearchParams(currentSearch);
	const targetParameters = new URLSearchParams(targetSearch);
	for (const [key, value] of targetParameters)
		if (currentParameters.get(key) !== value) return false;
	return true;
}

function parseDesktopSidebarState(value: string | null): DesktopSidebarState | null {
	return value === "expanded" || value === "collapsed" ? value : null;
}

function isFollowingGroupId(value: unknown): value is AppShellFollowingGroupId {
	return typeof value === "string" && FollowingGroupIds.some((groupId) => groupId === value);
}

function parseFollowingGroupIds(value: string | null): AppShellFollowingGroupId[] | null {
	if (!value) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return null;
		return [...new Set(parsed.filter(isFollowingGroupId))];
	} catch {
		return null;
	}
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

function useFollowingAccordionState() {
	const [value, setValue] = useState<AppShellFollowingGroupId[]>([...FollowingGroupIds]);

	useEffect(() => {
		try {
			const storedValue = parseFollowingGroupIds(
				window.localStorage.getItem(FollowingAccordionPreferenceKey),
			);
			if (storedValue) setValue(storedValue);
		} catch {
			// The default expanded state remains usable when storage is unavailable.
		}

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== FollowingAccordionPreferenceKey) return;
			const storedValue = parseFollowingGroupIds(event.newValue);
			if (storedValue) setValue(storedValue);
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const update = useCallback((nextValue: readonly string[]) => {
		const verifiedValue = nextValue.filter(isFollowingGroupId);
		setValue(verifiedValue);
		try {
			window.localStorage.setItem(
				FollowingAccordionPreferenceKey,
				JSON.stringify(verifiedValue),
			);
		} catch {
			// The in-memory accordion state still works for this visit.
		}
	}, []);

	return { value, update } as const;
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

function FollowingAccordionGroup({
	currentPath,
	currentSearch,
	errorLabel,
	fallbackLabel,
	group,
	link,
	onNavigate,
}: {
	currentPath: string;
	currentSearch: string;
	errorLabel: string;
	fallbackLabel: string;
	group: AppShellFollowingGroup;
	link: ElementType;
	onNavigate?: () => void;
}) {
	const Link = link;
	const GroupIcon = group.icon;
	const allActive = isCurrentHref(currentPath, currentSearch, group.allHref);
	return (
		<AccordionItem aria-busy={group.isLoading} className="border-0" value={group.id}>
			<h2>
				<AccordionTrigger
					className={`${SidebarRowClassName} w-full py-0 font-semibold text-muted-foreground`}
				>
					<span className="flex min-w-0 items-center gap-3">
						<GroupIcon aria-hidden className="size-[1.15rem] shrink-0" />
						<span className="truncate">{group.label}</span>
					</span>
				</AccordionTrigger>
			</h2>
			<AccordionContent className="[&>div]:pb-1">
				<div className="grid gap-1 pt-1">
					<Link
						aria-current={allActive ? "page" : undefined}
						className={cn(
							SidebarRowClassName,
							"text-muted-foreground",
							allActive && "bg-surface-selected text-foreground",
						)}
						href={group.allHref}
						onClick={onNavigate}
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-selected">
							<List aria-hidden className="size-4" />
						</span>
						<span className="min-w-0 flex-1 truncate">{group.allLabel}</span>
					</Link>

					{group.isLoading ? (
						<div aria-hidden className="grid gap-1 py-1">
							<Skeleton className="h-10 rounded-lg" />
							<Skeleton className="h-10 rounded-lg" />
						</div>
					) : group.items.length ? (
						group.items.map((item) => {
							const active = isCurrentHref(currentPath, currentSearch, item.href);
							return (
								<Link
									aria-current={active ? "page" : undefined}
									className={cn(
										SidebarRowClassName,
										active && "bg-surface-selected text-foreground",
									)}
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
							);
						})
					) : group.isError ? (
						<p className="px-3 py-2 text-destructive text-xs leading-5">{errorLabel}</p>
					) : (
						<p className="px-3 py-2 text-muted-foreground text-xs leading-5">
							{group.emptyLabel}
						</p>
					)}
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

function SidebarContents({
	brandName,
	currentPath,
	currentSearch,
	expandedFollowingGroups,
	following,
	link,
	navigation,
	navigationLabel,
	onFollowingGroupsChange,
	onNavigate,
}: {
	brandName: string;
	currentPath: string;
	currentSearch: string;
	expandedFollowingGroups: AppShellFollowingGroupId[];
	following?: AppShellFollowing;
	link: ElementType;
	navigation: readonly AppShellNavigationItem[];
	navigationLabel: string;
	onFollowingGroupsChange: (value: readonly string[]) => void;
	onNavigate?: () => void;
}) {
	const Link = link;

	return (
		<ScrollArea
			className="min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:hidden [&_[data-slot=scroll-area-viewport]]:overflow-x-hidden"
			scrollFade
		>
			<nav aria-label={navigationLabel} className="grid gap-1 p-3">
				{navigation.map(({ href, label, icon: Icon }) => {
					const active = isCurrentHref(currentPath, currentSearch, href);
					return (
						<Link
							aria-current={active ? "page" : undefined}
							className={cn(
								SidebarRowClassName,
								"font-medium text-muted-foreground",
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
					<Separator className="mx-4 data-[orientation=horizontal]:w-auto" />
					<p aria-live="polite" className="sr-only" role="status">
						{following.groups.some((group) => group.isLoading)
							? following.loadingLabel
							: null}
					</p>
					<Accordion
						className="grid gap-1 px-3 py-2"
						multiple
						onValueChange={({ value }) => onFollowingGroupsChange(value)}
						value={expandedFollowingGroups}
					>
						{following.groups.map((group) => (
							<FollowingAccordionGroup
								currentPath={currentPath}
								currentSearch={currentSearch}
								errorLabel={following.errorLabel}
								fallbackLabel={brandName}
								group={group}
								key={group.id}
								link={link}
								onNavigate={onNavigate}
							/>
						))}
					</Accordion>
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
	currentSearch = "",
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
	currentSearch?: string;
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
	const { value: expandedFollowingGroups, update: updateFollowingGroups } =
		useFollowingAccordionState();
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

			<header className="sticky top-0 z-50 h-14 border-b border-border-weak bg-background/96 backdrop-blur-xl">
				<div className="flex h-full">
					<div className="hidden w-64 shrink-0 items-center overflow-hidden md:flex">
						<Link
							aria-label={brandName}
							className="flex h-full min-w-0 items-center px-5"
							href="/"
							title={brandName}
						>
							<span className="truncate font-black text-base text-primary tracking-[0.14em]">
								{brandName}
							</span>
						</Link>
					</div>

					<div className="flex shrink-0 items-center gap-1 px-2 md:hidden">
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
							className="flex h-10 items-center px-1"
							href="/"
						>
							<span className="font-black text-primary text-sm tracking-[0.12em]">
								{brandName}
							</span>
						</Link>
					</div>

					<div className="flex min-w-0 flex-1 items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-5">
						<form
							action={search.href}
							className="hidden min-w-40 max-w-2xl flex-1 sm:block"
						>
							<InputGroup
								className="h-10 rounded-full border-border-weak bg-surface-container shadow-none"
								size="lg"
							>
								<InputGroupAddon align="inline-start">
									<Logo alt="" aria-hidden="true" className="size-6" />
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
					"fixed inset-y-0 start-0 z-40 mt-14 hidden border-e border-border-weak bg-background transition-[width] duration-200 ease-out md:flex motion-reduce:transition-none",
					desktopSidebarExpanded ? "w-64" : "w-8",
				)}
				id={DesktopSidebarId}
			>
				{desktopSidebarExpanded ? (
					<SidebarContents
						brandName={brandName}
						currentPath={currentPath}
						currentSearch={currentSearch}
						expandedFollowingGroups={expandedFollowingGroups}
						following={following}
						link={link}
						navigation={navigation}
						navigationLabel={navigationLabel}
						onFollowingGroupsChange={updateFollowingGroups}
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
						<span className="truncate font-black text-base text-primary tracking-[0.14em]">
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
						currentSearch={currentSearch}
						expandedFollowingGroups={expandedFollowingGroups}
						following={following}
						link={link}
						navigation={navigation}
						navigationLabel={navigationLabel}
						onFollowingGroupsChange={updateFollowingGroups}
						onNavigate={() => setMobileSidebarOpen(false)}
					/>
				</SheetContent>
			</Sheet>

			<SkipNavContent
				className={cn(
					"min-h-[calc(100svh-3.5rem)] transition-[margin-inline-start] duration-200 ease-out motion-reduce:transition-none",
					desktopSidebarExpanded ? "md:ms-64" : "md:ms-8",
				)}
				id="main-content"
			>
				{children}
			</SkipNavContent>
		</div>
	);
}

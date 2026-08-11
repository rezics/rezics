"use client";

import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import type { PresentedAvatar } from "@rezics/avatar";
import { Portal } from "@ark-ui/react/portal";
import { List, Menu, Star, X } from "lucide-react";
import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
	Sheet,
	SheetClose,
	SheetDescription,
	SheetHeader,
	SheetOverlay,
	SheetPositioner,
	SheetTitle,
} from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { SkipNavContent, SkipNavLink } from "../ui/skip-nav";
import { cn } from "../utils";
import { Button } from "./button";
import { Logo } from "./logo";
import { IdentityAvatar } from "./identity-avatar";

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

export interface AppShellFollowingItem {
	id: string;
	href: string;
	label: string;
	avatar?: PresentedAvatar | null;
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

export type AppShellSidebarSupplement =
	| {
			readonly kind: "following";
			readonly content: AppShellFollowing;
	  }
	| {
			readonly kind: "shortcuts";
			readonly items: readonly AppShellFollowingItem[];
	  };

export interface AppShellSidebarLabels {
	title: string;
	description: string;
	open: string;
	close: string;
	expand: string;
	collapse: string;
}

function MobileSidebarSheetContent({ children }: { children: ReactNode }) {
	return (
		<Portal>
			<SheetOverlay className="pointer-events-auto" />
			<SheetPositioner className="pointer-events-none" placement="left">
				<ArkDialog.Content
					className={cn(
						"pointer-events-auto relative max-h-full min-h-0 w-[calc(100%-(--spacing(12)))] max-w-80 min-w-0",
						"flex flex-col border-e bg-popover text-popover-foreground shadow-lg/5",
						"transition-[opacity,translate] duration-200 ease-in-out will-change-transform",
						"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-start-10 data-[state=closed]:animate-out",
						"data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-start-10 data-[state=open]:animate-in",
						"motion-reduce:animate-none! motion-reduce:transition-none!",
					)}
					data-slot="sheet-content"
				>
					{children}
				</ArkDialog.Content>
			</SheetPositioner>
		</Portal>
	);
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
			window.localStorage.setItem(FollowingAccordionPreferenceKey, JSON.stringify(verifiedValue));
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
	return <IdentityAvatar avatar={item.avatar} fallback={fallback} size="sm" />;
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
						<span className="grid size-8 shrink-0 place-items-center">
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
										<Star aria-hidden className="size-3 fill-current text-muted-foreground" />
									) : null}
								</Link>
							);
						})
					) : group.isError ? (
						<p className="px-3 py-2 text-destructive text-xs leading-5">{errorLabel}</p>
					) : (
						<p className="px-3 py-2 text-muted-foreground text-xs leading-5">{group.emptyLabel}</p>
					)}
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

function SidebarShortcutList({
	currentPath,
	currentSearch,
	fallbackLabel,
	items,
	link,
	onNavigate,
}: {
	currentPath: string;
	currentSearch: string;
	fallbackLabel: string;
	items: readonly AppShellFollowingItem[];
	link: ElementType;
	onNavigate?: () => void;
}) {
	const Link = link;
	return (
		<div className="grid gap-1 px-3 py-2">
			{items.map((item) => {
				const active = isCurrentHref(currentPath, currentSearch, item.href);
				return (
					<Link
						aria-current={active ? "page" : undefined}
						className={cn(SidebarRowClassName, active && "bg-surface-selected text-foreground")}
						href={item.href}
						key={item.id}
						onClick={onNavigate}
					>
						<FollowingMark fallbackLabel={fallbackLabel} item={item} />
						<span className="min-w-0 flex-1 truncate">{item.label}</span>
					</Link>
				);
			})}
		</div>
	);
}

function SidebarContents({
	brandName,
	currentPath,
	currentSearch,
	expandedFollowingGroups,
	link,
	navigation,
	navigationLabel,
	onFollowingGroupsChange,
	onNavigate,
	supplement,
}: {
	brandName: string;
	currentPath: string;
	currentSearch: string;
	expandedFollowingGroups: AppShellFollowingGroupId[];
	link: ElementType;
	navigation: readonly AppShellNavigationItem[];
	navigationLabel: string;
	onFollowingGroupsChange: (value: readonly string[]) => void;
	onNavigate?: () => void;
	supplement?: AppShellSidebarSupplement;
}) {
	const Link = link;
	const following = supplement?.kind === "following" ? supplement.content : undefined;
	const shortcuts = supplement?.kind === "shortcuts" ? supplement.items : undefined;

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

			{following || shortcuts?.length ? (
				<>
					<Separator className="mx-4 data-[orientation=horizontal]:w-auto" />
					{following ? (
						<>
							<p aria-live="polite" className="sr-only" role="status">
								{following.groups.some((group) => group.isLoading) ? following.loadingLabel : null}
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
					) : shortcuts ? (
						<SidebarShortcutList
							currentPath={currentPath}
							currentSearch={currentSearch}
							fallbackLabel={brandName}
							items={shortcuts}
							link={link}
							onNavigate={onNavigate}
						/>
					) : null}
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
	headerActions,
	sidebarSupplement,
}: {
	children: ReactNode;
	brandName: string;
	navigation: readonly AppShellNavigationItem[];
	navigationLabel: string;
	currentPath: string;
	currentSearch?: string;
	link: ElementType;
	search: {
		href: string;
		label: string;
		placeholder: string;
		avatar?: PresentedAvatar | null;
		avatarFallback?: string;
		defaultValue?: string;
	};
	sidebar: AppShellSidebarLabels;
	skipToContentLabel: string;
	headerActions: ReactNode;
	sidebarSupplement?: AppShellSidebarSupplement;
}) {
	const Link = link;
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

			<header className="sticky top-0 z-50 h-28 border-b border-border-weak bg-background/96 backdrop-blur-xl sm:h-14">
				<div className="grid h-full grid-cols-[auto_1fr] grid-rows-[3.5rem_3.5rem] sm:flex">
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

					<div className="flex shrink-0 items-center gap-1 px-2 sm:ps-3 md:hidden">
						<Button
							aria-controls={MobileSidebarId}
							aria-expanded={mobileSidebarOpen}
							aria-label={sidebar.open}
							className="size-11"
							onClick={() => setMobileSidebarOpen(true)}
							size="icon-xl"
							variant="quiet"
						>
							<Menu aria-hidden />
						</Button>
						<Link aria-label={brandName} className="flex h-10 items-center px-1" href="/">
							<span className="font-black text-primary text-sm tracking-[0.12em]">{brandName}</span>
						</Link>
					</div>

					<div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:items-center sm:gap-2 sm:px-3 lg:px-5">
						<form
							action={search.href}
							className="col-span-2 row-start-2 mx-3 block min-w-0 self-center sm:mx-0 sm:min-w-40 sm:max-w-2xl sm:flex-1 xl:absolute xl:start-1/2 xl:top-1/2 xl:w-[38vw] xl:-translate-x-1/2 xl:-translate-y-1/2 2xl:w-[46vw]"
							key={`${search.href}:${search.defaultValue ?? ""}`}
							role="search"
						>
							<InputGroup className="border-border-weak bg-surface-container shadow-none" size="lg">
								<InputGroupAddon align="inline-start">
									{search.avatarFallback !== undefined ? (
										<IdentityAvatar
											avatar={search.avatar}
											className="size-6"
											fallback={search.avatarFallback}
										/>
									) : (
										<Logo alt="" aria-hidden="true" className="size-6" />
									)}
								</InputGroupAddon>
								<InputGroupInput
									aria-label={search.label}
									defaultValue={search.defaultValue}
									name="q"
									placeholder={search.placeholder}
									type="search"
								/>
								<Button variant="solid" className="sr-only" type="submit">
									{search.label}
								</Button>
							</InputGroup>
						</form>

						<div className="ms-auto flex shrink-0 items-center gap-1 justify-self-end pe-2 sm:gap-2 sm:justify-self-auto sm:pe-0">
							{headerActions}
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
						link={link}
						navigation={navigation}
						navigationLabel={navigationLabel}
						onFollowingGroupsChange={updateFollowingGroups}
						supplement={sidebarSupplement}
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

			<Sheet
				ids={{ content: MobileSidebarId }}
				onOpenChange={({ open }) => setMobileSidebarOpen(open)}
				open={mobileSidebarOpen}
			>
				<MobileSidebarSheetContent>
					<SheetHeader className="flex-row items-center gap-3 border-b border-border-weak p-4">
						<span className="truncate font-black text-base text-primary tracking-[0.14em]">
							{brandName}
						</span>
						<SheetTitle className="sr-only">{sidebar.title}</SheetTitle>
						<SheetDescription className="sr-only">{sidebar.description}</SheetDescription>
						<SheetClose asChild>
							<Button aria-label={sidebar.close} className="ms-auto" size="icon-md" variant="quiet">
								<X aria-hidden />
							</Button>
						</SheetClose>
					</SheetHeader>
					<SidebarContents
						brandName={brandName}
						currentPath={currentPath}
						currentSearch={currentSearch}
						expandedFollowingGroups={expandedFollowingGroups}
						link={link}
						navigation={navigation}
						navigationLabel={navigationLabel}
						onFollowingGroupsChange={updateFollowingGroups}
						onNavigate={() => setMobileSidebarOpen(false)}
						supplement={sidebarSupplement}
					/>
				</MobileSidebarSheetContent>
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

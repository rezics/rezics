"use client";

import { Search, Star } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { Button } from "./button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { SkipNavContent, SkipNavLink } from "../ui/skip-nav";
import { cn } from "../utils";
import { ChoiceSelect } from "./choice-select";
import { Logo } from "./logo";

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

export interface AppShellSubscriptionItem {
	id: string;
	href: string;
	label: string;
	kind: "zone" | "realm" | "profile";
	imageUrl?: string | null;
	favorite?: boolean;
}

export interface AppShellSubscriptions {
	label: string;
	zonesLabel: string;
	realmsLabel: string;
	profilesLabel: string;
	manageLabel: string;
	manageHref: string;
	emptyLabel: string;
	items: readonly AppShellSubscriptionItem[];
}

function isCurrentPath(currentPath: string, href: string) {
	return href === "/" ? currentPath === href : currentPath.startsWith(href);
}

function SubscriptionMark({ item }: { item: AppShellSubscriptionItem }) {
	const fallback = (item.label || "R").slice(0, 1).toUpperCase();
	return (
		<span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-selected font-bold text-[0.6875rem] text-foreground">
			{item.imageUrl ? (
				<img alt="" className="size-full object-cover" src={item.imageUrl} />
			) : (
				fallback
			)}
		</span>
	);
}

function SubscriptionGroup({
	items,
	label,
	link,
}: {
	items: readonly AppShellSubscriptionItem[];
	label: string;
	link: ElementType;
}) {
	const Link = link;
	if (!items.length) return null;
	return (
		<section className="grid gap-1" aria-label={label}>
			<h2 className="px-3 pt-2 font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.12em]">
				{label}
			</h2>
			{items.map((item) => (
				<Link
					className="flex min-h-9 min-w-0 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
					href={item.href}
					key={item.id}
				>
					<SubscriptionMark item={item} />
					<span className="min-w-0 flex-1 truncate">{item.label}</span>
					{item.favorite ? (
						<Star aria-hidden className="size-3 fill-current text-muted-foreground" />
					) : null}
				</Link>
			))}
		</section>
	);
}

export function AppShell({
	children,
	navigation,
	navigationLabel,
	currentPath,
	link,
	search,
	skipToContentLabel,
	locale,
	create,
	account,
	subscriptions,
	utilities,
}: {
	children: ReactNode;
	navigation: readonly AppShellNavigationItem[];
	navigationLabel: string;
	currentPath: string;
	link: ElementType;
	search: { href: string; label: string; placeholder: string };
	skipToContentLabel: string;
	locale: {
		label: string;
		value: string;
		options: readonly { value: string; label: string }[];
		onChange: (value: string) => void | Promise<void>;
	};
	create?: AppShellAction;
	account: AppShellAction;
	subscriptions?: AppShellSubscriptions;
	utilities?: ReactNode;
}) {
	const Link = link;
	const CreateIcon = create?.icon;
	const AccountIcon = account.icon;
	const zones = subscriptions?.items.filter((item) => item.kind === "zone") ?? [];
	const realms = subscriptions?.items.filter((item) => item.kind === "realm") ?? [];
	const profiles = subscriptions?.items.filter((item) => item.kind === "profile") ?? [];
	const compactSubscriptions = subscriptions?.items.slice(0, 5) ?? [];

	return (
		<div className="min-h-svh bg-background">
			<SkipNavLink id="main-content">{skipToContentLabel}</SkipNavLink>

			<header className="sticky top-0 z-50 h-16 border-b border-border-weak bg-background/96 backdrop-blur-xl">
				<div className="grid h-full grid-cols-[4rem_minmax(0,1fr)] md:grid-cols-[16rem_minmax(0,1fr)]">
					<Link
						className="flex min-w-0 items-center justify-center gap-2 border-e border-border-weak px-2 md:justify-start md:px-5"
						href="/"
						title="REZICS"
					>
						<Logo alt="" aria-hidden="true" className="size-8 shrink-0" />
						<span className="hidden truncate text-base font-black text-foreground tracking-[0.14em] md:inline">
							REZICS
						</span>
					</Link>

					<div className="flex min-w-0 items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-5">
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

			<aside className="fixed inset-y-0 start-0 z-40 mt-16 w-16 overflow-y-auto border-e border-border-weak bg-background md:w-64">
				<nav aria-label={navigationLabel} className="grid gap-1 p-2 md:p-3">
					{navigation.map(({ href, label, icon: Icon }) => {
						const active = isCurrentPath(currentPath, href);
						return (
							<Link
								aria-current={active ? "page" : undefined}
								aria-label={label}
								className={cn(
									"flex min-h-11 min-w-0 items-center justify-center gap-3 rounded-xl px-2 font-medium text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:justify-start md:px-3",
									active && "bg-surface-selected text-foreground",
								)}
								href={href}
								key={href}
								title={label}
							>
								<span
									className={cn(
										"grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-[1.15rem]",
										active && "bg-foreground text-background",
									)}
								>
									<Icon aria-hidden />
								</span>
								<span className="hidden truncate md:block">{label}</span>
							</Link>
						);
					})}
				</nav>

				{subscriptions ? (
					<>
						<div className="mx-3 my-2 border-t border-border-weak md:mx-4" />
						<div className="hidden px-3 md:block">
							<p className="px-3 py-2 font-semibold text-[0.6875rem] text-muted-foreground uppercase tracking-[0.14em]">
								{subscriptions.label}
							</p>
							<div className="grid gap-2">
								<SubscriptionGroup
									items={zones}
									label={subscriptions.zonesLabel}
									link={link}
								/>
								<SubscriptionGroup
									items={realms}
									label={subscriptions.realmsLabel}
									link={link}
								/>
								<SubscriptionGroup
									items={profiles}
									label={subscriptions.profilesLabel}
									link={link}
								/>
							</div>
							{!subscriptions.items.length ? (
								<p className="px-3 py-3 text-muted-foreground text-xs leading-5">
									{subscriptions.emptyLabel}
								</p>
							) : null}
							<Link
								className="mt-3 flex min-h-10 items-center rounded-lg px-3 font-medium text-muted-foreground text-xs hover:bg-surface-hover hover:text-foreground"
								href={subscriptions.manageHref}
							>
								{subscriptions.manageLabel}
							</Link>
						</div>
						<div className="grid justify-items-center gap-2 px-2 pb-4 md:hidden">
							{compactSubscriptions.map((item) => (
								<Link
									aria-label={item.label}
									className="grid size-11 place-items-center rounded-xl hover:bg-surface-hover"
									href={item.href}
									key={item.id}
									title={item.label}
								>
									<SubscriptionMark item={item} />
								</Link>
							))}
						</div>
					</>
				) : null}
			</aside>

			<SkipNavContent className="ms-16 min-h-[calc(100svh-4rem)] md:ms-64" id="main-content">
				{children}
			</SkipNavContent>
		</div>
	);
}

"use client";

import { Search } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import { SkipNavContent, SkipNavLink } from "../ui/skip-nav";
import { cn } from "../utils";
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
}

function isCurrentPath(currentPath: string, href: string) {
	return href === "/" ? currentPath === href : currentPath.startsWith(href);
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
	utilities?: ReactNode;
}) {
	const Link = link;
	const CreateIcon = create?.icon;
	const AccountIcon = account.icon;

	return (
		<div className="min-h-svh bg-background">
			<SkipNavLink id="main-content">{skipToContentLabel}</SkipNavLink>

			<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
				<div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">
					<Link className="flex shrink-0 items-center gap-2" href="/" title="REZICS">
						<Logo alt="" aria-hidden="true" className="size-8" />
						<span className="hidden text-base font-bold tracking-[0.14em] min-[360px]:inline">
							REZICS
						</span>
					</Link>

					<nav
						aria-label={navigationLabel}
						className="hidden h-full items-stretch md:flex"
					>
						{navigation.map(({ href, label }) => {
							const active = isCurrentPath(currentPath, href);
							return (
								<Link
									aria-current={active ? "page" : undefined}
									className={cn(
										"relative flex min-w-14 items-center justify-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
										active &&
											"text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
									)}
									href={href}
									key={href}
								>
									{label}
								</Link>
							);
						})}
					</nav>

					<form
						action={search.href}
						className="mx-auto hidden min-w-40 max-w-md flex-1 lg:block"
					>
						<InputGroup className="h-10 bg-card/70 dark:bg-card/70" size="lg">
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

					<div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
						<Button
							aria-label={search.label}
							asChild
							className="size-11 lg:hidden"
							size="icon-xl"
							variant="ghost"
						>
							<Link href={search.href} title={search.label}>
								<Search aria-hidden />
							</Link>
						</Button>

						{create ? (
							<Button
								asChild
								className="size-11 sm:h-9 sm:w-auto sm:px-3.5"
								size="icon-xl"
								variant="outline"
							>
								<Link
									aria-label={create.label}
									href={create.href}
									title={create.label}
								>
									{CreateIcon ? (
										<CreateIcon aria-hidden data-icon="inline-start" />
									) : null}
									<span className="hidden xl:inline">{create.label}</span>
								</Link>
							</Button>
						) : null}

						<NativeSelect
							aria-label={locale.label}
							className="hidden xl:block"
							name="locale"
							onChange={(event) => void locale.onChange(event.currentTarget.value)}
							size="lg"
							value={locale.value}
						>
							{locale.options.map((option) => (
								<NativeSelectOption key={option.value} value={option.value}>
									{option.label}
								</NativeSelectOption>
							))}
						</NativeSelect>

						{utilities}

						<Button asChild className="size-11" size="icon-xl" variant="ghost">
							<Link
								aria-label={account.label}
								href={account.href}
								title={account.label}
							>
								{AccountIcon ? <AccountIcon aria-hidden /> : null}
							</Link>
						</Button>
					</div>
				</div>
			</header>

			<SkipNavContent
				className="min-h-[calc(100svh-4rem)] pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0"
				id="main-content"
			>
				{children}
			</SkipNavContent>

			<nav
				aria-label={navigationLabel}
				className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md md:hidden"
			>
				{navigation.map(({ href, label, icon: Icon }) => {
					const active = isCurrentPath(currentPath, href);
					return (
						<Link
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors [&_svg]:size-5",
								active && "text-primary",
							)}
							href={href}
							key={href}
						>
							<Icon aria-hidden />
							<span className="w-full truncate text-center">{label}</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}

import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { Badge } from "../ui/badge";
import { cn } from "../utils";
import { Button } from "./button";
import { Card, CardContent } from "./card";

export type ManagementWorkspaceIcon = ElementType<{
	"aria-hidden"?: boolean;
	className?: string;
}>;

export interface ManagementWorkspaceSection<SectionId extends string = string> {
	id: SectionId;
	href: string;
	label: string;
	description: string;
	icon: ManagementWorkspaceIcon;
	badge?: string;
}

interface WorkspaceLinkProps {
	children?: ReactNode;
	className?: string;
	href: string;
	"aria-current"?: "page";
}

export interface ManagementWorkspaceHeaderProps {
	backHref: string;
	backLabel: string;
	title: string;
	description?: string;
	action?: ReactNode;
	link: ElementType<WorkspaceLinkProps>;
}

export function ManagementWorkspaceHeader({
	backHref,
	backLabel,
	title,
	description,
	action,
	link,
}: ManagementWorkspaceHeaderProps) {
	const Link = link;
	return (
		<header className="flex flex-wrap items-start justify-between gap-4 border-b border-border-weak pb-6">
			<div className="min-w-0">
				<Button asChild className="-ms-2 mb-3 w-fit" size="sm" variant="quiet">
					<Link href={backHref}>
						<ArrowLeft aria-hidden className="size-4" />
						{backLabel}
					</Link>
				</Button>
				<h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-3xl">
					{title}
				</h1>
				{description ? (
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{action ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
			) : null}
		</header>
	);
}

export function ManagementWorkspace({
	header,
	navigation,
	mobileNavigation,
	children,
	className,
}: {
	header: ReactNode;
	navigation: ReactNode;
	mobileNavigation?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<main
			className={cn(
				"mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10",
				className,
			)}
		>
			{header}
			{mobileNavigation ? <div className="md:hidden">{mobileNavigation}</div> : null}
			<div className="grid min-w-0 gap-8 md:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
				<aside className="hidden min-w-0 md:block">{navigation}</aside>
				<div className="min-w-0">{children}</div>
			</div>
		</main>
	);
}

export function ManagementWorkspaceNavigation<SectionId extends string>({
	ariaLabel,
	currentSectionId,
	link,
	sections,
}: {
	ariaLabel: string;
	currentSectionId?: SectionId;
	link: ElementType<WorkspaceLinkProps>;
	sections: readonly ManagementWorkspaceSection<SectionId>[];
}) {
	const Link = link;
	return (
		<nav aria-label={ariaLabel} className="sticky top-6 grid gap-1">
			{sections.map((section) => {
				const Icon = section.icon;
				const active = currentSectionId === section.id;
				return (
					<Link
						aria-current={active ? "page" : undefined}
						className={cn(
							"flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
							"hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
							active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
						)}
						href={section.href}
						key={section.id}
					>
						<Icon aria-hidden className="size-4 shrink-0" />
						<span className="min-w-0 flex-1 truncate">{section.label}</span>
						{section.badge ? (
							<Badge size="sm" variant="secondary">
								{section.badge}
							</Badge>
						) : null}
					</Link>
				);
			})}
		</nav>
	);
}

export function ManagementWorkspaceOverview<SectionId extends string>({
	ariaLabel,
	link,
	sections,
}: {
	ariaLabel: string;
	link: ElementType<WorkspaceLinkProps>;
	sections: readonly ManagementWorkspaceSection<SectionId>[];
}) {
	const Link = link;
	return (
		<nav aria-label={ariaLabel} className="grid gap-3 sm:grid-cols-2">
			{sections.map((section) => {
				const Icon = section.icon;
				return (
					<Card
						appearance="outlined"
						className="transition-colors hover:border-border"
						key={section.id}
					>
						<CardContent className="p-0">
							<Link
								className="group flex min-h-28 items-start gap-4 rounded-[inherit] p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32"
								href={section.href}
							>
								<span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
									<Icon aria-hidden className="size-5" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
										{section.label}
										{section.badge ? (
											<Badge size="sm" variant="secondary">
												{section.badge}
											</Badge>
										) : null}
									</span>
									<span className="mt-1 block text-sm leading-5 text-muted-foreground">
										{section.description}
									</span>
								</span>
								<ChevronRight
									aria-hidden
									className="mt-2 size-4 shrink-0 text-muted-foreground rtl:rotate-180"
								/>
							</Link>
						</CardContent>
					</Card>
				);
			})}
		</nav>
	);
}

export function ManagementWorkspaceSectionHeader({
	backHref,
	backLabel,
	title,
	description,
	action,
	link,
	showBackOnMobile = true,
	showBackOnDesktop = false,
}: ManagementWorkspaceHeaderProps & {
	showBackOnMobile?: boolean;
	showBackOnDesktop?: boolean;
}) {
	const Link = link;
	return (
		<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
			<div className="min-w-0">
				{showBackOnMobile || showBackOnDesktop ? (
					<Button
						asChild
						className={cn(
							"-ms-2 mb-3 w-fit",
							showBackOnDesktop ? undefined : "md:hidden",
						)}
						size="sm"
						variant="quiet"
					>
						<Link href={backHref}>
							<ArrowLeft aria-hidden className="size-4" />
							{backLabel}
						</Link>
					</Button>
				) : null}
				<h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-balance">
					{title}
				</h2>
				{description ? (
					<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{action ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
			) : null}
		</header>
	);
}

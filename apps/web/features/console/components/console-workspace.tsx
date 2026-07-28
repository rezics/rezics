"use client";

import { useGetApiUsersMe } from "@rezics/openapi-tanstack-query";
import {
	Button,
	Logo,
	QueryFailure,
	QueryPending,
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	cn,
} from "@rezics/ui";
import {
	ArrowLeft,
	FileClock,
	Gauge,
	KeyRound,
	Menu,
	ShieldCheck,
	Users,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { ForbiddenPage } from "@/features/status-pages/forbidden-page";
import { useTranslation } from "@/i18n/client";
import { getAccessibleConsoleSectionIds } from "../model/console-access";
import type { ConsoleSectionId } from "../model/console-section";
import {
	ConsoleOverviewHref,
	consoleSectionHref,
	parseConsoleSection,
} from "../routing/console-routes";

interface ConsoleNavigationSection {
	readonly id: ConsoleSectionId;
	readonly href: string;
	readonly label: string;
	readonly description: string;
	readonly icon: LucideIcon;
}

interface ConsoleWorkspaceModel {
	readonly sections: readonly ConsoleNavigationSection[];
	readonly canReadUsers: boolean;
	readonly canManageUserStatus: boolean;
	readonly canReadSessions: boolean;
	readonly canRevokeSessions: boolean;
	readonly canReadAccess: boolean;
	readonly canManageAccess: boolean;
	readonly canModerate: boolean;
	readonly canReadAudit: boolean;
	readonly canManageTokenPolicies: boolean;
}

const ConsoleWorkspaceContext = createContext<ConsoleWorkspaceModel | undefined>(undefined);

export function useConsoleWorkspace() {
	const model = useContext(ConsoleWorkspaceContext);
	if (!model) throw new Error("Console workspace must be used inside ConsoleWorkspace");
	return model;
}

export function ConsoleWorkspace({ children }: { readonly children: ReactNode }) {
	return (
		<RequireSession>
			<ConsoleWorkspaceContent>{children}</ConsoleWorkspaceContent>
		</RequireSession>
	);
}

function ConsoleNavigation({
	currentSectionId,
	sections,
}: {
	readonly currentSectionId: ConsoleSectionId | undefined;
	readonly sections: readonly ConsoleNavigationSection[];
}) {
	const { t } = useTranslation(["console"]);
	return (
		<nav aria-label={t.console.navigation} className="grid gap-1 p-3">
			<Link
				className={cn(
					"flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
					currentSectionId === undefined
						? "bg-primary/10 font-medium text-primary"
						: "text-muted-foreground hover:bg-accent hover:text-foreground",
				)}
				href={ConsoleOverviewHref}
			>
				<Gauge className="size-4" />
				{t.console.sections.overview.label}
			</Link>
			{sections.map((section) => {
				const Icon = section.icon;
				const selected = currentSectionId === section.id;
				return (
					<Link
						aria-current={selected ? "page" : undefined}
						className={cn(
							"flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
							selected
								? "bg-primary/10 font-medium text-primary"
								: "text-muted-foreground hover:bg-accent hover:text-foreground",
						)}
						href={section.href}
						key={section.id}
					>
						<Icon className="size-4" />
						{section.label}
					</Link>
				);
			})}
		</nav>
	);
}

function ConsoleWorkspaceContent({ children }: { readonly children: ReactNode }) {
	const pathname = usePathname();
	const { t } = useTranslation(["console"]);
	const me = useGetApiUsersMe();
	if (me.isPending) return <QueryPending />;
	if (me.isError || !me.data)
		return <QueryFailure error={me.error} retry={() => void me.refetch()} />;

	const capabilities = new Set(me.data.platformCapabilities);
	const accessibleSectionIds = new Set(
		getAccessibleConsoleSectionIds(me.data.platformCapabilities),
	);
	const canReadUsers = accessibleSectionIds.has("users");
	const canManageUserStatus = capabilities.has("platform.user.status.update");
	const canReadSessions = capabilities.has("platform.session.read");
	const canRevokeSessions = capabilities.has("platform.session.revoke");
	const canReadAccess = capabilities.has("platform.access.read");
	const canManageAccess = capabilities.has("platform.access.manage");
	const canModerate = accessibleSectionIds.has("moderation");
	const canReadAudit = accessibleSectionIds.has("audit");
	const canManageTokenPolicies = accessibleSectionIds.has("token-policies");
	const labels = t.console.sections;
	const sections = [
		...(canReadUsers
			? [
					{
						id: "users" as const,
						href: consoleSectionHref("users"),
						label: labels.users.label,
						description: labels.users.description,
						icon: Users,
					},
				]
			: []),
		...(canModerate
			? [
					{
						id: "moderation" as const,
						href: consoleSectionHref("moderation"),
						label: labels.moderation.label,
						description: labels.moderation.description,
						icon: ShieldCheck,
					},
				]
			: []),
		...(canReadAudit
			? [
					{
						id: "audit" as const,
						href: consoleSectionHref("audit"),
						label: labels.audit.label,
						description: labels.audit.description,
						icon: FileClock,
					},
				]
			: []),
		...(canManageTokenPolicies
			? [
					{
						id: "token-policies" as const,
						href: consoleSectionHref("token-policies"),
						label: labels.tokenPolicies.label,
						description: labels.tokenPolicies.description,
						icon: KeyRound,
					},
				]
			: []),
	] satisfies readonly ConsoleNavigationSection[];

	if (sections.length === 0) return <ForbiddenPage />;

	const currentSectionId = parseConsoleSection(pathname);
	const userWorkspace = currentSectionId === "users";
	const model = {
		sections,
		canReadUsers,
		canManageUserStatus,
		canReadSessions,
		canRevokeSessions,
		canReadAccess,
		canManageAccess,
		canModerate,
		canReadAudit,
		canManageTokenPolicies,
	} satisfies ConsoleWorkspaceModel;

	return (
		<ConsoleWorkspaceContext.Provider value={model}>
			<div className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
				<header className="flex h-14 items-center border-border/70 border-b bg-background/95 px-3 backdrop-blur md:px-4">
					<Sheet>
						<SheetTrigger asChild>
							<Button
								aria-label={t.console.openNavigation}
								className="me-2 md:hidden"
								size="icon-sm"
							>
								<Menu />
							</Button>
						</SheetTrigger>
						<SheetContent className="max-w-64" placement="left">
							<SheetHeader>
								<SheetTitle>{t.console.title}</SheetTitle>
								<SheetDescription>{t.console.description}</SheetDescription>
							</SheetHeader>
							<SheetBody className="p-0">
								<ConsoleNavigation
									currentSectionId={currentSectionId}
									sections={sections}
								/>
							</SheetBody>
						</SheetContent>
					</Sheet>
					<Link className="flex items-center gap-2 font-semibold" href="/console">
						<Logo alt="" className="size-7" />
						<span>{t.console.title}</span>
					</Link>
					{process.env.NODE_ENV === "development" ? (
						<span className="ms-3 hidden rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs sm:inline">
							{t.console.environment}
						</span>
					) : null}
					<div className="ms-auto flex items-center gap-2">
						<span className="hidden max-w-48 truncate text-muted-foreground text-sm sm:block">
							{me.data.name ?? me.data.email}
						</span>
						<Link
							className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
							href="/"
						>
							<ArrowLeft className="size-4" />
							<span className="hidden sm:inline">{t.console.backToApplication}</span>
						</Link>
					</div>
				</header>
				<div className="grid h-[calc(100dvh-3.5rem)] min-h-0 md:grid-cols-[15rem_minmax(0,1fr)]">
					<aside className="hidden min-h-0 overflow-y-auto border-border/70 border-e bg-muted/15 md:block">
						<ConsoleNavigation
							currentSectionId={currentSectionId}
							sections={sections}
						/>
					</aside>
					<main
						className={cn(
							"min-h-0 min-w-0",
							userWorkspace ? "overflow-hidden" : "overflow-y-auto p-4 md:p-6",
						)}
					>
						{children}
					</main>
				</div>
			</div>
		</ConsoleWorkspaceContext.Provider>
	);
}

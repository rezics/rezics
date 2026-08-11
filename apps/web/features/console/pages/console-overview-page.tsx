"use client";

import { useGetApiReady } from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { useConsoleWorkspace } from "../components/console-workspace";

export function ConsoleOverviewPage() {
	const { t } = useTranslation(["console"]);
	const { sections } = useConsoleWorkspace();
	const readiness = useGetApiReady();
	const checks = readiness.data
		? (Object.entries(readiness.data.checks) as [
				keyof typeof readiness.data.checks,
				(typeof readiness.data.checks)[keyof typeof readiness.data.checks],
			][])
		: [];

	return (
		<section className="grid gap-6">
			<header>
				<h1 className="font-semibold text-2xl tracking-tight">
					{t.console.sections.overview.label}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{t.console.sections.overview.description}
				</p>
			</header>
			<div>
				<h2 className="mb-3 font-medium">{t.console.dashboard.managementAreas}</h2>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{sections.map((section) => {
						const Icon = section.icon;
						return (
							<Link
								className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
								href={section.href}
								key={section.id}
							>
								<div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
									<Icon className="size-4" />
								</div>
								<h3 className="font-medium group-hover:text-primary">{section.label}</h3>
								<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
									{section.description}
								</p>
							</Link>
						);
					})}
				</div>
			</div>
			<Card appearance="outlined">
				<CardHeader className="flex-row items-start justify-between gap-3">
					<div>
						<CardTitle>{t.console.dashboard.systemHealth}</CardTitle>
						<CardDescription>{t.console.dashboard.systemHealthDescription}</CardDescription>
					</div>
					<Badge
						variant={
							readiness.data?.status === "ready"
								? "success"
								: readiness.isPending
									? "secondary"
									: "destructive"
						}
					>
						{readiness.isPending
							? t.console.dashboard.checking
							: t.console.dashboard.healthStates[readiness.data?.status ?? "unavailable"]}
					</Badge>
				</CardHeader>
				<CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{checks.map(([name, check]) => (
						<div className="rounded-lg border border-border p-3" key={name}>
							<div className="flex items-center justify-between gap-2">
								<p className="font-medium text-sm">{t.console.dashboard.checks[name]}</p>
								<Badge
									size="sm"
									variant={
										check.state === "ready"
											? "success"
											: check.state === "degraded"
												? "warning"
												: "destructive"
									}
								>
									{t.console.dashboard.healthStates[check.state]}
								</Badge>
							</div>
							<p className="mt-2 text-muted-foreground text-xs">
								{t.console.dashboard.latency({
									milliseconds: Number(check.latencyMs),
								})}
							</p>
						</div>
					))}
					{!readiness.isPending && checks.length === 0 ? (
						<p className="text-destructive text-sm">{t.console.dashboard.healthUnavailable}</p>
					) : null}
				</CardContent>
			</Card>
		</section>
	);
}

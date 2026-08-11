"use client";

import {
	useGetApiAuditEvents,
	type GetApiAuditEventsStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type ReactNode } from "react";

import { useTranslation } from "@/i18n/client";
import { useConsoleWorkspace } from "../components/console-workspace";

type AuditEvent = GetApiAuditEventsStatus200["items"][number];
type AuditCategory = AuditEvent["category"];
type AuditOutcome = AuditEvent["outcome"];

export function ConsoleAuditPage() {
	const { locale, t } = useTranslation(["console", "errors"]);
	const { canReadAudit } = useConsoleWorkspace();
	const [category, setCategory] = useState<AuditCategory | undefined>();
	const [outcome, setOutcome] = useState<AuditOutcome | undefined>();
	const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);
	const cursor = cursorHistory.at(-1);
	const audit = useGetApiAuditEvents(
		{ query: { limit: 50, cursor, category, outcome } },
		{ query: { enabled: canReadAudit } },
	);
	const [selected, setSelected] = useState<AuditEvent>();

	if (!canReadAudit) return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (audit.isPending) return <QueryPending />;
	if (audit.isError || !audit.data)
		return <QueryFailure error={audit.error} retry={() => void audit.refetch()} />;

	const formatter = new Intl.DateTimeFormat(locale.current, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref="/console"
				backLabel={t.console.overview}
				description={t.console.sections.audit.description}
				link={Link}
				title={t.console.sections.audit.label}
			/>
			<div className="grid gap-4">
				<Card appearance="outlined">
					<CardContent className="flex flex-wrap items-end gap-3 p-3">
						<label className="grid gap-1 text-sm">
							<span className="font-medium">{t.console.audit.category}</span>
							<NativeSelect
								aria-label={t.console.audit.category}
								onChange={(event) => {
									setCategory(
										(event.currentTarget.value || undefined) as AuditCategory | undefined,
									);
									setCursorHistory([undefined]);
									setSelected(undefined);
								}}
								value={category ?? ""}
							>
								<NativeSelectOption value="">{t.console.audit.allCategories}</NativeSelectOption>
								<NativeSelectOption value="admin_activity">
									{t.console.audit.categories.admin_activity}
								</NativeSelectOption>
								<NativeSelectOption value="policy_denied">
									{t.console.audit.categories.policy_denied}
								</NativeSelectOption>
								<NativeSelectOption value="system_event">
									{t.console.audit.categories.system_event}
								</NativeSelectOption>
							</NativeSelect>
						</label>
						<label className="grid gap-1 text-sm">
							<span className="font-medium">{t.console.audit.outcome}</span>
							<NativeSelect
								aria-label={t.console.audit.outcome}
								onChange={(event) => {
									setOutcome((event.currentTarget.value || undefined) as AuditOutcome | undefined);
									setCursorHistory([undefined]);
									setSelected(undefined);
								}}
								value={outcome ?? ""}
							>
								<NativeSelectOption value="">{t.console.audit.allOutcomes}</NativeSelectOption>
								<NativeSelectOption value="succeeded">
									{t.console.audit.outcomes.succeeded}
								</NativeSelectOption>
								<NativeSelectOption value="denied">
									{t.console.audit.outcomes.denied}
								</NativeSelectOption>
								<NativeSelectOption value="failed">
									{t.console.audit.outcomes.failed}
								</NativeSelectOption>
							</NativeSelect>
						</label>
					</CardContent>
				</Card>

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.7fr)]">
					<Card appearance="outlined">
						<CardContent className="p-0">
							{audit.data.items.length ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t.console.audit.time}</TableHead>
											<TableHead>{t.console.audit.action}</TableHead>
											<TableHead>{t.console.audit.actor}</TableHead>
											<TableHead>{t.console.audit.authority}</TableHead>
											<TableHead>{t.console.audit.outcome}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{audit.data.items.map((event) => (
											<TableRow
												className="cursor-pointer"
												data-state={selected?.id === event.id ? "selected" : undefined}
												key={event.id}
												onClick={() => setSelected(event)}
											>
												<TableCell>{formatter.format(new Date(event.createdAt))}</TableCell>
												<TableCell>
													<code className="text-xs">{event.action}</code>
												</TableCell>
												<TableCell>
													{event.actor.profileName ??
														event.actor.profileId ??
														t.console.audit.systemActor}
												</TableCell>
												<TableCell>{t.console.audit.authorities[event.authority.kind]}</TableCell>
												<TableCell>
													<AuditOutcomeBadge outcome={event.outcome} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<p className="p-6 text-muted-foreground text-sm">{t.console.audit.empty}</p>
							)}
							<div className="flex justify-between border-t p-3">
								<Button
									disabled={cursorHistory.length === 1}
									onClick={() => setCursorHistory((current) => current.slice(0, -1))}
									size="sm"
									type="button"
									variant="outline"
								>
									{t.console.audit.previousPage}
								</Button>
								<Button
									disabled={!audit.data.nextCursor}
									onClick={() =>
										setCursorHistory((current) => [...current, audit.data.nextCursor ?? undefined])
									}
									size="sm"
									type="button"
									variant="outline"
								>
									{t.console.audit.nextPage}
								</Button>
							</div>
						</CardContent>
					</Card>

					<AuditEventDetails event={selected} />
				</div>
			</div>
		</section>
	);
}

function AuditOutcomeBadge({ outcome }: { readonly outcome: AuditOutcome }) {
	const { t } = useTranslation(["console"]);
	return (
		<Badge
			variant={
				outcome === "succeeded" ? "success" : outcome === "denied" ? "warning" : "destructive"
			}
		>
			{t.console.audit.outcomes[outcome]}
		</Badge>
	);
}

function AuditEventDetails({ event }: { readonly event?: AuditEvent }) {
	const { locale, t } = useTranslation(["console"]);
	if (!event)
		return (
			<Card appearance="outlined">
				<CardContent className="py-12 text-center text-muted-foreground text-sm">
					{t.console.audit.selectEvent}
				</CardContent>
			</Card>
		);
	const formatter = new Intl.DateTimeFormat(locale.current, {
		dateStyle: "long",
		timeStyle: "long",
	});
	return (
		<Card appearance="outlined">
			<CardHeader className="border-b">
				<CardTitle>{t.console.audit.detailsTitle}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 p-4 text-sm">
				<dl className="grid gap-3">
					<Detail label={t.console.audit.time}>
						{formatter.format(new Date(event.createdAt))}
					</Detail>
					<Detail label={t.console.audit.action}>
						<code>{event.action}</code>
					</Detail>
					<Detail label={t.console.audit.category}>
						{t.console.audit.categories[event.category]}
					</Detail>
					<Detail label={t.console.audit.outcome}>{t.console.audit.outcomes[event.outcome]}</Detail>
					<Detail label={t.console.audit.actor}>
						{event.actor.profileName ?? event.actor.profileId ?? t.console.audit.systemActor}
					</Detail>
					<Detail label={t.console.audit.credential}>
						{t.console.audit.credentials[event.actor.credentialKind]}
					</Detail>
					{event.actor.credentialId ? (
						<Detail label={t.console.audit.credentialId}>{event.actor.credentialId}</Detail>
					) : null}
					<Detail label={t.console.audit.authority}>
						{event.authority.id
							? t.console.audit.scopedAuthority({
									kind: t.console.audit.authorities[event.authority.kind],
									id: event.authority.id,
								})
							: t.console.audit.authorities[event.authority.kind]}
					</Detail>
					<Detail label={t.console.audit.target}>
						{event.target
							? (event.target.name ?? event.target.id ?? event.target.path ?? event.target.kind)
							: t.console.audit.noTarget}
					</Detail>
					{event.outcomeCode ? (
						<Detail label={t.console.audit.outcomeCode}>{event.outcomeCode}</Detail>
					) : null}
					{event.governanceDecisionId ? (
						<Detail label={t.console.audit.governanceDecisionId}>
							{event.governanceDecisionId}
						</Detail>
					) : null}
					{event.requestId ? (
						<Detail label={t.console.audit.requestId}>{event.requestId}</Detail>
					) : null}
					{event.traceId ? <Detail label={t.console.audit.traceId}>{event.traceId}</Detail> : null}
				</dl>
				<div>
					<h3 className="mb-2 font-medium">{t.console.audit.rawDetails}</h3>
					<pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">
						{JSON.stringify(event.details ?? {}, null, 2)}
					</pre>
				</div>
			</CardContent>
		</Card>
	);
}

function Detail({ children, label }: { readonly children: ReactNode; readonly label: string }) {
	return (
		<div>
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-0.5 break-all">{children}</dd>
		</div>
	);
}

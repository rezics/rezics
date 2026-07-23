"use client";

import { useGetApiStaffAudit } from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Card,
	CardContent,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";

const KnownAuditActions = [
	"capability_grant.bootstrap",
	"capability_grant.upsert",
	"capability_grant.revoke",
	"platform_access.replace",
] as const;

type KnownAuditAction = (typeof KnownAuditActions)[number];

function isKnownAuditAction(value: string): value is KnownAuditAction {
	return KnownAuditActions.some((action) => action === value);
}

export function StaffAuditPage() {
	const { t, locale } = useTranslation(["staff"]);
	const audit = useGetApiStaffAudit({ query: { limit: 100 } });
	if (audit.isPending) return <QueryPending />;
	if (audit.isError || !audit.data)
		return <QueryFailure error={audit.error} retry={() => void audit.refetch()} />;

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref="/staff"
				backLabel={t.staff.overview}
				description={t.staff.sections.audit.description}
				link={Link}
				title={t.staff.sections.audit.label}
			/>
			<div className="grid gap-3">
				{audit.data.items.length ? (
					audit.data.items.map((event) => (
						<Card appearance="outlined" key={event.id}>
							<CardContent className="grid gap-2 p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<strong>
										{isKnownAuditAction(event.action)
											? t.staff.auditActions[event.action]
											: event.action}
									</strong>
									<Badge variant="secondary">{event.decisionCode}</Badge>
								</div>
								<dl className="grid gap-1 text-sm sm:grid-cols-2">
									<div>
										<dt className="inline text-muted-foreground">
											{t.staff.auditActor}:{" "}
										</dt>
										<dd className="inline">
											{event.actorName ?? event.actorProfileId ?? "—"}
										</dd>
									</div>
									<div>
										<dt className="inline text-muted-foreground">
											{t.staff.auditSubject}:{" "}
										</dt>
										<dd className="inline">
											{event.subjectName ?? event.subjectProfileId ?? "—"}
										</dd>
									</div>
								</dl>
								<time className="text-muted-foreground text-xs">
									{new Intl.DateTimeFormat(locale.current, {
										dateStyle: "medium",
										timeStyle: "short",
									}).format(new Date(event.createdAt))}
								</time>
							</CardContent>
						</Card>
					))
				) : (
					<p className="text-muted-foreground text-sm">{t.staff.auditEmpty}</p>
				)}
			</div>
		</section>
	);
}

"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	getApiEntitiesByUnitIdQueryKey,
	getApiGovernanceUnitAccessInvitationsQueryKey,
	getApiGovernanceUnitByUnitIdAccessInvitationsQueryKey,
	getApiUnitByUnitIdAssociationProposalsQueryKey,
	useDeleteApiGovernanceUnitByUnitIdAccessInvitationsByInvitationId,
	useDeleteApiUnitByUnitIdAssociationProposalsByProposalId,
	useGetApiEntitiesByUnitId,
	useGetApiGovernanceUnitAccessInvitations,
	useGetApiGovernanceUnitByUnitIdAccessInvitations,
	useGetApiUnitByUnitIdAssociationProposals,
	useGetApiUnitsByTypeByUnitId,
	usePatchApiEntitiesByUnitIdAssociationPolicy,
	usePostApiGovernanceUnitByUnitIdAccessInvitations,
	usePostApiGovernanceUnitByUnitIdAccessInvitationsByInvitationIdAccept,
	usePostApiGovernanceUnitByUnitIdAccessInvitationsByInvitationIdDecline,
	usePostApiUnitByUnitIdAssociationProposalsByProposalIdAccept,
	usePostApiUnitByUnitIdAssociationProposalsByProposalIdDecline,
	usePostApiUnitByUnitIdAssociationProposalsInvitations,
	usePostApiUnitByUnitIdAssociationProposalsRequests,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent } from "react";

import { Badge } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { profileHref } from "@/features/profiles/profile-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { UnitType } from "@/features/units/unit-types";

type AccessRole = "viewer" | "editor" | "publishing_editor" | "maintainer";
type AssociationKind = "credit" | "subject";
type AssociationSide = "source" | "target";
type PolicyMode = "open" | "approval" | "invite_only" | "closed";

function futureLocalDate(days: number) {
	const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
	date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
	return date.toISOString().slice(0, 16);
}

function toIsoDate(value: FormDataEntryValue | null) {
	return new Date(String(value ?? "")).toISOString();
}

function formatDate(value: string, locale: string) {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function WorkflowFrame({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={title} />
				{children}
			</main>
		</RequireSession>
	);
}

function AccessInvitationManager({ unitId }: { unitId: string }) {
	const { t, locale } = useTranslation(["errors", "governance", "ui"]);
	const queryClient = useQueryClient();
	const queryOptions = { path: { unitId }, query: { includeResolved: true } } as const;
	const invitations = useGetApiGovernanceUnitByUnitIdAccessInvitations(queryOptions);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiGovernanceUnitByUnitIdAccessInvitationsQueryKey(queryOptions),
		});
	const create = usePostApiGovernanceUnitByUnitIdAccessInvitations({
		mutation: { onSuccess: refresh },
	});
	const cancel = useDeleteApiGovernanceUnitByUnitIdAccessInvitationsByInvitationId({
		mutation: { onSuccess: refresh },
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const roleValue = String(form.get("role"));
		const role: AccessRole =
			roleValue === "editor" ||
			roleValue === "publishing_editor" ||
			roleValue === "maintainer"
				? roleValue
				: "viewer";
		const scope = String(form.get("scope") ?? "")
			.split("/")
			.map((segment) => segment.trim())
			.filter(Boolean);
		const accessExpiry = String(form.get("accessExpiresAt") ?? "");
		try {
			await create.mutateAsync({
				path: { unitId },
				body: {
					invitedProfileId: String(form.get("invitedProfileId") ?? "").trim(),
					role,
					scope,
					invitationExpiresAt: toIsoDate(form.get("invitationExpiresAt")),
					...(accessExpiry ? { accessExpiresAt: toIsoDate(accessExpiry) } : {}),
				},
			});
			formElement.reset();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t.governance.accessInvitations}</CardTitle>
				<CardDescription>{t.governance.accessInvitationDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.governance.invitedProfile}</FieldLabel>
							<Input name="invitedProfileId" required />
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.role}</FieldLabel>
								<NativeSelect defaultValue="viewer" name="role">
									{(
										[
											"viewer",
											"editor",
											"publishing_editor",
											"maintainer",
										] as const
									).map((role) => (
										<NativeSelectOption key={role} value={role}>
											{t.governance.roles[role]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.governance.scope}</FieldLabel>
								<Input name="scope" placeholder={t.governance.scopeHint} />
							</Field>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.invitationExpiry}</FieldLabel>
								<Input
									defaultValue={futureLocalDate(7)}
									name="invitationExpiresAt"
									required
									type="datetime-local"
								/>
							</Field>
							<Field>
								<FieldLabel>{t.governance.accessExpiry}</FieldLabel>
								<Input name="accessExpiresAt" type="datetime-local" />
							</Field>
						</div>
						<RequestFailure error={create.error} />
						<Button variant="solid" isLoading={create.isPending} type="submit">
							{t.governance.invite}
						</Button>
					</FieldGroup>
				</form>
				{invitations.isPending ? <QueryPending /> : null}
				{invitations.isError ? (
					<QueryFailure
						error={invitations.error}
						retry={() => void invitations.refetch()}
					/>
				) : null}
				<div className="grid gap-3">
					{invitations.data?.items.map((invitation) => (
						<div className="rounded-lg border p-4 text-sm" key={invitation.id}>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="grid gap-1">
									<Link href={profileHref(invitation.invitedProfileId)}>
										{invitation.invitedProfileId}
									</Link>
									<span className="text-muted-foreground">
										{t.governance.roles[invitation.role]} ·{" "}
										{invitation.scope.join("/") || "/"} ·{" "}
										{formatDate(invitation.expiresAt, locale.current)}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="outline">
										{t.governance.states[invitation.state]}
									</Badge>
									{invitation.state === "pending" ? (
										<Button
											onClick={() =>
												void cancel.mutateAsync({
													path: { unitId, invitationId: invitation.id },
												})
											}
											size="sm"
											variant="outline"
										>
											{t.governance.cancel}
										</Button>
									) : null}
								</div>
							</div>
						</div>
					))}
					{invitations.data?.items.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t.governance.noInvitations}
						</p>
					) : null}
				</div>
				<RequestFailure error={cancel.error} />
			</CardContent>
		</Card>
	);
}

function ReceivedAccessInvitations() {
	const { t, locale } = useTranslation(["errors", "governance", "ui"]);
	const queryClient = useQueryClient();
	const queryOptions = { query: { includeResolved: true } } as const;
	const invitations = useGetApiGovernanceUnitAccessInvitations(queryOptions);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiGovernanceUnitAccessInvitationsQueryKey(queryOptions),
		});
	const accept = usePostApiGovernanceUnitByUnitIdAccessInvitationsByInvitationIdAccept({
		mutation: { onSuccess: refresh },
	});
	const decline = usePostApiGovernanceUnitByUnitIdAccessInvitationsByInvitationIdDecline({
		mutation: { onSuccess: refresh },
	});
	if (invitations.isPending) return <QueryPending />;
	if (invitations.isError)
		return <QueryFailure error={invitations.error} retry={() => void invitations.refetch()} />;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t.governance.receivedInvitations}</CardTitle>
				<CardDescription>{t.governance.accessInvitationDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				{invitations.data?.items.map((invitation) => (
					<div className="rounded-lg border p-4 text-sm" key={invitation.id}>
						<div className="grid gap-1">
							<span className="font-medium">
								{t.governance.unitId}: {invitation.unitId}
							</span>
							<span className="text-muted-foreground">
								{t.governance.roles[invitation.role]} ·{" "}
								{invitation.scope.join("/") || "/"} ·{" "}
								{formatDate(invitation.expiresAt, locale.current)}
							</span>
							<span className="text-muted-foreground">
								{t.governance.invitedBy}: {invitation.invitedByProfileId}
							</span>
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-2">
							<Badge variant="outline">{t.governance.states[invitation.state]}</Badge>
							{invitation.state === "pending" ? (
								<>
									<Button
										variant="solid"
										onClick={() =>
											void accept.mutateAsync({
												path: {
													unitId: invitation.unitId,
													invitationId: invitation.id,
												},
												body: {},
											})
										}
										size="sm"
									>
										{t.governance.accept}
									</Button>
									<Button
										onClick={() =>
											void decline.mutateAsync({
												path: {
													unitId: invitation.unitId,
													invitationId: invitation.id,
												},
												body: {},
											})
										}
										size="sm"
										variant="outline"
									>
										{t.governance.decline}
									</Button>
								</>
							) : null}
						</div>
					</div>
				))}
				{invitations.data?.items.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t.governance.noInvitations}</p>
				) : null}
				<RequestFailure error={accept.error ?? decline.error} />
			</CardContent>
		</Card>
	);
}

function AssociationProposalManager({
	unitId,
	side,
	kind,
}: {
	unitId: string;
	side: AssociationSide;
	kind: AssociationKind;
}) {
	const { t, locale } = useTranslation(["errors", "governance", "ui"]);
	const queryClient = useQueryClient();
	const queryOptions = {
		path: { unitId },
		query: { side, kind, includeResolved: true },
	} as const;
	const proposals = useGetApiUnitByUnitIdAssociationProposals(queryOptions);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUnitByUnitIdAssociationProposalsQueryKey(queryOptions),
		});
	const request = usePostApiUnitByUnitIdAssociationProposalsRequests({
		mutation: { onSuccess: refresh },
	});
	const invite = usePostApiUnitByUnitIdAssociationProposalsInvitations({
		mutation: { onSuccess: refresh },
	});
	const accept = usePostApiUnitByUnitIdAssociationProposalsByProposalIdAccept({
		mutation: { onSuccess: refresh },
	});
	const decline = usePostApiUnitByUnitIdAssociationProposalsByProposalIdDecline({
		mutation: { onSuccess: refresh },
	});
	const cancel = useDeleteApiUnitByUnitIdAssociationProposalsByProposalId({
		mutation: { onSuccess: refresh },
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const common = {
			kind,
			role: String(form.get("role") ?? "").trim(),
			expiresAt: toIsoDate(form.get("expiresAt")),
		};
		try {
			if (side === "source")
				await request.mutateAsync({
					path: { unitId },
					body: {
						...common,
						targetEntityId: String(form.get("relatedUnitId") ?? "").trim(),
					},
				});
			else
				await invite.mutateAsync({
					path: { unitId },
					body: {
						...common,
						sourceUnitId: String(form.get("relatedUnitId") ?? "").trim(),
					},
				});
			formElement.reset();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	const title =
		kind === "credit" ? t.governance.creditAssociations : t.governance.subjectAssociations;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{t.governance.associationProposalDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<Field required>
							<FieldLabel>
								{side === "source"
									? t.governance.targetEntity
									: t.governance.sourceUnit}
							</FieldLabel>
							<Input name="relatedUnitId" required />
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.associationRole}</FieldLabel>
								<Input maxLength={64} name="role" required />
							</Field>
							<Field required>
								<FieldLabel>{t.governance.proposalExpiry}</FieldLabel>
								<Input
									defaultValue={futureLocalDate(14)}
									name="expiresAt"
									required
									type="datetime-local"
								/>
							</Field>
						</div>
						<RequestFailure error={side === "source" ? request.error : invite.error} />
						<Button
							variant="solid"
							isLoading={side === "source" ? request.isPending : invite.isPending}
							type="submit"
						>
							{side === "source"
								? t.governance.requestAssociation
								: t.governance.inviteAssociation}
						</Button>
					</FieldGroup>
				</form>
				{proposals.isPending ? <QueryPending /> : null}
				{proposals.isError ? (
					<QueryFailure error={proposals.error} retry={() => void proposals.refetch()} />
				) : null}
				<div className="grid gap-3">
					{proposals.data?.items.map((proposal) => {
						const receivingSide =
							(side === "source" && proposal.direction === "invitation") ||
							(side === "target" && proposal.direction === "request");
						return (
							<div className="rounded-lg border p-4 text-sm" key={proposal.id}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="grid gap-1">
										<span className="font-medium">{proposal.role}</span>
										<span className="text-muted-foreground">
											{t.governance.direction[proposal.direction]} ·{" "}
											{side === "source"
												? proposal.targetEntityId
												: proposal.sourceUnitId}{" "}
											· {formatDate(proposal.expiresAt, locale.current)}
										</span>
									</div>
									<Badge variant="outline">
										{t.governance.states[proposal.state]}
									</Badge>
								</div>
								{proposal.state === "pending" ? (
									<div className="mt-3 flex gap-2">
										{receivingSide ? (
											<>
												<Button
													variant="solid"
													onClick={() =>
														void accept.mutateAsync({
															path: {
																unitId,
																proposalId: proposal.id,
															},
															body: {},
														})
													}
													size="sm"
												>
													{t.governance.accept}
												</Button>
												<Button
													onClick={() =>
														void decline.mutateAsync({
															path: {
																unitId,
																proposalId: proposal.id,
															},
															body: {},
														})
													}
													size="sm"
													variant="outline"
												>
													{t.governance.decline}
												</Button>
											</>
										) : (
											<Button
												onClick={() =>
													void cancel.mutateAsync({
														path: { unitId, proposalId: proposal.id },
													})
												}
												size="sm"
												variant="outline"
											>
												{t.governance.cancel}
											</Button>
										)}
									</div>
								) : null}
							</div>
						);
					})}
					{proposals.data?.items.length === 0 ? (
						<p className="text-muted-foreground text-sm">{t.governance.noProposals}</p>
					) : null}
				</div>
				<RequestFailure error={accept.error ?? decline.error ?? cancel.error} />
			</CardContent>
		</Card>
	);
}

function EntityAssociationPolicy({
	unitId,
	creditAttribution,
	subjectAssociation,
	canManageCredit,
	canManageSubject,
}: {
	unitId: string;
	creditAttribution: PolicyMode;
	subjectAssociation: PolicyMode;
	canManageCredit: boolean;
	canManageSubject: boolean;
}) {
	const { t } = useTranslation(["errors", "governance", "ui"]);
	const queryClient = useQueryClient();
	const update = usePatchApiEntitiesByUnitIdAssociationPolicy({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: getApiEntitiesByUnitIdQueryKey({ path: { unitId } }),
				}),
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const policy = (name: string): PolicyMode => {
			const value = String(form.get(name));
			return value === "approval" || value === "invite_only" || value === "closed"
				? value
				: "open";
		};
		try {
			await update.mutateAsync({
				path: { unitId },
				body: {
					...(canManageCredit ? { creditAttribution: policy("creditAttribution") } : {}),
					...(canManageSubject
						? { subjectAssociation: policy("subjectAssociation") }
						: {}),
				},
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t.governance.associationPolicy}</CardTitle>
				<CardDescription>{t.governance.associationPolicyDescription}</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={submit}>
					<FieldGroup>
						{canManageCredit ? (
							<PolicyField
								defaultValue={creditAttribution}
								label={t.governance.creditAssociations}
								name="creditAttribution"
							/>
						) : null}
						{canManageSubject ? (
							<PolicyField
								defaultValue={subjectAssociation}
								label={t.governance.subjectAssociations}
								name="subjectAssociation"
							/>
						) : null}
						<RequestFailure error={update.error} />
						<Button variant="solid" isLoading={update.isPending} type="submit">
							{t.ui.save}
						</Button>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function PolicyField({
	name,
	label,
	defaultValue,
}: {
	name: string;
	label: string;
	defaultValue: PolicyMode;
}) {
	const { t } = useTranslation(["errors", "governance", "ui"]);
	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<NativeSelect defaultValue={defaultValue} name={name}>
				{(["open", "approval", "invite_only", "closed"] as const).map((mode) => (
					<NativeSelectOption key={mode} value={mode}>
						{t.governance.policyModes[mode]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

export function ReceivedAccessInvitationsPage() {
	const { t } = useTranslation(["errors", "governance", "ui"]);
	return (
		<WorkflowFrame title={t.governance.receivedInvitations}>
			<ReceivedAccessInvitations />
		</WorkflowFrame>
	);
}

export function UnitGovernancePage({ type, id }: { type: UnitType; id: string }) {
	const { t } = useTranslation(["errors", "governance", "ui"]);
	const unit = useGetApiUnitsByTypeByUnitId({ path: { type, unitId: id } });
	if (unit.isPending) return <QueryPending />;
	if (unit.isError || !unit.data)
		return <QueryFailure error={unit.error} retry={() => void unit.refetch()} />;
	const canOpen =
		unit.data.capabilities.canEdit ||
		unit.data.capabilities.canManageAccess ||
		unit.data.capabilities.canManageAssociations;
	if (!canOpen)
		return (
			<WorkflowFrame title={t.governance.title}>
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</WorkflowFrame>
		);
	return (
		<WorkflowFrame title={t.governance.title}>
			{unit.data.capabilities.canManageAccess ? (
				<AccessInvitationManager unitId={id} />
			) : null}
			{unit.data.capabilities.canEdit ? (
				<>
					<AssociationProposalManager kind="credit" side="source" unitId={id} />
					<AssociationProposalManager kind="subject" side="source" unitId={id} />
				</>
			) : null}
		</WorkflowFrame>
	);
}

export function EntityGovernancePage({ id }: { id: string }) {
	const { t, locale } = useTranslation(["errors", "governance", "ui"]);
	const entity = useGetApiEntitiesByUnitId({
		path: { unitId: id },
		query: { language: toContentLanguage(locale.target) },
	});
	if (entity.isPending) return <QueryPending />;
	if (entity.isError || !entity.data)
		return <QueryFailure error={entity.error} retry={() => void entity.refetch()} />;
	const { capabilities } = entity.data;
	const canManageAssociations =
		capabilities.canManageCreditAssociations || capabilities.canManageSubjectAssociations;
	if (!capabilities.canManageAccess && !canManageAssociations)
		return (
			<WorkflowFrame title={t.governance.title}>
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</WorkflowFrame>
		);
	return (
		<WorkflowFrame title={t.governance.title}>
			{capabilities.canManageAccess ? <AccessInvitationManager unitId={id} /> : null}
			{canManageAssociations ? (
				<EntityAssociationPolicy
					canManageCredit={capabilities.canManageCreditAssociations}
					canManageSubject={capabilities.canManageSubjectAssociations}
					creditAttribution={entity.data.associationPolicy.creditAttribution}
					subjectAssociation={entity.data.associationPolicy.subjectAssociation}
					unitId={id}
				/>
			) : null}
			{capabilities.canManageCreditAssociations ? (
				<AssociationProposalManager kind="credit" side="target" unitId={id} />
			) : null}
			{capabilities.canManageSubjectAssociations ? (
				<AssociationProposalManager kind="subject" side="target" unitId={id} />
			) : null}
		</WorkflowFrame>
	);
}

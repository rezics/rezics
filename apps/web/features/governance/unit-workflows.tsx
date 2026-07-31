"use client";

import {
	type GetApiEntitiesByUnitIdStatus200,
	type GetApiGovernanceUnitByUnitIdAccessStatus200PermissionsEnum,
	getApiEntitiesByUnitIdQueryKey,
	getApiGovernanceUnitAccessInvitationsQueryKey,
	getApiGovernanceUnitByUnitIdAccessInvitationsQueryKey,
	getApiUnitByUnitIdAssociationProposalsQueryKey,
	useDeleteApiUnitsByTypeByUnitIdCreditAttributionsByAssociationId,
	useDeleteApiGovernanceUnitByUnitIdAccessInvitationsByInvitationId,
	useDeleteApiUnitByUnitIdAssociationProposalsByProposalId,
	useGetApiEntitiesByUnitId,
	useGetApiGovernanceUnitAccessInvitations,
	useGetApiGovernanceUnitByUnitIdAccess,
	useGetApiGovernanceUnitByUnitIdAccessInvitations,
	useGetApiUnitByUnitIdAssociationProposals,
	usePostApiGovernanceUnitByUnitIdAccessInvitations,
	usePostApiGovernanceUnitByUnitIdAccessInvitationsByInvitationIdAccept,
	usePostApiGovernanceUnitByUnitIdAccessInvitationsByInvitationIdDecline,
	usePostApiUnitByUnitIdAssociationProposalsByProposalIdAccept,
	usePostApiUnitByUnitIdAssociationProposalsByProposalIdDecline,
	usePostApiUnitByUnitIdAssociationProposalsInvitations,
	usePostApiUnitByUnitIdAssociationProposalsRequests,
	usePostApiUnitsByTypeByUnitIdCreditAttributions,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { type FormEvent, useState } from "react";

import {
	Badge,
	EntityPicker,
	PermissionMatrix,
	type PermissionMatrixLabels,
	type PermissionMatrixResource,
	UnitPicker,
} from "@rezics/ui";
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
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { UnitAccessManager } from "./components/unit-access-manager";
import {
	type CreditAttributionRole,
	CreditAttributionRoles,
	isKnownAttributionRole,
	isSubjectAssociationRole,
	SubjectAssociationRoles,
} from "@/features/units/attribution-role";

type AssociationKind = "credit" | "subject";
type AssociationSide = "source" | "target";

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

export function AccessInvitationManager({ unitId }: { unitId: string }) {
	const { t, locale } = useTranslation(["errors", "governance", "ui"]);
	const queryClient = useQueryClient();
	const queryOptions = { path: { unitId }, query: { includeResolved: true } } as const;
	const invitations = useGetApiGovernanceUnitByUnitIdAccessInvitations(queryOptions);
	const access = useGetApiGovernanceUnitByUnitIdAccess({ path: { unitId } });
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
	const [invitedProfileId, setInvitedProfileId] = useState<string>();
	const [permissions, setPermissions] = useState<
		ReadonlySet<GetApiGovernanceUnitByUnitIdAccessStatus200PermissionsEnum>
	>(() => new Set(["unit.read"]));

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const scope = String(form.get("scope") ?? "")
			.split("/")
			.map((segment) => segment.trim())
			.filter(Boolean);
		const accessExpiry = String(form.get("accessExpiresAt") ?? "");
		if (!invitedProfileId || permissions.size === 0) return;
		try {
			await create.mutateAsync({
				path: { unitId },
				body: {
					invitedProfileId,
					permissions: [...permissions],
					scope,
					invitationExpiresAt: toIsoDate(form.get("invitationExpiresAt")),
					...(accessExpiry ? { accessExpiresAt: toIsoDate(accessExpiry) } : {}),
				},
			});
			formElement.reset();
			setInvitedProfileId(undefined);
			setPermissions(new Set(["unit.read"]));
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
							<UnitPicker
								ariaLabel={t.governance.invitedProfile}
								index="users"
								kinds={["profile"]}
								onValueChange={setInvitedProfileId}
								placeholder={t.ui.pickerPlaceholders.user}
								value={invitedProfileId}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.governance.scope}</FieldLabel>
							<Input name="scope" placeholder={t.governance.scopeHint} />
						</Field>
						{access.data ? (
							<PermissionMatrix
								labels={
									{
										templates: t.governance.access.matrix.templates,
										permissions: t.governance.access.matrix.permissions,
										searchPlaceholder:
											t.governance.access.matrix.searchPlaceholder,
										clear: t.governance.access.matrix.clear,
										selected: (selected, total) =>
											t.governance.access.matrix.selected({
												selected,
												total,
											}),
										categorySelected: (selected) =>
											t.governance.access.matrix.categorySelected({
												selected,
											}),
										required: t.governance.access.matrix.required,
										empty: t.governance.access.matrix.empty,
									} satisfies PermissionMatrixLabels
								}
								onValueChange={setPermissions}
								resources={access.data.permissions.map(
									(
										permission,
									): PermissionMatrixResource<GetApiGovernanceUnitByUnitIdAccessStatus200PermissionsEnum> => ({
										id: permission,
										category: permission.startsWith("realm.")
											? t.governance.access.permissionCategories.realm
											: permission.startsWith("entity.")
												? t.governance.access.permissionCategories.entity
												: t.governance.access.permissionCategories.unit,
										label: t.governance.access.permissions[permission],
										keywords: [permission],
										actions: [
											{
												value: permission,
												label: t.governance.access.matrix.grant,
											},
										],
									}),
								)}
								value={permissions}
							/>
						) : null}
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
										{invitation.permissions
											.map(
												(permission) =>
													t.governance.access.permissions[permission],
											)
											.join(", ")}{" "}
										· {invitation.scope.join("/") || "/"} ·{" "}
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

export function ReceivedAccessInvitations() {
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
								{invitation.permissions
									.map(
										(permission) => t.governance.access.permissions[permission],
									)
									.join(", ")}{" "}
								· {invitation.scope.join("/") || "/"} ·{" "}
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
	entityPublisherOnly = false,
	creditRoles,
}: {
	unitId: string;
	side: AssociationSide;
	kind: AssociationKind;
	entityPublisherOnly?: boolean;
	creditRoles?: readonly CreditAttributionRole[];
}) {
	const { t, locale } = useTranslation(["errors", "governance", "ui", "units"]);
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
	const [contextPost, setContextPost] = useState<{ id: string; label: string }>();
	const [relatedUnitId, setRelatedUnitId] = useState<string>();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const role = String(form.get("role") ?? "");
		const expiresAt = toIsoDate(form.get("expiresAt"));
		if (!relatedUnitId) return;
		try {
			if (kind === "credit") {
				if (!isKnownAttributionRole(role)) return;
				if (side === "source")
					await request.mutateAsync({
						path: { unitId },
						body: {
							kind,
							role,
							expiresAt,
							targetUnitId: relatedUnitId,
						},
					});
				else
					await invite.mutateAsync({
						path: { unitId },
						body: {
							kind,
							role,
							expiresAt,
							sourceUnitId: relatedUnitId,
						},
					});
			} else {
				if (!isSubjectAssociationRole(role)) return;
				if (side === "source")
					await request.mutateAsync({
						path: { unitId },
						body: {
							kind,
							role,
							expiresAt,
							targetUnitId: relatedUnitId,
							...(contextPost ? { contextPostId: contextPost.id } : {}),
						},
					});
				else
					await invite.mutateAsync({
						path: { unitId },
						body: {
							kind,
							role,
							expiresAt,
							sourceUnitId: relatedUnitId,
							...(contextPost ? { contextPostId: contextPost.id } : {}),
						},
					});
			}
			formElement.reset();
			setContextPost(undefined);
			setRelatedUnitId(undefined);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	const title =
		kind === "credit" ? t.governance.creditAssociations : t.governance.subjectAssociations;
	const relatedUnitLabel =
		side === "source"
			? kind === "credit"
				? t.governance.targetUnit
				: t.governance.targetEntity
			: t.governance.sourceUnit;
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
							<FieldLabel>{relatedUnitLabel}</FieldLabel>
							<UnitPicker
								ariaLabel={relatedUnitLabel}
								index={entityPublisherOnly ? "users" : undefined}
								kinds={
									entityPublisherOnly
										? ["profile"]
										: kind === "subject" && side === "source"
											? ["entity"]
											: undefined
								}
								onValueChange={setRelatedUnitId}
								placeholder={
									entityPublisherOnly
										? t.ui.pickerPlaceholders.user
										: kind === "subject" && side === "source"
											? t.ui.pickerPlaceholders.entity
											: t.ui.pickerPlaceholders.unit
								}
								value={relatedUnitId}
							/>
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.associationRole}</FieldLabel>
								<NativeSelect name="role" required>
									{(kind === "credit"
										? (creditRoles ?? CreditAttributionRoles)
										: SubjectAssociationRoles
									).map((role) => (
										<NativeSelectOption key={role} value={role}>
											{kind === "credit"
												? isKnownAttributionRole(role)
													? t.units.attributionRoles[role]
													: role
												: isSubjectAssociationRole(role)
													? t.units.subjectAssociationRoles[role]
													: role}
										</NativeSelectOption>
									))}
								</NativeSelect>
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
						{kind === "subject" ? (
							<Field>
								<FieldLabel>{t.governance.contextWikiPost}</FieldLabel>
								<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
									<EntityPicker
										ariaLabel={t.governance.contextWikiPost}
										index="posts"
										kind="wiki"
										onChange={setContextPost}
										placeholder={t.ui.pickerPlaceholders.post}
										value={contextPost}
									/>
									{contextPost ? (
										<Button
											onClick={() => setContextPost(undefined)}
											type="button"
											variant="outline"
										>
											{t.ui.clear}
										</Button>
									) : null}
								</div>
							</Field>
						) : null}
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
										<span className="font-medium">
											{proposal.kind === "credit" &&
											isKnownAttributionRole(proposal.role)
												? t.units.attributionRoles[proposal.role]
												: proposal.kind === "subject" &&
													  isSubjectAssociationRole(proposal.role)
													? t.units.subjectAssociationRoles[proposal.role]
													: proposal.role}
										</span>
										<span className="text-muted-foreground">
											{t.governance.direction[proposal.direction]} ·{" "}
											{side === "source"
												? proposal.targetUnitId
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

export function UnitAssociationProposalManager({
	unitId,
	creditRoles,
}: {
	unitId: string;
	creditRoles?: readonly CreditAttributionRole[];
}) {
	return (
		<>
			<UnitAttributionProposalManager creditRoles={creditRoles} unitId={unitId} />
			<AssociationProposalManager kind="subject" side="source" unitId={unitId} />
		</>
	);
}

export function UnitAttributionProposalManager({
	unitId,
	creditRoles,
}: {
	unitId: string;
	creditRoles?: readonly CreditAttributionRole[];
}) {
	return (
		<AssociationProposalManager
			creditRoles={creditRoles}
			kind="credit"
			side="source"
			unitId={unitId}
		/>
	);
}

export function ProfileAttributionProposalManager({ profileId }: { profileId: string }) {
	return <AssociationProposalManager kind="credit" side="target" unitId={profileId} />;
}

function EntityPublisherManager({ entity }: { entity: GetApiEntitiesByUnitIdStatus200 }) {
	const { t } = useTranslation(["errors", "governance", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const queryOptions = {
		path: { unitId: entity.id },
		query: { localizationLanguages },
	} as const;
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiEntitiesByUnitIdQueryKey(queryOptions),
		});
	const add = usePostApiUnitsByTypeByUnitIdCreditAttributions({
		mutation: { onSuccess: refresh },
	});
	const remove = useDeleteApiUnitsByTypeByUnitIdCreditAttributionsByAssociationId({
		mutation: { onSuccess: refresh },
	});
	const [publisherProfileId, setPublisherProfileId] = useState<string>();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t.governance.publisherAttributions}</CardTitle>
				<CardDescription>{t.governance.publisherAttributionDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						if (!publisherProfileId) return;
						try {
							await add.mutateAsync({
								path: { type: "entity", unitId: entity.id },
								body: {
									creditedUnitId: publisherProfileId,
									role: "publisher",
								},
							});
							setPublisherProfileId(undefined);
						} catch {
							// The typed mutation state supplies the visible API error.
						}
					}}
				>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.governance.publisherProfile}</FieldLabel>
							<UnitPicker
								ariaLabel={t.governance.publisherProfile}
								index="users"
								kinds={["profile"]}
								onValueChange={setPublisherProfileId}
								placeholder={t.ui.pickerPlaceholders.user}
								value={publisherProfileId}
							/>
						</Field>
						<Button
							disabled={!publisherProfileId}
							isLoading={add.isPending}
							type="submit"
							variant="solid"
						>
							{t.governance.addPublisher}
						</Button>
						<RequestFailure error={add.error} />
					</FieldGroup>
				</form>
				<div className="grid gap-3">
					{entity.attributions.map((attribution) => {
						const label = attribution.creditedUnit.title ?? attribution.creditedUnit.id;
						return (
							<div
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"
								key={attribution.id}
							>
								{attribution.creditedUnit.kind === "profile" ? (
									<Link
										href={profileHref({
											id: attribution.creditedUnit.id,
											slugAddress: attribution.creditedUnit.slugAddress,
										})}
									>
										{label}
									</Link>
								) : (
									<span>{label}</span>
								)}
								<Button
									isLoading={
										remove.isPending &&
										remove.variables?.path.associationId === attribution.id
									}
									onClick={() =>
										void remove.mutateAsync({
											path: {
												type: "entity",
												unitId: entity.id,
												associationId: attribution.id,
											},
										})
									}
									size="sm"
									variant="outline"
								>
									{t.governance.removePublisher}
								</Button>
							</div>
						);
					})}
					{entity.attributions.length === 0 ? (
						<p className="text-muted-foreground text-sm">{t.governance.noPublishers}</p>
					) : null}
				</div>
				<RequestFailure error={remove.error} />
			</CardContent>
		</Card>
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

export function EntityGovernancePage({ id }: { id: string }) {
	const { t } = useTranslation(["errors", "governance", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const entity = useGetApiEntitiesByUnitId({
		path: { unitId: id },
		query: { localizationLanguages },
	});
	if (entity.isPending) return <QueryPending />;
	if (entity.isError || !entity.data)
		return <QueryFailure error={entity.error} retry={() => void entity.refetch()} />;
	const { capabilities } = entity.data;
	const canManageAssociations =
		capabilities.canManageCreditAssociations || capabilities.canManageSubjectAssociations;
	if (
		!capabilities.canManageAccess &&
		!capabilities.canEditCreditAttributions &&
		!canManageAssociations
	)
		return (
			<WorkflowFrame title={t.governance.title}>
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</WorkflowFrame>
		);
	return (
		<WorkflowFrame title={t.governance.title}>
			{capabilities.canManageAccess ? (
				<UnitAccessManager includeEntityTargetScopes unitId={id} />
			) : null}
			{capabilities.canEditCreditAttributions ? (
				<>
					<EntityPublisherManager entity={entity.data} />
					<AssociationProposalManager
						creditRoles={["publisher"]}
						entityPublisherOnly
						kind="credit"
						side="source"
						unitId={id}
					/>
				</>
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

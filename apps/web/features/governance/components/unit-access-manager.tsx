"use client";

import {
	type PostApiGovernanceUnitByUnitIdAccessBindingsBody,
	getApiGovernanceUnitByUnitIdAccessBindingsQueryKey,
	getApiGovernanceUnitByUnitIdAccessRestrictionsQueryKey,
	getApiGovernanceUnitByUnitIdProtectionsQueryKey,
	useDeleteApiGovernanceUnitByUnitIdAccessBindingsByBindingId,
	useDeleteApiGovernanceUnitByUnitIdAccessRestrictionsByRestrictionId,
	useDeleteApiGovernanceUnitByUnitIdProtectionsByProtectionId,
	useGetApiGovernanceUnitByUnitIdAccessBindings,
	useGetApiGovernanceUnitByUnitIdAccessEffective,
	useGetApiGovernanceUnitByUnitIdAccessRestrictions,
	useGetApiGovernanceUnitByUnitIdProtections,
	usePostApiGovernanceUnitByUnitIdAccessBindings,
	usePostApiGovernanceUnitByUnitIdAccessRestrictions,
	usePostApiGovernanceUnitByUnitIdProtections,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	UnitPicker,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { AccessInvitationManager } from "../unit-workflows";

const AccessRoles = ["viewer", "editor", "publishing_editor", "maintainer"] as const;
type AccessRole = (typeof AccessRoles)[number];
const UnitPermissions = [
	"unit.read",
	"unit.update",
	"unit.publish",
	"unit.history.restore",
	"unit.access.manage",
	"unit.association.manage",
	"unit.protection.manage",
	"unit.delete",
] as const;
type UnitPermission = (typeof UnitPermissions)[number];
const ReasonCodes = [
	"content_policy",
	"realm_rules",
	"spam",
	"harassment",
	"unsafe_content",
	"off_topic",
	"duplicate",
	"account_security",
	"user_request",
	"appeal",
	"administrative",
	"other",
] as const;
type ReasonCode = (typeof ReasonCodes)[number];
type SubjectKind = "profile" | "realm" | "authenticated";

function readScope(form: FormData) {
	return String(form.get("scope") ?? "")
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean);
}

function optionalIsoDate(form: FormData, name: string) {
	const value = String(form.get(name) ?? "").trim();
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function isAccessRole(value: string): value is AccessRole {
	return AccessRoles.some((role) => role === value);
}

function isUnitPermission(value: string): value is UnitPermission {
	return UnitPermissions.some((permission) => permission === value);
}

function isReasonCode(value: string): value is ReasonCode {
	return ReasonCodes.some((reason) => reason === value);
}

function scopeLabel(scope: readonly string[]) {
	return scope.length ? `/${scope.join("/")}` : "/";
}

export function UnitAccessManager({ unitId }: { unitId: string }) {
	return (
		<div className="grid gap-6">
			<EffectiveAccessCard unitId={unitId} />
			<AccessBindingsCard unitId={unitId} />
			<AccessInvitationManager unitId={unitId} />
			<AccessRestrictionsCard unitId={unitId} />
			<UnitProtectionsCard unitId={unitId} />
		</div>
	);
}

function EffectiveAccessCard({ unitId }: { unitId: string }) {
	const { t } = useTranslation(["governance"]);
	const query = useGetApiGovernanceUnitByUnitIdAccessEffective({ path: { unitId } });
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.governance.access.effective}</CardTitle>
				<CardDescription>{t.governance.access.effectiveDescription}</CardDescription>
			</CardHeader>
			<CardContent>
				{query.isPending ? <QueryPending /> : null}
				{query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : null}
				{query.data ? (
					<ul className="divide-y rounded-lg border">
						{query.data.decisions.map(({ permission, decision }) => (
							<li
								className="flex flex-wrap items-center justify-between gap-3 p-3"
								key={permission}
							>
								<span className="font-medium">
									{t.governance.access.permissions[permission]}
								</span>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Badge variant={decision.allowed ? "secondary" : "destructive"}>
										{decision.allowed
											? t.governance.access.allowed
											: t.governance.access.denied}
									</Badge>
									<span>
										{decision.allowed
											? t.governance.access.sources[decision.source]
											: t.governance.access.denialReasons[decision.reason]}
									</span>
								</div>
							</li>
						))}
					</ul>
				) : null}
			</CardContent>
		</Card>
	);
}

function AccessBindingsCard({ unitId }: { unitId: string }) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const [subjectKind, setSubjectKind] = useState<SubjectKind>("profile");
	const [subjectId, setSubjectId] = useState<string>();
	const options = { path: { unitId } } as const;
	const query = useGetApiGovernanceUnitByUnitIdAccessBindings(options);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiGovernanceUnitByUnitIdAccessBindingsQueryKey(options),
		});
	const create = usePostApiGovernanceUnitByUnitIdAccessBindings({
		mutation: { onSuccess: refresh },
	});
	const revoke = useDeleteApiGovernanceUnitByUnitIdAccessBindingsByBindingId({
		mutation: { onSuccess: refresh },
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const roleValue = String(form.get("role") ?? "");
		if (!isAccessRole(roleValue)) return;
		const relationValue = String(form.get("relation") ?? "member");
		const relation =
			relationValue === "content_editor" || relationValue === "governor"
				? relationValue
				: "member";
		let subject: PostApiGovernanceUnitByUnitIdAccessBindingsBody["subject"];
		if (subjectKind === "authenticated") subject = { kind: "authenticated" };
		else {
			if (!subjectId) return;
			subject =
				subjectKind === "realm"
					? { kind: "realm", realmId: subjectId, relation }
					: { kind: "profile", profileId: subjectId };
		}
		const expiresAt = optionalIsoDate(form, "expiresAt");
		if (expiresAt === null) return;
		try {
			await create.mutateAsync({
				path: { unitId },
				body: {
					subject,
					role: roleValue,
					scope: readScope(form),
					...(expiresAt ? { expiresAt } : {}),
				},
			});
			formElement.reset();
			setSubjectId(undefined);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.governance.access.bindings}</CardTitle>
				<CardDescription>{t.governance.access.bindingsDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.access.subjectKind}</FieldLabel>
								<NativeSelect
									name="subjectKind"
									onChange={(event) => {
										const value = event.currentTarget.value;
										if (
											value === "profile" ||
											value === "realm" ||
											value === "authenticated"
										) {
											setSubjectKind(value);
											setSubjectId(undefined);
										}
									}}
									value={subjectKind}
								>
									{(["profile", "realm", "authenticated"] as const).map(
										(kind) => (
											<NativeSelectOption key={kind} value={kind}>
												{t.governance.access.subjectKinds[kind]}
											</NativeSelectOption>
										),
									)}
								</NativeSelect>
							</Field>
							{subjectKind !== "authenticated" ? (
								<Field required>
									<FieldLabel>{t.governance.access.subjectId}</FieldLabel>
									<UnitPicker
										index={subjectKind === "realm" ? "realms" : "users"}
										kinds={[subjectKind]}
										onValueChange={setSubjectId}
										value={subjectId}
									/>
								</Field>
							) : null}
							{subjectKind === "realm" ? (
								<Field required>
									<FieldLabel>{t.governance.access.realmRelation}</FieldLabel>
									<NativeSelect defaultValue="member" name="relation">
										{(["member", "content_editor", "governor"] as const).map(
											(relation) => (
												<NativeSelectOption key={relation} value={relation}>
													{t.governance.access.realmRelations[relation]}
												</NativeSelectOption>
											),
										)}
									</NativeSelect>
								</Field>
							) : null}
							<Field required>
								<FieldLabel>{t.governance.role}</FieldLabel>
								<NativeSelect defaultValue="viewer" name="role">
									{AccessRoles.map((role) => (
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
							<Field>
								<FieldLabel>{t.governance.access.expiresAt}</FieldLabel>
								<Input name="expiresAt" type="datetime-local" />
							</Field>
						</div>
						<Button isLoading={create.isPending} type="submit" variant="solid">
							{t.governance.access.grant}
						</Button>
						<RequestFailure error={create.error} />
					</FieldGroup>
				</form>
				{query.isPending ? <QueryPending /> : null}
				{query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : null}
				<div className="grid gap-3">
					{query.data?.items.map((binding) => (
						<div
							className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"
							key={binding.id}
						>
							<div>
								<p className="font-medium">
									{t.governance.access.subjectKinds[binding.subjectKind]} ·{" "}
									{binding.profileId ?? binding.realmId ?? "*"}
								</p>
								<p className="text-muted-foreground">
									{binding.role === "owner"
										? t.governance.roles.owner
										: isAccessRole(binding.role)
											? t.governance.roles[binding.role]
											: binding.role}{" "}
									· {scopeLabel(binding.scope)}
								</p>
							</div>
							{binding.revokedAt ? (
								<Badge variant="outline">{t.governance.access.revoked}</Badge>
							) : (
								<Button
									isLoading={revoke.isPending}
									onClick={() =>
										revoke.mutate({ path: { unitId, bindingId: binding.id } })
									}
									size="sm"
									variant="outline"
								>
									{t.governance.access.revoke}
								</Button>
							)}
						</div>
					))}
					{query.data?.items.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t.governance.access.noBindings}
						</p>
					) : null}
				</div>
				<RequestFailure error={revoke.error} />
			</CardContent>
		</Card>
	);
}

function AccessRestrictionsCard({ unitId }: { unitId: string }) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const [subjectKind, setSubjectKind] =
		useState<Exclude<SubjectKind, "authenticated">>("profile");
	const [subjectId, setSubjectId] = useState<string>();
	const options = { path: { unitId } } as const;
	const query = useGetApiGovernanceUnitByUnitIdAccessRestrictions(options);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiGovernanceUnitByUnitIdAccessRestrictionsQueryKey(options),
		});
	const create = usePostApiGovernanceUnitByUnitIdAccessRestrictions({
		mutation: { onSuccess: refresh },
	});
	const revoke = useDeleteApiGovernanceUnitByUnitIdAccessRestrictionsByRestrictionId({
		mutation: { onSuccess: refresh },
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const permissionValue = String(form.get("permission") ?? "");
		const reasonValue = String(form.get("reason") ?? "");
		if (!subjectId || !isUnitPermission(permissionValue) || !isReasonCode(reasonValue)) return;
		const expiresAt = optionalIsoDate(form, "expiresAt");
		if (expiresAt === null) return;
		try {
			await create.mutateAsync({
				path: { unitId },
				body: {
					subject:
						subjectKind === "profile"
							? { kind: "profile", profileId: subjectId }
							: { kind: "realm", realmId: subjectId },
					permission: permissionValue,
					scope: readScope(form),
					reasonCode: reasonValue,
					...(expiresAt ? { expiresAt } : {}),
				},
			});
			formElement.reset();
			setSubjectId(undefined);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.governance.access.restrictions}</CardTitle>
				<CardDescription>{t.governance.access.restrictionsDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.access.subjectKind}</FieldLabel>
								<NativeSelect
									value={subjectKind}
									onChange={(event) => {
										setSubjectKind(
											event.currentTarget.value === "realm"
												? "realm"
												: "profile",
										);
										setSubjectId(undefined);
									}}
								>
									{(["profile", "realm"] as const).map((kind) => (
										<NativeSelectOption key={kind} value={kind}>
											{t.governance.access.subjectKinds[kind]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field required>
								<FieldLabel>{t.governance.access.subjectId}</FieldLabel>
								<UnitPicker
									index={subjectKind === "realm" ? "realms" : "users"}
									kinds={[subjectKind]}
									onValueChange={setSubjectId}
									value={subjectId}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.governance.access.permission}</FieldLabel>
								<NativeSelect defaultValue="unit.read" name="permission">
									{UnitPermissions.map((permission) => (
										<NativeSelectOption key={permission} value={permission}>
											{t.governance.access.permissions[permission]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field required>
								<FieldLabel>{t.governance.access.reason}</FieldLabel>
								<NativeSelect defaultValue="administrative" name="reason">
									{ReasonCodes.map((reason) => (
										<NativeSelectOption key={reason} value={reason}>
											{t.governance.access.reasonCodes[reason]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.governance.scope}</FieldLabel>
								<Input name="scope" placeholder={t.governance.scopeHint} />
							</Field>
							<Field>
								<FieldLabel>{t.governance.access.expiresAt}</FieldLabel>
								<Input name="expiresAt" type="datetime-local" />
							</Field>
						</div>
						<Button isLoading={create.isPending} type="submit" variant="solid">
							{t.governance.access.restrict}
						</Button>
						<RequestFailure error={create.error} />
					</FieldGroup>
				</form>
				{query.isPending ? <QueryPending /> : null}
				{query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : null}
				<div className="grid gap-3">
					{query.data?.items.map((restriction) => (
						<div
							className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"
							key={restriction.id}
						>
							<div>
								<p className="font-medium">
									{t.governance.access.subjectKinds[restriction.subject.kind]} ·{" "}
									{restriction.subject.kind === "profile"
										? restriction.subject.profileId
										: restriction.subject.realmId}
								</p>
								<p className="text-muted-foreground">
									{isUnitPermission(restriction.permission)
										? t.governance.access.permissions[restriction.permission]
										: restriction.permission}{" "}
									· {scopeLabel(restriction.scope)} ·{" "}
									{t.governance.access.reasonCodes[restriction.reasonCode]}
								</p>
							</div>
							{restriction.revokedAt ? (
								<Badge variant="outline">{t.governance.access.revoked}</Badge>
							) : (
								<Button
									isLoading={revoke.isPending}
									onClick={() =>
										revoke.mutate({
											path: { unitId, restrictionId: restriction.id },
										})
									}
									size="sm"
									variant="outline"
								>
									{t.governance.access.revoke}
								</Button>
							)}
						</div>
					))}
					{query.data?.items.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t.governance.access.noRestrictions}
						</p>
					) : null}
				</div>
				<RequestFailure error={revoke.error} />
			</CardContent>
		</Card>
	);
}

function UnitProtectionsCard({ unitId }: { unitId: string }) {
	const { t } = useTranslation(["governance"]);
	const queryClient = useQueryClient();
	const options = { path: { unitId } } as const;
	const query = useGetApiGovernanceUnitByUnitIdProtections(options);
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: getApiGovernanceUnitByUnitIdProtectionsQueryKey(options),
		});
	const create = usePostApiGovernanceUnitByUnitIdProtections({
		mutation: { onSuccess: refresh },
	});
	const revoke = useDeleteApiGovernanceUnitByUnitIdProtectionsByProtectionId({
		mutation: { onSuccess: refresh },
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const mode = form.get("mode") === "owner_only" ? "owner_only" : "frozen";
		const reasonValue = String(form.get("reason") ?? "");
		if (!isReasonCode(reasonValue)) return;
		const expiresAt = optionalIsoDate(form, "expiresAt");
		if (expiresAt === null) return;
		try {
			await create.mutateAsync({
				path: { unitId },
				body: {
					scope: readScope(form),
					mode,
					reasonCode: reasonValue,
					...(expiresAt ? { expiresAt } : {}),
				},
			});
			formElement.reset();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{t.governance.access.protections}</CardTitle>
				<CardDescription>{t.governance.access.protectionsDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field required>
								<FieldLabel>{t.governance.access.mode}</FieldLabel>
								<NativeSelect defaultValue="frozen" name="mode">
									{(["frozen", "owner_only"] as const).map((mode) => (
										<NativeSelectOption key={mode} value={mode}>
											{t.governance.access.modes[mode]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field required>
								<FieldLabel>{t.governance.access.reason}</FieldLabel>
								<NativeSelect defaultValue="administrative" name="reason">
									{ReasonCodes.map((reason) => (
										<NativeSelectOption key={reason} value={reason}>
											{t.governance.access.reasonCodes[reason]}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.governance.scope}</FieldLabel>
								<Input name="scope" placeholder={t.governance.scopeHint} />
							</Field>
							<Field>
								<FieldLabel>{t.governance.access.expiresAt}</FieldLabel>
								<Input name="expiresAt" type="datetime-local" />
							</Field>
						</div>
						<Button isLoading={create.isPending} type="submit" variant="solid">
							{t.governance.access.protect}
						</Button>
						<RequestFailure error={create.error} />
					</FieldGroup>
				</form>
				{query.isPending ? <QueryPending /> : null}
				{query.isError ? (
					<QueryFailure error={query.error} retry={() => void query.refetch()} />
				) : null}
				<div className="grid gap-3">
					{query.data?.items.map((protection) => (
						<div
							className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"
							key={protection.id}
						>
							<div>
								<p className="font-medium">
									{protection.mode === "owner_only"
										? t.governance.access.modes.owner_only
										: t.governance.access.modes.frozen}
								</p>
								<p className="text-muted-foreground">
									{scopeLabel(protection.scope)} ·{" "}
									{t.governance.access.reasonCodes[protection.reasonCode]}
								</p>
							</div>
							{protection.revokedAt ? (
								<Badge variant="outline">{t.governance.access.revoked}</Badge>
							) : (
								<Button
									isLoading={revoke.isPending}
									onClick={() =>
										revoke.mutate({
											path: { unitId, protectionId: protection.id },
										})
									}
									size="sm"
									variant="outline"
								>
									{t.governance.access.revoke}
								</Button>
							)}
						</div>
					))}
					{query.data?.items.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t.governance.access.noProtections}
						</p>
					) : null}
				</div>
				<RequestFailure error={revoke.error} />
			</CardContent>
		</Card>
	);
}

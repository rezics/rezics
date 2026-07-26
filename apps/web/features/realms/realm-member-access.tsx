"use client";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import {
	getApiRealmsByRealmIdMembersByProfileIdCapabilitiesQueryKey,
	useGetApiRealmsByRealmIdMembers,
	useGetApiRealmsByRealmIdMembersByProfileIdCapabilities,
	usePutApiRealmsByRealmIdMembersByProfileIdCapabilities,
	type GetApiRealmsByRealmIdMembersByProfileIdCapabilitiesStatus200,
	type GetApiRealmsByRealmIdMembersStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	Checkbox,
	Field,
	FieldLabel,
	IdentityAvatar,
	Input,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { profileHref } from "@/features/profiles/profile-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

type RealmCapability =
	GetApiRealmsByRealmIdMembersByProfileIdCapabilitiesStatus200["capabilities"][number]["capability"];

function toLocalDateTime(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function getInitialExpiry(
	data: GetApiRealmsByRealmIdMembersByProfileIdCapabilitiesStatus200,
): string | undefined {
	const expiries = new Set(
		data.capabilities.flatMap((item) =>
			item.directGrant ? [item.directGrant.expiresAt ?? ""] : [],
		),
	);
	if (expiries.size > 1) return undefined;
	return toLocalDateTime(expiries.values().next().value ?? null);
}

export function RealmMemberAccess({ profileId, realmId }: { profileId: string; realmId: string }) {
	const { t } = useTranslation(["errors"]);
	const access = useGetApiRealmsByRealmIdMembersByProfileIdCapabilities({
		path: { profileId, realmId },
	});
	const member = useGetApiRealmsByRealmIdMembers({
		path: { realmId },
		query: { profileId, limit: 1 },
	});
	if (access.isPending || member.isPending) return <QueryPending />;
	if (access.isError || member.isError || !access.data || !member.data)
		return (
			<QueryFailure
				error={access.error ?? member.error}
				retry={() => {
					void access.refetch();
					void member.refetch();
				}}
			/>
		);
	const memberData = member.data.items[0];
	if (!memberData) return <p className="text-sm text-destructive">{t.errors.notFound}</p>;
	const signature = access.data.capabilities
		.map(
			(item) =>
				`${item.capability}:${item.sources.join(",")}:${item.directGrant?.expiresAt ?? ""}`,
		)
		.join("|");
	return <RealmMemberAccessEditor data={access.data} key={signature} member={memberData} />;
}

function RealmMemberAccessEditor({
	data,
	member,
}: {
	data: GetApiRealmsByRealmIdMembersByProfileIdCapabilitiesStatus200;
	member: GetApiRealmsByRealmIdMembersStatus200["items"][number];
}) {
	const { t } = useTranslation(["governance", "realms", "ui"]);
	const queryClient = useQueryClient();
	const replace = usePutApiRealmsByRealmIdMembersByProfileIdCapabilities();
	const [selected, setSelected] = useState(
		() =>
			new Set<RealmCapability>(
				data.capabilities.flatMap((item) => (item.directGrant ? [item.capability] : [])),
			),
	);
	const [expiry, setExpiry] = useState<string | undefined>(() => getInitialExpiry(data));
	const mixedExpiry = expiry === undefined;
	const expiryResolved = !mixedExpiry || selected.size === 0;

	const toggle = (capability: RealmCapability, checked: boolean) => {
		if (mixedExpiry || replace.isPending) return;
		const previous = selected;
		const next = new Set(selected);
		if (checked) next.add(capability);
		else next.delete(capability);
		setSelected(next);
		save(next, expiry, () => setSelected(previous));
	};

	const save = (
		nextSelected: ReadonlySet<RealmCapability>,
		nextExpiry: string | undefined,
		rollback: () => void,
	) => {
		const expiresAt = toExpiryInput(nextExpiry, nextSelected.size > 0);
		if (expiresAt === undefined) return;
		replace.mutate(
			{
				path: { realmId: data.realmId, profileId: data.profileId },
				body: {
					capabilities: data.capabilities
						.map((item) => item.capability)
						.filter((capability) => nextSelected.has(capability)),
					expiresAt,
				},
			},
			{
				onError: rollback,
				onSuccess: (next) => {
					queryClient.setQueryData(
						getApiRealmsByRealmIdMembersByProfileIdCapabilitiesQueryKey({
							path: { realmId: data.realmId, profileId: data.profileId },
						}),
						next,
					);
				},
			},
		);
	};

	const name = member.name ?? t.realms.unknownMember;
	const href = profileHref({
		id: data.profileId,
		slugAddress: member.slugAddress,
	});

	return (
		<div className="grid gap-4">
			<Card appearance="outlined">
				<CardContent className="flex flex-wrap items-center gap-3 p-5">
					<IdentityAvatar
						avatar={member.avatar}
						className="size-12"
						fallback={name.slice(0, 1).toLocaleUpperCase()}
						imageAlt={name}
					/>
					<div className="min-w-0 flex-1">
						<Link
							className="block truncate font-semibold underline-offset-4 hover:underline focus-visible:underline"
							href={href}
						>
							{name}
						</Link>
						{member.slugAddress?.slug ? (
							<Link
								className="block truncate font-mono text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline"
								href={href}
							>
								{verbatimTerms.profileSlugPrefix.value}
								{member.slugAddress.slug}
							</Link>
						) : null}
					</div>
					{isMemberRole(data.role) ? (
						<Badge variant="secondary">{t.realms.roles[data.role]}</Badge>
					) : null}
				</CardContent>
			</Card>
			<Card appearance="outlined">
				<CardContent className="grid gap-5 p-5">
					<div className="grid gap-2">
						{data.capabilities.map((item) => (
							<div
								className="grid gap-2 rounded-lg border border-border-weak p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-center"
								key={item.capability}
							>
								<label className="flex items-start gap-3 text-sm">
									<Checkbox
										checked={selected.has(item.capability)}
										disabled={mixedExpiry || replace.isPending}
										onCheckedChange={(details) =>
											toggle(item.capability, details.checked === true)
										}
									/>
									<span>{t.governance.capabilities[item.capability]}</span>
								</label>
								<div className="flex flex-wrap gap-1 sm:justify-end">
									{item.sources.map((source) => (
										<Badge key={source} variant="secondary">
											{t.governance.capabilitySources[source]}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
					<Field>
						<FieldLabel>{t.realms.memberAccess.expiry}</FieldLabel>
						<Input
							aria-invalid={mixedExpiry}
							onChange={(event) => setExpiry(event.currentTarget.value)}
							onBlur={(event) => {
								const nextExpiry = event.currentTarget.value;
								save(selected, nextExpiry, () => setExpiry(getInitialExpiry(data)));
							}}
							disabled={replace.isPending}
							type="datetime-local"
							value={expiry ?? ""}
						/>
						{mixedExpiry ? (
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-amber-700 text-sm dark:text-amber-300">
									{t.realms.memberAccess.mixedExpiry}
								</p>
								<Button
									disabled={replace.isPending}
									onClick={() => {
										const previous = expiry;
										setExpiry("");
										save(selected, "", () => setExpiry(previous));
									}}
									size="sm"
									type="button"
									variant="outline"
								>
									{t.realms.memberAccess.noExpiry}
								</Button>
							</div>
						) : expiry ? null : (
							<p className="text-muted-foreground text-sm">
								{t.realms.memberAccess.noExpiry}
							</p>
						)}
					</Field>
					<RequestFailure error={replace.error} fallback={t.ui.retryLater} />
					{replace.isPending ? (
						<p className="text-end text-xs text-muted-foreground">
							{t.realms.memberAccess.saving}
						</p>
					) : null}
					{!expiryResolved ? null : (
						<p className="text-end text-xs text-muted-foreground">
							{t.realms.memberAccess.autoSaveHint}
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

const MemberRoles = ["owner", "admin", "moderator", "member"] as const;
type MemberRole = (typeof MemberRoles)[number];

function isMemberRole(value: string): value is MemberRole {
	return MemberRoles.some((role) => role === value);
}

function toExpiryInput(value: string | undefined, hasSelected: boolean): string | null | undefined {
	if (!hasSelected || value === "") return null;
	if (value === undefined) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

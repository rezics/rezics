"use client";

import {
	getApiRealmsByRealmIdMembersByProfileIdCapabilitiesQueryKey,
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
	Input,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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

export function RealmMemberAccess({
	members,
	realmId,
}: {
	members: GetApiRealmsByRealmIdMembersStatus200["items"];
	realmId: string;
}) {
	const { t } = useTranslation(["realms"]);
	const [profileId, setProfileId] = useState("");
	const activeMembers = members.filter((member) => member.state === "active");

	return (
		<div className="grid gap-4">
			<Field>
				<FieldLabel>{t.realms.memberAccess.selectMember}</FieldLabel>
				<NativeSelect
					onChange={(event) => setProfileId(event.currentTarget.value)}
					value={profileId}
				>
					<NativeSelectOption value="">
						{t.realms.memberAccess.selectMemberPlaceholder}
					</NativeSelectOption>
					{activeMembers.map((member) => (
						<NativeSelectOption key={member.profileId} value={member.profileId}>
							{member.name ?? member.profileId}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			{profileId ? <RealmMemberAccessQuery profileId={profileId} realmId={realmId} /> : null}
		</div>
	);
}

function RealmMemberAccessQuery({ profileId, realmId }: { profileId: string; realmId: string }) {
	const access = useGetApiRealmsByRealmIdMembersByProfileIdCapabilities({
		path: { profileId, realmId },
	});
	if (access.isPending) return <QueryPending />;
	if (access.isError || !access.data)
		return <QueryFailure error={access.error} retry={() => void access.refetch()} />;
	const signature = access.data.capabilities
		.map(
			(item) =>
				`${item.capability}:${item.sources.join(",")}:${item.directGrant?.expiresAt ?? ""}`,
		)
		.join("|");
	return <RealmMemberAccessEditor data={access.data} key={signature} />;
}

function RealmMemberAccessEditor({
	data,
}: {
	data: GetApiRealmsByRealmIdMembersByProfileIdCapabilitiesStatus200;
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
		setSelected((current) => {
			const next = new Set(current);
			if (checked) next.add(capability);
			else next.delete(capability);
			return next;
		});
	};

	const save = () => {
		if (!expiryResolved) return;
		replace.mutate(
			{
				path: { realmId: data.realmId, profileId: data.profileId },
				body: {
					capabilities: data.capabilities
						.map((item) => item.capability)
						.filter((capability) => selected.has(capability)),
					expiresAt: selected.size > 0 && expiry ? new Date(expiry).toISOString() : null,
				},
			},
			{
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

	return (
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
						type="datetime-local"
						value={expiry ?? ""}
					/>
					{mixedExpiry ? (
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-amber-700 text-sm dark:text-amber-300">
								{t.realms.memberAccess.mixedExpiry}
							</p>
							<Button
								onClick={() => setExpiry("")}
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
				<Button
					className="w-fit justify-self-end"
					disabled={!expiryResolved}
					isLoading={replace.isPending}
					onClick={save}
					type="button"
					variant="solid"
				>
					{t.realms.memberAccess.save}
				</Button>
			</CardContent>
		</Card>
	);
}

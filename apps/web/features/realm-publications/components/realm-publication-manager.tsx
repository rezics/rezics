"use client";

import {
	usePostApiUnitsByIdByUnitIdRealmPublicationsByRealmId,
	usePostApiUnitsByIdByUnitIdRealmPublicationsByRealmIdRepublish,
	usePostApiUnitsByIdByUnitIdRealmPublicationsByRealmIdWithdraw,
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
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	Skeleton,
	UnitPicker,
} from "@rezics/ui";
import { useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	realmPublicationItems,
	useUnitRealmPublications,
	type RealmGovernanceStateFilter,
	type RealmPublicationItem,
	type RealmPublicationStateFilter,
} from "../data/realm-publication-query";

const PublicationStateFilters = [
	"active",
	"withdrawn",
	"all",
] as const satisfies readonly RealmPublicationStateFilter[];
const GovernanceStateFilters = [
	"current",
	"pending",
	"visible",
	"hidden",
	"removed",
	"all",
] as const satisfies readonly RealmGovernanceStateFilter[];

function isPublicationStateFilter(value: string): value is RealmPublicationStateFilter {
	return PublicationStateFilters.some((candidate) => candidate === value);
}

function isGovernanceStateFilter(value: string): value is RealmGovernanceStateFilter {
	return GovernanceStateFilters.some((candidate) => candidate === value);
}

export function RealmPublicationManager({ unitId }: { readonly unitId: string }) {
	const { t } = useTranslation(["realms", "state", "units"]);
	const copy = t.units.realmPublications;
	const [publicationState, setPublicationState] = useState<RealmPublicationStateFilter>("active");
	const [realmStatus, setRealmStatus] = useState<RealmGovernanceStateFilter>("current");
	const [realmId, setRealmId] = useState<string>();
	const query = useUnitRealmPublications(unitId, publicationState, realmStatus);
	const items = useMemo(() => realmPublicationItems(query.data), [query.data]);
	const publish = usePostApiUnitsByIdByUnitIdRealmPublicationsByRealmId({
		mutation: {
			onSuccess: async () => {
				setRealmId(undefined);
				await query.refetch();
			},
		},
	});
	const withdraw = usePostApiUnitsByIdByUnitIdRealmPublicationsByRealmIdWithdraw({
		mutation: { onSuccess: () => query.refetch() },
	});
	const republish = usePostApiUnitsByIdByUnitIdRealmPublicationsByRealmIdRepublish({
		mutation: { onSuccess: () => query.refetch() },
	});
	const mutationError = publish.error ?? withdraw.error ?? republish.error;
	const mutationPending = publish.isPending || withdraw.isPending || republish.isPending;

	return (
		<div className="grid gap-6">
			<Card appearance="outlined">
				<CardHeader>
					<CardTitle>{copy.addTitle}</CardTitle>
					<CardDescription>{copy.addDescription}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
					<Field>
						<FieldLabel>{copy.realmLabel}</FieldLabel>
						<UnitPicker
							ariaLabel={copy.realmLabel}
							index="realms"
							kinds={["realm"]}
							onValueChange={setRealmId}
							value={realmId}
						/>
					</Field>
					<Button
						disabled={!realmId || mutationPending}
						onClick={() => {
							if (!realmId) return;
							publish.mutate({ path: { unitId, realmId } });
						}}
						type="button"
					>
						{copy.add}
					</Button>
				</CardContent>
			</Card>

			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel>{copy.publicationStateFilter}</FieldLabel>
					<NativeSelect
						onChange={(event) => {
							const value = event.currentTarget.value;
							if (isPublicationStateFilter(value)) setPublicationState(value);
						}}
						value={publicationState}
					>
						<NativeSelectOption value="active">
							{copy.publicationStates.active}
						</NativeSelectOption>
						<NativeSelectOption value="withdrawn">
							{copy.publicationStates.withdrawn}
						</NativeSelectOption>
						<NativeSelectOption value="all">{copy.all}</NativeSelectOption>
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel>{copy.realmStatusFilter}</FieldLabel>
					<NativeSelect
						onChange={(event) => {
							const value = event.currentTarget.value;
							if (isGovernanceStateFilter(value)) setRealmStatus(value);
						}}
						value={realmStatus}
					>
						<NativeSelectOption value="current">{copy.current}</NativeSelectOption>
						{(["pending", "visible", "hidden", "removed"] as const).map((status) => (
							<NativeSelectOption key={status} value={status}>
								{copy.realmStatuses[status]}
							</NativeSelectOption>
						))}
						<NativeSelectOption value="all">{copy.all}</NativeSelectOption>
					</NativeSelect>
				</Field>
			</div>

			{mutationError ? <RequestFailure error={mutationError} /> : null}
			{query.isPending ? (
				<Skeleton className="h-56 rounded-xl" />
			) : query.isError && !query.data ? (
				<QueryFailure error={query.error} retry={() => void query.refetch()} />
			) : items.length ? (
				<div className="grid gap-3">
					{items.map((item) => (
						<RealmPublicationCard
							item={item}
							key={item.realmId}
							mutationPending={mutationPending}
							onRepublish={() =>
								republish.mutate({
									path: { unitId, realmId: item.realmId },
								})
							}
							onWithdraw={() =>
								withdraw.mutate({
									path: { unitId, realmId: item.realmId },
								})
							}
						/>
					))}
					{query.hasNextPage ? (
						<Button
							disabled={query.isFetchingNextPage}
							onClick={() => void query.fetchNextPage()}
							type="button"
							variant="outline"
						>
							{copy.loadMore}
						</Button>
					) : null}
					{query.isFetchNextPageError ? <RequestFailure error={query.error} /> : null}
				</div>
			) : (
				<div className="grid min-h-40 place-items-center rounded-xl border border-dashed p-8">
					<p className="text-muted-foreground text-sm">{copy.empty}</p>
				</div>
			)}
		</div>
	);
}

function RealmPublicationCard({
	item,
	mutationPending,
	onWithdraw,
	onRepublish,
}: {
	readonly item: RealmPublicationItem;
	readonly mutationPending: boolean;
	readonly onWithdraw: () => void;
	readonly onRepublish: () => void;
}) {
	const { t } = useTranslation(["realms", "units"]);
	const copy = t.units.realmPublications;
	return (
		<Card appearance="outlined">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle>{item.title ?? copy.unnamedRealm}</CardTitle>
						<CardDescription>
							{item.effectivelyVisible
								? copy.effectivelyVisible
								: copy.notEffectivelyVisible}
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">
							{copy.publicationStates[item.publicationState]}
						</Badge>
						<Badge variant="outline">{copy.realmStatuses[item.status]}</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center justify-between gap-3">
				<div className="text-muted-foreground text-sm">
					{item.latestGovernance
						? copy.governanceReason({
								reason: t.realms.governanceReasons[
									item.latestGovernance.reasonCode
								],
							})
						: null}
				</div>
				<Button
					disabled={mutationPending}
					onClick={item.publicationState === "active" ? onWithdraw : onRepublish}
					type="button"
					variant={item.publicationState === "active" ? "outline" : "solid"}
				>
					{item.publicationState === "active" ? copy.withdraw : copy.republish}
				</Button>
			</CardContent>
		</Card>
	);
}

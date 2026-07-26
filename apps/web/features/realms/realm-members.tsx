"use client";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import {
	getApiRealmsByRealmIdMembersQueryKey,
	usePatchApiRealmsByRealmIdMembersByProfileId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Checkbox,
	Field,
	FieldLabel,
	IdentityAvatar,
	Input,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	NativeSelect,
	NativeSelectOption,
	Skeleton,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Ellipsis, KeyRound, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { profileHref } from "@/features/profiles/profile-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	filterRealmMembers,
	isMemberRole,
	isMemberState,
	MemberRoles,
	MemberStates,
	type MemberFilter,
	type MemberRole,
	type MemberState,
	type RealmMember,
} from "./model/realm-member-filters";
import { invalidateRealmDetails } from "./query";
import { realmMemberPermissionsHref } from "./routing/realm-settings-routes";

const EmptyMembers: readonly RealmMember[] = [];

export function RealmMembers({
	baseHref,
	realmId,
	members,
	pending,
	error,
	canManage,
}: {
	baseHref: string;
	realmId: string;
	members: readonly RealmMember[] | undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
	canManage: boolean;
}) {
	const { t } = useTranslation(["realms", "state"]);
	const queryClient = useQueryClient();
	const bulkUpdate = usePatchApiRealmsByRealmIdMembersByProfileId();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const [roleFilter, setRoleFilter] = useState<MemberFilter<MemberRole>>("all");
	const [stateFilter, setStateFilter] = useState<MemberFilter<MemberState>>("all");
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
	const [bulkRole, setBulkRole] = useState("");
	const [bulkState, setBulkState] = useState("");
	const [bulkPending, setBulkPending] = useState(false);
	const items = members ?? EmptyMembers;
	const filtered = useMemo(
		() => filterRealmMembers(items, deferredSearch, roleFilter, stateFilter),
		[deferredSearch, items, roleFilter, stateFilter],
	);
	const existingProfileIds = new Set(items.map((member) => member.profileId));
	const selectedProfileIds = [...selected].filter((profileId) =>
		existingProfileIds.has(profileId),
	);
	const visibleProfileIds = filtered.map((member) => member.profileId);
	const allVisibleSelected =
		visibleProfileIds.length > 0 &&
		visibleProfileIds.every((profileId) => selected.has(profileId));
	const someVisibleSelected = visibleProfileIds.some((profileId) => selected.has(profileId));

	const invalidateMembers = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdMembersQueryKey({ path: { realmId } }),
			}),
			invalidateRealmDetails(queryClient, realmId),
		]);
	};

	const applyBulkUpdate = async (body: { role: MemberRole } | { state: MemberState }) => {
		if (!selectedProfileIds.length || bulkPending) return;
		bulkUpdate.reset();
		setBulkPending(true);
		let completed = false;
		try {
			for (const profileId of selectedProfileIds)
				await bulkUpdate.mutateAsync({
					path: { realmId, profileId },
					body,
				});
			completed = true;
		} catch {
			// The mutation exposes its localized request failure below.
		} finally {
			try {
				await invalidateMembers();
			} finally {
				if (completed) setSelected(new Set());
				setBulkPending(false);
				setBulkRole("");
				setBulkState("");
			}
		}
	};

	const toggleAllVisible = (checked: boolean) => {
		setSelected((current) => {
			const next = new Set(current);
			for (const profileId of visibleProfileIds) {
				if (checked) next.add(profileId);
				else next.delete(profileId);
			}
			return next;
		});
	};

	return (
		<section className="grid gap-4">
			<div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_11rem_11rem]">
				<Field>
					<FieldLabel className="sr-only">{t.realms.membersView.searchLabel}</FieldLabel>
					<div className="relative">
						<Search
							aria-hidden
							className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							className="ps-9"
							onChange={(event) => setSearch(event.currentTarget.value)}
							placeholder={t.realms.membersView.searchPlaceholder}
							type="search"
							value={search}
						/>
					</div>
				</Field>
				<Field>
					<FieldLabel>{t.realms.membersView.roleFilter}</FieldLabel>
					<NativeSelect
						className="w-full"
						onChange={(event) => {
							const value = event.currentTarget.value;
							setRoleFilter(isMemberRole(value) ? value : "all");
						}}
						value={roleFilter}
					>
						<NativeSelectOption value="all">
							{t.realms.membersView.allRoles}
						</NativeSelectOption>
						{MemberRoles.map((role) => (
							<NativeSelectOption key={role} value={role}>
								{t.realms.roles[role]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel>{t.realms.membersView.stateFilter}</FieldLabel>
					<NativeSelect
						className="w-full"
						onChange={(event) => {
							const value = event.currentTarget.value;
							setStateFilter(isMemberState(value) ? value : "all");
						}}
						value={stateFilter}
					>
						<NativeSelectOption value="all">
							{t.realms.membersView.allStates}
						</NativeSelectOption>
						{MemberStates.map((state) => (
							<NativeSelectOption key={state} value={state}>
								{t.realms.memberStates[state]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</div>
			{pending ? (
				<Skeleton className="h-72 rounded-xl" />
			) : error ? (
				<RequestFailure error={error} />
			) : (
				<Card appearance="outlined" className="gap-0 overflow-hidden py-0">
					<CardContent className="p-0">
						<div className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border-weak bg-muted/32 px-4 py-2 sm:grid-cols-[auto_minmax(12rem,1fr)_9rem_9rem_2rem]">
							<Checkbox
								aria-label={t.realms.membersView.selectAll}
								checked={
									allVisibleSelected
										? true
										: someVisibleSelected
											? "indeterminate"
											: false
								}
								disabled={!canManage || !visibleProfileIds.length}
								onCheckedChange={(details) =>
									toggleAllVisible(details.checked === true)
								}
							/>
							{selectedProfileIds.length ? (
								<div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-4">
									<span className="me-auto text-sm font-medium">
										{t.realms.membersView.selectedCount({
											count: selectedProfileIds.length,
										})}
									</span>
									{canManage ? (
										<>
											<NativeSelect
												aria-label={t.realms.membersView.bulkRole}
												className="w-36"
												disabled={bulkPending}
												onChange={(event) => {
													const value = event.currentTarget.value;
													setBulkRole(value);
													if (isMemberRole(value))
														void applyBulkUpdate({ role: value });
												}}
												value={bulkRole}
											>
												<NativeSelectOption value="">
													{t.realms.membersView.bulkRole}
												</NativeSelectOption>
												{MemberRoles.map((role) => (
													<NativeSelectOption key={role} value={role}>
														{t.realms.roles[role]}
													</NativeSelectOption>
												))}
											</NativeSelect>
											<NativeSelect
												aria-label={t.realms.membersView.bulkState}
												className="w-36"
												disabled={bulkPending}
												onChange={(event) => {
													const value = event.currentTarget.value;
													setBulkState(value);
													if (isMemberState(value))
														void applyBulkUpdate({ state: value });
												}}
												value={bulkState}
											>
												<NativeSelectOption value="">
													{t.realms.membersView.bulkState}
												</NativeSelectOption>
												{MemberStates.map((state) => (
													<NativeSelectOption key={state} value={state}>
														{t.realms.memberStates[state]}
													</NativeSelectOption>
												))}
											</NativeSelect>
										</>
									) : null}
								</div>
							) : (
								<>
									<span className="text-sm font-medium">
										{t.realms.membersView.resultCount({
											visible: filtered.length,
											total: items.length,
										})}
									</span>
									<span className="hidden text-sm font-medium text-muted-foreground sm:block">
										{t.realms.memberRole}
									</span>
									<span className="hidden text-sm font-medium text-muted-foreground sm:block">
										{t.realms.memberState}
									</span>
									<span />
								</>
							)}
						</div>
						{filtered.length ? (
							<ul className="divide-y divide-border-weak">
								{filtered.map((member) => (
									<RealmMemberRow
										baseHref={baseHref}
										canManage={canManage}
										key={`${member.profileId}:${member.role}:${member.state}`}
										member={member}
										onChanged={invalidateMembers}
										onSelectedChange={(checked) =>
											setSelected((current) => {
												const next = new Set(current);
												if (checked) next.add(member.profileId);
												else next.delete(member.profileId);
												return next;
											})
										}
										realmId={realmId}
										selected={selected.has(member.profileId)}
									/>
								))}
							</ul>
						) : (
							<p className="px-5 py-12 text-center text-sm text-muted-foreground">
								{items.length ? t.realms.membersView.noMatches : t.state.empty}
							</p>
						)}
					</CardContent>
				</Card>
			)}
			<RequestFailure error={bulkUpdate.error} />
			{canManage ? (
				<p className="text-xs text-muted-foreground">
					{t.realms.memberAccess.autoSaveHint}
				</p>
			) : null}
		</section>
	);
}

function RealmMemberRow({
	baseHref,
	realmId,
	member,
	canManage,
	selected,
	onSelectedChange,
	onChanged,
}: {
	baseHref: string;
	realmId: string;
	member: RealmMember;
	canManage: boolean;
	selected: boolean;
	onSelectedChange: (checked: boolean) => void;
	onChanged: () => Promise<void>;
}) {
	const { t } = useTranslation(["realms"]);
	const update = usePatchApiRealmsByRealmIdMembersByProfileId();
	const [role, setRole] = useState(member.role);
	const [state, setState] = useState(member.state);
	const name = member.name ?? t.realms.unknownMember;
	const href = profileHref({
		id: member.profileId,
		slugAddress: member.slugAddress,
	});

	const updateRole = (next: MemberRole) => {
		const previous = role;
		setRole(next);
		update.mutate(
			{
				path: { realmId, profileId: member.profileId },
				body: { role: next },
			},
			{
				onError: () => setRole(previous),
				onSuccess: onChanged,
			},
		);
	};

	const updateState = (next: MemberState) => {
		const previous = state;
		setState(next);
		update.mutate(
			{
				path: { realmId, profileId: member.profileId },
				body: { state: next },
			},
			{
				onError: () => setState(previous),
				onSuccess: onChanged,
			},
		);
	};

	return (
		<li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(12rem,1fr)_9rem_9rem_2rem]">
			<Checkbox
				aria-label={t.realms.membersView.selectMember({ member: name })}
				checked={selected}
				disabled={!canManage}
				onCheckedChange={(details) => onSelectedChange(details.checked === true)}
			/>
			<div className="flex min-w-0 items-center gap-3">
				<IdentityAvatar
					avatar={member.avatar}
					className="size-10"
					fallback={name.slice(0, 1).toLocaleUpperCase()}
					imageAlt={name}
				/>
				<div className="min-w-0">
					<Link
						className="block truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
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
			</div>
			<div className="col-span-2 col-start-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:col-start-auto sm:block">
				<NativeSelect
					aria-label={t.realms.membersView.roleFor({ member: name })}
					className="w-full"
					disabled={!canManage || update.isPending}
					onChange={(event) => {
						const value = event.currentTarget.value;
						if (isMemberRole(value)) updateRole(value);
					}}
					value={role}
				>
					{MemberRoles.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{t.realms.roles[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
				<NativeSelect
					aria-label={t.realms.membersView.stateFor({ member: name })}
					className="w-full sm:hidden"
					disabled={!canManage || update.isPending}
					onChange={(event) => {
						const value = event.currentTarget.value;
						if (isMemberState(value)) updateState(value);
					}}
					value={state}
				>
					{MemberStates.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{t.realms.memberStates[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</div>
			<NativeSelect
				aria-label={t.realms.membersView.stateFor({ member: name })}
				className="hidden w-full sm:block"
				disabled={!canManage || update.isPending}
				onChange={(event) => {
					const value = event.currentTarget.value;
					if (isMemberState(value)) updateState(value);
				}}
				value={state}
			>
				{MemberStates.map((value) => (
					<NativeSelectOption key={value} value={value}>
						{t.realms.memberStates[value]}
					</NativeSelectOption>
				))}
			</NativeSelect>
			{canManage ? (
				<Menu>
					<MenuTrigger asChild>
						<Button
							aria-label={t.realms.membersView.actionsFor({ member: name })}
							className="size-8"
							size="icon-sm"
							variant="quiet"
						>
							<Ellipsis aria-hidden />
						</Button>
					</MenuTrigger>
					<MenuContent>
						<MenuItem asChild value="edit-permissions">
							<Link href={realmMemberPermissionsHref(baseHref, member.profileId)}>
								<KeyRound aria-hidden />
								{t.realms.membersView.editPermissions}
							</Link>
						</MenuItem>
					</MenuContent>
				</Menu>
			) : (
				<span />
			)}
			{update.error ? (
				<div className="col-span-2 col-start-2 sm:col-span-4">
					<RequestFailure error={update.error} />
				</div>
			) : null}
		</li>
	);
}

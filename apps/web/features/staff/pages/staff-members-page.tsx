"use client";

import {
	getApiStaffMembersQueryKey,
	getApiStaffProfilesQueryKey,
	useGetApiStaffAccessPolicy,
	useGetApiStaffMembers,
	useGetApiStaffProfiles,
	type GetApiStaffProfilesStatus200,
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
	Input,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { StaffAccessEditor, type StaffAccessProfile } from "../components/staff-access-editor";

export function StaffMembersPage() {
	const { t } = useTranslation(["staff"]);
	const policy = useGetApiStaffAccessPolicy();
	const members = useGetApiStaffMembers();
	const queryClient = useQueryClient();
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<StaffAccessProfile>();

	if (policy.isPending || members.isPending) return <QueryPending />;
	if (policy.isError || !policy.data)
		return <QueryFailure error={policy.error} retry={() => void policy.refetch()} />;
	if (members.isError || !members.data)
		return <QueryFailure error={members.error} retry={() => void members.refetch()} />;

	const select = (profile: StaffAccessProfile) => setSelected(profile);
	const onSaved = (profile: StaffAccessProfile) => {
		setSelected(profile);
		void queryClient.invalidateQueries({ queryKey: getApiStaffMembersQueryKey() });
		if (query)
			void queryClient.invalidateQueries({
				queryKey: getApiStaffProfilesQueryKey({ query: { query, limit: 20 } }),
			});
	};

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref="/staff"
				backLabel={t.staff.overview}
				description={t.staff.sections.members.description}
				link={Link}
				title={t.staff.sections.members.label}
			/>
			<div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]">
				<div className="grid content-start gap-4">
					<Card appearance="outlined">
						<CardHeader>
							<CardTitle>{t.staff.searchTitle}</CardTitle>
							<CardDescription>{t.staff.searchDescription}</CardDescription>
						</CardHeader>
						<CardContent>
							<form
								className="flex items-end gap-2"
								onSubmit={(event: FormEvent<HTMLFormElement>) => {
									event.preventDefault();
									const data = new FormData(event.currentTarget);
									setQuery(String(data.get("query") ?? "").trim());
								}}
							>
								<Field>
									<FieldLabel>{t.staff.searchTitle}</FieldLabel>
									<Input
										maxLength={200}
										name="query"
										placeholder={t.staff.searchPlaceholder}
										required
									/>
								</Field>
								<Button type="submit" variant="solid">
									{t.staff.search}
								</Button>
							</form>
						</CardContent>
					</Card>
					{query ? <StaffSearchResults onSelect={select} query={query} /> : null}
					<ProfileList
						empty={t.staff.noMembers}
						items={members.data.items}
						onSelect={select}
						title={t.staff.activeMembers}
					/>
				</div>
				<div>
					{selected ? (
						<StaffAccessEditor
							capabilities={policy.data.capabilities}
							key={`${selected.profileId}:${selected.grants
								.map((grant) => `${grant.capability}:${grant.expiresAt ?? ""}`)
								.sort()
								.join("|")}`}
							onSaved={onSaved}
							profile={selected}
						/>
					) : (
						<Card appearance="outlined">
							<CardContent className="py-10 text-center text-muted-foreground text-sm">
								{t.staff.selectProfile}
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</section>
	);
}

function StaffSearchResults({
	onSelect,
	query,
}: {
	onSelect: (profile: GetApiStaffProfilesStatus200["items"][number]) => void;
	query: string;
}) {
	const { t } = useTranslation(["staff"]);
	const search = useGetApiStaffProfiles({ query: { query, limit: 20 } });
	if (search.isPending) return <QueryPending />;
	if (search.isError || !search.data)
		return <QueryFailure error={search.error} retry={() => void search.refetch()} />;
	return (
		<ProfileList
			empty={t.staff.noSearchResults}
			items={search.data.items}
			onSelect={onSelect}
			title={t.staff.searchResults}
		/>
	);
}

function ProfileList<T extends StaffAccessProfile>({
	empty,
	items,
	onSelect,
	title,
}: {
	empty: string;
	items: readonly T[];
	onSelect: (profile: T) => void;
	title: string;
}) {
	const { t } = useTranslation(["staff"]);
	return (
		<Card appearance="outlined">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-2">
				{items.length ? (
					items.map((profile) => (
						<Button
							className="h-auto justify-between gap-3 px-3 py-2 text-start"
							key={profile.profileId}
							onClick={() => onSelect(profile)}
							type="button"
							variant="quiet"
						>
							<span className="min-w-0">
								<span className="block truncate font-medium">
									{profile.name ?? profile.email}
								</span>
								<span className="block truncate text-muted-foreground text-xs">
									{profile.email}
								</span>
							</span>
							<Badge variant={profile.isSuperAdmin ? "success" : "secondary"}>
								{profile.isSuperAdmin
									? t.staff.superAdmin
									: profile.grants.length
										? t.staff.customAccess
										: t.staff.noAccess}
							</Badge>
						</Button>
					))
				) : (
					<p className="text-muted-foreground text-sm">{empty}</p>
				)}
			</CardContent>
		</Card>
	);
}

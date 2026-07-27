"use client";

import {
	getApiPlatformAccessProfilesQueryKey,
	useGetApiPlatformAccessPolicy,
	useGetApiPlatformAccessProfiles,
	type GetApiPlatformAccessProfilesStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
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
import {
	PlatformAccessEditor,
	type PlatformAccessProfile,
} from "../components/platform-access-editor";
import { useConsoleWorkspace } from "../components/console-workspace";

export function ConsoleAccessPage() {
	const { t } = useTranslation(["console", "errors"]);
	const { canManageAccess, canReadAccess } = useConsoleWorkspace();
	const policy = useGetApiPlatformAccessPolicy({
		query: { enabled: canReadAccess },
	});
	const profiles = useGetApiPlatformAccessProfiles(
		{ query: { limit: 100 } },
		{ query: { enabled: canReadAccess } },
	);
	const queryClient = useQueryClient();
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<PlatformAccessProfile>();

	if (!canReadAccess) return <p className="text-destructive text-sm">{t.errors.forbidden}</p>;
	if (policy.isPending || profiles.isPending) return <QueryPending />;
	if (policy.isError || !policy.data)
		return <QueryFailure error={policy.error} retry={() => void policy.refetch()} />;
	if (profiles.isError || !profiles.data)
		return <QueryFailure error={profiles.error} retry={() => void profiles.refetch()} />;

	const onSaved = (profile: PlatformAccessProfile) => {
		setSelected(profile);
		void queryClient.invalidateQueries({
			queryKey: getApiPlatformAccessProfilesQueryKey({ query: { limit: 100 } }),
		});
		if (query)
			void queryClient.invalidateQueries({
				queryKey: getApiPlatformAccessProfilesQueryKey({
					query: { query, limit: 20 },
				}),
			});
	};

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref="/console"
				backLabel={t.console.overview}
				description={t.console.sections.access.description}
				link={Link}
				title={t.console.sections.access.label}
			/>
			<div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.6fr)]">
				<div className="grid content-start gap-4">
					<Card appearance="outlined">
						<CardHeader>
							<CardTitle>{t.console.access.searchTitle}</CardTitle>
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
									<FieldLabel>{t.console.access.searchLabel}</FieldLabel>
									<Input
										maxLength={200}
										name="query"
										placeholder={t.console.access.searchPlaceholder}
										required
									/>
								</Field>
								<Button type="submit" variant="solid">
									{t.console.access.search}
								</Button>
							</form>
						</CardContent>
					</Card>

					{query ? <ProfileSearchResults onSelect={setSelected} query={query} /> : null}
					<ProfileList
						empty={t.console.access.noProfiles}
						items={profiles.data.items}
						onSelect={setSelected}
						selectedProfileId={selected?.profileId}
						title={t.console.access.activeProfiles}
					/>
				</div>
				<div>
					{selected ? (
						<PlatformAccessEditor
							canManage={canManageAccess}
							capabilities={policy.data.capabilities}
							key={`${selected.profileId}:${selected.revision}`}
							onSaved={onSaved}
							profile={selected}
						/>
					) : (
						<Card appearance="outlined">
							<CardContent className="py-12 text-center text-muted-foreground text-sm">
								{t.console.access.selectProfile}
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</section>
	);
}

function ProfileSearchResults({
	onSelect,
	query,
}: {
	readonly onSelect: (profile: PlatformAccessProfile) => void;
	readonly query: string;
}) {
	const { t } = useTranslation(["console"]);
	const search = useGetApiPlatformAccessProfiles({ query: { query, limit: 20 } });
	if (search.isPending) return <QueryPending />;
	if (search.isError || !search.data)
		return <QueryFailure error={search.error} retry={() => void search.refetch()} />;
	return (
		<ProfileList
			empty={t.console.access.noSearchResults}
			items={search.data.items}
			onSelect={onSelect}
			title={t.console.access.searchResults}
		/>
	);
}

function ProfileList({
	empty,
	items,
	onSelect,
	selectedProfileId,
	title,
}: {
	readonly empty: string;
	readonly items: readonly GetApiPlatformAccessProfilesStatus200["items"][number][];
	readonly onSelect: (profile: PlatformAccessProfile) => void;
	readonly selectedProfileId?: string;
	readonly title: string;
}) {
	const { t } = useTranslation(["console"]);
	return (
		<Card appearance="outlined">
			<CardHeader className="border-b">
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-1 p-2">
				{items.length ? (
					items.map((profile) => (
						<Button
							aria-pressed={selectedProfileId === profile.profileId}
							className="h-auto justify-between gap-3 px-3 py-2 text-start"
							key={profile.profileId}
							onClick={() => onSelect(profile)}
							type="button"
							variant={
								selectedProfileId === profile.profileId ? "secondary" : "quiet"
							}
						>
							<span className="min-w-0">
								<span className="block truncate font-medium">
									{profile.name ?? profile.email}
								</span>
								<span className="block truncate text-muted-foreground text-xs">
									{profile.email}
								</span>
							</span>
							<Badge variant={profile.grants.length ? "secondary" : "outline"}>
								{t.console.access.capabilityCount({
									count: profile.grants.length,
								})}
							</Badge>
						</Button>
					))
				) : (
					<p className="p-3 text-muted-foreground text-sm">{empty}</p>
				)}
			</CardContent>
		</Card>
	);
}

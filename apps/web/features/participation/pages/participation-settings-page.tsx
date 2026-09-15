"use client";

import { ContentLanguageValues, isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import {
	useCreateManagedOrganization,
	useGetCurrentParticipation,
	useListManagedOrganizations,
	useListManagedEntityGrants,
	useIssueParticipationGrant,
	useRevokeParticipationGrant,
	useSelectParticipation,
	useGetApiEntitiesByIdProfile,
	type ListManagedEntityGrantsStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	Button,
	Card,
	CardContent,
	Field,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { AppLink } from "@/features/application-shell/components/app-link";
import { EntityPresentationEditor } from "../components/entity-presentation-editor";
import { isUnitId } from "@/features/units/model/unit-id";
import {
	createParticipationClient,
	type ParticipationSelection,
} from "../data/participation-client";
import { ServiceIdentities } from "../components/service-identities";

type NamedSelection = ParticipationSelection & { name: string };

export function ParticipationSettingsPage() {
	const { t } = useTranslation(["settings", "ui", "actions", "locale", "units"]);
	const client = useQueryClient();
	const languages = useLocalizationLanguages();
	const [language, setLanguage] = useState<ContentLanguage>(languages[0] ?? "en");
	const [afterId, setAfterId] = useState<string>();
	const [name, setName] = useState("");
	const [selected, setSelected] = useState<NamedSelection>();
	const self = useGetCurrentParticipation();
	const organizations = useListManagedOrganizations({ query: { afterId } });
	const create = useCreateManagedOrganization();
	const select = useSelectParticipation();
	async function createOrganization(event: FormEvent) {
		event.preventDefault();
		try {
			await create.mutateAsync({ body: { name: name.trim(), language } });
			setName("");
			setAfterId(undefined);
			await client.invalidateQueries();
		} catch {
			/* The error stays next to the form. */
		}
	}
	async function choose(selection: NamedSelection) {
		try {
			const result = await select.mutateAsync({
				body: {
					actingEntityId: selection.actingEntityId,
					...(selection.grant ? { grant: selection.grant } : {}),
					capability: "entity.security",
					target: { owner: "entity", id: selection.actingEntityId },
				},
			});
			setSelected({ ...result, name: selection.name });
		} catch {
			/* Selection changes only after the server confirms the exact authority. */
		}
	}
	if (self.isPending) return <QueryPending />;
	if (self.isError) return <QueryFailure error={self.error} retry={() => void self.refetch()} />;
	const current = selected ?? {
		actingEntityId: self.data.entity.id,
		grant: null,
		name: self.data.entity.name ?? t.settings.participation.currentAccount,
	};
	return (
		<section className="grid max-w-4xl gap-6">
			<PageHeading
				title={t.settings.participation.title}
				description={t.settings.participation.description}
			/>
			<Card>
				<CardContent className="grid gap-4 p-5">
					<h2 className="font-semibold">{t.settings.participation.organizations}</h2>
					<Button variant="outline" onClick={() => setSelected(undefined)}>
						{t.settings.participation.currentAccount}
					</Button>
					{organizations.isPending ? (
						<QueryPending />
					) : organizations.isError ? (
						<QueryFailure error={organizations.error} retry={() => void organizations.refetch()} />
					) : (
						organizations.data.items.map((organization) => (
							<div className="flex items-center justify-between gap-3" key={organization.grantId}>
								<AppLink href={`/user/${organization.entityId}`}>
									{organization.name ?? t.ui.unnamed}
								</AppLink>
								<Button
									variant="outline"
									disabled={select.isPending}
									onClick={() =>
										void choose({
											actingEntityId: organization.entityId,
											grant: { id: organization.grantId, revision: organization.revision },
											name: organization.name ?? t.ui.unnamed,
										})
									}
								>
									{t.settings.participation.manage}
								</Button>
							</div>
						))
					)}
					{organizations.data?.nextCursor ? (
						<Button
							variant="quiet"
							onClick={() => setAfterId(organizations.data.nextCursor ?? undefined)}
						>
							{t.actions.loadMore}
						</Button>
					) : null}
					<RequestFailure error={select.error} />
					<form
						className="grid gap-3 border-t pt-4"
						onSubmit={(event) => void createOrganization(event)}
					>
						<Field>
							<FieldLabel htmlFor="organization-name">{t.settings.participation.name}</FieldLabel>
							<Input
								id="organization-name"
								value={name}
								required
								maxLength={120}
								onChange={(event) => setName(event.currentTarget.value)}
							/>
						</Field>
						<NativeSelect
							aria-label={t.units.contentLanguages.controlLabel}
							value={language}
							onChange={(event) => {
								if (isContentLanguage(event.currentTarget.value))
									setLanguage(event.currentTarget.value);
							}}
						>
							{ContentLanguageValues.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{t.locale.contentLanguages[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<Button type="submit" isLoading={create.isPending} disabled={!name.trim()}>
							{t.settings.participation.createOrganization}
						</Button>
						<RequestFailure error={create.error} />
					</form>
				</CardContent>
			</Card>
			<ManagedIdentity
				key={`${current.actingEntityId}:${current.grant?.id ?? "self"}:${current.grant?.revision ?? 0}`}
				selection={current}
				selfEntityId={self.data.entity.id}
			/>
			<ServiceIdentities />
		</section>
	);
}

type ManagedGrant = ListManagedEntityGrantsStatus200["items"][number];
const EntityPermissions = ["entity.publish", "entity.security"] as const;
type EntityPermission = (typeof EntityPermissions)[number];

function ManagedIdentity({
	selection,
	selfEntityId,
}: {
	selection: NamedSelection;
	selfEntityId: string;
}) {
	const { t, locale } = useTranslation(["settings", "actions", "collections", "ui"]);
	const queryClient = useQueryClient();
	const request = useMemo(() => createParticipationClient(selection), [selection]);
	const [afterId, setAfterId] = useState<string>();
	const [recipient, setRecipient] = useState("");
	const [capability, setCapability] = useState<EntityPermission>("entity.publish");
	const permissionChoices = EntityPermissions;
	const [expiresAt, setExpiresAt] = useState("");
	const [revoking, setRevoking] = useState<ManagedGrant>();
	const [editSelection, setEditSelection] = useState<ParticipationSelection>();
	const grants = useListManagedEntityGrants(
		{ path: { id: selection.actingEntityId }, query: { afterId } },
		{
			client: { client: request },
			query: { queryKey: ["managed-identity-grants", selection, afterId] },
		},
	);
	const recipientProfile = useGetApiEntitiesByIdProfile(
		{ path: { id: recipient } },
		{ query: { enabled: isUnitId(recipient) } },
	);
	const issue = useIssueParticipationGrant({ client: { client: request } });
	const revoke = useRevokeParticipationGrant({ client: { client: request } });
	const select = useSelectParticipation();
	async function issueGrant(event: FormEvent) {
		event.preventDefault();
		if (!isUnitId(recipient) || !recipientProfile.data) return;
		try {
			await issue.mutateAsync({
				body: {
					recipient: { kind: "account", entityId: recipient },
					actingEntityId: selection.actingEntityId,
					target: { owner: "entity", id: selection.actingEntityId },
					capability,
					...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
				},
			});
			setRecipient("");
			setAfterId(undefined);
			await queryClient.invalidateQueries();
		} catch {
			/* The server owns admission and grantability. */
		}
	}
	async function revokeGrant() {
		if (!revoking) return;
		try {
			await revoke.mutateAsync({
				path: { id: revoking.id },
				body: { expectedRevision: revoking.revision },
			});
			setRevoking(undefined);
			await queryClient.invalidateQueries();
		} catch {
			/* Keep the exact failed grant visible for review. */
		}
	}
	async function editPresentation(grant: ManagedGrant | null) {
		try {
			const result = await select.mutateAsync({
				body: {
					actingEntityId: selection.actingEntityId,
					...(grant ? { grant: { id: grant.id, revision: grant.revision } } : {}),
					capability: "entity.publish",
					target: { owner: "entity", id: selection.actingEntityId },
				},
			});
			setEditSelection(result);
		} catch {
			/* No editing client is admitted on failure. */
		}
	}
	return (
		<Card>
			<CardContent className="grid gap-4 p-5">
				<h2 className="font-semibold">
					{t.settings.participation.identity}: {selection.name}
				</h2>
				{selection.actingEntityId === selfEntityId ? (
					<Button variant="outline" onClick={() => void editPresentation(null)}>
						{t.ui.edit}
					</Button>
				) : null}
				{grants.isPending ? (
					<QueryPending />
				) : grants.isError ? (
					<QueryFailure error={grants.error} retry={() => void grants.refetch()} />
				) : (
					<>
						<h3>{t.settings.participation.grants}</h3>
						{!grants.data.items.length ? (
							<p>{t.settings.participation.noGrants}</p>
						) : (
							grants.data.items.map((grant) => (
								<div
									className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
									key={grant.id}
								>
									<div>
										<p>
											{grant.recipient
												? (grant.recipientName ?? t.ui.unnamed)
												: t.settings.participation.erasedRecipient}
										</p>
										<p className="text-sm text-muted-foreground">
											{t.settings.participation.capabilities[grant.capability]}
										</p>
										<p className="text-sm">
											{t.settings.participation.scope}: <code>{grant.target.id}</code>
										</p>
										{grant.proposal ? (
											<p className="text-sm">
												{t.settings.participation.sourceChange}:{" "}
												<code>{grant.proposal.proposalId}</code>
											</p>
										) : null}
										{grant.expiresAt ? (
											<time className="text-sm" dateTime={grant.expiresAt}>
												{new Intl.DateTimeFormat(locale.target, {
													dateStyle: "medium",
													timeStyle: "short",
												}).format(new Date(grant.expiresAt))}
											</time>
										) : (
											<p className="text-sm">{t.settings.participation.noExpiry}</p>
										)}
									</div>
									{grant.revokedAt ? (
										<span>{t.settings.participation.revoked}</span>
									) : (
										<div className="flex gap-2">
											{grant.capability === "entity.publish" &&
											grant.recipient?.kind === "account" &&
											grant.recipient.entityId === selfEntityId ? (
												<Button variant="outline" onClick={() => void editPresentation(grant)}>
													{t.ui.edit}
												</Button>
											) : null}
											<Button variant="outline" onClick={() => setRevoking(grant)}>
												{t.settings.participation.revoke}
											</Button>
										</div>
									)}
								</div>
							))
						)}
						{grants.data.nextCursor ? (
							<Button
								variant="quiet"
								onClick={() => setAfterId(grants.data.nextCursor ?? undefined)}
							>
								{t.actions.loadMore}
							</Button>
						) : null}
					</>
				)}
				<RequestFailure error={select.error} />
				{editSelection ? <SelectedPresentation selection={editSelection} /> : null}
				<form className="grid gap-3 border-t pt-4" onSubmit={(event) => void issueGrant(event)}>
					<Field>
						<FieldLabel htmlFor="grant-recipient">{t.settings.participation.recipient}</FieldLabel>
						<Input
							id="grant-recipient"
							required
							value={recipient}
							onChange={(event) => setRecipient(event.currentTarget.value.trim())}
						/>
						{recipientProfile.data ? <p>{recipientProfile.data.name ?? t.ui.unnamed}</p> : null}
						<RequestFailure error={recipientProfile.error} />
					</Field>
					<Field>
						<FieldLabel htmlFor="grant-permission">
							{t.settings.participation.permission}
						</FieldLabel>
						<NativeSelect
							id="grant-permission"
							value={capability}
							onChange={(event) => {
								const value = permissionChoices.find(
									(value) => value === event.currentTarget.value,
								);
								if (value) setCapability(value);
							}}
						>
							{permissionChoices.map((value) => (
								<NativeSelectOption key={value} value={value}>
									{t.settings.participation.capabilities[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="grant-expiry">{t.settings.participation.expiresAt}</FieldLabel>
						<Input
							id="grant-expiry"
							type="datetime-local"
							value={expiresAt}
							onChange={(event) => setExpiresAt(event.currentTarget.value)}
						/>
						{!expiresAt ? (
							<p className="text-sm text-muted-foreground">{t.settings.participation.noExpiry}</p>
						) : null}
					</Field>
					<Button
						type="submit"
						isLoading={issue.isPending}
						disabled={!recipientProfile.data || !isUnitId(recipient)}
					>
						{t.settings.participation.grantAccess}
					</Button>
					<RequestFailure error={issue.error} />
				</form>
				<AlertDialog
					open={Boolean(revoking)}
					onOpenChange={({ open }) => {
						if (!open) setRevoking(undefined);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t.settings.participation.revoke}</AlertDialogTitle>
							<AlertDialogDescription>
								{revoking?.capability === "entity.security"
									? t.settings.participation.securityWarning
									: t.settings.participation.revokeWarning}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<RequestFailure error={revoke.error} />
						<AlertDialogFooter>
							<AlertDialogCancel>{t.collections.cancel}</AlertDialogCancel>
							<Button
								variant="destructive"
								isLoading={revoke.isPending}
								onClick={() => void revokeGrant()}
							>
								{t.settings.participation.revoke}
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</CardContent>
		</Card>
	);
}

function SelectedPresentation({ selection }: { selection: ParticipationSelection }) {
	const languages = useLocalizationLanguages();
	const { t } = useTranslation(["locale", "units"]);
	const [language, setLanguage] = useState<ContentLanguage>(languages[0] ?? "en");
	const profile = useGetApiEntitiesByIdProfile({
		path: { id: selection.actingEntityId },
		query: { localizationLanguages: [language] },
	});
	const client = useMemo(() => createParticipationClient(selection), [selection]);
	return (
		<div className="grid gap-4 border-t pt-4">
			<NativeSelect
				aria-label={t.units.contentLanguages.controlLabel}
				value={language}
				onChange={(event) => {
					if (isContentLanguage(event.currentTarget.value)) setLanguage(event.currentTarget.value);
				}}
			>
				{ContentLanguageValues.map((value) => (
					<NativeSelectOption key={value} value={value}>
						{t.locale.contentLanguages[value]}
					</NativeSelectOption>
				))}
			</NativeSelect>
			{profile.isPending ? (
				<QueryPending />
			) : profile.isError ? (
				<QueryFailure error={profile.error} retry={() => void profile.refetch()} />
			) : (
				<EntityPresentationEditor
					key={`${selection.actingEntityId}:${language}`}
					entity={profile.data}
					language={language}
					client={client}
				/>
			)}
		</div>
	);
}

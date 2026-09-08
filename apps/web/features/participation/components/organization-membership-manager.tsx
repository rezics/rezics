"use client";

import {
	useGetApiEntitiesByIdProfile,
	useListManagedOrganizations,
	useListManagedOrganizationMembers,
	useListManagedOrganizationInvitations,
	useInviteOrganizationMember,
	useCancelOrganizationMembershipInvitation,
	useRemoveOrganizationMember,
	useSelectParticipation,
	type ListManagedOrganizationMembersStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Card,
	CardContent,
	Field,
	FieldLabel,
	Input,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { AppLink } from "@/features/application-shell/components/app-link";
import { isUnitId } from "@/features/units/model/unit-id";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	createParticipationClient,
	type ParticipationSelection,
} from "../data/participation-client";

type NamedSelection = ParticipationSelection & { name: string };
type Member = ListManagedOrganizationMembersStatus200["items"][number];

export function OrganizationMembershipManager() {
	const { t } = useTranslation(["settings", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const [selected, setSelected] = useState<NamedSelection>();
	const organizations = useListManagedOrganizations({
		query: { capability: "entity.membership", afterId: cursors.at(-1) },
	});
	const select = useSelectParticipation();
	async function choose(selection: NamedSelection) {
		if (!selection.grant) return;
		try {
			const result = await select.mutateAsync({
				body: {
					actingEntityId: selection.actingEntityId,
					grant: selection.grant,
					capability: "entity.membership",
					target: { owner: "entity", id: selection.actingEntityId },
				},
			});
			setSelected({ ...result, name: selection.name });
		} catch {
			/* Invalid authority never opens the manager's scoped client. */
		}
	}
	return (
		<Card>
			<CardContent className="grid gap-4 p-5">
				<h2 className="font-semibold">{t.settings.memberships.managing}</h2>
				{organizations.isPending ? (
					<QueryPending />
				) : organizations.isError ? (
					<QueryFailure error={organizations.error} retry={() => void organizations.refetch()} />
				) : !organizations.data.items.length ? (
					<p>{t.settings.memberships.emptyManagement}</p>
				) : (
					organizations.data.items.map((organization) => (
						<div className="flex items-center justify-between gap-3" key={organization.grantId}>
							<AppLink href={`/user/${organization.entityId}`}>
								{organization.name ?? t.ui.unnamed}
							</AppLink>
							<Button
								variant="outline"
								isLoading={select.isPending}
								onClick={() =>
									void choose({
										actingEntityId: organization.entityId,
										name: organization.name ?? t.ui.unnamed,
										grant: { id: organization.grantId, revision: organization.revision },
									})
								}
							>
								{t.settings.memberships.members}
							</Button>
						</div>
					))
				)}
				<div className="flex gap-2">
					{cursors.length ? (
						<Button variant="outline" onClick={() => setCursors((current) => current.slice(0, -1))}>
							{t.ui.shelf.previous}
						</Button>
					) : null}
					{organizations.data?.nextCursor ? (
						<Button
							variant="outline"
							onClick={() => {
								const cursor = organizations.data.nextCursor;
								if (cursor) setCursors((current) => [...current, cursor]);
							}}
						>
							{t.ui.shelf.next}
						</Button>
					) : null}
				</div>
				<RequestFailure error={select.error} />
				{selected ? (
					<MembershipManager
						key={`${selected.actingEntityId}:${selected.grant?.id}:${selected.grant?.revision}`}
						selection={selected}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

function MembershipManager({ selection }: { selection: NamedSelection }) {
	const { t, locale } = useTranslation(["settings", "collections", "ui"]);
	const cache = useQueryClient();
	const client = useMemo(() => createParticipationClient(selection), [selection]);
	const [memberCursors, setMemberCursors] = useState<string[]>([]);
	const [invitationCursors, setInvitationCursors] = useState<string[]>([]);
	const [recipient, setRecipient] = useState("");
	const [removing, setRemoving] = useState<Member>();
	const [expiryInvalid, setExpiryInvalid] = useState(false);
	const [expiresAt, setExpiresAt] = useState(() => {
		const deadline = new Date(Date.now() + 7 * 86_400_000);
		return new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60_000)
			.toISOString()
			.slice(0, 16);
	});
	const path = { organizationEntityId: selection.actingEntityId };
	const members = useListManagedOrganizationMembers(
		{ path, query: { afterId: memberCursors.at(-1) } },
		{
			client: { client },
			query: { queryKey: ["organization-members", selection, memberCursors.at(-1)] },
		},
	);
	const invitations = useListManagedOrganizationInvitations(
		{ path, query: { afterId: invitationCursors.at(-1) } },
		{
			client: { client },
			query: {
				queryKey: ["organization-membership-invitations", selection, invitationCursors.at(-1)],
			},
		},
	);
	const recipientProfile = useGetApiEntitiesByIdProfile(
		{ path: { id: recipient } },
		{ query: { enabled: isUnitId(recipient) } },
	);
	const invite = useInviteOrganizationMember({ client: { client } });
	const cancel = useCancelOrganizationMembershipInvitation({ client: { client } });
	const remove = useRemoveOrganizationMember({ client: { client } });
	const pending = invite.isPending || cancel.isPending || remove.isPending;
	async function submit(event: FormEvent) {
		event.preventDefault();
		const deadline = new Date(expiresAt);
		const validExpiry =
			Number.isFinite(deadline.getTime()) &&
			deadline.getTime() > Date.now() &&
			deadline.getTime() <= Date.now() + 30 * 86_400_000;
		setExpiryInvalid(!validExpiry);
		if (!validExpiry || !recipientProfile.data || !isUnitId(recipient)) return;
		try {
			await invite.mutateAsync({
				path,
				body: { recipientEntityId: recipient, expiresAt: deadline.toISOString() },
			});
			setRecipient("");
			setInvitationCursors([]);
			await cache.invalidateQueries();
		} catch {
			await cache.invalidateQueries();
		}
	}
	async function cancelInvitation(invitationId: string, expectedRevision: number) {
		try {
			await cancel.mutateAsync({ path: { ...path, invitationId }, body: { expectedRevision } });
			await cache.invalidateQueries();
		} catch {
			await cache.invalidateQueries();
		}
	}
	async function removeMember() {
		if (!removing) return;
		try {
			await remove.mutateAsync({
				path: { ...path, memberEntityId: removing.memberEntityId },
				body: { expectedRevision: removing.revision },
			});
			setRemoving(undefined);
			setMemberCursors([]);
			await cache.invalidateQueries();
		} catch {
			await cache.invalidateQueries();
		}
	}
	return (
		<div className="grid gap-5 border-t pt-5">
			<h3 className="font-semibold">{selection.name}</h3>
			{members.isPending ? (
				<QueryPending />
			) : members.isError ? (
				<QueryFailure error={members.error} retry={() => void members.refetch()} />
			) : !members.data.items.length ? (
				<p>{t.settings.memberships.emptyMembers}</p>
			) : (
				members.data.items.map((member) => (
					<div className="flex items-center justify-between gap-3" key={member.memberEntityId}>
						<AppLink href={`/user/${member.memberEntityId}`}>
							{member.memberName ?? t.ui.unnamed}
						</AppLink>
						<Button variant="outline" disabled={pending} onClick={() => setRemoving(member)}>
							{t.settings.memberships.remove}
						</Button>
					</div>
				))
			)}
			<div className="flex gap-2">
				{memberCursors.length ? (
					<Button
						variant="outline"
						onClick={() => setMemberCursors((current) => current.slice(0, -1))}
					>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{members.data?.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const cursor = members.data.nextCursor;
							if (cursor) setMemberCursors((current) => [...current, cursor]);
						}}
					>
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
			<form className="grid gap-3 border-t pt-4" onSubmit={(event) => void submit(event)}>
				<Field>
					<FieldLabel htmlFor="membership-recipient">
						{t.settings.participation.recipient}
					</FieldLabel>
					<Input
						id="membership-recipient"
						required
						value={recipient}
						onChange={(event) => setRecipient(event.currentTarget.value.trim())}
					/>
					<p className="text-sm text-muted-foreground">{t.settings.memberships.recipientHint}</p>
					{recipientProfile.data ? <p>{recipientProfile.data.name ?? t.ui.unnamed}</p> : null}
					<RequestFailure error={recipientProfile.error} />
				</Field>
				<Field>
					<FieldLabel htmlFor="membership-expiry">{t.settings.participation.expiresAt}</FieldLabel>
					<Input
						id="membership-expiry"
						required
						type="datetime-local"
						aria-invalid={expiryInvalid}
						value={expiresAt}
						onChange={(event) => {
							setExpiresAt(event.currentTarget.value);
							setExpiryInvalid(false);
						}}
					/>
					<p className="text-sm text-muted-foreground">{t.settings.memberships.expiryHint}</p>
				</Field>
				<Button type="submit" disabled={pending || !recipientProfile.data || !isUnitId(recipient)}>
					{t.settings.memberships.invite}
				</Button>
				<RequestFailure error={invite.error} />
			</form>
			<h3 className="font-semibold">{t.settings.memberships.invitations}</h3>
			{invitations.isPending ? (
				<QueryPending />
			) : invitations.isError ? (
				<QueryFailure error={invitations.error} retry={() => void invitations.refetch()} />
			) : (
				invitations.data.items.map((invitation) => (
					<div
						className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
						key={invitation.id}
					>
						<div className="grid gap-1">
							<AppLink href={`/user/${invitation.recipientEntityId}`}>
								{invitation.recipientName ?? t.ui.unnamed}
							</AppLink>
							<span>{t.settings.memberships.states[invitation.state]}</span>
							<time className="text-sm text-muted-foreground" dateTime={invitation.expiresAt}>
								{new Intl.DateTimeFormat(locale.target, {
									dateStyle: "medium",
									timeStyle: "short",
								}).format(new Date(invitation.expiresAt))}
							</time>
						</div>
						{invitation.state === "pending" ? (
							<Button
								variant="outline"
								disabled={pending}
								onClick={() => void cancelInvitation(invitation.id, invitation.revision)}
							>
								{t.settings.memberships.cancelInvitation}
							</Button>
						) : null}
					</div>
				))
			)}
			<div className="flex gap-2">
				{invitationCursors.length ? (
					<Button
						variant="outline"
						onClick={() => setInvitationCursors((current) => current.slice(0, -1))}
					>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{invitations.data?.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const cursor = invitations.data.nextCursor;
							if (cursor) setInvitationCursors((current) => [...current, cursor]);
						}}
					>
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
			<RequestFailure error={cancel.error} />
			<AlertDialog
				open={removing !== undefined}
				onOpenChange={({ open }) => {
					if (!open) setRemoving(undefined);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{removing?.memberName ?? t.settings.memberships.remove}
						</AlertDialogTitle>
						<AlertDialogDescription>{t.settings.memberships.removePrompt}</AlertDialogDescription>
					</AlertDialogHeader>
					<RequestFailure error={remove.error} />
					<AlertDialogFooter>
						<AlertDialogCancel>{t.collections.cancel}</AlertDialogCancel>
						<Button
							variant="destructive"
							isLoading={remove.isPending}
							onClick={() => void removeMember()}
						>
							{t.settings.memberships.remove}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

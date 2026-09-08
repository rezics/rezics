"use client";

import {
	useListOwnOrganizationMembershipInvitations,
	useListOwnOrganizationMemberships,
	useAcceptOrganizationMembershipInvitation,
	useDeclineOrganizationMembershipInvitation,
	useLeaveOrganizationMembership,
	type ListOwnOrganizationMembershipsStatus200,
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
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

type Membership = ListOwnOrganizationMembershipsStatus200["items"][number];

export function OwnMemberships() {
	const { t, locale } = useTranslation(["settings", "collections", "ui"]);
	const cache = useQueryClient();
	const [invitationCursors, setInvitationCursors] = useState<string[]>([]);
	const [memberCursors, setMemberCursors] = useState<string[]>([]);
	const [leaving, setLeaving] = useState<Membership>();
	const invitations = useListOwnOrganizationMembershipInvitations({
		query: { afterId: invitationCursors.at(-1) },
	});
	const memberships = useListOwnOrganizationMemberships({
		query: { afterId: memberCursors.at(-1) },
	});
	const accept = useAcceptOrganizationMembershipInvitation();
	const decline = useDeclineOrganizationMembershipInvitation();
	const leave = useLeaveOrganizationMembership();
	const pending = accept.isPending || decline.isPending || leave.isPending;
	async function respond(
		invitationId: string,
		expectedRevision: number,
		action: "accept" | "decline",
	) {
		try {
			const input = { path: { invitationId }, body: { expectedRevision } };
			if (action === "accept") await accept.mutateAsync(input);
			else await decline.mutateAsync(input);
			setInvitationCursors([]);
			setMemberCursors([]);
			await cache.invalidateQueries();
		} catch {
			await cache.invalidateQueries();
		}
	}
	async function leaveMembership() {
		if (!leaving) return;
		try {
			await leave.mutateAsync({
				path: { organizationEntityId: leaving.organizationEntityId },
				body: { expectedRevision: leaving.revision },
			});
			setLeaving(undefined);
			setMemberCursors([]);
			await cache.invalidateQueries();
		} catch {
			await cache.invalidateQueries();
		}
	}
	return (
		<>
			<Card>
				<CardContent className="grid gap-4 p-5">
					<h2 className="font-semibold">{t.settings.memberships.invitations}</h2>
					{invitations.isPending ? (
						<QueryPending />
					) : invitations.isError ? (
						<QueryFailure error={invitations.error} retry={() => void invitations.refetch()} />
					) : !invitations.data.items.length ? (
						<p>{t.settings.memberships.emptyInvitations}</p>
					) : (
						<>
							<p className="text-sm text-muted-foreground">{t.settings.memberships.acceptPrompt}</p>
							{invitations.data.items.map((invitation) => (
								<div
									className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
									key={invitation.id}
								>
									<div className="grid gap-1">
										<AppLink href={`/user/${invitation.organizationEntityId}`}>
											{invitation.organizationName ?? t.ui.unnamed}
										</AppLink>
										<span>{t.settings.memberships.states[invitation.state]}</span>
										<time className="text-sm text-muted-foreground" dateTime={invitation.expiresAt}>
											{new Intl.DateTimeFormat(locale.target, {
												dateStyle: "medium",
												timeStyle: "short",
											}).format(new Date(invitation.expiresAt))}
										</time>
									</div>
									<div className="flex gap-2">
										{invitation.state === "pending" ? (
											<Button
												disabled={pending}
												onClick={() => void respond(invitation.id, invitation.revision, "accept")}
											>
												{t.settings.memberships.accept}
											</Button>
										) : null}
										<Button
											variant="outline"
											disabled={pending}
											onClick={() => void respond(invitation.id, invitation.revision, "decline")}
										>
											{t.settings.memberships.decline}
										</Button>
									</div>
								</div>
							))}
						</>
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
					<RequestFailure error={accept.error ?? decline.error} />
				</CardContent>
			</Card>
			<Card>
				<CardContent className="grid gap-4 p-5">
					<h2 className="font-semibold">{t.settings.memberships.organizations}</h2>
					{memberships.isPending ? (
						<QueryPending />
					) : memberships.isError ? (
						<QueryFailure error={memberships.error} retry={() => void memberships.refetch()} />
					) : !memberships.data.items.length ? (
						<p>{t.settings.memberships.emptyOrganizations}</p>
					) : (
						memberships.data.items.map((membership) => (
							<div
								className="flex items-center justify-between gap-3"
								key={membership.organizationEntityId}
							>
								<AppLink href={`/user/${membership.organizationEntityId}`}>
									{membership.organizationName ?? t.ui.unnamed}
								</AppLink>
								<Button variant="outline" disabled={pending} onClick={() => setLeaving(membership)}>
									{t.settings.memberships.leave}
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
						{memberships.data?.nextCursor ? (
							<Button
								variant="outline"
								onClick={() => {
									const cursor = memberships.data.nextCursor;
									if (cursor) setMemberCursors((current) => [...current, cursor]);
								}}
							>
								{t.ui.shelf.next}
							</Button>
						) : null}
					</div>
				</CardContent>
			</Card>
			<AlertDialog
				open={leaving !== undefined}
				onOpenChange={({ open }) => {
					if (!open) setLeaving(undefined);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{leaving?.organizationName ?? t.settings.memberships.leave}
						</AlertDialogTitle>
						<AlertDialogDescription>{t.settings.memberships.leavePrompt}</AlertDialogDescription>
					</AlertDialogHeader>
					<RequestFailure error={leave.error} />
					<AlertDialogFooter>
						<AlertDialogCancel>{t.collections.cancel}</AlertDialogCancel>
						<Button
							variant="destructive"
							isLoading={leave.isPending}
							onClick={() => void leaveMembership()}
						>
							{t.settings.memberships.leave}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

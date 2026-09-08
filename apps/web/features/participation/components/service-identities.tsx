"use client";

import {
	revokeServicePrincipal,
	useCreateServicePrincipal,
	useListControlledServicePrincipals,
	type ListControlledServicePrincipalsStatus200,
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
	Dialog,
	DialogContent,
	DialogHeader,
	DialogFooter,
	Field,
	FieldLabel,
	Input,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { createParticipationClient } from "../data/participation-client";

type ServiceIdentity = ListControlledServicePrincipalsStatus200["items"][number];

export function ServiceIdentities() {
	const { t } = useTranslation(["settings", "collections", "actions"]);
	const client = useQueryClient();
	const [name, setName] = useState("");
	const [afterGrantId, setAfterGrantId] = useState<string>();
	const [credential, setCredential] = useState<string>();
	const [revoking, setRevoking] = useState<ServiceIdentity>();
	const services = useListControlledServicePrincipals({ query: { afterGrantId } });
	const create = useCreateServicePrincipal({ mutation: { gcTime: 0 } });
	const revoke = useMutation({
		mutationFn: (service: ServiceIdentity) =>
			revokeServicePrincipal({
				path: { id: service.id },
				body: { expectedRevision: service.revision },
				client: createParticipationClient({
					actingEntityId: service.entityId,
					grant: service.controlGrant,
				}),
			}),
	});
	async function createService(event: FormEvent) {
		event.preventDefault();
		try {
			const result = await create.mutateAsync({ body: { name: name.trim() } });
			setCredential(result.secret);
			setName("");
			setAfterGrantId(undefined);
			await client.invalidateQueries();
		} catch {
			/* The mutation error is rendered next to creation. */
		}
	}
	async function revokeService() {
		if (!revoking) return;
		try {
			await revoke.mutateAsync(revoking);
			setRevoking(undefined);
			await client.invalidateQueries();
		} catch {
			/* Preserve the selected service after failure. */
		}
	}
	function discardCredential() {
		setCredential(undefined);
		create.reset();
	}
	return (
		<Card>
			<CardContent className="grid gap-4 p-5">
				<h2 className="font-semibold">{t.settings.participation.services}</h2>
				{services.isPending ? (
					<QueryPending />
				) : services.isError ? (
					<QueryFailure error={services.error} retry={() => void services.refetch()} />
				) : (
					services.data.items.map((service) => (
						<div className="flex items-center justify-between gap-3" key={service.id}>
							<span>{service.name}</span>
							{service.revokedAt ? (
								<span>{t.settings.participation.revoked}</span>
							) : (
								<Button variant="outline" onClick={() => setRevoking(service)}>
									{t.settings.participation.revoke}
								</Button>
							)}
						</div>
					))
				)}
				{services.data?.nextCursor ? (
					<Button
						variant="quiet"
						onClick={() => setAfterGrantId(services.data.nextCursor ?? undefined)}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
				<form className="grid gap-3 border-t pt-4" onSubmit={(event) => void createService(event)}>
					<Field>
						<FieldLabel htmlFor="service-name">{t.settings.participation.name}</FieldLabel>
						<Input
							id="service-name"
							required
							maxLength={120}
							value={name}
							onChange={(event) => setName(event.currentTarget.value)}
						/>
					</Field>
					<Button type="submit" disabled={!name.trim()} isLoading={create.isPending}>
						{t.settings.participation.createService}
					</Button>
					<RequestFailure error={create.error} />
				</form>
				<Dialog
					open={credential !== undefined}
					onOpenChange={({ open }) => {
						if (!open) discardCredential();
					}}
				>
					<DialogContent>
						<DialogHeader
							title={t.settings.participation.credential}
							description={t.settings.participation.credentialDescription}
						/>
						<Input
							aria-label={t.settings.participation.credential}
							readOnly
							value={credential ?? ""}
							onFocus={(event) => event.currentTarget.select()}
						/>
						<DialogFooter>
							<Button onClick={discardCredential}>{t.collections.close}</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<AlertDialog
					open={revoking !== undefined}
					onOpenChange={({ open }) => {
						if (!open) setRevoking(undefined);
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t.settings.participation.revoke}</AlertDialogTitle>
							<AlertDialogDescription>
								{t.settings.participation.revokeWarning}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<RequestFailure error={revoke.error} />
						<AlertDialogFooter>
							<AlertDialogCancel>{t.collections.cancel}</AlertDialogCancel>
							<Button
								variant="destructive"
								isLoading={revoke.isPending}
								onClick={() => void revokeService()}
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

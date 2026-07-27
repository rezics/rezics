"use client";

import type {
	GetApiPlatformAccessPolicyStatus200,
	GetApiPlatformAccessProfilesStatus200,
	PutApiPlatformAccessProfilesByProfileIdStatus200,
} from "@rezics/openapi-tanstack-query";
import { usePutApiPlatformAccessProfilesByProfileId } from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	Input,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export type PlatformAccessProfile = GetApiPlatformAccessProfilesStatus200["items"][number];
type PlatformCapability = GetApiPlatformAccessPolicyStatus200["capabilities"][number];

interface CapabilityEditorState {
	readonly enabled: boolean;
	readonly expiry: string;
}

function toLocalDateTime(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function initialState(
	capabilities: readonly PlatformCapability[],
	profile: PlatformAccessProfile,
): ReadonlyMap<PlatformCapability, CapabilityEditorState> {
	const grants = new Map(profile.grants.map((grant) => [grant.capability, grant] as const));
	return new Map(
		capabilities.map((capability) => {
			const grant = grants.get(capability);
			return [
				capability,
				{ enabled: Boolean(grant), expiry: toLocalDateTime(grant?.expiresAt ?? null) },
			] as const;
		}),
	);
}

export function PlatformAccessEditor({
	canManage,
	capabilities,
	onSaved,
	profile,
}: {
	readonly canManage: boolean;
	readonly capabilities: readonly PlatformCapability[];
	readonly onSaved: (profile: PutApiPlatformAccessProfilesByProfileIdStatus200) => void;
	readonly profile: PlatformAccessProfile;
}) {
	const { locale, t } = useTranslation(["console", "governance", "ui"]);
	const [state, setState] = useState(() => initialState(capabilities, profile));
	const replace = usePutApiPlatformAccessProfilesByProfileId();
	const enabledCount = [...state.values()].filter(({ enabled }) => enabled).length;

	const update = (
		capability: PlatformCapability,
		transform: (current: CapabilityEditorState) => CapabilityEditorState,
	) => {
		setState((current) => {
			const next = new Map(current);
			next.set(
				capability,
				transform(current.get(capability) ?? { enabled: false, expiry: "" }),
			);
			return next;
		});
	};

	const save = () => {
		replace.mutate(
			{
				path: { profileId: profile.profileId },
				body: {
					expectedRevision: profile.revision,
					grants: capabilities.flatMap((capability) => {
						const value = state.get(capability);
						return value?.enabled
							? [
									{
										capability,
										expiresAt: value.expiry
											? new Date(value.expiry).toISOString()
											: null,
									},
								]
							: [];
					}),
				},
			},
			{ onSuccess: onSaved },
		);
	};

	const setAll = (enabled: boolean) =>
		setState(
			new Map(
				capabilities.map((capability) => {
					const current = state.get(capability);
					return [capability, { enabled, expiry: current?.expiry ?? "" }] as const;
				}),
			),
		);

	return (
		<Card appearance="outlined">
			<CardHeader className="border-b">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>{profile.name ?? profile.email}</CardTitle>
						<CardDescription>{profile.email}</CardDescription>
					</div>
					<Badge variant={enabledCount ? "secondary" : "outline"}>
						{t.console.access.capabilityCount({ count: enabledCount })}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="grid gap-4 p-0">
				{canManage ? (
					<div className="flex flex-wrap gap-2 border-b px-4 py-3">
						<Button
							onClick={() => setAll(true)}
							size="sm"
							type="button"
							variant="outline"
						>
							{t.console.access.grantAll}
						</Button>
						<Button
							onClick={() => setAll(false)}
							size="sm"
							type="button"
							variant="outline"
						>
							{t.console.access.clearAll}
						</Button>
					</div>
				) : (
					<p className="border-b px-4 py-3 text-muted-foreground text-sm">
						{t.console.access.readOnly}
					</p>
				)}

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t.console.access.capability}</TableHead>
							<TableHead>{t.console.access.expiry}</TableHead>
							<TableHead>{t.console.access.provenance}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{capabilities.map((capability) => {
							const value = state.get(capability) ?? { enabled: false, expiry: "" };
							const grant = profile.grants.find(
								(candidate) => candidate.capability === capability,
							);
							return (
								<TableRow key={capability}>
									<TableCell className="min-w-64 whitespace-normal">
										<label className="flex items-start gap-3">
											<Checkbox
												checked={value.enabled}
												disabled={!canManage}
												onCheckedChange={(details) =>
													update(capability, (current) => ({
														...current,
														enabled: details.checked === true,
													}))
												}
											/>
											<span>
												<span className="block font-medium">
													{t.governance.capabilities[capability]}
												</span>
												<code className="text-muted-foreground text-xs">
													{capability}
												</code>
											</span>
										</label>
									</TableCell>
									<TableCell>
										<Input
											aria-label={t.console.access.expiryFor({
												capability: t.governance.capabilities[capability],
											})}
											className="min-w-48"
											disabled={!canManage || !value.enabled}
											onChange={(event) =>
												update(capability, (current) => ({
													...current,
													expiry: event.currentTarget.value,
												}))
											}
											type="datetime-local"
											value={value.expiry}
										/>
										{value.enabled && !value.expiry ? (
											<span className="mt-1 block text-muted-foreground text-xs">
												{t.console.access.noExpiry}
											</span>
										) : null}
									</TableCell>
									<TableCell className="max-w-64 whitespace-normal text-muted-foreground text-xs">
										{grant
											? t.console.access.grantProvenance({
													profileId: grant.grantedByProfileId,
													date: new Intl.DateTimeFormat(locale.current, {
														dateStyle: "medium",
													}).format(new Date(grant.createdAt)),
												})
											: t.console.access.notGranted}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>

				{canManage ? (
					<div className="grid gap-3 px-4 pb-4">
						<RequestFailure error={replace.error} fallback={t.ui.retryLater} />
						<div className="flex justify-end">
							{enabledCount === 0 && profile.grants.length > 0 ? (
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button type="button" variant="destructive">
											{t.console.access.save}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{t.console.access.revokeAllTitle}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{t.console.access.revokeAllDescription}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>
												{t.console.cancel}
											</AlertDialogCancel>
											<Button
												isLoading={replace.isPending}
												onClick={save}
												type="button"
												variant="destructive"
											>
												{t.console.access.confirmRevokeAll}
											</Button>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							) : (
								<Button
									isLoading={replace.isPending}
									onClick={save}
									type="button"
									variant="solid"
								>
									{t.console.access.save}
								</Button>
							)}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

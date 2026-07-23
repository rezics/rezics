"use client";

import type {
	GetApiStaffAccessPolicyStatus200,
	GetApiStaffMembersStatus200,
	GetApiStaffProfilesStatus200,
	PutApiStaffMembersByProfileIdStatus200,
} from "@rezics/openapi-tanstack-query";
import { usePutApiStaffMembersByProfileId } from "@rezics/openapi-tanstack-query";
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
	Field,
	FieldLabel,
	Input,
} from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export type StaffAccessProfile =
	GetApiStaffMembersStatus200["items"][number] | GetApiStaffProfilesStatus200["items"][number];

type PlatformCapability = GetApiStaffAccessPolicyStatus200["capabilities"][number];

function toLocalDateTime(value: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

function getInitialExpiry(profile: StaffAccessProfile): string | undefined {
	const expiries = new Set(profile.grants.map((grant) => grant.expiresAt ?? ""));
	if (expiries.size > 1) return undefined;
	return toLocalDateTime(expiries.values().next().value ?? null);
}

export function StaffAccessEditor({
	capabilities,
	onSaved,
	profile,
}: {
	capabilities: readonly PlatformCapability[];
	onSaved: (profile: PutApiStaffMembersByProfileIdStatus200) => void;
	profile: StaffAccessProfile;
}) {
	const { t } = useTranslation(["governance", "staff", "ui"]);
	const [selected, setSelected] = useState(
		() => new Set<PlatformCapability>(profile.grants.map((grant) => grant.capability)),
	);
	const [expiry, setExpiry] = useState<string | undefined>(() => getInitialExpiry(profile));
	const replace = usePutApiStaffMembersByProfileId();
	const mixedExpiry = expiry === undefined;
	const expiryResolved = !mixedExpiry || selected.size === 0;

	const save = () => {
		if (!expiryResolved) return;
		replace.mutate(
			{
				path: { profileId: profile.profileId },
				body: {
					capabilities: capabilities.filter((capability) => selected.has(capability)),
					expiresAt: selected.size > 0 && expiry ? new Date(expiry).toISOString() : null,
				},
			},
			{ onSuccess: onSaved },
		);
	};

	const toggle = (capability: PlatformCapability, checked: boolean) => {
		setSelected((current) => {
			const next = new Set(current);
			if (checked) next.add(capability);
			else next.delete(capability);
			return next;
		});
	};

	const grantSignature = profile.grants
		.map((grant) => `${grant.capability}:${grant.expiresAt ?? ""}`)
		.sort()
		.join("|");

	return (
		<Card appearance="outlined" data-grant-signature={grantSignature}>
			<CardHeader>
				<CardTitle>{profile.name ?? profile.email}</CardTitle>
				<CardDescription>{profile.email}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div className="flex flex-wrap gap-2">
					<Badge
						variant={selected.size === capabilities.length ? "success" : "secondary"}
					>
						{selected.size === capabilities.length
							? t.staff.superAdmin
							: selected.size
								? t.staff.customAccess
								: t.staff.noAccess}
					</Badge>
					<Button
						onClick={() => setSelected(new Set(capabilities))}
						size="sm"
						type="button"
						variant="outline"
					>
						{t.staff.selectAll}
					</Button>
					<Button
						onClick={() => setSelected(new Set())}
						size="sm"
						type="button"
						variant="outline"
					>
						{t.staff.clearAll}
					</Button>
				</div>

				<div className="grid gap-2 md:grid-cols-2">
					{capabilities.map((capability) => (
						<label
							className="flex min-h-10 items-start gap-3 rounded-lg border border-border-weak p-3 text-sm"
							key={capability}
						>
							<Checkbox
								checked={selected.has(capability)}
								onCheckedChange={(details) =>
									toggle(capability, details.checked === true)
								}
							/>
							<span>{t.governance.capabilities[capability]}</span>
						</label>
					))}
				</div>

				<Field>
					<FieldLabel>{t.staff.expiry}</FieldLabel>
					<Input
						aria-invalid={mixedExpiry}
						onChange={(event) => setExpiry(event.currentTarget.value)}
						type="datetime-local"
						value={expiry ?? ""}
					/>
					{mixedExpiry ? (
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-amber-700 text-sm dark:text-amber-300">
								{t.staff.mixedExpiry}
							</p>
							<Button
								onClick={() => setExpiry("")}
								size="sm"
								type="button"
								variant="outline"
							>
								{t.staff.noExpiry}
							</Button>
						</div>
					) : expiry ? null : (
						<p className="text-muted-foreground text-sm">{t.staff.noExpiry}</p>
					)}
				</Field>

				<RequestFailure error={replace.error} fallback={t.ui.retryLater} />
				<div className="flex justify-end">
					{selected.size === 0 ? (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									disabled={!expiryResolved}
									type="button"
									variant="destructive"
								>
									{t.staff.saveAccess}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t.staff.demoteTitle}</AlertDialogTitle>
									<AlertDialogDescription>
										{t.staff.demoteDescription}
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>{t.staff.cancel}</AlertDialogCancel>
									<Button
										isLoading={replace.isPending}
										onClick={save}
										type="button"
										variant="destructive"
									>
										{t.staff.confirmDemotion}
									</Button>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					) : (
						<Button
							disabled={!expiryResolved}
							isLoading={replace.isPending}
							onClick={save}
							type="button"
							variant="solid"
						>
							{t.staff.saveAccess}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

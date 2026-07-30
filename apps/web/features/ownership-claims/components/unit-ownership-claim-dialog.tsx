"use client";

import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	usePostApiOwnershipClaims,
	usePostApiOwnershipClaimsByClaimIdWithdraw,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldDescription,
	FieldLabel,
	Textarea,
	toast,
} from "@rezics/ui";
import { type FormEvent, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export type PendingUnitOwnershipClaim = NonNullable<
	GetApiUnitsByTypeByUnitIdStatus200["ownershipClaim"]
>;

export function UnitOwnershipClaimDialog({
	onChanged,
	onOpenChange,
	open,
	pendingClaim,
	unitId,
}: {
	readonly onChanged: () => Promise<unknown>;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
	readonly pendingClaim: PendingUnitOwnershipClaim | null;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["units"]);
	const [details, setDetails] = useState("");
	const createClaim = usePostApiOwnershipClaims();
	const withdrawClaim = usePostApiOwnershipClaimsByClaimIdWithdraw();
	const pending = createClaim.isPending || withdrawClaim.isPending;
	const normalizedDetails = details.trim();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pendingClaim || !normalizedDetails || pending) return;
		try {
			await createClaim.mutateAsync({
				body: { unitId, details: normalizedDetails },
			});
			setDetails("");
			await onChanged();
			onOpenChange(false);
			toast.create({
				title: t.units.ownershipClaim.submitted,
				description: t.units.ownershipClaim.submittedDescription,
				type: "success",
			});
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	async function withdraw() {
		if (!pendingClaim || pending) return;
		try {
			await withdrawClaim.mutateAsync({
				path: { claimId: pendingClaim.id },
			});
			await onChanged();
			onOpenChange(false);
			toast.create({
				title: t.units.ownershipClaim.withdrawn,
				description: t.units.ownershipClaim.withdrawnDescription,
				type: "success",
			});
		} catch {
			// The typed mutation state renders the localized API error below.
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				if (!pending) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<DialogContent showCloseButton={!pending} size="sm">
				<DialogHeader
					description={
						pendingClaim
							? t.units.ownershipClaim.pendingDescription
							: t.units.ownershipClaim.description
					}
					title={
						pendingClaim
							? t.units.ownershipClaim.pendingTitle
							: t.units.ownershipClaim.title
					}
				/>
				<DialogBody>
					{pendingClaim ? (
						<div className="grid gap-4">
							<div className="rounded-lg border bg-muted/35 p-4">
								<p className="text-muted-foreground text-xs">
									{t.units.ownershipClaim.submittedDetails}
								</p>
								<p className="mt-2 whitespace-pre-wrap text-sm">
									{pendingClaim.details}
								</p>
							</div>
							<p className="text-muted-foreground text-sm">
								{t.units.ownershipClaim.effectNotice}
							</p>
							<RequestFailure error={withdrawClaim.error} />
						</div>
					) : (
						<form className="grid gap-4" id={`claim-unit-${unitId}`} onSubmit={submit}>
							<Field required>
								<FieldLabel>{t.units.ownershipClaim.detailsLabel}</FieldLabel>
								<Textarea
									maxLength={2_000}
									onChange={(event) => setDetails(event.currentTarget.value)}
									placeholder={t.units.ownershipClaim.detailsPlaceholder}
									rows={7}
									value={details}
								/>
								<FieldDescription>
									{t.units.ownershipClaim.detailsHint}
								</FieldDescription>
							</Field>
							<p className="text-muted-foreground text-sm">
								{t.units.ownershipClaim.effectNotice}
							</p>
							<RequestFailure error={createClaim.error} />
						</form>
					)}
				</DialogBody>
				<DialogFooter>
					<Button
						disabled={pending}
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						{t.units.ownershipClaim.cancel}
					</Button>
					{pendingClaim ? (
						<Button
							disabled={pending}
							isLoading={withdrawClaim.isPending}
							onClick={() => void withdraw()}
							type="button"
							variant="destructive"
						>
							{t.units.ownershipClaim.withdraw}
						</Button>
					) : (
						<Button
							disabled={!normalizedDetails || pending}
							form={`claim-unit-${unitId}`}
							isLoading={createClaim.isPending}
							type="submit"
						>
							{t.units.ownershipClaim.submit}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

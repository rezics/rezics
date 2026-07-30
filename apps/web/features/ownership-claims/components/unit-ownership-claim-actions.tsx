"use client";

import {
	getApiEntitiesByUnitIdQueryKey,
	getApiUnitsByTypeByUnitIdQueryKey,
} from "@rezics/openapi-tanstack-query";
import { Button, MenuItem } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useState } from "react";

import { useAuthPortal } from "@/features/auth/auth-portal-context";
import { UnitReportOverflowMenu } from "@/features/reports/components/unit-report-dialog";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { ownershipClaimPlacement } from "../model/ownership-claim-placement";
import {
	type PendingUnitOwnershipClaim,
	UnitOwnershipClaimDialog,
} from "./unit-ownership-claim-dialog";

function useOwnershipClaimRequest() {
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const [open, setOpen] = useState(false);

	return {
		open,
		setOpen,
		request() {
			if (session) setOpen(true);
			else openAuthPortal("login");
		},
	};
}

export function CatalogUnitOverflowMenu({
	catalogMode,
	pendingClaim,
	type,
	unitId,
}: {
	readonly catalogMode: string;
	readonly pendingClaim: PendingUnitOwnershipClaim | null;
	readonly type: "book" | "media" | "software" | "series";
	readonly unitId: string;
}) {
	const { t } = useTranslation(["units"]);
	const queryClient = useQueryClient();
	const claimRequest = useOwnershipClaimRequest();
	const placement = ownershipClaimPlacement({ unitType: type, catalogMode });

	return (
		<>
			<UnitReportOverflowMenu
				additionalItems={
					placement === "overflow" ? (
						<MenuItem onSelect={claimRequest.request} value="claim-unit-ownership">
							<KeyRound aria-hidden />
							{pendingClaim
								? t.units.ownershipClaim.pendingAction
								: t.units.ownershipClaim.action}
						</MenuItem>
					) : null
				}
				unitId={unitId}
			/>
			{placement === "overflow" ? (
				<UnitOwnershipClaimDialog
					onChanged={() =>
						queryClient.invalidateQueries({
							queryKey: getApiUnitsByTypeByUnitIdQueryKey({
								path: { type, unitId },
							}),
						})
					}
					onOpenChange={claimRequest.setOpen}
					open={claimRequest.open}
					pendingClaim={pendingClaim}
					unitId={unitId}
				/>
			) : null}
		</>
	);
}

export function EntityOwnershipClaimButton({
	catalogMode,
	pendingClaim,
	unitId,
}: {
	readonly catalogMode: string;
	readonly pendingClaim: PendingUnitOwnershipClaim | null;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["units"]);
	const queryClient = useQueryClient();
	const claimRequest = useOwnershipClaimRequest();
	const placement = ownershipClaimPlacement({ unitType: "entity", catalogMode });
	if (placement !== "external") return null;

	return (
		<>
			<Button
				className="w-fit"
				onClick={claimRequest.request}
				type="button"
				variant="outline"
			>
				<KeyRound aria-hidden />
				{pendingClaim
					? t.units.ownershipClaim.pendingAction
					: t.units.ownershipClaim.action}
			</Button>
			<UnitOwnershipClaimDialog
				onChanged={() =>
					queryClient.invalidateQueries({
						queryKey: getApiEntitiesByUnitIdQueryKey({ path: { unitId } }),
					})
				}
				onOpenChange={claimRequest.setOpen}
				open={claimRequest.open}
				pendingClaim={pendingClaim}
				unitId={unitId}
			/>
		</>
	);
}

"use client";

import {
	getApiScoresByTargetIdQueryKey,
	usePutApiScoresByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	Field,
	FieldLabel,
	Rating,
} from "@rezics/ui";
import { useState } from "react";

import { useAuthPortal } from "@/features/auth/auth-portal";
import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { starValueToUnitScore, type UnitScore } from "../model/score-value";

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

const RatingCount = 5;

export function UnitScoreControl({
	targetId,
	type,
}: {
	readonly targetId: string;
	readonly type: CatalogDetailUnitType;
}) {
	const { data: session } = useHydratedSession();
	const { openAuthPortal } = useAuthPortal();
	const queryClient = useQueryClient();
	const mutation = usePutApiScoresByTargetId();
	const { t } = useTranslation(["engagement", "ui"]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [realm, setRealm] = useState<PickedRealm>();
	const [score, setScore] = useState<UnitScore>();
	const copy = t.engagement.progressByType[type];

	async function saveScore() {
		if (!realm || score === undefined) return;
		try {
			await mutation.mutateAsync({
				body: { realmId: realm.id, score },
				path: { targetId },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiScoresByTargetIdQueryKey({
					path: { targetId },
					query: { realmId: realm.id },
				}),
			});
			setDialogOpen(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<>
			<div className="grid justify-items-center gap-2 py-1">
				<Rating
					allowHalf
					aria-label={copy.scoreAction}
					className="text-muted-foreground **:data-[highlighted]:text-warning **:data-[slot=rating-item-indicator]:size-7"
					count={RatingCount}
					onValueChange={({ value }) => {
						if (!session) {
							openAuthPortal("login");
							return;
						}
						const nextScore = starValueToUnitScore(value);
						if (nextScore === undefined) return;
						setScore(nextScore);
						setDialogOpen(true);
					}}
					value={score === undefined ? 0 : score / 2}
				/>
				<p className="text-center text-sm text-muted-foreground">
					{score === undefined
						? copy.scoreAction
						: t.engagement.scoreOutOfTen({ score: String(score) })}
				</p>
			</div>

			<Dialog
				onOpenChange={({ open }) => {
					setDialogOpen(open);
					if (!open) mutation.reset();
				}}
				open={dialogOpen}
			>
				<DialogContent showCloseButton={false} size="sm">
					<DialogHeader
						description={t.engagement.reviewScoreRealmHint}
						title={copy.scoreAction}
					/>
					<DialogBody className="grid gap-5">
						<div className="grid justify-items-center gap-2">
							<Rating
								allowHalf
								aria-label={copy.scoreAction}
								className="**:data-[slot=rating-item-indicator]:size-8"
								count={RatingCount}
								onValueChange={({ value }) => {
									const nextScore = starValueToUnitScore(value);
									if (nextScore !== undefined) setScore(nextScore);
								}}
								value={score === undefined ? 0 : score / 2}
							/>
							{score === undefined ? null : (
								<span className="text-sm font-medium">
									{t.engagement.scoreOutOfTen({ score: String(score) })}
								</span>
							)}
						</div>
						<Field>
							<FieldLabel>{t.engagement.reviewRealm}</FieldLabel>
							<EntityPicker index="realms" onChange={setRealm} value={realm} />
						</Field>
						<RequestFailure error={mutation.error} fallback={t.ui.retryLater} />
					</DialogBody>
					<DialogFooter>
						<Button onClick={() => setDialogOpen(false)} variant="outline">
							{t.engagement.cancel}
						</Button>
						<Button
							disabled={!realm || score === undefined}
							isLoading={mutation.isPending}
							onClick={() => void saveScore()}
							variant="solid"
						>
							{t.engagement.setScore}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

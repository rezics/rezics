"use client";

import {
	getApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceQueryOptions,
	type GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import type { ContentLanguageSupportUnitType } from "../model/content-language-support";
import { ContentLanguageSupportDisplay } from "./content-language-support-display";

type EvidenceItem =
	GetApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceStatus200["items"][number];

type EvidenceState =
	| { readonly status: "idle"; readonly items: readonly EvidenceItem[] }
	| {
			readonly status: "loading";
			readonly items: readonly EvidenceItem[];
			readonly nextCursor: string | null;
			readonly requestedCursor: string | undefined;
	  }
	| {
			readonly status: "ready";
			readonly items: readonly EvidenceItem[];
			readonly nextCursor: string | null;
	  }
	| {
			readonly status: "error";
			readonly items: readonly EvidenceItem[];
			readonly nextCursor: string | null;
			readonly requestedCursor: string | undefined;
	  };

const EvidencePageSize = 20;

export type ContentLanguageSupportEvidenceProps = {
	readonly onAdopt: (value: EvidenceItem["contentLanguageSupport"]) => void;
	readonly type: ContentLanguageSupportUnitType;
	readonly unitId: string;
};

export function ContentLanguageSupportEvidence({
	onAdopt,
	type,
	unitId,
}: ContentLanguageSupportEvidenceProps) {
	const { t } = useTranslation(["ui", "units"]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const [state, setState] = useState<EvidenceState>({ status: "idle", items: [] });

	async function loadPage(cursor: string | undefined) {
		const retainedItems = state.items;
		const retainedCursor = state.status === "idle" ? null : state.nextCursor;
		setState({
			status: "loading",
			items: retainedItems,
			nextCursor: retainedCursor,
			requestedCursor: cursor,
		});
		try {
			const page = await queryClient.fetchQuery(
				getApiUnitsByTypeByUnitIdContentLanguageSupportEvidenceQueryOptions({
					path: { type, unitId },
					query: {
						localizationLanguages,
						limit: EvidencePageSize,
						...(cursor ? { cursor } : {}),
					},
				}),
			);
			setState({
				status: "ready",
				items: mergeEvidenceItems(cursor ? retainedItems : [], page.items),
				nextCursor: page.nextCursor,
			});
		} catch {
			setState({
				status: "error",
				items: retainedItems,
				nextCursor: retainedCursor,
				requestedCursor: cursor,
			});
		}
	}

	return (
		<section className="grid gap-3 rounded-xl border p-4">
			<div className="grid gap-1">
				<h3 className="font-heading font-bold">{t.units.contentLanguageSupport.evidenceTitle}</h3>
				<p className="text-sm text-muted-foreground">
					{t.units.contentLanguageSupport.evidenceDescription}
				</p>
			</div>

			{state.status === "idle" ? (
				<Button
					className="w-fit"
					onClick={() => void loadPage(undefined)}
					type="button"
					variant="outline"
				>
					{t.units.contentLanguageSupport.loadEvidence}
				</Button>
			) : null}

			{state.items.length ? (
				<div className="grid gap-3">
					{state.items.map((item) => (
						<article className="grid gap-3 rounded-lg bg-muted/32 p-3" key={evidenceItemKey(item)}>
							<div className="flex flex-wrap items-start justify-between gap-2">
								<div className="grid gap-1">
									<Badge className="w-fit" variant="secondary">
										{t.units.contentLanguageSupport.evidenceSources[item.source]}
									</Badge>
									<p className="break-words font-medium">{item.unit.title ?? t.ui.unnamed}</p>
								</div>
								<Button
									disabled={item.contentLanguageSupport.length === 0}
									onClick={() => onAdopt(item.contentLanguageSupport)}
									type="button"
									variant="outline"
								>
									{t.units.contentLanguageSupport.adoptEvidence}
								</Button>
							</div>
							<ContentLanguageSupportDisplay value={item.contentLanguageSupport} />
						</article>
					))}
				</div>
			) : state.status === "ready" ? (
				<p className="text-sm text-muted-foreground">{t.units.contentLanguageSupport.noEvidence}</p>
			) : null}

			{state.status === "error" ? (
				<div className="grid gap-2">
					<p className="text-sm text-destructive" role="alert">
						{t.ui.retryLater}
					</p>
					<Button
						className="w-fit"
						onClick={() => void loadPage(state.requestedCursor)}
						type="button"
						variant="outline"
					>
						{state.requestedCursor
							? t.units.contentLanguageSupport.loadMoreEvidence
							: t.units.contentLanguageSupport.loadEvidence}
					</Button>
				</div>
			) : null}

			{state.status === "ready" && state.nextCursor ? (
				<Button
					className="w-fit"
					onClick={() => void loadPage(state.nextCursor ?? undefined)}
					type="button"
					variant="outline"
				>
					{t.units.contentLanguageSupport.loadMoreEvidence}
				</Button>
			) : null}

			{state.status === "loading" ? (
				<Button className="w-fit" disabled isLoading type="button" variant="outline">
					{state.requestedCursor
						? t.units.contentLanguageSupport.loadMoreEvidence
						: t.units.contentLanguageSupport.loadEvidence}
				</Button>
			) : null}
		</section>
	);
}

export function mergeEvidenceItems(
	current: readonly EvidenceItem[],
	next: readonly EvidenceItem[],
): readonly EvidenceItem[] {
	const byKey = new Map(current.map((item) => [evidenceItemKey(item), item]));
	for (const item of next) byKey.set(evidenceItemKey(item), item);
	return [...byKey.values()];
}

function evidenceItemKey(item: EvidenceItem): string {
	return [
		item.source,
		item.unit.kind,
		item.unit.id,
		item.occurrence?.structureId ?? "",
		item.occurrence?.nodeId ?? "",
	].join(":");
}

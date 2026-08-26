"use client";

import { isDocument, parseDocument, ZoneThemeDocument } from "@rezics/block";
import {
	getApiZonesByZoneIdQueryKey,
	usePatchApiZonesByZoneId,
} from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent, ManagementWorkspaceSectionHeader } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	type LocalizedDraftCodec,
	useLocalizedDraft,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftImageAsset,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { zoneManagementHref } from "./model";
import { ZoneThemeFields, type ZoneThemeEditorValue } from "./theme-fields";
import { useZoneManagement } from "./workspace";

const ZoneThemeDraftCodec: LocalizedDraftCodec<ZoneThemeEditorValue> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value) || !isDocument(ZoneThemeDocument, value.theme)) return;
		const hero = decodeDraftImageAsset(value.hero);
		return hero === undefined ? undefined : { theme: value.theme, hero };
	},
};

export function ZoneThemeManagement() {
	const { t } = useTranslation(["ui", "zones"]);
	const { zone, zoneId } = useZoneManagement();
	const queryClient = useQueryClient();
	const canEdit = zone.capabilities.canManage || zone.capabilities.canManageTheme;
	const level1Enabled =
		zone.capabilities.hasDevelopmentPreviewAccess && zone.capabilities.canManageTheme;
	const draft = useLocalizedDraft<ZoneThemeEditorValue>({
		scope: "zone-theme",
		partition: "shared",
		baseVersion: zone.updatedAt,
		codec: ZoneThemeDraftCodec,
		createInitialValue: () => ({
			theme: parseDocument(ZoneThemeDocument, zone.themeDocument),
			hero: zone.themeHero,
		}),
	});
	const update = usePatchApiZonesByZoneId({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: getApiZonesByZoneIdQueryKey({ path: { zoneId } }),
				}),
		},
	});

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canEdit) return;
		try {
			await update.mutateAsync({
				path: { zoneId },
				body: { themeDocument: draft.value.theme },
			});
			draft.commit();
		} catch {
			// Typed mutation state supplies the visible request failure.
		}
	}

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.theme.description}
				link={Link}
				title={t.zones.management.sections.theme.label}
			/>
			<Card appearance="outlined" className="mt-6">
				<CardContent className="p-6">
					<LocalizedDraftGate
						hydrated={draft.hydrated}
						onDiscard={draft.discard}
						serverChanged={draft.serverChanged}
					>
						<form className="grid gap-6" onSubmit={(event) => void submit(event)}>
							<ZoneThemeFields
								disabled={!canEdit}
								level1Enabled={level1Enabled}
								onChange={draft.setValue}
								value={draft.value}
							/>
							{canEdit ? (
								<Button className="w-fit" isLoading={update.isPending} type="submit">
									{t.zones.theme.save}
								</Button>
							) : null}
							<RequestFailure error={update.error} fallback={t.zones.theme.saveFailed} />
						</form>
					</LocalizedDraftGate>
				</CardContent>
			</Card>
		</section>
	);
}

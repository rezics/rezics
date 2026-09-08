"use client";
import {
	useUpdateActingEntityPresentation,
	type ClientInstance,
	type GetApiAccountMeStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldGroup, FieldLabel, Input, Textarea } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { ContentLanguage } from "@rezics/i18n";
import {
	AvatarField,
	avatarPresentationToInput,
	type AvatarFieldValue,
} from "@/features/media/components/avatar-field";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "@/features/media/components/localization-image-upload-field";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { PresentationHistory } from "./presentation-history";
export function EntityPresentationEditor({
	entity,
	language,
	client,
}: {
	entity: GetApiAccountMeStatus200["entity"];
	language: ContentLanguage;
	client?: ClientInstance;
}) {
	const { t } = useTranslation(["settings", "media", "ui"]);
	const queryClient = useQueryClient();
	const current = entity.language === language;
	const [expectedRevision, setExpectedRevision] = useState(current ? entity.revision : 0);
	const [name, setName] = useState(current ? (entity.name ?? "") : "");
	const [summary, setSummary] = useState(current ? (entity.summary ?? "") : "");
	const [avatar, setAvatar] = useState<AvatarFieldValue | null>(current ? entity.avatar : null);
	const [banner, setBanner] = useState<LocalizationImageAssetValue | null>(
		current ? entity.banner : null,
	);
	const update = useUpdateActingEntityPresentation({ client: { client } });
	const [historyOpen, setHistoryOpen] = useState(false);
	async function submit(event: FormEvent) {
		event.preventDefault();
		try {
			const updated = await update.mutateAsync({
				body: {
					language,
					expectedRevision,
					name: name.trim(),
					summary: summary.trim(),
					avatar: avatarPresentationToInput(avatar),
					bannerAssetId: banner?.id ?? null,
				},
			});
			setExpectedRevision(updated.revision);
			await queryClient.invalidateQueries();
		} catch {
			/* The mutation error remains visible with the unchanged draft. */
		}
	}
	return (
		<div className="grid gap-4">
			<form onSubmit={(event) => void submit(event)}>
				<FieldGroup>
					<Field>
						<FieldLabel>{t.media.roles.avatar.title}</FieldLabel>
						<AvatarField value={avatar} onChange={setAvatar} />
					</Field>
					<Field>
						<FieldLabel>{t.media.roles.banner.title}</FieldLabel>
						<LocalizationImageUploadField role="banner" value={banner} onChange={setBanner} />
					</Field>
					<Field>
						<FieldLabel htmlFor="entity-name">{t.ui.displayName}</FieldLabel>
						<Input
							id="entity-name"
							required
							maxLength={120}
							value={name}
							onChange={(event) => setName(event.currentTarget.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="entity-summary">{t.ui.introduction}</FieldLabel>
						<Textarea
							id="entity-summary"
							maxLength={500}
							value={summary}
							onChange={(event) => setSummary(event.currentTarget.value)}
						/>
					</Field>
					<RequestFailure error={update.error} />
					<Button
						type="submit"
						variant="solid"
						disabled={!name.trim()}
						isLoading={update.isPending}
					>
						{t.ui.save}
					</Button>
				</FieldGroup>
			</form>
			{expectedRevision > 0 ? (
				<Button
					variant="quiet"
					aria-expanded={historyOpen}
					onClick={() => setHistoryOpen((open) => !open)}
				>
					{t.settings.participation.history}
				</Button>
			) : null}
			{historyOpen ? (
				<PresentationHistory
					client={client}
					entityId={entity.id}
					language={language}
					expectedRevision={expectedRevision}
					onRestored={(restored) => {
						setExpectedRevision(restored.revision);
						setName(restored.name ?? "");
						setSummary(restored.summary ?? "");
						setAvatar(restored.avatar);
						setBanner(restored.banner);
					}}
				/>
			) : null}
		</div>
	);
}

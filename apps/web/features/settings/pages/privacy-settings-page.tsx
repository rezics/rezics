"use client";

import {
	getApiUsersMePreferencesQueryKey,
	useGetApiUsersMePreferences,
	useUpdateCurrentUserPrivacy,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState, type FormEvent } from "react";

import {
	isResourceVisibility,
	ResourceVisibilityValues,
	type ResourceVisibility,
} from "@/features/privacy/model/resource-visibility";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { SettingsOverviewHref } from "../routing/settings-routes";

function PrivacySettingsForm({
	initialProgressVisibility,
	initialScoreVisibility,
}: {
	readonly initialProgressVisibility: ResourceVisibility;
	readonly initialScoreVisibility: ResourceVisibility;
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const queryClient = useQueryClient();
	const [scoreVisibility, setScoreVisibility] = useState(initialScoreVisibility);
	const [progressVisibility, setProgressVisibility] = useState(initialProgressVisibility);
	const [saved, setSaved] = useState(false);
	const update = useUpdateCurrentUserPrivacy();
	const dirty =
		scoreVisibility !== initialScoreVisibility || progressVisibility !== initialProgressVisibility;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		try {
			await update.mutateAsync({
				body: { scoreVisibility, progressVisibility },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiUsersMePreferencesQueryKey(),
			});
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}

	const visibilityOptions = ResourceVisibilityValues.map((visibility) => ({
		value: visibility,
		label: t.ui[visibility],
	}));

	return (
		<form onSubmit={submit}>
			<Card appearance="outlined">
				<CardContent className="p-6">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="score-visibility">{t.settings.privacy.scoreTitle}</FieldLabel>
							<NativeSelect
								id="score-visibility"
								onChange={(event) => {
									if (isResourceVisibility(event.target.value))
										setScoreVisibility(event.target.value);
									setSaved(false);
								}}
								value={scoreVisibility}
							>
								{visibilityOptions.map((option) => (
									<NativeSelectOption key={option.value} value={option.value}>
										{option.label}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldDescription>{t.settings.privacy.scoreDescription}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="progress-visibility">
								{t.settings.privacy.progressTitle}
							</FieldLabel>
							<NativeSelect
								id="progress-visibility"
								onChange={(event) => {
									if (isResourceVisibility(event.target.value))
										setProgressVisibility(event.target.value);
									setSaved(false);
								}}
								value={progressVisibility}
							>
								{visibilityOptions.map((option) => (
									<NativeSelectOption key={option.value} value={option.value}>
										{option.label}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldDescription>{t.settings.privacy.progressDescription}</FieldDescription>
						</Field>
						<div className="rounded-lg border border-border-weak bg-surface-subtle p-4 text-muted-foreground text-sm leading-6">
							<p>{t.settings.privacy.categoryRule}</p>
							<p className="mt-2">{t.settings.privacy.unlistedRule}</p>
						</div>
						{saved ? <p className="text-success text-sm">{t.ui.saved}</p> : null}
						{update.isError ? (
							<RequestFailure error={update.error} fallback={t.ui.retryLater} />
						) : null}
						<Button
							disabled={!dirty && !update.isPending}
							isLoading={update.isPending}
							type="submit"
							variant="solid"
						>
							{t.ui.save}
						</Button>
					</FieldGroup>
				</CardContent>
			</Card>
		</form>
	);
}

export function PrivacySettingsPage() {
	const { t } = useTranslation(["settings"]);
	const preferences = useGetApiUsersMePreferences();
	if (preferences.isPending) return <QueryPending />;
	if (preferences.isError || !preferences.data)
		return <QueryFailure error={preferences.error} retry={() => void preferences.refetch()} />;
	return (
		<section className="max-w-2xl">
			<ManagementWorkspaceSectionHeader
				backHref={SettingsOverviewHref}
				backLabel={t.settings.workspace.backToOverview}
				description={t.settings.privacy.description}
				link={Link}
				title={t.settings.privacy.title}
			/>
			<PrivacySettingsForm
				initialProgressVisibility={preferences.data.progressVisibility}
				initialScoreVisibility={preferences.data.scoreVisibility}
				key={`${preferences.data.scoreVisibility}:${preferences.data.progressVisibility}`}
			/>
		</section>
	);
}

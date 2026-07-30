"use client";

import {
	getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey,
	getApiTagsQueryKey,
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	usePostApiTags,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
} from "@rezics/openapi-tanstack-query";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
	Button,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	ManagementWorkspaceSectionHeader,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { PublicEntrySearchPrompt } from "@/features/catalog/components/public-entry-search-prompt";
import {
	isPublicEntrySearchConfirmed,
	TagPublicEntrySearchSubject,
} from "@/features/catalog/model/public-entry-search";
import { DraftContentLanguageField } from "@/features/content-languages/components/draft-content-language-field";
import { useFormDraftContentLanguage } from "@/features/content-languages/hooks/use-form-draft-content-language";
import { studioSectionHref } from "@/features/create/routing/studio-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { type TagCreateIntent, unitTagVoteDuplicateSearchHref } from "../routing/tag-create-route";
import { unitTagsHref } from "../routing/tag-links";

type UnitTagVoteCompletionState =
	| { readonly status: "idle" }
	| { readonly status: "applying"; readonly tagId: string }
	| { readonly status: "failed"; readonly tagId: string };

export function TagCreatePage({
	initialTitle,
	intent,
	publicEntrySearchConfirmation,
}: {
	readonly initialTitle: string;
	readonly intent: TagCreateIntent;
	readonly publicEntrySearchConfirmation: string | null;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const router = useApplicationRouter();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(initialTitle);
	const [voteCompletion, setVoteCompletion] = useState<UnitTagVoteCompletionState>({
		status: "idle",
	});
	const language = useFormDraftContentLanguage(["title", "summary"]);
	const create = usePostApiTags();
	const applyGlobal = usePutApiUnitsByTypeByUnitIdTagsByTagId();
	const applyRealm = usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote();
	const searchConfirmed = isPublicEntrySearchConfirmed(
		TagPublicEntrySearchSubject,
		title,
		publicEntrySearchConfirmation,
	);
	const returnHref =
		intent.kind === "unit-tag-vote"
			? unitTagsHref(intent.type, intent.unitId, { context: intent.context })
			: studioSectionHref("tag");
	const isApplying =
		voteCompletion.status === "applying" || applyGlobal.isPending || applyRealm.isPending;

	async function finishUnitTagVote(tagId: string) {
		if (intent.kind !== "unit-tag-vote" || isApplying) return;
		setVoteCompletion({ status: "applying", tagId });
		try {
			if (intent.context.kind === "global")
				await applyGlobal.mutateAsync({
					path: { type: intent.type, unitId: intent.unitId, tagId },
					body: {},
				});
			else
				await applyRealm.mutateAsync({
					path: {
						realmId: intent.context.realmId,
						unitId: intent.unitId,
						tagId,
					},
					body: { value: 1 },
				});
		} catch {
			setVoteCompletion({ status: "failed", tagId });
			return;
		}
		const invalidations = [
			queryClient.invalidateQueries({
				queryKey: getApiUnitsByTypeByUnitIdTagsQueryKey({
					path: { type: intent.type, unitId: intent.unitId },
				}),
			}),
		];
		if (intent.context.kind === "realm")
			invalidations.push(
				queryClient.invalidateQueries({
					queryKey: getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey({
						path: { realmId: intent.context.realmId, unitId: intent.unitId },
					}),
				}),
			);
		await Promise.all(invalidations);
		router.push(
			unitTagsHref(intent.type, intent.unitId, {
				context: intent.context,
				createdTagId: tagId,
			}),
		);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (create.isPending || voteCompletion.status !== "idle") return;
		const formElement = event.currentTarget;
		const form = new FormData(formElement);
		const submittedTitle = String(form.get("title") ?? "").trim();
		if (
			!isPublicEntrySearchConfirmed(
				TagPublicEntrySearchSubject,
				submittedTitle,
				publicEntrySearchConfirmation,
			)
		)
			return;
		const contentLanguage = await language.resolveLanguage(formElement);
		let created: { readonly id: string };
		try {
			created = await create.mutateAsync({
				body: {
					localization: {
						language: contentLanguage,
						title: submittedTitle,
						...(String(form.get("summary") ?? "").trim()
							? { summary: String(form.get("summary")).trim() }
							: {}),
					},
				},
			});
		} catch {
			return;
		}
		await queryClient.invalidateQueries({ queryKey: getApiTagsQueryKey() });
		if (intent.kind === "standalone") {
			router.push(studioSectionHref("tag"));
			return;
		}
		await finishUnitTagVote(created.id);
	}

	const searchHref =
		intent.kind === "unit-tag-vote" ? unitTagVoteDuplicateSearchHref(title, intent) : undefined;

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={returnHref}
				backLabel={
					intent.kind === "unit-tag-vote"
						? t.tags.create.backToUnitTags
						: t.tags.create.backToStudioTags
				}
				description={
					intent.kind === "unit-tag-vote"
						? t.tags.create.voteDescription
						: t.tags.create.description
				}
				link={Link}
				title={t.tags.create.title}
			/>

			<div className="grid max-w-2xl gap-6">
				{voteCompletion.status === "applying" ? (
					<Alert aria-live="polite" variant="info">
						<LoaderCircle aria-hidden className="animate-spin" />
						<AlertDescription>{t.tags.create.applying}</AlertDescription>
					</Alert>
				) : voteCompletion.status === "failed" ? (
					<Alert variant="warning">
						<TriangleAlert aria-hidden />
						<AlertTitle>{t.tags.create.partialTitle}</AlertTitle>
						<AlertDescription>{t.tags.create.partialDescription}</AlertDescription>
						<AlertAction className="flex-wrap">
							<Button
								isLoading={isApplying}
								onClick={() => void finishUnitTagVote(voteCompletion.tagId)}
								size="sm"
								variant="solid"
							>
								{t.tags.create.retryVote}
							</Button>
							<Button asChild size="sm" variant="outline">
								<Link href={returnHref}>{t.tags.create.returnToUnitTags}</Link>
							</Button>
						</AlertAction>
						<RequestFailure
							error={applyGlobal.error ?? applyRealm.error}
							fallback={t.ui.retryLater}
						/>
					</Alert>
				) : (
					<form onInput={language.onInput} onSubmit={(event) => void submit(event)}>
						<FieldGroup>
							<Field required>
								<FieldLabel>{t.ui.title}</FieldLabel>
								<Input
									autoFocus
									maxLength={500}
									name="title"
									onChange={(event) => setTitle(event.currentTarget.value)}
									required
									value={title}
								/>
							</Field>
							<PublicEntrySearchPrompt
								confirmed={searchConfirmed}
								query={title}
								searchHref={searchHref}
								subject={TagPublicEntrySearchSubject}
							/>
							<Field>
								<FieldLabel>{t.ui.summary}</FieldLabel>
								<Textarea maxLength={2000} name="summary" />
							</Field>
							<DraftContentLanguageField controller={language.controller} />
							<RequestFailure error={create.error} fallback={t.ui.retryLater} />
							<Button
								className="w-fit"
								disabled={!searchConfirmed}
								isLoading={create.isPending || isApplying}
								type="submit"
								variant="solid"
							>
								{intent.kind === "unit-tag-vote"
									? t.tags.create.submitAndVote
									: t.tags.create.submit}
							</Button>
						</FieldGroup>
					</form>
				)}
			</div>
		</section>
	);
}

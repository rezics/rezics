"use client";

import type { PostApiSearchByIndexStatus200 } from "@rezics/openapi-tanstack-query";
import { usePostApiSearchByIndex } from "@rezics/openapi-tanstack-query";
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
	UnitList,
} from "@rezics/ui";
import { Search, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import {
	normalizePublicEntrySearchQuery,
	publicEntryCreationHref,
	publicEntrySearchResultHref,
	type PublicEntrySearchSubject,
} from "@/features/catalog/model/public-entry-search";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	type UnitTagVoteCreateTarget,
	unitTagVoteCreateHref,
} from "@/features/tags/routing/tag-create-route";
import { studioSectionHref } from "../routing/studio-routes";

type PublicEntrySearchHit = PostApiSearchByIndexStatus200["hits"][number];

type PublicEntrySearchState =
	| { readonly status: "idle" }
	| {
			readonly hits: readonly PublicEntrySearchHit[];
			readonly query: string;
			readonly status: "ready";
	  }
	| { readonly query: string; readonly status: "error" };

export function PublicEntrySearchPage({
	initialQuery,
	subject,
	unitTagVoteTarget,
}: {
	readonly initialQuery: string;
	readonly subject: PublicEntrySearchSubject;
	readonly unitTagVoteTarget?: UnitTagVoteCreateTarget;
}) {
	const { t } = useTranslation("create");
	const localizationLanguages = useLocalizationLanguages();
	const messages = t.publicEntrySearch;
	const subjectLabel = messages.subjects[subject.kind];
	const [query, setQuery] = useState(initialQuery);
	const [state, setState] = useState<PublicEntrySearchState>({ status: "idle" });
	const search = usePostApiSearchByIndex();
	const normalizedQuery = normalizePublicEntrySearchQuery(query);
	const displayedState =
		state.status !== "idle" && normalizePublicEntrySearchQuery(state.query) === normalizedQuery
			? state
			: ({ status: "idle" } as const);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const submittedQuery = query.trim();
		if (!submittedQuery || search.isPending) return;
		try {
			const result = await search.mutateAsync({
				path: { index: subject.searchIndex },
				body: {
					query: submittedQuery,
					limit: 20,
					localizationLanguages: [...localizationLanguages],
					...("filterKind" in subject ? { kinds: [subject.filterKind] } : {}),
				},
			});
			setState({ hits: result.hits, query: submittedQuery, status: "ready" });
		} catch {
			setState({ query: submittedQuery, status: "error" });
		}
	}

	const resultItems =
		displayedState.status === "ready"
			? displayedState.hits.map((hit) => ({
					avatar: hit.avatar,
					href: publicEntrySearchResultHref(subject, hit.id),
					id: hit.id,
					summary: hit.summary,
					title: hit.title ?? hit.name ?? null,
				}))
			: [];

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={studioSectionHref(subject.section)}
				backLabel={messages.backToSection({ subject: subjectLabel })}
				description={messages.pageDescription({ subject: subjectLabel })}
				link={Link}
				title={messages.pageTitle({ subject: subjectLabel })}
			/>

			<div className="grid max-w-3xl gap-6">
				<Alert variant="warning">
					<TriangleAlert aria-hidden />
					<AlertTitle>{messages.policyTitle}</AlertTitle>
					<AlertDescription>{messages.policy}</AlertDescription>
				</Alert>

				<form onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>
								{messages.searchLabel({ subject: subjectLabel })}
							</FieldLabel>
							<Input
								autoComplete="off"
								autoFocus
								maxLength={500}
								name="query"
								onChange={(event) => setQuery(event.currentTarget.value)}
								placeholder={messages.searchPlaceholder({ subject: subjectLabel })}
								required
								type="search"
								value={query}
							/>
						</Field>
						<Button
							className="w-fit"
							disabled={!normalizedQuery}
							isLoading={search.isPending}
							type="submit"
							variant="solid"
						>
							<Search aria-hidden className="size-4" />
							{messages.searchAction}
						</Button>
					</FieldGroup>
				</form>

				{displayedState.status === "idle" ? (
					<p className="text-muted-foreground text-sm">{messages.searchHint}</p>
				) : displayedState.status === "error" ? (
					<Alert variant="destructive">
						<AlertDescription>{messages.searchFailed}</AlertDescription>
					</Alert>
				) : (
					<section className="grid gap-4" aria-live="polite">
						<h2 className="font-heading font-semibold text-xl">
							{messages.resultsTitle}
						</h2>
						{resultItems.length > 0 ? (
							<UnitList error={false} items={resultItems} pending={false} />
						) : null}
						<Alert variant={resultItems.length === 0 ? "info" : "default"}>
							<AlertTitle>
								{resultItems.length === 0
									? messages.noResultsTitle({ subject: subjectLabel })
									: messages.notListedTitle}
							</AlertTitle>
							<AlertDescription>
								{resultItems.length === 0
									? messages.noResultsDescription
									: messages.notListedDescription}
							</AlertDescription>
							<AlertAction>
								<Button asChild size="sm" variant="solid">
									<Link
										href={
											subject.kind === "tag" && unitTagVoteTarget
												? unitTagVoteCreateHref(
														displayedState.query,
														unitTagVoteTarget,
													)
												: publicEntryCreationHref(
														subject,
														displayedState.query,
													)
										}
									>
										{messages.createAction}
									</Link>
								</Button>
							</AlertAction>
						</Alert>
					</section>
				)}
			</div>
		</section>
	);
}

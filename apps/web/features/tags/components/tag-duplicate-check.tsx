"use client";

import { getApiTagsSuggestions } from "@rezics/openapi-tanstack-query";
import { Alert, AlertDescription, Button } from "@rezics/ui";
import { Check, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { presentTagSuggestion, type TagSelectionOption } from "../model/tag-suggestion";
import { tagDetailHref } from "../routing/tag-links";

export function TagDuplicateCheck({
	confirmed,
	onConfirmedChange,
	onUseExisting,
	title,
}: {
	readonly confirmed: boolean;
	readonly onConfirmedChange: (confirmed: boolean) => void;
	readonly onUseExisting?: (tagId: string) => Promise<void>;
	readonly title: string;
}) {
	const { t } = useTranslation(["tags"]);
	const localizationLanguages = useLocalizationLanguages();
	const [matches, setMatches] = useState<readonly TagSelectionOption[]>([]);
	const [isPending, setIsPending] = useState(false);
	const [searchError, setSearchError] = useState<unknown>(null);
	const [useError, setUseError] = useState<unknown>(null);
	const [usingTagId, setUsingTagId] = useState<string | null>(null);

	useEffect(() => {
		const query = title.trim();
		if (!query) {
			setMatches([]);
			setIsPending(false);
			setSearchError(null);
			return;
		}
		const request = new AbortController();
		const timer = window.setTimeout(() => {
			setIsPending(true);
			setSearchError(null);
			void getApiTagsSuggestions({
				query: { q: query, limit: 20, localizationLanguages },
				signal: request.signal,
				throwOnError: true,
			})
				.then(
					(response) => {
						if (request.signal.aborted) return;
						setMatches(
							response.data.items
								.filter((item) => item.selection === "direct_expression")
								.slice(0, 5)
								.map((item) =>
									presentTagSuggestion(item, {
										unnamedTag: t.tags.unnamedTag,
										unnamedPathMember: t.tags.paths.memberFallback,
									}),
								),
						);
					},
					(error: unknown) => {
						if (!request.signal.aborted) {
							setMatches([]);
							setSearchError(error);
						}
					},
				)
				.finally(() => {
					if (!request.signal.aborted) setIsPending(false);
				});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			request.abort();
		};
	}, [localizationLanguages, t.tags.paths.memberFallback, t.tags.unnamedTag, title]);

	const exactMatch = matches.find(({ matchKind }) => matchKind === "exact");
	const canConfirm = Boolean(title.trim()) && !isPending && !searchError && !exactMatch;

	async function useExisting(match: TagSelectionOption) {
		if (!onUseExisting || usingTagId) return;
		setUsingTagId(match.tagId);
		setUseError(null);
		try {
			await onUseExisting(match.tagId);
		} catch (error) {
			setUseError(error);
			setUsingTagId(null);
		}
	}

	return (
		<div className="grid gap-3 rounded-xl border border-border-weak p-4">
			<div className="grid gap-1">
				<div className="flex items-center gap-2 font-medium text-sm">
					<Search aria-hidden className="size-4 text-muted-foreground" />
					<span>{t.tags.create.duplicateTitle}</span>
				</div>
				<p className="text-muted-foreground text-sm leading-6">
					{t.tags.create.duplicateDescription}
				</p>
			</div>
			{isPending ? (
				<p className="text-muted-foreground text-sm" role="status">
					{t.tags.create.duplicateSearching}
				</p>
			) : searchError ? (
				<Alert variant="warning">
					<AlertDescription>{t.tags.create.duplicateSearchError}</AlertDescription>
				</Alert>
			) : matches.length ? (
				<div className="grid gap-2">
					<p className="font-medium text-sm">{t.tags.create.duplicateMatches}</p>
					<ul className="grid gap-2">
						{matches.map((match) => (
							<li
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-weak px-3 py-2"
								key={match.selectionKey}
							>
								<span className="min-w-0 flex-1 truncate text-sm">{match.label}</span>
								{onUseExisting ? (
									<Button
										isLoading={usingTagId === match.tagId}
										onClick={() => void useExisting(match)}
										size="sm"
										variant={match.matchKind === "exact" ? "solid" : "outline"}
									>
										{t.tags.create.useExisting}
									</Button>
								) : (
									<Button asChild size="sm" variant="outline">
										<Link href={tagDetailHref(match.tagId)}>{t.tags.create.viewExisting}</Link>
									</Button>
								)}
							</li>
						))}
					</ul>
				</div>
			) : title.trim() ? (
				<p className="text-muted-foreground text-sm">{t.tags.create.duplicateNoMatches}</p>
			) : null}
			{exactMatch ? (
				<Alert variant="warning">
					<AlertDescription>{t.tags.create.exactDuplicateBlocked}</AlertDescription>
				</Alert>
			) : confirmed ? (
				<div className="flex items-center gap-2 text-success text-sm" role="status">
					<Check aria-hidden className="size-4" />
					<span>{t.tags.create.duplicateConfirmed}</span>
				</div>
			) : (
				<Button
					className="w-fit"
					disabled={!canConfirm}
					onClick={() => onConfirmedChange(true)}
					size="sm"
					variant="outline"
				>
					{t.tags.create.continueDistinct}
				</Button>
			)}
			<RequestFailure error={useError} fallback={t.tags.create.useExistingError} />
		</div>
	);
}

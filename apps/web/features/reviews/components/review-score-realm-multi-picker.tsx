"use client";

import { useListCollection } from "@ark-ui/react";
import {
	Badge,
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useEntitySearch,
} from "@rezics/ui";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import type { ReviewScoreRealmOption } from "../model/review-score-association";

function uniqueOptions(
	selected: readonly ReviewScoreRealmOption[],
	options: readonly ReviewScoreRealmOption[],
): ReviewScoreRealmOption[] {
	const byRealmId = new Map(selected.map((option) => [option.realmId, option]));
	for (const option of options) byRealmId.set(option.realmId, option);
	return [...byRealmId.values()];
}

export function ReviewScoreRealmMultiPicker({
	excludedRealmIds,
	maximum,
	onChange,
	options,
	selected,
}: {
	readonly excludedRealmIds: ReadonlySet<string>;
	readonly maximum: number;
	readonly onChange: (selected: readonly ReviewScoreRealmOption[]) => void;
	readonly options: readonly ReviewScoreRealmOption[];
	readonly selected: readonly ReviewScoreRealmOption[];
}) {
	const { t } = useTranslation(["engagement", "state", "ui"]);
	const searchEntities = useEntitySearch();
	const availableOptions = useMemo(
		() => options.filter(({ realmId }) => !excludedRealmIds.has(realmId)),
		[excludedRealmIds, options],
	);
	const initialItems = useMemo(
		() => uniqueOptions(selected, availableOptions),
		[availableOptions, selected],
	);
	const { collection, set } = useListCollection<ReviewScoreRealmOption>({
		initialItems,
		itemToString: (item) => item.realmLabel,
		itemToValue: (item) => item.realmId,
	});
	const [inputValue, setInputValue] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [isError, setIsError] = useState(false);

	useEffect(() => {
		set(initialItems);
	}, [initialItems, set]);

	useEffect(() => {
		const query = inputValue.trim();
		if (!query || !searchEntities) {
			set(initialItems);
			setIsPending(false);
			setIsError(false);
			return;
		}
		const request = new AbortController();
		const timer = window.setTimeout(() => {
			setIsPending(true);
			setIsError(false);
			void searchEntities("realms", query, request.signal)
				.then(
					(hits) => {
						if (request.signal.aborted) return;
						const existing = new Map(options.map((option) => [option.realmId, option]));
						const matches = hits.flatMap((hit): ReviewScoreRealmOption[] =>
							excludedRealmIds.has(hit.id)
								? []
								: [
										existing.get(hit.id) ?? {
											realmId: hit.id,
											realmLabel: hit.label,
										},
									],
						);
						set(uniqueOptions(selected, matches));
					},
					() => {
						if (!request.signal.aborted) {
							set(initialItems);
							setIsError(true);
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
	}, [excludedRealmIds, initialItems, inputValue, options, searchEntities, selected, set]);

	return (
		<Combobox
			collection={collection}
			inputValue={inputValue}
			multiple
			onInputValueChange={({ inputValue: nextInputValue }) => setInputValue(nextInputValue)}
			onValueChange={({ value }) => {
				const byRealmId = new Map(collection.items.map((item) => [item.realmId, item]));
				onChange(
					value
						.flatMap((realmId) => {
							const option = byRealmId.get(realmId);
							return option ? [option] : [];
						})
						.slice(0, maximum),
				);
				setInputValue("");
			}}
			value={selected.map(({ realmId }) => realmId)}
		>
			<ComboboxInput
				aria-label={t.engagement.selectScoreRealms}
				className="h-auto min-h-10 [&_[data-slot=input-group-input]]:min-w-28 [&_[data-slot=input-group-input]]:flex-1"
				placeholder={selected.length ? "" : t.ui.pickerPlaceholders.realm}
				type="search"
			>
				{selected.map((option) => (
					<Badge
						className="my-0.5 max-w-56 gap-1.5"
						key={option.realmId}
						variant="secondary"
					>
						<span className="truncate">{option.realmLabel}</span>
						{option.value === undefined ? null : (
							<span className="text-muted-foreground">
								{t.engagement.scoreOutOfTen({
									score: String(option.value),
								})}
							</span>
						)}
						<button
							aria-label={t.engagement.removeScoreRealm({
								realm: option.realmLabel,
							})}
							className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={(event) => {
								event.stopPropagation();
								onChange(
									selected.filter(
										(candidate) => candidate.realmId !== option.realmId,
									),
								);
							}}
							type="button"
						>
							<X aria-hidden className="size-3" />
						</button>
					</Badge>
				))}
			</ComboboxInput>
			<ComboboxContent className="min-w-[min(28rem,calc(100vw-2rem))]">
				{isPending ? (
					<p className="px-2 py-2 text-muted-foreground text-sm">{t.state.loading}</p>
				) : isError ? (
					<p className="px-2 py-2 text-destructive text-sm" role="alert">
						{t.state.error}
					</p>
				) : (
					<>
						<ComboboxList>
							{collection.items.map((item) => (
								<ComboboxItem item={item} key={item.realmId}>
									<span className="min-w-0 flex-1 truncate">
										{item.realmLabel}
									</span>
									{item.value === undefined ? null : (
										<span className="text-muted-foreground">
											{t.engagement.scoreOutOfTen({
												score: String(item.value),
											})}
										</span>
									)}
								</ComboboxItem>
							))}
						</ComboboxList>
						<ComboboxEmpty>{t.state.empty}</ComboboxEmpty>
					</>
				)}
			</ComboboxContent>
		</Combobox>
	);
}

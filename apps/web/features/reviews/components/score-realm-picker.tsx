"use client";

import { useListCollection } from "@ark-ui/react";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useEntitySearch,
} from "@rezics/ui";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import type { UnitScore } from "../model/score-value";

export interface ScoreRealmOption {
	readonly id: string;
	readonly label: string;
	readonly score?: UnitScore;
}

function includeSelected(
	options: readonly ScoreRealmOption[],
	selected: ScoreRealmOption | undefined,
): ScoreRealmOption[] {
	if (!selected || options.some(({ id }) => id === selected.id)) return [...options];
	return [selected, ...options];
}

export function ScoreRealmPicker({
	onChange,
	options,
	value,
}: {
	readonly onChange: (value: ScoreRealmOption) => void;
	readonly options: readonly ScoreRealmOption[];
	readonly value?: ScoreRealmOption;
}) {
	const { t } = useTranslation(["engagement", "search", "state"]);
	const searchEntities = useEntitySearch();
	const baseOptions = useMemo(() => includeSelected(options, value), [options, value]);
	const { collection, set } = useListCollection<ScoreRealmOption>({
		initialItems: baseOptions,
		itemToString: (item) => item.label,
		itemToValue: (item) => item.id,
	});
	const [inputValue, setInputValue] = useState(value?.label ?? "");
	const [open, setOpen] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [isError, setIsError] = useState(false);

	useEffect(() => {
		if (!open) {
			set(baseOptions);
			setIsPending(false);
			setIsError(false);
			return;
		}
		const query = inputValue.trim();
		if (!query || !searchEntities) {
			set(baseOptions);
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
						const scores = new Map(options.map((option) => [option.id, option.score]));
						const matches = hits.map((hit) => ({
							id: hit.id,
							label: hit.label,
							score: scores.get(hit.id),
						}));
						set(includeSelected(matches, value));
					},
					() => {
						if (!request.signal.aborted) {
							set(baseOptions);
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
	}, [baseOptions, inputValue, open, options, searchEntities, set, value]);

	return (
		<Combobox
			collection={collection}
			inputValue={inputValue}
			onInputValueChange={({ inputValue: nextInputValue }) => setInputValue(nextInputValue)}
			onOpenChange={({ open: nextOpen }) => {
				setOpen(nextOpen);
				setInputValue(nextOpen ? "" : (value?.label ?? ""));
			}}
			onValueChange={({ value: selectedValues }) => {
				const selected = collection.items.find((item) => item.id === selectedValues[0]);
				if (!selected) return;
				onChange(selected);
				setInputValue(selected.label);
			}}
			open={open}
			value={value ? [value.id] : []}
		>
			<ComboboxInput
				aria-label={t.engagement.scoreRealm}
				placeholder={t.search.placeholder}
				type="search"
			/>
			<ComboboxContent>
				{isPending ? (
					<p className="px-2 py-1.5 text-muted-foreground text-sm">{t.state.loading}</p>
				) : isError ? (
					<p className="px-2 py-1.5 text-destructive text-sm" role="alert">
						{t.state.error}
					</p>
				) : (
					<>
						<ComboboxList>
							{collection.items.map((item) => (
								<ComboboxItem item={item} key={item.id}>
									<span className="min-w-0 flex-1 truncate">{item.label}</span>
									{item.score === undefined ? null : (
										<span className="text-muted-foreground">
											{t.engagement.scoreOutOfTen({
												score: String(item.score),
											})}
										</span>
									)}
								</ComboboxItem>
							))}
						</ComboboxList>
						<ComboboxEmpty>
							{inputValue.trim() ? t.state.empty : t.engagement.noScoredRealms}
						</ComboboxEmpty>
					</>
				)}
			</ComboboxContent>
		</Combobox>
	);
}

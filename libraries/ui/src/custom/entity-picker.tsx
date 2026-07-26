"use client";

import { useFilter, useListCollection } from "@ark-ui/react";
import { useEffect, useState } from "react";

import { useEntitySearch, useUiMessages } from "./ui-provider";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "../ui/combobox";

type EntityPickerValue = { id: string; label: string };

export function EntityPicker({
	index,
	kind,
	value,
	onChange,
}: {
	index: string;
	kind?: string;
	value?: EntityPickerValue;
	onChange: (value: EntityPickerValue) => void;
}) {
	const messages = useUiMessages();
	const searchEntities = useEntitySearch();
	const { contains } = useFilter({ sensitivity: "base" });
	const { collection, filter, set } = useListCollection<EntityPickerValue>({
		filter: contains,
		initialItems: [],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.id,
	});
	const [inputValue, setInputValue] = useState(value?.label ?? "");
	const [isPending, setIsPending] = useState(false);
	const [isError, setIsError] = useState(false);

	useEffect(() => {
		const query = inputValue.trim();
		if (!query || !searchEntities) {
			set([]);
			setIsPending(false);
			setIsError(false);
			return;
		}
		let controller: AbortController | undefined;
		const timer = window.setTimeout(() => {
			const request = new AbortController();
			controller = request;
			setIsPending(true);
			setIsError(false);
			void searchEntities(index, query, request.signal)
				.then(
					(nextHits) => {
						if (!request.signal.aborted)
							set(nextHits.filter((hit) => !kind || hit.kind === kind));
					},
					() => {
						if (!request.signal.aborted) {
							set([]);
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
			controller?.abort();
		};
	}, [index, inputValue, kind, searchEntities, set]);

	useEffect(() => {
		setInputValue(value?.label ?? "");
	}, [value?.id, value?.label]);

	return (
		<div className="grid gap-2">
			<Combobox
				collection={collection}
				inputValue={inputValue}
				onInputValueChange={({ inputValue: nextInputValue }) => {
					setInputValue(nextInputValue);
					filter(nextInputValue);
				}}
				onValueChange={({ value: selectedValues }) => {
					const selected = collection.items.find((item) => item.id === selectedValues[0]);
					if (!selected) return;
					onChange(selected);
					setInputValue(selected.label);
				}}
				value={value ? [value.id] : []}
			>
				<ComboboxInput
					aria-label={messages.searchPlaceholder}
					placeholder={messages.searchPlaceholder}
					type="search"
				/>
				<ComboboxContent>
					{isPending ? (
						<p className="px-2 py-1.5 text-muted-foreground text-sm">
							{messages.loading}
						</p>
					) : isError ? (
						<p className="px-2 py-1.5 text-destructive text-sm" role="alert">
							{messages.error}
						</p>
					) : (
						<>
							<ComboboxList>
								{collection.items.map((item) => (
									<ComboboxItem item={item} key={item.id}>
										{item.label || messages.unnamed}
									</ComboboxItem>
								))}
							</ComboboxList>
							{inputValue.trim() && <ComboboxEmpty>{messages.empty}</ComboboxEmpty>}
						</>
					)}
				</ComboboxContent>
			</Combobox>
		</div>
	);
}

"use client";

import { useFilter, useListCollection } from "@ark-ui/react";
import { useEffect, useState } from "react";

import { useEntitySearch, useUiMessages, type EntitySearch } from "./ui-provider";
import { IdentityAvatar } from "./identity-avatar";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "../ui/combobox";

/**
 * Presentation accepted and returned by {@link EntityPicker}.
 *
 * @alpha
 */
export interface EntityPickerValue {
	readonly id: string;
	readonly label: string;
	readonly kind?: string;
	readonly avatar?: import("@rezics/avatar").PresentedAvatar | null;
}

export function EntityPicker({
	ariaLabel,
	index,
	kind,
	kinds,
	value,
	onChange,
	onClear,
	search,
}: {
	ariaLabel?: string;
	index: string;
	kind?: string;
	kinds?: readonly string[];
	value?: EntityPickerValue;
	onChange: (value: EntityPickerValue) => void;
	onClear?: () => void;
	search?: EntitySearch;
}) {
	const messages = useUiMessages();
	const contextSearch = useEntitySearch();
	const searchEntities = search ?? contextSearch;
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
	const allowedKinds = kinds ?? (kind ? [kind] : undefined);
	const allowedKindsKey = allowedKinds?.join("\u0000");

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
						if (request.signal.aborted) return;
						const allowed = allowedKindsKey
							? new Set(allowedKindsKey.split("\u0000"))
							: undefined;
						set(
							nextHits.filter(
								(hit) =>
									!allowed || (hit.kind !== undefined && allowed.has(hit.kind)),
							),
						);
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
	}, [allowedKindsKey, index, inputValue, searchEntities, set]);

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
					if (!nextInputValue && value) onClear?.();
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
					aria-label={ariaLabel ?? messages.searchPlaceholder}
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
										<IdentityAvatar
											avatar={item.avatar}
											className="size-7"
											fallback={item.label.slice(0, 1) || "?"}
										/>
										<span className="min-w-0 flex-1 truncate">
											{item.label || messages.unnamed}
										</span>
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

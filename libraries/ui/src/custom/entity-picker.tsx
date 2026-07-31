"use client";

import { useFilter, useListCollection } from "@ark-ui/react";
import { useEffect, useState, type ReactNode } from "react";

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

type EntityPickerSearchResolution =
	| { readonly status: "idle" }
	| { readonly status: "pending"; readonly query: string }
	| { readonly status: "ready"; readonly query: string }
	| { readonly status: "error"; readonly query: string };

export function EntityPicker({
	ariaLabel,
	index,
	kind,
	kinds,
	invalid,
	maxLength,
	placeholder,
	value,
	onChange,
	onClear,
	search,
	searchOnOpen = false,
	renderNoResultsAction,
}: {
	ariaLabel: string;
	index: string;
	kind?: string;
	kinds?: readonly string[];
	invalid?: boolean;
	maxLength?: number;
	placeholder: string;
	value?: EntityPickerValue;
	onChange: (value: EntityPickerValue) => void;
	onClear?: () => void;
	search?: EntitySearch;
	/**
	 * Runs a search with an empty query when the combobox opens.
	 *
	 * @remarks
	 * Use this only when the search owner supports a meaningful filtered list
	 * without a text query.
	 */
	searchOnOpen?: boolean;
	/**
	 * Renders an owner-provided action after a successful search returns no matches.
	 *
	 * @remarks
	 * The action is placed after the combobox so it remains in the normal keyboard
	 * tab order instead of becoming an interactive descendant of the listbox.
	 *
	 * @alpha
	 */
	renderNoResultsAction?: (query: string) => ReactNode;
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
	const [searchResolution, setSearchResolution] = useState<EntityPickerSearchResolution>({
		status: "idle",
	});
	const [open, setOpen] = useState(false);
	const allowedKinds = kinds ?? (kind ? [kind] : undefined);
	const allowedKindsKey = allowedKinds?.join("\u0000");

	useEffect(() => {
		const query = inputValue.trim();
		const shouldSearch =
			Boolean(searchEntities) && (query.length > 0 || (searchOnOpen && open));
		if (!shouldSearch || !searchEntities) {
			set([]);
			setSearchResolution({ status: "idle" });
			return;
		}
		setSearchResolution({ status: "pending", query });
		let controller: AbortController | undefined;
		const timer = window.setTimeout(
			() => {
				const request = new AbortController();
				controller = request;
				const requestedKinds = allowedKindsKey?.split("\u0000");
				void searchEntities(index, query, request.signal, { kinds: requestedKinds }).then(
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
						setSearchResolution({ status: "ready", query });
					},
					() => {
						if (!request.signal.aborted) {
							set([]);
							setSearchResolution({ status: "error", query });
						}
					},
				);
			},
			query ? 250 : 0,
		);
		return () => {
			window.clearTimeout(timer);
			controller?.abort();
		};
	}, [allowedKindsKey, index, inputValue, open, searchEntities, searchOnOpen, set]);

	useEffect(() => {
		setInputValue(value?.label ?? "");
	}, [value?.id, value?.label]);

	const query = inputValue.trim();
	const currentResolution =
		searchResolution.status !== "idle" && searchResolution.query === query
			? searchResolution
			: ({ status: "idle" } as const);
	const shouldSearch = Boolean(searchEntities) && (query.length > 0 || (searchOnOpen && open));
	const isPending = shouldSearch && currentResolution.status === "idle";
	const showNoResultsAction =
		query.length > 0 &&
		currentResolution.status === "ready" &&
		collection.items.length === 0 &&
		renderNoResultsAction;

	return (
		<div className="grid gap-2">
			<Combobox
				collection={collection}
				inputValue={inputValue}
				onInputValueChange={({ inputValue: nextInputValue }) => {
					setInputValue(nextInputValue);
					filter(nextInputValue);
				}}
				onOpenChange={({ open: nextOpen }) => setOpen(nextOpen)}
				onValueChange={({ value: selectedValues }) => {
					const selected = collection.items.find((item) => item.id === selectedValues[0]);
					if (!selected) {
						if (value && selectedValues.length === 0) onClear?.();
						return;
					}
					onChange(selected);
					setInputValue(selected.label);
				}}
				value={value ? [value.id] : []}
			>
				<ComboboxInput
					aria-label={ariaLabel}
					aria-invalid={invalid || undefined}
					maxLength={maxLength}
					onChange={(event) => {
						if (value && event.currentTarget.value !== value.label) onClear?.();
					}}
					placeholder={placeholder}
					type="search"
				/>
				<ComboboxContent>
					{isPending || currentResolution.status === "pending" ? (
						<p className="px-2 py-1.5 text-muted-foreground text-sm">
							{messages.loading}
						</p>
					) : currentResolution.status === "error" ? (
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
							{(query || (searchOnOpen && open)) && (
								<ComboboxEmpty>{messages.empty}</ComboboxEmpty>
							)}
						</>
					)}
				</ComboboxContent>
			</Combobox>
			{showNoResultsAction ? (
				<div aria-live="polite">{renderNoResultsAction(query)}</div>
			) : null}
		</div>
	);
}

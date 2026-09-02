"use client";

import { useListCollection } from "@ark-ui/react";
import { getApiTagsSuggestions } from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	Popover,
	PopoverBody,
	PopoverClose,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@rezics/ui";
import { Check, Info, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { presentTagSuggestion, type TagSelectionOption } from "../model/tag-suggestion";
import { tagDetailHref } from "../routing/tag-links";

export type TagSelectionCommitResult =
	| { readonly selectionKey: string; readonly status: "added" }
	| { readonly selectionKey: string; readonly status: "failed"; readonly error: unknown };

function mergeOptions(
	selected: readonly TagSelectionOption[],
	hits: readonly TagSelectionOption[],
): TagSelectionOption[] {
	const options = new Map(selected.map((option) => [option.selectionKey, option]));
	for (const hit of hits) options.set(hit.selectionKey, hit);
	return [...options.values()];
}

function DraftTagBadge({
	error,
	onRemove,
	option,
}: {
	readonly error: boolean;
	readonly onRemove: () => void;
	readonly option: TagSelectionOption;
}) {
	const { t } = useTranslation(["tags"]);
	const kindLabel =
		option.kind === "path_sense"
			? t.tags.expressions.pathApplication
			: t.tags.expressions.directApplication;
	return (
		<Badge
			className="my-0.5 max-w-full gap-0 overflow-visible p-0"
			pill
			variant={error ? "destructive" : "secondary"}
		>
			<Popover positioning={{ gutter: 8, placement: "bottom-start" }}>
				<PopoverTrigger asChild>
					<button
						aria-label={t.tags.picker.open({ tag: option.label })}
						className="inline-flex min-w-0 max-w-64 items-center gap-1.5 rounded-full px-2.5 py-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/40"
						type="button"
					>
						<span className="truncate">{option.label}</span>
						<Info aria-hidden className="size-3.5 shrink-0 opacity-60" />
					</button>
				</PopoverTrigger>
				<PopoverContent className="max-h-[min(28rem,calc(100dvh-2rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
					<PopoverHeader className="pe-12">
						<PopoverTitle>{option.label}</PopoverTitle>
						<PopoverDescription>{kindLabel}</PopoverDescription>
						<PopoverClose asChild>
							<Button
								aria-label={t.tags.picker.close}
								className="absolute end-2 top-2"
								size="icon-sm"
								variant="quiet"
							>
								<X aria-hidden />
							</Button>
						</PopoverClose>
					</PopoverHeader>
					<PopoverBody className="grid gap-4">
						{option.pathLabel ? (
							<div className="grid gap-1">
								<span className="font-medium text-xs">{t.tags.picker.path}</span>
								<p className="text-muted-foreground text-sm leading-6">{option.pathLabel}</p>
							</div>
						) : null}
						<Button asChild className="w-fit" size="sm" variant="outline">
							<Link href={tagDetailHref(option.tagId)}>{t.tags.card.details}</Link>
						</Button>
					</PopoverBody>
				</PopoverContent>
			</Popover>
			<button
				aria-label={t.tags.picker.remove({ tag: option.label })}
				className="me-0.5 inline-grid size-7 shrink-0 place-items-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/40"
				onClick={(event) => {
					event.stopPropagation();
					onRemove();
				}}
				type="button"
			>
				<X aria-hidden className="size-3.5" />
			</button>
		</Badge>
	);
}

export function TagSelectionMultiPicker({
	actionLabel,
	ariaLabel,
	contextRealmId,
	onCommit,
	placeholder,
}: {
	readonly actionLabel: string;
	readonly ariaLabel: string;
	readonly contextRealmId?: string;
	readonly onCommit: (
		selections: readonly TagSelectionOption[],
	) => Promise<readonly TagSelectionCommitResult[]>;
	readonly placeholder: string;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const [selected, setSelected] = useState<readonly TagSelectionOption[]>([]);
	const [hits, setHits] = useState<readonly TagSelectionOption[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [searchError, setSearchError] = useState<unknown>(null);
	const [commitError, setCommitError] = useState<unknown>(null);
	const [failedKeys, setFailedKeys] = useState<ReadonlySet<string>>(new Set());
	const [isCommitting, setIsCommitting] = useState(false);
	const { collection, set } = useListCollection<TagSelectionOption>({
		initialItems: [],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.selectionKey,
	});
	const selectedKeys = useMemo(
		() => new Set(selected.map(({ selectionKey }) => selectionKey)),
		[selected],
	);
	const availableHits = hits.filter(({ selectionKey }) => !selectedKeys.has(selectionKey));
	const directHits = availableHits.filter(({ kind }) => kind === "direct_expression");
	const pathHits = availableHits.filter(({ kind }) => kind === "path_sense");

	useEffect(() => {
		set(mergeOptions(selected, hits));
	}, [hits, selected, set]);

	useEffect(() => {
		const query = inputValue.trim();
		if (!query) {
			setIsPending(false);
			setSearchError(null);
			return;
		}
		const request = new AbortController();
		const timer = window.setTimeout(() => {
			setIsPending(true);
			setSearchError(null);
			void getApiTagsSuggestions({
				query: {
					q: query,
					limit: 20,
					localizationLanguages,
					...(contextRealmId ? { realmId: contextRealmId } : {}),
				},
				signal: request.signal,
				throwOnError: true,
			})
				.then(
					(response) => {
						if (request.signal.aborted) return;
						setHits(
							response.data.items.map((item) =>
								presentTagSuggestion(item, {
									unnamedTag: t.tags.unnamedTag,
									unnamedPathMember: t.tags.paths.memberFallback,
								}),
							),
						);
					},
					(error: unknown) => {
						if (!request.signal.aborted) {
							setHits([]);
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
	}, [
		contextRealmId,
		inputValue,
		localizationLanguages,
		t.tags.paths.memberFallback,
		t.tags.unnamedTag,
	]);

	async function commit() {
		if (!selected.length || isCommitting) return;
		setIsCommitting(true);
		setCommitError(null);
		try {
			const results = await onCommit(selected);
			const added = new Set(
				results
					.filter((result) => result.status === "added")
					.map(({ selectionKey }) => selectionKey),
			);
			const failed = results.filter((result) => result.status === "failed");
			setSelected((current) => current.filter(({ selectionKey }) => !added.has(selectionKey)));
			setFailedKeys(new Set(failed.map(({ selectionKey }) => selectionKey)));
			setCommitError(failed[0]?.error ?? null);
		} catch (error) {
			setFailedKeys(new Set(selected.map(({ selectionKey }) => selectionKey)));
			setCommitError(error);
		} finally {
			setIsCommitting(false);
		}
	}

	return (
		<div className="grid gap-3">
			<Combobox
				aria-label={ariaLabel}
				closeOnSelect={false}
				collection={collection}
				inputValue={inputValue}
				multiple
				onInputValueChange={({ inputValue: nextInputValue }) => setInputValue(nextInputValue)}
				onValueChange={({ value }) => {
					const options = new Map(collection.items.map((item) => [item.selectionKey, item]));
					setSelected(
						value.flatMap((selectionKey) => {
							const option = options.get(selectionKey);
							return option ? [option] : [];
						}),
					);
					setFailedKeys(new Set());
					setCommitError(null);
					setInputValue("");
				}}
				positioning={{ gutter: 4, placement: "bottom-start", sameWidth: true }}
				value={selected.map(({ selectionKey }) => selectionKey)}
			>
				<ComboboxInput
					className="h-auto min-h-11 [&_[data-slot=input-group-input]]:min-w-32 [&_[data-slot=input-group-input]]:flex-1"
					placeholder={selected.length ? t.tags.picker.searchMore : placeholder}
					type="search"
				>
					{selected.map((option) => (
						<DraftTagBadge
							error={failedKeys.has(option.selectionKey)}
							key={option.selectionKey}
							onRemove={() => {
								setSelected((current) =>
									current.filter(({ selectionKey }) => selectionKey !== option.selectionKey),
								);
								setFailedKeys((current) => {
									const next = new Set(current);
									next.delete(option.selectionKey);
									return next;
								});
							}}
							option={option}
						/>
					))}
				</ComboboxInput>
				<ComboboxContent className="max-h-[min(24rem,calc(100dvh-2rem))] min-w-[min(30rem,calc(100vw-2rem))]">
					{isPending ? (
						<p className="px-2 py-2 text-muted-foreground text-sm" role="status">
							{t.tags.picker.loading}
						</p>
					) : searchError ? (
						<p className="px-2 py-2 text-destructive text-sm" role="alert">
							{t.tags.picker.searchError}
						</p>
					) : (
						<ComboboxList>
							{directHits.length ? (
								<ComboboxGroup heading={t.tags.picker.directResults}>
									{directHits.map((option) => (
										<ComboboxItem item={option} key={option.selectionKey}>
											<span className="min-w-0 flex-1 truncate">{option.label}</span>
										</ComboboxItem>
									))}
								</ComboboxGroup>
							) : null}
							{pathHits.length ? (
								<ComboboxGroup heading={t.tags.picker.pathResults}>
									{pathHits.map((option) => (
										<ComboboxItem item={option} key={option.selectionKey}>
											<div className="grid min-w-0 flex-1 gap-0.5">
												<span className="truncate">{option.label}</span>
												<span className="truncate text-muted-foreground text-xs">
													{option.pathLabel}
												</span>
											</div>
										</ComboboxItem>
									))}
								</ComboboxGroup>
							) : null}
							{inputValue.trim() && !availableHits.length ? (
								<ComboboxEmpty>{t.tags.picker.noResults}</ComboboxEmpty>
							) : null}
						</ComboboxList>
					)}
				</ComboboxContent>
			</Combobox>
			<div className="flex flex-wrap items-center gap-3">
				<Button disabled={!selected.length} isLoading={isCommitting} onClick={() => void commit()}>
					<Check aria-hidden />
					{selected.length ? t.tags.picker.addSelected({ count: selected.length }) : actionLabel}
				</Button>
				{selected.length ? (
					<span className="text-muted-foreground text-sm" aria-live="polite">
						{t.tags.picker.selectedCount({ count: selected.length })}
					</span>
				) : null}
			</div>
			<RequestFailure error={commitError} fallback={t.tags.picker.commitError} />
		</div>
	);
}

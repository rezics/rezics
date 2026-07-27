"use client";

import { CheckIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../utils";

export interface PermissionMatrixAction<Value extends string> {
	value: Value;
	label: string;
	description?: string;
	disabled?: boolean;
	required?: boolean;
	tone?: "default" | "destructive";
}

export interface PermissionMatrixResource<Value extends string> {
	id: string;
	category: string;
	label: string;
	description?: string;
	keywords?: readonly string[];
	actions: readonly PermissionMatrixAction<Value>[];
}

export interface PermissionMatrixTemplate<Value extends string> {
	id: string;
	label: string;
	values: ReadonlySet<Value>;
}

export interface PermissionMatrixLabels {
	templates: string;
	permissions: string;
	searchPlaceholder: string;
	clear: string;
	selected: (selected: number, total: number) => string;
	categorySelected: (selected: number) => string;
	required: string;
	empty: string;
}

interface PermissionMatrixProps<Value extends string> {
	resources: readonly PermissionMatrixResource<Value>[];
	value: ReadonlySet<Value>;
	onValueChange: (value: ReadonlySet<Value>) => void;
	labels: PermissionMatrixLabels;
	templates?: readonly PermissionMatrixTemplate<Value>[];
	/**
	 * When enabled, selecting an action clears the other actions for the same
	 * resource. This is useful for mutually exclusive states such as grant and
	 * restrict. Token scopes normally leave this disabled.
	 */
	singlePerResource?: boolean;
	className?: string;
}

function equalSets<Value>(left: ReadonlySet<Value>, right: ReadonlySet<Value>) {
	if (left.size !== right.size) return false;
	for (const item of left) {
		if (!right.has(item)) return false;
	}
	return true;
}

export function PermissionMatrix<Value extends string>({
	resources,
	value,
	onValueChange,
	labels,
	templates = [],
	singlePerResource = false,
	className,
}: PermissionMatrixProps<Value>) {
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
	const categories = useMemo(() => {
		const grouped = new Map<string, PermissionMatrixResource<Value>[]>();
		for (const resource of resources) {
			const haystack = [
				resource.category,
				resource.label,
				resource.description,
				...(resource.keywords ?? []),
				...resource.actions.flatMap((action) => [action.label, action.description]),
			]
				.filter((part): part is string => Boolean(part))
				.join(" ")
				.toLocaleLowerCase();
			if (deferredSearch && !haystack.includes(deferredSearch)) continue;
			const existing = grouped.get(resource.category);
			if (existing) existing.push(resource);
			else grouped.set(resource.category, [resource]);
		}
		return [...grouped.entries()];
	}, [deferredSearch, resources]);
	const allValues = useMemo(
		() =>
			new Set(
				resources.flatMap((resource) => resource.actions.map((action) => action.value)),
			),
		[resources],
	);
	const selectedTemplate = templates.find((template) => equalSets(template.values, value));

	function toggle(
		resource: PermissionMatrixResource<Value>,
		action: PermissionMatrixAction<Value>,
	) {
		if (action.disabled || action.required) return;
		const next = new Set(value);
		if (next.has(action.value)) {
			next.delete(action.value);
		} else {
			if (singlePerResource) {
				for (const peer of resource.actions) next.delete(peer.value);
			}
			next.add(action.value);
		}
		onValueChange(next);
	}

	function clear() {
		const required = new Set<Value>();
		for (const resource of resources) {
			for (const action of resource.actions) {
				if (action.required) required.add(action.value);
			}
		}
		onValueChange(required);
	}

	return (
		<div className={cn("grid gap-5", className)}>
			{templates.length ? (
				<section className="grid gap-2" aria-label={labels.templates}>
					<p className="font-medium text-sm text-muted-foreground">{labels.templates}</p>
					<div className="flex flex-wrap gap-2">
						{templates.map((template) => (
							<Button
								aria-pressed={selectedTemplate?.id === template.id}
								key={template.id}
								onClick={() => onValueChange(new Set(template.values))}
								size="sm"
								type="button"
								variant={
									selectedTemplate?.id === template.id ? "secondary" : "outline"
								}
							>
								{selectedTemplate?.id === template.id ? <CheckIcon /> : null}
								{template.label}
							</Button>
						))}
					</div>
				</section>
			) : null}

			<section className="grid gap-3" aria-label={labels.permissions}>
				<div className="flex items-center justify-between gap-4">
					<p className="font-medium text-sm text-muted-foreground">
						{labels.permissions}
					</p>
					<Button onClick={clear} size="sm" type="button" variant="ghost">
						{labels.clear}
					</Button>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative min-w-0 flex-1">
						<SearchIcon
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input
							className="ps-9"
							onChange={(event) => setSearch(event.currentTarget.value)}
							placeholder={labels.searchPlaceholder}
							type="search"
							value={search}
						/>
					</div>
					<p className="shrink-0 text-sm text-muted-foreground">
						{labels.selected(
							[...value].filter((item) => allValues.has(item)).length,
							allValues.size,
						)}
					</p>
				</div>

				{categories.length ? (
					<Accordion
						className="overflow-hidden rounded-xl border"
						defaultValue={categories.map(([category]) => category)}
						multiple
					>
						{categories.map(([category, categoryResources]) => {
							const selectedCount = categoryResources.reduce(
								(count, resource) =>
									count +
									resource.actions.filter((action) => value.has(action.value))
										.length,
								0,
							);
							return (
								<AccordionItem className="px-4" key={category} value={category}>
									<AccordionTrigger>
										<span>{category}</span>
										{selectedCount ? (
											<Badge className="ms-auto" variant="secondary">
												{labels.categorySelected(selectedCount)}
											</Badge>
										) : null}
									</AccordionTrigger>
									<AccordionContent className="[content-visibility:auto]">
										<div className="divide-y rounded-lg border">
											{categoryResources.map((resource) => (
												<div
													className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
													key={resource.id}
												>
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<p className="font-medium">
																{resource.label}
															</p>
															{resource.actions.some(
																(action) => action.required,
															) ? (
																<Badge variant="outline">
																	{labels.required}
																</Badge>
															) : null}
														</div>
														{resource.description ? (
															<p className="mt-0.5 text-muted-foreground text-xs">
																{resource.description}
															</p>
														) : null}
													</div>
													<div className="flex shrink-0 flex-wrap gap-1.5">
														{resource.actions.map((action) => {
															const selected = value.has(
																action.value,
															);
															return (
																<Button
																	aria-pressed={selected}
																	disabled={action.disabled}
																	key={action.value}
																	onClick={() =>
																		toggle(resource, action)
																	}
																	size="sm"
																	title={action.description}
																	type="button"
																	variant={
																		selected &&
																		action.tone ===
																			"destructive"
																			? "destructive"
																			: selected
																				? "secondary"
																				: "outline"
																	}
																>
																	{selected ? (
																		<CheckIcon />
																	) : null}
																	{action.label}
																</Button>
															);
														})}
													</div>
												</div>
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				) : (
					<div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
						{labels.empty}
					</div>
				)}
			</section>
		</div>
	);
}

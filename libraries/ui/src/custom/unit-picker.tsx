"use client";

import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "./button";
import { EntityPicker, type EntityPickerValue } from "./entity-picker";
import { IdentityAvatar } from "./identity-avatar";
import { useUiMessages, useUnitMentionResolver, type EntitySearch } from "./ui-provider";

interface ResolvedUnitValue {
	readonly sourceId: string;
	readonly value: EntityPickerValue;
}

function useResolvedUnitValues(unitIds: readonly string[]): readonly EntityPickerValue[] {
	const resolve = useUnitMentionResolver();
	const unitIdsKey = unitIds.join("\u0000");
	const [resolved, setResolved] = useState<readonly EntityPickerValue[]>([]);

	useEffect(() => {
		const requestedIds = unitIdsKey ? unitIdsKey.split("\u0000") : [];
		if (!requestedIds.length || !resolve) {
			setResolved([]);
			return;
		}
		const request = new AbortController();
		void resolve(requestedIds, request.signal).then(
			(items) => {
				if (!request.signal.aborted) setResolved(items);
			},
			() => {
				if (!request.signal.aborted) setResolved([]);
			},
		);
		return () => request.abort();
	}, [resolve, unitIdsKey]);

	return resolved;
}

/**
 * Selects one Unit through the application's searchable Unit index while preserving the Unit ID
 * as the submitted value.
 *
 * @alpha
 * @remarks
 * The picker resolves persisted IDs back to presentations and may restrict results to specific
 * Unit kinds. Exact UUID lookup is supplied by the application's entity-search provider.
 */
export function UnitPicker({
	ariaLabel,
	index = "units",
	kinds,
	name,
	onValueChange,
	search,
	value,
}: {
	readonly ariaLabel?: string;
	readonly index?: string;
	readonly kinds?: readonly string[];
	readonly name?: string;
	readonly onValueChange: (value: string | undefined) => void;
	readonly search?: EntitySearch;
	readonly value: string | undefined;
}) {
	const resolved = useResolvedUnitValues(value ? [value] : []);
	const [selected, setSelected] = useState<ResolvedUnitValue | undefined>();
	const resolvedValue = resolved.find((item) => item.id === value);
	const presentation =
		selected && selected.sourceId === value
			? selected.value
			: (resolvedValue ?? (value ? { id: value, label: "" } : undefined));

	return (
		<>
			<EntityPicker
				ariaLabel={ariaLabel}
				index={index}
				kinds={kinds}
				onChange={(next) => {
					setSelected({ sourceId: next.id, value: next });
					onValueChange(next.id);
				}}
				onClear={() => {
					setSelected(undefined);
					onValueChange(undefined);
				}}
				search={search}
				value={presentation}
			/>
			{name ? <input name={name} type="hidden" value={value ?? ""} /> : null}
		</>
	);
}

/**
 * Selects an ordered set of unique Unit IDs with the same search and persisted-ID resolution
 * contract as {@link UnitPicker}.
 *
 * @alpha
 */
export function UnitMultiPicker({
	ariaLabel,
	index = "units",
	kinds,
	maxValues,
	name,
	onValuesChange,
	removeLabel,
	values,
}: {
	readonly ariaLabel?: string;
	readonly index?: string;
	readonly kinds?: readonly string[];
	readonly maxValues?: number;
	readonly name?: string;
	readonly onValuesChange: (values: readonly string[]) => void;
	readonly removeLabel: string;
	readonly values: readonly string[];
}) {
	const messages = useUiMessages();
	const resolved = useResolvedUnitValues(values);
	const presentations = new Map(resolved.map((item) => [item.id, item]));

	return (
		<div className="grid gap-2">
			{values.length ? (
				<div className="flex flex-wrap gap-2">
					{values.map((id) => {
						const item = presentations.get(id);
						const label = item?.label || messages.loading;
						return (
							<Badge className="max-w-full gap-1.5" key={id} variant="secondary">
								<IdentityAvatar
									avatar={item?.avatar}
									className="size-4"
									fallback={item?.label.slice(0, 1) || "?"}
								/>
								<span className="max-w-64 truncate">{label}</span>
								<Button
									aria-label={`${removeLabel}: ${label}`}
									className="size-5"
									onClick={() =>
										onValuesChange(
											values.filter((candidate) => candidate !== id),
										)
									}
									size="icon-sm"
									type="button"
									variant="quiet"
								>
									<XIcon aria-hidden className="size-3" />
								</Button>
								{name ? <input name={name} type="hidden" value={id} /> : null}
							</Badge>
						);
					})}
				</div>
			) : null}
			{maxValues === undefined || values.length < maxValues ? (
				<EntityPicker
					ariaLabel={ariaLabel}
					index={index}
					key={values.join("\u0000")}
					kinds={kinds}
					onChange={(next) => {
						if (!values.includes(next.id)) onValuesChange([...values, next.id]);
					}}
				/>
			) : null}
		</div>
	);
}

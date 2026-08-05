"use client";

import {
	collectPortableTextPresentationUnitIds,
	type PortableTextValueUnitMention,
} from "@rezics/portable-text";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "../ui/badge";
import { IdentityAvatar } from "./identity-avatar";
import { type UnitMentionPresentation, useUiMessages, useUnitMentionResolver } from "./ui-provider";

const UnitMentionLabelMaxLength = 80;

export function useUnitMentionPresentations(
	value: unknown,
): ReadonlyMap<string, UnitMentionPresentation> {
	const resolveUnitMentions = useUnitMentionResolver();
	const identity = collectPortableTextPresentationUnitIds(value).join(",");
	const ids = useMemo(() => (identity ? identity.split(",") : []), [identity]);
	const [presentations, setPresentations] = useState<
		ReadonlyMap<string, UnitMentionPresentation>
	>(new Map());

	useEffect(() => {
		if (!resolveUnitMentions || ids.length === 0) {
			setPresentations(new Map());
			return;
		}
		const controller = new AbortController();
		void resolveUnitMentions(ids, controller.signal).then(
			(items) => {
				if (!controller.signal.aborted)
					setPresentations(new Map(items.map((item) => [item.id, item])));
			},
			() => {
				if (!controller.signal.aborted) setPresentations(new Map());
			},
		);
		return () => controller.abort();
	}, [ids, resolveUnitMentions]);

	return presentations;
}

export function UnitMentionBadge({
	value,
	presentation,
}: {
	value: PortableTextValueUnitMention;
	presentation?: UnitMentionPresentation;
}) {
	const messages = useUiMessages();
	const fullLabel = presentation?.label || messages.editor.unavailableMention;
	const label =
		fullLabel.length > UnitMentionLabelMaxLength
			? `${fullLabel.slice(0, UnitMentionLabelMaxLength - 1)}…`
			: fullLabel;

	return (
		<span
			className="mx-0.5 inline-flex max-w-56 translate-y-0.5 items-center align-baseline"
			contentEditable={false}
			data-unit-mention={value.unitId}
			title={fullLabel}
		>
			<IdentityAvatar
				avatar={presentation?.avatar}
				className="z-10 size-5 shrink-0 ring-2 ring-background"
				fallback={label.slice(0, 1).toUpperCase()}
			/>
			<Badge
				className="-ms-1.5 min-w-0 max-w-52 justify-start ps-2.5"
				pill
				size="md"
				variant="secondary"
			>
				<span className="truncate">{label}</span>
			</Badge>
		</span>
	);
}

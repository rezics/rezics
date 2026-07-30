"use client";

import { ChoiceSelect, IdentityAvatar } from "@rezics/ui";
import { Globe2Icon } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { useChineseContentTexts } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import type {
	RealmTagVoteContextPresentation,
	TagVoteContextSelection,
} from "../model/tag-presentation";

const GlobalContextValue = "global";
type RealmContextValue = `realm:${string}`;
type TagVoteContextValue = typeof GlobalContextValue | RealmContextValue;

function realmContextValue(realmId: string): RealmContextValue {
	return `realm:${realmId}`;
}

export function TagVoteContextSelector({
	onValueChange,
	realms,
	value,
}: {
	readonly onValueChange: (selection: TagVoteContextSelection) => void;
	readonly realms: readonly RealmTagVoteContextPresentation[];
	readonly value: TagVoteContextSelection;
}) {
	const { t } = useTranslation(["tags"]);
	const sourceTexts = useMemo(
		() =>
			realms.flatMap((realm) => [
				{
					value: realm.title ?? t.tags.unnamedRealm,
					language: realm.title ? realm.language : undefined,
				},
				{
					value: realm.summary ?? "",
					language: realm.summary ? realm.language : undefined,
				},
			]),
		[realms, t.tags.unnamedRealm],
	);
	const displayedTexts = useChineseContentTexts(sourceTexts);
	const options = [
		{
			value: GlobalContextValue,
			label: t.tags.global.title,
			icon: (
				<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
					<Globe2Icon aria-hidden className="size-3.5" />
				</span>
			),
		},
		...realms.map((realm, index) => {
			const name = displayedTexts[index * 2] ?? realm.title ?? t.tags.unnamedRealm;
			const summary = displayedTexts[index * 2 + 1];
			return {
				value: realmContextValue(realm.realmId),
				label: name,
				...(summary ? { description: summary } : {}),
				icon: (
					<IdentityAvatar
						avatar={realm.avatar}
						className="mt-0.5"
						fallback={Array.from(name.trim())[0]?.toLocaleUpperCase() ?? name}
						size="sm"
					/>
				),
			};
		}),
	] satisfies readonly {
		readonly value: TagVoteContextValue;
		readonly label: string;
		readonly description?: string;
		readonly icon: ReactNode;
	}[];
	const selectedValue =
		value.kind === "global" ? GlobalContextValue : realmContextValue(value.realm.realmId);

	return (
		<ChoiceSelect
			appearance="field"
			ariaLabel={t.tags.voteContext.select}
			className="w-full justify-between"
			contentClassName="w-[min(22rem,calc(100vw-2rem))]"
			onValueChange={([nextValue]) => {
				if (!nextValue) return;
				if (nextValue === GlobalContextValue) {
					onValueChange({ kind: "global" });
					return;
				}
				const realm = realms.find(
					(candidate) => realmContextValue(candidate.realmId) === nextValue,
				);
				if (realm) onValueChange({ kind: "realm", realm });
			}}
			options={options}
			placeholder={t.tags.voteContext.select}
			size="lg"
			value={[selectedValue]}
		/>
	);
}

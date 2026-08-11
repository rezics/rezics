"use client";

import { ArrowLeftIcon, Globe2Icon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useMemo, type ReactNode } from "react";

import { Button, Card, CardContent, ChoiceSelect, IdentityAvatar } from "@rezics/ui";
import {
	useChineseContentText,
	useChineseContentTexts,
} from "@/features/content-language-display/chinese-content-display-context";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import type { PostRealmContext, PostRealmContextSelection } from "../model/post-realm-context";

const GlobalContextOptionValue = "global";

type RealmContextOptionValue = `realm:${string}`;
type PostRealmContextOptionValue = typeof GlobalContextOptionValue | RealmContextOptionValue;

function realmContextOptionValue(realmId: string): RealmContextOptionValue {
	return `realm:${realmId}`;
}

type RealmContextBarValue = Pick<PostRealmContext, "avatar" | "id" | "slugAddress"> & {
	readonly language?: PostRealmContext["language"] | null;
	readonly title?: string | null;
};

function realmName(realm: Pick<RealmContextBarValue, "title">, unnamed: string): string {
	return realm.title ?? unnamed;
}

function realmInitials(name: string): string {
	return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? name;
}

/**
 * Selects the active Realm without owning or rendering any contextual dock.
 *
 * @remarks
 * Detail surfaces should render this selector first, the selected Realm's main
 * dock second, and future Zone, Book, or Post docks after those two independent
 * regions.
 *
 * @alpha
 */
export function PostRealmContextSelector({
	onValueChange,
	realms,
	value,
}: {
	readonly onValueChange: (selection: PostRealmContextSelection) => void;
	readonly realms: readonly PostRealmContext[];
	readonly value: PostRealmContextSelection;
}) {
	const { t } = useTranslation(["posts", "ui"]);
	const sourceTexts = useMemo(
		() =>
			realms.flatMap((realm) => [
				{
					value: realmName(realm, t.ui.unnamed),
					language: realm.title ? realm.language : undefined,
				},
				{
					value: realm.summary ?? "",
					language: realm.summary ? realm.language : undefined,
				},
			]),
		[realms, t.ui.unnamed],
	);
	const displayedTexts = useChineseContentTexts(sourceTexts);
	const options = [
		{
			value: GlobalContextOptionValue,
			label: t.posts.globalContext,
			icon: (
				<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
					<Globe2Icon aria-hidden className="size-3.5" />
				</span>
			),
		},
		...realms.map((realm, index) => {
			const name = displayedTexts[index * 2] ?? realmName(realm, t.ui.unnamed);
			const summary = displayedTexts[index * 2 + 1];
			return {
				value: realmContextOptionValue(realm.id),
				label: name,
				...(summary ? { description: summary } : {}),
				icon: (
					<IdentityAvatar
						avatar={realm.avatar}
						className="mt-0.5"
						fallback={realmInitials(name)}
						size="sm"
					/>
				),
			};
		}),
	] satisfies readonly {
		readonly value: PostRealmContextOptionValue;
		readonly label: string;
		readonly description?: string;
		readonly icon: ReactNode;
	}[];
	const selectedValue =
		value.kind === "global" ? GlobalContextOptionValue : realmContextOptionValue(value.realm.id);

	return (
		<ChoiceSelect
			appearance="field"
			ariaLabel={t.posts.selectRealmContext}
			className="w-full justify-between"
			contentClassName="w-[min(22rem,calc(100vw-2rem))]"
			onValueChange={([nextValue]) => {
				if (!nextValue) return;
				if (nextValue === GlobalContextOptionValue) {
					onValueChange({ kind: "global" });
					return;
				}
				const realm = realms.find(
					(candidate) => realmContextOptionValue(candidate.id) === nextValue,
				);
				if (realm) onValueChange({ kind: "realm", realm });
			}}
			options={options}
			placeholder={t.posts.selectRealmContext}
			size="lg"
			value={[selectedValue]}
		/>
	);
}

/**
 * Presents the active Realm identity and navigation above Realm-contextual content.
 *
 * @alpha
 */
export function PostRealmContextBar({ realm }: { readonly realm: RealmContextBarValue }) {
	const { t } = useTranslation(["posts", "ui"]);
	const contextHref = realmHref(realm);
	const name = useChineseContentText(
		realmName(realm, t.ui.unnamed),
		realm.title ? realm.language : undefined,
	);
	const identity = (
		<>
			<IdentityAvatar
				avatar={realm.avatar}
				fallback={realmInitials(name)}
				imageAlt={name}
				size="md"
			/>
			<span className="min-w-0 truncate font-heading font-bold text-sm sm:text-base">{name}</span>
		</>
	);

	return (
		<div className="flex min-w-0 items-center gap-2">
			<Button asChild className="-ms-1" size="icon-md" variant="quiet">
				<Link aria-label={t.posts.back} href={contextHref}>
					<ArrowLeftIcon aria-hidden />
				</Link>
			</Button>
			<Link
				className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32"
				href={contextHref}
			>
				{identity}
			</Link>
		</div>
	);
}

/**
 * Renders the selected Realm's summary without duplicating the identity shown
 * in the context bar.
 *
 * @remarks
 * This system-owned card is deliberately separate from authored Unit Docks.
 * It does not own the Realm selector or navigation.
 *
 * @alpha
 */
export function PostRealmContextCard({ realm }: { readonly realm: PostRealmContext }) {
	const { t } = useTranslation(["posts"]);
	const summary = useChineseContentText(realm.summary ?? "", realm.language);
	if (!summary) return null;

	return (
		<Card asChild className="gap-0 rounded-xl py-0">
			<section aria-label={t.posts.realmContextCard}>
				<CardContent className="grid gap-1.5 p-4">
					<p className="font-semibold text-sm">{t.posts.realmSummary}</p>
					<p className="text-muted-foreground text-sm leading-5">{summary}</p>
				</CardContent>
			</section>
		</Card>
	);
}

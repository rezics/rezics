"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import { Button, Card, CardContent, ChoiceSelect, IdentityAvatar, cn } from "@rezics/ui";
import { RealmInfoCard } from "@/features/realms/components/realm-info-card";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import type { PostRealmContext } from "../model/post-realm-context";

function realmName(realm: PostRealmContext, unnamed: string): string {
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
	readonly onValueChange: (realmId: string) => void;
	readonly realms: readonly PostRealmContext[];
	readonly value?: string;
}) {
	const { t } = useTranslation(["posts", "ui"]);
	const options = realms.map((realm) => {
		const name = realmName(realm, t.ui.unnamed);
		return {
			value: realm.id,
			label: name,
			...(realm.summary ? { description: realm.summary } : {}),
			icon: (
				<IdentityAvatar
					avatar={realm.avatar}
					className="mt-0.5"
					fallback={realmInitials(name)}
					size="sm"
				/>
			),
		};
	});

	return (
		<ChoiceSelect
			appearance="field"
			ariaLabel={t.posts.selectRealmContext}
			className="w-full justify-between"
			contentClassName="w-[min(22rem,calc(100vw-2rem))]"
			onValueChange={([realmId]) => {
				if (realmId) onValueChange(realmId);
			}}
			options={options}
			placeholder={t.posts.selectRealmContext}
			size="lg"
			value={value ? [value] : []}
		/>
	);
}

/**
 * Keeps the selected Realm reachable wherever the full dock is unavailable.
 *
 * @alpha
 */
export function PostRealmContextLink({
	className,
	realm,
}: {
	readonly className?: string;
	readonly realm: PostRealmContext;
}) {
	const { t } = useTranslation(["posts"]);
	return (
		<Button asChild className={cn("w-full", className)} size="sm" variant="secondary">
			<Link href={realmHref(realm)}>
				{t.posts.viewRealm}
				<ArrowUpRightIcon aria-hidden data-icon="inline-end" />
			</Link>
		</Button>
	);
}

/**
 * Renders the selected Realm's stable identity and navigation context.
 *
 * @remarks
 * This system-owned card is deliberately separate from authored Unit Docks.
 * It does not own the Realm selector, and product routes may place a configured
 * Realm main Dock after it without coupling either lifecycle.
 *
 * @alpha
 */
export function PostRealmContextCard({ realm }: { readonly realm: PostRealmContext }) {
	const { t } = useTranslation(["posts", "ui"]);
	const name = realmName(realm, t.ui.unnamed);

	return (
		<Card asChild className="gap-0 rounded-xl py-0">
			<section aria-label={t.posts.realmContextCard}>
				<CardContent className="grid gap-4 p-4">
					<RealmInfoCard
						realm={{
							id: realm.id,
							name,
							initials: realmInitials(name),
							avatar: realm.avatar,
							...(realm.slugAddress ? { slug: realm.slugAddress.slug } : {}),
							...(realm.summary ? { summary: realm.summary } : {}),
						}}
					/>
					<PostRealmContextLink realm={realm} />
				</CardContent>
			</section>
		</Card>
	);
}

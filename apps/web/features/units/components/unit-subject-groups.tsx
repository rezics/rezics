"use client";

import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";
import { Button, CardContent, Cover, IdentityAvatar, ItemMedia } from "@rezics/ui";
import { useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { FeedCard } from "@/features/content-feed/components/feed-card";
import { TagReferenceBadge } from "@/features/tags/components/tag-reference-badge";
import { useTranslation } from "@/i18n/client";
import { groupByAssociationRole } from "../attribution-role";
import { subjectAssociationMediaKind } from "../model/subject-association-presentation";
import { publicUnitHref } from "../routing/public-unit-route";

type SubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];

export function UnitSubjectGroups({
	associations,
}: {
	readonly associations: readonly SubjectAssociation[];
}) {
	const { t } = useTranslation(["tags", "ui", "units"]);
	return (
		<div className="grid gap-4">
			{groupByAssociationRole(associations).map((group) => (
				<section className="grid gap-3" key={group.role}>
					<h3 className="text-sm font-semibold">{t.units.subjectAssociationRoles[group.role]}</h3>
					<ul className="grid gap-3">
						{group.items.map((association) => (
							<li key={association.id}>
								<SubjectAssociationCard association={association} />
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function SubjectAssociationCard({ association }: { readonly association: SubjectAssociation }) {
	const { t } = useTranslation(["editor", "ui", "units"]);
	const [revealed, setRevealed] = useState(false);
	const title = useChineseContentText(
		association.title ?? t.ui.unnamed,
		association.title ? association.language : null,
	);
	const summary = useChineseContentText(association.summary ?? "", association.language);
	const href = publicUnitHref("entity", { id: association.entityEntryId });
	const headingId = `subject-association-${association.id}`;
	const mediaKind = subjectAssociationMediaKind({
		entityKind: association.entityKind,
		role: association.role,
		hasAvatar: association.avatar !== null,
		hasCover: association.cover !== null,
	});
	if (association.spoiler.concealed && !revealed)
		return (
			<FeedCard>
				<CardContent className="flex min-h-28 items-center justify-center p-5">
					<Button onClick={() => setRevealed(true)} type="button" variant="outline">
						{t.editor.showSpoiler}
					</Button>
				</CardContent>
			</FeedCard>
		);

	return (
		<FeedCard aria-labelledby={headingId}>
			<CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5">
				{mediaKind === "cover" ? (
					<Link className="block self-start" href={href}>
						<Cover
							alt={title}
							className="w-full rounded-xl border border-border-weak shadow-sm/5"
							sizes="(min-width: 640px) 120px, 80px"
							src={association.cover?.url}
						/>
					</Link>
				) : (
					<Link className="block self-start" href={href}>
						<ItemMedia variant="icon">
							<IdentityAvatar
								avatar={association.avatar}
								className="size-14 text-lg font-black"
								fallback={title.slice(0, 1).toUpperCase()}
								imageAlt={title}
							/>
						</ItemMedia>
					</Link>
				)}
				<div className="min-w-0 self-start">
					<h4 className="font-heading font-black text-[1.05rem] leading-snug" id={headingId}>
						<Link className="text-link hover:text-link-hover hover:underline" href={href}>
							{title}
						</Link>
					</h4>
					{summary ? (
						<p className="mt-2 line-clamp-3 text-muted-foreground text-sm leading-6">{summary}</p>
					) : null}
					{association.tags.length ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{association.tags.map((tag) => (
								<TagReferenceBadge key={tag.tagId} tagId={tag.tagId} title={tag.title} />
							))}
						</div>
					) : null}
					{association.contextPost ? (
						<div className="mt-3 grid gap-2">
							<Link
								className="w-fit text-muted-foreground text-xs hover:text-link hover:underline"
								href={`/posts/${association.contextPost.id}`}
							>
								{association.contextPost.title ?? t.units.editor.contextWikiPost}
							</Link>
							{association.contextPost.tags.length ? (
								<div className="flex flex-wrap gap-2">
									{association.contextPost.tags.map((tag) => (
										<TagReferenceBadge
											key={tag.tagId}
											pinned={tag.pinned}
											score={tag.score}
											tagId={tag.tagId}
											title={tag.title}
										/>
									))}
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</CardContent>
		</FeedCard>
	);
}

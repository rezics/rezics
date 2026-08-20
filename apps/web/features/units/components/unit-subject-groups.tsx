"use client";

import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Cover,
	IdentityAvatar,
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { groupByAssociationRole } from "../attribution-role";
import { subjectAssociationMediaKind } from "../model/subject-association-presentation";

type SubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];

export function UnitSubjectGroups({
	associations,
}: {
	readonly associations: readonly SubjectAssociation[];
}) {
	const { t } = useTranslation(["ui", "units"]);
	return (
		<div className="grid gap-4">
			{groupByAssociationRole(associations).map((group) => (
				<section className="grid gap-1.5" key={group.role}>
					<h3 className="text-sm font-semibold">{t.units.subjectAssociationRoles[group.role]}</h3>
					<ItemGroup className="gap-0 overflow-hidden rounded-xl bg-background">
						{group.items.map((association) => (
							<SubjectAssociationItem association={association} key={association.id} />
						))}
					</ItemGroup>
				</section>
			))}
		</div>
	);
}

function SubjectAssociationItem({ association }: { readonly association: SubjectAssociation }) {
	const { t } = useTranslation(["ui", "units"]);
	const title = useChineseContentText(
		association.title ?? t.ui.unnamed,
		association.title ? association.language : null,
	);
	const summary = useChineseContentText(association.summary ?? "", association.language);
	const mediaKind = subjectAssociationMediaKind({
		entityKind: association.entityKind,
		role: association.role,
		hasAvatar: association.avatar !== null,
		hasCover: association.cover !== null,
	});

	return (
		<Item className="rounded-none border-0 border-b border-border-weak shadow-none last:border-b-0">
			{mediaKind === "cover" && association.cover ? (
				<Cover
					alt={title}
					className="w-14 shrink-0 self-stretch rounded-md"
					src={association.cover.url}
				/>
			) : (
				<ItemMedia variant="icon">
					<IdentityAvatar
						avatar={association.avatar}
						className="size-14 text-lg font-black"
						fallback={title.slice(0, 1).toUpperCase()}
						imageAlt={title}
					/>
				</ItemMedia>
			)}
			<ItemContent className="min-w-0 justify-center gap-2">
				<ItemTitle>
					<Link
						className="text-link hover:text-link-hover hover:underline"
						href={`/entities/${association.entityEntryId}`}
					>
						{title}
					</Link>
				</ItemTitle>
				{summary ? <ItemDescription className="line-clamp-2">{summary}</ItemDescription> : null}
				{association.tags.length ? (
					<div className="flex flex-wrap gap-1.5">
						{association.tags.map((tag) => (
							<Badge key={tag.tagId} size="sm" variant="outline">
								{tag.title ?? t.ui.unnamed}
							</Badge>
						))}
					</div>
				) : null}
				{association.contextPost ? (
					<div className="grid gap-2">
						<Link
							className="w-fit text-muted-foreground text-xs hover:text-link hover:underline"
							href={`/posts/${association.contextPost.id}`}
						>
							{association.contextPost.title ?? t.units.editor.contextWikiPost}
						</Link>
						{association.contextPost.tags.length ? (
							<div className="flex flex-wrap gap-1.5">
								{association.contextPost.tags.map((tag) => (
									<Badge key={tag.tagId} size="sm" variant="outline">
										{tag.title ?? t.ui.unnamed} · {tag.score}
									</Badge>
								))}
							</div>
						) : null}
					</div>
				) : null}
			</ItemContent>
		</Item>
	);
}

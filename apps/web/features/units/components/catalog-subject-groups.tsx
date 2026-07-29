"use client";

import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { groupByAssociationRole } from "../attribution-role";

type SubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];

export function CatalogSubjectGroups({
	associations,
}: {
	associations: readonly SubjectAssociation[];
}) {
	const { t } = useTranslation(["ui", "units"]);
	return (
		<div className="grid gap-4">
			{groupByAssociationRole(associations).map((group) => (
				<section className="grid gap-1.5" key={group.role}>
					<h3 className="text-sm font-semibold">
						{t.units.subjectAssociationRoles[group.role]}
					</h3>
					<div className="grid gap-2">
						{group.items.map((association) => (
							<div className="grid gap-1 rounded-lg border p-3" key={association.id}>
								<Link
									className="font-medium text-link hover:text-link-hover hover:underline"
									href={`/entities/${association.entityEntryId}`}
								>
									{association.title ?? t.ui.unnamed}
								</Link>
								{association.contextPost ? (
									<div className="grid gap-2">
										<Link
											className="w-fit text-muted-foreground text-xs hover:text-link hover:underline"
											href={`/posts/${association.contextPost.id}`}
										>
											{association.contextPost.title ??
												t.units.editor.contextWikiPost}
										</Link>
										{association.contextPost.tags.length ? (
											<div className="flex flex-wrap gap-1.5">
												{association.contextPost.tags.map((tag) => (
													<Badge
														key={tag.tagId}
														size="sm"
														variant="outline"
													>
														{tag.title ?? t.ui.unnamed} · {tag.score}
													</Badge>
												))}
											</div>
										) : null}
									</div>
								) : null}
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

"use client";

import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";
import Link from "next/link";
import { Fragment } from "react";

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
					<p className="min-w-0 break-words text-sm">
						{group.items.map((association, index) => (
							<Fragment key={association.id}>
								{index > 0 ? ", " : null}
								<Link
									className="font-medium text-link hover:text-link-hover hover:underline"
									href={`/entities/${association.entityEntryId}`}
								>
									{association.title ?? t.ui.unnamed}
								</Link>
							</Fragment>
						))}
					</p>
				</section>
			))}
		</div>
	);
}

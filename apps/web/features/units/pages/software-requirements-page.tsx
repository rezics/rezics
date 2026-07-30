"use client";

import { useGetApiSoftwareBySoftwareIdSystemRequirements } from "@rezics/openapi-tanstack-query";
import {
	Card,
	CardContent,
	DataList,
	DataListItem,
	DataListItemLabel,
	DataListItemValue,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { useTranslation } from "@/i18n/client";
import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { useUnitDetail } from "../components/unit-detail-workspace";

export function SoftwareRequirementsPage() {
	const detail = useUnitDetail();
	if (detail.type !== "software")
		throw new Error("Software requirements cannot be rendered for another Unit type");
	return (
		<SoftwareRequirementsContent softwareId={detail.unit.id} sourceLinks={detail.unit.links} />
	);
}

function SoftwareRequirementsContent({
	softwareId,
	sourceLinks,
}: {
	softwareId: string;
	sourceLinks: readonly { readonly id: string; readonly url: string }[];
}) {
	const query = useGetApiSoftwareBySoftwareIdSystemRequirements({
		path: { softwareId },
	});
	const { locale, t } = useTranslation(["units"]);
	return (
		<UnitDetailSectionFrame
			description={t.units.detail.sectionDescriptions.software.requirements}
			title={t.units.detail.tabs.software.requirements}
		>
			{query.isPending ? (
				<QueryPending />
			) : query.isError ? (
				<QueryFailure error={query.error} retry={() => void query.refetch()} />
			) : query.data?.items.length ? (
				<div className="grid gap-3 md:grid-cols-2">
					{query.data.items.map((requirement) => {
						const sourceLink = sourceLinks.find(
							({ id }) => id === requirement.sourceLinkId,
						);
						return (
							<Card key={requirement.id}>
								<CardContent className="p-5">
									<DataList>
										<DataListItem>
											<DataListItemLabel>
												{t.units.detail.requirementTier}
											</DataListItemLabel>
											<DataListItemValue>
												{requirement.tier}
											</DataListItemValue>
										</DataListItem>
										{requirement.platformEntityId ? (
											<DataListItem>
												<DataListItemLabel>
													{t.units.detail.requirementPlatform}
												</DataListItemLabel>
												<DataListItemValue className="break-all text-end">
													<Link
														className="text-link hover:text-link-hover hover:underline"
														href={`/entities/${requirement.platformEntityId}`}
													>
														{requirement.platformEntityId}
													</Link>
												</DataListItemValue>
											</DataListItem>
										) : null}
										{requirement.sourceLinkId ? (
											<DataListItem>
												<DataListItemLabel>
													{t.units.detail.requirementSource}
												</DataListItemLabel>
												<DataListItemValue className="break-all text-end">
													{sourceLink ? (
														<a
															className="text-link hover:text-link-hover hover:underline"
															href={sourceLink.url}
															rel="noreferrer"
															target="_blank"
														>
															{sourceLink.url}
														</a>
													) : (
														requirement.sourceLinkId
													)}
												</DataListItemValue>
											</DataListItem>
										) : null}
										{Object.entries(requirement.hardware).map(
											([label, value]) => (
												<DataListItem key={label}>
													<DataListItemLabel className="break-words">
														{label}
													</DataListItemLabel>
													<DataListItemValue className="min-w-0 break-words text-end">
														{formatRequirementValue(
															value,
															locale.current,
															{
																no: t.units.fields.no,
																notSpecified:
																	t.units.detail
																		.requirementNotSpecified,
																yes: t.units.fields.yes,
															},
														)}
													</DataListItemValue>
												</DataListItem>
											),
										)}
									</DataList>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.units.detail.noRequirements}</p>
			)}
		</UnitDetailSectionFrame>
	);
}

function formatRequirementValue(
	value: unknown,
	language: string,
	labels: { readonly no: string; readonly notSpecified: string; readonly yes: string },
): string {
	if (value === null || value === undefined) return labels.notSpecified;
	if (typeof value === "boolean") return value ? labels.yes : labels.no;
	if (typeof value === "number") return new Intl.NumberFormat(language).format(value);
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

"use client";

import { toContentLanguage } from "@rezics/i18n";
import { PublicationLicenseRegistry } from "@rezics/license";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { BookOpen, Gamepad2, LibraryBig, PlaySquare } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@rezics/ui";
import { Badge } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Cover } from "@rezics/ui";
import { PortableTextContent } from "@rezics/ui";
import { DataList, DataListItem, DataListItemLabel, DataListItemValue } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { isKnownAttributionRole } from "./attribution-role";
import { publicUnitHref } from "./routing/public-unit-route";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { FavoriteToggle } from "@/features/collections/collections";
import { ProgressRecordForm } from "@/features/progress/progress";
import { UnitShelf } from "@/features/explore/unit-shelf";
import { BookChapters } from "./reader";
import type { UnitType } from "./unit-types";

const Icons = { book: BookOpen, software: Gamepad2, media: PlaySquare, series: LibraryBig };

function formatDate(value: string | null, language: string) {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language).format(date);
}

function tagSearchHref(type: UnitType, tagId: string, label: string): string {
	const template = type === "book" || type === "media" || type === "software" ? type : "global";
	const query = new URLSearchParams({ template, tag: tagId, tagLabel: label });
	return `/search?${query.toString()}`;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="font-heading text-xl font-bold">{title}</h2>
			{children}
		</section>
	);
}

export function UnitDetail({ type, unit }: { type: UnitType; unit: string }) {
	const { t, locale } = useTranslation([
		"engagement",
		"feed",
		"governance",
		"licenses",
		"posts",
		"state",
		"ui",
		"units",
	]);
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId: unit } });

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;

	const item = query.data;
	const localization = selectLocalization(
		item.localizations,
		toContentLanguage(locale.target),
		item.language,
	);
	const Icon = Icons[type];
	const rating =
		item.contentRating === "r15"
			? t.units.rating.r15
			: item.contentRating === "r18"
				? t.units.rating.r18
				: item.contentRating === "r18g"
					? t.units.rating.r18g
					: t.units.rating.general;
	const aiDisclosure =
		item.aiDisclosure === "none"
			? t.units.aiDisclosure.none
			: item.aiDisclosure === "ai_assisted"
				? t.units.aiDisclosure.ai_assisted
				: item.aiDisclosure === "ai_originated"
					? t.units.aiDisclosure.ai_originated
					: item.aiDisclosure === "machine_generated"
						? t.units.aiDisclosure.machine_generated
						: t.units.aiDisclosure.unknown;
	const licenseDefinition = item.license ? PublicationLicenseRegistry[item.license] : null;
	const licenseLabel = item.license ? t.licenses.options[item.license].label : null;
	const licenseValue =
		licenseDefinition?.kind === "license" ? (
			<a
				aria-label={`${t.licenses.viewTerms}: ${licenseLabel}`}
				className="text-link hover:text-link-hover hover:underline"
				href={licenseDefinition.url}
				rel="noreferrer"
				target="_blank"
			>
				{licenseLabel}
			</a>
		) : (
			licenseLabel
		);
	const facts = [
		[t.units.detail.type, t.units.types[type]],
		[
			t.ui.status,
			item.status === "published"
				? t.ui.published
				: item.status === "archived"
					? t.ui.archived
					: t.ui.draft,
		],
		[
			t.ui.visibility,
			item.visibility === "private"
				? t.ui.private
				: item.visibility === "unlisted"
					? t.ui.unlisted
					: t.ui.public,
		],
		[t.ui.contentRating, rating],
		[t.units.detail.aiDisclosure, aiDisclosure],
		[t.units.detail.primaryLanguage, item.primaryLanguage],
		[t.units.detail.releasedOn, formatDate(item.releasedOn, locale.current)],
		[t.units.detail.license, licenseValue],
		[t.units.detail.updatedAt, formatDate(item.updatedAt, locale.current)],
	] as const;

	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<section className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b pb-8 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
				<Cover
					alt={localization?.title ?? t.ui.unnamed}
					className="rounded-lg shadow-sm"
					fallback={<Icon aria-hidden className="size-9" />}
					src={item.cover?.url}
				/>
				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">{t.units.types[type]}</Badge>
						<Badge variant="outline">{rating}</Badge>
					</div>
					<h1 className="font-heading text-2xl font-black tracking-tight sm:text-4xl">
						{localization?.title ?? t.ui.unnamed}
					</h1>
					{localization?.summary && (
						<p className="max-w-3xl text-lg leading-8 text-muted-foreground">
							{localization.summary}
						</p>
					)}
					<div className="flex flex-wrap gap-2">
						<FavoriteToggle targetId={item.id} />
						{item.capabilities.canEdit && (
							<>
								<Button variant="solid" asChild>
									<Link href={`/units/${type}/${item.id}/edit`}>{t.ui.edit}</Link>
								</Button>
								{type === "book" && (
									<Button variant="outline" asChild>
										<Link
											href={`/units/book/${item.id}/edit/content-structure`}
										>
											{t.units.content.edit}
										</Link>
									</Button>
								)}
							</>
						)}
						{item.capabilities.canManageAccess ||
						item.capabilities.canManageAssociations ? (
							<Button variant="outline" asChild>
								<Link
									href={`/units/${type}/${item.id}/edit/${item.capabilities.canManageAccess ? "access" : "relationships"}`}
								>
									{t.governance.open}
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			</section>
			<nav
				className="-mt-8 flex gap-1 overflow-x-auto border-b"
				aria-label={t.units.detail.sections}
			>
				{[
					[t.units.detail.information, "#overview"],
					[t.units.content.title, "#contents"],
					[t.posts.replies, "#replies"],
					[t.engagement.reviews, "#reviews"],
					[t.units.detail.versions, "#versions"],
				].map(([label, href], index) => (
					<a
						key={href}
						className={
							index === 0
								? "shrink-0 border-b-2 border-brand px-3 py-3 text-sm font-semibold text-foreground"
								: "text-muted-foreground shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium hover:text-foreground"
						}
						href={href}
					>
						{label}
					</a>
				))}
			</nav>

			<div
				id="overview"
				className="grid scroll-mt-20 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
			>
				<div className="grid min-w-0 gap-8">
					<DetailSection title={t.ui.summary}>
						<Card>
							<CardContent className="p-6 leading-7 text-muted-foreground">
								{localization?.description ? (
									<div className="prose max-w-none">
										<PortableTextContent
											value={readPortableText(localization.description)}
											variant="article"
										/>
									</div>
								) : (
									(localization?.summary ?? t.state.empty)
								)}
							</CardContent>
						</Card>
					</DetailSection>

					{type === "book" && <BookChapters bookId={item.id} />}
					<ProgressRecordForm unitId={item.id} />
				</div>

				<aside className="flex min-w-0 flex-col gap-6">
					<DetailSection title={t.units.detail.information}>
						<Card>
							<CardContent className="p-5">
								<DataList>
									{facts.map(([label, value]) =>
										value ? (
											<DataListItem key={label}>
												<DataListItemLabel>{label}</DataListItemLabel>
												<DataListItemValue className="min-w-0 break-words text-end">
													{value}
												</DataListItemValue>
											</DataListItem>
										) : null,
									)}
								</DataList>
							</CardContent>
						</Card>
					</DetailSection>

					{item.localizations.length > 0 && (
						<DetailSection title={t.units.detail.localizations}>
							<Card>
								<CardContent className="grid gap-3 p-5 text-sm">
									{item.localizations.map((entry) => (
										<div key={entry.language} className="grid gap-1">
											<Badge className="w-fit" variant="outline">
												{entry.language}
											</Badge>
											<p className="break-words font-medium">
												{entry.title ?? t.ui.unnamed}
											</p>
											{entry.summary && (
												<p className="break-words text-muted-foreground">
													{entry.summary}
												</p>
											)}
										</div>
									))}
								</CardContent>
							</Card>
						</DetailSection>
					)}

					{item.attributions.length > 0 && (
						<DetailSection title={t.units.detail.credits}>
							<Card>
								<CardContent className="grid gap-2 p-5 text-sm">
									{item.attributions.map((attribution) => {
										const href = publicUnitHref(
											attribution.creditedUnit.kind,
											attribution.creditedUnit,
										);
										const role = isKnownAttributionRole(attribution.role)
											? t.units.attributionRoles[attribution.role]
											: attribution.role;
										const label = `${attribution.creditedUnit.title ?? t.ui.unnamed} · ${role}`;
										return href ? (
											<Link
												key={attribution.id}
												className="min-w-0 break-words text-link hover:text-link-hover hover:underline"
												href={href}
											>
												{label}
											</Link>
										) : (
											<span key={attribution.id}>{label}</span>
										);
									})}
								</CardContent>
							</Card>
						</DetailSection>
					)}

					{item.subjectAssociations.length > 0 && (
						<DetailSection title={t.units.detail.subjectAssociations}>
							<Card>
								<CardContent className="grid gap-2 p-5 text-sm">
									{item.subjectAssociations.map((association) => (
										<Link
											key={association.id}
											className="min-w-0 break-words text-link hover:text-link-hover hover:underline"
											href={`/entities/${association.entityEntryId}`}
										>
											{association.title ?? t.ui.unnamed} · {association.role}
										</Link>
									))}
								</CardContent>
							</Card>
						</DetailSection>
					)}

					{item.links.length > 0 && (
						<DetailSection title={t.units.detail.links}>
							<Card>
								<CardContent className="grid gap-2 p-5 text-sm">
									{item.links.map((link) => (
										<a
											key={link.id}
											className="break-all text-link hover:text-link-hover hover:underline"
											href={link.url}
											rel="noreferrer"
											target="_blank"
										>
											{link.url}
										</a>
									))}
								</CardContent>
							</Card>
						</DetailSection>
					)}

					{item.tags.length > 0 && (
						<DetailSection title={t.units.detail.tags}>
							<div className="flex flex-wrap gap-2">
								{item.tags.map((tag) => {
									const label = tag.title ?? tag.tagId;
									return (
										<Link
											href={tagSearchHref(type, tag.tagId, label)}
											key={tag.id}
										>
											<Badge variant="outline">{label}</Badge>
										</Link>
									);
								})}
							</div>
						</DetailSection>
					)}

					{item.versions.length > 0 && (
						<DetailSection title={t.units.detail.versions}>
							<Card>
								<CardContent className="grid gap-2 p-5 text-sm">
									{item.versions.map((version) => (
										<Link
											key={version.id}
											className="break-all text-link hover:text-link-hover hover:underline"
											href={`/units/${type}/${version.id}`}
										>
											{version.kind === "version"
												? t.units.detail.version
												: t.units.detail.primary}
										</Link>
									))}
								</CardContent>
							</Card>
						</DetailSection>
					)}
				</aside>
			</div>
			{type !== "series" ? (
				<DetailSection title={t.feed.relatedWorks}>
					<UnitShelf type={type} seedUnitId={item.id} />
				</DetailSection>
			) : null}
		</main>
	);
}

"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { BookOpen, Gamepad2, PlaySquare } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@rezics/ui";
import { Badge } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { PortableTextContent } from "@rezics/ui";
import { DataList, DataListItem, DataListItemLabel, DataListItemValue } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { FavoriteToggle } from "@/features/collections/collections";
import { ProgressRecordForm } from "@/features/progress/progress";
import { UnitShelf } from "@/features/explore/unit-shelf";
import { BookChapters } from "./reader";
import type { UnitType } from "./unit-types";

const Icons = { book: BookOpen, software: Gamepad2, media: PlaySquare };

function formatDate(value: string | null, language: string) {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language).format(date);
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
	const { t, locale } = useTranslation({ suspense: true });
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId: unit } });

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;

	const item = query.data;
	const localization = selectLocalization(item.localizations, locale.target, item.language);
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
		[t.units.detail.license, item.license],
		[t.units.detail.updatedAt, formatDate(item.updatedAt, locale.current)],
	] as const;

	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<section className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b pb-8 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
				<div
					className={
						type === "book"
							? "bg-accent aspect-[2/3] overflow-hidden rounded-lg shadow-sm"
							: "bg-accent col-span-2 aspect-video overflow-hidden rounded-lg shadow-sm"
					}
				>
					{item.cover ? (
						<img alt="" className="size-full object-cover" src={item.cover.url} />
					) : (
						<div className="text-accent-foreground grid size-full place-items-center">
							<Icon className="size-9" />
						</div>
					)}
				</div>
				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">{t.units.types[type]}</Badge>
						<Badge variant="outline">{rating}</Badge>
					</div>
					<h1 className="font-heading text-2xl font-black tracking-tight sm:text-4xl">
						{localization?.title ?? item.slug ?? t.ui.unnamed}
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
								<Button asChild>
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
					</div>
				</div>
			</section>
			<nav className="-mt-8 flex gap-1 overflow-x-auto border-b" aria-label="Unit sections">
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

					{item.credits.length > 0 && (
						<DetailSection title={t.units.detail.credits}>
							<Card>
								<CardContent className="grid gap-2 p-5 text-sm">
									{item.credits.map((credit) => (
										<Link
											key={credit.id}
											className="min-w-0 break-words text-link hover:text-link-hover hover:underline"
											href={`/entities/${credit.entityEntryId}`}
										>
											{credit.title ?? t.ui.unnamed} · {credit.role}
										</Link>
									))}
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
								{item.tags.map((tag) => (
									<Badge key={tag.id} variant="outline">
										{tag.title ?? tag.tagId}
									</Badge>
								))}
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
			<DetailSection title={t.feed.relatedWorks}>
				<UnitShelf type={type} seedUnitId={item.id} />
			</DetailSection>
		</main>
	);
}

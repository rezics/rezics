"use client";

import { toContentLanguage } from "@rezics/i18n";
import type { Translation } from "@rezics/i18n";
import {
	type GetApiUnitsByTypeByUnitIdStatus200,
	useGetApiUnitsByTypeByUnitId,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, Cover, QueryFailure, QueryPending } from "@rezics/ui";
import { BookOpen, Gamepad2, PlaySquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { CollectionPickerButton } from "@/features/collections/components/collection-picker-button";
import { FavoriteButton } from "@/features/collections/components/favorite-button";
import { UnitProgressAction } from "@/features/progress/components/unit-progress-action";
import { UnitProgressDialog } from "@/features/progress/components/unit-progress-dialog";
import { UnitProgressProvider } from "@/features/progress/components/unit-progress-provider";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import {
	CatalogDetailSections,
	type CatalogDetailSectionIdFor,
	type CatalogDetailUnitType,
} from "../model/catalog-detail-section";
import { isCatalogDetailUnitFor, type CatalogDetailUnit } from "../model/catalog-detail-unit";
import { catalogDetailHref, parseCatalogDetailSection } from "../routing/catalog-detail-routes";

type CatalogDetailContextValue = {
	[Type in CatalogDetailUnitType]: {
		readonly type: Type;
		readonly unit: Extract<CatalogDetailUnit, { readonly type: Type }>;
	};
}[CatalogDetailUnitType];

const CatalogDetailContext = createContext<CatalogDetailContextValue | undefined>(undefined);

const CatalogIcons = {
	book: BookOpen,
	media: PlaySquare,
	software: Gamepad2,
} as const;

export function useCatalogDetail(): CatalogDetailContextValue {
	const value = useContext(CatalogDetailContext);
	if (!value) throw new Error("Catalog detail content must be rendered inside its workspace");
	return value;
}

export function CatalogDetailWorkspace({
	children,
	type,
	unitId,
}: {
	children: ReactNode;
	type: CatalogDetailUnitType;
	unitId: string;
}) {
	return (
		<CatalogDetailWorkspaceContent type={type} unitId={unitId}>
			{children}
		</CatalogDetailWorkspaceContent>
	);
}

function CatalogDetailWorkspaceContent<Type extends CatalogDetailUnitType>({
	children,
	type,
	unitId,
}: {
	children: ReactNode;
	type: Type;
	unitId: string;
}) {
	const query = useGetApiUnitsByTypeByUnitId({ path: { type, unitId } });
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isCatalogDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Catalog Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);

	const value = { type, unit: query.data } as CatalogDetailContextValue;
	return (
		<CatalogDetailContext.Provider value={value}>
			<UnitProgressProvider domain={{ type, unitId: query.data.id }}>
				<CatalogDetailShell type={type} unit={query.data}>
					{children}
				</CatalogDetailShell>
			</UnitProgressProvider>
		</CatalogDetailContext.Provider>
	);
}

function CatalogDetailShell<Type extends CatalogDetailUnitType>({
	children,
	type,
	unit,
}: {
	children: ReactNode;
	type: Type;
	unit: GetApiUnitsByTypeByUnitIdStatus200;
}) {
	const pathname = usePathname();
	const { locale, t } = useTranslation(["engagement", "governance", "ui", "units"]);
	const localization = selectLocalization(
		unit.localizations,
		toContentLanguage(locale.target),
		unit.language,
	);
	const currentSection = parseCatalogDetailSection(pathname, type, unit.id);
	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<section className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-b border-border-weak pb-8 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
				<Cover
					alt={localization?.title ?? t.ui.unnamed}
					className="rounded-xl border border-border-weak shadow-sm"
					fallback={<CatalogIcon type={type} />}
					src={unit.cover?.url}
				/>
				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">{t.units.types[type]}</Badge>
						<Badge variant="outline">
							{unit.contentRating === "r15"
								? t.units.rating.r15
								: unit.contentRating === "r18"
									? t.units.rating.r18
									: unit.contentRating === "r18g"
										? t.units.rating.r18g
										: t.units.rating.general}
						</Badge>
					</div>
					<div className="grid gap-2">
						<h1 className="font-heading text-2xl font-black tracking-tight sm:text-4xl">
							{localization?.title ?? t.ui.unnamed}
						</h1>
						{localization?.summary ? (
							<p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
								{localization.summary}
							</p>
						) : null}
					</div>
					<div className="flex flex-wrap items-start gap-2">
						<FavoriteButton targetId={unit.id} />
						<CollectionPickerButton targetId={unit.id} triggerVariant="outline" />
						<UnitProgressAction />
						{unit.capabilities.canEdit ? (
							<Button asChild variant="solid">
								<Link href={`/units/${type}/${unit.id}/edit`}>{t.ui.edit}</Link>
							</Button>
						) : null}
						{unit.capabilities.canManageAccess ||
						unit.capabilities.canManageAssociations ? (
							<Button asChild variant="outline">
								<Link
									href={`/units/${type}/${unit.id}/edit/${unit.capabilities.canManageAccess ? "access" : "relationships"}`}
								>
									{t.governance.open}
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			</section>

			<nav
				aria-label={t.units.detail.sections}
				className="-mt-8 flex gap-1 overflow-x-auto border-b border-border-weak"
			>
				{CatalogDetailSections[type].map((sectionId) => (
					<Link
						aria-current={currentSection === sectionId ? "page" : undefined}
						className={
							currentSection === sectionId
								? "shrink-0 border-b-2 border-brand px-3 py-3 text-sm font-semibold text-foreground"
								: "shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
						}
						href={catalogDetailHref(type, unit.id, sectionId)}
						key={sectionId}
					>
						{catalogSectionLabel(t, type, sectionId)}
					</Link>
				))}
			</nav>

			{children}
			<UnitProgressDialog />
		</main>
	);
}

export function catalogSectionLabel<Type extends CatalogDetailUnitType>(
	t: Pick<Translation, "units">,
	type: Type,
	sectionId: CatalogDetailSectionIdFor<Type>,
): string {
	switch (type) {
		case "book":
			return t.units.detail.tabs.book[sectionId as CatalogDetailSectionIdFor<"book">];
		case "media":
			return t.units.detail.tabs.media[sectionId as CatalogDetailSectionIdFor<"media">];
		case "software":
			return t.units.detail.tabs.software[sectionId as CatalogDetailSectionIdFor<"software">];
	}
}

function CatalogIcon({ type }: { type: CatalogDetailUnitType }) {
	const Icon =
		type === "book"
			? CatalogIcons.book
			: type === "media"
				? CatalogIcons.media
				: CatalogIcons.software;
	return <Icon aria-hidden className="size-9" />;
}

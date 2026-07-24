"use client";

import type { Translation } from "@rezics/i18n";
import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { UnitProgressDialog } from "@/features/progress/components/unit-progress-dialog";
import { UnitProgressProvider } from "@/features/progress/components/unit-progress-provider";
import { useTranslation } from "@/i18n/client";
import {
	CatalogDetailSections,
	type CatalogDetailSectionIdFor,
	type CatalogDetailUnitType,
} from "../model/catalog-detail-section";
import {
	isCatalogDetailUnitFor,
	type CatalogDetailUnit,
	type CatalogDetailUnitFor,
} from "../model/catalog-detail-unit";
import { catalogDetailHref, parseCatalogDetailSection } from "../routing/catalog-detail-routes";
import { CatalogDetailHero } from "./catalog-detail-hero";

type CatalogDetailContextValue = {
	[Type in CatalogDetailUnitType]: {
		readonly type: Type;
		readonly unit: Extract<CatalogDetailUnit, { readonly type: Type }>;
	};
}[CatalogDetailUnitType];

const CatalogDetailContext = createContext<CatalogDetailContextValue | undefined>(undefined);

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
	unit: CatalogDetailUnitFor<Type>;
}) {
	const pathname = usePathname();
	const { t } = useTranslation(["units"]);
	const currentSection = parseCatalogDetailSection(pathname, type, unit.id);
	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
			<CatalogDetailHero type={type} unit={unit} />

			<nav
				aria-label={t.units.detail.sections}
				className="flex gap-1 overflow-x-auto border-b border-border-weak"
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

"use client";

import type { Translation } from "@rezics/i18n";
import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { UnitProgressDialog } from "@/features/progress/components/unit-progress-dialog";
import { UnitProgressProvider } from "@/features/progress/components/unit-progress-provider";
import { UnitProgressSummaryCard } from "@/features/progress/components/unit-progress-summary-card";
import { isProgressTrackableUnitType } from "@/features/progress/model/progress-record";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import {
	UnitDetailSections,
	type UnitDetailSectionIdFor,
	type UnitDetailUnitType,
} from "../model/unit-detail-section";
import {
	isUnitDetailUnitFor,
	type UnitDetailUnit,
	type UnitDetailUnitFor,
} from "../model/unit-detail-unit";
import { unitDetailHref, parseUnitDetailSection } from "../routing/unit-detail-routes";
import { UnitDetailHero } from "./unit-detail-hero";

type UnitDetailContextValue = {
	[Type in UnitDetailUnitType]: {
		readonly type: Type;
		readonly unit: Extract<UnitDetailUnit, { readonly type: Type }>;
	};
}[UnitDetailUnitType];

const UnitDetailContext = createContext<UnitDetailContextValue | undefined>(undefined);

export function useUnitDetail(): UnitDetailContextValue {
	const value = useContext(UnitDetailContext);
	if (!value) throw new Error("Unit detail content must be rendered inside its workspace");
	return value;
}

export function UnitDetailWorkspace({
	children,
	type,
	unitId,
}: {
	children: ReactNode;
	type: UnitDetailUnitType;
	unitId: string;
}) {
	return (
		<UnitDetailWorkspaceContent type={type} unitId={unitId}>
			{children}
		</UnitDetailWorkspaceContent>
	);
}

function UnitDetailWorkspaceContent<Type extends UnitDetailUnitType>({
	children,
	type,
	unitId,
}: {
	children: ReactNode;
	type: Type;
	unitId: string;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId,
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isUnitDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Unit Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);

	const value = { type, unit: query.data } as UnitDetailContextValue;
	const shell = (
		<UnitDetailShell type={type} unit={query.data}>
			{children}
		</UnitDetailShell>
	);
	return (
		<UnitDetailContext.Provider value={value}>
			{isProgressTrackableUnitType(type) ? (
				<UnitProgressProvider domain={{ type, unitId: query.data.id }}>
					{shell}
				</UnitProgressProvider>
			) : (
				shell
			)}
		</UnitDetailContext.Provider>
	);
}

function UnitDetailShell<Type extends UnitDetailUnitType>({
	children,
	type,
	unit,
}: {
	children: ReactNode;
	type: Type;
	unit: UnitDetailUnitFor<Type>;
}) {
	const pathname = usePathname();
	const { t } = useTranslation(["units"]);
	const currentSection = parseUnitDetailSection(pathname, type, unit.id);
	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
			<UnitDetailHero type={type} unit={unit} />

			{isProgressTrackableUnitType(type) ? <UnitProgressSummaryCard className="lg:hidden" /> : null}

			<nav
				aria-label={t.units.detail.sections}
				className="flex gap-1 overflow-x-auto border-b border-border-weak"
			>
				{UnitDetailSections[type].map((sectionId) => (
					<Link
						aria-current={currentSection === sectionId ? "page" : undefined}
						className={
							currentSection === sectionId
								? "shrink-0 border-b-2 border-brand px-3 py-3 text-sm font-semibold text-foreground"
								: "shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
						}
						href={unitDetailHref(type, unit.id, sectionId)}
						key={sectionId}
					>
						{unitSectionLabel(t, type, sectionId)}
					</Link>
				))}
			</nav>

			{children}
			{isProgressTrackableUnitType(type) ? <UnitProgressDialog /> : null}
		</main>
	);
}

export function unitSectionLabel<Type extends UnitDetailUnitType>(
	t: Pick<Translation, "units">,
	type: Type,
	sectionId: UnitDetailSectionIdFor<Type>,
): string {
	switch (type) {
		case "book":
			return t.units.detail.tabs.book[sectionId as UnitDetailSectionIdFor<"book">];
		case "media":
			return t.units.detail.tabs.media[sectionId as UnitDetailSectionIdFor<"media">];
		case "software":
			return t.units.detail.tabs.software[sectionId as UnitDetailSectionIdFor<"software">];
		case "series":
			return t.units.detail.tabs.series[sectionId as UnitDetailSectionIdFor<"series">];
	}
}

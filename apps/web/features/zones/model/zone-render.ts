import {
	DockDocument,
	NavigationDocument,
	UnitReferencedBlockDocument,
	ZoneAppearanceDocument,
	assertWikiPostPortableTextDocument,
	parseDocument,
	type DockDocument as DockDocumentValue,
	type NavigationDocument as NavigationDocumentValue,
	type PortableTextDocument,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
	type ZoneAppearanceDocument as ZoneAppearanceDocumentValue,
} from "@rezics/block";
import type { GetZoneRenderProjectionStatus200 } from "@rezics/openapi-tanstack-query";

import {
	parseResolvedUnitPresentation,
	type ResolvedUnitPresentation,
} from "@/features/presentation/model/resolved-presentation";

type RawProjection = GetZoneRenderProjectionStatus200;
type RawPage = NonNullable<RawProjection["page"]>;
type RawDock = NonNullable<RawProjection["dock"]>;
type RawNavigation = RawProjection["navigations"][number];
type RawWikiPost = RawProjection["references"]["wikiPosts"][number];

export interface ZoneRenderPage extends Omit<RawPage, "document"> {
	readonly document: UnitReferencedBlockDocumentValue;
}

export interface ZoneRenderDock extends Omit<RawDock, "document"> {
	readonly document: DockDocumentValue;
}

export interface ZoneRenderNavigation extends Omit<RawNavigation, "document"> {
	readonly document: NavigationDocumentValue;
}

export interface ZoneRenderWikiPost extends Omit<RawWikiPost, "body"> {
	readonly body: PortableTextDocument;
}

export interface ZoneRenderProjection
	extends Omit<
		RawProjection,
		"zone" | "page" | "dock" | "navigations" | "references" | "resolvedPresentation"
	> {
	readonly zone: Omit<RawProjection["zone"], "appearanceDocument"> & {
		readonly appearanceDocument: ZoneAppearanceDocumentValue;
	};
	readonly page: ZoneRenderPage | null;
	readonly dock: ZoneRenderDock | null;
	readonly navigations: readonly ZoneRenderNavigation[];
	readonly resolvedPresentation: ResolvedUnitPresentation;
	readonly references: Omit<RawProjection["references"], "wikiPosts"> & {
		readonly wikiPosts: readonly ZoneRenderWikiPost[];
	};
}

export function parseZoneRenderProjection(raw: RawProjection): ZoneRenderProjection {
	return {
		...raw,
		resolvedPresentation: parseResolvedUnitPresentation(raw.resolvedPresentation),
		zone: {
			...raw.zone,
			appearanceDocument: parseDocument(ZoneAppearanceDocument, raw.zone.appearanceDocument),
		},
		page: raw.page
			? {
					...raw.page,
					document: parseDocument(UnitReferencedBlockDocument, raw.page.document),
				}
			: null,
		dock: raw.dock
			? { ...raw.dock, document: parseDocument(DockDocument, raw.dock.document) }
			: null,
		navigations: raw.navigations.map((navigation) => ({
			...navigation,
			document: parseDocument(NavigationDocument, navigation.document),
		})),
		references: {
			...raw.references,
			wikiPosts: raw.references.wikiPosts.map((wikiPost) => {
				assertWikiPostPortableTextDocument(wikiPost.body);
				return { ...wikiPost, body: wikiPost.body };
			}),
		},
	};
}

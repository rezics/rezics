import {
	DockDocument,
	NavigationDocument,
	UnitReferencedBlockDocument,
	ZoneThemeDocument,
	assertWikiPostPortableTextDocument,
	parseDocument,
	type NavigationDocument as NavigationDocumentValue,
	type PortableTextDocument,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
	type ZoneThemeDocument as ZoneThemeDocumentValue,
} from "@rezics/block";
import type { GetZoneRenderProjectionStatus200 } from "@rezics/openapi-tanstack-query";

type RawProjection = GetZoneRenderProjectionStatus200;
type RawPage = NonNullable<RawProjection["page"]>;
type RawDock = NonNullable<RawProjection["dock"]>;
type RawNavigation = RawProjection["navigations"][number];
type RawWikiPost = RawProjection["references"]["wikiPosts"][number];

export interface ZoneRenderPage extends Omit<RawPage, "document"> {
	readonly document: UnitReferencedBlockDocumentValue;
}

export interface ZoneRenderDock extends Omit<RawDock, "document"> {
	readonly document: typeof DockDocument.static;
}

export interface ZoneRenderNavigation extends Omit<RawNavigation, "document"> {
	readonly document: NavigationDocumentValue;
}

export interface ZoneRenderWikiPost extends Omit<RawWikiPost, "body"> {
	readonly body: PortableTextDocument;
}

export interface ZoneRenderProjection extends Omit<
	RawProjection,
	"zone" | "page" | "dock" | "navigations" | "references"
> {
	readonly zone: Omit<RawProjection["zone"], "themeDocument"> & {
		readonly themeDocument: ZoneThemeDocumentValue;
	};
	readonly page: ZoneRenderPage | null;
	readonly dock: ZoneRenderDock | null;
	readonly navigations: readonly ZoneRenderNavigation[];
	readonly references: Omit<RawProjection["references"], "wikiPosts"> & {
		readonly wikiPosts: readonly ZoneRenderWikiPost[];
	};
}

export function parseZoneRenderProjection(raw: RawProjection): ZoneRenderProjection {
	return {
		...raw,
		zone: {
			...raw.zone,
			themeDocument: parseDocument(ZoneThemeDocument, raw.zone.themeDocument),
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

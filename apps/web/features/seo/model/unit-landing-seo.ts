import type { ContentLanguage, Translation } from "@rezics/i18n";
import type { GetPublicUnitSeoProjectionStatus200 } from "@rezics/openapi-tanstack-query";
import type { Metadata } from "next";

export type PublicUnitSeoKind = GetPublicUnitSeoProjectionStatus200["kind"];
type PresentedProjection = Exclude<
	GetPublicUnitSeoProjectionStatus200,
	{ readonly presentation: null }
>;

export interface UnitLandingSeoRoute {
	readonly unitId: string;
	readonly expectedKind: PublicUnitSeoKind;
	readonly canonicalPath: string;
	readonly parentCanonicalPath?: string;
	readonly requestedLanguage?: ContentLanguage;
}

export interface UnitLandingSeoDocument {
	readonly metadata: Metadata;
	readonly structuredData: Readonly<Record<string, unknown>> | null;
}

interface BuildUnitLandingSeoDocumentInput extends UnitLandingSeoRoute {
	readonly projection: GetPublicUnitSeoProjectionStatus200 | null;
	readonly frontendOrigin: URL;
	readonly t: Pick<Translation, "brand" | "seo">;
}

const WorkKinds = new Set<PublicUnitSeoKind>([
	"book",
	"software",
	"media",
	"series",
	"video",
	"audio",
]);

function truncate(value: string, maximumLength: number): string {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	const characters = Array.from(normalized);
	return characters.length <= maximumLength
		? normalized
		: `${characters
				.slice(0, maximumLength - 1)
				.join("")
				.trimEnd()}…`;
}

function profileSlug(canonicalPath: string): string | null {
	const match = /^\/u\/([^/]+)$/.exec(canonicalPath);
	return match?.[1] ?? null;
}

function entityKindLabel(
	t: Pick<Translation, "seo">,
	entityKind: string | undefined,
): string | null {
	if (entityKind === "person" || entityKind === "organization" || entityKind === "character")
		return t.seo.entityKinds[entityKind];
	return null;
}

function metadataTitle(
	input: BuildUnitLandingSeoDocumentInput,
	projection: PresentedProjection,
): string {
	const presentation = projection.presentation;
	const brand = input.t.brand.name;
	const entityContext =
		presentation.context?.kind === "entity" ? presentation.context : undefined;
	const contextLabel =
		presentation.context?.kind === "zone_page"
			? presentation.context.zoneTitle
			: presentation.context?.kind === "post"
				? presentation.context.attributionTitle
				: null;
	const slug = projection.kind === "profile" ? profileSlug(input.canonicalPath) : null;

	if (slug) return input.t.seo.titles.profile({ name: presentation.title, slug, brand });
	if (contextLabel)
		return input.t.seo.titles.contextual({
			name: presentation.title,
			context: contextLabel,
			brand,
		});
	if (WorkKinds.has(projection.kind) || projection.kind === "entity")
		return input.t.seo.titles.typed({
			name: presentation.title,
			kind:
				entityKindLabel(input.t, entityContext?.entityKind) ??
				input.t.seo.kinds[projection.kind],
			brand,
		});
	return input.t.seo.titles.standard({ name: presentation.title, brand });
}

function noindexRobots(): NonNullable<Metadata["robots"]> {
	return {
		index: false,
		follow: false,
		noarchive: true,
		noimageindex: true,
		nosnippet: true,
		googleBot: {
			index: false,
			follow: false,
			noarchive: true,
			noimageindex: true,
			nosnippet: true,
		},
	};
}

function unavailableDocument(input: BuildUnitLandingSeoDocumentInput): UnitLandingSeoDocument {
	const title = input.t.seo.titles.unavailable({ brand: input.t.brand.name });
	const description = input.t.seo.descriptions.unavailable;
	return {
		metadata: {
			title,
			description,
			alternates: { canonical: input.canonicalPath },
			robots: noindexRobots(),
			openGraph: {
				type: "website",
				url: input.canonicalPath,
				title,
				description,
				siteName: input.t.brand.name,
			},
			twitter: { card: "summary", title, description },
		},
		structuredData: null,
	};
}

function structuredMainEntity(
	projection: PresentedProjection,
	url: string,
): Readonly<Record<string, unknown>> | null {
	const shared = {
		"@id": `${url}#entity`,
		url,
		name: projection.presentation.title,
		...(projection.presentation.description
			? { description: projection.presentation.description }
			: {}),
		...(projection.presentation.image ? { image: projection.presentation.image.url } : {}),
	};
	switch (projection.kind) {
		case "profile":
			return { "@type": "Person", ...shared };
		case "book":
			return { "@type": "Book", ...shared };
		case "software":
			return { "@type": "SoftwareApplication", ...shared };
		case "video":
			return { "@type": "VideoObject", ...shared };
		case "audio":
			return { "@type": "AudioObject", ...shared };
		case "series":
			return { "@type": "CreativeWorkSeries", ...shared };
		case "media":
			return { "@type": "CreativeWork", ...shared };
		case "entity": {
			const context =
				projection.presentation.context?.kind === "entity"
					? projection.presentation.context
					: null;
			const type =
				context?.entityKind === "person"
					? "Person"
					: context?.entityKind === "organization"
						? "Organization"
						: "Thing";
			return { "@type": type, ...shared };
		}
		case "post": {
			const author =
				projection.presentation.context?.kind === "post"
					? projection.presentation.context.attributionTitle
					: null;
			return {
				"@type": "Article",
				...shared,
				headline: projection.presentation.title,
				...(author ? { author: { "@type": "Person", name: author } } : {}),
			};
		}
		case "poll":
			return { "@type": "Question", ...shared };
		case "tag":
			return { "@type": "DefinedTerm", ...shared };
		case "structure":
			return { "@type": "DefinedTermSet", ...shared };
		case "collection":
		case "realm":
		case "zone":
		case "zone_page":
			return null;
	}
}

function hasPresentation(
	projection: GetPublicUnitSeoProjectionStatus200,
): projection is PresentedProjection {
	return projection.presentation !== null;
}

export function buildUnitLandingSeoDocument(
	input: BuildUnitLandingSeoDocumentInput,
): UnitLandingSeoDocument {
	const { projection } = input;
	if (!projection || projection.id !== input.unitId || projection.kind !== input.expectedKind)
		return unavailableDocument(input);
	if (!hasPresentation(projection)) {
		const adult = projection.indexing.reason === "adult";
		const title = adult
			? input.t.seo.titles.restricted({ brand: input.t.brand.name })
			: input.t.seo.titles.unavailable({ brand: input.t.brand.name });
		const description = adult
			? input.t.seo.descriptions.restricted
			: input.t.seo.descriptions.unavailable;
		return {
			metadata: {
				title,
				description,
				alternates: { canonical: input.canonicalPath },
				robots: noindexRobots(),
				openGraph: {
					type: "website",
					url: input.canonicalPath,
					title,
					description,
					siteName: input.t.brand.name,
				},
				twitter: { card: "summary", title, description },
			},
			structuredData: null,
		};
	}

	const title = truncate(metadataTitle(input, projection), 120);
	const kindLabel = input.t.seo.kinds[projection.kind];
	const description = truncate(
		projection.presentation.description ??
			input.t.seo.descriptions.fallback({
				brand: input.t.brand.name,
				name: projection.presentation.title,
				kind: kindLabel,
			}),
		160,
	);
	const image = projection.presentation.image
		? [{ url: projection.presentation.image.url, alt: projection.presentation.title }]
		: undefined;
	const indexable = projection.indexing.state === "index";
	const canonicalUrl = new URL(input.canonicalPath, input.frontendOrigin).href;
	const parentUrl = input.parentCanonicalPath
		? new URL(input.parentCanonicalPath, input.frontendOrigin).href
		: null;
	const parentTitle =
		projection.presentation.context?.kind === "zone_page"
			? projection.presentation.context.zoneTitle
			: null;
	const mainEntity = structuredMainEntity(projection, canonicalUrl);
	const webPage: Record<string, unknown> = {
		"@type": projection.kind === "collection" ? "CollectionPage" : "WebPage",
		"@id": `${canonicalUrl}#webpage`,
		url: canonicalUrl,
		name: title,
		description,
		inLanguage: projection.presentation.language,
		dateModified: projection.updatedAt,
		...(projection.publishedAt ? { datePublished: projection.publishedAt } : {}),
		...(projection.presentation.image
			? {
					primaryImageOfPage: {
						"@type": "ImageObject",
						url: projection.presentation.image.url,
					},
				}
			: {}),
		...(mainEntity ? { mainEntity: { "@id": `${canonicalUrl}#entity` } } : {}),
	};
	const breadcrumbs = [
		{
			"@type": "ListItem",
			position: 1,
			name: input.t.seo.breadcrumbs.home,
			item: input.frontendOrigin.href,
		},
		...(parentUrl && parentTitle
			? [{ "@type": "ListItem", position: 2, name: parentTitle, item: parentUrl }]
			: []),
		{
			"@type": "ListItem",
			position: parentUrl && parentTitle ? 3 : 2,
			name: projection.presentation.title,
			item: canonicalUrl,
		},
	];

	return {
		metadata: {
			title,
			description,
			category: kindLabel,
			alternates: { canonical: input.canonicalPath },
			robots: indexable ? { index: true, follow: true } : noindexRobots(),
			openGraph: {
				type: projection.kind === "post" ? "article" : "website",
				url: input.canonicalPath,
				title,
				description,
				siteName: input.t.brand.name,
				images: image,
				...(projection.kind === "post"
					? {
							publishedTime: projection.publishedAt ?? undefined,
							modifiedTime: projection.updatedAt,
						}
					: {}),
			},
			twitter: {
				card: image ? "summary_large_image" : "summary",
				title,
				description,
				images: image?.map(({ url }) => url),
			},
		},
		structuredData: indexable
			? {
					"@context": "https://schema.org",
					"@graph": [
						webPage,
						{
							"@type": "BreadcrumbList",
							"@id": `${canonicalUrl}#breadcrumb`,
							itemListElement: breadcrumbs,
						},
						...(mainEntity ? [mainEntity] : []),
					],
				}
			: null,
	};
}

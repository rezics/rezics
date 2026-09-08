import { isSimpleFeedContentKind } from "@rezics/filter";
import type { ContentLanguageTag } from "@rezics/content-language";
import type { ContentLanguage, Translation } from "@rezics/i18n";
import type { GetPublicUnitSeoProjectionStatus200 } from "@rezics/openapi-tanstack-query";
import type { Metadata } from "next";

export type PublicUnitSeoOwner = GetPublicUnitSeoProjectionStatus200["owner"];
type PresentedProjection = Exclude<
	GetPublicUnitSeoProjectionStatus200,
	{ readonly presentation: null }
>;

export interface UnitLandingSeoRoute {
	readonly unitId: string;
	readonly expectedOwner: PublicUnitSeoOwner;
	readonly canonicalPath: string;
	readonly parentCanonicalPath?: string;
	readonly requestedLanguage?: ContentLanguage | ContentLanguageTag;
	readonly expectedShape?: string;
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

const CatalogOwners = new Set<PublicUnitSeoOwner>([
	"publishing",
	"music",
	"program",
	"software",
	"grouping",
	"reference",
	"distribution",
	"video",
	"audio",
]);

function resourceLabel(t: Pick<Translation, "seo">, projection: PresentedProjection): string {
	const token = `${projection.owner}:${projection.shape}`;
	return isSimpleFeedContentKind(token) ? t.seo.shapes[token] : t.seo.owners[projection.owner];
}

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

function entityShapeLabel(
	t: Pick<Translation, "seo">,
	entityShape: string | undefined,
): string | null {
	if (entityShape === "person" || entityShape === "organization" || entityShape === "character")
		return t.seo.entityShapes[entityShape];
	return null;
}

function metadataTitle(
	input: BuildUnitLandingSeoDocumentInput,
	projection: PresentedProjection,
): string {
	const presentation = projection.presentation;
	const brand = input.t.brand.name;
	const entityContext = presentation.context?.kind === "entity" ? presentation.context : undefined;
	const contextLabel =
		presentation.context?.kind === "zone_page"
			? presentation.context.zoneTitle
			: presentation.context?.kind === "post"
				? presentation.context.attributionTitle
				: null;
	const slug = projection.owner === "entity" ? profileSlug(input.canonicalPath) : null;

	if (slug) return input.t.seo.titles.profile({ name: presentation.title, slug, brand });
	if (contextLabel)
		return input.t.seo.titles.contextual({
			name: presentation.title,
			context: contextLabel,
			brand,
		});
	if (CatalogOwners.has(projection.owner) || projection.owner === "entity")
		return input.t.seo.titles.typed({
			name: presentation.title,
			kind: entityShapeLabel(input.t, entityContext?.shape) ?? resourceLabel(input.t, projection),
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

	switch (projection.owner) {
		case "publishing":
		case "program":
			return { "@type": "CreativeWork", ...shared };
		case "software":
			return {
				"@type": projection.shape === "release" ? "CreativeWork" : "SoftwareApplication",
				...shared,
			};
		case "music":
			return {
				"@type":
					projection.shape === "recording"
						? "MusicRecording"
						: projection.shape === "work"
							? "MusicComposition"
							: projection.shape === "release"
								? "MusicRelease"
								: "CreativeWork",
				...shared,
			};
		case "video":
			return { "@type": "VideoObject", ...shared };
		case "audio":
			return { "@type": "AudioObject", ...shared };
		case "grouping":
		case "distribution":
			return { "@type": "Thing", ...shared };
		case "reference":
			return { "@type": projection.shape === "concept" ? "DefinedTerm" : "Thing", ...shared };
		case "entity":
			return {
				"@type":
					projection.shape === "person"
						? "Person"
						: projection.shape === "organization"
							? "Organization"
							: "Thing",
				...shared,
			};
		case "post": {
			if (projection.shape === "page") return null;
			const type =
				projection.shape === "chapter"
					? "Chapter"
					: projection.shape === "reply"
						? "Comment"
						: projection.shape === "review"
							? "Review"
							: projection.shape === "excerpt"
								? "Quotation"
								: projection.shape === "picture"
									? "CreativeWork"
									: "Article";
			return { "@type": type, ...shared, headline: projection.presentation.title };
		}
		case "poll":
			return { "@type": "Question", ...shared };
		case "tag":
			return { "@type": "DefinedTerm", ...shared };
		case "collection":
		case "realm":
		case "zone":
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
	if (
		!projection ||
		projection.id !== input.unitId ||
		projection.owner !== input.expectedOwner ||
		(input.expectedShape !== undefined && projection.shape !== input.expectedShape)
	)
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
	const kindLabel = resourceLabel(input.t, projection);
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
		"@type": projection.owner === "collection" ? "CollectionPage" : "WebPage",
		"@id": `${canonicalUrl}#webpage`,
		url: canonicalUrl,
		name: title,
		description,
		...(projection.presentation.language ? { inLanguage: projection.presentation.language } : {}),
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
				type: projection.owner === "post" ? "article" : "website",
				url: input.canonicalPath,
				title,
				description,
				siteName: input.t.brand.name,
				images: image,
				...(projection.owner === "post"
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

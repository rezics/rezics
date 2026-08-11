"use client";

import {
	FontAwesomeIconPrefixValues,
	type FontAwesomeLicense,
	FontAwesomeProvider,
	FontAwesomeVersion,
	fontAwesomeIconClassNames,
	isFontAwesomeIconPrefix,
	isFontAwesomeIconName,
	isFontAwesomeLicense,
	type FontAwesomeIconPrefix,
	type FontAwesomeIconReference,
} from "@rezics/avatar";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, NativeSelect, NativeSelectOption } from "@rezics/ui";
import { useDeferredValue, useEffect, useState } from "react";

import { useTranslation } from "@/i18n/client";

const FeaturedIconNamesByPrefix = {
	fas: [
		"user",
		"users",
		"house",
		"book-open",
		"graduation-cap",
		"school",
		"globe",
		"heart",
		"star",
		"bookmark",
		"lightbulb",
		"compass",
		"map",
		"calendar-days",
		"clock",
		"bell",
		"comment",
		"envelope",
		"camera",
		"music",
		"gamepad",
		"trophy",
		"leaf",
		"paw",
	],
	fab: [
		"github",
		"gitlab",
		"discord",
		"slack",
		"x-twitter",
		"facebook",
		"instagram",
		"youtube",
		"tiktok",
		"twitch",
		"reddit",
		"linkedin",
		"apple",
		"android",
		"windows",
		"linux",
		"chrome",
		"firefox-browser",
		"safari",
		"cloudflare",
		"react",
		"vuejs",
		"node-js",
		"python",
	],
} as const satisfies Readonly<Record<FontAwesomeIconPrefix, readonly string[]>>;

interface FontAwesomeSearchResult {
	readonly id: string;
	readonly prefixesByLicense: Readonly<
		Record<FontAwesomeLicense, readonly FontAwesomeIconPrefix[]>
	>;
}

const SearchDocument = `
query SearchIcons($version: String!, $query: String!, $pageSize: Int!) {
  searchPaginated(version: $version, query: $query, page: 1, pageSize: $pageSize) {
    icons {
      id
      familyStylesByLicense {
        free { prefix }
        pro { prefix }
      }
    }
  }
}`;

function objectValue(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: undefined;
}

function prefixesFrom(value: unknown): FontAwesomeIconPrefix[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		const prefix = objectValue(entry)?.prefix;
		return typeof prefix === "string" && isFontAwesomeIconPrefix(prefix) ? [prefix] : [];
	});
}

function parseSearchResults(value: unknown): FontAwesomeSearchResult[] {
	const data = objectValue(objectValue(value)?.data);
	const search = objectValue(data?.searchPaginated);
	if (!Array.isArray(search?.icons)) throw new Error("Font Awesome search returned no icons");
	return search.icons.flatMap((entry) => {
		const icon = objectValue(entry);
		const id = icon?.id;
		const licenses = objectValue(icon?.familyStylesByLicense);
		if (typeof id !== "string" || !isFontAwesomeIconName(id) || !licenses) return [];
		const prefixesByLicense = {
			free: [...new Set(prefixesFrom(licenses.free))],
			pro: [...new Set(prefixesFrom(licenses.pro))],
		};
		return prefixesByLicense.free.length || prefixesByLicense.pro.length
			? [{ id, prefixesByLicense }]
			: [];
	});
}

async function searchFontAwesomeIcons(query: string, signal: AbortSignal) {
	const response = await fetch("https://api.fontawesome.com", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query: SearchDocument,
			variables: { version: FontAwesomeVersion, query, pageSize: 48 },
		}),
		signal,
	});
	if (!response.ok) throw new Error(`Font Awesome search failed with ${response.status}`);
	return parseSearchResults(await response.json());
}

export function FontAwesomeIconPicker({
	onSelect,
}: {
	readonly onSelect: (icon: FontAwesomeIconReference) => void;
}) {
	const { t } = useTranslation(["media"]);
	const [query, setQuery] = useState("");
	const [prefix, setPrefix] = useState<FontAwesomeIconPrefix>("fas");
	const [configured, setConfigured] = useState(true);
	const [license, setLicense] = useState<FontAwesomeLicense>("free");
	const normalizedQuery = useDeferredValue(query.trim());
	const [debouncedQuery, setDebouncedQuery] = useState("");
	useEffect(() => {
		const timeout = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 250);
		return () => window.clearTimeout(timeout);
	}, [normalizedQuery]);
	const search = useQuery({
		queryKey: ["font-awesome-icons", FontAwesomeVersion, debouncedQuery],
		queryFn: ({ signal }) => searchFontAwesomeIcons(debouncedQuery, signal),
		enabled: debouncedQuery.length >= 2,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 60 * 60 * 1_000,
	});

	useEffect(() => {
		setConfigured(document.documentElement.dataset.fontAwesome === "configured");
		const configuredLicense = document.documentElement.dataset.fontAwesomeLicense;
		if (configuredLicense && isFontAwesomeLicense(configuredLicense)) setLicense(configuredLicense);
	}, []);

	const results = (search.data ?? []).filter((icon) =>
		icon.prefixesByLicense[license].includes(prefix),
	);
	return (
		<div className="isolate flex h-80 min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
			{!configured ? (
				<p className="border-warning/40 border-b bg-warning/10 px-3 py-2 text-sm">
					{t.media.avatarPicker.icon.unconfigured}
				</p>
			) : null}
			<div className="grid gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
				<Input
					aria-label={t.media.avatarPicker.icon.search}
					onChange={(event) => setQuery(event.currentTarget.value)}
					placeholder={t.media.avatarPicker.icon.search}
					value={query}
				/>
				<NativeSelect
					aria-label={t.media.avatarPicker.icon.style}
					onChange={(event) => {
						if (isFontAwesomeIconPrefix(event.currentTarget.value))
							setPrefix(event.currentTarget.value);
					}}
					value={prefix}
				>
					{FontAwesomeIconPrefixValues.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{t.media.avatarPicker.icon.styles[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</div>
			{normalizedQuery.length < 2 ? (
				<div className="min-h-0 flex-1 overflow-y-auto border-t p-2">
					<p className="px-1 pb-2 font-medium text-muted-foreground text-xs">
						{t.media.avatarPicker.icon.featured}
					</p>
					<div className="grid grid-cols-6 gap-1">
						{FeaturedIconNamesByPrefix[prefix].map((name) => {
							const reference = {
								provider: FontAwesomeProvider,
								prefix,
								name,
							} as const;
							return (
								<Button
									aria-label={t.media.avatarPicker.icon.select({ name })}
									className="aspect-square h-auto min-w-0 p-0 text-lg"
									disabled={!configured}
									key={`${prefix}:${name}`}
									onClick={() => onSelect(reference)}
									title={name}
									type="button"
									variant="quiet"
								>
									<i aria-hidden className={fontAwesomeIconClassNames(reference).join(" ")} />
								</Button>
							);
						})}
					</div>
				</div>
			) : search.isPending ? (
				<p className="grid min-h-0 flex-1 place-items-center border-t text-muted-foreground text-sm">
					{t.media.avatarPicker.icon.loading}
				</p>
			) : search.isError ? (
				<p className="grid min-h-0 flex-1 place-items-center border-t px-4 text-center text-destructive text-sm">
					{t.media.avatarPicker.icon.failed}
				</p>
			) : results.length === 0 ? (
				<p className="grid min-h-0 flex-1 place-items-center border-t px-4 text-center text-muted-foreground text-sm">
					{t.media.avatarPicker.icon.empty}
				</p>
			) : (
				<div className="grid min-h-0 flex-1 grid-cols-6 content-start gap-1 overflow-y-auto border-t p-2">
					{results.map((icon) => {
						const reference = {
							provider: FontAwesomeProvider,
							prefix,
							name: icon.id,
						} as const;
						return (
							<Button
								aria-label={t.media.avatarPicker.icon.select({ name: icon.id })}
								className="aspect-square h-auto min-w-0 p-0 text-lg"
								disabled={!configured}
								key={`${prefix}:${icon.id}`}
								onClick={() => onSelect(reference)}
								title={icon.id}
								type="button"
								variant="quiet"
							>
								<i aria-hidden className={fontAwesomeIconClassNames(reference).join(" ")} />
							</Button>
						);
					})}
				</div>
			)}
		</div>
	);
}

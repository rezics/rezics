import { z } from "zod";
import { database } from "../database";
import { reserveCatalogSourceRequest } from "./source-rate";
import { BangumiSubjectContractSha256, BangumiSubjectSchema } from "./bangumi";
import { MusicBrainzCatalogContractSha256, MusicBrainzReleaseSchema } from "./musicbrainz";
import { VndbCatalogContractSha256, VndbVnSchema, VndbReleaseSchema } from "./vndb";
import { storeCatalogSourcePayload, type CatalogSourceArchive } from "./source-observations";
import type { CatalogSourceCheckLease, CatalogSourceCheckOutcome } from "./source-scheduling";

export type CatalogSourceFetch = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

const userAgent = "REZICS-source-check/1.0 (+https://www.rezics.com)";
const maximumBytes = 8_000_000;

/** @internal Transport routes are code-owned; upstream identifiers never become arbitrary fetch URLs. */
export function catalogSourceAcquisitionRequest(lease: CatalogSourceCheckLease) {
	const headers = {
		"User-Agent": userAgent,
		Accept: "application/json",
		"Content-Type": "application/json",
	};
	if (lease.source === "bangumi" && lease.objectType === "subject") {
		z.string()
			.regex(/^[1-9][0-9]*$/u)
			.parse(lease.externalId);
		return {
			url: `https://api.bgm.tv/v0/subjects/${lease.externalId}`,
			method: "GET",
			headers,
			contractSha256: BangumiSubjectContractSha256,
			parse: (value: unknown) => BangumiSubjectSchema.parse(value),
		};
	}
	if (lease.source === "musicbrainz" && lease.objectType === "release") {
		z.uuid().parse(lease.externalId);
		return {
			url: `https://musicbrainz.org/ws/2/release/${lease.externalId}?fmt=json&inc=artists+artist-credits+recordings+release-groups+labels+discids+media+isrcs+recording-rels+work-rels`,
			method: "GET",
			headers,
			contractSha256: MusicBrainzCatalogContractSha256,
			parse: (value: unknown) => MusicBrainzReleaseSchema.parse(value),
		};
	}
	if (lease.source === "vndb" && ["vn", "release"].includes(lease.objectType)) {
		z.string()
			.regex(lease.objectType === "vn" ? /^v[1-9][0-9]*$/u : /^r[1-9][0-9]*$/u)
			.parse(lease.externalId);
		const fields =
			lease.objectType === "vn"
				? "id,title,titles.lang,titles.title,titles.latin,titles.official,titles.main,aliases,olang,platforms,languages,released,length,length_minutes,devstatus,editions.eid,editions.lang,editions.name,editions.official,staff.id,staff.aid,staff.name,staff.original,staff.eid,staff.role,staff.note,va.staff.id,va.staff.aid,va.character.id,va.note"
				: "id,title,alttitle,languages.lang,languages.title,languages.latin,languages.main,languages.mtl,vns.id,released,platforms,patch,freeware,official,catalog,gtin,media.medium,media.qty,producers.id,producers.name,producers.developer,producers.publisher";
		return {
			url: `https://api.vndb.org/kana/${lease.objectType}`,
			method: "POST",
			headers,
			body: JSON.stringify({ filters: ["id", "=", lease.externalId], fields, results: 1 }),
			contractSha256: VndbCatalogContractSha256,
			parse: (value: unknown) => {
				const result = z
					.object({ results: z.array(z.unknown()).max(1), more: z.boolean().optional() })
					.parse(value);
				if (result.results.length !== 1)
					throw new Error("A missing query result is not a source tombstone");
				return lease.objectType === "vn"
					? VndbVnSchema.parse(result.results[0])
					: VndbReleaseSchema.parse(result.results[0]);
			},
		};
	}
	throw new Error("No reviewed acquisition route is registered for this source object type");
}

/** @internal Network and archive I/O happen after acquisition admission and outside the applying transaction. */
export async function acquireCatalogSourceCheck(
	lease: CatalogSourceCheckLease,
	signal: AbortSignal,
	dependencies: {
		fetch?: CatalogSourceFetch;
		archive?: CatalogSourceArchive;
		admit?: () => Promise<void>;
	} = {},
): Promise<CatalogSourceCheckOutcome> {
	const request = catalogSourceAcquisitionRequest(lease);
	await (dependencies.admit ?? (() => reserveCatalogSourceRequest(database, lease.source)))();
	const ioSignal = AbortSignal.any([signal, AbortSignal.timeout(25_000)]);
	const response = await (dependencies.fetch ?? fetch)(request.url, {
		method: request.method,
		headers: request.headers,
		...("body" in request ? { body: request.body } : {}),
		redirect: "error",
		signal: AbortSignal.any([ioSignal, AbortSignal.timeout(20_000)]),
	});
	if (response.status === 410)
		return {
			status: "tombstone",
			authoritative: true,
			reason: "The exact upstream endpoint returned HTTP 410",
		};
	if (!response.ok || !response.body)
		return { status: "error", reason: `Source check returned HTTP ${response.status}` };
	const declaredLength = response.headers.get("content-length");
	if (declaredLength !== null && Number(declaredLength) > maximumBytes)
		throw new RangeError("Source response exceeds its archive budget");
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const chunk of response.body) {
		length += chunk.byteLength;
		if (length > maximumBytes) {
			await response.body.cancel().catch(() => {});
			throw new RangeError("Source response exceeds its archive budget");
		}
		chunks.push(chunk);
	}
	const sourceValue: unknown = JSON.parse(
		new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
	);
	const parsed = request.parse(sourceValue);
	if (String(parsed.id) !== lease.externalId)
		throw new Error("Acquired source identity differs from its admitted record");
	// Preserve the upstream object, including admitted unknown fields; parsing never rewrites evidence.
	const document =
		lease.source === "vndb"
			? z.object({ results: z.array(z.unknown()).length(1) }).parse(sourceValue).results[0]
			: sourceValue;
	const bytes =
		lease.source === "vndb" ? Buffer.from(JSON.stringify(document)) : Buffer.concat(chunks);
	const receipt = await storeCatalogSourcePayload(
		{ source: lease.source, objectType: lease.objectType, externalId: lease.externalId },
		bytes,
		request.contractSha256,
		response.headers.get("etag"),
		dependencies.archive,
		{ sourceRecordId: lease.sourceRecordId, generation: lease.generation },
		ioSignal,
	);
	return { status: "changed", receipt };
}

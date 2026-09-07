import { z } from "zod";
import { database } from "../database";
import { reserveCatalogSourceRequest } from "./source-rate";
import { bangumiAcquisitionDescriptor } from "./bangumi-acquisition";
import { musicBrainzAcquisitionDescriptor } from "./musicbrainz-acquisition";
import { vndbAcquisitionRequest } from "./vndb-acquisition";
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
	if (lease.source === "vndb")
		return {
			...vndbAcquisitionRequest(lease.objectType, lease.externalId),
			headers,
			authoritativeGone: false,
		};
	if (lease.source === "musicbrainz")
		return {
			...musicBrainzAcquisitionDescriptor(lease.objectType, lease.externalId),
			headers,
			authoritativeGone: true,
		};
	if (lease.source === "bangumi")
		return { ...bangumiAcquisitionDescriptor(lease.objectType, lease.externalId), headers };
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
	if (response.status === 410 && request.authoritativeGone)
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
	request.parse(sourceValue);
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

import type { IntakeCatalogSourceBody as FetchIntake } from "./generated/models";
import type { IntakeCatalogSourceBody as QueryIntake } from "../../openapi-tanstack-query/src/generated/models";
import type { IntakeCatalogSourceBody as PublicIntake } from "../../../../../packages/api/src/generated/models";

type ExpectedIntake =
	| { source: "vndb"; objectType: "vn" | "release" | "staff" | "producer" | "character" | "tag" | "trait" | "quote"; externalId: string }
	| { source: "musicbrainz"; objectType: "release" | "recording" | "work" | "release_group" | "artist" | "label" | "area" | "place" | "event" | "instrument" | "series" | "genre" | "url"; externalId: string }
	| { source: "bangumi"; objectType: "subject" | "person" | "character" | "episode" | "index"; externalId: string }
	| { source: "openlibrary"; objectType: "work" | "edition" | "author"; externalId: string };
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Assert<T extends true> = T;

/** @internal Compile-time integration gate: generated unions retain each provider's exact families. */
export type SourceIntakeSdkChecks = [
	Assert<Equal<FetchIntake, ExpectedIntake>>,
	Assert<Equal<QueryIntake, ExpectedIntake>>,
	Assert<Equal<PublicIntake, ExpectedIntake>>,
];

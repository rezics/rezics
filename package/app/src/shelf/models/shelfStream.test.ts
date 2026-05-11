import { describe, expect, test } from "bun:test";
import type { EnrichedShelfItem } from "@rezics/api/shelf";
import type { BookDTO, PostDTO, ShelfItemDTO } from "@rezics/contract";
import { deriveShelfStream, type ShelfStreamEntry } from "./shelfStream";

function makeItem(overrides: Partial<ShelfItemDTO>): ShelfItemDTO {
  return {
    shelfUnitId: "s1",
    itemRef: "ref-1",
    kind: "book",
    position: "a",
    reviewIds: [],
    tagIds: [],
    ...overrides,
  };
}

function makeBook(unitId: string, title: string): BookDTO {
  return {
    unitId,
    translations: [{ language: "en", title }],
  } as unknown as BookDTO;
}

function makeReview(
  unitId: string,
  title: string,
  createdAt?: string,
): PostDTO {
  return {
    unitId,
    authorUserId: "u1",
    extra: { title },
    ...(createdAt ? { createdAt } : {}),
  } as unknown as PostDTO;
}

function primeEntry(
  itemRef: string,
  title: string,
  opts: {
    position?: string;
    createdAt?: string;
    reviews?: PostDTO[];
  } = {},
): EnrichedShelfItem {
  return {
    item: makeItem({
      itemRef,
      kind: "book",
      position: opts.position ?? "a",
      reviewIds: (opts.reviews ?? []).map((r) => r.unitId),
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    }),
    primary: makeBook(itemRef, title),
    attachedReviews: opts.reviews ?? [],
    attachedTags: [],
  };
}

function idsOf(stream: ShelfStreamEntry[]): string[] {
  return stream.map((e) => {
    if (e.kind === "prime") return e.enriched.item.itemRef;
    if (e.kind === "review") return e.review.unitId;
    return e.tag.unitId;
  });
}

describe("deriveShelfStream — nested mode", () => {
  test("emits exactly N entries for N items regardless of review count", () => {
    const items: EnrichedShelfItem[] = [
      primeEntry("book-a", "Apple", {
        position: "a",
        reviews: [makeReview("r-a1", "Zebra"), makeReview("r-a2", "Zulu")],
      }),
      primeEntry("book-b", "Banana", {
        position: "b",
        reviews: [makeReview("r-b1", "Alpha")],
      }),
      primeEntry("book-c", "Cherry", { position: "c" }),
    ];

    const stream = deriveShelfStream(items, "nested", "manual", true);

    expect(stream).toHaveLength(3);
    expect(stream.every((e) => e.kind === "prime")).toBe(true);
    expect(idsOf(stream)).toEqual(["book-a", "book-b", "book-c"]);
  });
});

describe("deriveShelfStream — flat emission", () => {
  test("flat mode emits N + M entries in prime-adjacent order when sortPrimeOnly = true", () => {
    const items: EnrichedShelfItem[] = [
      primeEntry("book-a", "Apple", {
        position: "a",
        reviews: [makeReview("r-a1", "Zebra"), makeReview("r-a2", "Zulu")],
      }),
      primeEntry("book-b", "Banana", {
        position: "b",
        reviews: [makeReview("r-b1", "Alpha")],
      }),
      primeEntry("book-c", "Cherry", { position: "c" }),
    ];

    const stream = deriveShelfStream(items, "flat", "manual", true);

    expect(stream).toHaveLength(6);
    expect(idsOf(stream)).toEqual([
      "book-a",
      "r-a1",
      "r-a2",
      "book-b",
      "r-b1",
      "book-c",
    ]);
  });

  test("flat + title sort + sortPrimeOnly=true keeps each review immediately after its prime", () => {
    const items: EnrichedShelfItem[] = [
      primeEntry("book-b", "Banana", {
        position: "b",
        reviews: [makeReview("r-b1", "Alpha")],
      }),
      primeEntry("book-a", "Apple", {
        position: "a",
        reviews: [makeReview("r-a1", "Zebra")],
      }),
      primeEntry("book-c", "Cherry", { position: "c" }),
    ];

    const stream = deriveShelfStream(items, "flat", "title", true);

    expect(idsOf(stream)).toEqual([
      "book-a",
      "r-a1",
      "book-b",
      "r-b1",
      "book-c",
    ]);
  });

  test("flat + title sort + sortPrimeOnly=false interleaves reviews and primes by title", () => {
    const items: EnrichedShelfItem[] = [
      primeEntry("book-b", "Banana", {
        position: "b",
        reviews: [makeReview("r-b1", "Alpha")],
      }),
      primeEntry("book-a", "Apple", {
        position: "a",
        reviews: [makeReview("r-a1", "Zebra")],
      }),
      primeEntry("book-c", "Cherry", { position: "c" }),
    ];

    const stream = deriveShelfStream(items, "flat", "title", false);

    expect(idsOf(stream)).toEqual([
      "r-b1",
      "book-a",
      "book-b",
      "book-c",
      "r-a1",
    ]);
  });
});

describe("deriveShelfStream — sort scope and layout invariants", () => {
  const items: EnrichedShelfItem[] = [
    primeEntry("book-b", "Banana", {
      position: "b",
      reviews: [makeReview("r-b1", "Alpha")],
    }),
    primeEntry("book-a", "Apple", {
      position: "a",
      reviews: [makeReview("r-a1", "Zebra")],
    }),
    primeEntry("book-c", "Cherry", { position: "c" }),
  ];

  test("manual sort ignores sortPrimeOnly (both flag values produce identical output)", () => {
    const withOn = deriveShelfStream(items, "flat", "manual", true);
    const withOff = deriveShelfStream(items, "flat", "manual", false);
    expect(idsOf(withOn)).toEqual(idsOf(withOff));
    expect(idsOf(withOn)).toEqual([
      "book-a",
      "r-a1",
      "book-b",
      "r-b1",
      "book-c",
    ]);
  });

  test("flat and masonry produce identical stream order for the same inputs", () => {
    for (const sort of ["manual", "time", "title"] as const) {
      for (const scope of [true, false]) {
        const flat = deriveShelfStream(items, "flat", sort, scope);
        const masonry = deriveShelfStream(items, "masonry", sort, scope);
        expect(idsOf(masonry)).toEqual(idsOf(flat));
      }
    }
  });

  test("derivation is pure — two calls return deep-equal arrays", () => {
    const a = deriveShelfStream(items, "flat", "title", true);
    const b = deriveShelfStream(items, "flat", "title", true);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test("title sort has deterministic fallback when titles match", () => {
    const tiedItems: EnrichedShelfItem[] = [
      primeEntry("book-c", "Same", { position: "c" }),
      primeEntry("book-a", "Same", { position: "a" }),
      primeEntry("book-b", "Same", { position: "b" }),
    ];

    const first = deriveShelfStream(tiedItems, "flat", "title", true);
    const second = deriveShelfStream(tiedItems, "flat", "title", true);

    expect(idsOf(first)).toEqual(["book-a", "book-b", "book-c"]);
    expect(idsOf(second)).toEqual(idsOf(first));
  });

  test("time sort has deterministic fallback when timestamps are missing", () => {
    const tiedItems: EnrichedShelfItem[] = [
      primeEntry("book-c", "Cherry", { position: "c" }),
      primeEntry("book-a", "Apple", { position: "a" }),
      primeEntry("book-b", "Banana", { position: "b" }),
    ];

    const stream = deriveShelfStream(tiedItems, "masonry", "time", true);

    expect(idsOf(stream)).toEqual(["book-a", "book-b", "book-c"]);
  });
});

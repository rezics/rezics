import { describe, expect, test } from "bun:test";
import type { EnrichedShelfItem } from "@rezics/api/shelf";
import type {
  BookDTO,
  PostDTO,
  ShelfItemChildDTO,
  ShelfItemDTO,
} from "@rezics/contract";
import { deriveShelfStream, type ShelfStreamEntry } from "./shelfStream";

const manualAsc = { field: "manual", order: "asc" } as const;
const manualDesc = { field: "manual", order: "desc" } as const;
const addedAtAsc = { field: "addedAt", order: "asc" } as const;
const addedAtDesc = { field: "addedAt", order: "desc" } as const;
const titleAsc = { field: "title", order: "asc" } as const;
const titleDesc = { field: "title", order: "desc" } as const;

function makeUnit(overrides: Partial<ShelfItemDTO>): ShelfItemDTO {
  return {
    shelfId: "s1",
    itemType: "unit",
    itemId: "u-1",
    kind: "book",
    position: "a",
    ...overrides,
  };
}

function makeBook(unitId: string, title: string): BookDTO {
  return {
    unitId,
    resolvedLanguage: "en",
    title,
    translations: [{ language: "en", title }],
  } as unknown as BookDTO;
}

function makeReviewPost(unitId: string, title: string): PostDTO {
  return {
    unitId,
    authorUserId: "u1",
    title,
  } as unknown as PostDTO;
}

interface RootSpec {
  unitId: string;
  title: string;
  position?: string;
  createdAt?: string;
  reviews?: { unitId: string; title: string }[];
}

function buildScene(roots: RootSpec[]): {
  units: EnrichedShelfItem[];
  relations: ShelfItemChildDTO[];
} {
  const units: EnrichedShelfItem[] = [];
  const relations: ShelfItemChildDTO[] = [];

  for (const root of roots) {
    units.push({
      unit: makeUnit({
        shelfId: "s1",
        itemType: "unit",
        itemId: root.unitId,
        kind: "book",
        position: root.position ?? "a",
        ...(root.createdAt ? { createdAt: root.createdAt } : {}),
      }),
      data: makeBook(root.unitId, root.title),
    });

    for (const [index, review] of (root.reviews ?? []).entries()) {
      const reviewPosition = `${root.position ?? "a"}~${String(index).padStart(2, "0")}`;
      units.push({
        unit: makeUnit({
          shelfId: "s1",
          itemType: "unit",
          itemId: review.unitId,
          kind: "review",
          position: reviewPosition,
          ...(root.createdAt ? { createdAt: root.createdAt } : {}),
        }),
        data: makeReviewPost(review.unitId, review.title),
      });
      relations.push({
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: root.unitId,
        childItemType: "unit",
        childItemId: review.unitId,
        role: "review",
      });
    }
  }

  return { units, relations };
}

function idsOf(stream: ShelfStreamEntry[]): string[] {
  return stream.map((entry) => entry.unit.unit.itemId);
}

describe("deriveShelfStream — nested mode", () => {
  test("emits exactly one root entry per root regardless of children", () => {
    const { units, relations } = buildScene([
      {
        unitId: "book-a",
        title: "Apple",
        position: "a",
        reviews: [
          { unitId: "r-a1", title: "Zebra" },
          { unitId: "r-a2", title: "Zulu" },
        ],
      },
      {
        unitId: "book-b",
        title: "Banana",
        position: "b",
        reviews: [{ unitId: "r-b1", title: "Alpha" }],
      },
      { unitId: "book-c", title: "Cherry", position: "c" },
    ]);

    const stream = deriveShelfStream(
      units,
      relations,
      "nested",
      manualAsc,
      true,
    );

    expect(stream).toHaveLength(3);
    expect(stream.every((entry) => entry.kind === "root")).toBe(true);
    expect(idsOf(stream)).toEqual(["book-a", "book-b", "book-c"]);
    const first = stream[0]!;
    if (first.kind === "root") {
      expect(first.children.map((c) => c.unit.itemId)).toEqual([
        "r-a1",
        "r-a2",
      ]);
    }
  });

  test("multi-parent child appears under each parent in nested mode", () => {
    const { units, relations } = buildScene([
      { unitId: "book-a", title: "Apple", position: "a" },
      { unitId: "book-b", title: "Banana", position: "b" },
    ]);
    units.push({
      unit: makeUnit({
        shelfId: "s1",
        itemType: "unit",
        itemId: "r-shared",
        kind: "review",
        position: "a~00",
      }),
      data: makeReviewPost("r-shared", "Shared"),
    });
    relations.push(
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "book-a",
        childItemType: "unit",
        childItemId: "r-shared",
        role: "review",
      },
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "book-b",
        childItemType: "unit",
        childItemId: "r-shared",
        role: "review",
      },
    );

    const stream = deriveShelfStream(
      units,
      relations,
      "nested",
      manualAsc,
      true,
    );

    expect(idsOf(stream)).toEqual(["book-a", "book-b"]);
    const [a, b] = stream;
    if (a?.kind === "root" && b?.kind === "root") {
      expect(a.children.map((c) => c.unit.itemId)).toEqual(["r-shared"]);
      expect(b.children.map((c) => c.unit.itemId)).toEqual(["r-shared"]);
    }
  });

  test("variant children group under the main catalog root", () => {
    const units: EnrichedShelfItem[] = [
      {
        unit: makeUnit({
          itemId: "main-1",
          kind: "book",
          position: "a",
        }),
        data: makeBook("main-1", "Main Work"),
      },
      {
        unit: makeUnit({
          itemId: "variant-1",
          kind: "book",
          parentItemType: "unit",
          parentItemId: "main-1",
          parentRole: "variant",
          position: "a~00",
        }),
        data: makeBook("variant-1", "Variant Edition"),
      },
    ];
    const relations: ShelfItemChildDTO[] = [
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "main-1",
        childItemType: "unit",
        childItemId: "variant-1",
        role: "variant",
      },
    ];

    const stream = deriveShelfStream(
      units,
      relations,
      "nested",
      manualAsc,
      true,
    );

    expect(idsOf(stream)).toEqual(["main-1"]);
    const [root] = stream;
    if (root?.kind === "root") {
      expect(root.children.map((c) => c.unit.itemId)).toEqual(["variant-1"]);
    }
  });

  test("two-step cycle (A ↔ B as each other's children) renders no roots", () => {
    const units: EnrichedShelfItem[] = [
      {
        unit: makeUnit({
          itemType: "unit",
          itemId: "book-a",
          kind: "book",
          position: "a",
        }),
        data: makeBook("book-a", "Apple"),
      },
      {
        unit: makeUnit({
          itemType: "unit",
          itemId: "book-b",
          kind: "book",
          position: "b",
        }),
        data: makeBook("book-b", "Banana"),
      },
    ];
    const relations: ShelfItemChildDTO[] = [
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "book-a",
        childItemType: "unit",
        childItemId: "book-b",
        role: "review",
      },
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "book-b",
        childItemType: "unit",
        childItemId: "book-a",
        role: "review",
      },
    ];

    const stream = deriveShelfStream(
      units,
      relations,
      "nested",
      manualAsc,
      true,
    );

    expect(stream).toHaveLength(0);
  });
});

describe("deriveShelfStream — flat emission", () => {
  test("flat + sortPrimeOnly=true emits root then its children in order", () => {
    const { units, relations } = buildScene([
      {
        unitId: "book-a",
        title: "Apple",
        position: "a",
        reviews: [
          { unitId: "r-a1", title: "Zebra" },
          { unitId: "r-a2", title: "Zulu" },
        ],
      },
      {
        unitId: "book-b",
        title: "Banana",
        position: "b",
        reviews: [{ unitId: "r-b1", title: "Alpha" }],
      },
      { unitId: "book-c", title: "Cherry", position: "c" },
    ]);

    const stream = deriveShelfStream(units, relations, "flat", manualAsc, true);

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

  test("flat + sortPrimeOnly=false (all-entry) emits every unit once", () => {
    const { units, relations } = buildScene([
      {
        unitId: "book-b",
        title: "Banana",
        position: "b",
        reviews: [{ unitId: "r-b1", title: "Alpha" }],
      },
      {
        unitId: "book-a",
        title: "Apple",
        position: "a",
        reviews: [{ unitId: "r-a1", title: "Zebra" }],
      },
      { unitId: "book-c", title: "Cherry", position: "c" },
    ]);

    const stream = deriveShelfStream(units, relations, "flat", titleAsc, false);

    expect(stream).toHaveLength(5);
    expect(stream.every((entry) => entry.kind === "peer")).toBe(true);
    // titles: Alpha, Apple, Banana, Cherry, Zebra
    // 标题顺序：Alpha, Apple, Banana, Cherry, Zebra
    expect(idsOf(stream)).toEqual([
      "r-b1",
      "book-a",
      "book-b",
      "book-c",
      "r-a1",
    ]);
  });

  test("flat all-entry shows multi-parent child only once", () => {
    const { units, relations } = buildScene([
      { unitId: "book-a", title: "Apple", position: "a" },
      { unitId: "book-b", title: "Banana", position: "b" },
    ]);
    units.push({
      unit: makeUnit({
        itemType: "unit",
        itemId: "r-shared",
        kind: "review",
        position: "a~00",
      }),
      data: makeReviewPost("r-shared", "Shared"),
    });
    relations.push(
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "book-a",
        childItemType: "unit",
        childItemId: "r-shared",
        role: "review",
      },
      {
        shelfId: "s1",
        parentItemType: "unit",
        parentItemId: "book-b",
        childItemType: "unit",
        childItemId: "r-shared",
        role: "review",
      },
    );

    const stream = deriveShelfStream(
      units,
      relations,
      "flat",
      manualAsc,
      false,
    );

    const sharedAppearances = stream.filter(
      (entry) => entry.unit.unit.itemId === "r-shared",
    );
    expect(sharedAppearances).toHaveLength(1);
    expect(stream).toHaveLength(3);
  });
});

describe("deriveShelfStream — sort scope and invariants", () => {
  function defaultScene(): {
    units: EnrichedShelfItem[];
    relations: ShelfItemChildDTO[];
  } {
    return buildScene([
      {
        unitId: "book-b",
        title: "Banana",
        position: "b",
        reviews: [{ unitId: "r-b1", title: "Alpha" }],
      },
      {
        unitId: "book-a",
        title: "Apple",
        position: "a",
        reviews: [{ unitId: "r-a1", title: "Zebra" }],
      },
      { unitId: "book-c", title: "Cherry", position: "c" },
    ]);
  }

  test("manual sort yields the same prime-anchored stream regardless of sortPrimeOnly flag", () => {
    const { units, relations } = defaultScene();
    const withOn = deriveShelfStream(units, relations, "flat", manualAsc, true);
    const withOff = deriveShelfStream(
      units,
      relations,
      "flat",
      manualAsc,
      false,
    );
    // sortPrimeOnly=true keeps children right after their root.
    // sortPrimeOnly=true 让子项紧跟在各自的 root 之后。
    expect(idsOf(withOn)).toEqual([
      "book-a",
      "r-a1",
      "book-b",
      "r-b1",
      "book-c",
    ]);
    // sortPrimeOnly=false emits all peers by position.
    // sortPrimeOnly=false 按 position 输出所有 peer。
    expect(idsOf(withOff)).toEqual([
      "book-a",
      "r-a1",
      "book-b",
      "r-b1",
      "book-c",
    ]);
  });

  test("derivation is pure — two calls return deep-equal arrays", () => {
    const { units, relations } = defaultScene();
    const a = deriveShelfStream(units, relations, "flat", titleAsc, true);
    const b = deriveShelfStream(units, relations, "flat", titleAsc, true);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test("title sort has deterministic fallback when titles match", () => {
    const { units, relations } = buildScene([
      { unitId: "book-c", title: "Same", position: "c" },
      { unitId: "book-a", title: "Same", position: "a" },
      { unitId: "book-b", title: "Same", position: "b" },
    ]);

    const first = deriveShelfStream(units, relations, "flat", titleAsc, true);
    const second = deriveShelfStream(units, relations, "flat", titleAsc, true);

    expect(idsOf(first)).toEqual(["book-a", "book-b", "book-c"]);
    expect(idsOf(second)).toEqual(idsOf(first));
  });

  test("manual descending renders larger positions first", () => {
    const { units, relations } = defaultScene();
    const stream = deriveShelfStream(
      units,
      relations,
      "flat",
      manualDesc,
      true,
    );

    expect(idsOf(stream)).toEqual([
      "book-c",
      "book-b",
      "r-b1",
      "book-a",
      "r-a1",
    ]);
  });

  test("addedAt ascending and descending use shelf item creation time", () => {
    const { units, relations } = buildScene([
      {
        unitId: "book-a",
        title: "Apple",
        position: "a",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        unitId: "book-c",
        title: "Cherry",
        position: "c",
        createdAt: "2026-01-03T00:00:00.000Z",
      },
      {
        unitId: "book-b",
        title: "Banana",
        position: "b",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    expect(
      idsOf(deriveShelfStream(units, relations, "flat", addedAtAsc, true)),
    ).toEqual(["book-a", "book-b", "book-c"]);
    expect(
      idsOf(deriveShelfStream(units, relations, "flat", addedAtDesc, true)),
    ).toEqual(["book-c", "book-b", "book-a"]);
  });

  test("title descending reverses title order with deterministic fallbacks", () => {
    const { units, relations } = defaultScene();
    const stream = deriveShelfStream(units, relations, "flat", titleDesc, true);

    expect(idsOf(stream)).toEqual([
      "book-c",
      "book-b",
      "r-b1",
      "book-a",
      "r-a1",
    ]);
  });

  test("flat mode children entries carry parentUnitId metadata", () => {
    const { units, relations } = defaultScene();
    const stream = deriveShelfStream(units, relations, "flat", manualAsc, true);

    const child = stream.find((entry) => entry.kind === "child");
    expect(child).toBeTruthy();
    if (child?.kind === "child") {
      expect(child.parentUnitId).toBe("book-a");
      expect(child.parent?.unit.itemId).toBe("book-a");
      expect(child.unit.unit.itemId).toBe("r-a1");
    }
  });
});

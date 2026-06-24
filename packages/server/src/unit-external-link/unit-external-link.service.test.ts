import { describe, expect, test } from "bun:test";
import type { UnitExternalLinkRepository } from "./unit-external-link.service";
import { UnitExternalLinkService } from "./unit-external-link.service";

const now = new Date("2026-06-12T00:00:00.000Z");

function makeHydratedLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "link-1",
    unitId: "unit-1",
    sourceEntityUnitId: "source-entity-1",
    url: "https://Book.Qidian.com/info/123?b=2&a=1#chapter",
    normalizedUrl: "https://book.qidian.com/info/123?a=1&b=2",
    normalizedUrlHash: "hash",
    role: "source",
    labelUnitId: null,
    fallbackText: null,
    position: "a",
    createdAt: now,
    updatedAt: now,
    sourceEntity: {
      unitId: "source-entity-1",
      kind: "source",
      verified: true,
      avatar: null,
      eligibleCreditRoles: [],
      eligibleSubjectRoles: [],
      unit: {
        id: "source-entity-1",
        type: "ENTITY",
        slug: "qidian",
        slugScope: null,
        catalogEntryKind: "MAIN",
        targetUnitId: null,
        createdById: null,
        moderationStatus: "APPROVED",
        createdAt: now,
        updatedAt: now,
        translations: [
          {
            unitId: "source-entity-1",
            language: "en",
            title: "Qidian",
            subtitle: null,
            summary: null,
            description: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    },
    labelUnit: null,
    ...overrides,
  } as any;
}

function makeRepository(
  overrides: Partial<UnitExternalLinkRepository> = {},
): UnitExternalLinkRepository & {
  created: unknown[];
} {
  const created: unknown[] = [];
  return {
    created,
    async list() {
      return { rows: [], total: 0 };
    },
    async unitExists(unitId: string) {
      return unitId === "unit-1";
    },
    async entityExists(unitId: string) {
      return unitId === "source-entity-1" || unitId === "source-entity-2";
    },
    async nextPosition() {
      return "V";
    },
    async create(data) {
      created.push(data);
      return makeHydratedLink(data);
    },
    async getById() {
      return makeHydratedLink();
    },
    async getCurrent() {
      return {
        sourceEntityUnitId: "source-entity-1",
        url: "https://book.qidian.com/info/123",
      };
    },
    async update(_id, data) {
      return makeHydratedLink(data);
    },
    async delete() {},
    async listExternalLinksForUnits() {
      return [makeHydratedLink()];
    },
    ...overrides,
  };
}

describe("UnitExternalLinkService", () => {
  test("creates links from selected source Entity plus full URL", async () => {
    const repository = makeRepository();
    const service = new UnitExternalLinkService(repository);

    await service.create({
      unitId: "unit-1",
      sourceEntityUnitId: "source-entity-1",
      url: "https://Book.Qidian.com/info/123?b=2&a=1#chapter",
      role: "source",
    });

    expect(repository.created[0]).toMatchObject({
      unitId: "unit-1",
      sourceEntityUnitId: "source-entity-1",
      url: "https://Book.Qidian.com/info/123?b=2&a=1#chapter",
      normalizedUrl: "https://book.qidian.com/info/123?a=1&b=2",
      role: "source",
    });
  });

  test("rejects missing source Entities before storing a URL", async () => {
    const repository = makeRepository({
      async entityExists() {
        return false;
      },
    });
    const service = new UnitExternalLinkService(repository);

    await expect(
      service.create({
        unitId: "unit-1",
        sourceEntityUnitId: "missing-source",
        url: "https://example.com/work/1",
      }),
    ).rejects.toThrow("Source Entity not found");
    expect(repository.created).toHaveLength(0);
  });

  test("filters Unit links by source Entity and hydrates display labels", async () => {
    const service = new UnitExternalLinkService(makeRepository());

    const response = await service.externalLinksForUnit(
      "unit-1",
      "source-entity-1",
    );

    expect(response.links).toHaveLength(1);
    expect(response.links[0]).toMatchObject({
      unitId: "unit-1",
      sourceEntityUnitId: "source-entity-1",
      label: "Qidian",
      sourceEntity: {
        unitId: "source-entity-1",
        name: "Qidian",
      },
    });
  });
});

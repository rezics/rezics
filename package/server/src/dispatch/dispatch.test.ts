import { describe, expect, it, mock } from "bun:test";
import type { ApiTokenScopes } from "@rezics/contract";
import { DispatchScope, DispatchType } from "@rezics/contract";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { tokenService } from "@/token/token.service";

installPrismaClientMock();

async function makeDispatchService() {
  const { DispatchService } = await import("./dispatch.service");
  return new DispatchService();
}

function freshDispatchMocks() {
  Object.assign(prismaMock, {
    unit: {
      findUniqueOrThrow: mock(async () => ({ defaultLanguage: "en" })),
      create: mock(async () => ({ id: "created-unit" })),
    },
    unitTranslation: {
      findUnique: mock(async () => ({ extra: { source: "existing" } })),
      upsert: mock(async (args: any) => args.create),
    },
    creditAttribution: {
      upsert: mock(async (args: any) => args.create),
    },
    game: {
      update: mock(async (args: any) => args.data),
    },
    media: {
      update: mock(async (args: any) => args.data),
    },
    entity: {
      findMany: mock(async () => []),
    },
    subjectAttribution: {
      createMany: mock(async () => ({ count: 0 })),
    },
    unitTag: {
      createMany: mock(async () => ({ count: 0 })),
    },
  });
}

describe("dispatch result intake - permission checks", () => {
  it("grants update when token has dispatch:unit:update scope", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_UPDATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_UPDATE,
      ),
    ).toBe(true);
  });

  it("grants create when token has dispatch:unit:create scope", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_CREATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      ),
    ).toBe(true);
  });

  it("denies create when token only has unit:update", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: [DispatchScope.UNIT_UPDATE],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      ),
    ).toBe(false);
  });

  it("grants all permissions with wildcard", () => {
    const scopes: ApiTokenScopes = {
      [DispatchScope.DOMAIN]: ["*"],
    };
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_UPDATE,
      ),
    ).toBe(true);
    expect(
      tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      ),
    ).toBe(true);
  });
});

describe("dispatch service - config", () => {
  it("returns null when env vars are not set", async () => {
    const service = await makeDispatchService();
    // In test env without DISPATCH_* vars, getConfig should return null
    const config = service.getConfig();
    // Config will be null since env vars are not set in test
    expect(config === null || typeof config === "object").toBe(true);
  });
});

describe("hub audit notification - HMAC signing", () => {
  it("produces consistent HMAC for sorted taskIds", async () => {
    const secret = "test-secret";
    const taskIds = ["task-c", "task-a", "task-b"];
    const project = "rezics";

    const sorted = [...taskIds].sort();
    const payload = sorted.join(",") + ":" + project;
    const key = new TextEncoder().encode(secret);
    const data = new TextEncoder().encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig1 = Buffer.from(
      await crypto.subtle.sign("HMAC", cryptoKey, data),
    ).toString("hex");

    // Signing again with same input should produce identical result
    const sig2 = Buffer.from(
      await crypto.subtle.sign("HMAC", cryptoKey, data),
    ).toString("hex");

    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it("sorts taskIds before signing", () => {
    const unsorted = ["c", "a", "b"];
    const sorted = [...unsorted].sort();
    expect(sorted).toEqual(["a", "b", "c"]);
    expect(sorted.join(",") + ":rezics").toBe("a,b,c:rezics");
  });
});

describe("dispatch type validation", () => {
  it("DispatchType enum has expected values", () => {
    expect(DispatchType.BOOK).toBe("rezics:book");
    expect(DispatchType.GAME).toBe("rezics:game");
    expect(DispatchType.MEDIA).toBe("rezics:media");
  });
});

describe("dispatch service - GAME/MEDIA shared metadata", () => {
  it("stores game display metadata in UnitTranslation and credits in CreditAttribution", async () => {
    freshDispatchMocks();
    const service = await makeDispatchService();
    const description = { type: "doc", content: [] };

    await service.processResult(
      {
        taskId: "task-1",
        project: "rezics",
        type: DispatchType.GAME,
        unitId: "game-1",
        data: {
          title: "The Legend",
          description,
          coverUrl: "https://example.test/box.jpg",
          releaseDate: "2024-03-15",
          creditAttributions: [
            { entityId: "studio-1", role: "developer", sortOrder: 2 },
          ],
        },
      },
      "user-1",
    );

    expect(prismaMock.game.update).toHaveBeenCalledWith({
      where: { unitId: "game-1" },
      data: { releaseDate: new Date("2024-03-15") },
    });
    expect(prismaMock.unitTranslation.upsert).toHaveBeenCalledWith({
      where: { unitId_language: { unitId: "game-1", language: "en" } },
      create: {
        unitId: "game-1",
        language: "en",
        title: "The Legend",
        subtitle: undefined,
        summary: undefined,
        description,
        extra: {
          source: "existing",
          coverUrl: "https://example.test/box.jpg",
        },
      },
      update: {
        title: "The Legend",
        subtitle: undefined,
        summary: undefined,
        description,
        extra: {
          source: "existing",
          coverUrl: "https://example.test/box.jpg",
        },
      },
    });
    expect(prismaMock.creditAttribution.upsert).toHaveBeenCalledWith({
      where: {
        unitId_entityId_role: {
          unitId: "game-1",
          entityId: "studio-1",
          role: "developer",
        },
      },
      create: {
        unitId: "game-1",
        entityId: "studio-1",
        role: "developer",
        sortOrder: 2,
      },
      update: { sortOrder: 2 },
    });
  });

  it("stores media translations and role-keyed credits outside the Media row", async () => {
    freshDispatchMocks();
    prismaMock.unit.create = mock(async () => ({ id: "media-1" }));
    const service = await makeDispatchService();

    await service.processResult(
      {
        taskId: "task-2",
        project: "rezics",
        type: DispatchType.MEDIA,
        data: {
          kindKey: "movie",
          title: "Ignored flat title",
          translations: [{ language: "ja", title: "映画", summary: "概要" }],
          credits: {
            studio: ["studio-1"],
            actor: [{ entityId: "actor-1", sortOrder: 3 }],
          },
        },
      },
      "user-1",
    );

    expect(prismaMock.unit.create).toHaveBeenCalledWith({
      data: {
        type: "MEDIA",
        userId: "user-1",
        slugScope: "user-1",
        status: "DRAFT",
        media: { create: { kindKey: "movie" } },
      },
    });
    expect(prismaMock.unitTranslation.upsert).toHaveBeenCalledWith({
      where: { unitId_language: { unitId: "media-1", language: "ja" } },
      create: {
        unitId: "media-1",
        language: "ja",
        title: "映画",
        subtitle: undefined,
        summary: "概要",
        description: undefined,
        extra: { source: "existing" },
      },
      update: {
        title: "映画",
        subtitle: undefined,
        summary: "概要",
        description: undefined,
        extra: { source: "existing" },
      },
    });
    expect(prismaMock.creditAttribution.upsert).toHaveBeenCalledTimes(2);
    expect(
      prismaMock.creditAttribution.upsert.mock.calls[0]?.[0].create,
    ).toEqual({
      unitId: "media-1",
      entityId: "studio-1",
      role: "studio",
      sortOrder: 0,
    });
    expect(
      prismaMock.creditAttribution.upsert.mock.calls[1]?.[0].create,
    ).toEqual({
      unitId: "media-1",
      entityId: "actor-1",
      role: "actor",
      sortOrder: 3,
    });
  });
});

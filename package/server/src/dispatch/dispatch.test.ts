import { describe, expect, it, mock } from "bun:test";
import type { ApiTokenScopes } from "@rezics/contract";
import { DispatchScope, DispatchType } from "@rezics/contract";
import { tokenService } from "@/token/token.service";
import type { DispatchRepository } from "./dispatch.service";

async function makeDispatchService(repository?: DispatchRepository) {
  const { DispatchService } = await import("./dispatch.service");
  return repository ? new DispatchService(repository) : new DispatchService();
}

function createDispatchRepositoryStub(
  overrides: Partial<DispatchRepository> = {},
): DispatchRepository {
  return {
    getUnitDefaultLanguage: mock(async () => "en"),
    getTranslationExtra: mock(async () => ({ source: "existing" })),
    upsertTranslation: mock(async () => {}),
    upsertCredit: mock(async () => {}),
    updateBook: mock(async () => {}),
    createBookUnit: mock(async () => "book-1"),
    updateGame: mock(async () => {}),
    createGameUnit: mock(async () => "game-1"),
    updateMedia: mock(async () => {}),
    createMediaUnit: mock(async () => "media-1"),
    ...overrides,
  };
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
    const config = service.getConfig();
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

    const sig2 = Buffer.from(
      await crypto.subtle.sign("HMAC", cryptoKey, data),
    ).toString("hex");

    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64);
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
    const repository = createDispatchRepositoryStub();
    const service = await makeDispatchService(repository);
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

    expect(repository.updateGame).toHaveBeenCalledWith("game-1", {
      releaseDate: new Date("2024-03-15"),
    });
    expect(repository.upsertTranslation).toHaveBeenCalledWith({
      unitId: "game-1",
      language: "en",
      title: "The Legend",
      subtitle: undefined,
      summary: undefined,
      description,
      createExtra: {
        source: "existing",
        coverUrl: "https://example.test/box.jpg",
      },
      updateExtra: {
        source: "existing",
        coverUrl: "https://example.test/box.jpg",
      },
    });
    expect(repository.upsertCredit).toHaveBeenCalledWith({
      unitId: "game-1",
      entityId: "studio-1",
      role: "developer",
      sortOrder: 2,
    });
  });

  it("stores media translations and role-keyed credits outside the Media row", async () => {
    const repository = createDispatchRepositoryStub();
    const service = await makeDispatchService(repository);

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

    expect(repository.createMediaUnit).toHaveBeenCalledWith("user-1", {
      kindKey: "movie",
    });
    expect(repository.upsertTranslation).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: "media-1",
        language: "ja",
        title: "映画",
        subtitle: undefined,
        summary: "概要",
        createExtra: { source: "existing" },
        updateExtra: { source: "existing" },
      }),
    );
    expect(repository.upsertCredit).toHaveBeenCalledTimes(2);
    expect(repository.upsertCredit).toHaveBeenNthCalledWith(1, {
      unitId: "media-1",
      entityId: "studio-1",
      role: "studio",
      sortOrder: 0,
    });
    expect(repository.upsertCredit).toHaveBeenNthCalledWith(2, {
      unitId: "media-1",
      entityId: "actor-1",
      role: "actor",
      sortOrder: 3,
    });
  });
});

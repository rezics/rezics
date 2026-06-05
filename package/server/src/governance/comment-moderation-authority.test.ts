import { describe, expect, mock, test } from "bun:test";

const enqueueMock = mock(async () => ({ status: "created" }));
const broadcastMock = mock(async () => ({ ok: true }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: broadcastMock,
}));

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: (user: unknown) => user ?? null,
}));

function capabilities(input: {
  platform?: boolean;
  realmCapabilities?: string[];
}) {
  return {
    resolveHintsForIdentity: mock(async () =>
      input.platform
        ? [{ capability: "comment.moderate", scope: { kind: "global" } }]
        : [],
    ),
    realmMembershipForPolicy: mock(async (realmUnitId: string) =>
      input.realmCapabilities
        ? {
            realmUnitId,
            role: "moderator",
            capabilities: input.realmCapabilities.map((capability) => ({
              capability,
              scope: { kind: "realm", realmUnitId },
            })),
          }
        : null,
    ),
  };
}

const identity = {
  userId: "actor-1",
  permission: { role: "USER" as const },
};

const subject = {
  id: "comment-1",
  rootUnitId: "post-1",
  realmUnitId: "realm-1",
  rootUnit: {
    userId: "owner-1",
    collaborators: [],
  },
};

describe("GovernanceModerationService.resolveCommentModerationAuthority", () => {
  test("platform comment moderation capability has highest precedence", async () => {
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      undefined as never,
      capabilities({
        platform: true,
        realmCapabilities: ["comment.moderate"],
      }) as never,
    );

    await expect(
      service.resolveCommentModerationAuthority(identity, {
        ...subject,
        rootUnit: {
          userId: "actor-1",
          collaborators: [],
        },
      }),
    ).resolves.toBe("PLATFORM");
  });

  test("realm comment capability covers comments in that realm", async () => {
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      undefined as never,
      capabilities({ realmCapabilities: ["comment.moderate"] }) as never,
    );

    await expect(
      service.resolveCommentModerationAuthority(identity, subject),
    ).resolves.toBe("REALM");
  });

  test("queue realm decision remains a realm moderation equivalent", async () => {
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      undefined as never,
      capabilities({ realmCapabilities: ["queue.realm.decide"] }) as never,
    );

    await expect(
      service.resolveCommentModerationAuthority(identity, subject),
    ).resolves.toBe("REALM");
  });

  test("root owner and maintainer collaborators resolve owner authority", async () => {
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      undefined as never,
      capabilities({}) as never,
    );

    await expect(
      service.resolveCommentModerationAuthority(identity, {
        ...subject,
        realmUnitId: null,
        rootUnit: { userId: "actor-1", collaborators: [] },
      }),
    ).resolves.toBe("OWNER");

    await expect(
      service.resolveCommentModerationAuthority(identity, {
        ...subject,
        realmUnitId: null,
        rootUnit: {
          userId: "owner-1",
          collaborators: [{ userId: "actor-1", roleKey: "maintainer" }],
        },
      }),
    ).resolves.toBe("OWNER");
  });

  test("editor collaborators do not receive owner moderation authority", async () => {
    const { GovernanceModerationService } = await import(
      "./moderation.service"
    );
    const service = new GovernanceModerationService(
      undefined as never,
      capabilities({}) as never,
    );

    await expect(
      service.resolveCommentModerationAuthority(identity, {
        ...subject,
        realmUnitId: null,
        rootUnit: {
          userId: "owner-1",
          collaborators: [{ userId: "actor-1", roleKey: "editor" }],
        },
      }),
    ).resolves.toBeNull();
  });
});

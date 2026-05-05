// MOCK: Storybook realm fixtures, hand-authored against `RealmDTO`.
import type { RealmDTO } from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import { userAlice } from "./user.ts";

function makeRealm(
  overrides: Partial<RealmDTO> & { unitId: string },
): RealmDTO {
  return {
    unitId: overrides.unitId,
    user: userAlice,
    userId: userAlice.unitId,
    isPublic: true,
    isOfficial: false,
    memberCount: 128,
    translations: [
      {
        unitId: overrides.unitId,
        language: LANGUAGES.EN,
        title: "Slow Reading Society",
        description: "A community for readers who linger and re-read.",
      },
    ],
    reactionSummaries: [],
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-04-12T00:00:00.000Z",
    ...overrides,
  } as RealmDTO;
}

export const realmDefault: RealmDTO = makeRealm({ unitId: "realm-default" });

export const realmOfficial: RealmDTO = makeRealm({
  unitId: "realm-official",
  isOfficial: true,
  memberCount: 12420,
  translations: [
    {
      unitId: "realm-official",
      language: LANGUAGES.EN,
      title: "Editor's Picks",
      description: "Curated selections from the rezics editorial team.",
    },
  ],
});

export const realmPrivate: RealmDTO = makeRealm({
  unitId: "realm-private",
  isPublic: false,
  memberCount: 24,
  translations: [
    {
      unitId: "realm-private",
      language: LANGUAGES.EN,
      title: "Beta readers",
      description: "Closed group for in-progress drafts.",
    },
  ],
});

export const realmList: RealmDTO[] = [
  realmDefault,
  realmOfficial,
  realmPrivate,
];

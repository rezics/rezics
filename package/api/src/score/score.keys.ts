export const scoreKeys = {
  all: () => ["scores"] as const,

  aggregates: () => [...scoreKeys.all(), "aggregate"] as const,
  aggregatesByUnit: (unitId: string) =>
    [...scoreKeys.aggregates(), "unit", unitId] as const,
  aggregate: (unitId: string, realm: string) =>
    [...scoreKeys.aggregates(), "unit", unitId, realm] as const,

  userScores: () => [...scoreKeys.all(), "user"] as const,
  userScoresForUnit: (userId: string, unitId: string) =>
    [...scoreKeys.userScores(), userId, unitId] as const,
  userScoreForRealm: (userId: string, unitId: string, realm: string) =>
    [...scoreKeys.userScores(), userId, unitId, realm] as const,

  realmFields: () => [...scoreKeys.all(), "realm-fields"] as const,
  realmFieldsForRealm: (realmId: string) =>
    [...scoreKeys.realmFields(), realmId] as const,
} as const;

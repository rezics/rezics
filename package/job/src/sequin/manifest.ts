export const SOURCE_SEQUIN_TABLES = [
  "HistoryOutbox",
  "Unit",
  "UnitTranslation",
  "UnitTag",
  "TagVote",
  "UnitAlias",
  "CreditAttribution",
  "SubjectAttribution",
  "UnitRealm",
  "RealmTagApplication",
  "ShelfItem",
  "ContentStructureNode",
  "Post",
  "User",
  "UserUnitProgress",
  "Comment",
  "ScoreEntry",
  "ScoreAggregate",
  "Feedback",
] as const;

export const REACTION_SEQUIN_TABLES = ["ReactionSummary"] as const;

export const ROUTED_SEQUIN_TABLES = [
  ...SOURCE_SEQUIN_TABLES,
  ...REACTION_SEQUIN_TABLES,
] as const;

export type SourceSequinTable = (typeof SOURCE_SEQUIN_TABLES)[number];
export type ReactionSequinTable = (typeof REACTION_SEQUIN_TABLES)[number];
export type RoutedSequinTable = (typeof ROUTED_SEQUIN_TABLES)[number];

export function isRoutedSequinTable(table: string): table is RoutedSequinTable {
  return (ROUTED_SEQUIN_TABLES as readonly string[]).includes(table);
}

import type { ScoreAggregate, ScoreEntry, ScoreRealmField } from "../db/schema";

export type ScoreAggregateRow = typeof ScoreAggregate.$inferSelect;
export type ScoreEntryRow = typeof ScoreEntry.$inferSelect;
export type ScoreRealmFieldRow = typeof ScoreRealmField.$inferSelect;

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export type Distribution = Record<string, number>;

export interface FieldAggregate {
  total: number;
  count: number;
  dist: Distribution;
}

export type FieldsAggregate = Record<string, FieldAggregate>;

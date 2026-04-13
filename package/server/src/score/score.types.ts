import type { ScoreAggregate, ScoreEntry, ScoreRealmField } from '#/prisma/client';

export type { ScoreAggregate, ScoreEntry, ScoreRealmField };

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export type Distribution = Record<string, number>;

export interface FieldAggregate {
  total: number;
  count: number;
  dist: Distribution;
}

export type FieldsAggregate = Record<string, FieldAggregate>;

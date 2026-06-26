import { t } from "elysia";
import { parseSchema, safeParseSchema } from "./common";
import { type HistoryCommand, HistoryCommandSchema } from "./history";
import {
  type MaintenanceCommand,
  MaintenanceCommandSchema,
} from "./maintenance";
import { type RankingCommand, RankingCommandSchema } from "./ranking";
import { type SearchCommand, SearchCommandSchema } from "./search";

export type AnyJobCommand =
  | SearchCommand
  | HistoryCommand
  | MaintenanceCommand
  | RankingCommand;

export const JobCommandSchema = t.Union([
  SearchCommandSchema,
  HistoryCommandSchema,
  MaintenanceCommandSchema,
  RankingCommandSchema,
]);

export function parseJobCommand(input: unknown): AnyJobCommand {
  return parseSchema(JobCommandSchema, input);
}

export function safeParseJobCommand(input: unknown) {
  return safeParseSchema(JobCommandSchema, input);
}

export * from "./common";
export * from "./history";
export * from "./maintenance";
export * from "./ranking";
export * from "./search";

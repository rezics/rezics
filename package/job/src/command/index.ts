import * as v from "valibot";
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

export const JobCommandSchema = v.union([
  SearchCommandSchema,
  HistoryCommandSchema,
  MaintenanceCommandSchema,
  RankingCommandSchema,
]);

export function parseJobCommand(input: unknown): AnyJobCommand {
  return v.parse(JobCommandSchema, input);
}

export function safeParseJobCommand(input: unknown) {
  return v.safeParse(JobCommandSchema, input);
}

export * from "./common";
export * from "./history";
export * from "./maintenance";
export * from "./ranking";
export * from "./search";

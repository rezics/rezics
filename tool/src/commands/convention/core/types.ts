export type Rule =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R9"
  | "R11"
  | "R12"
  | "R13"
  | "R14";

export interface Violation {
  rule: Rule;
  path: string;
  message: string;
  spec: string;
}

export interface ScanContext {
  apiFiles: string[];
  tsxFiles: string[];
  tsAndTsxFiles: string[];
  r9CandidateFiles: string[];
  folderPaths: string[];
}

export interface RuleScanner {
  scan(ctx: ScanContext): Violation[];
}

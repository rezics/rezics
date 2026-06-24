export type IdentifierType = "id" | "slug";

export type CandidateKind =
  | "unit"
  | "book"
  | "chapter"
  | "shelf"
  | "review"
  | "remark"
  | "tag"
  | "realm"
  | "post"
  | "user"
  | "zone"
  | "excerpt"
  | "domain"
  | (string & {});

export interface Candidate {
  kind: CandidateKind;
  identifier: string;
  identifierType: IdentifierType;
  paramName: string;
}

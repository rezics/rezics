export type JsonColumnCategory = "enveloped" | "compat" | "exempt" | "todo";

export type ContractSchemaReference = {
  symbol: string;
  path: string;
  supportingPaths?: string[];
};

export type JsonColumnRegistryEntry = {
  database: "server" | "auth";
  table: string;
  column: string;
} & (
  | {
      category: "enveloped";
      contractSchema: ContractSchemaReference;
    }
  | {
      category: "compat";
      contractSchema: ContractSchemaReference;
    }
  | {
      category: "exempt";
      reason: string;
    }
  | {
      category: "todo";
      auditPlan: "plan/proposal/compat-schema-audit.md";
    }
);

const auditPlan = "plan/proposal/compat-schema-audit.md" as const;

export const jsonColumnRegistry = [
  {
    database: "server",
    table: "Zone",
    column: "config",
    category: "enveloped",
    contractSchema: {
      symbol: "zoneConfigEnvelopeSchema",
      path: "package/contract/src/zone/upgrade.ts",
      supportingPaths: ["package/contract/src/zone/config-v1.ts"],
    },
  },
  {
    database: "server",
    table: "UnitTranslation",
    column: "description",
    category: "enveloped",
    contractSchema: {
      symbol: "contentDocEnvelopeSchema",
      path: "package/contract/src/content/doc-v1.ts",
    },
  },
  {
    database: "server",
    table: "ContentTranslation",
    column: "content",
    category: "enveloped",
    contractSchema: {
      symbol: "contentDocEnvelopeSchema",
      path: "package/contract/src/content/doc-v1.ts",
    },
  },
  {
    database: "server",
    table: "Comment",
    column: "content",
    category: "enveloped",
    contractSchema: {
      symbol: "contentDocEnvelopeSchema",
      path: "package/contract/src/content/doc-v1.ts",
    },
  },
  {
    database: "server",
    table: "Jwks",
    column: "publicJwk",
    category: "exempt",
    reason: "JSON Web Key object; external JOSE/JWK standard owns shape.",
  },
  {
    database: "server",
    table: "Jwks",
    column: "privateJwk",
    category: "exempt",
    reason: "JSON Web Key object; external JOSE/JWK standard owns shape.",
  },
  {
    database: "auth",
    table: "Jwks",
    column: "publicJwk",
    category: "exempt",
    reason: "JSON Web Key object; external JOSE/JWK standard owns shape.",
  },
  {
    database: "auth",
    table: "Jwks",
    column: "privateJwk",
    category: "exempt",
    reason: "JSON Web Key object; external JOSE/JWK standard owns shape.",
  },
  {
    database: "auth",
    table: "OAuthClient",
    column: "metadata",
    category: "exempt",
    reason: "OAuth client metadata is owned by the auth/OAuth provider shape.",
  },
  {
    database: "server",
    table: "EchoKV",
    column: "value",
    category: "exempt",
    reason: "Intentionally generic development KV store.",
  },
  ...todoColumns([
    ["server", "Unit", "extra"],
    ["server", "Unit", "aiDisclosureDetails"],
    ["server", "UnitTranslation", "extra"],
    ["server", "ContentTranslation", "provenance"],
    ["server", "Shelf", "extra"],
    ["server", "Series", "extra"],
    ["server", "Realm", "extra"],
    ["server", "UserUnitProgress", "extra"],
    ["server", "UserUnitProgress", "lastReadAnchor"],
    ["server", "User", "description"],
    ["server", "User", "permission"],
    ["server", "User", "settings"],
    ["server", "User", "extra"],
    ["server", "ApiToken", "scopes"],
    ["server", "ContentStructureAnchor", "ancestorNodeIds"],
    ["server", "ContentStructureAnchor", "path"],
    ["server", "ContentStructureAnchor", "titlePath"],
    ["server", "SourceSite", "refRules"],
    ["server", "ScoreAggregate", "distribution"],
    ["server", "ScoreAggregate", "fields"],
    ["server", "ScoreEntry", "fields"],
    ["server", "Post", "extra"],
    ["server", "HistoryOutbox", "payload"],
    ["server", "Game", "extra"],
    ["server", "GameSystemRequirement", "hardware"],
    ["server", "Media", "extra"],
    ["server", "AccountEnforcement", "metadata"],
    ["server", "ModerationCase", "metadata"],
    ["server", "StaffAuditLog", "metadata"],
    ["server", "Link", "extra"],
    ["server", "Book", "extra"],
  ]),
] satisfies JsonColumnRegistryEntry[];

function todoColumns(
  columns: Array<[JsonColumnRegistryEntry["database"], string, string]>,
): JsonColumnRegistryEntry[] {
  return columns.map(([database, table, column]) => ({
    database,
    table,
    column,
    category: "todo",
    auditPlan,
  }));
}

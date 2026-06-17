export type JsonColumnCategory = "enveloped" | "compat" | "exempt";

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
);

export const jsonColumnRegistry = [
  {
    database: "server",
    table: "Zone",
    column: "boundary",
    category: "enveloped",
    contractSchema: {
      symbol: "zoneBoundaryEnvelopeSchema",
      path: "package/contract/src/zone/boundary-v1.ts",
    },
  },
  {
    database: "server",
    table: "Zone",
    column: "nav",
    category: "enveloped",
    contractSchema: {
      symbol: "zoneNavEnvelopeSchema",
      path: "package/contract/src/zone/nav-v1.ts",
      supportingPaths: ["package/contract/src/zone/menu.ts"],
    },
  },
  {
    database: "server",
    table: "Zone",
    column: "theme",
    category: "enveloped",
    contractSchema: {
      symbol: "zoneThemeEnvelopeSchema",
      path: "package/contract/src/zone/theme-v1.ts",
    },
  },
  {
    database: "server",
    table: "ZonePage",
    column: "config",
    category: "enveloped",
    contractSchema: {
      symbol: "zonePageEnvelopeSchema",
      path: "package/contract/src/zone/page-v1.ts",
      supportingPaths: ["package/contract/src/zone/section.ts"],
    },
  },
  {
    database: "server",
    table: "Realm",
    column: "dock",
    category: "enveloped",
    contractSchema: {
      symbol: "realmDockEnvelopeSchema",
      path: "package/contract/src/realm/realm-dock.ts",
    },
  },
  {
    database: "server",
    table: "RealmTagTree",
    column: "tree",
    category: "enveloped",
    contractSchema: {
      symbol: "realmTagTreeEnvelopeSchema",
      path: "package/contract/src/realm/realm-tag-tree.ts",
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
    table: "User",
    column: "description",
    category: "enveloped",
    contractSchema: {
      symbol: "persistedContentDocSchema",
      path: "package/contract/src/json-column.ts",
      supportingPaths: ["package/contract/src/content/doc-v1.ts"],
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
  compat("server", "Unit", "extra", "unitExtraJsonSchema"),
  compat(
    "server",
    "Unit",
    "aiDisclosureDetails",
    "unitAiDisclosureDetailsJsonSchema",
  ),
  compat(
    "server",
    "UnitTranslation",
    "extra",
    "unitTranslationExtraJsonSchema",
  ),
  compat(
    "server",
    "ContentTranslation",
    "provenance",
    "contentTranslationProvenanceJsonSchema",
  ),
  compat("server", "Shelf", "extra", "genericMetadataJsonSchema"),
  compat("server", "Series", "extra", "genericMetadataJsonSchema"),
  compat("server", "Realm", "extra", "genericMetadataJsonSchema"),
  compat(
    "server",
    "UserUnitProgress",
    "extra",
    "userUnitProgressExtraJsonSchema",
  ),
  compat(
    "server",
    "UserUnitProgress",
    "lastReadAnchor",
    "lastReadAnchorJsonSchema",
  ),
  compat("server", "User", "permission", "userPermissionJsonSchema"),
  compat(
    "server",
    "UserPreference",
    "bookshelfConfig",
    "userBookshelfConfigJsonSchema",
  ),
  compat("server", "User", "extra", "genericMetadataJsonSchema"),
  compat("server", "ApiToken", "scopes", "apiTokenScopesJsonSchema"),
  compat(
    "server",
    "ContentStructureAnchor",
    "ancestorNodeIds",
    "contentStructurePathJsonSchema",
  ),
  compat(
    "server",
    "ContentStructureAnchor",
    "path",
    "contentStructurePathJsonSchema",
  ),
  compat(
    "server",
    "ContentStructureAnchor",
    "titlePath",
    "contentStructureTitlePathJsonSchema",
  ),
  compat(
    "server",
    "ScoreAggregate",
    "distribution",
    "scoreDistributionJsonSchema",
  ),
  compat(
    "server",
    "ScoreAggregate",
    "fields",
    "scoreAggregateFieldsJsonSchema",
  ),
  compat("server", "ScoreEntry", "fields", "scoreEntryFieldsJsonSchema"),
  compat("server", "Post", "extra", "genericMetadataJsonSchema"),
  compat(
    "server",
    "HistoryOutbox",
    "payload",
    "historyOutboxPayloadJsonSchema",
  ),
  compat("server", "Game", "extra", "genericMetadataJsonSchema"),
  compat(
    "server",
    "GameSystemRequirement",
    "hardware",
    "gameSystemRequirementHardwareJsonSchema",
  ),
  compat("server", "Media", "extra", "genericMetadataJsonSchema"),
  compat(
    "server",
    "AccountEnforcement",
    "metadata",
    "genericMetadataJsonSchema",
  ),
  compat("server", "ModerationCase", "metadata", "genericMetadataJsonSchema"),
  compat("server", "StaffAuditLog", "metadata", "genericMetadataJsonSchema"),
  compat("server", "Link", "extra", "genericMetadataJsonSchema"),
  compat("server", "Book", "extra", "bookExtraJsonSchema"),
  compat(
    "server",
    "PolicyTagApplication",
    "metadata",
    "genericMetadataJsonSchema",
  ),
] satisfies JsonColumnRegistryEntry[];

function compat(
  database: JsonColumnRegistryEntry["database"],
  table: string,
  column: string,
  symbol: string,
): JsonColumnRegistryEntry {
  return {
    database,
    table,
    column,
    category: "compat",
    contractSchema: {
      symbol,
      path: "package/contract/src/json-column.ts",
    },
  };
}

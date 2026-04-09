# @rezics/search

Full-text search infrastructure for the Rezics platform using [Meilisearch](https://www.meilisearch.com). Provides a search client and data synchronization utilities.

## Overview

This package wraps the Meilisearch client with platform-specific configuration and provides sync functions to keep search indices up to date with the primary database.

## Exports

```typescript
import { SearchClient, type MeiliConfig } from '@rezics/search';
import { syncAllBooks, syncAllUsers } from '@rezics/search';
```

### Client

- **`SearchClient`** — Configured Meilisearch client with `MeiliConfig`

### Sync Functions

| Function             | Description                        |
| -------------------- | ---------------------------------- |
| `syncAllBooks`       | Sync book data to search index     |
| `syncAllFeedbacks`   | Sync feedback to search index      |
| `syncAllReadlists`   | Sync readlists to search index     |
| `syncAllUnits`       | Sync units to search index         |
| `syncAllUsers`       | Sync user data to search index     |

### Types

- `SearchResponse` — Re-exported from the Meilisearch client

## Configuration

Meilisearch server settings are in `./bin/config.toml`.

## Scripts

```bash
bun run meilisearch       # Start Meilisearch server
bun run meilisearch:wsl   # Start Meilisearch (WSL, binds to 0.0.0.0:7700)
```

## Tech Stack

- [Meilisearch](https://www.meilisearch.com) for full-text search
- Data from `@rezics/server` (Prisma)
- Types from `@rezics/contract`

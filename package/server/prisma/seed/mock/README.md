# Seed Module Documentation

This document explains the modular structure of the database seeding system.

## Overview

The seeding system has been refactored from a monolithic file into well-organized, maintainable modules. Each module has a single responsibility and clear interfaces.

## Module Structure

```
prisma/
├── seed.ts              # Main orchestration file
└── seed/
    ├── types.ts         # TypeScript type definitions
    ├── config.ts        # Configuration and environment variables
    ├── utils.ts         # General utility functions
    ├── generators.ts    # Data generation functions
    ├── database.ts      # Database reset operations
    ├── users.ts         # User seeding
    ├── tags.ts          # Tag seeding
    ├── books.ts         # Book seeding
    ├── units.ts         # Other unit types seeding
    ├── comments.ts      # Comment seeding and stats updates
    └── data.ts          # Static data (book covers, etc.)
```

## Module Details

### `seed.ts`

**Purpose**: Main entry point that orchestrates the entire seeding process.

**Key Functions**:

- `main()`: Coordinates all seeding operations in the correct order

**Process Flow**:

1. Reset database
2. Seed users
3. Seed tags
4. Seed books
5. Seed other units (reviews, quotes, notes, etc.)
6. Seed comments
7. Update stats with comment counts

---

### `types.ts`

**Purpose**: Central type definitions used across all seed modules.

**Exports**:

- `CreatedUser`: User data structure after creation
- `CreatedUnit`: Unit data structure after creation
- `SeedCounts`: Configuration interface for seed counts

---

### `config.ts`

**Purpose**: Configuration management and environment variable parsing.

**Exports**:

- `envInt()`: Parse integer from environment variables with fallback
- `DEFAULT_COUNTS`: Default seed counts from environment or defaults

**Environment Variables**:

- `SEED_USERS` (default: 20)
- `SEED_TAGS` (default: 40)
- `SEED_BOOKS` (default: 50)
- `SEED_OTHER_POSTS` (default: 150)
- `SEED_COMMENTS` (default: 600)

---

### `utils.ts`

**Purpose**: General-purpose utility functions for random data generation.

**Exports**:

- `randomInt()`: Generate random integer within range
- `randomFloat()`: Generate random float within range
- `randomBoolean()`: Generate boolean with configurable probability
- `pickN()`: Pick N random items from array
- `createUsernameGenerator()`: Factory for unique username generator
- `generateTitle()`: Generate title-cased title
- `generateParagraph()`: Generate paragraph with random sentences

---

### `generators.ts`

**Purpose**: Domain-specific data generation functions.

**Exports**:

- `generateBookExtra()`: Generate book metadata (publisher, year, etc.)
- `generateChapters()`: Generate chapter index JSON
- `buildUnitTitleByType()`: Generate appropriate title based on unit type
- `buildMetadataByType()`: Generate appropriate metadata based on unit type

---

### `database.ts`

**Purpose**: Database cleanup and reset operations.

**Exports**:

- `resetDatabase()`: Delete all data in correct order respecting foreign keys

**Delete Order** (important for foreign key constraints):

1. CommentIndex
2. UnitReactions
3. UnitStats
4. Book
5. Tag
6. Unit
7. User

---

### `users.ts`

**Purpose**: User account seeding.

**Exports**:

- `seedUsers()`: Create user accounts with profiles

**Generated Data**:

- Email (unique)
- Password hash
- Slug (unique, URL-friendly)
- Name
- Avatar URL
- Bio
- Join date

---

### `tags.ts`

**Purpose**: Tag creation for categorizing content.

**Exports**:

- `seedTags()`: Create tags with associated units

**Tag Types**:

- `general`: General purpose tags
- `genre`: Genre classifications
- `author`: Author-related tags
- `system`: System-generated tags

---

### `books.ts`

**Purpose**: Book content seeding.

**Exports**:

- `seedBooks()`: Create book units with full metadata

**Generated Data**:

- Unit (title, content, status, publishing date)
- Book details (authors, cover, ISBN, chapters, description)
- UnitStats (initialized)
- UnitReactions (likes, dislikes, loves)

---

### `units.ts`

**Purpose**: Seeding for non-book, non-comment unit types.

**Exports**:

- `seedOtherUnits()`: Create various unit types

**Unit Types Generated**:

- `NOTE`: User notes
- `REVIEW`: Book reviews with ratings
- `QUOTE`: Book quotes with chapter references
- `READLIST`: Reading lists
- `IMAGE`: Image posts
- `VIDEO`: Video posts
- `CHAPTER`: Book chapters

---

### `comments.ts`

**Purpose**: Comment thread generation and statistics updates.

**Exports**:

- `seedComments()`: Create comment threads with parent-child relationships
- `updateStatsWithCommentCounts()`: Update unit stats with comment counts

**Features**:

- Nested comment threads (max depth configurable)
- Parent-child relationships
- Root unit association
- Automatic comment count updates

---

### `data.ts`

**Purpose**: Static data and fixtures.

**Exports**:

- `getRandomBookCover()`: Get random book cover URL from curated list

---

## Usage

### Basic Usage

```bash
# Run with default counts
npm run seed

# Or with custom counts via environment variables
SEED_USERS=50 SEED_BOOKS=100 npm run seed
```

### Programmatic Usage

```typescript
import {PrismaClient} from './generated/client.js';
import {seedUsers} from './seed/users.js';
import {seedBooks} from './seed/books.js';

const prisma = new PrismaClient();

// Seed specific entities
const users = await seedUsers(prisma, 10);
const books = await seedBooks(prisma, 20, users, []);
```

## Design Principles

1. **Single Responsibility**: Each module handles one entity type
2. **Dependency Injection**: PrismaClient passed to functions, not globally imported
3. **Type Safety**: Strong typing throughout with shared type definitions
4. **Testability**: Pure functions that can be easily tested
5. **Modularity**: Easy to add new entity types or modify existing ones
6. **Clear Dependencies**: Explicit function parameters show data flow
7. **Idiomatic TypeScript**: Follows TypeScript best practices
8. **Proper Error Handling**: Errors bubble up to main function

## Adding New Entity Types

To add a new entity type:

1. Create a new file in `seed/` (e.g., `seed/authors.ts`)
2. Define the seeding function following the pattern:
   ```typescript
   export async function seedAuthors(
     prisma: PrismaClient,
     total: number,
     dependencies: DependencyType[],
   ): Promise<CreatedAuthor[]>;
   ```
3. Import and call in `seed.ts` main function
4. Add configuration to `config.ts` if needed
5. Update this README documentation

## Performance Considerations

- Database operations are sequential to ensure data integrity
- Batch operations could be added for better performance
- Consider using transactions for complex operations
- Comment generation is the most time-consuming operation

## Future Improvements

- [ ] Add batch insert operations for better performance
- [ ] Add transaction support for rollback on error
- [ ] Add progress bars for long-running operations
- [ ] Add validation for generated data
- [ ] Add support for incremental seeding (append vs reset)
- [ ] Add data export/import functionality

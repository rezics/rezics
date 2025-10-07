# Book Service Architecture

## Overview

This document describes the complete refactoring of the Book service, following best practices for both backend and frontend development.

## Backend Architecture

### File Structure

```
package/server/books/
├── encore.service.ts    # Encore service definition
├── api.ts               # API endpoints (thin controller layer)
├── service.ts           # Business logic layer
├── mapper.ts            # Data transformation utilities
├── types.ts             # Type definitions
└── validation.ts        # Input validation
```

### Separation of Concerns

#### 1. **api.ts** - API Endpoints (Controller Layer)
- Defines HTTP endpoints using Encore.ts
- Handles request/response mapping
- Delegates business logic to service layer
- Minimal logic, focuses on HTTP concerns

#### 2. **service.ts** - Business Logic Layer
- `BookService` class encapsulating all business logic
- Database operations via Prisma
- Complex query building
- Business rules enforcement
- Exported as singleton: `bookService`

**Key Methods:**
- `list()` - Filter and paginate books
- `getByPostId()` - Get single book
- `getByIsbn()` - ISBN lookup
- `create()` - Create new book
- `update()` - Update existing book
- `delete()` - Remove book
- `exists()` - Check existence
- `getByUserId()` - User's books
- `getByAuthorId()` - Author's books

#### 3. **mapper.ts** - Data Transformation
- `sanitizeUser()` - Remove sensitive user data
- `mapBookToDTO()` - Convert database model to API response

#### 4. **types.ts** - Type Definitions
- Internal types and interfaces
- Type guards
- Prisma include configurations
- Request/response types

#### 5. **validation.ts** - Input Validation
- `validateCreateBook()` - Validate creation requests
- `validateUpdateBook()` - Validate update requests
- Custom `ValidationError` class
- Business rule validation (ISBN format, string lengths, etc.)

### Benefits

✅ **Separation of Concerns**: Each file has a single, clear responsibility
✅ **Testability**: Business logic isolated from HTTP layer
✅ **Reusability**: Service methods can be called from multiple endpoints
✅ **Maintainability**: Easy to locate and modify specific functionality
✅ **Type Safety**: Comprehensive TypeScript types throughout

## Frontend Architecture

### File Structure

```
package/app/src/api/
├── Book.ts              # Main entry point (re-exports)
├── Book.types.ts        # TypeScript types
├── Book.keys.ts         # React Query key factory
├── Book.api.ts          # API client functions
├── Book.queries.ts      # Query configurations
└── Book.mutations.ts    # Mutation hooks
```

### Layer Breakdown

#### 1. **Book.types.ts** - Type Definitions
- Re-exports contract types
- Frontend-specific types
- Form data types
- Filter and view types

#### 2. **Book.keys.ts** - Query Key Management
- Centralized query key factory
- Hierarchical key structure
- Follows TanStack Query best practices
- Enables precise cache invalidation

**Key Structure:**
```typescript
books                           // All book queries
├── list                        // List queries
│   └── {filters}               // Specific filter combination
├── detail                      // Detail queries
│   └── {postId}                // Specific book
├── search                      // Search queries
│   └── {q, filters}            // Search with filters
├── user / {userId}             // User's books
├── author / {authorId}         // Author's books
└── isbn / {isbn}               // ISBN lookup
```

#### 3. **Book.api.ts** - API Client Layer
- Pure HTTP communication
- Generic `apiFetch` wrapper with error handling
- Query string building
- All CRUD operations
- No React dependencies

**Methods:**
- `list()` - Get books with filters
- `get()` - Single book by postId
- `search()` - Search books
- `getByUserId()` - User's books
- `getByAuthorId()` - Author's books
- `getByIsbn()` - ISBN lookup
- `create()` - Create book
- `update()` - Update book
- `remove()` - Delete book

#### 4. **Book.queries.ts** - Query Configurations
- `queryOptions` for standard queries
- `infiniteQueryOptions` for pagination
- Stale time configurations
- Conditional enabling
- Automatic cache management

**Query Options:**
- `bookListQuery` - Basic list
- `bookDetailQuery` - Single book
- `bookSearchQuery` - Search
- `booksByUserQuery` - By user
- `booksByAuthorQuery` - By author
- `bookByIsbnQuery` - By ISBN
- `bookInfiniteListQuery` - Infinite scroll

#### 5. **Book.mutations.ts** - Mutation Hooks
- Custom React hooks for mutations
- Automatic cache invalidation
- Optimistic updates support
- Error handling

**Hooks:**
- `useCreateBookMutation` - Create book
- `useUpdateBookMutation` - Update book
- `useDeleteBookMutation` - Delete book

#### 6. **Book.ts** - Main Entry Point
- Unified exports
- Clean public API
- Documentation

### Usage Examples

#### Fetching Books

```typescript
import {useQuery} from '@tanstack/react-query';
import {bookQueries} from '@/api/Book';

function BookList() {
  const {data, isLoading} = useQuery(bookQueries.list({
    page: 1,
    limit: 20,
    tags: 'fiction,scifi'
  }));
  
  return <div>{/* render books */}</div>;
}
```

#### Getting Single Book

```typescript
import {useQuery} from '@tanstack/react-query';
import {bookQueries} from '@/api/Book';

function BookDetail({postId}: {postId: string}) {
  const {data: book} = useQuery(bookQueries.detail(postId));
  
  return <div>{book?.title}</div>;
}
```

#### Creating a Book

```typescript
import {useCreateBookMutation} from '@/api/Book';

function CreateBookForm() {
  const createBook = useCreateBookMutation({
    onSuccess: (book) => {
      console.log('Book created:', book.postId);
    },
  });

  const handleSubmit = (data: CreateBookInput) => {
    createBook.mutate(data);
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

#### Infinite Scroll

```typescript
import {useInfiniteQuery} from '@tanstack/react-query';
import {bookQueries} from '@/api/Book';

function InfiniteBookList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery(bookQueries.infiniteList({limit: 20}));

  return (
    <div>
      {data?.pages.map(page => 
        page.books.map(book => <BookCard key={book.postId} book={book} />)
      )}
      {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
    </div>
  );
}
```

### Benefits

✅ **Clear Separation**: API, queries, and mutations are separate
✅ **Type Safety**: Full TypeScript support
✅ **Reusability**: Query options can be used with `useQuery`, `useSuspenseQuery`, etc.
✅ **Cache Management**: Automatic invalidation and updates
✅ **Testability**: Each layer can be tested independently
✅ **Developer Experience**: IntelliSense and autocomplete throughout
✅ **Scalability**: Easy to add new queries and mutations

## Contract Layer

The `contract` package defines shared types between frontend and backend:

```typescript
// contract/src/book.ts
export type BookDTO = {
  postId: string;
  title: string;
  authors?: PublicUser[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string;
  extra?: Record<string, unknown> | null;
  userId?: string;
  user?: PublicUser;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CreateBookInput = {
  userId: string;
  title: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
};

export type UpdateBookInput = {
  title?: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
};

export type BookListResponse = {
  books: BookDTO[];
  total?: number;
};

export type BookResponse = BookDTO;

export type BookSearchParams = {
  q?: string;
  tag?: string;
  tags?: string;
  authorId?: string;
  authorIds?: string;
  userId?: string;
  isbn?: string;
  page?: number;
  limit?: number;
};
```

## Best Practices Implemented

### 1. Single Responsibility Principle
Each file/module has one clear purpose.

### 2. Dependency Inversion
API layer depends on service layer through interfaces.

### 3. DRY (Don't Repeat Yourself)
Common logic centralized in utilities and services.

### 4. Type Safety
Comprehensive TypeScript types throughout the stack.

### 5. Error Handling
Consistent error handling with custom error classes.

### 6. Validation
Input validation at multiple levels.

### 7. Caching Strategy
Smart caching with React Query and appropriate stale times.

### 8. Documentation
Comprehensive JSDoc comments throughout.

## Migration Guide

### Backend Migration

Old code:
```typescript
// Everything in api.ts
const books = await prisma.book.findMany({...});
```

New code:
```typescript
// api.ts
const {books, total} = await bookService.list(params);
```

### Frontend Migration

Old code:
```typescript
import {bookApi, bookKeys} from './Book';

const {data} = useQuery({
  queryKey: bookKeys.list(offset, limit),
  queryFn: () => bookApi.list({offset, limit}),
});
```

New code:
```typescript
import {useQuery} from '@tanstack/react-query';
import {bookQueries} from './Book';

const {data} = useQuery(bookQueries.list({page: 1, limit: 20}));
```

## Testing Strategy

### Backend Tests
- Unit tests for `service.ts` methods
- Integration tests for API endpoints
- Validation tests for `validation.ts`

### Frontend Tests
- Unit tests for API client functions
- Integration tests for query/mutation hooks
- Mock Service Worker for API mocking

## Future Enhancements

- [ ] Add caching layer (Redis) for frequently accessed books
- [ ] Implement full-text search with Elasticsearch
- [ ] Add rate limiting
- [ ] Implement pagination cursor-based instead of offset
- [ ] Add book cover upload functionality
- [ ] Implement book recommendations
- [ ] Add bulk operations support
- [ ] WebSocket support for real-time updates

## Conclusion

This refactoring provides a solid, scalable foundation for the Book service, following industry best practices and modern development patterns. The clear separation of concerns makes the codebase maintainable, testable, and easy to extend.

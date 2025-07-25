# Server

This is the server implementation for the book platform, built with Fastify and EdgeDB.

## Features

- **Authentication**: JWT-based authentication with login, register, and refresh endpoints
- **Book Management**: CRUD operations for books with search functionality
- **Tag System**: Comprehensive tag management with relationships to books and threads
- **Chapter Management**: Chapter listing and retrieval for books
- **Homepage**: Dynamic homepage with statistics and featured content
- **Database Integration**: EdgeDB integration with type-safe queries
- **CORS Support**: Cross-origin request support for web clients
- **TypeScript**: Full TypeScript support with type-safe contracts

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token

### Books
- `GET /book/:bookId` - Get book details
- `PUT /book/:id` - Update book
- `GET /book/list` - List books with pagination and search

### Tags
- `GET /tag` - List tags
- `GET /tag/:tagId` - Get tag details
- `POST /tag` - Create tag
- `POST /taggroup` - Create tag group
- `PUT /tag/:tagId` - Update tag
- `PUT /taggroup/:tagGroupId` - Update tag group
- `DELETE /tag/:tagId` - Delete tag
- `DELETE /taggroup/:tagGroupId` - Delete tag group

### Tag Relationships
- `GET /book/:bookId/tag` - Get tags for a book
- `GET /thread/:threadId/tag` - Get tags for a thread
- `DELETE /tag/:tagId/book/:bookId` - Remove tag from book
- `DELETE /tag/:tagId/thread/:threadId` - Remove tag from thread

### Chapters
- `GET /book/:bookId/chapters` - List chapters for a book
- `GET /book/:bookId/chapter/:chapterId` - Get chapter details

### Homepage
- `GET /home` - Get homepage content with stats and featured items

## Setup

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Update environment variables in `.env` with your actual values.

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

## Environment Variables

- `HOST` - Server host (default: localhost)
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret for JWT access tokens
- `JWT_REFRESH_SECRET` - Secret for JWT refresh tokens
- `DATABASE_URL` - EdgeDB connection URL
- `CORS_ORIGIN` - Allowed CORS origin
- `NODE_ENV` - Environment (development/production)

## Database

This server uses EdgeDB with the schema defined in the `database` package. Make sure EdgeDB is running and the database is properly migrated before starting the server.

## Type Safety

The server is built with full type safety using:
- TypeScript for all code
- Zod schemas for request/response validation
- ts-rest for type-safe API contracts
- EdgeDB generated types for database queries

## Authentication

The server uses JWT-based authentication:
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Passwords are hashed using bcrypt
- Tokens are required for protected endpoints

## Development

Run in development mode with hot reloading:
```bash
pnpm dev
```

Build for production:
```bash
pnpm build
```

Start production server:
```bash
pnpm start
```
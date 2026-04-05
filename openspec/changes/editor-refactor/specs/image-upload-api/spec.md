## ADDED Requirements

### Requirement: Image upload endpoint

The `@rezics/server` SHALL expose `POST /api/upload/image` that accepts a multipart/form-data request with a single image file and stores it in Cloudflare R2.

#### Scenario: Successful upload
- **WHEN** an authenticated user sends a POST request with a valid image file
- **THEN** the server SHALL store the file in R2 with key `images/{year}/{month}/{ulid}.{ext}`
- **AND** return HTTP 200 with `{ "url": "<R2_PUBLIC_URL>/images/..." }`

#### Scenario: Unauthenticated request
- **WHEN** a request is sent without a valid session JWT
- **THEN** the server SHALL return HTTP 401

#### Scenario: File too large
- **WHEN** the uploaded file exceeds 5MB
- **THEN** the server SHALL return HTTP 413 with an error message indicating the size limit

#### Scenario: Invalid MIME type
- **WHEN** the uploaded file has a MIME type other than `image/jpeg`, `image/png`, `image/webp`, or `image/gif`
- **THEN** the server SHALL return HTTP 415 with an error message listing accepted types

#### Scenario: Missing file
- **WHEN** the request body does not contain an `image` field
- **THEN** the server SHALL return HTTP 400

### Requirement: R2 environment configuration

The upload service SHALL read R2 configuration from environment variables validated at startup.

#### Scenario: All R2 env vars present
- **WHEN** `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_URL` are set
- **THEN** the upload service SHALL initialize successfully

#### Scenario: R2 env vars missing
- **WHEN** any required R2 environment variable is missing
- **THEN** the upload endpoint SHALL be registered but return HTTP 503 with a "storage not configured" message
- **AND** the server SHALL NOT crash on startup

### Requirement: Upload contract types

The `@rezics/contract` package SHALL export the image upload response schema.

#### Scenario: Response type export
- **WHEN** a consumer imports from `@rezics/contract`
- **THEN** the `ImageUploadResponse` Typebox schema SHALL be available
- **AND** it SHALL define `{ url: string }`

### Requirement: Upload mutation hook

The `@rezics/api` package SHALL export a `useImageUpload` TanStack Query mutation hook.

#### Scenario: Mutation usage
- **WHEN** a consumer calls `const mutation = useImageUpload()` and then `mutation.mutate(file)`
- **THEN** the hook SHALL POST the file as multipart/form-data to `/api/upload/image`
- **AND** return `{ url: string }` on success

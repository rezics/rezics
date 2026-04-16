## 1. Backend: Global Prisma error handling

- [x] 1.1 Add `PrismaClientKnownRequestError` branch to the global `onError` handler in `package/server/src/index.ts`, mapping P2025→404, P2002→409, P2003→400, P2014→400, and defaulting unmapped codes to 500
- [x] 1.2 Build the `detail.prisma` object from the error metadata (code, model name, operation) with defensive optional chaining; sanitize `message` to a human-readable string instead of raw Prisma output
- [x] 1.3 Remove manual P2025 catch blocks in `package/server/src/jwt/jwt.admin.api.ts` (3 occurrences around lines 118-128, 153-163, 187-197)
- [x] 1.4 Verify backend builds cleanly (`bun run build` in `package/server`)

## 2. Frontend: ApiError class and retry logic

- [x] 2.1 Create `ApiError` class in `package/api/src/react-query/errors.ts` with fields: `status`, `code`, `message`, `detail?`
- [x] 2.2 Update `apiFetchResponse` in `package/api/src/react-query/http.ts` to throw `ApiError` instead of `new Error(JSON.stringify(...))`
- [x] 2.3 Export `ApiError` from `package/api/src/index.ts`
- [x] 2.4 Simplify retry logic in `package/api/src/react-query/tsr.ts` to use `error instanceof ApiError` and `error.status` directly, removing `JSON.parse` workaround
- [x] 2.5 Verify `package/api` builds and exports are correct

## 3. Frontend: QueryErrorDisplay component

- [x] 3.1 Create `<QueryErrorDisplay>` component in `package/app/src/core/component/QueryErrorDisplay.tsx` using MUI `Alert` with collapsible technical details section
- [x] 3.2 Handle all variants: ApiError with detail, ApiError without detail, plain Error, and null error

## 4. Frontend: Migrate ad-hoc error rendering

- [x] 4.1 Replace error rendering in `package/app/src/book-library/` pages and components: `BookDetailLayout.tsx`, `BookLibSection.tsx`, `RemarkPreview.tsx`, `ShelfByBookPreview.tsx`, `QuoteExcerptPreview.tsx`, `ChapterList.tsx`
- [x] 4.2 Replace error rendering in `package/app/src/review/` pages: `ReviewPage.tsx`, `ReviewEditPage.tsx`
- [x] 4.3 Replace error rendering in `package/app/src/user/` pages: `UserListPage.tsx` (N/A - doesn't exist), `FollowInfoPage.tsx`, `UserEditPage.tsx`
- [x] 4.4 Replace error rendering in `package/app/src/unit/UnitPage.tsx`, `package/app/src/tag/` pages (N/A - don't exist), `package/app/src/quote/QuoteEditPage.tsx`
- [x] 4.5 Replace error rendering in `package/app/src/home/` sections: `TrendingReviewsSection.tsx`
- [x] 4.6 Replace error rendering in `package/app/src/book-edit/section/BookEditInfoSection.tsx`
- [x] 4.7 Verify no remaining ad-hoc patterns: grep for `String(error)`, `error.message` in JSX, `JSON.stringify(error` across `package/app/src` (remaining occurrences are all in mutation callbacks, out of scope)
- [x] 4.8 Verify frontend builds cleanly (`bun run app:dev` starts without errors)

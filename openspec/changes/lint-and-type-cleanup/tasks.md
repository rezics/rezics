## 1. Auto-fix and Config Setup

- [x] 1.1 Run `bunx biome check --write .` to auto-fix organizeImports in `package/admin/src/routeTree.gen.ts` and `package/app/src/routeTree.gen.ts`
- [x] 1.2 Add `"jsx": "react-jsx"` to `package/preview/tsconfig.json` compilerOptions
- [x] 1.3 Add `"DOM.Iterable"` to `lib` array in `package/editor/tsconfig.json`, `package/folio/tsconfig.json`, `package/ui/tsconfig.json`
- [x] 1.4 Add `"DOM.Iterable"` to `lib` or base config for packages needing `Headers.entries` (`package/api`, `package/app-shell`)
- [x] 1.5 Add `react-i18next` as devDependency in `package/ui` (`bun add -D react-i18next`)
- [x] 1.6 Verify `zustand` is available in `package/admin` (add as devDep if missing)

## 2. Biome Lint — Small Packages (contract, jwt, server, preview)

- [x] 2.1 `package/contract/src/book.ts:170` — change `Publisher = {}` to `Publisher = Record<string, unknown>`
- [x] 2.2 `package/jwt/src/adapters/jose-verifier.ts:129,151` — add type annotations to `let header` and `let result`
- [x] 2.3 `package/server/src/meili/feedback/feedback.api.ts:37` — rename `escape` function to `escapeValue`
- [x] 2.4 `package/server/src/review/mapper.ts:109` — fix `.forEach` implicit return (wrap body in braces)
- [x] 2.5 `package/server/src/session/session.api.ts:39` — add type annotation to `let sessionState`
- [x] 2.6 `package/server/src/token/token.book.api.ts:165` — remove unreachable code after early return

## 3. Biome Lint — Folio Package (~25 errors)

- [x] 3.1 Add `type="button"` to all `<button>` elements in `Folio.tsx`, `FolioEdgeStates.fixture.tsx`, `FolioThemes.fixture.tsx`, `TxtSettings.tsx`, `TocPanel.tsx`
- [x] 3.2 Fix `noStaticElementInteractions` + `useKeyWithClickEvents` in `EpubControls.tsx:17` and `TocPanel.tsx:114,140` — add `role="button"`, `tabIndex={0}`, `onKeyDown` handler
- [x] 3.3 Fix `noAssignInExpressions` in `TxtSettings.tsx:57` and `split.ts:33` — extract assignment from expression
- [x] 3.4 Suppress `noDangerouslySetInnerHtml` in `epub/index.tsx:117` and `TxtRenderer.tsx:24` with biome-ignore comment
- [x] 3.5 Suppress `noArrayIndexKey` in `PanelSlot.tsx:27`, `EpubControls.tsx:18`, `TxtSettings.tsx:118,204` with biome-ignore comments (static lists)

## 4. Biome Lint — Editor Package (~5 errors)

- [x] 4.1 Fix `useFocusableInteractive` + `useSemanticElements` + `useAriaPropsForRole` in `toolbar/react/index.tsx:83` — add `tabIndex={0}`, `aria-label`, consider semantic element
- [x] 4.2 Fix `useFocusableInteractive` + `useSemanticElements` in `ResizableWrapper.tsx:96,98`
- [x] 4.3 Suppress `noArrayIndexKey` in `toolbar/react/index.tsx:99` with biome-ignore comment

## 5. Biome Lint — UI Package (~15 errors)

- [x] 5.1 Add `type="button"` in `CustomSidebar.tsx:25`, `CollapsibleByLineText.tsx:44,65`
- [x] 5.2 Fix `useFocusableInteractive` in `breadcrumb.tsx:64` — add `tabIndex={0}`
- [x] 5.3 Fix `useSemanticElements` in `breadcrumb.tsx:66` — consider using `<a>` element
- [x] 5.4 Suppress `useSemanticElements` in `carousel.tsx:144,187` with biome-ignore (shadcn pattern)
- [x] 5.5 Suppress `noDangerouslySetInnerHtml` in `chart.tsx:81` and `MarkdownContent.tsx:7`
- [x] 5.6 Fix `useValidAnchor` in `app-sidebar.tsx:163` — replace `href="#"`
- [x] 5.7 Add `type="button"` or suppress `noImplicitAnyLet` in `RatingField.tsx:20`
- [x] 5.8 Suppress `noArrayIndexKey` in `ExternalImageGuide.tsx:57`, `CarouselIndicator.tsx:77`
- [x] 5.9 Add biome-ignore to `noBannedTypes` in `mock/routeTree.gen.ts:13,14,26` (generated file)

## 6. Biome Lint — App Package (~40 errors)

- [x] 6.1 Fix `useHookAtTopLevel` in `BookEditLayout.tsx:18` — restructure to call hook unconditionally
- [x] 6.2 Fix `useHookAtTopLevel` in `ReviewNewPage.tsx:20` — restructure conditional hook call
- [x] 6.3 Fix `useHookAtTopLevel` + `noImplicitAnyLet` in `UserPage.tsx:18,20` — restructure and add type
- [x] 6.4 Fix `useExhaustiveDependencies` in `useCurrentBreakpoint.ts:36` — add missing deps
- [x] 6.5 Add `type="button"` in `DialogReply.test.tsx:14`, `sidebar.tsx:71`
- [x] 6.6 Fix `useKeyWithClickEvents` in `ChapterArboristContextMenu.tsx:32,61,69,80,101,113` — add onKeyDown handlers
- [x] 6.7 Fix `noStaticElementInteractions` in `ChapterArborist.tsx:237`, `ChapterArboristNode.tsx:35`, `TextSearchInput.tsx:52` — add role attribute
- [x] 6.8 Fix `noStaticElementInteractions` + `useKeyWithClickEvents` in `SingleReadlistCard.tsx:108` and `SingleCommentElementWrapper.tsx:43`
- [x] 6.9 Fix `useSemanticElements` in `SingleCommentElementWrapper.tsx:43`, `TagCards.tsx:21`
- [x] 6.10 Fix `noImplicitAnyLet` in `ChapterArborist.tsx:180`
- [x] 6.11 Fix `noShadowRestrictedNames` in `uiStore.ts:1`, `ThemeDemo.tsx:4`, `arborist-tree.ts:1`
- [x] 6.12 Fix `noAssignInExpressions` in `ReplyDrawer.tsx:13`, `searchParser.ts:11`
- [x] 6.13 Fix `noSuspiciousSemicolonInJsx` in `QuoteEditPage.tsx:118` — remove stray semicolon
- [x] 6.14 Suppress `noDangerouslySetInnerHtml` in `BookReadChapterSection.tsx:29`
- [x] 6.15 Suppress `noArrayIndexKey` in `BookExtraEditor.tsx:67`, `NavigationList.tsx:40`, `HomeCarousel.tsx:145`, `HomePartnerBrands.tsx:32`, `HomePromotionStrip.tsx:27`, `ThemeDemo.tsx:176`, `HorizontalReadListCarousel.tsx:50,55`, `HorizontalReviewCarousel.tsx:54`
- [x] 6.16 Fix `useIterableCallbackReturn` in `TagTest.test.tsx:199,200`, `BookmarkPage.tsx:178,181`

## 7. Biome Lint — API and App-Shell Packages (~5 errors)

- [x] 7.1 Fix `useIterableCallbackReturn` in `reaction.api.ts:78`, `user.api.ts:116,124`
- [x] 7.2 Fix `useIterableCallbackReturn` in `AuthProvider.test.tsx:24,58`

## 8. TypeScript Errors — API Package (8 errors)

- [x] 8.1 Fix argument count in `auth-jwt-service.mutations.ts` — add missing 4th argument (4 call sites)
- [x] 8.2 Fix argument count in `jwt-service.mutations.ts` — add missing 4th argument (4 call sites)

## 9. TypeScript Errors — App Package (~25 errors)

- [x] 9.1 Remove unused `@ts-expect-error` directives in `MainLayoutSidebar.tsx:47`, `QuotePage.tsx:28`, `Review.tsx:61,66`, `ReadListPage.tsx:27`, `ReviewPage.tsx:53`
- [x] 9.2 Fix `mock/handler/post.ts` — add `Post` type or fix import
- [x] 9.3 Fix `mock/handler/chapter.ts:3` — fix JSON import path
- [x] 9.4 Fix `preferences/component/ThemeCustomizer.tsx` — fix missing module and undefined `appStore` references
- [x] 9.5 Fix `SingleQuoteExcerpt.test.tsx` — add missing `unitId` prop (3 locations)
- [x] 9.6 Fix `SingleReview.test.tsx` — remove or fix `id` property
- [x] 9.7 Fix `UserListPage.tsx:120,122` — use correct property instead of `id`
- [x] 9.8 Fix `shared/util/comment.ts:1` — fix module import path
- [x] 9.9 Fix `scroll-util.ts:32` — add explicit return type annotation
- [x] 9.10 Fix `user/component/Small.test.tsx` — fix component usage
- [x] 9.11 Fix `UserEditPage2.tsx` — fix missing module imports or mark as dead code
- [x] 9.12 Fix `ChapterArboristNode.tsx:53` — fix type mismatch with NodeApi

## 10. TypeScript Errors — Editor Package (5 errors after config fix)

- [x] 10.1 Fix `MarkdownEditor.test.ts:9` — remove `preview` from config object
- [x] 10.2 Fix `commands.test.ts:76,84,91,99` — fix void-to-boolean type mismatches in test assertions

## 11. TypeScript Errors — UI Package (~15 errors after config fix)

- [x] 11.1 Fix `EditorMention.tsx:100` — fix ref type incompatibility
- [x] 11.2 Fix `EditorMention.tsx:365` — add null check for `trigger`
- [x] 11.3 Fix `toggle-group.tsx:19,40` — add missing `type` and `value` props
- [x] 11.4 Fix `ArrowForwardIcon.test.tsx:2` — fix export name
- [x] 11.5 Fix `TrustedEmailField.test.tsx:15,34` — add null checks
- [x] 11.6 Fix implicit `any` params in `data-table.tsx:149,158,470,553`, `chart-area-interactive.tsx:258`, `nav-secondary.tsx:26`, `sidebar.tsx:282`
- [x] 11.7 Fix `data-table.tsx:23` — add `@sinclair/typebox` as devDep or fix import

## 12. TypeScript Errors — Admin, Search, Folio Packages

- [x] 12.1 Fix `admin/src/user/page/UserCreatePage.tsx:31` — fix `useAdminCreate` method name
- [x] 12.2 Fix implicit `any` params in `admin/src/app/state/routeStore.ts` (after zustand dep fix)
- [x] 12.3 Fix `search/cdc/src/main.ts` — add `postgres` types or type annotations

## 13. Verification

- [x] 13.1 Run `bunx biome check . --max-diagnostics=9999` — confirm 0 errors
- [x] 13.2 Run `tsc --noEmit` for each package — confirm 0 errors
- [x] 13.3 Run `bun run app:dev` — confirm frontend starts without errors

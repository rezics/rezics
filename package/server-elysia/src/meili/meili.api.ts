import {t} from 'elysia';
import {coreInstance} from '../core';
import {
  bookQueryOptionsSchema,
  type BookQueryOptions,
  unitListQuerySchema,
  type UnitListQuery,
  readlistListQuerySchema,
  type ReadlistListQuery,
} from '@package/contract';
import {meiliService} from './meili.service';
import {verifyAuth} from '@/src/utils/authUtils';
import {deleteAllUnits} from '@package/search/src/documents';
import {checkMeiliHealth} from '@package/search/src/client';

/**
 * Meili API - Elysia routes for search and key management.
 *
 * Routes are mounted under `/meili`.
 */
export const meiliApi = coreInstance('/meili')
  /**
   * Health check for Meilisearch via backend.
   */
  .get(
    '/health',
    async () => {
      // Lazy import to avoid creating the client eagerly if not needed.
      const ok = await checkMeiliHealth();
      return {status: ok ? 'available' : 'unavailable'};
    },
    {
      detail: {
        summary: 'Meilisearch health check',
        tags: ['Meili'],
      },
    },
  )

  /**
   * Search books using Meilisearch.
   *
   * GET /meili/books/search
   */
  .post(
    '/books/search',
    async ({body}) => {
      const options = body as BookQueryOptions;
      return meiliService.searchBooks(options);
    },
    {
      body: bookQueryOptionsSchema,
      detail: {
        summary: 'Search books (Meilisearch)',
        description:
          'Full-text search over books using Meilisearch, driven by contract-based BookQueryOptions.',
        tags: ['Meili', 'Books', 'Search'],
      },
    },
  )

  /**
   * Search readlists using Meilisearch.
   *
   * POST /meili/readlists/search
   */
  .post(
    '/readlists/search',
    async ({body}) => {
      const options = body as ReadlistListQuery;
      return meiliService.searchReadlists(options);
    },
    {
      body: readlistListQuerySchema,
      detail: {
        summary: 'Search readlists (Meilisearch)',
        description:
          'Full-text search over readlists using Meilisearch, driven by contract-based ReadlistListQuery.',
        tags: ['Meili', 'Readlists', 'Search'],
      },
    },
  )

  /**
   * Search units using Meilisearch.
   *
   * GET /meili/units/search
   */
  .get(
    '/units/search',
    async ({query}) => {
      const options = query as UnitListQuery;
      return meiliService.searchUnits(options);
    },
    {
      query: unitListQuerySchema,
      detail: {
        summary: 'Search units (Meilisearch)',
        description:
          'Full-text search over generic units using Meilisearch, driven by contract-based UnitListQuery.',
        tags: ['Meili', 'Units', 'Search'],
      },
    },
  )

  /**
   * Initialize the `books` index (idempotent).
   *
   * POST /meili/books/init
   */
  .post(
    '/books/init',
    async () => {
      await meiliService.initBooksIndex();
      return {message: 'books index initialized'};
    },
    {
      detail: {
        summary: 'Init books index',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  /**
   * Initialize the `readlists` index (idempotent).
   *
   * POST /meili/readlists/init
   */
  .post(
    '/readlists/init',
    async () => {
      await meiliService.initReadlistsIndex();
      return {message: 'readlists index initialized'};
    },
    {
      detail: {
        summary: 'Init readlists index',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  /**
   * Initialize the `units` index (idempotent).
   *
   * POST /meili/units/init
   */
  .post(
    '/units/init',
    async () => {
      await meiliService.initUnitsIndex();
      return {message: 'units index initialized'};
    },
    {
      detail: {
        summary: 'Init units index',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  /**
   * Trigger a full sync of all books into Meilisearch.
   *
   * POST /meili/books/sync
   */
  .post(
    '/books/sync',
    async () => {
      const task = await meiliService.syncAllBooks();
      return {task};
    },
    {
      detail: {
        summary: 'Sync all books to Meilisearch',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  /**
   * Trigger a full sync of all readlists into Meilisearch.
   *
   * POST /meili/readlists/sync
   */
  .post(
    '/readlists/sync',
    async () => {
      const task = await meiliService.syncAllReadlists();
      return {task};
    },
    {
      detail: {
        summary: 'Sync all readlists to Meilisearch',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  /**
   * Trigger a full sync of all units into Meilisearch.
   *
   * POST /meili/units/sync
   */
  .post(
    '/units/sync',
    async () => {
      const task = await meiliService.syncAllUnits();
      return {task};
    },
    {
      detail: {
        summary: 'Sync all units to Meilisearch',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  .get(
    '/units/deleteAllUnits',
    async () => {
      await deleteAllUnits();
      return {message: 'all units deleted'};
    },
    {
      detail: {
        summary: 'Delete all units from Meilisearch',
        tags: ['Meili', 'Admin'],
      },
    },
  )

  /**
   * Create a frontend-safe search key.
   *
   * POST /meili/keys/search
   */
  .post(
    '/keys/search',
    // Require authentication before issuing a search key.
    async ({headers, jwt, set}) => {
      await verifyAuth(headers.authorization, jwt, set);
      const key = await meiliService.createSearchKey();
      return {key};
    },
    {
      detail: {
        summary: 'Create search-only API key',
        tags: ['Meili', 'Keys'],
      },
    },
  )

  /**
   * Create an admin key (server-side only).
   *
   * POST /meili/keys/admin
   */
  .post(
    '/keys/admin',
    async ({headers, jwt, set}) => {
      await verifyAuth(headers.authorization, jwt, set);
      const key = await meiliService.createAdminKey();
      return key;
    },
    {
      detail: {
        summary: 'Create admin API key',
        tags: ['Meili', 'Keys', 'Admin'],
      },
    },
  )

  /**
   * List Meilisearch keys.
   *
   * GET /meili/keys
   */
  .get(
    '/keys',
    async ({headers, jwt, set}) => {
      await verifyAuth(headers.authorization, jwt, set);
      return meiliService.listKeys();
    },
    {
      detail: {
        summary: 'List Meilisearch keys',
        tags: ['Meili', 'Keys', 'Admin'],
      },
    },
  )

  /**
   * Delete a Meilisearch key by UID.
   *
   * DELETE /meili/keys/:uid
   */
  .delete(
    '/keys/:uid',
    async ({params, headers, jwt, set}) => {
      await verifyAuth(headers.authorization, jwt, set);
      await meiliService.deleteKey(params.uid);
      return {message: 'key deleted'};
    },
    {
      params: t.Object({
        uid: t.String(),
      }),
      detail: {
        summary: 'Delete Meilisearch key',
        tags: ['Meili', 'Keys', 'Admin'],
      },
    },
  );

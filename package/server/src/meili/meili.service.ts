import type {
  BookQueryOptions,
  BookSearchResult,
  FeedbackListQuery,
  FeedbackSearchResult,
  ReadlistListQuery,
  ReadlistSearchResult,
  UnitListQuery,
  UnitSearchResult,
  UserListQuery,
  UserSearchResult,
} from "@rezics/contract";
import {
  syncAllBooks,
  syncAllFeedbacks,
  syncAllReadlists,
  syncAllUnits,
  syncAllUsers,
} from "@rezics/search";
import { searchBooks } from "./book/book.api";
import { searchFeedbacks } from "./feedback/feedback.api";
import { searchReadlists } from "./readlist/readlist.api";
import { searchClient } from "./search-client";
import { searchUnits } from "./unit/unit.api";
import { searchUsers } from "./user/user.api";

export class MeiliService {
  async searchBooks(options: BookQueryOptions): Promise<BookSearchResult> {
    return searchBooks(options);
  }

  async searchUnits(options: UnitListQuery): Promise<UnitSearchResult> {
    return searchUnits(options);
  }

  async searchReadlists(
    options: ReadlistListQuery,
  ): Promise<ReadlistSearchResult> {
    return searchReadlists(options);
  }

  async searchFeedbacks(
    options: FeedbackListQuery,
  ): Promise<FeedbackSearchResult> {
    return searchFeedbacks(options);
  }

  async searchUsers(options: UserListQuery): Promise<UserSearchResult> {
    return searchUsers(options);
  }

  async initBooksIndex(): Promise<void> {
    await searchClient.initBookIndex();
  }

  async initUnitsIndex(): Promise<void> {
    await searchClient.initUnitIndex();
  }

  async initReadlistsIndex(): Promise<void> {
    await searchClient.initReadlistIndex();
  }

  async initFeedbacksIndex(): Promise<void> {
    await searchClient.initFeedbackIndex();
  }

  async initUsersIndex(): Promise<void> {
    await searchClient.initUserIndex();
  }

  async syncAllBooks(): Promise<unknown> {
    return syncAllBooks(searchClient);
  }

  async syncAllUnits(): Promise<unknown> {
    return syncAllUnits(searchClient);
  }

  async syncAllReadlists(): Promise<unknown> {
    return syncAllReadlists(searchClient);
  }

  async syncAllFeedbacks(): Promise<unknown> {
    return syncAllFeedbacks(searchClient);
  }

  async syncAllUsers(): Promise<unknown> {
    return syncAllUsers(searchClient);
  }

  async createSearchKey(): Promise<string> {
    return searchClient.getSearchKey();
  }

  async createAdminKey() {
    return searchClient.getAdminKey();
  }

  async listKeys() {
    return searchClient.listKeys();
  }

  async deleteKey(keyUid: string) {
    return searchClient.deleteKey(keyUid);
  }
}

export const meiliService = new MeiliService();

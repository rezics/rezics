import type {
  ContentSearchOptions,
  ContentSearchResult,
  FeedbackListQuery,
  FeedbackSearchResult,
  UserListQuery,
  UserSearchResult,
} from "@rezics/contract";
import {
  syncAllContent,
  syncAllFeedbacks,
  syncAllUsers,
  syncSingleContent,
} from "@rezics/search";
import { searchContent } from "./content/content.service";
import { searchFeedbacks } from "./feedback/feedback.api";
import { searchClient } from "./search-client";
import { searchUsers } from "./user/user.api";

export class MeiliService {
  async searchContent(
    options: ContentSearchOptions,
  ): Promise<ContentSearchResult> {
    return searchContent(options);
  }

  async searchFeedbacks(
    options: FeedbackListQuery,
  ): Promise<FeedbackSearchResult> {
    return searchFeedbacks(options);
  }

  async searchUsers(options: UserListQuery): Promise<UserSearchResult> {
    return searchUsers(options);
  }

  async initContentIndex(): Promise<void> {
    await searchClient.initContentIndex();
  }

  async initFeedbacksIndex(): Promise<void> {
    await searchClient.initFeedbackIndex();
  }

  async initUsersIndex(): Promise<void> {
    await searchClient.initUserIndex();
  }

  async syncAllContent(): Promise<unknown> {
    return syncAllContent(searchClient);
  }

  async syncSingleContent(unitId: string): Promise<void> {
    return syncSingleContent(searchClient, unitId);
  }

  async syncAllFeedbacks(): Promise<unknown> {
    return syncAllFeedbacks(searchClient);
  }

  async syncAllUsers(): Promise<unknown> {
    return syncAllUsers(searchClient);
  }

  async deleteAllFeedbacks() {
    return searchClient.deleteAllFeedbacks();
  }

  async deleteAllUsers() {
    return searchClient.deleteAllUsers();
  }

  async deleteAllIndexes() {
    return searchClient.deleteAllIndexes();
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

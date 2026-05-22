import type {
  ContentSearchOptions,
  ContentSearchResult,
  EntitySearchOptions,
  EntitySearchResult,
  FeedbackListQuery,
  FeedbackSearchResult,
  PostSearchOptions,
  PostSearchResult,
  RealmSearchOptions,
  RealmSearchResult,
  UserListQuery,
  UserSearchResult,
} from "@rezics/contract";
import {
  syncAllContent,
  syncAllEntities,
  syncAllFeedbacks,
  syncAllPosts,
  syncAllRealms,
  syncAllUsers,
  syncSingleContent,
} from "@rezics/search";
import { searchContent } from "./content/content.service";
import { searchEntities } from "./entity/entity.service";
import { searchFeedbacks } from "./feedback/feedback.api";
import { searchPosts } from "./post/post.service";
import { searchRealms } from "./realm/realm.service";
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

  async searchPosts(options: PostSearchOptions): Promise<PostSearchResult> {
    return searchPosts(options);
  }

  async searchRealms(options: RealmSearchOptions): Promise<RealmSearchResult> {
    return searchRealms(options);
  }

  async searchEntities(
    options: EntitySearchOptions,
  ): Promise<EntitySearchResult> {
    return searchEntities(options);
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

  async initPostsIndex(): Promise<void> {
    await searchClient.initPostIndex();
  }

  async initRealmsIndex(): Promise<void> {
    await searchClient.initRealmIndex();
  }

  async initEntitiesIndex(): Promise<void> {
    await searchClient.initEntityIndex();
  }

  async initProgressIndex(): Promise<void> {
    await searchClient.initProgressIndex();
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

  async syncAllPosts(): Promise<unknown> {
    return syncAllPosts(searchClient);
  }

  async syncAllRealms(): Promise<unknown> {
    return syncAllRealms(searchClient);
  }

  async syncAllEntities(): Promise<unknown> {
    return syncAllEntities(searchClient);
  }

  async deleteAllFeedbacks() {
    return searchClient.deleteAllFeedbacks();
  }

  async deleteAllUsers() {
    return searchClient.deleteAllUsers();
  }

  async deleteAllPosts() {
    return searchClient.deleteAllPosts();
  }

  async deleteAllRealms() {
    return searchClient.deleteAllRealms();
  }

  async deleteAllEntities() {
    return searchClient.deleteAllEntities();
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
